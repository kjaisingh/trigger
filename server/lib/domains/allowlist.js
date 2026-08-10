import { METRICS_BY_DOMAIN, OPERATORS } from '../../../shared/domains.js';

export { METRICS_BY_DOMAIN, OPERATORS };

export function isValidCondition(domain, condition) {
  if (!condition || typeof condition !== 'object') return false;
  const metrics = METRICS_BY_DOMAIN[domain];
  if (!metrics || !metrics.includes(condition.metric)) return false;
  if (!OPERATORS.includes(condition.operator)) return false;
  if (typeof condition.threshold !== 'number' && typeof condition.threshold !== 'boolean')
    return false;
  if (typeof condition.edge_trigger !== 'boolean') return false;
  return true;
}
