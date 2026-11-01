import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

for (const config of ['Caddyfile', 'Caddyfile.docker']) {
  test(`${config} redacts credentials while forwarding requests unchanged`, { timeout: 60000 }, async () => {
    const name = `samvr-caddy-log-test-${randomUUID()}`;
    let proxy;
    let upstream;
    try {
      proxy = docker('run', '-d', '--name', name,
        '-p', '127.0.0.1::8080',
        '--add-host', 'auth:127.0.0.1', '--add-host', 'fileserver:127.0.0.1', '--add-host', 'host.docker.internal:127.0.0.1',
        '--mount', `type=bind,src=${path.join(root, config)},dst=/etc/caddy/Caddyfile,readonly`,
        '--mount', `type=bind,src=${path.join(root, 'Caddyfile.log-filter')},dst=/etc/caddy/Caddyfile.log-filter,readonly`,
        '-e', 'EXPOSED_SERVER_URL=http://:8080',
        '-e', 'EXPOSED_AUTH_PATH=/auth', '-e', 'EXPOSED_MEDIASOUP_PATH=/socket', '-e', 'EXPOSED_FILESERVER_PATH=/files',
        '-e', 'EXPOSED_AUTH_PORT=19000', '-e', 'EXPOSED_MEDIASOUP_PORT=19000', '-e', 'EXPOSED_FILESERVER_PORT=9',
        'caddy:2', 'caddy', 'run', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile');
      upstream = docker('run', '-d', '--network', `container:${proxy}`, '--entrypoint', 'node', 'node:24-trixie-slim',
        '-e', "require('node:http').createServer((req,res)=>res.end(JSON.stringify({url:req.url,referer:req.headers.referer}))).listen(19000,'127.0.0.1')");
      const port = Number(docker('port', proxy, '8080/tcp').match(/:(\d+)$/)?.[1]);
      assert.ok(port, 'Caddy must have a published test port');
      const base = `http://127.0.0.1:${port}`;
      let ready = false;
      for (let i = 0; i < 100; i++) {
        try {
          const response = await fetch(`${base}/auth/ready`, { signal: AbortSignal.timeout(1000) });
          if (response.ok) { ready = true; break; }
        } catch {}
        await delay(100);
      }
      assert.ok(ready, 'Caddy and upstream must start');

      const referer = 'https://example.test/view?token=referer-secret';
      const socket = await fetch(`${base}/socket?token=websocket-secret&sender&keep=visible`, {
        headers: { referer, authorization: 'Bearer header-secret', cookie: 'session=cookie-secret' },
      });
      assert.equal(socket.status, 200);
      const forwarded = await socket.json();
      assert.equal(forwarded.url, '/?token=websocket-secret&sender&keep=visible');
      assert.equal(forwarded.referer, referer);

      const auth = await fetch(`${base}/auth/guest-jwt?prevToken=guest-secret&keep=visible`);
      assert.equal(auth.status, 200);
      assert.equal((await auth.json()).url, '/guest-jwt?prevToken=guest-secret&keep=visible');

      const encoded = await fetch(`${base}/auth/guest-jwt?%74oken=encoded-secret&token=second-secret`);
      assert.equal(encoded.status, 200);
      const combined = await fetch(`${base}/auth/guest-jwt?token=combined-secret&prevToken=combined-guest-secret`);
      assert.equal(combined.status, 200);
      const failed = await fetch(`${base}/files/failure?token=error-secret`);
      assert.equal(failed.status, 502);

      const output = spawnSync('docker', ['logs', proxy], { encoding: 'utf8' });
      assert.equal(output.status, 0, 'must be able to read Caddy logs');
      const logs = output.stdout + output.stderr;
      for (const secret of ['websocket-secret', 'referer-secret', 'header-secret', 'cookie-secret', 'guest-secret', 'encoded-secret', 'second-secret', 'combined-secret', 'combined-guest-secret', 'error-secret']) {
        assert.ok(!logs.includes(secret), `Caddy logs must not contain ${secret}`);
      }
      const entries = logs.split('\n').map(line => { try { return JSON.parse(line); } catch { return undefined; } }).filter(Boolean);
      const access = entries.filter(entry => entry.logger?.startsWith('http.log.access'));
      assert.ok(access.some(entry => entry.request?.uri?.includes('/socket') && entry.request.uri.includes('token=REDACTED') && entry.request.uri.includes('keep=visible')));
      assert.ok(access.some(entry => entry.request?.uri?.includes('/auth/guest-jwt') && entry.request.uri.includes('prevToken=REDACTED')));
      assert.ok(access.some(entry => entry.request?.uri?.includes('/files/failure') && entry.request.uri.includes('token=REDACTED')));
      assert.ok(entries.some(entry => entry.logger?.startsWith('http.log.error') && entry.request?.uri?.includes('token=REDACTED')),
        'runtime error logs must also redact tokens');
    } finally {
      for (const id of [upstream, proxy]) {
        if (id) {
          try { docker('rm', '-f', id); } catch {}
        }
      }
    }
  });
}
