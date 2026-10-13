import assert from 'node:assert/strict';
import process from 'node:process';
import test from 'node:test';
import { parsePrompt } from '../server/lib/llm.js';

test('returns parsed provider response', async (t) => {
  const previousKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'test-key';
  t.after(() => {
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
  });
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: '{"domain":"unsupported"}' } }] }),
  }));
  assert.deepEqual(await parsePrompt('a prompt'), { domain: 'unsupported' });
});

test('hides provider failure from the client', async (t) => {
  const previousKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'test-key';
  t.after(() => {
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
  });
  t.mock.method(globalThis.console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: false,
    status: 404,
    json: async () => ({ error: { message: 'private provider detail' } }),
  }));
  await assert.rejects(parsePrompt('a prompt'), {
    status: 502,
    message: 'Prompt parsing is unavailable right now. Try again later.',
  });
});
