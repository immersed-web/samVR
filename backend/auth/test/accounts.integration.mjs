// Integration test: organization-scoped account management (reset password / delete) and the
// platform-only old account endpoints. Run against a RUNNING dev stack (auth :3333, database).
//   cd backend/auth && DATABASE_USER=samvr npx dotenv-cli -e ../../.env -- node test/accounts.integration.mjs
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
    const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  }
  post(path, body) { return this.req('POST', path, body ?? {}); }
  get(path) { return this.req('GET', path); }
  async login(username, password) { const r = await this.post('/user/login', { username, password }); if (r.status !== 200) throw Error(`login ${username} failed ${r.status}`); return this; }
}

const db = new Client({ host: 'localhost', user: process.env.DATABASE_USER ?? 'postgres', password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME });
await db.connect();
const orgIds = [];
try {
  const admin = await new Http().login('överchefen', process.env.ADMIN_PASSWORD);
  const A = (await admin.post('/org/create', { name: `Konto-A ${suffix}`, type: 'municipality' })).data;
  const B = (await admin.post('/org/create', { name: `Konto-B ${suffix}`, type: 'company' })).data;
  orgIds.push(A.organizationId, B.organizationId);

  const pw = 'Konto-test-1234';
  const mk = async (name, org, role) => (await admin.post('/org/user/create', { organizationId: org.organizationId, username: `${name}_${suffix}`, password: pw, role })).data;
  const aA = await mk('adminA', A, 'org_admin');
  const aA2 = await mk('adminA2', A, 'org_admin');
  const m1 = await mk('onlyA', A, 'member');
  const m2 = await mk('inAandB', A, 'member');
  const m3 = await mk('onlyB', B, 'member');
  await admin.post('/org/member/set', { organizationId: B.organizationId, userId: m2.userId, role: 'member' });
  const un = n => `${n}_${suffix}`;

  const adminA = await new Http().login(un('adminA'), pw);
  const member = await new Http().login(un('onlyA'), pw);
  const pwd = (c, org, user, password = 'Nytt-losen-5678') => c.post('/org/user/password', { organizationId: org.organizationId, userId: user.userId, password });

  // ---- password ----
  check('org admin resets password of own plain member', (await pwd(adminA, A, m1)).status === 200);
  check('new password works', (await new Http().post('/user/login', { username: un('onlyA'), password: 'Nytt-losen-5678' })).status === 200);
  check('old password no longer works', (await new Http().post('/user/login', { username: un('onlyA'), password: pw })).status !== 200);
  check('too short password -> 400', (await pwd(adminA, A, m1, 'kort')).status === 400);
  check('cannot reset an account that is in two organizations -> 403', (await pwd(adminA, A, m2)).status === 403);
  check('platform admin can reset that account', (await pwd(admin, A, m2)).status === 200);
  check('cannot reset a user from another organization -> 404', (await pwd(adminA, A, m3)).status === 404);
  check('cannot reset another org admin -> 403', (await pwd(adminA, A, aA2)).status === 403);
  check('platform admin can reset an org admin', (await pwd(admin, A, aA2)).status === 200);
  check('cannot reset own account here -> 400', (await pwd(adminA, A, aA)).status === 400);
  check('plain member cannot reset anyone -> 403', (await pwd(member, A, m2)).status === 403);
  check('org admin of A cannot act through organization B -> 403', (await pwd(adminA, B, m3)).status === 403);
  check('anonymous -> 403', (await pwd(new Http(), A, m1)).status === 403);

  // ---- delete ----
  const exists = async name => (await db.query('select 1 from "Users" where username = $1', [name])).rowCount === 1;
  check('cannot delete an account in two organizations -> 403', (await adminA.post('/org/user/delete', { organizationId: A.organizationId, userId: m2.userId })).status === 403 && await exists(un('inAandB')));
  check('cannot delete another org admin -> 403', (await adminA.post('/org/user/delete', { organizationId: A.organizationId, userId: aA2.userId })).status === 403 && await exists(un('adminA2')));
  check('cannot delete self -> 400', (await adminA.post('/org/user/delete', { organizationId: A.organizationId, userId: aA.userId })).status === 400);
  check('plain member cannot delete -> 403', (await member.post('/org/user/delete', { organizationId: A.organizationId, userId: m2.userId })).status === 403);
  const del = await adminA.post('/org/user/delete', { organizationId: A.organizationId, userId: m1.userId });
  check('org admin deletes own plain member', del.status === 200 && !(await exists(un('onlyA'))));
  check('deleted account can no longer log in', (await new Http().post('/user/login', { username: un('onlyA'), password: 'Nytt-losen-5678' })).status !== 200);
  check('platform admin can delete an account in two organizations', (await admin.post('/org/user/delete', { organizationId: A.organizationId, userId: m2.userId })).status === 200 && !(await exists(un('inAandB'))));

  // ---- old platform-wide endpoints ----
  const other = { organizationId: A.organizationId };
  check('org admin cannot list all users platform-wide -> 403', (await adminA.get('/user/get-users')).status === 403);
  check('org admin cannot create accounts via the old endpoint -> 403', (await adminA.post('/user/create', { username: un('x'), password: pw, role: 'user' })).status === 403);
  check('org admin cannot delete accounts via the old endpoint -> 403', (await adminA.post('/user/delete', { userId: m3.userId })).status === 403 && await exists(un('onlyB')));
  check('org admin cannot update accounts via the old endpoint -> 403', (await adminA.post('/user/update', { userId: m3.userId, password: 'Hacked-1234!' })).status === 403);
  const plainAdmin = await admin.post('/user/create', { username: un('globalAdmin'), password: pw, role: 'admin' });
  const ga = await new Http().login(un('globalAdmin'), pw);
  check('a global "admin" (not platform admin) is also refused -> 403', (await ga.get('/user/get-users')).status === 403);
  check('platform admin still can list users', (await admin.get('/user/get-users')).status === 200);
  void other; void plainAdmin;
} finally {
  try {
    await db.query('delete from "UnitMembers" where "organizationId" = any($1)', [orgIds]);
    await db.query('delete from "OrganizationMembers" where "organizationId" = any($1)', [orgIds]);
    await db.query('delete from "Users" where username like $1', [`%\\_${suffix}`]);
    await db.query('delete from "Organizations" where "organizationId" = any($1)', [orgIds]);
  } catch (e) { console.log('cleanup problem:', e.message); }
  await db.end();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
