import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import TriggerCard from '../components/TriggerCard.jsx';

export default function Dashboard() {
  const [triggers, setTriggers] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/triggers').then(setTriggers).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="stack">
      <div className="row row-between">
        <h2>Your triggers</h2>
        <Link to="/create" className="button button-primary">
          New trigger
        </Link>
      </div>

      {error ? (
        <p className="empty-state">Couldn't load your triggers: {error}</p>
      ) : !triggers ? (
        <p className="empty-state">Loading...</p>
      ) : triggers.length === 0 ? (
        <p className="empty-state">No triggers yet. Create one to get started.</p>
      ) : (
        <div className="trigger-grid">
          {triggers.map((trigger) => (
            <TriggerCard key={trigger.id} trigger={trigger} />
          ))}
        </div>
      )}
    </div>
  );
}
