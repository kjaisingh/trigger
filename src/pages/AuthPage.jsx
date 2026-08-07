import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthPage() {
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const { error } = mode === 'signin' ? await signIn(email, password) : await signUp(email, password);

    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate('/dashboard');
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h2>{mode === 'signin' ? 'Sign in' : 'Create an account'}</h2>

        <form onSubmit={handleSubmit} className="stack">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="button button-primary" disabled={submitting}>
            {mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <button className="link-button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
