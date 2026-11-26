// Integration test for the organization routes, run against a RUNNING dev stack (auth on :3333, database).
// Creates its own uniquely named data and removes it afterwards.
//   cd backend/auth && DATABASE_USER=samvr npx dotenv-cli -e ../../.env -- node test/organizations.integration.mjs
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
    let data; const text = await res.text(); try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  }
  post(path, body) { return this.req('POST', path, body ?? {}); }
  get(path) { return this.req('GET', path); }
  async login(username, password) { const r = await this.post('/user/login', { username, password }); if (r.status !== 200) throw Error(`login ${username} failed ${r.status}`); return this; }
}

const db = new Client({ host: 'localhost', user: process.env.DATABASE_USER ?? 'postgres', password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME });
await db.connect();
const created = { orgs: [], users: [] };
try {
  const admin = await new Http().login('överchefen', process.env.ADMIN_PASSWORD);

  const org = (await admin.post('/org/create', { name: `Kommun ${suffix}`, type: 'municipality' })).data;
  const org2 = (await admin.post('/org/create', { name: `Företag ${suffix}`, type: 'company' })).data;
  created.orgs.push(org.organizationId, org2.organizationId);
  check('admin creates organizations', !!org.organizationId && !!org2.organizationId);
  check('duplicate organization name -> 409', (await admin.post('/org/create', { name: `Kommun ${suffix}` })).status === 409);
  check('invalid input -> 400', (await admin.post('/org/create', { name: '' })).status === 400);

  const u1 = (await admin.post('/org/unit/create', { organizationId: org.organizationId, name: 'Enhet 1' })).data;
  const u2 = (await admin.post('/org/unit/create', { organizationId: org.organizationId, name: 'Enhet 2' })).data;
  const o2u = (await admin.post('/org/unit/create', { organizationId: org2.organizationId, name: 'Annan enhet' })).data;
  check('admin creates units', !!u1.unitId && !!u2.unitId && !!o2u.unitId);

  const pw = 'Test-lösen-1234';
  const mk = async (name, orgId, role, unitIds = []) => {
    const r = await admin.post('/org/user/create', { organizationId: orgId, username: `${name}_${suffix}`, password: pw, role, unitIds });
    if (r.status === 200) created.users.push(r.data.userId);
    return r;
  };
  const alice = await mk('alice', org.organizationId, 'org_admin');
  const bob = await mk('bob', org.organizationId, 'member', [u1.unitId]);
  const carol = await mk('carol', org.organizationId, 'member');
  const dave = await mk('dave', org2.organizationId, 'member');
  check('org users created', [alice, bob, carol, dave].every(r => r.status === 200), JSON.stringify([alice.data, bob.data]));
  check('unit from another organization rejected -> 400', (await mk('eve', org.organizationId, 'member', [o2u.unitId])).status === 400);
  check('too short password rejected -> 400', (await admin.post('/org/user/create', { organizationId: org.organizationId, username: `short_${suffix}`, password: 'abc' })).status === 400);

  const A = await new Http().login(`alice_${suffix}`, pw);
  const B = await new Http().login(`bob_${suffix}`, pw);
  const D = await new Http().login(`dave_${suffix}`, pw);
  const C_ = await new Http().login(`carol_${suffix}`, pw);
  const anon = new Http();

  check('unauthenticated -> 403', (await anon.get('/org/list')).status === 403);

  // plain member
  check('member cannot create unit', (await B.post('/org/unit/create', { organizationId: org.organizationId, name: 'x' })).status === 403);
  check('member cannot read org details', (await B.get(`/org/${org.organizationId}`)).status === 403);
  check('member cannot promote anyone', (await B.post('/org/member/set', { organizationId: org.organizationId, userId: carol.data.userId, role: 'org_admin' })).status === 403);
  const bobList = (await B.get('/org/list')).data;
  check('member only sees own organization', bobList.length === 1 && bobList[0].organizationId === org.organizationId && bobList[0].myRole === 'member', JSON.stringify(bobList));
  check('member cannot create organization', (await B.post('/org/create', { name: `x${suffix}` })).status === 403);

  // org admin: own org yes, other org no
  check('org_admin creates unit in own org', (await A.post('/org/unit/create', { organizationId: org.organizationId, name: 'Enhet 3' })).status === 200);
  check('org_admin reads own org', (await A.get(`/org/${org.organizationId}`)).status === 200);
  check('org_admin cannot read other org', (await A.get(`/org/${org2.organizationId}`)).status === 403);
  check('org_admin cannot create unit in other org', (await A.post('/org/unit/create', { organizationId: org2.organizationId, name: 'x' })).status === 403);
  check('org_admin cannot create organizations', (await A.post('/org/create', { name: `y${suffix}` })).status === 403);
  check('org_admin cannot delete organizations', (await A.post('/org/delete', { organizationId: org.organizationId })).status === 403);
  check('org_admin cannot make users in other org', (await A.post('/org/user/create', { organizationId: org2.organizationId, username: `z_${suffix}`, password: pw })).status === 403);
  check('org_admin lists only own org', (await A.get('/org/list')).data.length === 1);
  check('other organization member sees only theirs', (await D.get('/org/list')).data.every(o => o.organizationId === org2.organizationId));

  // unit membership
  check('unit member added by org_admin', (await A.post('/org/unit/member/set', { unitId: u2.unitId, userId: carol.data.userId })).status === 200);
  check('user from another organization cannot join unit -> 400', (await A.post('/org/unit/member/set', { unitId: u1.unitId, userId: dave.data.userId })).status === 400);
  check('plain unit member cannot manage unit', (await B.post('/org/unit/member/set', { unitId: u1.unitId, userId: carol.data.userId })).status === 403);
  await A.post('/org/unit/member/set', { unitId: u1.unitId, userId: bob.data.userId, role: 'unit_admin' });
  check('unit_admin manages own unit', (await B.post('/org/unit/member/set', { unitId: u1.unitId, userId: carol.data.userId })).status === 200);
  check('unit_admin cannot manage other unit', (await B.post('/org/unit/member/set', { unitId: u2.unitId, userId: bob.data.userId })).status === 403);
  check('unit_admin cannot manage organization', (await B.post('/org/unit/create', { organizationId: org.organizationId, name: 'x' })).status === 403);
  const adminUserId = (await db.query('select "userId" from "Users" where username=$1', ['överchefen'])).rows[0].userId;
  check('platform admins cannot be members', (await admin.post('/org/member/set', { organizationId: org.organizationId, userId: adminUserId })).status === 400);

  // resources
  const mkSpace = async (owner, orgId = null, unitId = null, visibility = 'private') =>
    (await db.query(`insert into "VrSpaces" (name, "ownerUserId", visibility, "organizationId", "unitId") values ($1,$2,$3,$4,$5) returning "vrSpaceId"`, [`space ${suffix} ${randomUUID().slice(0, 4)}`, owner, visibility, orgId, unitId])).rows[0].vrSpaceId;
  const personal = await mkSpace(bob.data.userId);
  const daveSpace = await mkSpace(dave.data.userId);
  check('member of another organization cannot move own resource into this org', (await D.post('/org/resource/assign', { type: 'vrSpace', id: daveSpace, organizationId: org.organizationId })).status === 403);
  check('member cannot move own resource into a unit they do not belong to', (await B.post('/org/resource/assign', { type: 'vrSpace', id: personal, organizationId: org.organizationId, unitId: u2.unitId })).status === 403);
  check("org_admin cannot take over someone else's personal resource", (await A.post('/org/resource/assign', { type: 'vrSpace', id: personal, organizationId: org.organizationId })).status === 403);
  check('member can move own resource into own unit', (await B.post('/org/resource/assign', { type: 'vrSpace', id: personal, organizationId: org.organizationId, unitId: u1.unitId })).status === 200);
  check('member cannot move resource back out or elsewhere', (await B.post('/org/resource/assign', { type: 'vrSpace', id: personal, organizationId: null })).status === 403);
  check('org_admin can re-file an organization resource to another unit', (await A.post('/org/resource/assign', { type: 'vrSpace', id: personal, organizationId: org.organizationId, unitId: u2.unitId })).status === 200);
  check('plain member cannot re-file an organization resource', (await C_.post('/org/resource/assign', { type: 'vrSpace', id: personal, organizationId: org.organizationId, unitId: u1.unitId })).status === 403);
  check('unit must belong to the organization', (await admin.post('/org/resource/assign', { type: 'vrSpace', id: personal, organizationId: org.organizationId, unitId: o2u.unitId })).status === 400);
  check('platform admin assigns resource to unit', (await admin.post('/org/resource/assign', { type: 'vrSpace', id: personal, organizationId: org.organizationId, unitId: u1.unitId })).status === 200);
  check('org_admin cannot move resource out to another org', (await A.post('/org/resource/assign', { type: 'vrSpace', id: personal, organizationId: org2.organizationId })).status === 403);
  check('deleting organization with resources is refused -> 409', (await admin.post('/org/delete', { organizationId: org.organizationId })).status === 409);

  // picker data: what each person may move things into
  const bobPick = (await B.get('/org/assignable')).data;
  check('assignable: member gets own organization with only own units', bobPick.length === 1 && bobPick[0].units.length === 1 && bobPick[0].units[0].unitId === u1.unitId, JSON.stringify(bobPick));
  const alicePick = (await A.get('/org/assignable')).data;
  check('assignable: org_admin gets all units of own organization', alicePick.length === 1 && alicePick[0].units.length >= 3, JSON.stringify(alicePick));
  const davePick = (await D.get('/org/assignable')).data;
  check('assignable: other organization member never sees this organization', davePick.every(o => o.organizationId === org2.organizationId));
  check('assignable: platform admin sees every organization', (await admin.get('/org/assignable')).data.some(o => o.organizationId === org.organizationId));

  // database-level guarantees
  const dbFails = async (sql, params) => { try { await db.query(sql, params); return false; } catch (e) { return e.code; } };
  check('DB: unit without organization on a resource is rejected', (await dbFails(`insert into "VrSpaces" (name,"ownerUserId","unitId") values ('x',$1,$2)`, [bob.data.userId, u1.unitId])) === '23514');
  check('DB: unit of another organization on a resource is rejected', (await dbFails(`insert into "VrSpaces" (name,"ownerUserId","organizationId","unitId") values ('x',$1,$2,$3)`, [bob.data.userId, org.organizationId, o2u.unitId])) === '23503');
  check('DB: unit member who is not an organization member is rejected', (await dbFails(`insert into "UnitMembers" ("userId","unitId","organizationId") values ($1,$2,$3)`, [dave.data.userId, u1.unitId, org.organizationId])) === '23503');

  // removing a member removes their unit memberships
  await A.post('/org/member/remove', { organizationId: org.organizationId, userId: bob.data.userId });
  const left = (await db.query('select count(*)::int c from "UnitMembers" where "userId"=$1', [bob.data.userId])).rows[0].c;
  check('removing an organization member cascades to unit memberships', left === 0, String(left));
} finally {
  // cleanup (resources first because organization deletion is restricted while they exist)
  try {
    await db.query(`delete from "VrSpaces" where name like $1`, [`space ${suffix}%`]);
    if (created.users.length) await db.query(`delete from "Users" where "userId" = any($1)`, [created.users]);
    if (created.orgs.length) await db.query(`delete from "Organizations" where "organizationId" = any($1)`, [created.orgs]);
  } catch (e) { console.log('cleanup problem:', e.message); }
  await db.end();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
