import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <header className="navbar">
      <Link to="/" className="brand">
        Trigger
      </Link>
      <nav className="nav-links">
        {user ? (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/create">New trigger</Link>
            <Link to="/settings">Settings</Link>
            <button className="link-button" onClick={handleSignOut}>
              Sign out
            </button>
          </>
        ) : (
          <Link to="/auth">Sign in</Link>
        )}
      </nav>
    </header>
  );
}
