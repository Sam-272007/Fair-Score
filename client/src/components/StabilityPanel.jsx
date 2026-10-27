import React from 'react';

/**
 * Leave-one-out sensitivity diagnostics panel.
 * Shows whether the ranking and top-3 podium are resilient to the removal of individual judges.
 */
export default function StabilityPanel({ stability = {}, teams = [] }) {
  const { removalsTested = 0, skippedRemovals = [], top3Unchanged = true } = stability;

  const unstableTeams = teams.filter((t) => !t.stable);

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Leave-One-Out Sensitivity Analysis</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
          Simulates ranking resilience by systematically removing each judge and re-evaluating the model.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {/* Metric 1: Removals tested */}
        <div style={{ padding: '1rem', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Judges Tested
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
            {removalsTested}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>
            {skippedRemovals.length} skipped to protect connectivity
          </span>
        </div>

        {/* Metric 2: Podium status */}
        <div style={{ padding: '1rem', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Top 3 Podium Stability
          </span>
          <div style={{ fontSize: '1.125rem', fontWeight: 700, marginTop: '0.35rem', color: top3Unchanged ? 'var(--color-success)' : 'var(--color-warning)' }}>
            {top3Unchanged ? '✓ Resilient' : '⚡ Sensitive'}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>
            {top3Unchanged ? 'Top 3 set unchanged across removals' : 'Podium composition changes if 1 judge removed'}
          </span>
        </div>

        {/* Metric 3: Sensitive teams count */}
        <div style={{ padding: '1rem', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Volatile Teams (Shift &gt; 1)
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', fontFamily: 'var(--font-mono)', color: unstableTeams.length === 0 ? 'var(--color-success)' : 'var(--color-warning)' }}>
            {unstableTeams.length}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>
            {unstableTeams.length === 0 ? 'All team positions are stable' : `${unstableTeams.map((t) => t.team).join(', ')}`}
          </span>
        </div>
      </div>

      {/* Skipped removals list */}
      {skippedRemovals.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
            Connectivity Guard (Skipped Removals)
          </h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.8125rem' }}>
            {skippedRemovals.map((skip, i) => (
              <li
                key={i}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: '3px solid var(--color-border)',
                  color: 'var(--color-text-muted)'
                }}
              >
                <strong style={{ color: 'var(--color-text)' }}>Judge {skip.judge}:</strong> {skip.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
