import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';
import { parse as parseEvent } from '../node_modules/devalue/index.js';

const require = createRequire('/app/backend/database/package.json');
const { Client } = require('pg');
const bcrypt = require('bcrypt');
const { AUTH_TEST_URL: authUrl, MEDIA_TEST_URL: mediaUrl, DATABASE_URL } = process.env;
if (!authUrl || !mediaUrl || !DATABASE_URL) throw Error('Isolated test service URLs are required');

const db = new Client({ connectionString: DATABASE_URL });
const suffix = randomUUID();
const users = {};
const clients = [];
const resources = { vrSpace: {}, stream: {} };

async function connectToken(token, sender = false) {
  const socket = new WebSocket(`${mediaUrl}?token=${encodeURIComponent(token)}${sender ? '&sender' : ''}`);
  const pending = new Map();
  const eventWaiters = new Set();
  const events = [];
  let id = 0;
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (Array.isArray(message)) {
      const event = parseEvent(data);
      events.push(event);
      for (const waiter of eventWaiters) waiter(event);
    } else if (pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(Object.assign(Error(message.error.json.message), { code: message.error.json.data.code }));
      else resolve(message.result.data?.json);
    }
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const client = {
    call(method, path, input) {
      const requestId = ++id;
      return new Promise((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
        socket.send(JSON.stringify({ id: requestId, method, params: { path, input: { json: input ?? null } } }));
      });
    },
    event(predicate) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { eventWaiters.delete(waiter); reject(Error('Timed out waiting for event')); }, 5000);
        const waiter = event => {
          if (!predicate(event)) return;
          clearTimeout(timeout);
          eventWaiters.delete(waiter);
          resolve(event);
        };
        eventWaiters.add(waiter);
      });
    },
    events,
    close() { socket.close(); },
  };
  clients.push(client);
  return client;
}

