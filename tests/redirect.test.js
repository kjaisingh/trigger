import assert from 'node:assert/strict';
import test from 'node:test';
import { safeReturnPath } from '../src/lib/redirect.js';

test('sign-in preserves internal paths, query strings and fragments', () => {
  for (const path of ['/triggers/abc', '/create?prompt=rain%20in%20Boston#review']) {
    assert.equal(safeReturnPath(path), path);
  }
});

test('sign-in rejects external redirects and authentication loops', () => {
  for (const path of [
    null,
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/auth',
    '/auth?next=/auth',
    '/\nevil.test',
  ]) {
    assert.equal(safeReturnPath(path), '/dashboard');
  }
});
