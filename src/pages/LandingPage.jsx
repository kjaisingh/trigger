import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';

export default function LandingPage() {
  const { user } = useAuth();
  useDocumentTitle();

  return (
    <div className="hero">
      <h1>Say it. We'll watch it.</h1>
      <p className="subtitle">
        Describe what you're waiting for in plain English - weather, sports, or crypto prices.
        Trigger watches it for you and pings you the moment it happens.
      </p>
      <Link to={user ? '/create' : '/auth'} className="button button-primary">
        {user ? 'Create a trigger' : 'Get started'}
      </Link>

      <div className="stack examples">
        <div className="card">"Let me know when the rain clears up in Boston"</div>
        <div className="card">"Tell me if the England vs Ghana score becomes tied"</div>
        <div className="card">"Alert me when Bitcoin drops below $50,000"</div>
      </div>
    </div>
  );
}
