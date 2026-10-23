import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';
import { describeCondition, describeSubject, formatValue } from '../lib/summarize.js';
import { checkHealth } from '../lib/checkHealth.js';

export default function TriggerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [trigger, setTrigger] = useState(null);
  const [events, setEvents] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  useDocumentTitle(trigger ? trigger.raw_prompt : 'Trigger');

  useEffect(() => {
    let active = true;
    api
      .get(`/api/triggers/${id}`)
      .then(({ events, ...trigger }) => {
        if (active) {
          setTrigger(trigger);
          setEvents(events);
        }
      })
      .catch((err) => {
        if (active) setLoadError(err.message);
      });
    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  if (loadError)
    return (
      <div className="empty-state" role="alert">
        <p>Couldn't load this trigger: {loadError}</p>
        <button
          type="button"
          className="button"
          onClick={() => {
            setLoadError('');
            setReloadKey((key) => key + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  if (!trigger || trigger.id !== id)
    return (
      <p className="empty-state" role="status">
        Loading trigger...
      </p>
    );

  async function toggleStatus() {
    setActionError('');
    setTogglingStatus(true);
    try {
      const status = trigger.status === 'paused' ? 'active' : 'paused';
      const updated = await api.patch(`/api/triggers/${id}`, { status });
      setTrigger(updated);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setTogglingStatus(false);
    }
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setActionError('');
    setDeleting(true);
    try {
      await api.delete(`/api/triggers/${id}`);
      navigate('/dashboard');
    } catch (err) {
      setActionError(err.message);
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  const canToggle = trigger.status === 'active' || trigger.status === 'paused';
  const health = checkHealth(trigger);

  return (
    <div className="stack">
      <Link to="/dashboard" className="back-link">
        ← Your triggers
      </Link>
      {location.state?.created && (
        <div className="notice" role="status">
          <strong>
            {trigger.domain === 'unsupported'
              ? 'Request saved. It is not being monitored.'
              : 'Trigger created. Your first check should run within 15 minutes.'}
          </strong>
          {trigger.domain !== 'unsupported' && (
            <p>
              Enable notifications on each device to receive alerts.{' '}
              <Link to="/settings">Set up notifications →</Link>
            </p>
          )}
        </div>
      )}
      {actionError && (
        <p className="error-text" role="alert">
          {actionError}
        </p>
      )}
      <div className="row row-between">
        <h2>{trigger.raw_prompt}</h2>
        <StatusBadge status={trigger.status} />
      </div>

      <div className="card stack">
        {trigger.domain !== 'unsupported' && (
          <div className="row">
            <span className="label">Watching</span>
            <span>{describeSubject(trigger.domain, trigger.subject)}</span>
          </div>
        )}
        <div className="row">
          <span className="label">Domain</span>
          <span>{trigger.domain}</span>
        </div>
        <div className="row">
          <span className="label">{trigger.domain === 'unsupported' ? 'Why' : 'Condition'}</span>
          <span>
            {trigger.domain === 'unsupported'
              ? trigger.unsupported_reason
              : describeCondition(trigger.condition)}
          </span>
        </div>
        <div className="row">
          <span className="label">Recurring</span>
          <span>{trigger.recurring ? 'Yes' : 'No'}</span>
        </div>
        {trigger.last_checked_at ? (
          <div className="row">
            <span className="label">Last checked</span>
            <span>{new Date(trigger.last_checked_at).toLocaleString()}</span>
          </div>
        ) : trigger.status === 'active' ? (
          <div className="row">
            <span className="label">Last checked</span>
            <span>{health?.label}</span>
          </div>
        ) : null}
        {health && trigger.last_checked_at && (
          <div className="row">
            <span className="label">Schedule</span>
            <span className={health.delayed ? 'warn-text' : ''}>{health.label}</span>
          </div>
        )}
        {Number.isFinite(trigger.last_state?.value) &&
          !trigger.last_state?.error &&
          !trigger.last_state?.note && (
            <div className="row">
              <span className="label">Last value</span>
              <span>{formatValue(trigger.condition.metric, trigger.last_state.value)}</span>
            </div>
          )}
        {trigger.last_state?.error && (
          <div className="row">
            <span className="label">Last check</span>
            <span className="warn-text">Failed - {trigger.last_state.error}</span>
          </div>
        )}
        {trigger.last_state?.note && (
          <div className="row">
            <span className="label">Last check</span>
            <span>{trigger.last_state.note}</span>
          </div>
        )}
      </div>

      <div className="row">
        <Link className="button" to={`/create?prompt=${encodeURIComponent(trigger.raw_prompt)}`}>
          Use this request
        </Link>
        <button
          type="button"
          className="button"
          onClick={() => {
            setLoadError('');
            setReloadKey((key) => key + 1);
          }}
        >
          Refresh
        </button>
        {canToggle && (
          <button className="button" onClick={toggleStatus} disabled={togglingStatus || deleting}>
            {togglingStatus ? 'Updating...' : trigger.status === 'paused' ? 'Resume' : 'Pause'}
          </button>
        )}
        {confirmingDelete && (
          <button
            className="button"
            onClick={() => setConfirmingDelete(false)}
            disabled={deleting || togglingStatus}
          >
            Cancel
          </button>
        )}
        <button
          className="button button-danger"
          onClick={handleDelete}
          disabled={deleting || togglingStatus}
        >
          {deleting ? 'Deleting...' : confirmingDelete ? 'Confirm delete' : 'Delete'}
        </button>
      </div>

      <h3>History (latest 100)</h3>
      {events.length === 0 ? (
        <p className="empty-state">No alerts fired yet.</p>
      ) : (
        <ul className="event-list">
          {events.map((event) => (
            <li key={event.id} className="card">
              <div>{event.payload.body}</div>
              <div className="event-time">
                {new Date(event.fired_at).toLocaleString()} ·{' '}
                {event.channels_sent?.length ? 'Push sent' : 'No push sent'}
              </div>
              {event.error && <div className="warn-text">{event.error}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
