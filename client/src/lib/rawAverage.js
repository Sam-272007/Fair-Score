/**
 * Computes raw arithmetic average score for each team.
 *
 * @param {Array<{judge: string, team: string, score: number}>} rows
 * @returns {Map<string, { nScores: number, sum: number, mean: number }>}
 */
export function computeRawAverages(rows) {
  const teamMap = new Map();

  for (const { team, score } of rows) {
    if (!teamMap.has(team)) {
      teamMap.set(team, { nScores: 0, sum: 0, mean: 0 });
    }
    const record = teamMap.get(team);
    record.nScores += 1;
    record.sum += score;
  }

  for (const record of teamMap.values()) {
    record.mean = record.nScores > 0 ? record.sum / record.nScores : 0;
  }

  return teamMap;
}
