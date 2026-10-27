import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

/**
 * Event creation page with capability link management and assignment planner configuration.
 */
export default function CreateEvent() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [minScore, setMinScore] = useState(1);
  const [maxScore, setMaxScore] = useState(10);
  const [teamsText, setTeamsText] = useState('');
  const [judgesText, setJudgesText] = useState('');
  const [assignmentMode, setAssignmentMode] = useState('all');
  const [kJudges, setKJudges] = useState(3);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [createdEvent, setCreatedEvent] = useState(null);
  const [copiedLink, setCopiedLink] = useState(null);

  const parsedTeams = teamsText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const parsedJudges = judgesText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide an event name.');
      return;
    }

    if (parsedTeams.length < 2) {
      setError('At least 2 team names are required (one per line).');
      return;
    }

    if (parsedJudges.length < 2) {
      setError('At least 2 judge names are required (one per line).');
      return;
    }

    if (assignmentMode === 'k_judges') {
      const k = Number(kJudges);
      if (k < 2 || k > parsedJudges.length) {
        setError(`k must be between 2 and the total number of judges (${parsedJudges.length}).`);
        return;
      }
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          scoringScale: { min: Number(minScore), max: Number(maxScore) },
          teams: parsedTeams,
          judges: parsedJudges,
          assignmentMode,
          k: assignmentMode === 'k_judges' ? Number(kJudges) : null
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || 'Failed to create event');
      }

      const data = await res.json();
      saveToLocalStorage(data);
      setCreatedEvent(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDemo = async () => {
    setError(null);
    setIsLoading(true);

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
      saveToLocalStorage(data);
      setCreatedEvent(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const saveToLocalStorage = (eventData) => {
    try {
      const stored = JSON.parse(localStorage.getItem('fairscore_my_events') || '[]');
      const newEntry = {
        id: eventData.eventId,
        name: eventData.name,
        adminUrl: eventData.adminUrl,
        adminToken: eventData.adminToken,
        createdAt: new Date().toISOString()
      };
      // Keep unique by id
      const updated = [newEntry, ...stored.filter((e) => e.id !== eventData.eventId)];
      localStorage.setItem('fairscore_my_events', JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(key);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  // If event is created, show capability links
  if (createdEvent) {
    return (
      <div className="container" style={{ padding: '2.5rem 1.25rem', maxWidth: '720px' }}>
        <div className="card">
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '2.5rem' }}>🎉</span>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem' }}>Event Created Successfully!</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9375rem' }}>
              Your event <strong>{createdEvent.name}</strong> is ready for judging.
            </p>
          </div>

          {/* Admin link warning */}
          <div className="alert alert-warning">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              ⚠️ Bookmark or Save Your Admin Link
            </h3>
            <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
              FairScore requires no passwords or accounts. Access to your organizer dashboard is controlled by your private capability token in the URL.
              <strong> If you lose this link, you cannot access or manage your event.</strong>
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                readOnly
                value={createdEvent.adminUrl}
                className="form-input"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => copyToClipboard(createdEvent.adminUrl, 'admin')}
              >
                {copiedLink === 'admin' ? 'Copied! ✓' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Judge links */}
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Private Judge Links ({createdEvent.judgeLinks?.length})
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              Send each judge their designated link. Judges can score on their phones without logging in.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {createdEvent.judgeLinks?.map((j) => (
                <div
                  key={j.judgeId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    gap: '1rem'
                  }}
                >
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.9375rem' }}>{j.name}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', fontFamily: 'var(--font-mono)' }}>
                      /judge/{j.token.slice(0, 10)}...
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => copyToClipboard(j.url, j.judgeId)}
                    >
                      {copiedLink === j.judgeId ? 'Copied! ✓' : 'Copy Link'}
                    </button>
                    <a
                      href={j.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      Open ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action to Dashboard */}
          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <a
              href={createdEvent.adminUrl}
              className="btn btn-primary"
            >
              Go to Organizer Dashboard →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2.5rem 1.25rem', maxWidth: '680px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Create New Event</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
            Set up an event with capability links and mathematically planned judge overlap.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleCreateDemo}
          disabled={isLoading}
          title="Instant demonstration event with simulated scores"
        >
          ⚡ Create Demo Event
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card">
        {/* Event Name */}
        <div className="form-group">
          <label htmlFor="event-name" className="form-label">
            Event Name *
          </label>
          <input
            id="event-name"
            type="text"
            required
            className="form-input"
            placeholder="e.g. Hackathon 2026 Finals"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Scoring Scale */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="min-score" className="form-label">
              Minimum Score
            </label>
            <input
              id="min-score"
              type="number"
              className="form-input"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="max-score" className="form-label">
              Maximum Score
            </label>
            <input
              id="max-score"
              type="number"
              className="form-input"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
            />
          </div>
        </div>

        {/* Teams List */}
        <div className="form-group">
          <label htmlFor="teams-input" className="form-label">
            Teams (One name per line, min 2) *
          </label>
          <textarea
            id="teams-input"
            rows={5}
            required
            className="form-textarea"
            placeholder={`Team Apollo\nTeam Beacon\nTeam Cipher\nTeam Delta`}
            value={teamsText}
            onChange={(e) => setTeamsText(e.target.value)}
          />
          <div className="form-hint">{parsedTeams.length} team(s) entered</div>
        </div>

        {/* Judges List */}
        <div className="form-group">
          <label htmlFor="judges-input" className="form-label">
            Judges (One name per line, min 2) *
          </label>
          <textarea
            id="judges-input"
            rows={4}
            required
            className="form-textarea"
            placeholder={`Dr. Alice Smith\nBob Jones\nCarol White\nDave Miller`}
            value={judgesText}
            onChange={(e) => setJudgesText(e.target.value)}
          />
          <div className="form-hint">{parsedJudges.length} judge(s) entered</div>
        </div>

        {/* Assignment Mode */}
        <div className="form-group">
          <label className="form-label">Judge Assignment Mode</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="assignmentMode"
                value="all"
                checked={assignmentMode === 'all'}
                onChange={() => setAssignmentMode('all')}
              />
              <span>
                <strong>All judges score all teams</strong> (Maximum overlap, recommended for smaller pools)
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="assignmentMode"
                value="k_judges"
                checked={assignmentMode === 'k_judges'}
                onChange={() => setAssignmentMode('k_judges')}
              />
              <span>
                <strong>Each team gets k judges</strong> (Balanced sliding-window overlap for large events)
              </span>
            </label>
          </div>
        </div>

        {/* k input if k_judges */}
        {assignmentMode === 'k_judges' && (
          <div className="form-group" style={{ paddingLeft: '1.75rem' }}>
            <label htmlFor="k-judges" className="form-label">
              Judges per team (k)
            </label>
            <input
              id="k-judges"
              type="number"
              min={2}
              max={Math.max(2, parsedJudges.length)}
              className="form-input"
              style={{ maxWidth: '140px' }}
              value={kJudges}
              onChange={(e) => setKJudges(e.target.value)}
            />
            <div className="form-hint">
              FairScore verifies load balance (differ by at most 2) and guarantees a fully connected bipartite graph.
            </div>
          </div>
        )}

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <Link to="/" className="btn btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? 'Creating Event...' : 'Create Event & Generate Links'}
          </button>
        </div>
      </form>
    </div>
  );
}
