import { computeJudgeEffect } from './judgeEffect.js';
import { checkConnectivity } from './connectivity.js';
import { computeRanks } from './ranking.js';

export function analyzeStability(rows, baselineQualities) {
  const allJudges = Array.from(new Set(rows.map((r) => r.judge)));
  const allTeams = Array.from(new Set(rows.map((r) => r.team)));

  const baselineItems = allTeams.map((t) => ({ id: t, score: baselineQualities.get(t) ?? 0 }));
  const baselineRanks = computeRanks(baselineItems);

  const baselineTop3 = new Set(
    Array.from(baselineRanks.entries())
      .filter(([_, rank]) => rank <= 3)
      .map(([team]) => team)
  );

  const teamMaxShift = new Map();
  for (const t of allTeams) {
    teamMaxShift.set(t, 0);
  }

  const skippedRemovals = [];
  let removalsTested = 0;
  let top3Unchanged = true;

  for (const judge of allJudges) {
    const subset = rows.filter((r) => r.judge !== judge);

    const remainingTeams = new Set(subset.map((r) => r.team));
    const missingTeam = allTeams.find((t) => !remainingTeams.has(t));
    if (missingTeam) {
      skippedRemovals.push({
        judge,
        reason: `Excluding judge "${judge}" leaves team "${missingTeam}" with 0 scores.`
      });
      continue;
    }

    const conn = checkConnectivity(subset);
    if (!conn.isConnected) {
      skippedRemovals.push({
        judge,
        reason: `Excluding judge "${judge}" splits the evaluation network into ${conn.componentCount} disconnected components.`
      });
      continue;
    }

    removalsTested++;
    const { qualities: subQualities } = computeJudgeEffect(subset);
    const subItems = allTeams.map((t) => ({ id: t, score: subQualities.get(t) ?? 0 }));
    const subRanks = computeRanks(subItems);

    for (const t of allTeams) {
      const bRank = baselineRanks.get(t);
      const sRank = subRanks.get(t);
      const shift = Math.abs(bRank - sRank);
      if (shift > teamMaxShift.get(t)) {
        teamMaxShift.set(t, shift);
      }
    }

    const subTop3 = new Set(
      Array.from(subRanks.entries())
        .filter(([_, rank]) => rank <= 3)
        .map(([team]) => team)
    );

    if (baselineTop3.size === subTop3.size) {
      for (const t of baselineTop3) {
        if (!subTop3.has(t)) {
          top3Unchanged = false;
          break;
        }
      }
    } else {
      top3Unchanged = false;
    }
  }

  const teamStability = new Map();
  for (const t of allTeams) {
    const maxShift = teamMaxShift.get(t);
    teamStability.set(t, {
      maxShift,
      stable: maxShift <= 1
    });
  }

  const warnings = [];
  if (removalsTested > 0 && !top3Unchanged) {
    warnings.push({
      code: 'TOP_UNSTABLE',
      severity: 'warning',
      message: 'The top 3 podium ranking is sensitive to individual judges: removing one judge alters the podium set.'
    });
  }

  return {
    teamStability,
    top3Unchanged,
    removalsTested,
    skippedRemovals,
    warnings
  };
}
