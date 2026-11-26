// Integration test for organization requests and invitations, against a RUNNING dev stack (auth :3333, database).
// Creates its own uniquely named data and removes it afterwards.
//   cd backend/auth && DATABASE_USER=samvr npx dotenv-cli -e ../../.env -- node test/onboarding.integration.mjs
// Note: the public request form is rate limited (5/hour per IP, in memory), so this test submits only a few requests.
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
const createdUsernames = [];
const orgIds = [];
const pw = 'Invite-test-1234';
try {
  const admin = await new Http().login('överchefen', process.env.ADMIN_PASSWORD);
  const anon = new Http();

  /* ---------------- request form ---------------- */
  const reqBody = { organizationName: `Testkommun ${suffix}`, organizationType: 'municipality', contactName: 'Test Person', contactEmail: `kontakt-${suffix}@example.com`, expectedUsers: 250, message: 'Hej' };
  check('anyone can submit a request', (await anon.post('/onboarding/request', reqBody)).status === 200);
  check('invalid e-mail rejected -> 400', (await anon.post('/onboarding/request', { ...reqBody, contactEmail: 'inte-en-epost' })).status === 400);
  check('honeypot filled -> 400', (await anon.post('/onboarding/request', { ...reqBody, website: 'http://spam' })).status === 400);
  check('missing fields -> 400', (await anon.post('/onboarding/request', { organizationName: 'x' })).status === 400);

  check('anonymous cannot list requests', (await anon.get('/onboarding/requests')).status === 403);
  const listed = (await admin.get('/onboarding/requests?status=requested')).data;
  const mine = listed.find(r => r.organizationName === `Testkommun ${suffix}`);
  check('platform admin sees the request', !!mine && mine.contactEmail === reqBody.contactEmail);

  // a regular user cannot review requests
  const org0 = (await admin.post('/org/create', { name: `Hjälporg ${suffix}` })).data; orgIds.push(org0.organizationId);
  const u0 = (await admin.post('/org/user/create', { organizationId: org0.organizationId, username: `plain_${suffix}`, password: pw })).data; createdUsernames.push(`plain_${suffix}`);
  const plain = await new Http().login(`plain_${suffix}`, pw);
  check('regular user cannot list requests', (await plain.get('/onboarding/requests')).status === 403);
  check('regular user cannot approve requests', (await plain.post('/onboarding/requests/approve', { requestId: mine.requestId })).status === 403);

  /* ---------------- approve -> first admin invitation ---------------- */
  const approved = (await admin.post('/onboarding/requests/approve', { requestId: mine.requestId }));
  check('approve creates organization and an invitation', approved.status === 200 && !!approved.data.token && !!approved.data.organization?.organizationId, JSON.stringify(approved.data));
  orgIds.push(approved.data.organization.organizationId);
  const firstToken = approved.data.token;
  check('approving twice -> 409', (await admin.post('/onboarding/requests/approve', { requestId: mine.requestId })).status === 409);
  check('rejecting an approved request -> 409', (await admin.post('/onboarding/requests/reject', { requestId: mine.requestId })).status === 409);
  const stored = (await db.query(`select "tokenHash" from "Invitations" where "organizationId"=$1`, [approved.data.organization.organizationId])).rows[0];
  check('only a hash of the code is stored', !!stored && stored.tokenHash !== firstToken && !stored.tokenHash.includes(firstToken));

  /* ---------------- preview ---------------- */
  const preview = await anon.get(`/onboarding/invitation/${firstToken}`);
  check('preview shows the organization, not secrets', preview.status === 200 && preview.data.organizationName === `Testkommun ${suffix}` && preview.data.organizationRole === 'org_admin' && !('token' in preview.data), JSON.stringify(preview.data));
  check('unknown code -> 410', (await anon.get(`/onboarding/invitation/${'x'.repeat(43)}`)).status === 410);
  check('malformed code -> 410 (same answer)', (await anon.get('/onboarding/invitation/abc')).status === 410);

  /* ---------------- accept as a new user ---------------- */
  check('accept without account details -> 400', (await new Http().post('/onboarding/accept', { token: firstToken })).status === 400);
  check('accept with short password -> 400', (await new Http().post('/onboarding/accept', { token: firstToken, username: `short_${suffix}`, password: 'abc' })).status === 400);
  const orgAdminClient = new Http();
  const acc1 = await orgAdminClient.post('/onboarding/accept', { token: firstToken, username: `kommunadmin_${suffix}`, password: pw });
  createdUsernames.push(`kommunadmin_${suffix}`);
  check('new user accepts and gets an account', acc1.status === 200 && acc1.data.createdAccount === true, JSON.stringify(acc1.data));
  check('...and is signed in straight away', (await orgAdminClient.get('/org/list')).data.some(o => o.myRole === 'org_admin'));
  check('single-use code cannot be used again -> 410', (await new Http().post('/onboarding/accept', { token: firstToken, username: `again_${suffix}`, password: pw })).status === 410);
  check('used-up code looks the same as an unknown one in preview', (await anon.get(`/onboarding/invitation/${firstToken}`)).status === 410);

  /* ---------------- invitations created by organization admins ---------------- */
  const orgId = approved.data.organization.organizationId;
  const unit1 = (await orgAdminClient.post('/org/unit/create', { organizationId: orgId, name: 'Skola A' })).data;
  const unit2 = (await orgAdminClient.post('/org/unit/create', { organizationId: orgId, name: 'Skola B' })).data;
  check('plain user cannot create invitations', (await plain.post('/onboarding/invitations/create', { organizationId: orgId })).status === 403);
  check('org_admin of another organization cannot invite here', (await (await new Http().login('överchefen', process.env.ADMIN_PASSWORD)).post('/onboarding/invitations/create', { organizationId: orgId, unitId: unit1.unitId })).status === 200); // platform admin may
  const inv = (await orgAdminClient.post('/onboarding/invitations/create', { organizationId: orgId, unitId: unit1.unitId, maxUses: 2, note: 'Klass 7' })).data;
  check('org_admin creates a unit invitation', !!inv.token && !!inv.invitationId);
  check('unit must belong to the organization', (await orgAdminClient.post('/onboarding/invitations/create', { organizationId: orgId, unitId: randomUUID() })).status === 400);

  const s1 = new Http(), s2 = new Http(), s3 = new Http();
  check('first student joins', (await s1.post('/onboarding/accept', { token: inv.token, username: `elev1_${suffix}`, password: pw })).status === 200);
  createdUsernames.push(`elev1_${suffix}`);
  check('second student joins', (await s2.post('/onboarding/accept', { token: inv.token, username: `elev2_${suffix}`, password: pw })).status === 200);
  createdUsernames.push(`elev2_${suffix}`);
  check('third student is refused (maxUses = 2) -> 410', (await s3.post('/onboarding/accept', { token: inv.token, username: `elev3_${suffix}`, password: pw })).status === 410);
  const e3 = (await db.query('select 1 from "Users" where username=$1', [`elev3_${suffix}`])).rowCount;
  check('refused attempt did not create an account', e3 === 0);
  const inUnit = (await db.query(`select count(*)::int c from "UnitMembers" um join "Users" u on u."userId"=um."userId" where um."unitId"=$1 and u.username like $2`, [unit1.unitId, `elev%_${suffix}`])).rows[0].c;
  check('students ended up in the unit', inUnit === 2, String(inUnit));
  check('a student cannot see the organization details or invite', (await s1.get(`/org/${orgId}`)).status === 403 && (await s1.post('/onboarding/invitations/create', { organizationId: orgId, unitId: unit1.unitId })).status === 403);

  // unit admin powers
  await orgAdminClient.post('/org/unit/member/set', { unitId: unit1.unitId, userId: (await db.query('select "userId" from "Users" where username=$1', [`elev1_${suffix}`])).rows[0].userId, role: 'unit_admin' });
  check('unit_admin can invite members to own unit', (await s1.post('/onboarding/invitations/create', { organizationId: orgId, unitId: unit1.unitId })).status === 200);
  check('unit_admin cannot invite to another unit', (await s1.post('/onboarding/invitations/create', { organizationId: orgId, unitId: unit2.unitId })).status === 403);
  check('unit_admin cannot invite org admins', (await s1.post('/onboarding/invitations/create', { organizationId: orgId, unitId: unit1.unitId, organizationRole: 'org_admin' })).status === 403);
  check('unit_admin cannot invite without a unit', (await s1.post('/onboarding/invitations/create', { organizationId: orgId })).status === 403);

  /* ---------------- listing & revoking ---------------- */
  const list = await orgAdminClient.get(`/onboarding/invitations/${orgId}`);
  check('invitation list never contains codes or hashes', list.status === 200 && list.data.length >= 2 && !JSON.stringify(list.data).includes('tokenHash') && !JSON.stringify(list.data).includes(inv.token));
  check('student cannot list invitations', (await s2.get(`/onboarding/invitations/${orgId}`)).status === 403);
  const inv2 = (await orgAdminClient.post('/onboarding/invitations/create', { organizationId: orgId, unitId: unit1.unitId })).data;
  check('revoke works', (await orgAdminClient.post('/onboarding/invitations/revoke', { invitationId: inv2.invitationId })).status === 200);
  check('revoked code -> 410', (await anon.get(`/onboarding/invitation/${inv2.token}`)).status === 410);
  check('a student cannot revoke someone else\'s invitation in another unit', (await s2.post('/onboarding/invitations/revoke', { invitationId: (await orgAdminClient.post('/onboarding/invitations/create', { organizationId: orgId, unitId: unit2.unitId })).data.invitationId })).status === 403);

  /* ---------------- expiry, existing accounts, conflicts, admins ---------------- */
  const inv3 = (await orgAdminClient.post('/onboarding/invitations/create', { organizationId: orgId })).data;
  await db.query(`update "Invitations" set "expiresAt" = (now() at time zone 'utc') - interval '1 minute' where "invitationId"=$1`, [inv3.invitationId]);
  check('expired code -> 410', (await anon.get(`/onboarding/invitation/${inv3.token}`)).status === 410 && (await new Http().post('/onboarding/accept', { token: inv3.token, username: `late_${suffix}`, password: pw })).status === 410);
  createdUsernames.push(`late_${suffix}`);

  const inv4 = (await orgAdminClient.post('/onboarding/invitations/create', { organizationId: orgId, maxUses: 5 })).data;
  check('taken username -> 409 and the code is not used up', (await new Http().post('/onboarding/accept', { token: inv4.token, username: `elev1_${suffix}`, password: pw })).status === 409
    && (await db.query('select "usedCount" from "Invitations" where "invitationId"=$1', [inv4.invitationId])).rows[0].usedCount === 0);
  const acc4 = await plain.post('/onboarding/accept', { token: inv4.token });
  check('existing logged-in user joins with their own account', acc4.status === 200 && acc4.data.createdAccount === false, JSON.stringify(acc4.data));
  const inv4b = (await orgAdminClient.post('/onboarding/invitations/create', { organizationId: orgId })).data;
  const prevLoggedIn = (await plain.get(`/onboarding/invitation/${inv4b.token}`)).data;
  check('preview tells a signed-in visitor which account they are using', prevLoggedIn.loggedIn === true && prevLoggedIn.username === `plain_${suffix}`, JSON.stringify(prevLoggedIn));
  check('...and an anonymous visitor gets no username', (await anon.get(`/onboarding/invitation/${inv4b.token}`)).data.username === null);
  check('...and is now a member of both organizations', (await plain.get('/org/list')).data.length === 2);
  check('joining again -> 409 and the code is not consumed', (await plain.post('/onboarding/accept', { token: inv4.token })).status === 409
    && (await db.query('select "usedCount" from "Invitations" where "invitationId"=$1', [inv4.invitationId])).rows[0].usedCount === 1);
  check('platform admins cannot join via invitation -> 400', (await admin.post('/onboarding/accept', { token: inv4.token })).status === 400);

  // two people racing for the last seat
  const inv5 = (await orgAdminClient.post('/onboarding/invitations/create', { organizationId: orgId, maxUses: 1 })).data;
  const race = await Promise.all([1, 2, 3, 4].map(i => new Http().post('/onboarding/accept', { token: inv5.token, username: `race${i}_${suffix}`, password: pw })));
  race.forEach((_, i) => createdUsernames.push(`race${i + 1}_${suffix}`));
  const wins = race.filter(r => r.status === 200).length;
  check('racing for a single-use code: exactly one wins', wins === 1 && race.filter(r => r.status === 410).length === 3, race.map(r => r.status).join(','));
  check('...and the code is used exactly once', (await db.query('select "usedCount" from "Invitations" where "invitationId"=$1', [inv5.invitationId])).rows[0].usedCount === 1);

  // rejecting a request
  check('another request can be submitted and rejected', (await anon.post('/onboarding/request', { ...reqBody, organizationName: `Avslagen ${suffix}` })).status === 200);
  const rej = (await admin.get('/onboarding/requests?status=requested')).data.find(r => r.organizationName === `Avslagen ${suffix}`);
  check('reject works', (await admin.post('/onboarding/requests/reject', { requestId: rej.requestId })).status === 200);
  check('rejected request no longer open', !(await admin.get('/onboarding/requests?status=requested')).data.some(r => r.organizationName === `Avslagen ${suffix}`));
} finally {
  try {
    await db.query(`delete from "OrganizationRequests" where "organizationName" like $1 or "organizationName" like $2`, [`Testkommun ${suffix}`, `Avslagen ${suffix}`]);
    if (createdUsernames.length) await db.query(`delete from "Users" where username = any($1)`, [createdUsernames]);
    if (orgIds.length) await db.query(`delete from "Organizations" where "organizationId" = any($1)`, [orgIds]);
  } catch (e) { console.log('cleanup problem:', e.message); }
  await db.end();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
