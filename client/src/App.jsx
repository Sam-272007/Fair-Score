import React from 'react';
import { Routes, Route, Link, NavLink } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import ColdStartBanner from './components/ColdStartBanner.jsx';
import Home from './pages/Home.jsx';
import CreateEvent from './pages/CreateEvent.jsx';
import QuickAnalyze from './pages/QuickAnalyze.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import JudgePortal from './pages/JudgePortal.jsx';
import PublicResults from './pages/PublicResults.jsx';

function NotFound() {
  return (
    <div className="container" style={{ padding: '5rem 1.25rem', textAlign: 'center', maxWidth: '540px' }}>
      <div className="card" style={{ padding: '3rem 1.5rem' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--color-primary)' }}>404</h1>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '0.5rem' }}>Page Not Found</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: '1rem 0 2rem' }}>
          The requested page or link does not exist. Please check your URL or return home.
        </p>
        <Link to="/" className="btn btn-primary">
          Back to FairScore Home
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <ColdStartBanner />
        <header className="site-header">
          <div className="container nav-container">
            <Link to="/" className="brand">
              <span style={{ fontSize: '1.4rem' }}>⚖️</span>
              <span>FairScore</span>
              <span className="brand-badge">Engine v1.0</span>
            </Link>

            <nav className="nav-links">
              <NavLink
                to="/"
                end
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Home
              </NavLink>
              <NavLink
                to="/analyze"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Quick Analyze
              </NavLink>
              <NavLink to="/new" className="btn btn-primary btn-sm">
                + New Event
              </NavLink>
            </nav>
          </div>
        </header>

        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/new" element={<CreateEvent />} />
            <Route path="/analyze" element={<QuickAnalyze />} />
            <Route path="/admin/:id" element={<AdminDashboard />} />
            <Route path="/judge/:token" element={<JudgePortal />} />
            <Route path="/results/:id" element={<PublicResults />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        <footer
          style={{
            borderTop: '1px solid var(--color-border-subtle)',
            padding: '2rem 1.25rem',
            textAlign: 'center',
            fontSize: '0.8125rem',
            color: 'var(--color-text-subtle)',
            backgroundColor: 'rgba(11, 15, 25, 0.8)'
          }}
        >
          <div className="container">
            <p>
              FairScore — University End-Term Software Engineering Project (Due 27 Oct 2026, 11:59 PM IST).
            </p>
            <p style={{ marginTop: '0.35rem' }}>
              Free & Open Bias-Corrected Judging · Iterative Normalization · Connectivity & Sensitivity Diagnostics
            </p>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
