import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge.jsx';

export default function TriggerCard({ trigger }) {
  return (
    <Link to={`/triggers/${trigger.id}`} className="card trigger-card">
      <div className="trigger-card-header">
        <StatusBadge status={trigger.status} />
        <span className="domain-tag">{trigger.domain}</span>
        {trigger.last_state?.error && <span className="warn-text" title={trigger.last_state.error}>⚠ check failing</span>}
      </div>
      <p className="trigger-prompt">{trigger.raw_prompt}</p>
      <span className="trigger-date">{new Date(trigger.created_at).toLocaleString()}</span>
    </Link>
  );
}
