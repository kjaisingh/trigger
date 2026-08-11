export async function fetchWithRetry(url, options = {}, { retries = 2, backoffMs = 300 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
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
