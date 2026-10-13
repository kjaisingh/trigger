import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchWithRetry } from '../server/lib/http.js';

test('retries transient HTTP errors and returns the successful response', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return { status: calls === 1 ? 429 : 200 };
  });
  const response = await fetchWithRetry('https://example.test', {}, { backoffMs: 0 });
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
});

test('passes a timeout signal to fetch', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.ok(options.signal instanceof globalThis.AbortSignal);
    return { status: 200 };
  });
  await fetchWithRetry('https://example.test', {}, { retries: 0, timeoutMs: 100 });
});
