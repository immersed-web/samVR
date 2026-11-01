import assert from 'node:assert/strict';
import { test } from 'node:test';
import { maxFileSize, resolveMaxUploadBytes } from 'schemas';

test('uses the shared 50 MiB default when the setting is absent', () => {
  assert.equal(resolveMaxUploadBytes(undefined), maxFileSize);
  assert.equal(resolveMaxUploadBytes(''), maxFileSize);
});

test('accepts a configured positive byte limit', () => {
  assert.equal(resolveMaxUploadBytes('1024'), 1024);
  assert.equal(resolveMaxUploadBytes('104857600'), 100 * 1024 * 1024);
});

test('rejects invalid or unsafe byte limits consistently', () => {
  for (const value of ['0', '-1', '1.5', '1e3', 'abc', ' 1024', String(Number.MAX_SAFE_INTEGER)]) {
    assert.throws(() => resolveMaxUploadBytes(value), /EXPOSED_MAX_UPLOAD_BYTES/);
  }
});
