import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { once } from 'node:events';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createPinia, setActivePinia } from 'pinia';
import { createServer as createViteServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
let server, vite, useAuthStore;
let jwtStatus = 403;
let jwtDelay = 0;
let logoutDelay = 0;
let loginDelay = 0;
let jwtLifetime = 60;
let requests = [];
const originalEnv = {};

function token(role, username) {
  const part = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ userId: 'test-user', username, role, exp: Math.floor(Date.now() / 1000) + jwtLifetime })}.signature`;
}

before(async () => {
  server = createHttpServer(async (req, res) => {
    requests.push(`${req.method} ${req.url}`);
    if (req.url === '/user/jwt') {
      if (jwtDelay) await new Promise(resolve => setTimeout(resolve, jwtDelay));
      res.writeHead(jwtStatus, { 'content-type': 'text/plain' });
      res.end(jwtStatus === 200 ? token('admin', 'test-admin') : 'not logged in');
    } else if (req.url?.startsWith('/guest-jwt')) {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end(token('guest', 'test-guest'));
    } else if (req.url === '/user/logout') {
      if (logoutDelay) await new Promise(resolve => setTimeout(resolve, logoutDelay));
      requests.push('logout completed');
      res.writeHead(200).end();
    } else if (req.url === '/user/login') {
      if (loginDelay) await new Promise(resolve => setTimeout(resolve, loginDelay));
      requests.push('login completed');
      res.writeHead(200).end();
    } else {
      res.writeHead(404).end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  for (const [key, value] of Object.entries({
    EXPOSED_LOCAL: 'true', EXPOSED_SERVER_URL: '127.0.0.1', EXPOSED_AUTH_PORT: String(server.address().port),
  })) {
    originalEnv[key] = process.env[key];
    process.env[key] = value;
  }
  globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  vite = await createViteServer({
    root,
    configFile: false,
    envDir: path.resolve(root, '..'),
    envPrefix: 'EXPOSED_',
    resolve: { alias: { '@': path.join(root, 'src') } },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
    appType: 'custom',
    ssr: { noExternal: ['schemas', 'database'] },
    logLevel: 'error',
  });
  ({ useAuthStore } = await vite.ssrLoadModule('/src/stores/authStore.ts'));
});

after(async () => {
  await vite?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  delete globalThis.localStorage;
});

function freshStore() {
  setActivePinia(createPinia());
  requests = [];
  jwtStatus = 403;
  jwtDelay = 0;
  logoutDelay = 0;
  loginDelay = 0;
  jwtLifetime = 60;
  return useAuthStore();
}

test('no session is checked once and can fall back to a guest', async () => {
  const store = freshStore();
  store.persistedUsername = 'remembered-guest';
  assert.equal(await store.restoreFromSession(), false);
  assert.equal(await store.restoreFromSession(), false);
  assert.equal(requests.filter(value => value === 'GET /user/jwt').length, 1);
  await store.autoGuest(store.persistedUsername);
  assert.equal(store.role, 'guest');
  assert.equal(store.username, 'test-guest');
  await store.logout();
});

test('restores a logged-in session without access to document.cookie', async () => {
  const store = freshStore();
  jwtStatus = 200;
  assert.equal(typeof globalThis.document, 'undefined');
  assert.equal(await store.restoreFromSession(), true);
  assert.equal(store.isNotGuest, true);
  assert.equal(store.username, 'test-admin');
  await store.logout();
  assert.equal(store.isAuthenticated, false);
});

test('concurrent restoration attempts share a single request', async () => {
  const store = freshStore();
  jwtStatus = 200;
  jwtDelay = 50;
  assert.deepEqual(await Promise.all([store.restoreFromSession(), store.restoreFromSession()]), [true, true]);
  assert.equal(requests.filter(value => value === 'GET /user/jwt').length, 1);
  await store.logout();
});

test('server errors are not treated as a missing session and can be retried', async () => {
  const store = freshStore();
  jwtStatus = 503;
  await assert.rejects(store.restoreFromSession());
  assert.equal(store.isAuthenticated, false);
  jwtStatus = 200;
  assert.equal(await store.restoreFromSession(), true);
  assert.equal(requests.filter(value => value === 'GET /user/jwt').length, 2);
  await store.logout();
});

test('an expired session stops refresh and clears the logged-in state', async () => {
  const store = freshStore();
  jwtStatus = 200;
  jwtLifetime = 1;
  assert.equal(await store.restoreFromSession(), true);
  jwtStatus = 403;
  await new Promise(resolve => setTimeout(resolve, 1600));
  assert.equal(store.isAuthenticated, false);
  assert.equal(requests.filter(value => value === 'GET /user/jwt').length, 2);
  await store.logout();
});

test('logout cancels an in-flight restoration', async () => {
  const store = freshStore();
  jwtStatus = 200;
  jwtDelay = 100;
  const restoring = store.restoreFromSession();
  await new Promise(resolve => setTimeout(resolve, 20));
  await store.logout();
  assert.equal(await restoring, false);
  assert.equal(store.isAuthenticated, false);
});

test('login waits for an in-flight logout before creating a session', async () => {
  const store = freshStore();
  jwtStatus = 200;
  logoutDelay = 75;
  const logout = store.logout();
  const login = store.login('test-admin', 'test-password');
  await Promise.all([logout, login]);
  assert.ok(requests.indexOf('logout completed') < requests.indexOf('POST /user/login'));
  assert.equal(store.isNotGuest, true);
  logoutDelay = 0;
  await store.logout();
});

test('guest continuation waits for an in-flight logout', async () => {
  const store = freshStore();
  logoutDelay = 75;
  const logout = store.logout();
  const guest = store.autoGuest('guest');
  await Promise.all([logout, guest]);
  assert.ok(requests.indexOf('logout completed') < requests.findIndex(value => value.startsWith('GET /guest-jwt')));
  assert.equal(store.role, 'guest');
  logoutDelay = 0;
  await store.logout();
});

test('logout during login waits for the session cookie and prevents token restoration', async () => {
  const store = freshStore();
  jwtStatus = 200;
  loginDelay = 75;
  const login = store.login('test-admin', 'test-password');
  await new Promise(resolve => setTimeout(resolve, 20));
  const logout = store.logout();
  assert.equal(store.isAuthenticated, false);
  await Promise.all([login, logout]);
  assert.ok(requests.indexOf('login completed') < requests.indexOf('GET /user/logout'));
  assert.equal(requests.includes('GET /user/jwt'), false);
  assert.equal(store.isAuthenticated, false);
});
