import assert from 'node:assert/strict';
import { test } from 'node:test';

for (const [name, baseUrl, secure] of [
  ['local development', process.env.AUTH_TEST_URL, false],
  ['production', process.env.AUTH_TEST_PROD_URL, true],
]) {
  if (!baseUrl) throw new Error('Isolated auth test service URLs are required');

  test(`${name}: HttpOnly session supports restoration and logout`, async () => {
    const origin = secure ? 'https://example.test' : 'http://localhost:5173';
    const headers = { 'content-type': 'application/json', 'x-forwarded-proto': 'https', origin };
    const login = await fetch(`${baseUrl}/user/login`, {
      method: 'POST', headers,
      body: JSON.stringify({ username: 'överchefen', password: 'test-god-password' }),
    });
    assert.equal(login.status, 200);
    assert.equal(login.headers.get('access-control-allow-origin'), origin);
    assert.equal(login.headers.get('access-control-allow-credentials'), 'true');
    const setCookie = login.headers.get('set-cookie');
    assert.ok(setCookie);
    assert.match(setCookie, /(?:^|;)\s*HttpOnly(?:;|$)/i);
    assert.equal(/(?:^|;)\s*Secure(?:;|$)/i.test(setCookie), secure);
    const cookie = setCookie.split(';')[0];

    assert.equal((await fetch(`${baseUrl}/user/jwt`)).status, 403);
    const restored = await fetch(`${baseUrl}/user/jwt`, { headers: { cookie } });
    assert.equal(restored.status, 200);
    assert.equal((await restored.text()).split('.').length, 3);
    const me = await fetch(`${baseUrl}/user/me`, { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).username, 'överchefen');

    const logout = await fetch(`${baseUrl}/user/logout`, { headers: { cookie } });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get('set-cookie') ?? '', /expires=Thu, 01 Jan 1970/i);
    assert.equal((await fetch(`${baseUrl}/user/jwt`, { headers: { cookie } })).status, 403);
    assert.equal((await fetch(`${baseUrl}/user/jwt`, { headers: { cookie: 'invalid-session=invalid' } })).status, 403);
  });
}
