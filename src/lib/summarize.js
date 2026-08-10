import { METRIC_LABELS, OPERATOR_LABELS } from '../../shared/domains.js';

const METRIC_UNITS = {
  temperature_f: '°F',
  precipitation_mm: 'mm',
  wind_mph: 'mph',
  snowfall_cm: 'cm',
};

const METRIC_SHORT_NAMES = {
  precipitation_mm: 'precipitation',
  wind_mph: 'wind',
  snowfall_cm: 'snowfall',
  score_diff: 'score margin',
  team_score: 'score',
  opponent_score: "opponent's score",
};

const CONDITION_PHRASES = {
  '>': 'over',
  '>=': 'at least',
  '<': 'under',
  '<=': 'at most',
  '==': 'at',
  '!=': 'not at',
};

function formatThreshold(metric, threshold) {
  if (metric === 'price_usd') return `$${threshold}`;
  const unit = METRIC_UNITS[metric];
  return unit ? `${threshold}${unit}` : String(threshold);
}

export function describeSubject(domain, subject) {
  if (domain === 'weather') return subject.location || 'your location';
  if (domain === 'sports')
    return subject.opponent
      ? `${subject.team} vs ${subject.opponent}`
      : subject.team || 'your team';
  if (domain === 'crypto') return subject.coin_id || 'your coin';
  return '';
}

export function describeCondition(condition) {
  const metric = METRIC_LABELS[condition.metric] || condition.metric;
  const operator = OPERATOR_LABELS[condition.operator] || condition.operator;
  const value = formatThreshold(condition.metric, condition.threshold);
  return `${metric} ${operator} ${value}${condition.edge_trigger ? ', on transition only' : ''}`;
}

export function summarizeTrigger(trigger) {
  if (trigger.domain === 'unsupported') return trigger.raw_prompt;
  const { domain, subject, condition } = trigger;
  const who = describeSubject(domain, subject);
  const phrase = CONDITION_PHRASES[condition.operator] || condition.operator;
  const value = formatThreshold(condition.metric, condition.threshold);
  const metricName = METRIC_SHORT_NAMES[condition.metric];
  return `${who}${metricName ? ` ${metricName}` : ''} ${phrase} ${value}`;
}
