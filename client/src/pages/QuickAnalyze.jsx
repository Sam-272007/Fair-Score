import React, { useState } from 'react';
import UploadPanel from '../components/UploadPanel.jsx';
import RankingTable from '../components/RankingTable.jsx';
import JudgeBars from '../components/JudgeBars.jsx';
import Warnings from '../components/Warnings.jsx';
import StabilityPanel from '../components/StabilityPanel.jsx';
import { parseCsv } from '../lib/parseCsv.js';
import { analyze } from '../lib/analyze.js';

export default function QuickAnalyze() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  const handleAnalyze = async (csvContent) => {
    setError(null);
    setIsLoading(true);
    setSaveStatus(null);

    try {
      // 1. Client-side parse & validation
      const parsed = parseCsv(csvContent);

      // 2. Client-side analysis execution
      const analysisResult = analyze(parsed.rows);
      setReport({ ...analysisResult, rawRows: parsed.rows });
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message || 'Failed to process dataset');
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToBackend = async () => {
    if (!report || !report.rawRows) return;
    setSaveStatus('saving');

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Quick Analysis (${new Date().toLocaleDateString()})`,
          scoringScale: { min: 1, max: 10 },
          teams: report.teams.map((t) => t.team),
          judges: report.judges.map((j) => j.judge),
          initialScores: report.rawRows
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || 'Failed to save event to database');
      }

      const data = await res.json();
      setSaveStatus(`Saved! Event ID: ${data.eventId}. Admin link: /admin/${data.eventId}#t=${data.adminToken}`);
    } catch (err) {
      setSaveStatus(`Error saving: ${err.message}`);
    }
  };

  return (
    <div className="container" style={{ padding: '2.5rem 1.25rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Quick Analyze</h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>
          Evaluate scored hackathons and contests to detect judge strictness bias, test sensitivity, and inspect corrected rankings.
        </p>
      </div>

      <UploadPanel onAnalyze={handleAnalyze} isLoading={isLoading} />

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {report && (
        <div>
          {/* Action bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Analysis Report</h2>
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                {report.teams.length} teams · {report.judges.length} judges · {report.componentCount} component(s)
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleSaveToBackend}
                disabled={saveStatus === 'saving'}
              >
                💾 Save as Permanent Event
              </button>
            </div>
          </div>

          {saveStatus && (
            <div className={`alert ${saveStatus.startsWith('Error') ? 'alert-danger' : 'alert-success'}`} style={{ marginBottom: '1.5rem' }}>
              {saveStatus}
            </div>
          )}

          {/* Diagnostic alerts & warnings */}
          <Warnings warnings={report.warnings} componentCount={report.componentCount} />

          {/* Main ranking table */}
          <RankingTable teams={report.teams} recommended={report.recommended} />

          {/* Judge harshness bars */}
          <JudgeBars judges={report.judges} />

          {/* Leave-one-out sensitivity */}
          <StabilityPanel stability={report.stability} teams={report.teams} />
        </div>
      )}
    </div>
  );
}
