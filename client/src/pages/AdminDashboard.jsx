import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import RankingTable from '../components/RankingTable.jsx';
import JudgeBars from '../components/JudgeBars.jsx';
import Warnings from '../components/Warnings.jsx';
import StabilityPanel from '../components/StabilityPanel.jsx';

/**
 * Organizer Admin Dashboard.
 *
 * Features:
 * - Capability token extracted from URL fragment (#t=<token>)
 * - Status transition lifecycle (setup -> scoring -> locked -> published; reopen locked -> scoring)
 * - Per-judge scoring progress with one-click link copying
 * - Comparative 3-method rankings, judge harshness, stability, and diagnostic warnings
 * - 10-second polling auto-refresh paused when tab is hidden
 * - CSV export
 */
export default function AdminDashboard() {
  const { id: eventId } = useParams();

  const [token, setToken] = useState(() => {
    // Extract token from hash: #t=<token>
    const hash = window.location.hash || '';
    const match = hash.match(/t=([^&]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
    // Check localStorage fallback
    try {
      const stored = JSON.parse(localStorage.getItem('fairscore_my_events') || '[]');
      const found = stored.find((e) => e.id === eventId);
      return found?.adminToken || '';
    } catch {
      return '';
    }
  });

  const [inputToken, setInputToken] = useState('');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const pollTimerRef = useRef(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    fetchDashboard();

    // Setup 10s polling, paused when document is hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      } else {
        fetchDashboard();
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    startPolling();

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [eventId, token]);

  const startPolling = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(() => {
      if (!document.hidden) {
        fetchDashboard(true);
      }
    }, 10000);
  };

  const fetchDashboard = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/${eventId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('Unauthorized: Invalid or missing admin capability token.');
        }
        if (res.status === 404) {
          throw new Error('Event not found.');
        }
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `Error fetching dashboard (${res.status})`);
      }

      const data = await res.json();
      setDashboardData(data);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const handleTokenSubmit = (e) => {
    e.preventDefault();
    if (inputToken.trim()) {
      const cleanToken = inputToken.trim();
      setToken(cleanToken);
      window.location.hash = `t=${cleanToken}`;
    }
  };

  const handleStatusChange = async (nextStatus) => {
    setStatusUpdating(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/${eventId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `Failed to transition status to ${nextStatus}`);
      }

      await fetchDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await fetch(`/api/admin/${eventId}/export.csv`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fairscore-${eventId}-scores.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert(`Export error: ${err.message}`);
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // If token is missing, ask organizer to supply capability token
  if (!token) {
    return (
      <div className="container" style={{ padding: '3.5rem 1.25rem', maxWidth: '540px' }}>
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            Admin Capability Token Required
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            Organizer dashboard access requires your capability token. Enter the token you received when creating the event:
          </p>
          <form onSubmit={handleTokenSubmit}>
            <div className="form-group">
              <label htmlFor="token-input" className="form-label">
                Admin Token
              </label>
              <input
                id="token-input"
                type="text"
                required
                className="form-input"
                placeholder="Paste your base64url admin token"
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading && !dashboardData) {
    return (
      <div className="container" style={{ padding: '3rem 1.25rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Loading event dashboard...</p>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <div className="container" style={{ padding: '3rem 1.25rem', maxWidth: '600px' }}>
        <div className="alert alert-danger" style={{ textAlign: 'center', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Access Error</h2>
          <p style={{ marginBottom: '1.5rem' }}>{error}</p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => fetchDashboard(false)}
            >
              Retry Connection
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setToken('');
                window.location.hash = '';
              }}
            >
              Re-enter Admin Token
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { name, status, teams, judges, scoresCount, analysis } = dashboardData;

  const totalAssignedSlots = judges.reduce((acc, j) => acc + j.assignedCount, 0);
  const totalCompletedSlots = judges.reduce((acc, j) => acc + j.completedCount, 0);
  const overallPercent = totalAssignedSlots > 0 ? Math.round((totalCompletedSlots / totalAssignedSlots) * 100) : 0;

  return (
    <div className="container" style={{ padding: '2rem 1.25rem' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>{name}</h1>
            <span
              className={`badge ${
                status === 'scoring'
                  ? 'badge-success'
                  : status === 'locked'
                  ? 'badge-warning'
                  : status === 'published'
                  ? 'badge-info'
                  : 'badge-info'
              }`}
            >
              Status: {status.toUpperCase()}
            </span>
          </div>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-subtle)', marginTop: '0.25rem', display: 'block' }}>
            Auto-refreshing every 10s · Last updated:{' '}
            {lastRefreshed ? lastRefreshed.toLocaleTimeString() : 'Just now'}
          </span>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
          {status === 'setup' && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleStatusChange('scoring')}
              disabled={statusUpdating}
            >
              ▶ Open Scoring
            </button>
          )}

          {status === 'scoring' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleStatusChange('locked')}
              disabled={statusUpdating}
            >
              🔒 Lock Scoring
            </button>
          )}

          {status === 'locked' && (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleStatusChange('scoring')}
                disabled={statusUpdating}
              >
                🔓 Reopen Scoring
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleStatusChange('published')}
                disabled={statusUpdating}
              >
                📢 Publish Official Results
              </button>
            </>
          )}

          {status === 'published' && (
            <Link to={`/results/${eventId}`} className="btn btn-primary btn-sm">
              View Public Results Page ↗
            </Link>
          )}

          <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportCsv}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {/* Progress Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        <div className="card" style={{ padding: '1rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Overall Completion
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)', margin: '0.25rem 0' }}>
            {overallPercent}%
          </div>
          <div className="bar-container">
            <div className="bar-fill" style={{ width: `${overallPercent}%` }} />
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', marginTop: '0.35rem', display: 'block' }}>
            {totalCompletedSlots} / {totalAssignedSlots} assigned evaluations
          </span>
        </div>

        <div className="card" style={{ padding: '1rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Teams
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)', margin: '0.25rem 0' }}>
            {teams.length}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>
            Competing projects
          </span>
        </div>

        <div className="card" style={{ padding: '1rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Active Judges
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)', margin: '0.25rem 0' }}>
            {judges.length}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>
            Evaluating judges
          </span>
        </div>

        <div className="card" style={{ padding: '1rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Total Scores Logged
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)', margin: '0.25rem 0' }}>
            {scoresCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>
            Recorded in database
          </span>
        </div>
      </div>

      {/* Per-Judge Progress Section */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
          Judge Roster & Private Links
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {judges.map((j) => (
            <div
              key={j.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(140px, 1.5fr) minmax(140px, 2fr) auto',
                alignItems: 'center',
                gap: '1rem',
                padding: '0.75rem',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                fontSize: '0.875rem'
              }}
            >
              <div>
                <strong>{j.name}</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', display: 'block' }}>
                  {j.completedCount} of {j.assignedCount} scored
                </span>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Progress</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{j.progressPercent}%</span>
                </div>
                <div className="bar-container">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${j.progressPercent}%`,
                      backgroundColor: j.progressPercent === 100 ? 'var(--color-success)' : 'var(--color-primary)'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => copyToClipboard(j.url, j.id)}
                >
                  {copiedKey === j.id ? 'Copied! ✓' : 'Copy Link'}
                </button>
                <a href={j.url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                  Open ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Analysis Section (when data exists) */}
      {analysis && analysis.teams && analysis.teams.length > 0 ? (
        <div>
          <Warnings warnings={analysis.warnings} componentCount={analysis.componentCount} />
          <RankingTable teams={analysis.teams} recommended={analysis.recommended} />
          <JudgeBars judges={analysis.judges} />
          <StabilityPanel stability={analysis.stability} teams={analysis.teams} />
        </div>
      ) : (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>Waiting for Scores</h3>
          <p style={{ fontSize: '0.875rem' }}>
            As judges submit their evaluations, bias-correction models, harshness metrics, and sensitivity diagnostics will update automatically.
          </p>
        </div>
      )}
    </div>
  );
}
