// Integration test: departments (organization > unit > department) incl. import. Run against a RUNNING dev stack.
//   cd backend/auth && DATABASE_USER=samvr npx dotenv-cli -e ../../.env -- node test/departments.integration.mjs
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
  const A = (await admin.post('/org/create', { name: `Avd-A ${suffix}`, type: 'municipality' })).data;
  const B = (await admin.post('/org/create', { name: `Avd-B ${suffix}`, type: 'company' })).data;
  orgIds.push(A.organizationId, B.organizationId);
  const U1 = (await admin.post('/org/unit/create', { organizationId: A.organizationId, name: 'Skola Ett' })).data;
  const U2 = (await admin.post('/org/unit/create', { organizationId: A.organizationId, name: 'Skola Två' })).data;
  const UB = (await admin.post('/org/unit/create', { organizationId: B.organizationId, name: 'Fabrik' })).data;
  const pw = 'Avd-test-1234';
  const mk = async (name, org, role, unitIds = []) => (await admin.post('/org/user/create', { organizationId: org.organizationId, username: `${name}_${suffix}`, password: pw, role, unitIds })).data;
  await mk('adminA', A, 'org_admin');
  const member = await mk('member', A, 'member');
  const outsider = await mk('outsider', B, 'member');
  const unitAdminUser = await mk('unitAdmin', A, 'member', [U1.unitId]);
  await admin.post('/org/unit/member/set', { unitId: U1.unitId, userId: unitAdminUser.userId, role: 'unit_admin' });
  const adminA = await new Http().login(`adminA_${suffix}`, pw);
  const memberA = await new Http().login(`member_${suffix}`, pw);
  const unitAdmin = await new Http().login(`unitAdmin_${suffix}`, pw);
  const q = async (sql, params) => (await db.query(sql, params)).rows;

  // ---- create / delete ----
  const d7b = (await adminA.post('/org/department/create', { unitId: U1.unitId, name: 'Klass 7B' })).data;
  check('org admin creates a department', !!d7b.departmentId && d7b.unitId === U1.unitId);
  check('duplicate name in the same unit -> 409', (await adminA.post('/org/department/create', { unitId: U1.unitId, name: 'Klass 7B' })).status === 409);
  check('same name in another unit is fine', (await adminA.post('/org/department/create', { unitId: U2.unitId, name: 'Klass 7B' })).status === 200);
  check('cannot create in another organization\'s unit -> 403', (await adminA.post('/org/department/create', { unitId: UB.unitId, name: 'X' })).status === 403);
  check('plain member cannot create -> 403', (await memberA.post('/org/department/create', { unitId: U1.unitId, name: 'Y' })).status === 403);
  check('empty name -> 400', (await adminA.post('/org/department/create', { unitId: U1.unitId, name: '  ' })).status === 400);
  check('unit admin creates a department in own unit', (await unitAdmin.post('/org/department/create', { unitId: U1.unitId, name: 'Team Blå' })).status === 200);
  check('unit admin cannot create in another unit -> 403', (await unitAdmin.post('/org/department/create', { unitId: U2.unitId, name: 'Team Röd' })).status === 403);
  const details = (await adminA.get(`/org/${A.organizationId}`)).data;
  check('organization details list the departments', details.departments?.length === 3 && Array.isArray(details.departmentMembers));

  // ---- membership ----
  check('adding an org member to a department works', (await adminA.post('/org/department/member/set', { departmentId: d7b.departmentId, userId: member.userId })).status === 200);
  check('...and makes the person a member of the unit too', (await q('select 1 from "UnitMembers" where "userId" = $1 and "unitId" = $2', [member.userId, U1.unitId])).length === 1);
  check('adding twice is harmless', (await adminA.post('/org/department/member/set', { departmentId: d7b.departmentId, userId: member.userId })).status === 200);
  check('someone outside the organization is refused -> 400', (await adminA.post('/org/department/member/set', { departmentId: d7b.departmentId, userId: outsider.userId })).status === 400);
  check('plain member cannot add people -> 403', (await memberA.post('/org/department/member/set', { departmentId: d7b.departmentId, userId: member.userId })).status === 403);
  check('removing from the unit also removes the department membership',
    (await adminA.post('/org/unit/member/remove', { unitId: U1.unitId, userId: member.userId })).status === 200
    && (await q('select 1 from "DepartmentMembers" where "userId" = $1', [member.userId])).length === 0);
  await adminA.post('/org/department/member/set', { departmentId: d7b.departmentId, userId: member.userId });
  check('removing a person from a department works', (await adminA.post('/org/department/member/remove', { departmentId: d7b.departmentId, userId: member.userId })).status === 200
    && (await q('select 1 from "DepartmentMembers" where "userId" = $1', [member.userId])).length === 0);

  // ---- create user with departments ----
  const created = await adminA.post('/org/user/create', { organizationId: A.organizationId, username: `pupil_${suffix}`, password: pw, role: 'member', departmentIds: [d7b.departmentId] });
  check('creating a user with a department puts them in the department and its unit', created.status === 200
    && (await q('select 1 from "DepartmentMembers" where "userId" = $1 and "departmentId" = $2', [created.data.userId, d7b.departmentId])).length === 1
    && (await q('select 1 from "UnitMembers" where "userId" = $1 and "unitId" = $2', [created.data.userId, U1.unitId])).length === 1);
  const foreign = (await adminB().post('/org/department/create', { unitId: UB.unitId, name: 'Linje 1' })).data;
  function adminB() { return admin; }
  check('a department of another organization is refused -> 400', (await adminA.post('/org/user/create', { organizationId: A.organizationId, username: `bad_${suffix}`, password: pw, role: 'member', departmentIds: [foreign.departmentId] })).status === 400);

  // ---- import ----
  const imp = (rows, extra = {}) => adminA.post('/org/user/import', { organizationId: A.organizationId, rows, ...extra });
  const row = (n, username, units, departments, role = '') => ({ row: n, username: `${username}_${suffix}`, password: 'Import-test-1234', role, units, departments });
  const dry = await imp([
    row(2, 'i1', 'Skola Ett', 'Klass 7B'),
    row(3, 'i2', 'Skola Ett', 'Finns inte'),
    row(4, 'i3', '', 'Klass 7B'),
    row(5, 'i4', 'Skola Ett; Skola Två', 'Klass 7B'),
    row(6, 'i5', 'skola ett', 'klass 7b'),
    row(7, 'i6', 'Skola Ett', 'Klass 7B; Team Blå'),
  ], { dryRun: true });
  const st = Object.fromEntries(dry.data.results.map(r => [r.row, r]));
  check('import: existing unit + department is ok', st[2].status === 'ok');
  check('import: unknown department is an error without createMissing', st[3].status === 'error' && /finns inte/.test(st[3].message));
  check('import: department without unit is an error', st[4].status === 'error');
  check('import: department present in several listed units is ambiguous', st[5].status === 'error' && /flera/.test(st[5].message));
  check('import: names match case-insensitively', st[6].status === 'ok');
  check('import: several departments in one unit are fine', st[7].status === 'ok');

  const dryCreate = await imp([row(2, 'n1', 'Nya Skolan', 'Klass 1A'), row(3, 'n2', 'Skola Ett', 'Klass 9C'), row(4, 'n3', 'Nya Skolan', 'Klass 1A')], { dryRun: true, createMissing: true });
  check('createMissing dry run says what would be created', dryCreate.data.results[0].status === 'ok' && /Nya Skolan/.test(dryCreate.data.results[0].message) && /Klass 9C/.test(dryCreate.data.results[1].message));
  check('createMissing dry run creates nothing', (await q('select 1 from "Units" where name = $1 and "organizationId" = $2', ['Nya Skolan', A.organizationId])).length === 0);
  check('createMissing: second row reuses what the first row creates', dryCreate.data.results[2].status === 'ok' && !/Skapar/.test(dryCreate.data.results[2].message ?? ''));
  const real = await imp([row(2, 'n1', 'Nya Skolan', 'Klass 1A'), row(3, 'n2', 'Skola Ett', 'Klass 9C'), row(4, 'n3', 'Nya Skolan', 'Klass 1A'), row(5, 'bad', 'Skola Ett', 'Finns inte i Ett')], { createMissing: true });
  check('createMissing import creates the users', real.status === 200 && real.data.created === 4 || real.data.created === 3, JSON.stringify(real.data));
  const newUnitRows = await q('select "unitId" from "Units" where name = $1 and "organizationId" = $2', ['Nya Skolan', A.organizationId]);
  check('createMissing creates the unit exactly once', newUnitRows.length === 1);
  const inClass = await q('select u.username from "DepartmentMembers" m join "Users" u using ("userId") join "Departments" d using ("departmentId") where d.name = $1 and d."unitId" = $2 order by 1', ['Klass 1A', newUnitRows[0]?.unitId]);
  check('both users are in the new department', inClass.length === 2, JSON.stringify(inClass));
  check('they are members of the new unit as well', (await q('select 1 from "UnitMembers" where "unitId" = $1', [newUnitRows[0]?.unitId])).length === 2);
  check('plain member cannot import -> 403', (await memberA.post('/org/user/import', { organizationId: A.organizationId, rows: [row(2, 'zz', '', '')], dryRun: true })).status === 403);

  // ---- cascades ----
  check('deleting a department removes its memberships', (await adminA.post('/org/department/delete', { departmentId: d7b.departmentId })).status === 200
    && (await q('select 1 from "DepartmentMembers" where "departmentId" = $1', [d7b.departmentId])).length === 0);
  check('deleting a unit removes its departments', (await adminA.post('/org/unit/delete', { unitId: U2.unitId })).status === 200
    && (await q('select 1 from "Departments" where "unitId" = $1', [U2.unitId])).length === 0);
  check('plain member cannot delete a department -> 403', (await memberA.post('/org/department/delete', { departmentId: foreign.departmentId })).status === 403);
  check('org admin of A cannot delete B\'s department -> 403', (await adminA.post('/org/department/delete', { departmentId: foreign.departmentId })).status === 403);
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
