import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import process from 'node:process';
import { URL } from 'node:url';
import express from 'express';

process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
const { default: routes } = await import('../server/routes/triggers.js');

test('trigger API enforces ownership, immutable states, and concurrent status changes', async (t) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'owner' };
    next();
  });
  app.use('/api/triggers', routes);
  app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(500).json({ message: error.message });
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const realFetch = globalThis.fetch;
  let current = { status: 'active', domain: 'crypto' };
  let race = false;
  let writes = 0;
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(input);
    if (url.hostname !== 'test.supabase.co') return realFetch(input, options);
    assert.equal(url.searchParams.get('user_id'), 'eq.owner');
    if (options.method === 'PATCH') {
      writes += 1;
      assert.equal(url.searchParams.get('status'), `eq.${current.status}`);
      return globalThis.Response.json(race ? null : { ...current, ...JSON.parse(options.body) });
    }
    return current
      ? globalThis.Response.json(current)
      : globalThis.Response.json({ code: 'PGRST116', message: 'missing' }, { status: 406 });
  });
  const url = `http://127.0.0.1:${server.address().port}/api/triggers/00000000-0000-4000-8000-000000000001`;
  const patch = (status) =>
    realFetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  try {
    assert.equal((await patch('paused')).status, 200);
    assert.equal(writes, 1);
    for (const status of ['fired', 'unsupported', 'error']) {
      current = { status, domain: 'crypto' };
      assert.equal((await patch('active')).status, 409);
    }
    assert.equal(writes, 1);
    current = null;
    assert.equal((await patch('active')).status, 404);
    current = { status: 'paused', domain: 'crypto' };
    race = true;
    assert.equal((await patch('active')).status, 409);
    assert.equal((await patch('fired')).status, 400);
    assert.equal((await realFetch(url.replace(/[^/]+$/, 'invalid'))).status, 400);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
