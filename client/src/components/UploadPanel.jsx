import React, { useState, useRef } from 'react';
import { UNLUCKY_TEAM_CSV, DISCONNECTED_CSV } from '../data/sampleScores.js';

/**
 * Upload and CSV input panel with drag-and-drop, raw paste, and pre-loaded sample datasets.
 */
export default function UploadPanel({ onAnalyze, isLoading = false }) {
  const [csvText, setCsvText] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      loadFile(e.target.files[0]);
    }
  };

  const loadFile = (file) => {
    setError(null);
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      setError('Please upload a .csv or .txt file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target.result);
    };
    reader.onerror = () => {
      setError('Failed to read file.');
    };
    reader.readAsText(file);
  };

  const handleLoadSample = (sampleType) => {
    setError(null);
    if (sampleType === 'unlucky') {
      setCsvText(UNLUCKY_TEAM_CSV);
    } else if (sampleType === 'disconnected') {
      setCsvText(DISCONNECTED_CSV);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!csvText.trim()) {
      setError('Please paste CSV data or load a sample dataset first.');
      return;
    }
    setError(null);
    try {
      onAnalyze(csvText);
    } catch (err) {
      setError(err.message || 'Analysis failed');
    }
  };

  return (
    <div className="card" style={{ marginBottom: '2rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Quick Analyze (Stateless CSV)</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
          Upload or paste scores in <code>judge,team,score</code> format. Analysis runs instantly with bias-correction diagnostics.
        </p>
      </div>

      {/* Preset sample dataset pills */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => handleLoadSample('unlucky')}
          title="12 teams, 6 judges. Strict judges evaluate top teams, causing raw average to crown the wrong winner."
        >
          📂 Load "Unlucky Team" Sample (12 Teams)
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => handleLoadSample('disconnected')}
          title="2 disjoint judging pods with no shared judges. Triggers DISCONNECTED warning."
        >
          ⚡ Load "Disconnected Set" Sample (2 Pods)
        </button>
        {csvText && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setCsvText('');
              setError(null);
            }}
            style={{ marginLeft: 'auto' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Drag & drop dropzone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
          backgroundColor: dragActive ? 'var(--color-primary-subtle)' : 'rgba(255, 255, 255, 0.02)',
          borderRadius: 'var(--radius-md)',
          padding: '1.5rem',
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: '1rem',
          transition: 'all 0.2s ease'
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>📄</div>
        <p style={{ fontWeight: 500, fontSize: '0.9375rem' }}>
          Drag and drop your CSV file here, or <span style={{ color: 'var(--color-primary)' }}>browse</span>
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', marginTop: '0.25rem' }}>
          Columns required: <code>judge</code>, <code>team</code>, <code>score</code>
        </p>
      </div>

      {/* Raw CSV Textarea */}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="csv-input" className="form-label">
            Or Paste Raw CSV / Tab-Separated Data:
          </label>
          <textarea
            id="csv-input"
            className="form-textarea"
            rows={7}
            placeholder={`judge,team,score\nJudge Alice,Team Apollo,8.5\nJudge Bob,Team Apollo,7.0\nJudge Alice,Team Beacon,6.5\nJudge Bob,Team Beacon,7.5`}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}
          />
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
            <strong>Input Error:</strong> {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button type="submit" className="btn btn-primary" disabled={isLoading || !csvText.trim()}>
            {isLoading ? 'Computing Analysis...' : 'Run FairScore Analysis'}
          </button>
        </div>
      </form>
    </div>
  );
}
