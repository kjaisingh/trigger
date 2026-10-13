import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSubject } from '../server/lib/domains/sports.js';

test('team lookup rejects an unrelated fuzzy first result', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      teams: [{ idTeam: 'wrong', strTeam: 'Roosevelt', strSport: 'American Football' }],
    }),
  }));
  await assert.rejects(resolveSubject({ team: 'Lakers' }), /exact team matching/);
});

test('team lookup accepts a canonical full name', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      teams: [{ idTeam: '123', strTeam: 'Los Angeles Lakers', strSport: 'Basketball' }],
    }),
  }));
  const subject = await resolveSubject({ team: 'Los Angeles Lakers' });
  assert.equal(subject.teamId, '123');
  assert.equal(subject.teamName, 'Los Angeles Lakers');
});
