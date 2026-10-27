import React from 'react';

/**
 * Side-by-side comparative ranking table.
 * Shows Raw Average, Z-Score, and Judge-Effect Model side by side, with rank shift indicators.
 */
export default function RankingTable({ teams = [], recommended = 'model' }) {
  if (!teams || teams.length === 0) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        No ranking data available.
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Comparative Rankings</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
            Compare raw arithmetic means against standardized Z-scores and iterative bias-corrected model rankings.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Recommended Method:</span>
          <span className="badge badge-success" style={{ textTransform: 'uppercase' }}>
            {recommended === 'model' ? 'Judge-Effect Model' : 'Z-Score Normalization'}
          </span>
        </div>
      </div>

      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th style={{ width: '60px' }}>Rank</th>
              <th>Team</th>
              <th style={{ textAlign: 'center', width: '70px' }}>Scores</th>
              <th>Raw Average</th>
              <th>Z-Score</th>
              <th
                style={{
                  backgroundColor: recommended === 'model' ? 'rgba(59, 130, 246, 0.15)' : 'inherit',
                  borderTop: recommended === 'model' ? '2px solid var(--color-primary)' : 'none'
                }}
              >
                Model (FairScore) {recommended === 'model' && '★'}
              </th>
              <th style={{ textAlign: 'center', width: '90px' }}>Shift</th>
              <th style={{ width: '90px' }}>Stability</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t, idx) => {
              const displayRank = recommended === 'model' ? t.modelRank : t.zRank;
              const shift = t.shift || 0;

              return (
                <tr key={t.team}>
                  {/* Final rank */}
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        backgroundColor:
                          displayRank === 1
                            ? 'rgba(245, 158, 11, 0.25)'
                            : displayRank === 2
                            ? 'rgba(156, 163, 175, 0.25)'
                            : displayRank === 3
                            ? 'rgba(180, 83, 9, 0.25)'
                            : 'rgba(255, 255, 255, 0.05)',
                        color:
                          displayRank === 1
                            ? '#fbbf24'
                            : displayRank === 2
                            ? '#d1d5db'
                            : displayRank === 3
                            ? '#f59e0b'
                            : 'inherit'
                      }}
                    >
                      {displayRank}
                    </span>
                  </td>

                  {/* Team name */}
                  <td>
                    <strong style={{ color: 'var(--color-text)' }}>{t.team}</strong>
                  </td>

                  {/* Number of scores */}
                  <td style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {t.nScores}
                  </td>

                  {/* Raw Average */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{t.raw.toFixed(2)}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>(#{t.rawRank})</span>
                    </div>
                  </td>

                  {/* Z-Score */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{t.z >= 0 ? `+${t.z.toFixed(2)}` : t.z.toFixed(2)}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>(#{t.zRank})</span>
                    </div>
                  </td>

                  {/* Model */}
                  <td
                    style={{
                      backgroundColor: recommended === 'model' ? 'rgba(59, 130, 246, 0.08)' : 'inherit',
                      fontWeight: 600
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                        {t.model.toFixed(2)}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>(#{t.modelRank})</span>
                    </div>
                  </td>

                  {/* Shift */}
                  <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {shift > 0 ? (
                      <span style={{ color: 'var(--color-success)' }} title={`Rose by ${shift} spots compared to raw average`}>
                        ↑ +{shift}
                      </span>
                    ) : shift < 0 ? (
                      <span style={{ color: 'var(--color-danger)' }} title={`Dropped by ${Math.abs(shift)} spots compared to raw average`}>
                        ↓ {shift}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-subtle)' }} title="Unchanged rank">
                        → 0
                      </span>
                    )}
                  </td>

                  {/* Stability badge */}
                  <td>
                    {t.stable ? (
                      <span className="badge badge-success" title={`Max shift across judge removals: ${t.maxShift}`}>
                        Stable
                      </span>
                    ) : (
                      <span className="badge badge-warning" title={`Max shift across judge removals: ${t.maxShift}`}>
                        ±{t.maxShift} Shift
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
