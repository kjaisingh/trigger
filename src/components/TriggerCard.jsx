import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge.jsx';
import { summarizeTrigger } from '../lib/summarize.js';
import { checkHealth } from '../lib/checkHealth.js';

export default function TriggerCard({ trigger }) {
  const health = checkHealth(trigger);
  return (
    <Link to={`/triggers/${trigger.id}`} className="card trigger-card">
      <div className="trigger-card-header">
        <StatusBadge status={trigger.status} />
        <span className="domain-tag">{trigger.domain}</span>
        {trigger.last_state?.error && (
          <span className="warn-text" title={trigger.last_state.error}>
            ⚠ check failing
          </span>
        )}
        {health?.delayed && <span className="warn-text">⚠ {health.label}</span>}
      </div>
      <p className="trigger-prompt">{summarizeTrigger(trigger)}</p>
      <span className="trigger-date">
        {trigger.last_checked_at
          ? `Last checked ${new Date(trigger.last_checked_at).toLocaleString()}`
          : health
            ? health.label
            : `Created ${new Date(trigger.created_at).toLocaleString()}`}
      </span>
    </Link>
  );
}
