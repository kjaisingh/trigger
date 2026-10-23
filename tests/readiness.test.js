import assert from 'node:assert/strict';
import test from 'node:test';
import { databaseReady, schedulerReady } from '../server/lib/readiness.js';

function client(result) {
  return {
    from(table) {
      assert.equal(table, 'triggers');
      return {
        select(column) {
          assert.equal(column, 'id');
          return {
            limit(count) {
              assert.equal(count, 1);
              return {
                abortSignal(signal) {
                  assert.ok(signal instanceof globalThis.AbortSignal);
                  return result;
                },
              };
            },
          };
        },
      };
    },
  };
}

test('database readiness accepts a successful bounded query', async () => {
  assert.equal(await databaseReady(client(Promise.resolve({ error: null }))), true);
});

test('scheduler readiness requires a recent completed invocation', async () => {
  const now = Date.now();
  const status = (data, error = null) => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => ({ abortSignal: async () => ({ data, error }) }) }),
      }),
    }),
  });
  assert.equal(
    await schedulerReady(status({ completed_at: new Date(now - 60_000).toISOString() }), now),
    true,
  );
  assert.equal(
    await schedulerReady(status({ completed_at: new Date(now - 31 * 60_000).toISOString() }), now),
    false,
  );
  assert.equal(await schedulerReady(status(null), now), false);
  assert.equal(await schedulerReady(status(null, { message: 'offline' }), now), false);
});

test('database readiness rejects a database error or network failure', async () => {
  assert.equal(
    await databaseReady(client(Promise.resolve({ error: new Error('offline') }))),
    false,
  );
  assert.equal(await databaseReady(client(Promise.reject(new Error('offline')))), false);
});

test('database readiness times out', async () => {
  const hanging = {
    from: () => ({
      select: () => ({
        limit: () => ({
          abortSignal: (signal) =>
            new Promise((resolve) => {
              signal.addEventListener('abort', () => resolve({ error: new Error('timeout') }), {
                once: true,
              });
            }),
        }),
      }),
    }),
  };
  const keepAlive = globalThis.setTimeout(() => {}, 100);
  try {
    assert.equal(await databaseReady(hanging, 5), false);
  } finally {
    globalThis.clearTimeout(keepAlive);
  }
});
