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
    endpoint: 'https://fcm.googleapis.com/fcm/send/subscription',
    keys: {
      p256dh: globalThis.Buffer.from([4, ...Array(64).fill(1)]).toString('base64url'),
      auth: globalThis.Buffer.alloc(16, 1).toString('base64url'),
    },
  };
  assert.deepEqual(validatePushSubscription(valid), valid);
  assert.equal(validatePushEndpoint(valid.endpoint), valid.endpoint);
  assert.throws(() => validatePushSubscription({ ...valid, keys: {} }), { status: 400 });
  assert.throws(() => validatePushEndpoint('http://example.test'), { status: 400 });
});

test('push endpoints reject arbitrary hosts and URL authority tricks', () => {
  for (const endpoint of [
    'https://127.0.0.1/private',
    'https://[::1]/',
    'https://localhost/',
    'https://fcm.googleapis.com.evil.test/',
    'https://evil.test/?fcm.googleapis.com',
    'https://user@fcm.googleapis.com/',
    'https://fcm.googleapis.com:8443/',
    'https://fcm.googleapis.com/#fragment',
    'https://',
  ])
    assert.throws(() => validatePushEndpoint(endpoint), { status: 400 });
  for (const endpoint of [
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/abc',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ])
    assert.equal(validatePushEndpoint(endpoint), endpoint);
});

test('subject normalization strips unknown fields and trims values', () => {
  assert.deepEqual(
    validateTrigger({ ...validTrigger, subject: { location: ' Boston ', lat: 3 } }).subject,
    { location: 'Boston' },
  );
});
