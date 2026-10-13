import { fetchWithRetry } from '../http.js';
import { PublicError } from '../validation.js';

const BASE_URL = `https://www.thesportsdb.com/api/v1/json/${process.env.SPORTSDB_API_KEY || '3'}`;

async function searchTeam(name) {
  const url = new URL(`${BASE_URL}/searchteams.php`);
  url.searchParams.set('t', name);

  const res = await fetchWithRetry(url);
  if (!res.ok) {
    throw new Error(`TheSportsDB lookup failed (${res.status}). Try again in a moment.`);
  }
  const data = await res.json();
  const normalize = (value) =>
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const wanted = normalize(name);
  const match = data.teams?.find((team) =>
    [team.strTeam, ...(team.strAlternate || '').split(',')].some(
      (candidate) => candidate && normalize(candidate) === wanted,
    ),
  );

  if (!match) {
    throw new Error(`Couldn't find an exact team matching "${name}". Use its full name.`);
  }

  return {
    id: match.idTeam,
    name: match.strTeam,
    sport: match.strSport,
  };
}

export async function resolveSubject(subject) {
  const team = subject?.team;
  const opponent = subject?.opponent;
  if (!team) {
    throw new Error('Sports triggers need a team.');
  }

  const teamInfo = await searchTeam(team);
  const opponentInfo = opponent ? await searchTeam(opponent) : null;
  if (opponentInfo?.id === teamInfo.id) {
    throw new PublicError('Choose a different opponent team.');
  }
  if (opponentInfo && opponentInfo.sport !== teamInfo.sport) {
    throw new PublicError('Both teams must play the same sport.');
  }

  return {
    teamId: teamInfo.id,
    teamName: teamInfo.name,
    sport: teamInfo.sport,
    opponentId: opponentInfo?.id || null,
    opponentName: opponentInfo?.name || null,
  };
}
