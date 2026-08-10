import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';

export default function TriggerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trigger, setTrigger] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  useDocumentTitle(trigger ? trigger.raw_prompt : 'Trigger');

  useEffect(() => {
    api
      .get(`/api/triggers/${id}`)
      .then(({ events, ...trigger }) => {
        setTrigger(trigger);
        setEvents(events);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) return <p className="empty-state">Couldn't load this trigger: {error}</p>;
  if (!trigger) return <p className="empty-state">Loading...</p>;

  async function toggleStatus() {
    setTogglingStatus(true);
    try {
      const status = trigger.status === 'paused' ? 'active' : 'paused';
      const updated = await api.patch(`/api/triggers/${id}`, { status });
      setTrigger(updated);
    } finally {
      setTogglingStatus(false);
    }
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/api/triggers/${id}`);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  const canToggle = trigger.status === 'active' || trigger.status === 'paused';

  return (
    <div className="stack">
      <div className="row row-between">
        <h2>{trigger.raw_prompt}</h2>
        <StatusBadge status={trigger.status} />
      </div>

      <div className="card stack">
        <div className="row">
          <span className="label">Domain</span>
          <span>{trigger.domain}</span>
        </div>
        <div className="row">
          <span className="label">{trigger.domain === 'unsupported' ? 'Why' : 'Condition'}</span>
          <span>
            {trigger.domain === 'unsupported' ? (
              trigger.unsupported_reason
            ) : (
              <>
                {trigger.condition.metric} {trigger.condition.operator}{' '}
                {String(trigger.condition.threshold)}
                {trigger.condition.edge_trigger ? ' (on transition)' : ''}
              </>
            )}
          </span>
        </div>
        <div className="row">
          <span className="label">Recurring</span>
          <span>{trigger.recurring ? 'Yes' : 'No'}</span>
        </div>
        {trigger.last_checked_at && (
          <div className="row">
            <span className="label">Last checked</span>
            <span>{new Date(trigger.last_checked_at).toLocaleString()}</span>
          </div>
        )}
        {trigger.last_state?.error && (
          <div className="row">
            <span className="label">Last check</span>
            <span className="warn-text">Failed — {trigger.last_state.error}</span>
          </div>
        )}
      </div>

      <div className="row">
        {canToggle && (
          <button className="button" onClick={toggleStatus} disabled={togglingStatus}>
            {togglingStatus ? 'Updating...' : trigger.status === 'paused' ? 'Resume' : 'Pause'}
          </button>
        )}
        {confirmingDelete && (
          <button className="button" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
            Cancel
          </button>
        )}
        <button className="button button-danger" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting...' : confirmingDelete ? 'Confirm delete' : 'Delete'}
        </button>
      </div>

      <h3>History</h3>
      {events.length === 0 ? (
        <p className="empty-state">No alerts fired yet.</p>
      ) : (
        <ul className="event-list">
          {events.map((event) => (
            <li key={event.id} className="card">
              <div>{event.payload.body}</div>
              <div className="event-time">{new Date(event.fired_at).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
