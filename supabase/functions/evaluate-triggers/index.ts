// Deno Edge Function. Invoked on a schedule by pg_cron + pg_net (see supabase/schema.sql).
// Evaluates every active trigger and fires push notifications for the ones whose condition is met.

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { decideFiring, pickLiveEvent } from '../_shared/evaluation.js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

async function fetchWithRetry(
  url: string | URL,
  options: RequestInit = {},
  { retries = 2, backoffMs = 300, timeoutMs = 8000 } = {},
): Promise<Response> {
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
  throw new Error('fetchWithRetry: exhausted retries');
}

async function evaluateWeather(subject: any, condition: any) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(subject.lat));
  url.searchParams.set('longitude', String(subject.lon));
  url.searchParams.set('current', 'temperature_2m,precipitation,wind_speed_10m,snowfall');
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('wind_speed_unit', 'mph');

  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`Open-Meteo lookup failed (${res.status})`);
  const data = await res.json();
  const current = data.current;
  if (!current) throw new Error('Open-Meteo returned no current conditions.');

  const valueByMetric: Record<string, number> = {
    temperature_f: current.temperature_2m,
    precipitation_mm: current.precipitation,
    wind_mph: current.wind_speed_10m,
    snowfall_cm: current.snowfall,
  };

  const value = valueByMetric[condition.metric];
  if (!Number.isFinite(value)) throw new Error('Open-Meteo returned no valid metric value.');
  return { value, description: `${subject.location} is at ${value} (${condition.metric})` };
}

async function fetchTeamEvents(teamId: string, endpoint: string) {
  const key = Deno.env.get('SPORTSDB_API_KEY') || '3';
  const res = await fetchWithRetry(
    `https://www.thesportsdb.com/api/v1/json/${key}/${endpoint}.php?id=${teamId}`,
  );
  if (!res.ok) throw new Error(`TheSportsDB lookup failed (${res.status})`);
  const data = await res.json();
  return data.events || data.results || [];
}

async function evaluateSports(subject: any, condition: any) {
  const [upcoming, recent] = await Promise.all([
    fetchTeamEvents(subject.teamId, 'eventsnext'),
    fetchTeamEvents(subject.teamId, 'eventslast'),
  ]);
  const event = pickLiveEvent(upcoming, recent, subject.teamId, subject.opponentId);

  if (!event) {
    return {
      value: null,
      description: `No live scored match found for ${subject.teamName}.`,
    };
  }

  const homeScore = Number(event.intHomeScore);
  const awayScore = Number(event.intAwayScore);
  const isHome = event.idHomeTeam === subject.teamId;
  const teamScore = isHome ? homeScore : awayScore;
  const opponentScore = isHome ? awayScore : homeScore;

  const valueByMetric: Record<string, number> = {
    score_diff: teamScore - opponentScore,
    team_score: teamScore,
    opponent_score: opponentScore,
  };

  const value = valueByMetric[condition.metric];
  return {
    value,
    eventId: event.idEvent,
    description: `${event.strHomeTeam} ${homeScore} - ${awayScore} ${event.strAwayTeam}`,
  };
}

async function evaluateCrypto(subject: any, condition: any) {
  const url = new URL('https://api.coingecko.com/api/v3/simple/price');
  url.searchParams.set('ids', subject.coinId);
  url.searchParams.set('vs_currencies', 'usd');

  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`CoinGecko lookup failed (${res.status})`);
  const data = await res.json();
  const value = data[subject.coinId]?.usd;
  if (!Number.isFinite(value)) throw new Error('CoinGecko returned no valid price.');

  return { value, description: `${subject.coinId} is at $${value}` };
}

function checked(result: any) {
  if (result.error) throw result.error;
  return result.data;
}

