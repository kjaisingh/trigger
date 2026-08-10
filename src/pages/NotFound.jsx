import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';

export default function NotFound() {
  useDocumentTitle('Page not found');

  return (
    <div className="hero">
      <h1>404</h1>
      <p className="subtitle">This page doesn't exist, or may have moved.</p>
      <Link to="/" className="button button-primary">
        Back to home
      </Link>
    </div>
  );
}
