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
            <Link to="/create" onClick={closeMenu}>
              New trigger
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
