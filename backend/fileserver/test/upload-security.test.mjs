import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { request } from 'node:http';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';

const require = createRequire('/app/backend/database/package.json');
const { Client } = require('pg');
const bcrypt = require('bcrypt');
const jwt = createRequire('/app/backend/auth/package.json')('jsonwebtoken');
const { AUTH_TEST_URL: authUrl, FILESERVER_TEST_URL: fileUrl, DATABASE_URL } = process.env;
if (!authUrl || !fileUrl || !DATABASE_URL) throw Error('Isolated test service URLs are required');
const db = new Client({ connectionString: DATABASE_URL });
const directory = '/app/backend/fileserver/uploads';
const suffix = randomUUID();
let token, guestToken, userId;

async function upload(auth, data = new Uint8Array(64), filename = 'test.pdf') {
  const form = new FormData();
  form.append('file', new Blob([data], { type: 'application/pdf' }), filename);
  return fetch(`${fileUrl}/upload`, {
    method: 'POST', headers: { connection: 'close', ...(auth ? { authorization: `Bearer ${auth}` } : {}) }, body: form, signal: AbortSignal.timeout(10000),
  });
}
async function files() { return (await readdir(directory)).sort(); }
async function assetCount() {
  return Number((await db.query('SELECT count(*) FROM "Assets"')).rows[0].count);
}

before(async () => {
  await db.connect();
  const hash = await bcrypt.hash('upload-test-password', 4);
  const username = `upload-test-${suffix}`;
  const inserted = await db.query('INSERT INTO "Users" (username, password, role) VALUES ($1, $2, $3) RETURNING "userId"', [username, hash, 'user']);
  userId = inserted.rows[0].userId;
  const login = await fetch(`${authUrl}/user/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: 'upload-test-password' }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  const tokenResponse = await fetch(`${authUrl}/user/jwt`, { headers: { cookie } });
  assert.equal(tokenResponse.status, 200);
  token = await tokenResponse.text();
  const guestResponse = await fetch(`${authUrl}/guest-jwt`);
  assert.equal(guestResponse.status, 200);
  guestToken = await guestResponse.text();
});

after(async () => { await db.end(); });

test('rejects missing, invalid and guest credentials before writing', async () => {
  const before = await files();
  const count = await assetCount();
  assert.equal((await upload(undefined)).status, 401);
  assert.equal((await upload('invalid')).status, 401);
  assert.equal((await upload(guestToken)).status, 403);
  // Invalid form data confirms the guest is rejected before multipart validation.
  const guest = await fetch(`${fileUrl}/upload`, { method: 'POST', headers: { authorization: `Bearer ${guestToken}`, 'content-type': 'multipart/form-data; boundary=x' }, body: 'not multipart' });
  assert.equal(guest.status, 403);
  assert.deepEqual(await files(), before);
  assert.equal(await assetCount(), count);
});

test('accepts a file at the configured limit and serves it', async () => {
  const contents = new Uint8Array(1024).fill(42);
  const response = await upload(token, contents);
  assert.equal(response.status, 200);
  const asset = await response.json();
  assert.equal(asset.size, contents.length);
  const download = await fetch(`${fileUrl}/file/${asset.generatedName}`);
  assert.equal(download.status, 200);
  assert.deepEqual(new Uint8Array(await download.arrayBuffer()), contents);
});

test('rejects files above the file limit without writing', async () => {
  const before = await files();
  const count = await assetCount();
  assert.equal((await upload(token, new Uint8Array(1025))).status, 413);
  assert.deepEqual(await files(), before);
  assert.equal(await assetCount(), count);
});

test('rejects declared oversized bodies before multipart parsing', async () => {
  const before = await files();
  const response = await fetch(`${fileUrl}/upload`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
    body: new Uint8Array(1024 * 1024 + 1025),
  });
  assert.equal(response.status, 413);
  assert.equal(response.headers.get('connection'), 'close');
  assert.deepEqual(await files(), before);
});

test('rejects oversized chunked bodies without relying on content-length', async () => {
  const before = await files();
  const status = await new Promise((resolve, reject) => {
    const req = request(`${fileUrl}/upload`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream', 'transfer-encoding': 'chunked' } }, res => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    for (let i = 0; i < 17; i++) req.write(Buffer.alloc(65536));
    req.end();
  });
  assert.equal(status, 413);
  assert.deepEqual(await files(), before);
});

test('removes a written file when the database insert fails', async () => {
  const before = await files();
  const count = await assetCount();
  await db.query(`CREATE FUNCTION upload_test_reject_asset() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test insert failure'; END $$`);
  await db.query('CREATE TRIGGER upload_test_reject BEFORE INSERT ON "Assets" FOR EACH ROW EXECUTE FUNCTION upload_test_reject_asset()');
  try {
    assert.equal((await upload(token)).status, 500);
    assert.deepEqual(await files(), before);
    assert.equal(await assetCount(), count);
  } finally {
    await db.query('DROP TRIGGER upload_test_reject ON "Assets"');
    await db.query('DROP FUNCTION upload_test_reject_asset()');
  }
});

test('rejects valid tokens for demoted or deleted users before writing', async () => {
  const before = await files();
  const count = await assetCount();
  await db.query('UPDATE "Users" SET role = $1 WHERE "userId" = $2', ['guest', userId]);
  assert.equal((await upload(token)).status, 403);
  await db.query('UPDATE "Users" SET role = $1 WHERE "userId" = $2', ['user', userId]);
  const nonexistent = jwt.sign({ userId: randomUUID(), username: 'missing', role: 'user' }, process.env.JWT_SECRET, {
    issuer: process.env.JWT_ISSUER, audience: process.env.JWT_AUDIENCE, expiresIn: 60,
  });
  assert.equal((await upload(nonexistent)).status, 403);
  assert.deepEqual(await files(), before);
  assert.equal(await assetCount(), count);
});
