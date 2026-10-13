import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validatePrompt,
  validatePushEndpoint,
  validatePushSubscription,
  validateTrigger,
} from '../server/lib/validation.js';

const validTrigger = {
  raw_prompt: 'Tell me when it rains in Boston',
  domain: 'weather',
  subject: { location: 'Boston' },
  condition: { metric: 'precipitation_mm', operator: '>', threshold: 0, edge_trigger: true },
  channels: ['push'],
  recurring: false,
};

test('prompt accepts only bounded, nonempty text', () => {
  assert.equal(validatePrompt({ raw_prompt: '  rain  ' }), 'rain');
  for (const raw_prompt of [null, 42, ' ', 'x'.repeat(501)]) {
    assert.throws(() => validatePrompt({ raw_prompt }), { status: 400 });
  }
});

test('trigger rejects malformed conditions, subjects and channels', () => {
  assert.equal(validateTrigger(validTrigger).domain, 'weather');
  for (const change of [
    { condition: { ...validTrigger.condition, threshold: Infinity } },
    { subject: { location: 3 } },
    { channels: ['email'] },
    { recurring: 'false' },
    { domain: '__proto__' },
  ]) {
    assert.throws(() => validateTrigger({ ...validTrigger, ...change }), { status: 400 });
  }
});

test('push subscription requires HTTPS and both encryption keys', () => {
  const valid = {
    endpoint: 'https://push.example.test/subscription',
    keys: { p256dh: 'public-key', auth: 'auth-secret' },
  };
  assert.deepEqual(validatePushSubscription(valid), valid);
  assert.equal(validatePushEndpoint(valid.endpoint), valid.endpoint);
  assert.throws(() => validatePushSubscription({ ...valid, keys: {} }), { status: 400 });
  assert.throws(() => validatePushEndpoint('http://example.test'), { status: 400 });
});
