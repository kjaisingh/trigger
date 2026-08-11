import { fetchWithRetry } from '../http.js';

const PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price';

export async function resolveSubject(subject) {
  const coinId = subject?.coin_id;
  if (!coinId) {
    throw new Error('Crypto triggers need a coin_id (e.g. "bitcoin").');
  }

  const url = new URL(PRICE_URL);
  url.searchParams.set('ids', coinId);
  url.searchParams.set('vs_currencies', 'usd');

  const res = await fetchWithRetry(url);
  if (!res.ok) {
    throw new Error(`CoinGecko lookup failed (${res.status}). Try again in a moment.`);
  }
  const data = await res.json();

  if (!data[coinId]) {
    throw new Error(
      `Couldn't find a coin matching "${coinId}". Use a CoinGecko coin id, e.g. "bitcoin" or "ethereum".`,
    );
  }

  return { coinId };
}
