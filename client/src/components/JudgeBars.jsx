import React from 'react';

/**
 * Plain CSS visual diverging bar chart displaying judge harshness (bias) centered at 0.
 *
 * Left of center: Strict / Harsh (negative bias, red)
 * Right of center: Lenient / Generous (positive bias, green)
 */
export default function JudgeBars({ judges = [] }) {
  if (!judges || judges.length === 0) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        No judge statistics available.
      </div>
    );
  }

  // Find max absolute bias to scale bars proportionally (minimum domain [-1, +1])
  const maxAbsBias = Math.max(
    1.0,
    ...judges.map((j) => Math.abs(j.bias || 0))
  );

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Judge Harshness Calibration</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
            Relative scoring strictness ($Bias$). Centered at $0.00$. A negative value indicates a stricter-than-average judge.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>
          <span style={{ color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-danger)' }}></span>
            Strict (Negative)
          </span>
          <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }}></span>
            Lenient (Positive)
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {judges.map((judge) => {
          const bias = judge.bias || 0;
          const isNegative = bias < 0;
          const widthPercent = Math.min(50, (Math.abs(bias) / maxAbsBias) * 50);

          return (
            <div
              key={judge.judge}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(140px, 1.2fr) minmax(180px, 3fr) 100px 90px',
                alignItems: 'center',
                gap: '1rem',
                fontSize: '0.875rem'
              }}
            >
              {/* Judge info */}
              <div>
                <strong style={{ display: 'block', color: 'var(--color-text)' }}>{judge.judge}</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>
                  {judge.nScores} scores · Mean: {judge.mean.toFixed(1)} · SD: {judge.sd.toFixed(2)}
                </span>
              </div>

              {/* Diverging CSS bar */}
              <div
                style={{
                  position: 'relative',
                  height: '24px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center'
                }}
                aria-label={`Judge ${judge.judge} bias: ${bias >= 0 ? '+' : ''}${bias.toFixed(2)}`}
              >
                {/* Center marker (0) */}
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: 0,
                    bottom: 0,
                    width: '2px',
                    backgroundColor: 'var(--color-border)',
                    zIndex: 2
                  }}
                />

                {/* The bar extending from center */}
                {bias !== 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '4px',
                      bottom: '4px',
                      borderRadius: '3px',
                      backgroundColor: isNegative ? 'var(--color-danger)' : 'var(--color-success)',
                      ...(isNegative
                        ? { right: '50%', width: `${widthPercent}%` }
                        : { left: '50%', width: `${widthPercent}%` })
                    }}
                  />
                )}
              </div>

              {/* Numeric bias readout */}
              <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                <span
                  style={{
                    color: bias > 0 ? 'var(--color-success)' : bias < 0 ? 'var(--color-danger)' : 'var(--color-text-muted)'
                  }}
                >
                  {bias > 0 ? `+${bias.toFixed(2)}` : bias.toFixed(2)}
                </span>
              </div>

              {/* Label badge */}
              <div>
                {bias <= -0.5 ? (
                  <span className="badge badge-danger">Strict</span>
                ) : bias >= 0.5 ? (
                  <span className="badge badge-success">Lenient</span>
                ) : (
                  <span className="badge badge-info">Neutral</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
