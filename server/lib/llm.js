const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You turn a user's natural-language alert request into a structured trigger definition.

Supported domains and their subject shape:
- weather: { "location": string } — a city/place name, e.g. "Boston, MA"
- sports: { "team": string, "opponent"?: string } — the full, canonical team name, not a nickname (e.g. "Los Angeles Lakers" not "Lakers", "Manchester United" not "Man U"; club or national team)
- crypto: { "coin_id": string } — a CoinGecko coin id, e.g. "bitcoin", "ethereum", "dogecoin"

Condition shape (same shape for every domain): { "metric": string, "operator": ">"|">="|"<"|"<="|"=="|"!=", "threshold": number|boolean, "edge_trigger": boolean }

Allowed metrics per domain:
- weather: temperature_f, precipitation_mm, wind_mph, snowfall_cm (use snowfall_cm specifically for snow requests, precipitation_mm for rain/general precipitation)
- sports: score_diff (team score minus opponent score), score_home, score_away
- crypto: price_usd

edge_trigger is true when the user cares about a transition/change (e.g. "when it stops raining", "when the score becomes tied") rather than a level that could already be true. Set it false for a plain threshold check (e.g. "when the temperature goes above 32F").

If the request doesn't fit any supported domain, or is missing information you need (e.g. no location for a weather request, no coin name for crypto, no team for sports), respond with domain "unsupported" and a short, friendly unsupported_reason explaining what's missing or unsupported. Do not guess missing required fields.

Respond with only a JSON object shaped exactly like this:
{
  "domain": "weather" | "sports" | "crypto" | "unsupported",
  "subject": { ... } | {},
  "condition": { "metric": string, "operator": string, "threshold": number|boolean, "edge_trigger": boolean } | {},
  "unsupported_reason": string | null
}`;

export async function parsePrompt(rawPrompt) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: rawPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Groq request failed: ${detail}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Groq returned no content.');
  }

  return JSON.parse(content);
}
