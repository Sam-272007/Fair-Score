import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';

function Home() {
  return (
    <div className="container" style={{ padding: '3rem 1.25rem' }}>
      <h1>FairScore</h1>
      <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
        Bias-corrected judging and ranking for hackathons and competitions.
      </p>
      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
        <Link to="/new" className="btn btn-primary">Create Event</Link>
        <Link to="/analyze" className="btn btn-secondary">Quick Analyze CSV</Link>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="container" style={{ padding: '4rem 1.25rem', textAlign: 'center' }}>
      <h2>404 - Page Not Found</h2>
      <p style={{ color: 'var(--color-text-muted)', margin: '1rem 0 2rem' }}>
        The page you are looking for does not exist.
      </p>
      <Link to="/" className="btn btn-primary">Back to Home</Link>
    </div>
  );
}

export default function App() {
  return (
    <div>
      <header className="site-header">
        <div className="container nav-container">
          <Link to="/" className="brand">
            <span>FairScore</span>
            <span className="brand-badge">Alpha</span>
          </Link>
          <nav className="nav-links">
            <Link to="/analyze" className="nav-link">Quick Analyze</Link>
            <Link to="/new" className="btn btn-primary btn-sm">New Event</Link>
          </nav>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
