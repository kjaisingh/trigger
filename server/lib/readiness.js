export async function databaseReady(client, timeoutMs = 5000) {
  try {
    const { error } = await client
      .from('triggers')
      .select('id')
      .limit(1)
      .abortSignal(AbortSignal.timeout(timeoutMs));
    return !error;
  } catch {
    return false;
  }
}

export async function schedulerReady(client, now = Date.now(), timeoutMs = 5000) {
  try {
    const { data, error } = await client
      .from('evaluator_status')
      .select('completed_at')
      .eq('id', true)
      .maybeSingle()
      .abortSignal(AbortSignal.timeout(timeoutMs));
    return !error && Boolean(data) && now - Date.parse(data.completed_at) < 30 * 60 * 1000;
  } catch {
    return false;
  }
}
