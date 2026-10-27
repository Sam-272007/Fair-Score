import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';

/**
 * Mobile-first judge scoring portal (no login required).
 * Handles per-row autosave, progress indicators, scale validation, and status enforcement.
 * Optimized for viewports down to 360px.
 */
export default function JudgePortal() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [portalData, setPortalData] = useState(null);

  // Map of teamId -> { value, status: 'idle' | 'saving' | 'saved' | 'error', errorMsg: string }
  const [rowStates, setRowStates] = useState({});
  const debounceTimers = useRef({});

  useEffect(() => {
    fetchPortalData();
    return () => {
      // Clear timers on unmount
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, [token]);

  const fetchPortalData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/judge/${token}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('This judge link is invalid or has expired. Please contact the event organizer.');
        }
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `Server returned error (${res.status})`);
      }

      const data = await res.json();
      setPortalData(data);

      // Initialize row states
      const initialRowStates = {};
      data.assignedTeams.forEach((team) => {
        initialRowStates[team.id] = {
          value: team.score !== null && team.score !== undefined ? String(team.score) : '',
          status: team.score !== null && team.score !== undefined ? 'saved' : 'idle',
          errorMsg: null
        };
      });
      setRowStates(initialRowStates);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (teamId, newValue) => {
    setRowStates((prev) => ({
      ...prev,
      [teamId]: {
        ...prev[teamId],
        value: newValue,
        status: 'typing',
        errorMsg: null
      }
    }));

    if (debounceTimers.current[teamId]) {
      clearTimeout(debounceTimers.current[teamId]);
    }

    // Auto-save after 600ms debounce
    debounceTimers.current[teamId] = setTimeout(() => {
      saveScore(teamId, newValue);
    }, 600);
  };

  const saveScore = async (teamId, val) => {
    if (!val || val.trim() === '') {
      setRowStates((prev) => ({
        ...prev,
        [teamId]: { ...prev[teamId], status: 'idle', errorMsg: null }
      }));
      return;
    }

    const numVal = Number(val);
    const { min, max } = portalData.scoringScale;

    if (Number.isNaN(numVal) || numVal < min || numVal > max) {
      setRowStates((prev) => ({
        ...prev,
        [teamId]: {
          ...prev[teamId],
          status: 'error',
          errorMsg: `Score must be between ${min} and ${max}`
        }
      }));
      return;
    }

    setRowStates((prev) => ({
      ...prev,
      [teamId]: { ...prev[teamId], status: 'saving', errorMsg: null }
    }));

    try {
      const res = await fetch(`/api/judge/${token}/scores/${teamId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: numVal })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || 'Failed to save score');
      }

      setRowStates((prev) => ({
        ...prev,
        [teamId]: { ...prev[teamId], status: 'saved', errorMsg: null }
      }));
    } catch (err) {
      setRowStates((prev) => ({
        ...prev,
        [teamId]: { ...prev[teamId], status: 'error', errorMsg: err.message }
      }));
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '3rem 1.25rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Loading your judging portal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ padding: '3rem 1.25rem', maxWidth: '540px' }}>
        <div className="alert alert-danger" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Unable to Open Judge Portal</h2>
          <p style={{ fontSize: '0.9375rem', marginBottom: '1.5rem' }}>{error}</p>
          <button type="button" className="btn btn-secondary" onClick={fetchPortalData}>
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const { eventName, eventStatus, scoringScale, judgeName, assignedTeams } = portalData;
  const isScoringOpen = eventStatus === 'scoring';

  // Calculate progress
  const scoredCount = Object.values(rowStates).filter((r) => r.status === 'saved' && r.value !== '').length;
  const totalTeams = assignedTeams.length;
  const progressPercent = totalTeams > 0 ? Math.round((scoredCount / totalTeams) * 100) : 0;

  return (
    <div className="container" style={{ padding: '1.5rem 1rem', maxWidth: '640px' }}>
      {/* Event and Judge Header */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              FairScore Judging Portal
            </span>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '0.15rem' }}>{eventName}</h1>
          </div>
          <span
            className={`badge ${
              eventStatus === 'scoring'
                ? 'badge-success'
                : eventStatus === 'locked' || eventStatus === 'published'
                ? 'badge-danger'
                : 'badge-warning'
            }`}
          >
            {eventStatus === 'scoring' ? 'Scoring Open' : eventStatus === 'locked' ? 'Scoring Locked' : eventStatus === 'published' ? 'Published' : 'Setup'}
          </span>
        </div>

        <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--color-text)' }}>
          Judge: <strong>{judgeName}</strong>
        </div>

        {/* Progress Bar */}
        <div style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.35rem' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>
              Completed: <strong>{scoredCount}</strong> of <strong>{totalTeams}</strong> teams
            </span>
            <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{progressPercent}%</span>
          </div>
          <div className="bar-container">
            <div className="bar-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Lock alert if closed */}
      {!isScoringOpen && (
        <div className="alert alert-warning" style={{ marginBottom: '1.25rem' }}>
          <strong>Notice:</strong>{' '}
          {eventStatus === 'locked' || eventStatus === 'published'
            ? 'Scoring is closed. Scores cannot be edited.'
            : 'Scoring has not started yet.'}
        </div>
      )}

      {/* Scoring Scale Guidelines */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.625rem 1rem',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          fontSize: '0.8125rem',
          marginBottom: '1rem',
          color: 'var(--color-text-muted)'
        }}
      >
        <span>
          Scoring Scale: <strong>{scoringScale.min}</strong> (Lowest) to <strong>{scoringScale.max}</strong> (Highest)
        </span>
        <span>Decimals allowed (e.g. 8.5)</span>
      </div>

      {/* Assigned Teams List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {assignedTeams.map((team, idx) => {
          const row = rowStates[team.id] || { value: '', status: 'idle', errorMsg: null };

          return (
            <div
              key={team.id}
              className="card"
              style={{
                padding: '1rem',
                borderLeft: row.status === 'saved' ? '4px solid var(--color-success)' : '4px solid var(--color-border)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-text-subtle)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    #{idx + 1}
                  </span>
                  <strong style={{ fontSize: '1rem', color: 'var(--color-text)' }}>{team.name}</strong>
                </div>

                {/* Status indicator */}
                <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  {row.status === 'saving' && (
                    <span style={{ color: 'var(--color-primary)' }}>Saving...</span>
                  )}
                  {row.status === 'saved' && (
                    <span style={{ color: 'var(--color-success)' }}>Saved ✓</span>
                  )}
                  {row.status === 'error' && (
                    <button
                      type="button"
                      onClick={() => saveScore(team.id, row.value)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-danger)',
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline'
                      }}
                    >
                      Failed · Tap to retry
                    </button>
                  )}
                </div>
              </div>

              {/* Input row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="number"
                  step="0.1"
                  min={scoringScale.min}
                  max={scoringScale.max}
                  disabled={!isScoringOpen}
                  placeholder={`Score (${scoringScale.min}-${scoringScale.max})`}
                  className="form-input"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    maxWidth: '180px'
                  }}
                  value={row.value}
                  onChange={(e) => handleScoreChange(team.id, e.target.value)}
                  onBlur={() => saveScore(team.id, row.value)}
                />
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  / {scoringScale.max}
                </span>
              </div>

              {row.errorMsg && (
                <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '0.375rem' }}>
                  {row.errorMsg}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.8125rem', color: 'var(--color-text-subtle)' }}>
        FairScore · Changes are automatically saved as you enter scores.
      </div>
    </div>
  );
}
