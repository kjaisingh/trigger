const BASE_URL = `https://www.thesportsdb.com/api/v1/json/${process.env.SPORTSDB_API_KEY || '3'}`;

async function searchTeam(name) {
  const url = new URL(`${BASE_URL}/searchteams.php`);
  url.searchParams.set('t', name);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TheSportsDB lookup failed (${res.status}). Try again in a moment.`);
  }
  const data = await res.json();
  const match = data.teams?.[0];

  if (!match) {
    throw new Error(`Couldn't find a team matching "${name}".`);
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

  return {
    teamId: teamInfo.id,
    teamName: teamInfo.name,
    sport: teamInfo.sport,
    opponentId: opponentInfo?.id || null,
    opponentName: opponentInfo?.name || null,
  };
}
