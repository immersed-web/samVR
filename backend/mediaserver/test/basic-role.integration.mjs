// Integration test: the lowest organization role "Användare" (basic) may visit but not create VR spaces.
// Runs against a RUNNING dev stack (auth :3333, mediaserver :9001, database). Creates and removes its own data.
//   cd backend/mediaserver && DATABASE_USER=samvr npx dotenv-cli -e ../../.env -- node test/basic-role.integration.mjs
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { parse as parseEvent } from '../node_modules/devalue/index.js';
const require = createRequire(new URL('../../database/package.json', import.meta.url));
const { Client } = require('pg');

const AUTH = process.env.AUTH_URL ?? 'http://localhost:3333';
const MEDIA = process.env.MEDIA_URL ?? 'ws://localhost:9001';
const suffix = randomUUID().slice(0, 8);
let failed = 0, passed = 0;
const check = (name, ok, extra = '') => { ok ? passed++ : failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + extra}`); };

async function http(method, path, body, cookie = '') {
  const res = await fetch(AUTH + path, { method, headers: { 'content-type': 'application/json', cookie, origin: 'http://localhost:5173' }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, cookie: res.headers.getSetCookie?.().map(c => c.split(';')[0]).join('; ') };
}
const sockets = [];
async function connect(token) {
  const socket = new WebSocket(`${MEDIA}?token=${encodeURIComponent(token)}`);
  const pending = new Map(); let id = 0;
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (Array.isArray(message)) { parseEvent(data); return; }
    const p = pending.get(message.id); if (!p) return; pending.delete(message.id);
    if (message.error) p.reject(Object.assign(Error(message.error.json.message), { code: message.error.json.data.code }));
    else p.resolve(message.result.data?.json);
  });
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  sockets.push(socket);
  return { call: (method, path, input) => new Promise((resolve, reject) => { const requestId = ++id; pending.set(requestId, { resolve, reject }); socket.send(JSON.stringify({ id: requestId, method, params: { path, input: { json: input ?? null } } })); }) };
}
const create = (client, name) => client.call('mutation', 'vr.createVrSpace', { name: `${name} ${suffix}` }).then(id => ({ id }), e => ({ error: e }));

const db = new Client({ host: 'localhost', user: process.env.DATABASE_USER ?? 'postgres', password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME });
await db.connect();
const orgIds = [];
const spaceIds = [];
try {
  const login = await http('POST', '/user/login', { username: 'överchefen', password: process.env.ADMIN_PASSWORD });
  const cookie = login.cookie;
  const A = (await http('POST', '/org/create', { name: `Elev-A ${suffix}`, type: 'municipality' }, cookie)).data;
  const B = (await http('POST', '/org/create', { name: `Elev-B ${suffix}`, type: 'company' }, cookie)).data;
  orgIds.push(A.organizationId, B.organizationId);
  const pw = 'Elev-test-1234';
  const mk = async (name, org, role) => (await http('POST', '/org/user/create', { organizationId: org.organizationId, username: `${name}_${suffix}`, password: pw, role }, cookie));
  const stu = await mk('elev', A, 'basic');
  check('an account can be created with the Användare role', stu.status === 200 && (await db.query('select role from "OrganizationMembers" where "userId" = $1', [stu.data.userId])).rows[0]?.role === 'basic');
  const mem = await mk('medlem', A, 'member');
  const both = await mk('bada', A, 'basic');
  await http('POST', '/org/member/set', { organizationId: B.organizationId, userId: both.data.userId, role: 'member' }, cookie);
  const adm = await mk('admin', A, 'org_admin');
  const tokenFor = async name => { const r = await http('POST', '/user/login', { username: `${name}_${suffix}`, password: pw }); return (await http('GET', '/user/jwt', undefined, r.cookie)).data; };
  const sc = await connect(await tokenFor('elev'));
  const mc = await connect(await tokenFor('medlem'));
  const bc = await connect(await tokenFor('bada'));
  const ac = await connect(await tokenFor('admin'));

  const s1 = await create(sc, 'elev');
  check('a basic user cannot create a VR space', s1.error?.code === 'FORBIDDEN', JSON.stringify(s1));
  check('...and nothing was created', (await db.query('select 1 from "VrSpaces" where name = $1', [`elev ${suffix}`])).rowCount === 0);
  const s2 = await create(mc, 'medlem');
  check('a plain member can create', !!s2.id, JSON.stringify(s2)); if (s2.id) spaceIds.push(s2.id);
  const s3 = await create(bc, 'bada');
  check('a basic user in one organization and member in another can create', !!s3.id, JSON.stringify(s3)); if (s3.id) spaceIds.push(s3.id);
  const s4 = await create(ac, 'admin');
  check('an org admin can create', !!s4.id, JSON.stringify(s4)); if (s4.id) spaceIds.push(s4.id);

  // a basic user can still see and enter the organization's spaces
  await db.query(`update "VrSpaces" set visibility = 'organization' where "vrSpaceId" = $1`, [s2.id]);
  const list = await sc.call('query', 'vr.listAvailableVrSpaces');
  check('a basic user still sees the organization\'s spaces', list.some(s => s.vrSpaceId === s2.id));
  check('a basic user can still enter the organization\'s spaces', await sc.call('mutation', 'vr.enterVrSpace', { vrSpaceId: s2.id }).then(() => true, e => e.message));

  // changing the role changes the right
  await http('POST', '/org/member/set', { organizationId: A.organizationId, userId: stu.data.userId, role: 'member' }, cookie);
  const s5 = await create(sc, 'elev-igen');
  check('after becoming a member the same person can create', !!s5.id, JSON.stringify(s5)); if (s5.id) spaceIds.push(s5.id);
  await http('POST', '/org/member/set', { organizationId: A.organizationId, userId: stu.data.userId, role: 'basic' }, cookie);
  check('and is blocked again when made a basic user', (await create(sc, 'elev-3')).error?.code === 'FORBIDDEN');

  // import
  const imp = await http('POST', '/org/user/import', { organizationId: A.organizationId, dryRun: false, rows: [
    { row: 2, username: `imp1_${suffix}`, password: 'Import-test-1234', role: 'Användare' },
    { row: 3, username: `imp2_${suffix}`, password: 'Import-test-1234', role: 'basic' },
    { row: 4, username: `imp3_${suffix}`, password: 'Import-test-1234', role: 'Lärare' },
  ] }, cookie);
  const roleOf = async n => (await db.query('select m.role from "OrganizationMembers" m join "Users" u using ("userId") where u.username = $1', [`${n}_${suffix}`])).rows[0]?.role;
  check('import understands the role Användare / basic', imp.data.created === 2 && await roleOf('imp1') === 'basic' && await roleOf('imp2') === 'basic');
  check('import still rejects unknown roles', imp.data.results.find(r => r.row === 4)?.status === 'error');

  // invitations
  const inv = await http('POST', '/onboarding/invitations/create', { organizationId: A.organizationId, organizationRole: 'basic', maxUses: 2 }, cookie);
  check('an invitation can carry the Användare role', inv.status === 200 && !!inv.data.token, JSON.stringify(inv.data));
  const accepted = await http('POST', '/onboarding/accept', { token: inv.data.token, username: `inv1_${suffix}`, password: 'Invite-test-1234' });
  check('accepting it makes the person a basic user', accepted.status === 200 && await roleOf('inv1') === 'basic', JSON.stringify(accepted.data));
  const preview = await http('GET', `/onboarding/invitation/${inv.data.token}`);
  check('the invitation preview names the role', preview.data.organizationRole === 'basic');
  // a unit admin may invite basic users (like members) but not administrators
  const unit = (await http('POST', '/org/unit/create', { organizationId: A.organizationId, name: 'Enhet E' }, cookie)).data;
  await http('POST', '/org/unit/member/set', { unitId: unit.unitId, userId: mem.data.userId, role: 'unit_admin' }, cookie);
  const ua = await http('POST', '/user/login', { username: `medlem_${suffix}`, password: pw });
  const uaInvite = role => http('POST', '/onboarding/invitations/create', { organizationId: A.organizationId, unitId: unit.unitId, organizationRole: role }, ua.cookie);
  check('a unit admin may invite basic users', (await uaInvite('basic')).status === 200);
  check('a unit admin may not invite administrators', (await uaInvite('org_admin')).status === 403);
  void adm;
} finally {
  for (const s of sockets) try { s.close(); } catch { /* ignore */ }
  try {
    await db.query('delete from "VrSpaces" where name like $1', [`% ${suffix}`]);
    await db.query('delete from "Invitations" where "organizationId" = any($1)', [orgIds]);
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
