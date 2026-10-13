import assert from 'node:assert/strict';
import test from 'node:test';
import { compare, decideFiring, pickLiveEvent } from '../supabase/functions/_shared/evaluation.js';

test('edge alerts establish a baseline before firing', () => {
  const condition = { operator: '>', threshold: 10, edge_trigger: true };
  const first = decideFiring(condition, null, 11);
  assert.equal(first.shouldFire, false);
  assert.equal(decideFiring(condition, first.state, 12).shouldFire, false);
  const below = decideFiring(condition, first.state, 9);
  assert.equal(decideFiring(condition, below.state, 11).shouldFire, true);
});

test('sports edge baseline resets when match changes', () => {
  const condition = { operator: '>', threshold: 0, edge_trigger: true };
  const first = decideFiring(condition, null, 1, 'match-1');
  assert.equal(decideFiring(condition, first.state, 1, 'match-2').shouldFire, false);
});

test('missing values cannot satisfy conditions', () => {
  assert.equal(compare(NaN, '!=', 1), false);
  assert.equal(compare(Infinity, '>', 1), false);
});

test('sports ignores completed games and unscored fixtures', () => {
  const base = { idHomeTeam: 'a', idAwayTeam: 'b' };
  const upcoming = [{ ...base, idEvent: 'next', intHomeScore: null, intAwayScore: null }];
  const recent = [
    { ...base, idEvent: 'past', intHomeScore: '2', intAwayScore: '1', strStatus: 'FT' },
  ];
  assert.equal(pickLiveEvent(upcoming, recent, 'a', 'b'), null);
  recent[0].strStatus = 'Live';
  assert.equal(pickLiveEvent(upcoming, recent, 'a', 'b')?.idEvent, 'past');
});

test('sports ignores future fixtures with placeholder scores', () => {
  const future = {
    idEvent: 'future',
    idHomeTeam: 'a',
    idAwayTeam: 'b',
    intHomeScore: '0',
    intAwayScore: '0',
    strStatus: 'Not Started',
  };
  assert.equal(pickLiveEvent([future], [], 'a', 'b'), null);
  future.strStatus = 'Live';
  assert.equal(pickLiveEvent([future], [], 'a', 'b')?.idEvent, 'future');
  future.strStatus = 'Final after 2nd Half';
  assert.equal(pickLiveEvent([future], [], 'a', 'b'), null);
});