async function createUser(name, role) {
  const username = `${name}-${suffix}`;
  const hash = await bcrypt.hash('access-test-password', 4);
  const { rows } = await db.query('INSERT INTO "Users" (username, password, role) VALUES ($1, $2, $3) RETURNING "userId"', [username, hash, role]);
  const response = await fetch(`${authUrl}/user/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: 'access-test-password' }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  const tokenResponse = await fetch(`${authUrl}/user/jwt`, { headers: { cookie } });
  assert.equal(tokenResponse.status, 200);
  const token = await tokenResponse.text();
  return { ...rows[0], token, ws: await connectToken(token) };
}

async function grant(user, type, targetId, level = 'view') {
  await db.query('INSERT INTO "Permissions" ("userId", "targetType", "targetId", "permissionLevel") VALUES ($1, $2, $3, $4)',
    [user.userId, type, targetId, level]);
}
const call = (user, method, path, input) => user.ws.call(method, path, input);
const mutate = (user, path, input) => call(user, 'mutation', path, input);
const query = (user, path, input) => call(user, 'query', path, input);
const denied = promise => assert.rejects(promise, error => error.code === 'FORBIDDEN');

before(async () => {
  await db.connect();
  for (const [name, role] of Object.entries({ owner: 'moderator', viewer: 'user', outsider: 'user', moderator: 'moderator', manager: 'moderator', sender: 'user', superadmin: 'superadmin' })) {
    users[name] = await createUser(name, role);
  }
  const guestResponse = await fetch(`${authUrl}/guest-jwt`);
  assert.equal(guestResponse.status, 200);
  users.guest = { ws: await connectToken(await guestResponse.text()) };
  users.sender.senderWs = await connectToken(users.sender.token, true);
  for (const visibility of ['public', 'unlisted', 'private']) {
    const vrSpace = await db.query('INSERT INTO "VrSpaces" (name, "ownerUserId", visibility) VALUES ($1, $2, $3) RETURNING "vrSpaceId"',
      [`access-vr-${visibility}-${suffix}`, users.owner.userId, visibility]);
    const stream = await db.query('INSERT INTO "Streams" (name, "ownerUserId", visibility) VALUES ($1, $2, $3) RETURNING "streamId"',
      [`access-stream-${visibility}-${suffix}`, users.owner.userId, visibility]);
    resources.vrSpace[visibility] = vrSpace.rows[0].vrSpaceId;
    resources.stream[visibility] = stream.rows[0].streamId;
  }
  const vrUnloaded = await db.query('INSERT INTO "VrSpaces" (name, "ownerUserId", visibility) VALUES ($1, $2, $3) RETURNING "vrSpaceId"',
    [`access-vr-unloaded-${suffix}`, users.owner.userId, 'private']);
  const streamUnloaded = await db.query('INSERT INTO "Streams" (name, "ownerUserId", visibility) VALUES ($1, $2, $3) RETURNING "streamId"',
    [`access-stream-unloaded-${suffix}`, users.owner.userId, 'private']);
  resources.vrSpace.unloaded = vrUnloaded.rows[0].vrSpaceId;
  resources.stream.unloaded = streamUnloaded.rows[0].streamId;
  for (const type of ['vrSpace', 'stream']) await grant(users.viewer, type, resources[type].private);
  await grant(users.moderator, 'stream', resources.stream.private);
  await grant(users.manager, 'stream', resources.stream.private, 'admin');
  await grant(users.sender, 'stream', resources.stream.private, 'edit');
});

after(async () => {
  for (const client of clients) client.close();
  await db.end();
});

test('public listings omit unlisted and private resources for guests', async () => {
  const spaces = await query(users.guest, 'vr.listAvailableVrSpaces');
  assert.ok(spaces.some(space => space.vrSpaceId === resources.vrSpace.public));
  assert.ok(!spaces.some(space => [resources.vrSpace.unlisted, resources.vrSpace.private].includes(space.vrSpaceId)));
  const streams = await query(users.guest, 'stream.listPublicStreams');
  assert.ok(streams.some(stream => stream.streamId === resources.stream.public));
  assert.ok(!streams.some(stream => [resources.stream.unlisted, resources.stream.private].includes(stream.streamId)));
});

test('guests can join public and unlisted spaces but not private spaces', async () => {
  for (const vrSpaceId of [resources.vrSpace.public, resources.vrSpace.unlisted]) {
    for (let attempt = 0; ; attempt++) {
      try { await mutate(users.guest, 'vr.enterVrSpace', { vrSpaceId }); break; }
      catch (error) { if (attempt >= 20 || !error.message.includes('no soup workers')) throw error; await new Promise(resolve => setTimeout(resolve, 250)); }
    }
  }
  await denied(mutate(users.guest, 'vr.enterVrSpace', { vrSpaceId: resources.vrSpace.unloaded }));
  await mutate(users.guest, 'vr.updateRealtimeData', { head: { active: false } });
});

test('private VR spaces allow owner, permitted users and superadmins, but not guests or outsiders', async () => {
  await denied(mutate(users.outsider, 'vr.enterVrSpace', { vrSpaceId: resources.vrSpace.unloaded }));
  for (const user of [users.owner, users.viewer, users.superadmin]) {
    const state = await mutate(user, 'vr.enterVrSpace', { vrSpaceId: resources.vrSpace.private });
    assert.equal(state.dbData.vrSpaceId, resources.vrSpace.private);
  }
  await denied(mutate(users.guest, 'vr.enterVrSpace', { vrSpaceId: resources.vrSpace.private }));
  await denied(mutate(users.outsider, 'vr.enterVrSpace', { vrSpaceId: resources.vrSpace.private }));
});

test('stream metadata, load and join follow visibility rules for loaded and unloaded streams', async () => {
  await denied(query(users.guest, 'stream.getStreamListInfo', { streamId: resources.stream.unloaded }));
  await denied(mutate(users.guest, 'stream.loadAndJoinStream', { streamId: resources.stream.unloaded }));
  for (const visibility of ['public', 'unlisted']) {
    assert.equal((await query(users.guest, 'stream.getStreamListInfo', { streamId: resources.stream[visibility] })).streamId, resources.stream[visibility]);
    assert.equal((await mutate(users.guest, 'stream.loadAndJoinStream', { streamId: resources.stream[visibility] })).streamId, resources.stream[visibility]);
  }
  await mutate(users.owner, 'stream.loadAndJoinStream', { streamId: resources.stream.private });
  for (const user of [users.guest, users.outsider]) {
    await denied(query(user, 'stream.getStreamListInfo', { streamId: resources.stream.private }));
    await denied(mutate(user, 'stream.loadAndJoinStream', { streamId: resources.stream.private }));
    await denied(mutate(user, 'stream.joinStream', { streamId: resources.stream.private }));
  }
  for (const user of [users.viewer, users.superadmin]) {
    assert.equal((await mutate(user, 'stream.joinStream', { streamId: resources.stream.private })).streamId, resources.stream.private);
  }
});

test('private streams apply the same access rules to sender connections', async () => {
  assert.equal((await users.sender.senderWs.call('mutation', 'stream.joinStream', { streamId: resources.stream.private })).streamId, resources.stream.private);
  const outsiderSender = await connectToken(users.outsider.token, true);
  await denied(outsiderSender.call('mutation', 'stream.joinStream', { streamId: resources.stream.private }));
});

test('admin-only stream state requires target administration rights', async () => {
  await mutate(users.moderator, 'stream.joinStream', { streamId: resources.stream.private });
  await denied(mutate(users.moderator, 'admin.loadStream', { streamId: resources.stream.private }));
  await denied(mutate(users.moderator, 'admin.loadAndJoinStream', { streamId: resources.stream.private }));
  await denied(mutate(users.moderator, 'admin.loadStream', { streamId: resources.stream.public }));
  assert.equal((await mutate(users.manager, 'admin.loadStream', { streamId: resources.stream.private })).adminOnlyVenueState.streamId, resources.stream.private);
  assert.equal((await mutate(users.owner, 'admin.loadStream', { streamId: resources.stream.private })).adminOnlyVenueState.streamId, resources.stream.private);
  assert.equal((await mutate(users.superadmin, 'admin.loadStream', { streamId: resources.stream.private })).adminOnlyVenueState.streamId, resources.stream.private);
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.ok(!users.moderator.ws.events.some(event => event.route === 'stream.streamStateUpdatedAdminOnly'));
});

test('revoked private permissions remove connected viewers and senders', async () => {
  const vrEvent = users.viewer.ws.event(event => event.route === 'vrSpace.vrSpaceWasUnloaded' && event.data.vrSpaceId === resources.vrSpace.private);
  await mutate(users.owner, 'user.removePermission', { userId: users.viewer.userId, targetType: 'vrSpace', targetId: resources.vrSpace.private });
  await vrEvent;
  await assert.rejects(mutate(users.viewer, 'vr.updateRealtimeData', { head: { active: false } }), error => error.code === 'PRECONDITION_FAILED');
  const streamEvent = users.sender.senderWs.event(event => event.route === 'stream.streamWasUnloaded' && event.data.streamId === resources.stream.private);
  await mutate(users.owner, 'user.removePermission', { userId: users.sender.userId, targetType: 'stream', targetId: resources.stream.private });
  await streamEvent;
  await assert.rejects(users.sender.senderWs.call('query', 'stream.getStreamState'), error => error.code === 'PRECONDITION_FAILED');
});

test('removing a grant does not evict a viewer from a public resource', async () => {
  await grant(users.viewer, 'vrSpace', resources.vrSpace.public);
  await mutate(users.viewer, 'vr.enterVrSpace', { vrSpaceId: resources.vrSpace.public });
  await mutate(users.owner, 'user.removePermission', { userId: users.viewer.userId, targetType: 'vrSpace', targetId: resources.vrSpace.public });
  await mutate(users.viewer, 'vr.updateRealtimeData', { head: { active: false } });
  await grant(users.viewer, 'stream', resources.stream.public);
  await mutate(users.viewer, 'stream.loadAndJoinStream', { streamId: resources.stream.public });
  await mutate(users.owner, 'user.removePermission', { userId: users.viewer.userId, targetType: 'stream', targetId: resources.stream.public });
  assert.equal((await query(users.viewer, 'stream.getStreamState')).streamId, resources.stream.public);
});

test('making public resources private removes unauthorized connected guests', async () => {
  await mutate(users.guest, 'vr.enterVrSpace', { vrSpaceId: resources.vrSpace.public });
  const vrEvent = users.guest.ws.event(event => event.route === 'vrSpace.vrSpaceWasUnloaded' && event.data.vrSpaceId === resources.vrSpace.public);
  await mutate(users.owner, 'vr.updateVrSpace', { vrSpaceId: resources.vrSpace.public, visibility: 'private' });
  await vrEvent;
  await denied(mutate(users.guest, 'vr.enterVrSpace', { vrSpaceId: resources.vrSpace.public }));

  await mutate(users.guest, 'stream.loadAndJoinStream', { streamId: resources.stream.public });
  await mutate(users.owner, 'admin.loadAndJoinStream', { streamId: resources.stream.public });
  const streamEvent = users.guest.ws.event(event => event.route === 'stream.streamWasUnloaded' && event.data.streamId === resources.stream.public);
  await mutate(users.owner, 'admin.updateStream', { visibility: 'private' });
  await streamEvent;
  await denied(mutate(users.guest, 'stream.joinStream', { streamId: resources.stream.public }));
});

test('private access uses current database grants and roles', async () => {
  await db.query('DELETE FROM "Permissions" WHERE "userId" = $1 AND "targetType" = $2 AND "targetId" = $3',
    [users.moderator.userId, 'stream', resources.stream.private]);
  await denied(mutate(users.moderator, 'stream.joinStream', { streamId: resources.stream.private }));
  await db.query('UPDATE "Users" SET role = $1 WHERE "userId" = $2', ['user', users.superadmin.userId]);
  await denied(mutate(users.superadmin, 'vr.enterVrSpace', { vrSpaceId: resources.vrSpace.private }));
  await denied(query(users.superadmin, 'stream.getStreamListInfo', { streamId: resources.stream.private }));
  const visible = await query(users.superadmin, 'vr.listAvailableVrSpaces');
  assert.ok(!visible.some(space => space.vrSpaceId === resources.vrSpace.private));
});

test('a join waits for a concurrent visibility change and rejects access to the private result', async () => {
  const { rows } = await db.query('INSERT INTO "Streams" (name, "ownerUserId", visibility) VALUES ($1, $2, $3) RETURNING "streamId"',
    [`access-race-${suffix}`, users.owner.userId, 'unlisted']);
  const streamId = rows[0].streamId;
  const updater = new Client({ connectionString: DATABASE_URL });
  await updater.connect();
  try {
    await updater.query('BEGIN');
    await updater.query('UPDATE "Streams" SET visibility = $1 WHERE "streamId" = $2', ['private', streamId]);
    let completed = false;
    const attempt = mutate(users.guest, 'stream.loadAndJoinStream', { streamId })
      .then(() => ({ ok: true }), error => ({ ok: false, error }))
      .finally(() => { completed = true; });
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.equal(completed, false, 'join should wait for the visibility update');
    await updater.query('COMMIT');
    const result = await attempt;
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'FORBIDDEN');
  } finally {
    await updater.query('ROLLBACK');
    await updater.end();
  }
});

test('concurrent cold joins do not exhaust the database pool', { timeout: 15000 }, async () => {
  const guests = [];
  const spaces = [];
  const streams = [];
  for (let i = 0; i < 12; i++) {
    const token = await (await fetch(`${authUrl}/guest-jwt`)).text();
    guests.push({ ws: await connectToken(token) });
    const vr = await db.query('INSERT INTO "VrSpaces" (name, "ownerUserId", visibility) VALUES ($1, $2, $3) RETURNING "vrSpaceId"',
      [`concurrent-vr-${i}-${suffix}`, users.owner.userId, 'public']);
    const stream = await db.query('INSERT INTO "Streams" (name, "ownerUserId", visibility) VALUES ($1, $2, $3) RETURNING "streamId"',
      [`concurrent-stream-${i}-${suffix}`, users.owner.userId, 'public']);
    spaces.push(vr.rows[0].vrSpaceId);
    streams.push(stream.rows[0].streamId);
  }
  await Promise.all(guests.map((guest, i) => mutate(guest, 'vr.enterVrSpace', { vrSpaceId: spaces[i] })));
  await Promise.all(guests.map((guest, i) => mutate(guest, 'stream.loadAndJoinStream', { streamId: streams[i] })));
});
