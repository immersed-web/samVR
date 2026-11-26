// Integration test: public guest gallery + one-space guest tokens.
// Runs against a RUNNING dev stack (auth :3333, mediaserver :9001, database). Creates and removes its own data.
//   cd backend/mediaserver && DATABASE_USER=samvr npx dotenv-cli -e ../../.env -- node test/gallery.integration.mjs
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
const forbidden = async promise => { try { await promise; return false; } catch (e) { return e.code === 'FORBIDDEN' || e.code === 'UNAUTHORIZED'; } };
const decode = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

const db = new Client({ host: 'localhost', user: process.env.DATABASE_USER ?? 'postgres', password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME });
await db.connect();
const orgIds = [];
const spaceIds = [];
const usersCreated = [];
try {
  const login = await http('POST', '/user/login', { username: 'överchefen', password: process.env.ADMIN_PASSWORD });
  const adminCookie = login.cookie;
  const { rows: [{ userId: adminId }] } = await db.query('select "userId" from "Users" where username = $1', ['överchefen']);

  const org = (await http('POST', '/org/create', { name: `Galleri-kommun ${suffix}`, type: 'municipality' }, adminCookie)).data;
  const emptyOrg = (await http('POST', '/org/create', { name: `Tom-org ${suffix}`, type: 'company' }, adminCookie)).data;
  orgIds.push(org.organizationId, emptyOrg.organizationId);

  const space = async (name, { visibility = 'public', listed = false, organizationId = null } = {}) => {
    const { rows: [r] } = await db.query(
      'insert into "VrSpaces" (name, "ownerUserId", visibility, "listedInGallery", "organizationId") values ($1,$2,$3,$4,$5) returning "vrSpaceId"',
      [`${name} ${suffix}`, adminId, visibility, listed, organizationId]);
    spaceIds.push(r.vrSpaceId); return r.vrSpaceId;
  };
  const orgListed = await space('Org-listad', { listed: true, organizationId: org.organizationId });
  const orgHidden = await space('Org-dold', { listed: false, organizationId: org.organizationId });
  const orgPrivate = await space('Org-listad-men-privat', { listed: true, visibility: 'private', organizationId: org.organizationId });
  const orgOrgOnly = await space('Org-listad-men-organisation', { listed: true, visibility: 'organization', organizationId: org.organizationId });
  const personalListed = await space('Privat-listad', { listed: true });
  const personalUnlisted = await space('Privat-olistad-i-galleri', { listed: false });
  const personalPrivate = await space('Privat-listad-men-privat', { listed: true, visibility: 'private' });

  // ---- public listings (no login) ----
  const orgs = await http('GET', '/gallery/organizations');
  const tile = orgs.data.find?.(o => o.organizationId === org.organizationId);
  check('organization tiles are public', orgs.status === 200 && Array.isArray(orgs.data));
  check('org with a listed space has a tile', !!tile);
  check('tile counts only guest-visible listed spaces', tile?.spaceCount === 1, JSON.stringify(tile));
  const muni = await http('GET', '/gallery/organizations?kind=municipality');
  const comp = await http('GET', '/gallery/organizations?kind=company');
  check('kind=municipality lists the municipality', muni.data.some(o => o.organizationId === org.organizationId));
  check('kind=company does not list the municipality', !comp.data.some(o => o.organizationId === org.organizationId));
  check('unknown kind -> 400', (await http('GET', '/gallery/organizations?kind=x')).status === 400);
  check('org without listed spaces has no tile', !orgs.data.some(o => o.organizationId === emptyOrg.organizationId));

  const orgPage = await http('GET', `/gallery/organizations/${org.organizationId}`);
  const orgSpaceIds = orgPage.data.spaces?.map(s => s.vrSpaceId) ?? [];
  check('org page lists exactly the listed public space', orgSpaceIds.length === 1 && orgSpaceIds[0] === orgListed, JSON.stringify(orgSpaceIds));
  check('org page exposes only id/name/description', Object.keys(orgPage.data.spaces?.[0] ?? {}).sort().join() === 'description,name,vrSpaceId');
  check('unknown organization -> 404', (await http('GET', `/gallery/organizations/${randomUUID()}`)).status === 404);
  check('bad organization id -> 400', (await http('GET', '/gallery/organizations/not-a-uuid')).status === 400);

  const personal = await http('GET', '/gallery/personal?limit=48');
  const personalIds = personal.data.spaces?.map(s => s.vrSpaceId) ?? [];
  check('personal list has the listed personal space', personalIds.includes(personalListed));
  check('personal list hides non-opted-in space', !personalIds.includes(personalUnlisted));
  check('personal list hides private space even if opted in', !personalIds.includes(personalPrivate));
  check('personal list has no organization spaces', !personalIds.includes(orgListed));
  // pagination
  const p1 = await http('GET', '/gallery/personal?limit=1&offset=0');
  check('personal list paginates (limit 1)', p1.data.spaces?.length === 1);
  check('personal list rejects huge limit', (await http('GET', '/gallery/personal?limit=5000')).status === 400);

  // ---- entering as guest ----
  const enter = await http('POST', '/gallery/enter', { vrSpaceId: orgListed, username: 'Besökare' });
  check('enter returns a token for a gallery space', enter.status === 200 && typeof enter.data === 'string' && enter.data.split('.').length === 3, JSON.stringify(enter.data));
  const claims = decode(enter.data);
  check('token is a guest token limited to that space', claims.role === 'guest' && claims.guestVrSpaceId === orgListed && claims.username === 'Besökare');
  check('enter refuses space not in the gallery', (await http('POST', '/gallery/enter', { vrSpaceId: orgHidden })).status === 404);
  check('enter refuses private space', (await http('POST', '/gallery/enter', { vrSpaceId: orgPrivate })).status === 404);
  check('enter refuses organization-only space', (await http('POST', '/gallery/enter', { vrSpaceId: orgOrgOnly })).status === 404);
  check('enter refuses unknown id', (await http('POST', '/gallery/enter', { vrSpaceId: randomUUID() })).status === 404);
  check('enter rejects malformed body', (await http('POST', '/gallery/enter', { vrSpaceId: 'x' })).status === 400);

  // a refreshed token keeps the limit
  const refreshed = await http('GET', `/guest-jwt?prevToken=${encodeURIComponent(enter.data)}`);
  check('refreshed guest token keeps the one-space limit', decode(refreshed.data).guestVrSpaceId === orgListed);
  const plain = await http('GET', '/guest-jwt');
  check('ordinary guest token has no limit', decode(plain.data).guestVrSpaceId === undefined);

  // ---- enforcement in the media server ----
  const scoped = await connect(enter.data);
  const entered = await scoped.call('mutation', 'vr.enterVrSpace', { vrSpaceId: orgListed }).then(() => true, e => e.message);
  check('scoped guest can enter the chosen space', entered === true, String(entered));
  await scoped.call('mutation', 'vr.leaveVrSpace');
  const otherPublic = await space('Annan-publik', { listed: true });
  check('scoped guest cannot enter another public space', await forbidden(scoped.call('mutation', 'vr.enterVrSpace', { vrSpaceId: otherPublic })));
  check('scoped guest cannot enter a personal public space', await forbidden(scoped.call('mutation', 'vr.enterVrSpace', { vrSpaceId: personalListed })));
  const list = await scoped.call('query', 'vr.listAvailableVrSpaces');
  check('scoped guest only sees the one space in lists', list.length === 1 && list[0].vrSpaceId === orgListed, JSON.stringify(list.map(s => s.name)));
  const streams = await scoped.call('query', 'stream.listPublicStreams');
  check('scoped guest sees no streams', Array.isArray(streams) && streams.length === 0, JSON.stringify(streams));

  // an ordinary guest is unchanged
  const free = await connect(plain.data);
  const freeList = await free.call('query', 'vr.listAvailableVrSpaces');
  check('ordinary guest does not get other people\'s public spaces in the list', !freeList.some(s => s.vrSpaceId === personalListed) && !freeList.some(s => s.vrSpaceId === otherPublic));
  check('ordinary guest can still enter a public space by id/link', await free.call('mutation', 'vr.enterVrSpace', { vrSpaceId: personalListed }).then(() => true, () => false));
  const bcrypt = require('bcrypt');
  const hash = await bcrypt.hash('Galleri-test-1234', 10);
  const { rows: [plain1] } = await db.query('insert into "Users" (username, password, role) values ($1,$2,$3) returning "userId"', [`privat_${suffix}`, hash, 'user']);
  usersCreated.push(plain1.userId);
  const lg = await http('POST', '/user/login', { username: `privat_${suffix}`, password: 'Galleri-test-1234' });
  const jwt = await http('GET', '/user/jwt', undefined, lg.cookie);
  const me = await connect(jwt.data);
  const myList = await me.call('query', 'vr.listAvailableVrSpaces');
  check('logged-in private person does not see other people\'s public spaces', !myList.some(s => spaceIds.includes(s.vrSpaceId)), JSON.stringify(myList.map(s => s.name)));
  check('...but can still enter one by link', await me.call('mutation', 'vr.enterVrSpace', { vrSpaceId: personalListed }).then(() => true, () => false));

  // ---- spaces created by organization members belong to the organization ----
  const orgB = (await http('POST', '/org/create', { name: `Galleri-B ${suffix}`, type: 'company' }, adminCookie)).data;
  orgIds.push(orgB.organizationId);
  const mkUser = async (name, orgsToJoin) => {
    const first = orgsToJoin[0];
    const r = await http('POST', '/org/user/create', { organizationId: first, username: `${name}_${suffix}`, password: 'Galleri-test-1234', role: 'member' }, adminCookie);
    for (const extra of orgsToJoin.slice(1)) await http('POST', '/org/member/set', { organizationId: extra, userId: r.data.userId, role: 'member' }, adminCookie);
    const lg = await http('POST', '/user/login', { username: `${name}_${suffix}`, password: 'Galleri-test-1234' });
    const jwt = await http('GET', '/user/jwt', undefined, lg.cookie);
    return connect(jwt.data);
  };
  const createSpace = async (client, name) => {
    const id = await client.call('mutation', 'vr.createVrSpace', { name: `${name} ${suffix}` });
    spaceIds.push(id);
    const { rows: [row] } = await db.query('select "organizationId" from "VrSpaces" where "vrSpaceId" = $1', [id]);
    return row.organizationId;
  };
  const single = await mkUser('single', [org.organizationId]);
  const multi = await mkUser('multi', [org.organizationId, orgB.organizationId]);
  check('space created by a one-organization member belongs to that organization', await createSpace(single, 'fran-enkel') === org.organizationId);
  check('space created by someone in several organizations stays personal', await createSpace(multi, 'fran-flera') === null);
  check('space created by a person without organization stays personal', await createSpace(me, 'fran-privat') === null);
} finally {
  for (const s of sockets) try { s.close(); } catch { /* ignore */ }
  try {
    await db.query('delete from "VrSpaces" where "vrSpaceId" = any($1)', [spaceIds]);
    await db.query('delete from "Users" where "userId" = any($1)', [usersCreated]);
    await db.query('delete from "Users" where username like $1', [`%\_${suffix}`]);
    await db.query('delete from "Organizations" where "organizationId" = any($1)', [orgIds]);
  } catch (e) { console.log('cleanup problem:', e.message); }
  await db.end();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
