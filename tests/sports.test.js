import assert from 'node:assert/strict';
import test from 'node:test';
import { URL } from 'node:url';
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

test('team lookup rejects the same team as its opponent', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      teams: [{ idTeam: '123', strTeam: 'Los Angeles Lakers', strSport: 'Basketball' }],
    }),
  }));
  await assert.rejects(
    resolveSubject({ team: 'Los Angeles Lakers', opponent: 'Los Angeles Lakers' }),
    /different opponent/,
  );
});

test('team lookup rejects opponents from a different sport', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => ({
    ok: true,
    status: 200,
    json: async () => ({
      teams: [
        new URL(url).searchParams.get('t') === 'Los Angeles Lakers'
          ? { idTeam: '1', strTeam: 'Los Angeles Lakers', strSport: 'Basketball' }
          : { idTeam: '2', strTeam: 'Boston Red Sox', strSport: 'Baseball' },
      ],
    }),
  }));
  await assert.rejects(
    resolveSubject({ team: 'Los Angeles Lakers', opponent: 'Boston Red Sox' }),
    /same sport/,
  );
});
