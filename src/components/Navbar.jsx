import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    navigate('/');
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="navbar">
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
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>
      <nav className={`nav-links ${menuOpen ? 'is-open' : ''}`}>
        {user ? (
          <>
            <Link to="/dashboard" onClick={closeMenu}>
              Dashboard
            </Link>
            <Link to="/settings" onClick={closeMenu}>
              Settings
            </Link>
            <button className="link-button" onClick={handleSignOut}>
              Sign out
            </button>
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
