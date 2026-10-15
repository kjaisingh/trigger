import assert from 'node:assert/strict';
import test from 'node:test';
import { checkHealth } from '../src/lib/checkHealth.js';

const now = Date.parse('2026-10-15T12:00:00Z');
const active = { status: 'active', created_at: '2026-10-15T11:45:00Z' };

test('new active triggers await their first check', () => {
  assert.deepEqual(checkHealth(active, now), {
    delayed: false,
    label: 'Awaiting first check',
  });
  assert.equal(checkHealth({ ...active, created_at: '2026-10-15T11:29:59Z' }, now).delayed, true);
});

test('active triggers become delayed after two polling intervals', () => {
  assert.equal(
    checkHealth({ ...active, last_checked_at: '2026-10-15T11:30:00Z' }, now).delayed,
    false,
  );
  assert.equal(
    checkHealth({ ...active, last_checked_at: '2026-10-15T11:29:59Z' }, now).delayed,
    true,
  );
});

test('inactive triggers have no schedule warning', () => {
  assert.equal(checkHealth({ ...active, status: 'paused' }, now), null);
});
