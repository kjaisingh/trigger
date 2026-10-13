export async function fetchWithRetry(
  url,
  options = {},
  { retries = 2, backoffMs = 300, timeoutMs = 8000 } = {},
) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const signal = options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)])
        : AbortSignal.timeout(timeoutMs);
      const res = await fetch(url, { ...options, signal });
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs * 2 ** attempt));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, backoffMs * 2 ** attempt));
    }
  }
}
