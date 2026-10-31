import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';
import { parse as parseEvent } from '../node_modules/devalue/index.js';

const require = createRequire('/app/backend/database/package.json');
const { Client } = require('pg');
const bcrypt = require('bcrypt');
const { AUTH_TEST_URL: authUrl, MEDIA_TEST_URL: mediaUrl, DATABASE_URL } = process.env;
if (!authUrl || !mediaUrl || !DATABASE_URL) throw Error('Isolated test service URLs are required');

const db = new Client({ connectionString: DATABASE_URL });
const users = {};
const sockets = [];
const suffix = randomUUID();
const targets = {};

async function connect(username) {
  const login = await fetch(`${authUrl}/user/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: 'permission-test-password' }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  const response = await fetch(`${authUrl}/user/jwt`, { headers: { cookie } });
  assert.equal(response.status, 200);
  const token = await response.text();
  return connectToken(token);
}

async function connectToken(token) {
  const socket = new WebSocket(`${mediaUrl}?token=${encodeURIComponent(token)}`);
  const pending = new Map();
  const eventWaiters = new Set();
  let nextId = 0;
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (Array.isArray(message)) {
      const event = parseEvent(data);
      for (const waiter of eventWaiters) waiter(event);
    } else if (pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(Object.assign(Error(message.error.json.message), { code: message.error.json.data.code }));
      else resolve(message.result.data?.json);
    }
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const client = {
    call(method, path, input) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params: { path, input: { json: input ?? null } } }));
      });
    },
    event(predicate) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { eventWaiters.delete(waiter); reject(Error('Timed out waiting for update')); }, 5000);
        const waiter = event => {
          if (!predicate(event)) return;
          clearTimeout(timeout);
          eventWaiters.delete(waiter);
          resolve(event);
        };
        eventWaiters.add(waiter);
      });
    },
    close() { socket.close(); },
  };
  sockets.push(client);
  return client;
}

async function grant(user, target, permissionLevel) {
  await db.query(`INSERT INTO "Permissions" ("userId", "targetType", "targetId", "permissionLevel")
    VALUES ($1, $2, $3, $4) ON CONFLICT ("userId", "targetType", "targetId")
    DO UPDATE SET "permissionLevel" = EXCLUDED."permissionLevel"`,
  [user.userId, target.type, target.id, permissionLevel]);
}

async function getGrant(user, target) {
  const { rows } = await db.query('SELECT "permissionLevel" FROM "Permissions" WHERE "userId" = $1 AND "targetType" = $2 AND "targetId" = $3',
    [user.userId, target.type, target.id]);
  return rows[0]?.permissionLevel;
}

const remove = (caller, user, target) => caller.ws.call('mutation', 'user.removePermission', {
  userId: user.userId, targetType: target.type, targetId: target.id,
});
const forbidden = promise => assert.rejects(promise, error => error.code === 'FORBIDDEN');

before(async () => {
  await db.connect();
  const passwordHash = await bcrypt.hash('permission-test-password', 4);
  for (const [name, role] of Object.entries({ owner: 'user', editor: 'user', admin: 'user', viewer: 'user', outsider: 'user', recipient: 'user', superadmin: 'superadmin' })) {
    const username = `${name}-${suffix}`;
    const { rows } = await db.query('INSERT INTO "Users" (username, password, role) VALUES ($1, $2, $3) RETURNING "userId"', [username, passwordHash, role]);
    users[name] = { ...rows[0], ws: await connect(username) };
  }
  const vrSpace = await db.query('INSERT INTO "VrSpaces" (name, "ownerUserId", visibility) VALUES ($1, $2, $3) RETURNING "vrSpaceId"', [`permissions-vr-${suffix}`, users.owner.userId, 'private']);
  const stream = await db.query('INSERT INTO "Streams" (name, "ownerUserId", visibility) VALUES ($1, $2, $3) RETURNING "streamId"', [`permissions-stream-${suffix}`, users.owner.userId, 'private']);
  targets.vrSpace = { type: 'vrSpace', id: vrSpace.rows[0].vrSpaceId };
  targets.stream = { type: 'stream', id: stream.rows[0].streamId };
  for (const target of Object.values(targets)) {
    for (const [name, level] of [['editor', 'edit'], ['admin', 'admin'], ['viewer', 'view']]) await grant(users[name], target, level);
  }
});

after(async () => {
  for (const socket of sockets) socket.close();
  await db.end();
});

test('rejects guests, outsiders and view-only users for both target types', async () => {
  const guestToken = await (await fetch(`${authUrl}/guest-jwt`)).text();
  const guest = { ws: await connectToken(guestToken) };
  for (const target of Object.values(targets)) {
    await grant(users.recipient, target, 'view');
    await assert.rejects(remove(guest, users.recipient, target), error => error.code === 'UNAUTHORIZED');
    await forbidden(remove(users.outsider, users.recipient, target));
    await forbidden(remove(users.viewer, users.recipient, target));
    assert.equal(await getGrant(users.recipient, target), 'view');
  }
});

test('editors can remove view or edit grants, but not admin grants', async () => {
  for (const target of Object.values(targets)) {
    for (const level of ['view', 'edit']) {
      await grant(users.recipient, target, level);
      const deleted = await remove(users.editor, users.recipient, target);
      assert.equal(deleted.permissionLevel, level);
      assert.equal(await getGrant(users.recipient, target), undefined);
    }
    await grant(users.recipient, target, 'admin');
    await forbidden(remove(users.editor, users.recipient, target));
    assert.equal(await getGrant(users.recipient, target), 'admin');
  }
});

test('owners, admins and superadmins can remove permitted grants from unloaded targets', async () => {
  for (const target of Object.values(targets)) {
    for (const actor of [users.owner, users.admin, users.superadmin]) {
      await grant(users.recipient, target, 'admin');
      assert.equal((await remove(actor, users.recipient, target)).permissionLevel, 'admin');
      assert.equal(await getGrant(users.recipient, target), undefined);
    }
  }
});

test('a permission holder may remove their own grant but loses management access', async () => {
  for (const target of Object.values(targets)) {
    await grant(users.editor, target, 'edit');
    assert.equal((await remove(users.editor, users.editor, target)).permissionLevel, 'edit');
    await grant(users.recipient, target, 'view');
    await forbidden(remove(users.editor, users.recipient, target));
    assert.equal(await getGrant(users.recipient, target), 'view');
    await grant(users.editor, target, 'edit');
  }
});

test('returns not found for a missing target or permission', async () => {
  await assert.rejects(remove(users.owner, users.recipient, { type: 'vrSpace', id: randomUUID() }), error => error.code === 'NOT_FOUND');
  await db.query('DELETE FROM "Permissions" WHERE "userId" = $1 AND "targetType" = $2 AND "targetId" = $3',
    [users.recipient.userId, targets.vrSpace.type, targets.vrSpace.id]);
  await assert.rejects(remove(users.owner, users.recipient, targets.vrSpace), error => error.code === 'NOT_FOUND');
});

test('refreshes a loaded VR space and notifies its clients', async () => {
  await grant(users.recipient, targets.vrSpace, 'view');
  for (let attempt = 0; ; attempt++) {
    try { await users.owner.ws.call('mutation', 'vr.enterVrSpace', { vrSpaceId: targets.vrSpace.id }); break; }
    catch (error) { if (attempt >= 20 || !error.message.includes('no soup workers')) throw error; await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  const event = users.owner.ws.event(event => event.route === 'vrSpace.vrSpaceStateUpdated'
    && event.data.reason === 'permission was deleted'
    && !event.data.data.dbData.allowedUsers.some(entry => entry.user.userId === users.recipient.userId));
  await remove(users.owner, users.recipient, targets.vrSpace);
  await event;
});

test('refreshes a loaded stream and notifies its clients', async () => {
  await grant(users.recipient, targets.stream, 'view');
  await users.owner.ws.call('mutation', 'stream.loadAndJoinStream', { streamId: targets.stream.id });
  const event = users.owner.ws.event(event => event.route === 'stream.streamStateUpdated' && event.data.reason === 'permission was deleted');
  await remove(users.owner, users.recipient, targets.stream);
  await event;
});

test('rejects a stale superadmin token after database role demotion', async () => {
  await grant(users.recipient, targets.vrSpace, 'view');
  await db.query('UPDATE "Users" SET role = $1 WHERE "userId" = $2', ['user', users.superadmin.userId]);
  await forbidden(remove(users.superadmin, users.recipient, targets.vrSpace));
  assert.equal(await getGrant(users.recipient, targets.vrSpace), 'view');
});

test('waits for a concurrent caller-permission downgrade before authorizing', async () => {
  await grant(users.editor, targets.vrSpace, 'edit');
  await grant(users.recipient, targets.vrSpace, 'view');
  const revoker = new Client({ connectionString: DATABASE_URL });
  await revoker.connect();
  try {
    await revoker.query('BEGIN');
    await revoker.query('UPDATE "Permissions" SET "permissionLevel" = $1 WHERE "userId" = $2 AND "targetType" = $3 AND "targetId" = $4',
      ['view', users.editor.userId, targets.vrSpace.type, targets.vrSpace.id]);
    let completed = false;
    const attempt = remove(users.editor, users.recipient, targets.vrSpace)
      .then(() => ({ ok: true }), error => ({ ok: false, error }))
      .finally(() => { completed = true; });
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.equal(completed, false, 'removal should wait for the concurrent permission change');
    await revoker.query('COMMIT');
    const result = await attempt;
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'FORBIDDEN');
    assert.equal(await getGrant(users.recipient, targets.vrSpace), 'view');
  } finally {
    await revoker.query('ROLLBACK');
    await revoker.end();
  }
});

test('checks the target permission again after a concurrent promotion', async () => {
  await grant(users.editor, targets.vrSpace, 'edit');
  await grant(users.recipient, targets.vrSpace, 'edit');
  const promoter = new Client({ connectionString: DATABASE_URL });
  await promoter.connect();
  try {
    await promoter.query('BEGIN');
    await promoter.query('UPDATE "Permissions" SET "permissionLevel" = $1 WHERE "userId" = $2 AND "targetType" = $3 AND "targetId" = $4',
      ['admin', users.recipient.userId, targets.vrSpace.type, targets.vrSpace.id]);
    let completed = false;
    const attempt = remove(users.editor, users.recipient, targets.vrSpace)
      .then(() => ({ ok: true }), error => ({ ok: false, error }))
      .finally(() => { completed = true; });
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.equal(completed, false, 'removal should wait for the concurrent permission change');
    await promoter.query('COMMIT');
    const result = await attempt;
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'FORBIDDEN');
    assert.equal(await getGrant(users.recipient, targets.vrSpace), 'admin');
  } finally {
    await promoter.query('ROLLBACK');
    await promoter.end();
  }
});
