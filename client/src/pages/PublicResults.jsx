import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Warnings from '../components/Warnings.jsx';

/**
 * Public Results Page for Published Events.
 *
 * Displays:
 * - Official verified final ranking
 * - Plain-language explanation of bias-corrected methodology
 * - Data integrity and stability warnings summary
 */
export default function PublicResults() {
  const { id: eventId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchResults();
  }, [eventId]);

  const fetchResults = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/results/${eventId}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Official results have not been published yet or the event does not exist.');
        }
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || 'Failed to load official results');
      }

      const resData = await res.json();
      setData(resData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '3.5rem 1.25rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Loading official event results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ padding: '3.5rem 1.25rem', maxWidth: '580px' }}>
        <div className="alert alert-warning" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Results Not Available</h2>
          <p style={{ fontSize: '0.9375rem', marginBottom: '1.5rem' }}>{error}</p>
          <Link to="/" className="btn btn-primary">
            Return to FairScore Home
          </Link>
        </div>
      </div>
    );
  }

  const { name, publishedAt, rankings = [], warnings = [], methodologyNote, recommended } = data;

  return (
    <div className="container" style={{ padding: '2.5rem 1.25rem', maxWidth: '800px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <span
          className="badge badge-success"
          style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}
        >
          Official Final Results
        </span>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.25rem' }}>{name}</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
          Published on {new Date(publishedAt).toLocaleDateString()} at{' '}
          {new Date(publishedAt).toLocaleTimeString()}
        </p>
      </div>

      {/* Warnings & Integrity note */}
      <Warnings warnings={warnings} />

      {/* Podium Cards for Top 3 */}
      {rankings.length >= 3 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem'
          }}
        >
          {rankings.slice(0, 3).map((team) => {
            const isFirst = team.rank === 1;
            const isSecond = team.rank === 2;
            const isThird = team.rank === 3;

            return (
              <div
                key={team.team}
                className="card"
                style={{
                  textAlign: 'center',
                  padding: '1.5rem 1rem',
                  borderTop: isFirst
                    ? '4px solid #fbbf24'
                    : isSecond
                    ? '4px solid #9ca3af'
                    : '4px solid #b45309',
                  backgroundColor: isFirst ? 'rgba(251, 191, 36, 0.05)' : 'var(--color-surface)'
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>
                  {isFirst ? '🥇' : isSecond ? '🥈' : '🥉'}
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                    fontWeight: 600
                  }}
                >
                  Place #{team.rank}
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0.25rem 0' }}>
                  {team.team}
                </h3>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    fontSize: '1.25rem',
                    color: 'var(--color-primary)'
                  }}
                >
                  {team.score.toFixed(2)}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>
                  Calibrated Quality Score
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Rankings Table */}
      <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
          Complete Standings
        </h3>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Rank</th>
                <th>Team</th>
                <th style={{ textAlign: 'right' }}>FairScore (Calibrated)</th>
                <th style={{ textAlign: 'right' }}>Raw Mean</th>
                <th style={{ textAlign: 'center', width: '90px' }}>Rank Shift</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((team) => (
                <tr key={team.team}>
                  <td>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>#{team.rank}</strong>
                  </td>
                  <td>
                    <strong>{team.team}</strong>
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: 'var(--color-primary)'
                    }}
                  >
                    {team.score.toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                    {team.rawMean.toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                    {team.shift > 0 ? (
                      <span style={{ color: 'var(--color-success)' }}>↑ +{team.shift}</span>
                    ) : team.shift < 0 ? (
                      <span style={{ color: 'var(--color-danger)' }}>↓ {team.shift}</span>
                    ) : (
                      <span style={{ color: 'var(--color-text-subtle)' }}>→ 0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Plain-Language Methodology Note */}
      <div className="card" style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          About FairScore Methodology
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
          {methodologyNote}
        </p>
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-subtle)', marginTop: '0.75rem' }}>
          Recommended calculation method: <strong>{recommended === 'model' ? 'Additive Judge-Effect Normalization' : 'Z-Score Standard Normalization'}</strong>.
        </p>
      </div>
    </div>
  );
}
