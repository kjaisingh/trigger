import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import TriggerCard from '../components/TriggerCard.jsx';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';
import { describeSubject } from '../lib/summarize.js';
import { checkHealth } from '../lib/checkHealth.js';

export default function Dashboard() {
  useDocumentTitle('Dashboard');
  const [triggers, setTriggers] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');

  useEffect(() => {
    let active = true;
    api
      .get('/api/triggers')
      .then((data) => {
        if (active) setTriggers(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const filtered = triggers?.filter(
    (trigger) =>
      (status === 'all' || trigger.status === status) &&
      `${trigger.raw_prompt} ${trigger.domain} ${describeSubject(trigger.domain, trigger.subject)}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );

  return (
    <div className="stack">
      <div className="row row-between page-heading">
        <div>
          <h2>Your triggers</h2>
          <p className="muted">Manage conditions and review recent checks.</p>
        </div>
        <div className="row page-actions">
          <button
            type="button"
            className="button"
            onClick={() => {
              setError('');
              setTriggers(null);
              setReloadKey((key) => key + 1);
            }}
          >
            Refresh
          </button>
          <Link to="/create" className="button button-primary">
            New trigger
          </Link>
        </div>
      </div>
      {error ? (
        <div className="empty-state" role="alert">
          <p>Couldn't load your triggers: {error}</p>
          <button
            type="button"
            className="button"
            onClick={() => {
              setError('');
              setReloadKey((key) => key + 1);
            }}
          >
            Try again
          </button>
        </div>
      ) : !triggers ? (
        <p className="empty-state" role="status">
          Loading triggers...
        </p>
      ) : triggers.length === 0 ? (
        <div className="empty-state">
          <p>No triggers yet. Create one to get started.</p>
          <Link className="button" to="/create">
            Create a trigger
          </Link>
        </div>
      ) : (
        <>
          <div className="dashboard-summary" aria-label="Trigger overview">
            {[
              ['Watching', triggers.filter((t) => t.status === 'active').length],
              ['Paused', triggers.filter((t) => t.status === 'paused').length],
              ['Fired', triggers.filter((t) => t.status === 'fired').length],
              [
                'Need attention',
                triggers.filter(
                  (t) => t.status === 'active' && (t.last_state?.error || checkHealth(t)?.delayed),
                ).length,
              ],
            ].map(([label, count]) => (
              <div className="summary-item" key={label}>
                <strong>{count}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className="row trigger-filters">
            <input
              aria-label="Search triggers"
              type="search"
              placeholder="Search triggers"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="fired">Fired</option>
              <option value="unsupported">Unsupported</option>
              <option value="error">Error</option>
            </select>
          </div>
          <p className="muted" role="status">
            Showing {filtered.length} of {triggers.length} triggers
          </p>
          {filtered.length ? (
            <div className="trigger-grid">
              {filtered.map((trigger) => (
                <TriggerCard key={trigger.id} trigger={trigger} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No triggers match those filters.</p>
              <button
                className="button"
                onClick={() => {
                  setQuery('');
                  setStatus('all');
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
