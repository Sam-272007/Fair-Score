import { validateRows } from './validate.js';
import { computeRawAverages } from './rawAverage.js';
import { computeZScores } from './zScore.js';
import { computeJudgeEffect } from './judgeEffect.js';
import { checkConnectivity } from './connectivity.js';
import { analyzeStability } from './stability.js';
import { computeRanks } from './ranking.js';

/**
 * Full end-to-end scoring analysis.
 *
 * Runs raw averages, z-scores, judge-effect model, connectivity, and stability.
 * Aggregates all diagnostics, warnings, and side-by-side rankings.
 *
 * @param {Array<{judge: string, team: string, score: number}>} rows
 * @param {Object} [options]
 * @param {boolean} [options.skipStability=false]
 * @returns {Object} Comprehensive analysis report
 */
export function analyze(rows, options = {}) {
  // 1. Validate rows and collect data-shape warnings
  const validation = validateRows(rows);
  const allWarnings = [...validation.warnings];

  // 2. Connectivity check
  const conn = checkConnectivity(rows);
  allWarnings.push(...conn.warnings);

  // 3. Raw averages
  const rawMap = computeRawAverages(rows);
  const rawItems = Array.from(rawMap.entries()).map(([team, rec]) => ({
    id: team,
    score: rec.mean
  }));
  const rawRanks = computeRanks(rawItems);

  // 4. Z-scores
  const zResult = computeZScores(rows);
  allWarnings.push(...zResult.warnings);
  const zItems = Array.from(zResult.teamZScores.entries()).map(([team, rec]) => ({
    id: team,
    score: rec.meanZ
  }));
  const zRanks = computeRanks(zItems);

  // 5. Judge-effect model
  const modelResult = computeJudgeEffect(rows);
  allWarnings.push(...modelResult.warnings);
  const modelItems = Array.from(modelResult.qualities.entries()).map(([team, quality]) => ({
    id: team,
    score: quality
  }));
  const modelRanks = computeRanks(modelItems);

  // 6. Stability analysis (leave-one-out)
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

  // Recommendation logic:
  // When graph is connected, judge-effect model is recommended.
  // When disconnected, z-score is recommended because judge-effect cannot connect disjoint subgraphs.
  const recommended = conn.isConnected ? 'model' : 'zscore';

  // 7. Aggregate teams side-by-side
  const uniqueTeams = validation.uniqueTeams;
  const teams = uniqueTeams.map((teamName) => {
    const rawRec = rawMap.get(teamName) || { mean: 0, nScores: 0 };
    const rawRank = rawRanks.get(teamName) ?? 999;

    const zRec = zResult.teamZScores.get(teamName) || { meanZ: 0 };
    const zRank = zRanks.get(teamName) ?? 999;

    const modelQuality = modelResult.qualities.get(teamName) ?? 0;
    const modelRank = modelRanks.get(teamName) ?? 999;

    const stab = stabilityResult.teamStability.get(teamName) || { maxShift: 0, stable: true };

    // Shift: positive means team rose in ranking (e.g. from 5th to 2nd = +3)
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

  // Sort teams by recommended ranking
  teams.sort((a, b) => {
    const rankA = recommended === 'model' ? a.modelRank : a.zRank;
    const rankB = recommended === 'model' ? b.modelRank : b.zRank;
    return rankA - rankB;
  });

  // 8. Aggregate judges
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

  // Sort judges by bias (strictest to most lenient)
  judges.sort((a, b) => a.bias - b.bias);

  // Deduplicate warnings by code and message
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
