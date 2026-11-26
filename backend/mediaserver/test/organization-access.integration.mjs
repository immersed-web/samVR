// Integration test: organization/unit access through the real mediaserver API (WebSocket + tRPC).
// Runs against a RUNNING dev stack (auth :3333, mediaserver :9001, database). Creates and removes its own data.
//   cd backend/mediaserver && DATABASE_USER=samvr npx dotenv-cli -e ../../.env -- node test/organization-access.integration.mjs
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
async function login(username, password) {
  const r = await http('POST', '/user/login', { username, password });
  if (r.status !== 200) throw Error(`login ${username}: ${r.status}`);
  const jwt = await http('GET', '/user/jwt', undefined, r.cookie);
  return { cookie: r.cookie, token: jwt.data };
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
const forbidden = async promise => { try { await promise; return false; } catch (e) { return e.code === 'FORBIDDEN' || e.code === 'UNAUTHORIZED'; } };

const db = new Client({ host: 'localhost', user: process.env.DATABASE_USER ?? 'postgres', password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME });
await db.connect();
const created = { orgs: [], users: [] };
try {
  const adminLogin = await login('överchefen', process.env.ADMIN_PASSWORD);
  const org = (await http('POST', '/org/create', { name: `AccessOrg ${suffix}` }, adminLogin.cookie)).data;
  created.orgs.push(org.organizationId);
  const u1 = (await http('POST', '/org/unit/create', { organizationId: org.organizationId, name: 'U1' }, adminLogin.cookie)).data;
  const u2 = (await http('POST', '/org/unit/create', { organizationId: org.organizationId, name: 'U2' }, adminLogin.cookie)).data;
  const pw = 'Access-test-1234';
  const mk = async (name, role, unitIds = [], withOrg = true) => {
    if (withOrg) {
      const r = await http('POST', '/org/user/create', { organizationId: org.organizationId, username: `${name}_${suffix}`, password: pw, role, unitIds }, adminLogin.cookie);
      created.users.push(r.data.userId); return r.data.userId;
    }
    const bcrypt = require('bcrypt');
    const r = await db.query('insert into "Users" (username,password,role) values ($1,$2,$3) returning "userId"', [`${name}_${suffix}`, await bcrypt.hash(pw, 4), 'user']);
    created.users.push(r.rows[0].userId); return r.rows[0].userId;
  };
  const ids = {
    alice: await mk('alice', 'org_admin'),
    bob: await mk('bob', 'member', [u1.unitId]),
    carol: await mk('carol', 'member', [u2.unitId]),
    erin: await mk('erin', 'member', [u1.unitId]),
    dave: await mk('dave', 'member', [], false),
  };
  const who = {};
  for (const name of Object.keys(ids)) { const l = await login(`${name}_${suffix}`, pw); who[name] = await connect(l.token); }
  who.admin = await connect(adminLogin.token);

  const mkSpace = async (name, owner, orgId, unitId, visibility) =>
    (await db.query(`insert into "VrSpaces" (name,"ownerUserId","organizationId","unitId",visibility) values ($1,$2,$3,$4,$5) returning "vrSpaceId"`,
      [`${name} ${suffix}`, owner, orgId, unitId, visibility])).rows[0].vrSpaceId;
  const S = {
    unit1: await mkSpace('S_unit1', ids.erin, org.organizationId, u1.unitId, 'unit'),
    org: await mkSpace('S_org', ids.erin, org.organizationId, null, 'organization'),
    private1: await mkSpace('S_private', ids.erin, org.organizationId, u1.unitId, 'private'),
    personal: await mkSpace('S_personal', ids.dave, null, null, 'private'),
    orgPublic: await mkSpace('S_public', ids.erin, org.organizationId, null, 'public'),
  };
  const list = async user => (await who[user].call('query', 'vr.listAvailableVrSpaces')).filter(s => Object.values(S).includes(s.vrSpaceId));
  const seen = async user => new Set((await list(user)).map(s => s.vrSpaceId));
  const has = (set, ...keys) => keys.every(k => set.has(S[k]));
  const lacks = (set, ...keys) => keys.every(k => !set.has(S[k]));

  // ---- listing ----
  const bob = await seen('bob');
  check('unit member sees unit + organization + public spaces', has(bob, 'unit1', 'org', 'orgPublic'));
  check('unit member does not see private space or others\' personal space', lacks(bob, 'private1', 'personal'));
  const carol = await seen('carol');
  check('member of another unit sees organization space but NOT the other unit\'s space', has(carol, 'org') && lacks(carol, 'unit1', 'private1', 'personal'));
  const dave = await seen('dave');
  check('outsider sees only own personal (not other people public spaces)', has(dave, 'personal') && lacks(dave, 'unit1', 'org', 'private1', 'orgPublic'));
  const alice = await seen('alice');
  check('org_admin sees everything in the organization, not other people\'s personal', has(alice, 'unit1', 'org', 'private1', 'orgPublic') && lacks(alice, 'personal'));
  const erin = await seen('erin');
  check('owner sees own spaces in organization', has(erin, 'unit1', 'org', 'private1'));
  const admin = await seen('admin');
  check('platform admin sees all', has(admin, 'unit1', 'org', 'private1', 'personal', 'orgPublic'));
  const lvl = async (user, key) => (await list(user)).find(s => s.vrSpaceId === S[key])?.permissionLevel;
  check('permissionLevel: org_admin=admin, owner=owner, member=null', await lvl('alice', 'private1') === 'admin' && await lvl('erin', 'private1') === 'owner' && !(await lvl('bob', 'unit1')), `${await lvl('alice', 'private1')} ${await lvl('erin', 'private1')} ${await lvl('bob', 'unit1')}`);

  // ---- writes ----
  const rename = (user, key) => who[user].call('mutation', 'vr.updateVrSpace', { vrSpaceId: S[key], name: `renamed ${suffix}` });
  check('org_admin can edit a private space in the organization', !(await forbidden(rename('alice', 'private1'))));
  check('owner can edit own space while still a member', !(await forbidden(rename('erin', 'unit1'))));
  check('plain unit member cannot edit', await forbidden(rename('bob', 'unit1')));
  check('member of another unit cannot edit', await forbidden(rename('carol', 'unit1')));
  check('outsider cannot edit organization space', await forbidden(rename('dave', 'org')));
  check('org member cannot edit someone else\'s personal space', await forbidden(rename('bob', 'personal')));
  check('org_admin cannot edit someone else\'s personal space', await forbidden(rename('alice', 'personal')));
  check('plain member cannot delete a space', await forbidden(who.bob.call('mutation', 'vr.deleteVrSpace', { vrSpaceId: S.unit1 })));
  check('clients cannot move a space to another organization via update',
    await (async () => { try { await who.erin.call('mutation', 'vr.updateVrSpace', { vrSpaceId: S.org, organizationId: randomUUID() }); } catch { /* rejected is fine */ }
      return (await db.query('select "organizationId" from "VrSpaces" where "vrSpaceId"=$1', [S.org])).rows[0].organizationId === org.organizationId; })());

  // ---- leaving the organization ----
  await http('POST', '/org/member/remove', { organizationId: org.organizationId, userId: ids.erin }, adminLogin.cookie);
  check('owner who left the organization loses access to its spaces', await forbidden(rename('erin', 'unit1')));
  const erinAfter = await seen('erin');
  check('...and no longer sees them (except public)', lacks(erinAfter, 'unit1', 'org', 'private1'));
  check('org_admin still administers spaces whose owner left', !(await forbidden(rename('alice', 'unit1'))));
} finally {
  for (const s of sockets) try { s.close(); } catch { /* ignore */ }
  try {
    await db.query(`delete from "VrSpaces" where name like $1`, [`% ${suffix}`]);
    await db.query(`delete from "VrSpaces" where name like $1`, [`renamed ${suffix}`]);
    if (created.users.length) await db.query(`delete from "Users" where "userId" = any($1)`, [created.users]);
    if (created.orgs.length) await db.query(`delete from "Organizations" where "organizationId" = any($1)`, [created.orgs]);
  } catch (e) { console.log('cleanup problem:', e.message); }
  await db.end();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
