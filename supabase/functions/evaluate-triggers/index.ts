// Deno Edge Function. Invoked on a schedule by pg_cron + pg_net (see supabase/schema.sql).
// Evaluates every active trigger and fires push notifications for the ones whose condition is met.

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

function compare(value: number | boolean, operator: string, threshold: number | boolean) {
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

async function evaluateWeather(subject: any, condition: any) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(subject.lat));
  url.searchParams.set('longitude', String(subject.lon));
  url.searchParams.set('current', 'temperature_2m,precipitation,wind_speed_10m,snowfall');
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('wind_speed_unit', 'mph');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo lookup failed (${res.status})`);
  const data = await res.json();
  const current = data.current;

  const valueByMetric: Record<string, number> = {
    temperature_f: current.temperature_2m,
    precipitation_mm: current.precipitation,
    wind_mph: current.wind_speed_10m,
    snowfall_cm: current.snowfall,
  };

  const value = valueByMetric[condition.metric];
  return { value, description: `${subject.location} is at ${value} (${condition.metric})` };
}

async function fetchTeamEvents(teamId: string, endpoint: string) {
  const key = Deno.env.get('SPORTSDB_API_KEY') || '3';
  const res = await fetch(`https://www.thesportsdb.com/api/v1/json/${key}/${endpoint}.php?id=${teamId}`);
  if (!res.ok) throw new Error(`TheSportsDB lookup failed (${res.status})`);
  const data = await res.json();
  return data.events || data.results || [];
}

async function evaluateSports(subject: any, condition: any) {
  let events = await fetchTeamEvents(subject.teamId, 'eventsnext');
  if (subject.opponentId) {
    events = events.filter(
      (e: any) => e.idAwayTeam === subject.opponentId || e.idHomeTeam === subject.opponentId,
    );
  }

  let event = events.find((e: any) => e.intHomeScore !== null && e.intAwayScore !== null);

  if (!event) {
    let recent = await fetchTeamEvents(subject.teamId, 'eventslast');
    if (subject.opponentId) {
      recent = recent.filter(
        (e: any) => e.idAwayTeam === subject.opponentId || e.idHomeTeam === subject.opponentId,
      );
    }
    event = recent[0];
  }

  if (!event) {
    return { value: null, description: `No recent or upcoming match found for ${subject.teamName}.` };
  }

  const homeScore = Number(event.intHomeScore);
  const awayScore = Number(event.intAwayScore);
  const isHome = event.idHomeTeam === subject.teamId;
  const teamScore = isHome ? homeScore : awayScore;
  const opponentScore = isHome ? awayScore : homeScore;

  const valueByMetric: Record<string, number> = {
    score_diff: teamScore - opponentScore,
    score_home: homeScore,
    score_away: awayScore,
  };

  const value = valueByMetric[condition.metric];
  return {
    value,
    description: `${event.strHomeTeam} ${homeScore} - ${awayScore} ${event.strAwayTeam}`,
  };
}

async function evaluateCrypto(subject: any, condition: any) {
  const url = new URL('https://api.coingecko.com/api/v3/simple/price');
  url.searchParams.set('ids', subject.coinId);
  url.searchParams.set('vs_currencies', 'usd');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko lookup failed (${res.status})`);
  const data = await res.json();
  const value = data[subject.coinId]?.usd;

  return { value, description: `${subject.coinId} is at $${value}` };
}

async function evaluateTrigger(trigger: any) {
  const { domain, subject, condition } = trigger;

  let result;
  if (domain === 'weather') result = await evaluateWeather(subject, condition);
  else if (domain === 'sports') result = await evaluateSports(subject, condition);
  else if (domain === 'crypto') result = await evaluateCrypto(subject, condition);
  else return;

  if (result.value === null || result.value === undefined) return;

  const met = compare(result.value, condition.operator, condition.threshold);
  const previouslyMet = Boolean(trigger.last_state?.condition_met);
  const shouldFire = condition.edge_trigger ? met && !previouslyMet : met;

  if (shouldFire) {
    const subs = await supabase.from('push_subscriptions').select('*').eq('user_id', trigger.user_id);
    const payload = { title: 'Trigger fired', body: `${trigger.raw_prompt} — ${result.description}` };

    const pushResults = await Promise.allSettled(
      (subs.data || []).map((sub: any) =>
        webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload)),
      ),
    );

    const deadEndpoints = (subs.data || [])
      .filter((_: any, i: number) => {
        const r = pushResults[i];
        return r.status === 'rejected' && [404, 410].includes(r.reason?.statusCode);
      })
      .map((sub: any) => sub.endpoint);

    if (deadEndpoints.length) {
      await supabase.from('push_subscriptions').delete().in('endpoint', deadEndpoints);
    }

    await supabase.from('trigger_events').insert({
      trigger_id: trigger.id,
      payload,
      channels_sent: ['push'],
    });
  }

  await supabase
    .from('triggers')
    .update({
      last_checked_at: new Date().toISOString(),
      last_state: { value: result.value, condition_met: met },
      status: shouldFire && !trigger.recurring ? 'fired' : trigger.status,
    })
    .eq('id', trigger.id);
}

Deno.serve(async (req) => {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== Deno.env.get('CRON_SHARED_SECRET')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { data: triggers, error } = await supabase.from('triggers').select('*').eq('status', 'active');
  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const results = await Promise.allSettled((triggers || []).map(evaluateTrigger));
  const failed = results.filter((r) => r.status === 'rejected');
  failed.forEach((r: any) => console.error('Trigger evaluation failed:', r.reason));

  return new Response(JSON.stringify({ evaluated: triggers?.length || 0, failed: failed.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
