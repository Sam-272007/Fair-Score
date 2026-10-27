import { validateRows } from './validate.js';
import { computeRawAverages } from './rawAverage.js';
import { computeZScores } from './zScore.js';
import { computeJudgeEffect } from './judgeEffect.js';
import { checkConnectivity } from './connectivity.js';
import { analyzeStability } from './stability.js';
import { computeRanks } from './ranking.js';

export function analyze(rows, options = {}) {
  const validation = validateRows(rows);
  const allWarnings = [...validation.warnings];

  const conn = checkConnectivity(rows);
  allWarnings.push(...conn.warnings);

  const rawMap = computeRawAverages(rows);
  const rawItems = Array.from(rawMap.entries()).map(([team, rec]) => ({
    id: team,
    score: rec.mean
  }));
  const rawRanks = computeRanks(rawItems);

  const zResult = computeZScores(rows);
  allWarnings.push(...zResult.warnings);
  const zItems = Array.from(zResult.teamZScores.entries()).map(([team, rec]) => ({
    id: team,
    score: rec.meanZ
  }));
  const zRanks = computeRanks(zItems);

  const modelResult = computeJudgeEffect(rows);
  allWarnings.push(...modelResult.warnings);
  const modelItems = Array.from(modelResult.qualities.entries()).map(([team, quality]) => ({
    id: team,
    score: quality
  }));
  const modelRanks = computeRanks(modelItems);

  let stabilityResult = {
    teamStability: new Map(),
    top3Unchanged: true,
    removalsTested: 0,
    skippedRemovals: [],
    warnings: []
  };

  if (!options.skipStability && conn.isConnected) {
    stabilityResult = analyzeStability(rows, modelResult.qualities);
    allWarnings.push(...stabilityResult.warnings);
  }

  const recommended = conn.isConnected ? 'model' : 'zscore';

  const uniqueTeams = validation.uniqueTeams;
  const teams = uniqueTeams.map((teamName) => {
    const rawRec = rawMap.get(teamName) || { mean: 0, nScores: 0 };
    const rawRank = rawRanks.get(teamName) ?? 999;

    const zRec = zResult.teamZScores.get(teamName) || { meanZ: 0 };
    const zRank = zRanks.get(teamName) ?? 999;

    const modelQuality = modelResult.qualities.get(teamName) ?? 0;
    const modelRank = modelRanks.get(teamName) ?? 999;

    const stab = stabilityResult.teamStability.get(teamName) || { maxShift: 0, stable: true };
    const shift = rawRank - modelRank;

    return {
      team: teamName,
      nScores: rawRec.nScores,
      raw: Number(rawRec.mean.toFixed(2)),
      rawRank,
      z: Number(zRec.meanZ.toFixed(3)),
      zRank,
      model: Number(modelQuality.toFixed(2)),
      modelRank,
      shift,
      maxShift: stab.maxShift,
      stable: stab.stable
    };
  });

  teams.sort((a, b) => {
    const rankA = recommended === 'model' ? a.modelRank : a.zRank;
    const rankB = recommended === 'model' ? b.modelRank : b.zRank;
    return rankA - rankB;
  });

  const judges = validation.uniqueJudges.map((judgeName) => {
    const stats = zResult.judgeStats.get(judgeName) || { mean: 0, sd: 0, nScores: 0 };
    const bias = modelResult.biases.get(judgeName) ?? 0;

    return {
      judge: judgeName,
      nScores: stats.nScores,
      mean: Number(stats.mean.toFixed(2)),
      sd: Number(stats.sd.toFixed(2)),
      bias: Number(bias.toFixed(2))
    };
  });

  judges.sort((a, b) => a.bias - b.bias);

  const seenWarningKeys = new Set();
  const dedupedWarnings = [];
  for (const w of allWarnings) {
    const key = `${w.code}:::${w.message}`;
    if (!seenWarningKeys.has(key)) {
      seenWarningKeys.add(key);
      dedupedWarnings.push(w);
    }
  }

  return {
    teams,
    judges,
    components: conn.components,
    componentCount: conn.componentCount,
    recommended,
    warnings: dedupedWarnings,
    stability: {
      removalsTested: stabilityResult.removalsTested,
      skippedRemovals: stabilityResult.skippedRemovals,
      top3Unchanged: stabilityResult.top3Unchanged
    }
  };
}
