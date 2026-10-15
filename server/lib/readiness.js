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
