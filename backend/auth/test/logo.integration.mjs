// Integration test: organization logos. Run against a RUNNING dev stack (auth :3333, database).
//   cd backend/auth && DATABASE_USER=samvr npx dotenv-cli -e ../../.env -- node test/logo.integration.mjs
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require = createRequire(new URL('../../database/package.json', import.meta.url));
const { Client } = require('pg');
const AUTH = process.env.AUTH_URL ?? 'http://localhost:3333';
const suffix = randomUUID().slice(0, 8);
let failed = 0, passed = 0;
const check = (name, ok, extra = '') => { ok ? passed++ : failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + extra}`); };

class Http {
  jar = '';
  async req(method, path, body) {
    const res = await fetch(AUTH + path, { method, headers: { 'content-type': 'application/json', cookie: this.jar, origin: 'http://localhost:5173' }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.getSetCookie?.() ?? [];
    if (set.length) this.jar = set.map(c => c.split(';')[0]).join('; ');
    const buf = Buffer.from(await res.arrayBuffer()); const text = buf.toString('utf8'); let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, buf, headers: res.headers };
  }
  post(path, body) { return this.req('POST', path, body ?? {}); }
  get(path) { return this.req('GET', path); }
  async login(username, password) { const r = await this.post('/user/login', { username, password }); if (r.status !== 200) throw Error(`login ${username} failed ${r.status}`); return this; }
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(32, 2)]);
const b64 = b => b.toString('base64');

const db = new Client({ host: 'localhost', user: process.env.DATABASE_USER ?? 'postgres', password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME });
await db.connect();
const orgIds = [];
try {
  const admin = await new Http().login('överchefen', process.env.ADMIN_PASSWORD);
  const A = (await admin.post('/org/create', { name: `Logo-A ${suffix}`, type: 'municipality' })).data;
  const B = (await admin.post('/org/create', { name: `Logo-B ${suffix}`, type: 'company' })).data;
  orgIds.push(A.organizationId, B.organizationId);
  const pw = 'Logo-test-1234';
  const mk = async (name, org, role) => (await admin.post('/org/user/create', { organizationId: org.organizationId, username: `${name}_${suffix}`, password: pw, role })).data;
  await mk('adminA', A, 'org_admin'); await mk('memberA', A, 'member');
  const adminA = await new Http().login(`adminA_${suffix}`, pw);
  const memberA = await new Http().login(`memberA_${suffix}`, pw);
  const set = (c, org, image) => c.post('/org/logo', { organizationId: org.organizationId, image });
  const logoUrl = org => `/gallery/logo/${org.organizationId}`;

  check('no logo yet -> 404', (await new Http().get(logoUrl(A))).status === 404);
  check('org admin uploads a PNG', (await set(adminA, A, b64(PNG))).status === 200);
  const got = await new Http().get(logoUrl(A));
  check('logo is public and served with the right type', got.status === 200 && got.headers.get('content-type') === 'image/png' && got.buf.equals(PNG));
  check('logo is served with nosniff + locked-down CSP', got.headers.get('x-content-type-options') === 'nosniff' && /default-src 'none'/.test(got.headers.get('content-security-policy') ?? ''));
  const v1 = (await adminA.get(`/org/${A.organizationId}`)).data.organization.logoVersion;
  check('organization details carry a logo version', typeof v1 === 'number');
  check('replacing with JPEG works and bumps the version', (await set(adminA, A, b64(JPEG))).status === 200 && (await adminA.get(`/org/${A.organizationId}`)).data.organization.logoVersion === v1 + 1);
  check('JPEG is served as image/jpeg', (await new Http().get(logoUrl(A))).headers.get('content-type') === 'image/jpeg');
  check('WebP works', (await set(adminA, A, b64(WEBP))).status === 200 && (await new Http().get(logoUrl(A))).headers.get('content-type') === 'image/webp');
  const list = (await adminA.get('/org/list')).data;
  check('org list carries the logo version', typeof list.find(o => o.organizationId === A.organizationId)?.logoVersion === 'number');

  // rejected content
  check('SVG is refused', (await set(adminA, A, b64(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')))).status === 400);
  check('HTML is refused', (await set(adminA, A, b64(Buffer.from('<html><script>alert(1)</script></html>')))).status === 400);
  check('GIF is refused', (await set(adminA, A, b64(Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(40)])))).status === 400);
  check('a file that is too large is refused', (await set(adminA, A, b64(Buffer.concat([PNG, Buffer.alloc(310 * 1024)])))).status === 400);
  check('garbage is refused', (await set(adminA, A, '!!!!')).status === 400);
  check('empty is refused', (await set(adminA, A, '')).status === 400);
  check('refused uploads left the previous logo untouched', (await new Http().get(logoUrl(A))).headers.get('content-type') === 'image/webp');

  // permissions
  check('plain member cannot upload', (await set(memberA, A, b64(PNG))).status === 403);
  check('org admin cannot upload for another organization', (await set(adminA, B, b64(PNG))).status === 403);
  check('anonymous cannot upload', (await set(new Http(), A, b64(PNG))).status === 403);
  check('platform admin can upload for any organization', (await set(admin, B, b64(PNG))).status === 200);
  check('plain member cannot remove', (await memberA.post('/org/logo/remove', { organizationId: A.organizationId })).status === 403);
  check('org admin of A cannot remove B\'s logo', (await adminA.post('/org/logo/remove', { organizationId: B.organizationId })).status === 403);

  // gallery shows the version
  await db.query('insert into "VrSpaces" (name, "ownerUserId", visibility, "listedInGallery", "organizationId") values ($1, (select "userId" from "Users" where username = $2), \'public\', true, $3)', [`Logo-rum ${suffix}`, 'överchefen', A.organizationId]);
  const tiles = (await new Http().get('/gallery/organizations')).data;
  check('gallery tile carries the logo version', typeof tiles.find(o => o.organizationId === A.organizationId)?.logoVersion === 'number');
  check('gallery organization page carries the logo version', typeof (await new Http().get(`/gallery/organizations/${A.organizationId}`)).data.organization.logoVersion === 'number');

  // removal
  check('org admin removes the logo', (await adminA.post('/org/logo/remove', { organizationId: A.organizationId })).status === 200);
  check('removed logo -> 404', (await new Http().get(logoUrl(A))).status === 404);
  check('details show no logo after removal', (await adminA.get(`/org/${A.organizationId}`)).data.organization.logoVersion === null);
  check('removing again is harmless', (await adminA.post('/org/logo/remove', { organizationId: A.organizationId })).status === 200);
} finally {
  try {
    await db.query('delete from "VrSpaces" where name = $1', [`Logo-rum ${suffix}`]);
    await db.query('delete from "UnitMembers" where "organizationId" = any($1)', [orgIds]);
    await db.query('delete from "OrganizationMembers" where "organizationId" = any($1)', [orgIds]);
    await db.query('delete from "Users" where username like $1', [`%\\_${suffix}`]);
    await db.query('delete from "Organizations" where "organizationId" = any($1)', [orgIds]);
    const { rowCount } = await db.query('select 1 from "OrganizationLogos" where "organizationId" = any($1)', [orgIds]);
    console.log(rowCount === 0 ? 'PASS  logos removed together with their organizations' : 'FAIL  logo rows left behind');
    if (rowCount !== 0) failed++; else passed++;
  } catch (e) { console.log('cleanup problem:', e.message); }
  await db.end();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
