export const METRICS_BY_DOMAIN = {
  weather: ['temperature_f', 'precipitation_mm', 'wind_mph', 'snowfall_cm'],
  sports: ['score_diff', 'score_home', 'score_away'],
  crypto: ['price_usd'],
};

export const OPERATORS = ['>', '>=', '<', '<=', '==', '!='];

export function isValidCondition(domain, condition) {
  if (!condition || typeof condition !== 'object') return false;
  const metrics = METRICS_BY_DOMAIN[domain];
  if (!metrics || !metrics.includes(condition.metric)) return false;
  if (!OPERATORS.includes(condition.operator)) return false;
  if (typeof condition.threshold !== 'number' && typeof condition.threshold !== 'boolean') return false;
  if (typeof condition.edge_trigger !== 'boolean') return false;
  return true;
}
