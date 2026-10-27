import React from 'react';

/**
 * Diagnostics and warnings panel.
 * Alerts organizers and evaluators when data properties degrade mathematical guarantees.
 */
export default function Warnings({ warnings = [], componentCount = 1 }) {
  if (!warnings || warnings.length === 0) {
    return (
      <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'var(--color-success)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem', color: 'var(--color-success)' }}>✓</span>
          <div>
            <strong style={{ color: 'var(--color-success)', display: 'block' }}>Data Integrity Verified</strong>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Evaluation graph is fully connected. No single-judge bottlenecks or severe variance anomalies detected.
            </span>
          </div>
        </div>
      </div>
    );
  }

  const criticalErrors = warnings.filter((w) => w.severity === 'error' || w.code === 'DISCONNECTED');
  const otherWarnings = warnings.filter((w) => w.severity !== 'error' && w.code !== 'DISCONNECTED');

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {criticalErrors.map((w, idx) => (
        <div key={`err-${idx}`} className="alert alert-danger" role="alert">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>⚠</span>
            <div>
              <strong>Critical Reliability Alert: {w.code}</strong>
              <p style={{ marginTop: '0.25rem', marginBottom: 0 }}>{w.message}</p>
              {w.code === 'DISCONNECTED' && (
                <p style={{ fontSize: '0.8125rem', marginTop: '0.5rem', opacity: 0.9 }}>
                  <strong>Recommendation:</strong> FairScore automatically falls back to Z-Score ranking because
                  the additive judge-effect model cannot calibrate disconnected clusters without overlap.
                </p>
              )}
            </div>
          </div>
        </div>
      ))}

      {otherWarnings.map((w, idx) => (
        <div key={`warn-${idx}`} className="alert alert-warning" role="alert">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>⚡</span>
            <div>
              <strong>Diagnostic Notice: {w.code}</strong>
              <p style={{ marginTop: '0.25rem', marginBottom: 0 }}>{w.message}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
