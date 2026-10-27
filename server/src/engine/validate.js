/**
 * Validates parsed scoring rows.
 */
export class ValidationError extends Error {
  constructor(message, code = 'VALIDATION_ERROR', details = null) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.details = details;
  }
}

export function validateRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new ValidationError('Dataset is empty. At least one score row is required.', 'EMPTY_DATASET');
  }

  const seenPairs = new Set();
  const judges = new Set();
  const teams = new Set();
  const judgeCounts = new Map();
  const teamCounts = new Map();
  const warnings = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    if (!row || typeof row !== 'object') {
      throw new ValidationError(`Row ${rowNum} is invalid or empty.`, 'INVALID_ROW');
    }

    const judge = String(row.judge ?? '').trim();
    const team = String(row.team ?? '').trim();

    if (!judge) {
      throw new ValidationError(`Row ${rowNum} is missing a judge identifier.`, 'MISSING_JUDGE');
    }

    if (!team) {
      throw new ValidationError(`Row ${rowNum} is missing a team identifier.`, 'MISSING_TEAM');
    }

    const rawScore = row.score;
    if (rawScore === null || rawScore === undefined || rawScore === '' || Number.isNaN(Number(rawScore))) {
      throw new ValidationError(
        `Row ${rowNum} has invalid score "${rawScore}". Scores must be numeric.`,
        'INVALID_SCORE'
      );
    }

    const score = Number(rawScore);
    if (!Number.isFinite(score)) {
      throw new ValidationError(`Row ${rowNum} score must be a finite number.`, 'NON_FINITE_SCORE');
    }

    const pairKey = `${judge.toLowerCase()}:::${team.toLowerCase()}`;
    if (seenPairs.has(pairKey)) {
      throw new ValidationError(
        `Duplicate score detected for judge "${judge}" and team "${team}". Duplicate pairs are not allowed.`,
        'DUPLICATE_ENTRY',
        { judge, team, row: rowNum }
      );
    }
    seenPairs.add(pairKey);

    judges.add(judge);
    teams.add(team);

    judgeCounts.set(judge, (judgeCounts.get(judge) || 0) + 1);
    teamCounts.set(team, (teamCounts.get(team) || 0) + 1);
  }

  if (judges.size < 2) {
    throw new ValidationError(
      `Dataset must have at least 2 unique judges (found ${judges.size}).`,
      'INSUFFICIENT_JUDGES'
    );
  }

  if (teams.size < 2) {
    throw new ValidationError(
      `Dataset must have at least 2 unique teams (found ${teams.size}).`,
      'INSUFFICIENT_TEAMS'
    );
  }

  for (const [judge, count] of judgeCounts.entries()) {
    if (count < 3) {
      warnings.push({
        code: 'FEW_SCORES_PER_JUDGE',
        severity: 'warning',
        message: `Judge "${judge}" scored only ${count} team${count === 1 ? '' : 's'} (recommended: at least 3 for reliable normalization).`
      });
    }
  }

  for (const [team, count] of teamCounts.entries()) {
    if (count === 1) {
      warnings.push({
        code: 'SINGLE_JUDGE_TEAM',
        severity: 'warning',
        message: `Team "${team}" was scored by only 1 judge. Bias correction has limited ability to cross-check this team.`
      });
    }
  }

  return {
    valid: true,
    rowCount: rows.length,
    uniqueJudges: Array.from(judges),
    uniqueTeams: Array.from(teams),
    warnings
  };
}
