import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';
import { parse as parseEvent } from '../node_modules/devalue/index.js';

const require = createRequire('/app/backend/database/package.json');
const { Client } = require('pg');
const authUrl = process.env.AUTH_TEST_URL;
const mediaUrl = process.env.MEDIA_TEST_URL;
if (!authUrl || !mediaUrl || !process.env.DATABASE_URL) throw Error('Isolated test service URLs are required');

const suffix = randomUUID();
const users = {};
const clients = [];
const db = new Client({ connectionString: process.env.DATABASE_URL });
let godCookie;
let spaceA, spaceB, objectA, objectB;

async function login(username, password) {
  const response = await fetch(`${authUrl}/user/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  return cookie;
}

async function createUser(name, role = 'user') {
  const username = `${name}-${suffix}`;
  const response = await fetch(`${authUrl}/user/create`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: godCookie },
    body: JSON.stringify({ username, password: 'test-password', role }),
  });
  assert.equal(response.status, 201);
  const [account] = await response.json();
  const cookie = await login(username, 'test-password');
  const jwtResponse = await fetch(`${authUrl}/user/jwt`, { headers: { cookie } });
  assert.equal(jwtResponse.status, 200);
  const ws = await connect(await jwtResponse.text());
  clients.push(ws);
  return { ...account, ws };
}

async function connect(token) {
  const socket = new WebSocket(`${mediaUrl}?token=${encodeURIComponent(token)}`);
  const pending = new Map();
  const eventWaiters = new Set();
  let nextId = 0;
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (Array.isArray(message)) {
      const event = parseEvent(data);
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
  return {
    call(method, path, input) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params: { path, input: { json: input ?? null } } }));
      });
    },
    event(predicate) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { eventWaiters.delete(waiter); reject(Error('Timed out waiting for VR-space event')); }, 5000);
        const waiter = event => {
          if (!predicate(event)) return;
          clearTimeout(timeout);
          eventWaiters.delete(waiter);
          resolve(event);
        };
        eventWaiters.add(waiter);
      });
    },
    close() { socket.close(); },
  };
}

const mutate = (user, path, input) => user.ws.call('mutation', path, input);
const query = (user, path, input) => user.ws.call('query', path, input);
const objectData = vrSpaceId => ({
  vrSpaceId, type: 'ambientLight', objectId: randomUUID(),
  position: [0, 0, 0], orientation: [0, 0, 0, 1], scale: [1, 1, 1],
});
const forbidden = promise => assert.rejects(promise, error => error.code === 'FORBIDDEN');

before(async () => {
  await db.connect();
  godCookie = await login('överchefen', 'test-god-password');
  for (const name of ['ownerA', 'ownerB', 'editor', 'admin', 'viewer', 'outsider']) users[name] = await createUser(name);
  users.superadmin = await createUser('superadmin', 'superadmin');
  spaceA = await mutate(users.ownerA, 'vr.createVrSpace', { name: `A-${suffix}` });
  spaceB = await mutate(users.ownerB, 'vr.createVrSpace', { name: `B-${suffix}` });
  for (const [name, level] of [['editor', 'edit'], ['admin', 'admin'], ['viewer', 'view']]) {
    await db.query('INSERT INTO "Permissions" ("userId", "targetType", "targetId", "permissionLevel") VALUES ($1, $2, $3, $4)',
      [users[name].userId, 'vrSpace', spaceB, level]);
  }
  objectA = await mutate(users.ownerA, 'vr.upsertPlacedObject', objectData(spaceA));
  objectB = await mutate(users.ownerB, 'vr.upsertPlacedObject', objectData(spaceB));
  // Wait for the mediasoup worker pool to initialize before entering a space.
  for (let attempt = 0; ; attempt++) {
    try { await mutate(users.ownerA, 'vr.enterVrSpace', { vrSpaceId: spaceA }); break; }
    catch (error) { if (attempt >= 20 || !error.message.includes('no soup workers')) throw error; await new Promise(resolve => setTimeout(resolve, 250)); }
  }
});

after(async () => {
  for (const client of clients) client.close();
  await db.end();
});

test('rejects modifications to another space despite rights in the current space', async () => {
  await forbidden(mutate(users.ownerA, 'vr.updateVrSpace', { vrSpaceId: spaceB, name: 'unauthorized' }));
  await forbidden(mutate(users.ownerA, 'vr.deleteVrSpace', { vrSpaceId: spaceB }));
  await forbidden(mutate(users.ownerA, 'vr.upsertPlacedObject', objectData(spaceB)));
  await forbidden(mutate(users.ownerA, 'vr.removePlacedObject', { placedObjectId: objectB.placedObjectId }));
  const { rows } = await db.query('SELECT name FROM "VrSpaces" WHERE "vrSpaceId" = $1', [spaceB]);
  assert.equal(rows[0].name, `B-${suffix}`);
});

test('supports owner and editor mutations on unloaded spaces without entering them', async () => {
  await mutate(users.ownerB, 'vr.updateVrSpace', { vrSpaceId: spaceB, name: `owner-${suffix}` });
  await mutate(users.editor, 'vr.updateVrSpace', { vrSpaceId: spaceB, name: `editor-${suffix}` });
  const created = await mutate(users.editor, 'vr.upsertPlacedObject', objectData(spaceB));
  assert.equal(created.vrSpaceId, spaceB);
  await mutate(users.editor, 'vr.removePlacedObject', { placedObjectId: created.placedObjectId });
  const { rows } = await db.query('SELECT name FROM "VrSpaces" WHERE "vrSpaceId" = $1', [spaceB]);
  assert.equal(rows[0].name, `editor-${suffix}`);
});

test('rejects view-only or absent permissions and requires admin to delete', async () => {
  for (const user of [users.viewer, users.outsider]) {
    await forbidden(mutate(user, 'vr.updateVrSpace', { vrSpaceId: spaceB, name: 'unauthorized' }));
    await forbidden(mutate(user, 'vr.removePlacedObject', { placedObjectId: objectB.placedObjectId }));
  }
  await forbidden(mutate(users.editor, 'vr.deleteVrSpace', { vrSpaceId: spaceB }));
});

test('checks both source and destination before moving an existing object', async () => {
  await forbidden(mutate(users.ownerA, 'vr.upsertPlacedObject', { ...objectData(spaceA), placedObjectId: objectB.placedObjectId }));
  await forbidden(mutate(users.ownerA, 'vr.upsertPlacedObject', { ...objectData(spaceB), placedObjectId: objectA.placedObjectId }));
  const { rows } = await db.query('SELECT "placedObjectId", "vrSpaceId" FROM "PlacedObjects" WHERE "placedObjectId" = ANY($1::uuid[])', [[objectA.placedObjectId, objectB.placedObjectId]]);
  assert.equal(rows.find(row => row.placedObjectId === objectA.placedObjectId).vrSpaceId, spaceA);
  assert.equal(rows.find(row => row.placedObjectId === objectB.placedObjectId).vrSpaceId, spaceB);
});

test('does not overwrite an object concurrently inserted in another space', async () => {
  const placedObjectId = randomUUID();
  const creator = new Client({ connectionString: process.env.DATABASE_URL });
  await creator.connect();
  try {
    await creator.query('BEGIN');
    await creator.query('INSERT INTO "PlacedObjects" ("placedObjectId", "vrSpaceId", "type", "objectId", "position") VALUES ($1, $2, $3, $4, $5)',
      [placedObjectId, spaceB, 'ambientLight', randomUUID(), [0, 0, 0]]);
    let completed = false;
    const attempt = mutate(users.ownerA, 'vr.upsertPlacedObject', { ...objectData(spaceA), placedObjectId })
      .then(() => ({ ok: true }), error => ({ ok: false, error }))
      .finally(() => { completed = true; });
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.equal(completed, false, 'the upsert should wait for the competing insert');
    await creator.query('COMMIT');
    const result = await attempt;
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'FORBIDDEN');
    const { rows } = await db.query('SELECT "vrSpaceId" FROM "PlacedObjects" WHERE "placedObjectId" = $1', [placedObjectId]);
    assert.equal(rows[0].vrSpaceId, spaceB);
  } finally {
    await creator.query('ROLLBACK');
    await creator.end();
  }
});

test('refreshes a loaded space when an authorized user edits it without entering', async () => {
  const event = users.ownerA.ws.event(event => event.route === 'vrSpace.vrSpaceStateUpdated' && event.data.data.dbData.name === `super-${suffix}`);
  await mutate(users.superadmin, 'vr.updateVrSpace', { vrSpaceId: spaceA, name: `super-${suffix}` });
  await event;
});

test('allows a move with edit rights to both spaces and refreshes both loaded spaces', async () => {
  await db.query('INSERT INTO "Permissions" ("userId", "targetType", "targetId", "permissionLevel") VALUES ($1, $2, $3, $4)',
    [users.editor.userId, 'vrSpace', spaceA, 'edit']);
  await mutate(users.ownerB, 'vr.enterVrSpace', { vrSpaceId: spaceB });
  const fromEvent = users.ownerA.ws.event(event => event.route === 'vrSpace.vrSpaceStateUpdated' && !event.data.data.dbData.placedObjects.some(item => item.placedObjectId === objectA.placedObjectId));
  const toEvent = users.ownerB.ws.event(event => event.route === 'vrSpace.vrSpaceStateUpdated' && event.data.data.dbData.placedObjects.some(item => item.placedObjectId === objectA.placedObjectId));
  const moved = await mutate(users.editor, 'vr.upsertPlacedObject', { ...objectData(spaceB), placedObjectId: objectA.placedObjectId });
  assert.equal(moved.vrSpaceId, spaceB);
  await Promise.all([fromEvent, toEvent]);
});

test('admin and superadmin can delete authorized unloaded spaces', async () => {
  const adminSpace = await mutate(users.ownerB, 'vr.createVrSpace', { name: `admin-delete-${suffix}` });
  await db.query('INSERT INTO "Permissions" ("userId", "targetType", "targetId", "permissionLevel") VALUES ($1, $2, $3, $4)',
    [users.admin.userId, 'vrSpace', adminSpace, 'admin']);
  assert.equal((await mutate(users.admin, 'vr.deleteVrSpace', { vrSpaceId: adminSpace })).vrSpaceId, adminSpace);
  const superSpace = await mutate(users.ownerB, 'vr.createVrSpace', { name: `super-delete-${suffix}` });
  assert.equal((await mutate(users.superadmin, 'vr.deleteVrSpace', { vrSpaceId: superSpace })).vrSpaceId, superSpace);
});

test('notifies clients when an authorized user deletes a loaded space', async () => {
  const loadedSpace = await mutate(users.ownerB, 'vr.createVrSpace', { name: `loaded-delete-${suffix}` });
  await mutate(users.ownerB, 'vr.enterVrSpace', { vrSpaceId: loadedSpace });
  const event = users.ownerB.ws.event(event => event.route === 'vrSpace.vrSpaceWasUnloaded' && event.data.vrSpaceId === loadedSpace);
  assert.equal((await mutate(users.superadmin, 'vr.deleteVrSpace', { vrSpaceId: loadedSpace })).vrSpaceId, loadedSpace);
  await event;
  const { rows } = await db.query('SELECT 1 FROM "VrSpaces" WHERE "vrSpaceId" = $1', [loadedSpace]);
  assert.equal(rows.length, 0);
});

test('deleting a space cleans up permissions and refreshes loaded spaces containing portals to it', async () => {
  const target = await mutate(users.ownerB, 'vr.createVrSpace', { name: `portal-target-${suffix}` });
  await db.query('INSERT INTO "Permissions" ("userId", "targetType", "targetId", "permissionLevel") VALUES ($1, $2, $3, $4)',
    [users.viewer.userId, 'vrSpace', target, 'view']);
  const portal = await mutate(users.ownerA, 'vr.upsertPlacedObject', { ...objectData(spaceA), type: 'vrPortal', objectId: target });
  const event = users.ownerA.ws.event(event => event.route === 'vrSpace.vrSpaceStateUpdated' && !event.data.data.dbData.placedObjects.some(item => item.placedObjectId === portal.placedObjectId));
  await mutate(users.superadmin, 'vr.deleteVrSpace', { vrSpaceId: target });
  await event;
  const permissions = await db.query('SELECT 1 FROM "Permissions" WHERE "targetType" = $1 AND "targetId" = $2', ['vrSpace', target]);
  const portals = await db.query('SELECT 1 FROM "PlacedObjects" WHERE "placedObjectId" = $1', [portal.placedObjectId]);
  assert.equal(permissions.rows.length, 0);
  assert.equal(portals.rows.length, 0);
});

test('uses current database permissions rather than a loaded space snapshot', async () => {
  await db.query('DELETE FROM "Permissions" WHERE "userId" = $1 AND "targetType" = $2 AND "targetId" = $3', [users.editor.userId, 'vrSpace', spaceB]);
  await forbidden(mutate(users.editor, 'vr.updateVrSpace', { vrSpaceId: spaceB, name: 'after-revocation' }));
  assert.equal((await query(users.ownerB, 'vr.listAvailableVrSpaces')).some(space => space.vrSpaceId === spaceB), true);
});

test('does not authorize an update against a permission being revoked concurrently', async () => {
  await db.query('INSERT INTO "Permissions" ("userId", "targetType", "targetId", "permissionLevel") VALUES ($1, $2, $3, $4)',
    [users.editor.userId, 'vrSpace', spaceB, 'edit']);
  const revoker = new Client({ connectionString: process.env.DATABASE_URL });
  await revoker.connect();
  try {
    await revoker.query('BEGIN');
    await revoker.query('UPDATE "Permissions" SET "permissionLevel" = $1 WHERE "userId" = $2 AND "targetType" = $3 AND "targetId" = $4',
      ['view', users.editor.userId, 'vrSpace', spaceB]);
    let completed = false;
    const attempt = mutate(users.editor, 'vr.updateVrSpace', { vrSpaceId: spaceB, name: 'racing-update' })
      .then(() => ({ ok: true }), error => ({ ok: false, error }))
      .finally(() => { completed = true; });
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.equal(completed, false, 'the update should wait for the concurrent permission change');
    await revoker.query('COMMIT');
    const result = await attempt;
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'FORBIDDEN');
    const { rows } = await db.query('SELECT name FROM "VrSpaces" WHERE "vrSpaceId" = $1', [spaceB]);
    assert.equal(rows[0].name, `editor-${suffix}`);
  } finally {
    await revoker.query('ROLLBACK');
    await revoker.end();
  }
});

test('uses the caller current database role for superadmin access', async () => {
  await db.query('UPDATE "Users" SET role = $1 WHERE "userId" = $2', ['user', users.superadmin.userId]);
  await forbidden(mutate(users.superadmin, 'vr.updateVrSpace', { vrSpaceId: spaceA, name: 'after-demotion' }));
  const { rows } = await db.query('SELECT name FROM "VrSpaces" WHERE "vrSpaceId" = $1', [spaceA]);
  assert.equal(rows[0].name, `super-${suffix}`);
});
