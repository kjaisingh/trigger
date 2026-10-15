import assert from 'node:assert/strict';
import test from 'node:test';
import { databaseReady } from '../server/lib/readiness.js';

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
