import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { URL } from 'node:url';

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

test('push handles malformed payloads and keeps notification navigation on origin', async () => {
  const handlers = {};
  let shown;
  let opened;
  let focused = false;
  const origin = 'https://trigger.example';
  runInNewContext(source, {
    URL,
    self: {
      location: { origin },
      addEventListener: (type, handler) => {
        handlers[type] = handler;
      },
      registration: {
        showNotification: async (title, options) => {
          shown = { title, ...options };
        },
      },
    },
    clients: {
      matchAll: async () => [
        {
          url: `${origin}/triggers/one?view=history#latest`,
          focus: async () => {
            focused = true;
          },
        },
      ],
      openWindow: async (url) => {
        opened = url;
      },
    },
  });
  let pending;
  const waitUntil = (promise) => {
    pending = promise;
  };
  for (const url of ['https://evil.example/path', 'https://[', '//evil.example']) {
    handlers.push({ data: { json: () => ({ title: 'Alert', url }) }, waitUntil });
    await pending;
    assert.equal(shown.url, undefined);
    assert.equal(shown.data.url, '/');
    assert.equal(shown.title, 'Alert');
  }
  handlers.push({
    data: {
      json: () => {
        throw new Error('invalid JSON');
      },
      text: () => 'Plain text alert',
    },
    waitUntil,
  });
  await pending;
  assert.equal(shown.body, 'Plain text alert');
  handlers.push({
    data: { json: () => ({ url: '/triggers/one?view=history#latest' }) },
    waitUntil,
  });
  await pending;
  assert.equal(shown.data.url, '/triggers/one?view=history#latest');
  handlers.notificationclick({ notification: { data: shown.data, close() {} }, waitUntil });
  await pending;
  assert.equal(focused, true);
  assert.equal(opened, undefined);
  handlers.notificationclick({
    notification: { data: { url: 'https://evil.example' }, close() {} },
    waitUntil,
  });
  await pending;
  assert.equal(opened, '/');
});
