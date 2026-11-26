// Integration test: platform user management (/manage/users) and the users' inbox (/messages).
// Run against a RUNNING dev stack (auth :3333, database). Creates and removes its own data.
//   cd backend/auth && DATABASE_USER=samvr npx dotenv-cli -e ../../.env -- node test/user-admin.integration.mjs
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
  const M = '/manage/users';
  const pw = 'Anvadm-test-1234';
  const mk = async (name, role) => (await god.post(`${M}/create`, { username: n(name), password: pw, role })).data;

  // ---- create ----
  const gen = await god.post(`${M}/create`, { username: n('generated'), role: 'user' });
  check('create without a password returns a generated one', gen.status === 200 && typeof gen.data.password === 'string' && gen.data.password.length >= 10, JSON.stringify(gen.data));
  check('the generated password works for login', (await new Http().post('/user/login', { username: n('generated'), password: gen.data.password })).status === 200);
  check('duplicate username -> 409', (await god.post(`${M}/create`, { username: n('generated'), password: pw, role: 'user' })).status === 409);
  check('cannot create a role equal to or above your own -> 403', (await god.post(`${M}/create`, { username: n('x'), password: pw, role: 'god' })).status === 403);
  check('guest role cannot be created -> 403', (await god.post(`${M}/create`, { username: n('x'), password: pw, role: 'guest' })).status === 403);
  const alice = await mk('alice', 'user'); const bob = await mk('bob', 'user'); const mod = await mk('mod', 'moderator');
  const adm = await mk('adm', 'admin'); const sup1 = await mk('sup1', 'superadmin'); const sup2 = await mk('sup2', 'superadmin');

  // ---- who may use it ----
  const admClient = await new Http().login(n('adm'), pw);
  const aliceClient = await new Http().login(n('alice'), pw);
  check('a global admin (below superadmin) is refused -> 403', (await admClient.get(M)).status === 403);
  check('an ordinary user is refused -> 403', (await aliceClient.get(M)).status === 403);
  check('anonymous is refused -> 403', (await new Http().get(M)).status === 403);
  check('superadmin may use it', (await (await new Http().login(n('sup1'), pw)).get(M)).status === 200);

  // ---- list / search / filter ----
  const org = (await god.post('/org/create', { name: `Anvadm-org ${suffix}`, type: 'municipality' })).data; orgIds.push(org.organizationId);
  await god.post('/org/member/set', { organizationId: org.organizationId, userId: alice.userId, role: 'member' });
  const list = async (qs) => (await god.get(`${M}?${qs}`)).data;
  const names = r => r.users.map(u => u.username);
  let r = await list(`search=${suffix}&limit=100`);
  check('search finds users by name', r.total >= 7 && names(r).includes(n("alice")), JSON.stringify(r.total));
  r = await list(`search=${n('alice')}`);
  check('search narrows to one user', r.total === 1 && r.users[0].username === n('alice'));
  r = await list(`search=${n('ALICE')}`);
  check('search is case-insensitive', r.total === 1);
  r = await list(`search=Anvadm-org ${suffix}`);
  check('search also matches organization names', r.users.some(u => u.userId === alice.userId));
  check('wildcards in the search are taken literally', (await list(`search=${encodeURIComponent('%')}&limit=100`)).users.every(u => u.username.includes('%')));
  r = await list(`search=${suffix}&role=moderator`);
  check('role filter', r.total === 1 && r.users[0].role === 'moderator');
  r = await list(`search=${suffix}&org=${org.organizationId}`);
  check('organization filter', r.total === 1 && r.users[0].organizations[0]?.name === `Anvadm-org ${suffix}`);
  r = await list(`search=${suffix}&org=none&limit=100`);
  check('"without organization" filter excludes members', r.total >= 6 && !names(r).includes(n('alice')));
  r = await list(`search=${suffix}&limit=2&offset=0`); const p2 = await list(`search=${suffix}&limit=2&offset=2`);
  check('pagination', r.users.length === 2 && p2.users.length === 2 && r.total === p2.total && !names(r).some(x => names(p2).includes(x)));
  r = await list(`search=${suffix}&sort=username&order=desc&limit=100`);
  check('sorting by name descending', names(r).join() === [...names(r)].sort((a, b) => b.localeCompare(a, 'sv')).join() || names(r)[0] >= names(r).at(-1));
  r = await list(`search=${suffix}&sort=role&order=asc&limit=100`);
  check('sorting by role puts the most privileged first', ['superadmin'].includes(r.users[0].role));
  check('bad filter values -> 400', (await god.get(`${M}?role=wizard`)).status === 400 && (await god.get(`${M}?limit=5000`)).status === 400);
  check('the list never exposes password hashes', !JSON.stringify(await list(`search=${suffix}&limit=100`)).includes('password'));
  const sum = (await god.get(`${M}/summary`)).data;
  const noOrg = (await db.query('select count(*)::int c from "Users" u where not exists (select 1 from "OrganizationMembers" m where m."userId" = u."userId")')).rows[0].c;
  check('summary counts accounts without organization correctly', sum.withoutOrganization === noOrg && noOrg > 0, sum.withoutOrganization + ' vs ' + noOrg);
  check('summary has counts, roles and organizations', typeof sum.total === 'number' && Array.isArray(sum.byRole) && sum.organizations.some(o => o.organizationId === org.organizationId));

  // ---- details ----
  await db.query('insert into "VrSpaces" (name, "ownerUserId", visibility) values ($1, $2, \'private\')', [`Alice rum ${suffix}`, alice.userId]);
  check('the list shows how many spaces each user owns', (await list(`search=${n('alice')}`)).users[0].spaceCount === 1);
  const det = (await god.get(`${M}/${alice.userId}`)).data;
  check('details show organizations, spaces and rights', det.organizations[0]?.name.startsWith('Anvadm-org') && det.spaces.length === 1 && det.canManage === true && det.assignableRoles.includes('moderator') && !det.assignableRoles.includes('god'));
  check('canManage is false for someone above you', (await (await new Http().login(n('sup1'), pw)).get(`${M}/${sup2.userId}`)).data.canManage === false);
  check('unknown user -> 404', (await god.get(`${M}/${randomUUID()}`)).status === 404);

  // ---- update ----
  check('rename a user', (await god.post(`${M}/update`, { userId: bob.userId, username: n('bobby') })).status === 200 && (await god.get(`${M}/${bob.userId}`)).data.user.username === n('bobby'));
  check('renaming to a taken name -> 409', (await god.post(`${M}/update`, { userId: bob.userId, username: n('alice') })).status === 409);
  check('change role to one below yours', (await god.post(`${M}/update`, { userId: bob.userId, role: 'moderator' })).status === 200 && (await god.get(`${M}/${bob.userId}`)).data.user.role === 'moderator');
  check('cannot grant your own level or above -> 403', (await god.post(`${M}/update`, { userId: bob.userId, role: 'god' })).status === 403);
  const sup1c = await new Http().login(n('sup1'), pw);
  check('a superadmin cannot change another superadmin -> 403', (await sup1c.post(`${M}/update`, { userId: sup2.userId, username: n('hacked') })).status === 403);
  check('a superadmin cannot grant superadmin -> 403', (await sup1c.post(`${M}/update`, { userId: alice.userId, role: 'superadmin' })).status === 403);
  check('you cannot change your own account here -> 400', (await sup1c.post(`${M}/update`, { userId: sup1.userId, username: n('me') })).status === 400);
  check('empty update -> 400', (await god.post(`${M}/update`, { userId: bob.userId })).status === 400);

  // ---- password reset ----
  check('alice is logged in before the reset', (await aliceClient.get('/user/me')).status === 200);
  const reset = await god.post(`${M}/password`, { userId: alice.userId });
  check('reset returns a generated password', reset.status === 200 && reset.data.password?.length >= 10);
  check('the new password works', (await new Http().post('/user/login', { username: n('alice'), password: reset.data.password })).status === 200);
  check('the old password no longer works', (await new Http().post('/user/login', { username: n('alice'), password: pw })).status !== 200);
  check('the reset ends the old login session', (await aliceClient.get('/user/me')).status === 403);
  const typed = await god.post(`${M}/password`, { userId: alice.userId, password: 'Eget-losen-9999' });
  check('an administrator can also set a chosen password', typed.status === 200 && typed.data.password === undefined && (await new Http().post('/user/login', { username: n('alice'), password: 'Eget-losen-9999' })).status === 200);
  check('too short password -> 400', (await god.post(`${M}/password`, { userId: alice.userId, password: 'kort' })).status === 400);
  check('cannot reset a higher account -> 403', (await sup1c.post(`${M}/password`, { userId: sup2.userId })).status === 403);
  check('cannot reset your own here -> 400', (await sup1c.post(`${M}/password`, { userId: sup1.userId })).status === 400);

  // ---- block ----
  const carol = await mk('carol', 'user');
  const carolClient = await new Http().login(n('carol'), pw);
  check('carol can get a jwt before being blocked', (await carolClient.get('/user/jwt')).status === 200);
  check('block with a reason', (await god.post(`${M}/block`, { userId: carol.userId, blocked: true, reason: 'Test av spärr' })).status === 200);
  const blockedDetails = (await god.get(`${M}/${carol.userId}`)).data.user;
  check('the block and its reason are stored', !!blockedDetails.blockedAt && blockedDetails.blockedReason === 'Test av spärr');
  const loginAttempt = await new Http().post('/user/login', { username: n('carol'), password: pw });
  check('a blocked account cannot log in', loginAttempt.status === 403 && /spärrat/.test(loginAttempt.data), JSON.stringify(loginAttempt));
  check('the existing session stops working', (await carolClient.get('/user/jwt')).status === 403);
  check('blocked filter lists her', (await list(`search=${n('carol')}&status=blocked`)).total === 1 && (await list(`search=${n('carol')}&status=active`)).total === 0);
  check('unblock', (await god.post(`${M}/block`, { userId: carol.userId, blocked: false })).status === 200 && (await new Http().post('/user/login', { username: n('carol'), password: pw })).status === 200);
  check('cannot block yourself -> 400', (await sup1c.post(`${M}/block`, { userId: sup1.userId, blocked: true })).status === 400);
  check('cannot block someone above you -> 403', (await sup1c.post(`${M}/block`, { userId: sup2.userId, blocked: true })).status === 403);
  check('last login time is recorded', !!(await god.get(`${M}/${carol.userId}`)).data.user.lastLoginAt);

  // ---- messages ----
  const dave = await mk('dave', 'user'); await god.post('/org/member/set', { organizationId: org.organizationId, userId: dave.userId, role: 'member' });
  const sent = await god.post(`${M}/message`, { userIds: [carol.userId], subject: 'Hej', body: 'Detta är ett test.' });
  check('send a message to one user', sent.status === 200 && sent.data.sent === 1);
  const org1 = await god.post(`${M}/message`, { organizationId: org.organizationId, subject: 'Till alla', body: 'Meddelande till organisationen' });
  check('send to a whole organization', org1.status === 200 && org1.data.sent === 2, JSON.stringify(org1.data));
  const carolIn = await new Http().login(n('carol'), pw);
  const inbox = (await carolIn.get('/messages')).data;
  check('the user sees the message in the inbox', inbox.unread === 1 && inbox.messages[0].subject === 'Hej' && inbox.messages[0].from === 'överchefen', JSON.stringify(inbox));
  check('the summary counts unread messages', (await carolIn.get('/messages/summary')).data.unread === 1);
  const daveIn = await new Http().login(n('dave'), pw);
  check('an organization broadcast reaches its members', (await daveIn.get('/messages')).data.messages[0]?.subject === 'Till alla');
  check('messages are private to their recipient', !(await daveIn.get('/messages')).data.messages.some(m => m.subject === 'Hej'));
  check('mark as read', (await carolIn.post('/messages/read', { messageId: inbox.messages[0].messageId })).status === 200 && (await carolIn.get('/messages/summary')).data.unread === 0);
  check('someone else cannot mark or delete my message', (await daveIn.post('/messages/delete', { messageId: inbox.messages[0].messageId })).status === 200 && (await carolIn.get('/messages')).data.messages.some(m => m.subject === 'Hej'));
  check('delete my own message', (await carolIn.post('/messages/delete', { messageId: inbox.messages[0].messageId })).status === 200 && !(await carolIn.get('/messages')).data.messages.some(m => m.subject === 'Hej'));
  check('messages need a subject and a body -> 400', (await god.post(`${M}/message`, { userIds: [carol.userId], subject: '', body: 'x' })).status === 400 && (await god.post(`${M}/message`, { userIds: [carol.userId], subject: 'x', body: ' ' })).status === 400);
  check('messages need a recipient -> 400', (await god.post(`${M}/message`, { subject: 'x', body: 'y' })).status === 400);
  check('only platform admins can send -> 403', (await admClient.post(`${M}/message`, { userIds: [carol.userId], subject: 'x', body: 'y' })).status === 403);
  check('anonymous cannot read an inbox -> 403', (await new Http().get('/messages')).status === 403);

  // ---- delete ----
  check('cannot delete yourself -> 400', (await sup1c.post(`${M}/delete`, { userId: sup1.userId })).status === 400);
  check('cannot delete someone above you -> 403', (await sup1c.post(`${M}/delete`, { userId: sup2.userId })).status === 403);
  const del = await god.post(`${M}/delete`, { userId: alice.userId });
  const gone = async id => (await db.query('select 1 from "Users" where "userId" = $1', [id])).rowCount === 0;
  check('delete a user', del.status === 200 && await gone(alice.userId));
  check('their spaces are removed with them', (await db.query('select 1 from "VrSpaces" where name = $1', [`Alice rum ${suffix}`])).rowCount === 0);
  check('their old login no longer works', (await new Http().post('/user/login', { username: n('alice'), password: 'Eget-losen-9999' })).status !== 200);
} finally {
  try {
    await db.query('delete from "VrSpaces" where name like $1', [`% ${suffix}`]);
    await db.query('delete from "OrganizationMembers" where "organizationId" = any($1)', [orgIds]);
    await db.query('delete from "Users" where username like $1', [`%\\_${suffix}`]);
    await db.query('delete from "Organizations" where "organizationId" = any($1)', [orgIds]);
  } catch (e) { console.log('cleanup problem:', e.message); }
  await db.end();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
