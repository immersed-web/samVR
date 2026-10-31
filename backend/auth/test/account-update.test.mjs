import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, test } from 'node:test';

const baseUrl = process.env.AUTH_TEST_URL;
if (!baseUrl) throw new Error('AUTH_TEST_URL must point to an isolated auth test service');

const suffix = randomUUID();
const password = 'test-password';
const names = {
  moderator: `moderator-${suffix}`,
  peer: `peer-${suffix}`,
  user: `user-${suffix}`,
  ordinary: `ordinary-${suffix}`,
  superadmin: `superadmin-${suffix}`,
};
const accounts = {};
let godCookie;
let moderatorCookie;
let ordinaryCookie;

async function login(username, userPassword) {
  const response = await fetch(`${baseUrl}/user/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: userPassword }),
  });
  return { response, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

async function createUser(username, role) {
  const response = await fetch(`${baseUrl}/user/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: godCookie },
    body: JSON.stringify({ username, password, role }),
  });
  assert.equal(response.status, 201, await response.text());
  // Fetch the user ID through the existing authenticated user-list endpoint.
  const usersResponse = await fetch(`${baseUrl}/user/get-users`, { headers: { cookie: godCookie } });
  assert.equal(usersResponse.status, 200);
  const user = (await usersResponse.json()).find(item => item.username === username);
  assert.ok(user, `created user ${username} must be listed`);
  return user;
}

async function update(cookie, body) {
  return fetch(`${baseUrl}/user/update`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

before(async () => {
  const god = await login('överchefen', 'test-god-password');
  assert.equal(god.response.status, 200);
  assert.ok(god.cookie);
  godCookie = god.cookie;
  const me = await fetch(`${baseUrl}/user/me`, { headers: { cookie: godCookie } });
  assert.equal(me.status, 200);
  accounts.god = await me.json();
  for (const [name, role] of Object.entries({ moderator: 'moderator', peer: 'moderator', user: 'user', ordinary: 'user', superadmin: 'superadmin' })) {
    accounts[name] = await createUser(names[name], role);
  }
  const moderator = await login(names.moderator, password);
  const ordinary = await login(names.ordinary, password);
  assert.ok(moderator.cookie);
  assert.ok(ordinary.cookie);
  moderatorCookie = moderator.cookie;
  ordinaryCookie = ordinary.cookie;
});

test('requires a logged-in moderator or higher', async () => {
  assert.equal((await update(undefined, { userId: accounts.user.userId, password: 'changed' })).status, 403);
  assert.equal((await update(ordinaryCookie, { userId: accounts.user.userId, password: 'changed' })).status, 403);
});

test('rejects password-only changes to higher-privileged accounts', async () => {
  for (const target of [accounts.god, accounts.superadmin]) {
    assert.equal((await update(moderatorCookie, { userId: target.userId, password: 'replacement' })).status, 403);
    assert.equal((await update(moderatorCookie, { userId: target.userId, role: 'user' })).status, 403);
    assert.equal((await update(moderatorCookie, { userId: target.userId, username: 'replacement' })).status, 403);
  }
  assert.equal((await login('överchefen', 'test-god-password')).response.status, 200);
  assert.equal((await login('överchefen', 'replacement')).response.status, 401);
});

test('rejects updates to peers and to the caller', async () => {
  for (const target of [accounts.peer, accounts.moderator]) {
    assert.equal((await update(moderatorCookie, { userId: target.userId, password: 'replacement' })).status, 403);
  }
  assert.equal((await login(names.peer, password)).response.status, 200);
});

test('rejects promotion to the caller role or higher', async () => {
  for (const role of ['moderator', 'admin', 'god']) {
    assert.equal((await update(moderatorCookie, { userId: accounts.user.userId, role })).status, 403);
  }
});

test('allows authorized updates to lower-privileged users without returning the password hash', async () => {
  const response = await update(moderatorCookie, { userId: accounts.user.userId, password: 'new-user-password', role: 'user' });
  assert.equal(response.status, 201);
  const updated = await response.json();
  assert.equal(updated.userId, accounts.user.userId);
  assert.equal(updated.role, 'user');
  assert.equal('password' in updated, false);
  assert.equal((await login(names.user, 'new-user-password')).response.status, 200);
  assert.equal((await login(names.user, password)).response.status, 401);
});

test('rejects invalid updates and reports missing users', async () => {
  assert.equal((await update(moderatorCookie, { userId: 'not-a-uuid', password })).status, 400);
  assert.equal((await update(moderatorCookie, { userId: accounts.user.userId, role: 'invalid' })).status, 400);
  assert.equal((await update(moderatorCookie, { userId: accounts.user.userId, role: null })).status, 400);
  assert.equal((await update(moderatorCookie, { userId: accounts.user.userId })).status, 400);
  assert.equal((await update(moderatorCookie, { userId: randomUUID(), password })).status, 404);
});

test('uses the caller current database role rather than a stale session role', async () => {
  assert.equal((await update(godCookie, { userId: accounts.moderator.userId, role: 'user' })).status, 201);
  assert.equal((await update(moderatorCookie, { userId: accounts.user.userId, password: 'replacement' })).status, 403);
  assert.equal((await login(names.user, 'new-user-password')).response.status, 200);
});
