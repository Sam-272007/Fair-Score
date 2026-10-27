export function computeJudgeEffect(rows, options = {}) {
  const maxIterations = options.maxIterations ?? 500;
  const tolerance = options.tolerance ?? 1e-9;

  const teamScores = new Map();
  const judgeScores = new Map();

  for (const { judge, team, score } of rows) {
    if (!teamScores.has(team)) teamScores.set(team, []);
    teamScores.get(team).push({ judge, score });

    if (!judgeScores.has(judge)) judgeScores.set(judge, []);
    judgeScores.get(judge).push({ team, score });
  }

  const judges = Array.from(judgeScores.keys());
  const teams = Array.from(teamScores.keys());

  const biases = new Map();
  for (const j of judges) {
    biases.set(j, 0);
  }

  const qualities = new Map();
  for (const [t, sList] of teamScores.entries()) {
    const rawMean = sList.reduce((acc, s) => acc + s.score, 0) / sList.length;
    qualities.set(t, rawMean);
  }

  let iterations = 0;
  let converged = false;

  while (iterations < maxIterations) {
    iterations++;
    let maxChange = 0;

    // 1. Update team qualities
    for (const t of teams) {
      const sList = teamScores.get(t);
      const newQ = sList.reduce((acc, s) => acc + (s.score - biases.get(s.judge)), 0) / sList.length;
      const change = Math.abs(newQ - qualities.get(t));
      if (change > maxChange) maxChange = change;
      qualities.set(t, newQ);
    }

    // 2. Update judge biases
    const rawBiases = new Map();
    let sumBias = 0;
    for (const j of judges) {
      const sList = judgeScores.get(j);
      const newB = sList.reduce((acc, s) => acc + (s.score - qualities.get(s.team)), 0) / sList.length;
      rawBiases.set(j, newB);
      sumBias += newB;
    }

    // 3. Re-center biases to sum/mean 0
    const meanBias = judges.length > 0 ? sumBias / judges.length : 0;
    for (const j of judges) {
      const centeredB = rawBiases.get(j) - meanBias;
      const change = Math.abs(centeredB - biases.get(j));
      if (change > maxChange) maxChange = change;
      biases.set(j, centeredB);
    }

    // Adjust team qualities by meanBias so overall scale is preserved
    for (const t of teams) {
      qualities.set(t, qualities.get(t) + meanBias);
    }

    if (maxChange < tolerance) {
      converged = true;
      break;
    }
  }

  const warnings = [];
  if (!converged) {
    warnings.push({
      code: 'NOT_CONVERGED',
      severity: 'warning',
      message: `The iterative bias model did not fully converge within ${maxIterations} iterations. Results may have minor numerical imprecision.`
    });
  }

  return {
    qualities,
    biases,
    iterations,
    converged,
    warnings
  };
}