async function evaluateTrigger(trigger: any) {
  const { domain, subject, condition } = trigger;
  let result: { value: number | null; description: string; eventId?: string };
  try {
    if (domain === 'weather') result = await evaluateWeather(subject, condition);
    else if (domain === 'sports') result = await evaluateSports(subject, condition);
    else if (domain === 'crypto') result = await evaluateCrypto(subject, condition);
    else return;
  } catch (error) {
    let update = supabase
      .from('triggers')
      .update({
        last_checked_at: new Date().toISOString(),
        last_state: { ...(trigger.last_state || {}), error: String(error) },
      })
      .eq('id', trigger.id)
      .eq('status', 'active');
    update = trigger.last_checked_at
      ? update.eq('last_checked_at', trigger.last_checked_at)
      : update.is('last_checked_at', null);
    checked(await update);
    throw error;
  }

  const checkedAt = new Date().toISOString();
  if (result.value === null || result.value === undefined) {
    let update = supabase
      .from('triggers')
      .update({
        last_checked_at: checkedAt,
        last_state: {
          condition_met: trigger.last_state?.condition_met ?? null,
          event_id: trigger.last_state?.event_id ?? null,
          note: result.description,
        },
      })
      .eq('id', trigger.id)
      .eq('status', 'active');
    update = trigger.last_checked_at
      ? update.eq('last_checked_at', trigger.last_checked_at)
      : update.is('last_checked_at', null);
    checked(await update);
    return;
  }
  if (!Number.isFinite(result.value)) throw new Error('Provider returned an invalid value.');

  const { shouldFire, state } = decideFiring(
    condition,
    trigger.last_state,
    result.value,
    result.eventId || null,
  );
  let claim = supabase
    .from('triggers')
    .update({
      last_checked_at: checkedAt,
      last_state: state,
      status: shouldFire && !trigger.recurring ? 'fired' : 'active',
    })
    .eq('id', trigger.id)
    .eq('status', 'active');
  claim = trigger.last_checked_at
    ? claim.eq('last_checked_at', trigger.last_checked_at)
    : claim.is('last_checked_at', null);
  const claimed = checked(await claim.select('id'));
  if (!claimed.length || !shouldFire) return;

  const subs = checked(
    await supabase.from('push_subscriptions').select('*').eq('user_id', trigger.user_id),
  );
  const payload = {
    title: 'Trigger fired',
    body: `${trigger.raw_prompt} - ${result.description}`,
    url: `/triggers/${trigger.id}`,
    tag: `trigger-${trigger.id}`,
  };
  const pushResults = await Promise.allSettled(
    subs.map((sub: any) =>
      webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload)),
    ),
  );
  const deadEndpoints = subs
    .filter((_: any, index: number) => {
      const outcome = pushResults[index];
      return outcome.status === 'rejected' && [404, 410].includes(outcome.reason?.statusCode);
    })
    .map((sub: any) => sub.endpoint);
  if (deadEndpoints.length) {
    checked(
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', trigger.user_id)
        .in('endpoint', deadEndpoints),
    );
  }
  const delivered = pushResults.filter((outcome: any) => outcome.status === 'fulfilled').length;
  const failed = pushResults.length - delivered;
  checked(
    await supabase.from('trigger_events').insert({
      trigger_id: trigger.id,
      payload,
      channels_sent: delivered ? ['push'] : [],
      error: !subs.length
        ? 'No push subscription'
        : failed
          ? `${failed} push delivery failed`
          : null,
    }),
  );
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = req.headers.get('x-cron-secret');
  if (secret !== Deno.env.get('CRON_SHARED_SECRET')) {
    return new Response('Unauthorized', { status: 401 });
  }

  let cursor = '';
  let evaluated = 0;
  let failed = 0;
  while (true) {
    let query = supabase.from('triggers').select('*').eq('status', 'active').order('id').limit(100);
    if (cursor) query = query.gt('id', cursor);
    const { data: triggers, error } = await query;
    if (error) return new Response(error.message, { status: 500 });
    if (!triggers?.length) break;
    cursor = triggers[triggers.length - 1].id;
    evaluated += triggers.length;
    for (let offset = 0; offset < triggers.length; offset += 8) {
      const results = await Promise.allSettled(
        triggers.slice(offset, offset + 8).map(evaluateTrigger),
      );
      for (const result of results) {
        if (result.status === 'rejected') {
          failed += 1;
          console.error('Trigger evaluation failed:', result.reason);
        }
      }
    }
    if (triggers.length < 100) break;
  }

  return new Response(JSON.stringify({ evaluated, failed }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
