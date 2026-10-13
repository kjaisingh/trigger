export function compare(value, operator, threshold) {
  if (!Number.isFinite(value) || !Number.isFinite(threshold)) return false;
  switch (operator) {
    case '>':
      return value > threshold;
    case '>=':
      return value >= threshold;
    case '<':
      return value < threshold;
    case '<=':
      return value <= threshold;
    case '==':
      return value === threshold;
    case '!=':
      return value !== threshold;
    default:
      return false;
  }
}

/** @param {string | null} [eventId] */
export function decideFiring(condition, lastState, value, eventId = null) {
  const met = compare(value, condition.operator, condition.threshold);
  const hasBaseline =
    typeof lastState?.condition_met === 'boolean' && lastState?.event_id === eventId;
  const shouldFire = condition.edge_trigger ? hasBaseline && met && !lastState.condition_met : met;
  return { met, shouldFire, state: { value, condition_met: met, event_id: eventId } };
}

function isLiveStatus(event) {
  const status = String(event.strStatus || event.strProgress || '').toLowerCase();
  return /live|in progress|half|quarter|period|inning|^q[1-4]$|^ht$/.test(status);
}

function scored(event) {
  return (
    event.intHomeScore !== null &&
    event.intHomeScore !== '' &&
    event.intAwayScore !== null &&
    event.intAwayScore !== '' &&
    Number.isFinite(Number(event.intHomeScore)) &&
    Number.isFinite(Number(event.intAwayScore))
  );
}

export function pickLiveEvent(upcoming, recent, teamId, opponentId) {
  const matches = (event) =>
    (event.idHomeTeam === teamId || event.idAwayTeam === teamId) &&
    (!opponentId || event.idHomeTeam === opponentId || event.idAwayTeam === opponentId);
  return (
    upcoming.find(
      (event) =>
        matches(event) &&
        scored(event) &&
        !/final|finish|complete|postpone|cancel/i.test(String(event.strStatus || '')),
    ) ||
    recent.find((event) => matches(event) && scored(event) && isLiveStatus(event)) ||
    null
  );
}
