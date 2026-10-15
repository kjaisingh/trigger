const CHECK_DELAY_MS = 30 * 60 * 1000;

export function checkHealth(trigger, now = Date.now()) {
  if (trigger.status !== 'active') return null;
  const checkedAt = trigger.last_checked_at ? Date.parse(trigger.last_checked_at) : null;
  if (checkedAt === null) {
    return now - Date.parse(trigger.created_at) > CHECK_DELAY_MS
      ? { delayed: true, label: 'First check delayed' }
      : { delayed: false, label: 'Awaiting first check' };
  }
  return now - checkedAt > CHECK_DELAY_MS
    ? { delayed: true, label: 'Checks delayed' }
    : { delayed: false, label: 'Checking on schedule' };
}
