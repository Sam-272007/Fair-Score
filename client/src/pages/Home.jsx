import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/**
 * Home page with quick actions, recent "My Events" stored locally, and an instant Demo Event trigger.
 */
export default function Home() {
  const navigate = useNavigate();
  const [myEvents, setMyEvents] = useState([]);
  const [isCreatingDemo, setIsCreatingDemo] = useState(false);
  const [demoError, setDemoError] = useState(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('fairscore_my_events') || '[]');
      setMyEvents(stored);
    } catch {
      setMyEvents([]);
    }
  }, []);

  const handleCreateDemo = async () => {
    setIsCreatingDemo(true);
    setDemoError(null);

    try {
      const res = await fetch('/api/events/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || 'Failed to create demo event');
      }

      const data = await res.json();

      // Save to localStorage
      const newEntry = {
        id: data.eventId,
        name: data.name,
        adminUrl: data.adminUrl,
        adminToken: data.adminToken,
        createdAt: new Date().toISOString()
      };
      const updated = [newEntry, ...myEvents.filter((e) => e.id !== data.eventId)];
      localStorage.setItem('fairscore_my_events', JSON.stringify(updated));
      setMyEvents(updated);

      // Navigate to organizer dashboard
      window.location.href = data.adminUrl;
    } catch (err) {
      setDemoError(err.message);
    } finally {
      setIsCreatingDemo(false);
    }
  };

  const removeStoredEvent = (id) => {
    const updated = myEvents.filter((e) => e.id !== id);
    setMyEvents(updated);
    localStorage.setItem('fairscore_my_events', JSON.stringify(updated));
  };

  return (
    <div className="container" style={{ padding: '3.5rem 1.25rem', maxWidth: '880px' }}>
      {/* Hero section */}
      <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
        <span
          className="badge badge-info"
          style={{ marginBottom: '1rem', padding: '0.35rem 0.85rem', fontSize: '0.8125rem' }}
        >
          Iterative Bias Correction & Graph Diagnostics
        </span>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
          Eliminate Judge Bias in Scored Competitions
        </h1>
        <p
          style={{
            color: 'var(--color-text-muted)',
            fontSize: '1.125rem',
            maxWidth: '640px',
            margin: '1.25rem auto 2rem',
            lineHeight: 1.6
          }}
        >
          In hackathons and project contests, judges see different subsets of teams. Raw averages confuse judge strictness with project quality.
          FairScore mathematically corrects for judge harshness, plans connected overlap, and alerts you when rankings are sensitive.
        </p>

        {demoError && (
          <div className="alert alert-danger" style={{ maxWidth: '540px', margin: '0 auto 1.5rem' }}>
            {demoError}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to="/new" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}>
            + Create New Event
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
            onClick={handleCreateDemo}
            disabled={isCreatingDemo}
          >
            {isCreatingDemo ? 'Generating Demo...' : '⚡ Launch Demo Dashboard'}
          </button>
          <Link to="/analyze" className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}>
            📂 Quick Analyze CSV
          </Link>
        </div>
      </div>

      {/* Honest differentiation note */}
      <div
        className="card"
        style={{
          marginBottom: '3rem',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          borderColor: 'var(--color-border-subtle)'
        }}
      >
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
          Honest Differentiation
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.6 }}>
          Per-judge normalization already exists in some paid judging platforms. FairScore is free, explains the correction, plans judge overlap, and warns when the data cannot support a reliable correction.
        </p>
      </div>

      {/* My Events Section */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
          My Admin Events ({myEvents.length})
        </h2>

        {myEvents.length === 0 ? (
          <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <p>No local events saved on this device yet.</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-subtle)', marginTop: '0.25rem' }}>
              When you create an event, your capability admin link is preserved here automatically.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {myEvents.map((ev) => (
              <div
                key={ev.id}
                className="card"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem 1.25rem',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}
              >
                <div>
                  <strong style={{ fontSize: '1.05rem', display: 'block', color: 'var(--color-text)' }}>
                    {ev.name}
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>
                    Created: {new Date(ev.createdAt).toLocaleDateString()} · ID: {ev.id}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <a href={ev.adminUrl} className="btn btn-primary btn-sm">
                    Open Dashboard →
                  </a>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => removeStoredEvent(ev.id)}
                    title="Remove from local list"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feature pillars */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚖️</div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.35rem' }}>
            Additive Bias Model
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            Decouples intrinsic team quality from harsh or lenient scoring tendencies through alternating least-squares convergence.
          </p>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🕸️</div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.35rem' }}>
            Graph Connectivity Checks
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            Analyzes the judge-team bipartite graph via BFS. Warns immediately when isolated pods prevent direct comparison.
          </p>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔍</div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.35rem' }}>
            Leave-One-Out Sensitivity
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            Identifies vulnerable rankings by dropping judges one at a time, flagging volatile teams and podium changes.
          </p>
        </div>
      </div>
    </div>
  );
}
