import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';

export default function LandingPage() {
  const { user } = useAuth();
  useDocumentTitle();

  return (
    <div className="hero">
      <span className="hero-kicker">Plain-English alerts</span>
      <h1>Say it. We'll watch it.</h1>
      <p className="subtitle">
        Describe a weather, sports, or crypto condition. Trigger checks it every 15 minutes and
        sends a push alert when it fires.
      </p>
      <Link to={user ? '/create' : '/auth'} className="button button-primary">
        {user ? 'Create a trigger' : 'Get started'}
      </Link>

      <div className="stack examples">
        <div className="card">"Let me know when the rain clears up in Boston"</div>
        <div className="card">"Tell me if the England vs Ghana score becomes tied"</div>
        <div className="card">"Alert me when Bitcoin drops below $50,000"</div>
      </div>
      <div className="hero-steps" aria-label="How Trigger works">
        <div>
          <strong>1. Describe</strong>
          <span>Write what you want to watch.</span>
        </div>
        <div>
          <strong>2. Review</strong>
          <span>Check the parsed condition and edit it.</span>
        </div>
        <div>
          <strong>3. Get alerted</strong>
          <span>Enable push on your device.</span>
        </div>
      </div>
    </div>
  );
}
