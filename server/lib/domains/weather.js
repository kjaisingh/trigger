const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export async function resolveSubject(subject) {
  const location = subject?.location;
  if (!location) {
    throw new Error('Weather triggers need a location.');
  }

  const url = new URL(GEOCODE_URL);
  url.searchParams.set('name', location);
  url.searchParams.set('count', '1');

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Weather lookup failed (${res.status}). Try again in a moment.`);
  }
  const data = await res.json();
  const match = data.results?.[0];

  if (!match) {
    throw new Error(`Couldn't find a location matching "${location}".`);
  }

  return {
    location: match.name,
    admin1: match.admin1 || null,
    country: match.country || null,
    lat: match.latitude,
    lon: match.longitude,
  };
}
