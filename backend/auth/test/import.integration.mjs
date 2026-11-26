// Integration test for POST /org/user/import, run against a RUNNING dev stack (auth on :3333, database).
//   cd backend/auth && DATABASE_USER=samvr npx dotenv-cli -e ../../.env -- node test/import.integration.mjs
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
const orgs = [];
const usernames = [];
try {
  const admin = await new Http().login('överchefen', process.env.ADMIN_PASSWORD);
  const org = (await admin.post('/org/create', { name: `Importkommun ${suffix}`, type: 'municipality' })).data;
  const other = (await admin.post('/org/create', { name: `Annan ${suffix}`, type: 'company' })).data;
  orgs.push(org.organizationId, other.organizationId);
  const skolaA = (await admin.post('/org/unit/create', { organizationId: org.organizationId, name: 'Skola A' })).data;
  await admin.post('/org/unit/create', { organizationId: other.organizationId, name: 'Främmande' });

  const n = (s) => `${s}_${suffix}`;
  const rows = [
    { row: 2, username: n('anna'), password: 'Lösenord-1234', role: 'Medlem', units: 'Skola A' },
    { row: 3, username: n('bertil'), password: 'Lösenord-1234', role: 'Administratör', units: '' },
    { row: 4, username: n('cia'), password: 'kort', role: 'Medlem', units: '' },
    { row: 5, username: n('anna'), password: 'Lösenord-1234', role: '', units: '' },
    { row: 6, username: n('dag'), password: 'Lösenord-1234', role: 'Chef', units: '' },
    { row: 7, username: n('eva'), password: 'Lösenord-1234', role: '', units: 'skola a; Finns inte' },
    { row: 8, username: n('fia'), password: 'Lösenord-1234', role: '', units: 'Främmande' },
    { row: 9, username: n('gun'), password: 'Lösenord-1234', role: '', units: 'skola a' },
    { row: 10, username: 'x', password: 'Lösenord-1234', role: '', units: '' },
  ];
  for (const r of rows) usernames.push(r.username);

  const dry = await admin.post('/org/user/import', { organizationId: org.organizationId, dryRun: true, rows });
  const st = Object.fromEntries((dry.data.results ?? []).map(r => [r.row, r.status]));
  check('dry run ok', dry.status === 200 && dry.data.created === 0, JSON.stringify(dry.data));
  check('valid rows ok (2,3,9)', st[2] === 'ok' && st[3] === 'ok' && st[9] === 'ok', JSON.stringify(st));
  check('short password rejected', st[4] === 'error');
  check('duplicate in file rejected', st[5] === 'error');
  check('unknown role rejected', st[6] === 'error');
  check('unknown unit rejected', st[7] === 'error');
  check('unit of another organization rejected', st[8] === 'error');
  check('short username rejected', st[10] === 'error');
  const { rows: before } = await db.query('select count(*)::int c from "Users" where username = any($1)', [usernames]);
  check('dry run creates nothing', before[0].c === 0);

  const real = await admin.post('/org/user/import', { organizationId: org.organizationId, dryRun: false, rows });
  check('import creates 3 users', real.status === 200 && real.data.created === 3, JSON.stringify(real.data));
  const { rows: members } = await db.query(
    `select u.username, m.role, (select count(*)::int from "UnitMembers" um where um."userId" = u."userId" and um."unitId" = $2) as in_unit
     from "Users" u join "OrganizationMembers" m on m."userId" = u."userId" where m."organizationId" = $1 order by u.username`, [org.organizationId, skolaA.unitId]).catch(e => ({ rows: [{ error: String(e) }] }));
  console.log('  members:', JSON.stringify(members));
  const byName = Object.fromEntries(members.map(m => [m.username, m]));
  check('anna is member in Skola A', byName[n('anna')]?.role === 'member' && byName[n('anna')]?.in_unit === 1);
  check('bertil is org_admin', byName[n('bertil')]?.role === 'org_admin');

  const login = await new Http().post('/user/login', { username: n('anna'), password: 'Lösenord-1234' });
  check('imported user can log in', login.status === 200);

  const again = await admin.post('/org/user/import', { organizationId: org.organizationId, dryRun: true, rows: [rows[0]] });
  check('re-import reports existing user', again.data.results?.[0]?.status === 'error');

  // permissions
  const bertil = await new Http().login(n('bertil'), 'Lösenord-1234');
  const ok = await bertil.post('/org/user/import', { organizationId: org.organizationId, dryRun: true, rows: [{ row: 2, username: n('zed'), password: 'Lösenord-1234' }] });
  check('org admin may import into own org', ok.status === 200 && ok.data.results[0].status === 'ok');
  check('org admin may not import into other org', (await bertil.post('/org/user/import', { organizationId: other.organizationId, dryRun: true, rows: [{ row: 2, username: n('zed'), password: 'Lösenord-1234' }] })).status === 403);
  const anna = await new Http().login(n('anna'), 'Lösenord-1234');
  check('plain member may not import', (await anna.post('/org/user/import', { organizationId: org.organizationId, dryRun: true, rows: [{ row: 2, username: n('zed'), password: 'Lösenord-1234' }] })).status === 403);
  check('anonymous may not import', (await new Http().post('/org/user/import', { organizationId: org.organizationId, dryRun: true, rows: [{ row: 2, username: 'q', password: 'x' }] })).status === 403);
  check('empty rows -> 400', (await admin.post('/org/user/import', { organizationId: org.organizationId, rows: [] })).status === 400);
  const many = Array.from({ length: 501 }, (_, i) => ({ row: i + 2, username: `m${i}`, password: 'Lösenord-1234' }));
  check('over 500 rows -> 400', (await admin.post('/org/user/import', { organizationId: org.organizationId, rows: many })).status === 400);
} finally {
  try {
    await db.query('delete from "UnitMembers" where "organizationId" = any($1)', [orgs]);
    await db.query('delete from "OrganizationMembers" where "organizationId" = any($1)', [orgs]);
    await db.query('delete from "Users" where username like $1', [`%\\_${suffix}`]);
    await db.query('delete from "Units" where "organizationId" = any($1)', [orgs]);
    await db.query('delete from "Organizations" where "organizationId" = any($1)', [orgs]);
  } catch (e) { console.log('cleanup problem:', e.message); }
  await db.end();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
