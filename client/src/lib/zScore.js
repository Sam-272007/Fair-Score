/**
 * Computes Z-score normalization per judge and averages z-scores per team.
 *
 * Formula:
 *   mean = sum(scores) / N
 *   sd = sqrt( sum((score - mean)^2) / N )  [Population SD]
 *   z = (score - mean) / sd
 *   if sd === 0, z = 0 (emit ZERO_VARIANCE_JUDGE warning)
 *
 * @param {Array<{judge: string, team: string, score: number}>} rows
 * @returns {{ teamZScores: Map<string, { nScores: number, sumZ: number, meanZ: number }>, judgeStats: Map<string, { mean: number, sd: number, nScores: number }>, warnings: Array<{code: string, severity: string, message: string}> }}
 */
export function computeZScores(rows) {
  const judgeScores = new Map();

  for (const { judge, score } of rows) {
    if (!judgeScores.has(judge)) {
      judgeScores.set(judge, []);
    }
    judgeScores.get(judge).push(score);
  }

  const judgeStats = new Map();
  const warnings = [];

  for (const [judge, scores] of judgeScores.entries()) {
    const N = scores.length;
    const mean = scores.reduce((acc, v) => acc + v, 0) / N;
    const variance = scores.reduce((acc, v) => acc + (v - mean) ** 2, 0) / N;
    const sd = Math.sqrt(variance);

    if (sd < 1e-12) {
      warnings.push({
        code: 'ZERO_VARIANCE_JUDGE',
        severity: 'warning',
        message: `Judge "${judge}" gave identical scores across all teams (SD = 0). Their scores provide no differentiation and were assigned z = 0.`
      });
    }

    judgeStats.set(judge, { mean, sd, nScores: N });
  }

  const teamZMap = new Map();

  for (const { judge, team, score } of rows) {
    const stats = judgeStats.get(judge);
    let z = 0;
    if (stats.sd >= 1e-12) {
      z = (score - stats.mean) / stats.sd;
    }

    if (!teamZMap.has(team)) {
      teamZMap.set(team, { nScores: 0, sumZ: 0, meanZ: 0, zValues: [] });
    }

    const rec = teamZMap.get(team);
    rec.nScores += 1;
    rec.sumZ += z;
    rec.zValues.push(z);
  }

  for (const rec of teamZMap.values()) {
    rec.meanZ = rec.nScores > 0 ? rec.sumZ / rec.nScores : 0;
  }

  return {
    teamZScores: teamZMap,
    judgeStats,
    warnings
  };
}
