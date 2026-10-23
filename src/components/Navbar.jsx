import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { disablePush } from '../lib/push.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, loading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSignOutError('');
    setSigningOut(true);
    try {
      let cleanupFailed = false;
      try {
        await disablePush();
      } catch {
        cleanupFailed = true;
      }
      const { error } = await signOut();
      if (error) throw error;
      setMenuOpen(false);
      // Clear account-specific UI and avoid competing auth redirects.
      window.location.replace(cleanupFailed ? '/?notificationCleanup=failed' : '/');
    } catch (error) {
      setSignOutError(error.message || 'Could not sign out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header
      className="navbar"
      onKeyDown={(event) => {
        if (event.key === 'Escape') closeMenu();
      }}
    >
      <Link to="/" className="brand" onClick={closeMenu}>
        <svg viewBox="0 0 32 32" className="brand-icon" aria-hidden="true">
          <rect width="32" height="32" rx="7" fill="#0f1115" />
          <path d="M17.5 4 8 18h6.5L14 28l9.5-14H17l3-10-2.5-.4z" fill="var(--accent)" />
        </svg>
        Trigger
      </Link>
      <button
        className={`nav-toggle ${menuOpen ? 'is-open' : ''}`}
        aria-label="Toggle navigation menu"
        aria-expanded={menuOpen}
        aria-controls="main-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>
      <nav
        id="main-navigation"
        aria-label="Main navigation"
        className={`nav-links ${menuOpen ? 'is-open' : ''}`}
      >
        {loading ? null : user ? (
          <>
            <NavLink to="/dashboard" onClick={closeMenu}>
              Dashboard
            </NavLink>
            <NavLink to="/settings" onClick={closeMenu}>
              Settings
            </NavLink>
            <button className="link-button" onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
            {signOutError && (
              <p className="error-text" role="alert">
                {signOutError}
              </p>
            )}
          </>
        ) : (
          <Link to="/auth" onClick={closeMenu}>
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
