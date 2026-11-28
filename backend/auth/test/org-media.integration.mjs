// Integration test: the organization media library (list/filter/move) and organization-scoped deletion.
// Run against a RUNNING dev stack (auth :3333, fileserver :9002, database). Creates and removes its own data.
//   cd backend/auth && DATABASE_USER=samvr npx dotenv-cli -e ../../.env -- node test/org-media.integration.mjs
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require = createRequire(new URL('../../database/package.json', import.meta.url));
const { Client } = require('pg');
const AUTH = process.env.AUTH_URL ?? 'http://localhost:3333';
const FILES = process.env.FILES_URL ?? 'http://localhost:9002';
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
  async login(username, password) { const r = await this.post('/user/login', { username, password }); if (r.status !== 200) throw Error(`login ${username} failed ${r.status}`); this.username = username; return this; }
  async jwt() { return (await this.get('/user/jwt')).data; }
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
async function upload(client, name, { showInUserLibrary } = {}) {
  const form = new FormData();
  form.append('file', new Blob([PNG], { type: 'image/png' }), name);
  if (showInUserLibrary !== undefined) form.append('showInUserLibrary', String(showInUserLibrary));
  const res = await fetch(`${FILES}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${await client.jwt()}` }, body: form });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
async function remove(client, assetId) {
  const res = await fetch(`${FILES}/delete`, { method: 'DELETE', headers: { Authorization: `Bearer ${await client.jwt()}`, 'content-type': 'application/json' }, body: JSON.stringify({ assetId }) });
  return res.status;
}

