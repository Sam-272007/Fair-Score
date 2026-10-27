import Papa from 'papaparse';
import { ValidationError, validateRows } from './validate.js';

/**
 * Parses raw CSV text or structured data into normalized rows.
 * Expected columns (case-insensitive): judge, team, score.
 */
export function parseCsv(csvString) {
  if (typeof csvString !== 'string' || !csvString.trim()) {
    throw new ValidationError('Input CSV is empty.', 'EMPTY_INPUT');
  }

  const result = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase()
  });

  if (result.errors && result.errors.length > 0) {
    const fatalErrors = result.errors.filter((e) => e.type !== 'FieldMismatch');
    if (fatalErrors.length > 0) {
      throw new ValidationError(`CSV parse error: ${fatalErrors[0].message}`, 'CSV_SYNTAX_ERROR');
    }
  }

  const fields = result.meta.fields || [];
  const hasJudge = fields.includes('judge');
  const hasTeam = fields.includes('team');
  const hasScore = fields.includes('score');

  if (!hasJudge || !hasTeam || !hasScore) {
    const missing = [];
    if (!hasJudge) missing.push('judge');
    if (!hasTeam) missing.push('team');
    if (!hasScore) missing.push('score');
    throw new ValidationError(
      `Missing required column header(s): ${missing.join(', ')}. Expected: judge, team, score`,
      'MISSING_COLUMNS'
    );
  }

  const cleanedRows = [];
  for (let i = 0; i < result.data.length; i++) {
    const r = result.data[i];
    const judge = (r.judge || '').trim();
    const team = (r.team || '').trim();
    const scoreRaw = r.score;

    // Ignore completely empty row
    if (!judge && !team && (scoreRaw === undefined || scoreRaw === '')) {
      continue;
    }

    cleanedRows.push({
      judge,
      team,
      score: scoreRaw !== '' && scoreRaw !== null && scoreRaw !== undefined ? Number(scoreRaw) : NaN
    });
  }

  const validation = validateRows(cleanedRows);

  return {
    rows: cleanedRows,
    rowCount: cleanedRows.length,
    uniqueJudges: validation.uniqueJudges,
    uniqueTeams: validation.uniqueTeams,
    warnings: validation.warnings
  };
}
