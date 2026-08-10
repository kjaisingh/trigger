// Single source of truth for domain metrics + operators, used by both the
// server (condition validation) and the client (create-trigger form).
export const METRICS_BY_DOMAIN = {
  weather: ['temperature_f', 'precipitation_mm', 'wind_mph', 'snowfall_cm'],
  sports: ['score_diff', 'score_home', 'score_away'],
  crypto: ['price_usd'],
};

export const OPERATORS = ['>', '>=', '<', '<=', '==', '!='];

export const METRIC_LABELS = {
  temperature_f: 'Temperature (°F)',
  precipitation_mm: 'Precipitation (mm)',
  wind_mph: 'Wind speed (mph)',
  snowfall_cm: 'Snowfall (cm)',
  score_diff: 'Score difference',
  score_home: 'Home score',
  score_away: 'Away score',
  price_usd: 'Price (USD)',
};

export const OPERATOR_LABELS = {
  '>': 'is above',
  '>=': 'is at least',
  '<': 'is below',
  '<=': 'is at most',
  '==': 'equals',
  '!=': 'is not',
};