const db = new Client({ host: 'localhost', user: process.env.DATABASE_USER ?? 'postgres', password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME });
await db.connect();
const orgIds = [];
const assetIds = [];
const n = s => `${s}_${suffix}`;
try {
  const god = await new Http().login('överchefen', process.env.ADMIN_PASSWORD);
  const A = (await god.post('/org/create', { name: `Media-A ${suffix}`, type: 'municipality' })).data;
  const B = (await god.post('/org/create', { name: `Media-B ${suffix}`, type: 'company' })).data;
  orgIds.push(A.organizationId, B.organizationId);
  const U1 = (await god.post('/org/unit/create', { organizationId: A.organizationId, name: 'Skola 1' })).data;
  const U2 = (await god.post('/org/unit/create', { organizationId: A.organizationId, name: 'Skola 2' })).data;
  const UB = (await god.post('/org/unit/create', { organizationId: B.organizationId, name: 'Fabrik' })).data;
  const pw = 'Media-test-1234';
  const mk = async (name, org, role, unitIds = []) => (await god.post('/org/user/create', { organizationId: org.organizationId, username: n(name), password: pw, role, unitIds })).data;
  const adminA = await mk('adminA', A, 'org_admin'); await mk('u1', A, 'member', [U1.unitId]); await mk('u2', A, 'member', [U1.unitId, U2.unitId]);
  const both = await mk('both', A, 'member'); await god.post('/org/member/set', { organizationId: B.organizationId, userId: both.userId, role: 'member' });
  await mk('adminB', B, 'org_admin'); await mk('mB', B, 'member', [UB.unitId]);
  const ua = await mk('unitadmin', A, 'member', [U1.unitId]); await god.post('/org/unit/member/set', { unitId: U1.unitId, userId: ua.userId, role: 'unit_admin' });
  const ub = await mk('unitadminB', B, 'member', [UB.unitId]); await god.post('/org/unit/member/set', { unitId: UB.unitId, userId: ub.userId, role: 'unit_admin' });
  const c = {}; for (const name of ['adminA', 'u1', 'u2', 'both', 'adminB', 'mB', 'unitadmin', 'unitadminB']) c[name] = await new Http().login(n(name), pw);
  const M = org => `/manage/org/${org.organizationId}/media`;

  // ---- uploads are attached to the uploader's organization / unit ----
  const f1 = await upload(c.u1, `bild-u1-${suffix}.png`); const f2 = await upload(c.u2, `bild-u2-${suffix}.png`);
  const f3 = await upload(c.both, `bild-both-${suffix}.png`); const f4 = await upload(c.mB, `bild-mB-${suffix}.png`);
  const hidden = await upload(c.u1, `dold-${suffix}.png`, { showInUserLibrary: false });
  for (const f of [f1, f2, f3, f4, hidden]) if (f.data.assetId) assetIds.push(f.data.assetId);
  check('uploads succeed', [f1, f2, f3, f4, hidden].every(f => f.status === 200), JSON.stringify([f1.status, f2.status, f3.status, f4.status]));
  const row = async id => (await db.query('select "organizationId", "unitId" from "Assets" where "assetId" = $1', [id])).rows[0];
  const r1 = await row(f1.data.assetId), r2 = await row(f2.data.assetId), r3 = await row(f3.data.assetId), r4 = await row(f4.data.assetId);
  check('one organization + one unit -> attached to both', r1.organizationId === A.organizationId && r1.unitId === U1.unitId);
  check('one organization, several units -> organization only', r2.organizationId === A.organizationId && r2.unitId === null);
  check('several organizations -> stays personal', r3.organizationId === null && r3.unitId === null);
  check('another organization\'s upload belongs to that organization', r4.organizationId === B.organizationId && r4.unitId === UB.unitId);

  // ---- who may look ----
  check('org admin lists own library', (await c.adminA.get(M(A))).status === 200);
  check('admin of another organization -> 403', (await c.adminB.get(M(A))).status === 403);
  check('plain member -> 403', (await c.u1.get(M(A))).status === 403);
  check('anonymous -> 403', (await new Http().get(M(A))).status === 403);
  check('platform admin may look', (await god.get(M(A))).status === 200);
  check('bad unit / type -> 400', (await c.adminA.get(`${M(A)}?unit=x`)).status === 400 && (await c.adminA.get(`${M(A)}?type=exe`)).status === 400);

  // ---- listing ----
  const list = async (qs = '') => (await c.adminA.get(`${M(A)}?${qs}`)).data;
  const names = r => r.assets.map(a => a.originalFileName);
  let r = await list();
  check('lists exactly the organization\'s library files', r.total === 2 && names(r).includes(`bild-u1-${suffix}.png`) && names(r).includes(`bild-u2-${suffix}.png`), JSON.stringify(names(r)));
  check('files meant to be hidden are not listed', !names(r).includes(`dold-${suffix}.png`));
  check('personal files and other organizations\' files are not listed', !names(r).includes(`bild-both-${suffix}.png`) && !names(r).includes(`bild-mB-${suffix}.png`));
  const first = r.assets.find(a => a.originalFileName === `bild-u1-${suffix}.png`);
  check('each file says who uploaded it', first.uploader === n('u1'));
  check('each file carries unit, size, type and url name', first.unitName === 'Skola 1' && first.size > 0 && first.assetType === 'image' && /\.png$/.test(first.generatedName));
  r = await list(`unit=${U1.unitId}`); check('filter by unit', r.total === 1 && r.assets[0].uploader === n('u1'));
  r = await list('unit=none'); check('filter "no unit"', r.total === 1 && r.assets[0].uploader === n('u2'));
  r = await list('type=image'); check('filter by type', r.total === 2);
  r = await list('type=video'); check('a type with no files is empty', r.total === 0);
  r = await list('search=U2'); check('search by file name', r.total === 1);
  r = await list('limit=1&offset=0'); const p2 = await list('limit=1&offset=1');
  check('pagination', r.assets.length === 1 && p2.assets.length === 1 && r.assets[0].assetId !== p2.assets[0].assetId && r.total === 2);
  check('wildcards are literal', (await list('search=%25')).total === 0);
  const sum = (await c.adminA.get(`${M(A)}/summary`)).data;
  const u1Sum = sum.byUnit.find(u => u.unitId === U1.unitId), noUnit = sum.byUnit.find(u => u.unitId === null);
  check('summary counts per unit and type', sum.total === 2 && u1Sum?.image === 1 && noUnit?.image === 1 && sum.bytes > 0, JSON.stringify(sum));

  // ---- unit administrators: the library of their own unit, read only ----
  const ur = (await c.unitadmin.get(M(A))).data;
  check('a unit administrator lists the files of their own unit only', (await c.unitadmin.get(M(A))).status === 200 && ur.total === 1 && ur.assets[0].uploader === n('u1'), JSON.stringify(ur.assets?.map(a => a.originalFileName)));
  check('...also when asking for their unit explicitly', (await c.unitadmin.get(`${M(A)}?unit=${U1.unitId}`)).data.total === 1);
  check('...but not another unit -> 403', (await c.unitadmin.get(`${M(A)}?unit=${U2.unitId}`)).status === 403);
  check('...and not the files without a unit -> 403', (await c.unitadmin.get(`${M(A)}?unit=none`)).status === 403);
  const us = (await c.unitadmin.get(`${M(A)}/summary`)).data;
  check('their summary only counts their unit', us.total === 1 && us.byUnit.length === 1 && us.byUnit[0].unitId === U1.unitId, JSON.stringify(us));
  check('a unit administrator cannot move files -> 403', (await c.unitadmin.post(`${M(A)}/move`, { assetId: f1.data.assetId, unitId: U2.unitId })).status === 403);
  check('...nor delete them (it is not their own file) -> 403', await remove(c.unitadmin, f1.data.assetId) === 403);
  check('a unit administrator of another organization sees nothing here -> 403', (await c.unitadminB.get(M(A))).status === 403);
  check('their own organization library is theirs', (await c.unitadminB.get(M(B))).data.total === 1);
  const mine = (await c.unitadmin.get('/org/my-units')).data;
  check('"my units" lists the units they administer', mine.length === 1 && mine[0].unitId === U1.unitId && mine[0].organizationId === A.organizationId, JSON.stringify(mine));
  check('a plain member has no administered units', (await c.u1.get('/org/my-units')).data.length === 0 && (await new Http().get('/org/my-units')).status === 403);

  // ---- usage count ----
  await db.query('update "VrSpaces" set "worldModelAssetId" = null where false');
  const { rows: [sp] } = await db.query('insert into "VrSpaces" (name, "ownerUserId", visibility, "worldModelAssetId") values ($1, $2, \'private\', $3) returning "vrSpaceId"', [`Media-rum ${suffix}`, adminA.userId, f1.data.assetId]);
  check('the list says when a file is in use', (await list(`unit=${U1.unitId}`)).assets[0].usedIn === 1);

  // ---- move ----
  const move = (client, org, assetId, unitId) => client.post(`${M(org)}/move`, { assetId, unitId });
  check('move a file to another unit', (await move(c.adminA, A, f2.data.assetId, U2.unitId)).status === 200 && (await row(f2.data.assetId)).unitId === U2.unitId);
  check('move to "no unit"', (await move(c.adminA, A, f2.data.assetId, null)).status === 200 && (await row(f2.data.assetId)).unitId === null);
  check('a unit of another organization is refused -> 400', (await move(c.adminA, A, f2.data.assetId, UB.unitId)).status === 400);
  check('a file of another organization is refused -> 404', (await move(c.adminA, A, f4.data.assetId, U1.unitId)).status === 404);
  check('a personal file cannot be moved here -> 404', (await move(c.adminA, A, f3.data.assetId, U1.unitId)).status === 404);
  check('another organization\'s admin cannot move -> 403', (await move(c.adminB, A, f2.data.assetId, U1.unitId)).status === 403);

  // ---- deleting (through the file server) ----
  check('admin of another organization cannot delete A\'s file -> 403', await remove(c.adminB, f2.data.assetId) === 403);
  check('a plain member cannot delete a colleague\'s file -> 403', await remove(c.u1, f2.data.assetId) === 403);
  check('an org admin cannot delete another organization\'s file -> 403', await remove(c.adminA, f4.data.assetId) === 403);
  check('an org admin cannot delete someone\'s personal file -> 403', await remove(c.adminA, f3.data.assetId) === 403);
  const url = id => `${FILES}/file/${id}`;
  const gen2 = (await db.query('select "generatedName" from "Assets" where "assetId" = $1', [f2.data.assetId])).rows[0].generatedName;
  check('the file is reachable before deletion', (await fetch(url(gen2))).status === 200);
  check('an org admin deletes a file in their organization', await remove(c.adminA, f2.data.assetId) === 200);
  check('...it is gone from the list and from disk', (await list()).total === 1 && (await fetch(url(gen2))).status !== 200);
  check('deleting something already gone -> 404', await remove(c.adminA, f2.data.assetId) === 404);
  check('deleting a file used in a VR space works and unlinks it', await remove(c.adminA, f1.data.assetId) === 200
    && (await db.query('select "worldModelAssetId" from "VrSpaces" where "vrSpaceId" = $1', [sp.vrSpaceId])).rows[0].worldModelAssetId === null);
  check('the owner can still delete their own file', await remove(c.both, f3.data.assetId) === 200);
  check('a platform admin can delete in any organization', await remove(god, f4.data.assetId) === 200);
  check('the library is empty afterwards', (await list()).total === 0);
  // the hidden file is not listed, so remove it (and its file on disk) here too
  check('the owner deletes the hidden file', await remove(c.u1, hidden.data.assetId) === 200);
} finally {
  try {
    await db.query('delete from "VrSpaces" where name like $1', [`Media-rum ${suffix}`]);
    const { rows: left } = await db.query('select "generatedName" from "Assets" where "assetId" = any($1)', [assetIds]);
    await db.query('delete from "Assets" where "assetId" = any($1)', [assetIds]);
    if (left.length) console.log(`note: ${left.length} test file(s) were removed from the database but may remain on disk`);
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
