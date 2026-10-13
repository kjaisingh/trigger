import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';

export default function AuthPage() {
  const {
    user,
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    passwordRecovery,
    clearPasswordRecovery,
  } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useDocumentTitle(
    passwordRecovery
      ? 'Set new password'
      : mode === 'signin'
        ? 'Sign in'
        : mode === 'signup'
          ? 'Sign up'
          : 'Reset password',
  );

  if (passwordRecovery) {
    return (
      <RecoveryForm
        onSubmit={async (newPassword) => {
          const { error } = await updatePassword(newPassword);
          if (error) throw error;
          clearPasswordRecovery();
          navigate('/dashboard');
        }}
      />
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);

    try {
      if (mode === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) throw error;
        setInfo('Check your email for a link to reset your password.');
        return;
      }

      if (mode === 'signup' && password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      const { data, error } =
        mode === 'signin' ? await signIn(email, password) : await signUp(email, password);
      if (error) throw error;

      if (mode === 'signup' && !data.session) {
        setInfo('Check your email to confirm your account, then sign in.');
        setMode('signin');
        return;
      }

      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(next) {
    setError('');
    setInfo('');
    setMode(next);
  }

  const mismatch = mode === 'signup' && confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="auth-page">
      <div className="card auth-card stack">
        <h2>
          {mode === 'signin'
            ? 'Sign in'
            : mode === 'signup'
              ? 'Create an account'
              : 'Reset password'}
        </h2>
        {mode === 'forgot' && (
          <p className="subtitle-muted">Enter your email and we'll send you a reset link.</p>
        )}
        <form onSubmit={handleSubmit} className="stack">
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            autoComplete="email"
          />
          {mode !== 'forgot' && (
            <>
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </>
          )}
          {mode === 'signup' && (
            <>
              <label htmlFor="auth-confirm">Confirm password</label>
              <input
                id="auth-confirm"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </>
          )}
          {mismatch && <p className="error-text">Passwords don't match.</p>}
          {info && <p role="status">{info}</p>}
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="button button-primary" disabled={submitting || mismatch}>
            {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Sign up' : 'Send reset link'}
          </button>
        </form>
        <div className="stack auth-links">
          {mode === 'signin' && (
            <button className="link-button" onClick={() => switchMode('forgot')}>
              Forgot your password?
            </button>
          )}
          {mode === 'forgot' ? (
            <button className="link-button" onClick={() => switchMode('signin')}>
              Back to sign in
            </button>
          ) : (
            <button
              className="link-button"
              onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
            >
              {mode === 'signin'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RecoveryForm({ onSubmit }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(password);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card stack">
        <h2>Set a new password</h2>
        <form onSubmit={handleSubmit} className="stack">
          <label htmlFor="recovery-password">New password</label>
          <input
            id="recovery-password"
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoFocus
            autoComplete="new-password"
          />
          <label htmlFor="recovery-confirm">Confirm new password</label>
          <input
            id="recovery-confirm"
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
          {mismatch && <p className="error-text">Passwords don't match.</p>}
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="button button-primary" disabled={submitting || mismatch}>
            Save password
          </button>
        </form>
      </div>
    </div>
  );
}
