// Integration test: "Hantera användare" for an organization's own administrators (/manage/org/:id/users).
// Run against a RUNNING dev stack (auth :3333, database). Creates and removes its own data.
//   cd backend/auth && DATABASE_USER=samvr npx dotenv-cli -e ../../.env -- node test/org-user-admin.integration.mjs
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
  async login(username, password) { const r = await this.post('/user/login', { username, password }); if (r.status !== 200) throw Error(`login ${username} failed ${r.status} ${JSON.stringify(r.data)}`); return this; }
}

const db = new Client({ host: 'localhost', user: process.env.DATABASE_USER ?? 'postgres', password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME });
await db.connect();
const orgIds = [];
const n = s => `${s}_${suffix}`;
try {
  const god = await new Http().login('överchefen', process.env.ADMIN_PASSWORD);
  const A = (await god.post('/org/create', { name: `OrgAdm-A ${suffix}`, type: 'municipality' })).data;
  const B = (await god.post('/org/create', { name: `OrgAdm-B ${suffix}`, type: 'company' })).data;
  orgIds.push(A.organizationId, B.organizationId);
  const unit = (await god.post('/org/unit/create', { organizationId: A.organizationId, name: 'Kaparen' })).data;
  const dept = (await god.post('/org/department/create', { unitId: unit.unitId, name: 'Klass 9X' })).data;
  const pw = 'Orgadm-test-1234';
  const mk = async (name, org, role) => (await god.post('/org/user/create', { organizationId: org.organizationId, username: n(name), password: pw, role })).data;
  const adminA = await mk('adminA', A, 'org_admin'); const adminA2 = await mk('adminA2', A, 'org_admin');
  const m1 = await mk('medlem1', A, 'member'); const b1 = await mk('anvandare1', A, 'basic'); const m2 = await mk('tvaorg', A, 'member');
  await god.post('/org/member/set', { organizationId: B.organizationId, userId: m2.userId, role: 'member' });
  const adminB = await mk('adminB', B, 'org_admin'); const mB = await mk('medlemB', B, 'member');
  await god.post('/org/department/member/set', { departmentId: dept.departmentId, userId: m1.userId });

  const A_ = `/manage/org/${A.organizationId}/users`, B_ = `/manage/org/${B.organizationId}/users`;
  const ca = await new Http().login(n('adminA'), pw);
  const cb = await new Http().login(n('adminB'), pw);
  const cm = await new Http().login(n('medlem1'), pw);

  // ---- access ----
  check('org admin lists own organization', (await ca.get(A_)).status === 200);
  check('org admin of B cannot list A -> 403', (await cb.get(A_)).status === 403);
  check('plain member cannot list -> 403', (await cm.get(A_)).status === 403);
  check('anonymous -> 403', (await new Http().get(A_)).status === 403);
  check('platform admin may use it', (await god.get(A_)).status === 200);
  check('bad organization id -> 400', (await ca.get('/manage/org/not-a-uuid/users')).status === 400);

  // ---- list / search / filters ----
  const list = async (qs = '', c = ca, base = A_) => (await c.get(`${base}?${qs}`)).data;
  const names = r => r.users.map(u => u.username);
  let r = await list('limit=100');
  check('only this organization\'s people are listed', r.total === 5 && !names(r).includes(n('medlemB')) && !names(r).includes(n('adminB')), JSON.stringify(names(r)));
  check('a person in two organizations shows up in each', names(r).includes(n('tvaorg')) && names(await list('', cb, B_)).includes(n('tvaorg')));
  r = await list(`search=${n('medlem1')}`);
  check('search by name', r.total === 1 && r.users[0].username === n('medlem1'));
  r = await list('search=KAPAREN');
  check('search by unit name (any case)', r.total === 1 && r.users[0].username === n('medlem1') && r.users[0].units.includes('Kaparen'));
  r = await list('search=klass 9x');
  check('search by department name', r.total === 1 && r.users[0].username === n('medlem1') && r.users[0].departments.includes('Klass 9X'));
  r = await list('role=basic');
  check('filter by organization role', r.total === 1 && r.users[0].username === n('anvandare1'));
  r = await list('role=org_admin');
  check('filter administrators', r.total === 2);
  check('wildcards are literal', (await list('search=%25')).total === 0);
  r = await list('limit=2&offset=0'); const p2 = await list('limit=2&offset=2');
  check('pagination', r.users.length === 2 && p2.users.length === 2 && r.total === 5 && !names(r).some(x => names(p2).includes(x)));
  r = await list('sort=role&order=asc&limit=100');
  check('sort by role (highest first)', r.users[0].orgRole === 'org_admin' && r.users.at(-1).orgRole === 'basic');
  check('bad parameters -> 400', (await ca.get(`${A_}?limit=5000`)).status === 400 && (await ca.get(`${A_}?role=wizard`)).status === 400);
  check('no password hashes in the answer', !JSON.stringify(await list('limit=100')).includes('password'));
  const byName = Object.fromEntries((await list('limit=100')).users.map(u => [u.username, u]));
  check('plain member is manageable', byName[n('medlem1')].manageReason === null && byName[n('anvandare1')].manageReason === null);
  check('another administrator is not manageable', /plattformsadministratören/.test(byName[n('adminA2')].manageReason ?? ''));
  check('yourself is not manageable', !!byName[n('adminA')].manageReason);
  check('someone in two organizations is not manageable', /flera organisationer/.test(byName[n('tvaorg')].manageReason ?? ''));
  check('a platform admin may manage administrators', (await list('limit=100', god)).users.find(u => u.username === n('adminA2')).manageReason === null);
  const sum = (await ca.get(`${A_}/summary`)).data;
  check('summary', sum.total === 5 && sum.blocked === 0 && sum.byRole.some(x => x.role === 'basic' && x.count === 1));
  check('summary is scoped too', (await cb.get(`${A_}/summary`)).status === 403);

  // ---- password ----
  check('member logged in before the reset', (await cm.get('/user/me')).status === 200);
  const reset = await ca.post(`${A_}/password`, { userId: m1.userId });
  check('generated password', reset.status === 200 && reset.data.password?.length >= 10);
  check('it works and ends the old session', (await new Http().post('/user/login', { username: n('medlem1'), password: reset.data.password })).status === 200 && (await cm.get('/user/me')).status === 403);
  check('a chosen password works too', (await ca.post(`${A_}/password`, { userId: m1.userId, password: 'Valt-losen-5678' })).status === 200 && (await new Http().post('/user/login', { username: n('medlem1'), password: 'Valt-losen-5678' })).status === 200);
  check('cannot reset another administrator -> 403', (await ca.post(`${A_}/password`, { userId: adminA2.userId })).status === 403);
  check('cannot reset someone in two organizations -> 403', (await ca.post(`${A_}/password`, { userId: m2.userId })).status === 403);
  check('cannot reset someone from another organization -> 404', (await ca.post(`${A_}/password`, { userId: mB.userId })).status === 404);
  check('cannot reset yourself -> 400', (await ca.post(`${A_}/password`, { userId: adminA.userId })).status === 400);
  check('the other organization\'s admin cannot reset A\'s member -> 403', (await cb.post(`${A_}/password`, { userId: m1.userId })).status === 403);

  // ---- block ----
  check('block a member', (await ca.post(`${A_}/block`, { userId: b1.userId, blocked: true, reason: 'Test' })).status === 200);
  const att = await new Http().post('/user/login', { username: n('anvandare1'), password: pw });
  check('the blocked person cannot log in', att.status === 403 && /spärrat/.test(att.data));
  check('status filter shows them', (await list('status=blocked')).total === 1 && (await list('status=active')).total === 4);
  check('unblock', (await ca.post(`${A_}/block`, { userId: b1.userId, blocked: false })).status === 200 && (await new Http().post('/user/login', { username: n('anvandare1'), password: pw })).status === 200);
  check('cannot block an administrator -> 403', (await ca.post(`${A_}/block`, { userId: adminA2.userId, blocked: true })).status === 403);
  check('cannot block someone in two organizations -> 403', (await ca.post(`${A_}/block`, { userId: m2.userId, blocked: true })).status === 403);

  // ---- message ----
  const one = await ca.post(`${A_}/message`, { userIds: [m1.userId], subject: 'Hej', body: 'Test' });
  check('message to one member', one.status === 200 && one.data.sent === 1);
  const mixed = await ca.post(`${A_}/message`, { userIds: [m1.userId, mB.userId], subject: 'Blandat', body: 'Test' });
  check('recipients outside the organization are ignored', mixed.status === 200 && mixed.data.sent === 1);
  const all = await ca.post(`${A_}/message`, { everyone: true, subject: 'Alla', body: 'Till hela organisationen' });
  check('message to everyone in the organization', all.status === 200 && all.data.sent === 5, JSON.stringify(all.data));
  const m1in = await new Http().login(n('medlem1'), 'Valt-losen-5678');
  const inbox = (await m1in.get('/messages')).data;
  check('the recipient sees it, from the administrator', inbox.messages.some(m => m.subject === 'Alla' && m.from === n('adminA')));
  const mBin = await new Http().login(n('medlemB'), pw);
  check('people in the other organization got nothing', (await mBin.get('/messages')).data.messages.length === 0);
  check('no recipients -> 400', (await ca.post(`${A_}/message`, { subject: 'x', body: 'y' })).status === 400 && (await ca.post(`${A_}/message`, { userIds: [mB.userId], subject: 'x', body: 'y' })).status === 400);
  check('needs subject and body -> 400', (await ca.post(`${A_}/message`, { everyone: true, subject: '', body: 'y' })).status === 400);
  check('the other organization\'s admin cannot message A -> 403', (await cb.post(`${A_}/message`, { everyone: true, subject: 'x', body: 'y' })).status === 403);
  check('plain member cannot send -> 403', (await m1in.post(`${A_}/message`, { everyone: true, subject: 'x', body: 'y' })).status === 403);

  // ---- delete ----
  check('cannot delete another administrator -> 403', (await ca.post(`${A_}/delete`, { userId: adminA2.userId })).status === 403);
  check('cannot delete someone in two organizations -> 403', (await ca.post(`${A_}/delete`, { userId: m2.userId })).status === 403);
  check('cannot delete yourself -> 400', (await ca.post(`${A_}/delete`, { userId: adminA.userId })).status === 400);
  const del = await ca.post(`${A_}/delete`, { userId: b1.userId });
  check('delete a member', del.status === 200 && (await db.query('select 1 from "Users" where "userId" = $1', [b1.userId])).rowCount === 0);
  check('deleting from the wrong organization -> 403', (await cb.post(`${B_}/delete`, { userId: m1.userId })).status === 404);
} finally {
  try {
    await db.query('delete from "DepartmentMembers" where "unitId" in (select "unitId" from "Units" where "organizationId" = any($1))', [orgIds]);
    await db.query('delete from "Departments" where "organizationId" = any($1)', [orgIds]);
    await db.query('delete from "UnitMembers" where "organizationId" = any($1)', [orgIds]);
    await db.query('delete from "OrganizationMembers" where "organizationId" = any($1)', [orgIds]);
    await db.query('delete from "Users" where username like $1', [`%\\_${suffix}`]);
    await db.query('delete from "Units" where "organizationId" = any($1)', [orgIds]);
    await db.query('delete from "Organizations" where "organizationId" = any($1)', [orgIds]);
  } catch (e) { console.log('cleanup problem:', e.message); }
  await db.end();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
