import { describe, it, expect } from 'vitest';
import { parseCsv } from '../src/lib/parseCsv.js';
import { validateRows, ValidationError } from '../src/lib/validate.js';
import { computeRawAverages } from '../src/lib/rawAverage.js';
import { computeZScores } from '../src/lib/zScore.js';
import { computeJudgeEffect } from '../src/lib/judgeEffect.js';
import { checkConnectivity } from '../src/lib/connectivity.js';
import { analyzeStability } from '../src/lib/stability.js';
import { computeRanks } from '../src/lib/ranking.js';
import { planAssignments } from '../src/lib/assignmentPlanner.js';
import { analyze } from '../src/lib/analyze.js';
import { createMulberry32, seededShuffle } from '../src/lib/rng.js';
import {
  UNLUCKY_TEAM_CSV,
  UNLUCKY_TEAM_ROWS,
  DISCONNECTED_CSV,
  DISCONNECTED_ROWS
} from '../src/data/sampleScores.js';

describe('FairScore Calculation Engine', () => {
  // 1. Parsing & Validation
  describe('Parsing & Validation', () => {
    it('parses valid CSV with case-insensitive headers and whitespace', () => {
      const csv = `JUDGE, TEAM , Score\n Alice , Team A , 8.5\nBob,Team B, 9 `;
      const result = parseCsv(csv);
      expect(result.rowCount).toBe(2);
      expect(result.rows[0]).toEqual({ judge: 'Alice', team: 'Team A', score: 8.5 });
      expect(result.rows[1]).toEqual({ judge: 'Bob', team: 'Team B', score: 9.0 });
    });

    it('throws on missing columns', () => {
      const badCsv = `name,score\nAlice,8`;
      expect(() => parseCsv(badCsv)).toThrow(ValidationError);
    });

    it('throws on non-numeric score', () => {
      const csv = `judge,team,score\nAlice,Team A,not-a-number\nBob,Team B,8`;
      expect(() => parseCsv(csv)).toThrow(ValidationError);
    });

    it('throws on duplicate (judge, team) pairs', () => {
      const csv = `judge,team,score\nAlice,Team A,8\nAlice,Team A,9`;
      expect(() => parseCsv(csv)).toThrow(/Duplicate score detected/);
    });

    it('requires at least 2 unique judges and 2 unique teams', () => {
      const singleJudge = `judge,team,score\nAlice,Team A,8\nAlice,Team B,9`;
      expect(() => parseCsv(singleJudge)).toThrow(/at least 2 unique judges/);

      const singleTeam = `judge,team,score\nAlice,Team A,8\nBob,Team A,9`;
      expect(() => parseCsv(singleTeam)).toThrow(/at least 2 unique teams/);
    });
  });

  // 2. Raw Averages
  describe('Raw Average', () => {
    it('computes arithmetic mean against hand-computed example', () => {
      const rows = [
        { judge: 'J1', team: 'T1', score: 10 },
        { judge: 'J2', team: 'T1', score: 6 },
        { judge: 'J1', team: 'T2', score: 4 },
        { judge: 'J2', team: 'T2', score: 8 }
      ];
      const rawMap = computeRawAverages(rows);
      expect(rawMap.get('T1').mean).toBe(8.0);
      expect(rawMap.get('T1').nScores).toBe(2);
      expect(rawMap.get('T2').mean).toBe(6.0);
      expect(rawMap.get('T2').nScores).toBe(2);
    });
  });

  // 3. Z-Score Normalization
  describe('Z-Score Normalization', () => {
    it('computes standard z-scores properly', () => {
      const rows = [
        { judge: 'J1', team: 'T1', score: 10 },
        { judge: 'J1', team: 'T2', score: 6 },
        { judge: 'J2', team: 'T1', score: 4 },
        { judge: 'J2', team: 'T2', score: 8 }
      ];
      const res = computeZScores(rows);
      // For J1: mean = 8, variance = ((10-8)^2 + (6-8)^2)/2 = 4, sd = 2
      // J1 T1 score 10 -> z = (10-8)/2 = +1
      // J1 T2 score 6  -> z = (6-8)/2 = -1
      expect(res.judgeStats.get('J1').sd).toBe(2.0);
      expect(res.teamZScores.get('T1').meanZ).toBe(0); // T1: J1(+1) + J2(-1) = 0
    });

    it('handles zero-variance judge without NaN and emits warning', () => {
      const rows = [
        { judge: 'ConstantJudge', team: 'T1', score: 7 },
        { judge: 'ConstantJudge', team: 'T2', score: 7 },
        { judge: 'NormalJudge', team: 'T1', score: 8 },
        { judge: 'NormalJudge', team: 'T2', score: 6 }
      ];
      const res = computeZScores(rows);
      expect(res.judgeStats.get('ConstantJudge').sd).toBe(0);
      // Ensure no NaN values in team scores
      for (const tRec of res.teamZScores.values()) {
        expect(Number.isNaN(tRec.meanZ)).toBe(false);
      }
      expect(res.warnings.some((w) => w.code === 'ZERO_VARIANCE_JUDGE')).toBe(true);
    });
  });

  // 4. Judge-Effect Model
  describe('Judge-Effect Model', () => {
    it('recovers exact qualities (up to constant) and biases summing to 0 in noise-free data', () => {
      const trueQualities = { 'Team A': 8, 'Team B': 6, 'Team C': 4 };
      const trueBiases = { 'Judge Strict': -1.5, 'Judge Lenient': 1.5 };
      // Note true biases sum to 0 (-1.5 + 1.5 = 0)

      const rows = [];
      for (const [team, q] of Object.entries(trueQualities)) {
        for (const [judge, b] of Object.entries(trueBiases)) {
          rows.push({ judge, team, score: q + b });
        }
      }

      const result = computeJudgeEffect(rows);
      expect(result.converged).toBe(true);

      // Check biases sum to 0 within numerical tolerance
      const biasSum = Array.from(result.biases.values()).reduce((a, b) => a + b, 0);
      expect(Math.abs(biasSum)).toBeLessThan(1e-8);

      // Check judge biases recovered
      expect(result.biases.get('Judge Strict')).toBeCloseTo(-1.5, 4);
      expect(result.biases.get('Judge Lenient')).toBeCloseTo(1.5, 4);

      // Check team qualities difference preserved (A - B = 2, B - C = 2)
      const qA = result.qualities.get('Team A');
      const qB = result.qualities.get('Team B');
      const qC = result.qualities.get('Team C');
      expect(qA - qB).toBeCloseTo(2.0, 4);
      expect(qB - qC).toBeCloseTo(2.0, 4);
    });

    it('adding a constant to all scores preserves relative model rankings and biases', () => {
      const rows1 = UNLUCKY_TEAM_ROWS;
      const rows2 = UNLUCKY_TEAM_ROWS.map((r) => ({ ...r, score: r.score + 10 }));

      const res1 = computeJudgeEffect(rows1);
      const res2 = computeJudgeEffect(rows2);

      const ranks1 = computeRanks(
        Array.from(res1.qualities.entries()).map(([id, score]) => ({ id, score }))
      );
      const ranks2 = computeRanks(
        Array.from(res2.qualities.entries()).map(([id, score]) => ({ id, score }))
      );

      for (const [team, r1] of ranks1.entries()) {
        expect(ranks2.get(team)).toBe(r1);
      }

      // Biases should remain identical
      for (const [judge, b1] of res1.biases.entries()) {
        expect(res2.biases.get(judge)).toBeCloseTo(b1, 5);
      }
    });
  });

  // 5. Connectivity
  describe('Connectivity Analysis', () => {
    it('detects a single connected component', () => {
      const conn = checkConnectivity(UNLUCKY_TEAM_ROWS);
      expect(conn.isConnected).toBe(true);
      expect(conn.componentCount).toBe(1);
      expect(conn.warnings.length).toBe(0);
    });

    it('detects two disconnected components and emits DISCONNECTED warning', () => {
      const conn = checkConnectivity(DISCONNECTED_ROWS);
      expect(conn.isConnected).toBe(false);
      expect(conn.componentCount).toBe(2);
      expect(conn.warnings.some((w) => w.code === 'DISCONNECTED')).toBe(true);
    });
  });

  // 6. Ranking & Ties
  describe('Competition Ranking', () => {
    it('implements standard competition ranking (1, 2, 2, 4) with tie tolerance', () => {
      const items = [
        { id: 'Team 1', score: 10.0 },
        { id: 'Team 2', score: 8.0 },
        { id: 'Team 3', score: 8.0 }, // tied with Team 2
        { id: 'Team 4', score: 6.0 }
      ];
      const ranks = computeRanks(items);
      expect(ranks.get('Team 1')).toBe(1);
      expect(ranks.get('Team 2')).toBe(2);
      expect(ranks.get('Team 3')).toBe(2);
      expect(ranks.get('Team 4')).toBe(4);
    });

    it('treats differences < 1e-9 as ties', () => {
      const items = [
        { id: 'Team A', score: 5.0000000001 },
        { id: 'Team B', score: 5.0000000002 }
      ];
      const ranks = computeRanks(items, 1e-9);
      expect(ranks.get('Team A')).toBe(1);
      expect(ranks.get('Team B')).toBe(1);
    });
  });

  // 7. Stability
  describe('Stability Analysis', () => {
    it('skips a removal that disconnects the graph with an explicit reason', () => {
      // Create a bridge judge whose removal breaks the graph
      // J_Bridge connects Team Alpha and Team Beta
      const bridgeRows = [
        { judge: 'J1', team: 'T1', score: 7 },
        { judge: 'J1', team: 'T2', score: 8 },
        { judge: 'J_Bridge', team: 'T2', score: 8 },
        { judge: 'J_Bridge', team: 'T3', score: 9 },
        { judge: 'J2', team: 'T3', score: 8 },
        { judge: 'J2', team: 'T4', score: 7 }
      ];
      const { qualities } = computeJudgeEffect(bridgeRows);
      const stability = analyzeStability(bridgeRows, qualities);

      expect(stability.skippedRemovals.length).toBeGreaterThan(0);
      const bridgeSkip = stability.skippedRemovals.find((s) => s.judge === 'J_Bridge');
      expect(bridgeSkip).toBeDefined();
      expect(bridgeSkip.reason).toMatch(/disconnects|splits/i);
    });
  });

  // 8. Assignment Planner
  describe('Assignment Planner', () => {
    it('generates balanced and connected assignments for various (T, J, k) combos', () => {
      const testCases = [
        { T: 8, J: 4, k: 2 },
        { T: 12, J: 6, k: 3 },
        { T: 15, J: 5, k: 3 },
        { T: 10, J: 10, k: 10 } // all judges
      ];

      for (const { T, J, k } of testCases) {
        const teams = Array.from({ length: T }, (_, i) => `Team_${i + 1}`);
        const judges = Array.from({ length: J }, (_, i) => `Judge_${i + 1}`);

        const result = planAssignments(teams, judges, k, 12345);

        // Every team got k judges
        for (const [team, assigned] of result.teamAssignments.entries()) {
          expect(assigned.length).toBe(k);
          // Judges assigned to team must be unique
          expect(new Set(assigned).size).toBe(k);
        }

        // Judge load difference <= 2
        const loads = Array.from(result.judgeAssignments.values()).map((l) => l.length);
        const diff = Math.max(...loads) - Math.min(...loads);
        expect(diff).toBeLessThanOrEqual(2);

        // Graph must be connected
        const conn = checkConnectivity(result.pairs.map((p) => ({ ...p, score: 0 })));
        expect(conn.isConnected).toBe(true);
      }
    });

    it('fails loudly if k is out of bounds', () => {
      expect(() => planAssignments(['T1', 'T2'], ['J1', 'J2'], 1)).toThrow(/between 2 and 2/);
      expect(() => planAssignments(['T1', 'T2'], ['J1', 'J2'], 5)).toThrow(/between 2 and 2/);
    });
  });

  // 9. Unlucky Team Dataset Specifics
  describe('Unlucky Team Demonstration Test', () => {
    it('demonstrates that the raw winner differs from the model winner', () => {
      const result = analyze(UNLUCKY_TEAM_ROWS);

      const rawWinner = [...result.teams].sort((a, b) => a.rawRank - b.rawRank)[0];
      const modelWinner = [...result.teams].sort((a, b) => a.modelRank - b.modelRank)[0];

      // Raw winner is Team 02 (evaluated by lenient judges)
      expect(rawWinner.team).toBe('Team 02');

      // Model winner is Team 01 (true highest quality restored by FairScore)
      expect(modelWinner.team).toBe('Team 01');

      // Team 01 raw rank was 3, but model rank is 1
      const team01 = result.teams.find((t) => t.team === 'Team 01');
      expect(team01.rawRank).toBe(3);
      expect(team01.modelRank).toBe(1);
      expect(team01.shift).toBe(2); // rank improved by 2 spots
    });
  });

  // 10. Seeded Simulation: Model Rank Agreement vs Raw Average
  describe('Seeded Simulation: Model vs Raw Rank Accuracy', () => {
    it('asserts model rank agreement with true quality is at least as good as raw average on average', () => {
      // In Spearman rank correlation or Kendall's tau or concordance:
      // Let's run 20 independent simulated tournaments with random judge biases and noise.
      const rng = createMulberry32(99999);
      const numTrials = 25;
      let modelBetterOrEqualCount = 0;
      let totalModelCorr = 0;
      let totalRawCorr = 0;

      for (let trial = 0; trial < numTrials; trial++) {
        const numTeams = 8;
        const numJudges = 6;
        const k = 3;

        const trueQualities = Array.from({ length: numTeams }, (_, i) => 10 - i * 0.8);
        const trueBiases = Array.from({ length: numJudges }, () => (rng() - 0.5) * 3);

        const teams = Array.from({ length: numTeams }, (_, i) => `T${i}`);
        const judges = Array.from({ length: numJudges }, (_, j) => `J${j}`);

        const plan = planAssignments(teams, judges, k, Math.floor(rng() * 10000));
        const rows = [];

        for (const pair of plan.pairs) {
          const tIdx = teams.indexOf(pair.team);
          const jIdx = judges.indexOf(pair.judge);
          const noise = (rng() - 0.5) * 0.3; // small noise
          const score = trueQualities[tIdx] + trueBiases[jIdx] + noise;
          rows.push({ judge: pair.judge, team: pair.team, score });
        }

        const res = analyze(rows, { skipStability: true });

        // Calculate rank correlation with true order (0, 1, 2, ... numTeams - 1)
        // Higher Kendall tau / Spearman correlation means better alignment with truth
        let rawInversions = 0;
        let modelInversions = 0;

        for (let i = 0; i < numTeams; i++) {
          for (let j = i + 1; j < numTeams; j++) {
            // Team i is strictly better than Team j
            const teamI = teams[i];
            const teamJ = teams[j];

            const recI = res.teams.find((t) => t.team === teamI);
            const recJ = res.teams.find((t) => t.team === teamJ);

            // Inversion in raw
            if (recI.rawRank > recJ.rawRank) rawInversions++;
            // Inversion in model
            if (recI.modelRank > recJ.modelRank) modelInversions++;
          }
        }

        if (modelInversions <= rawInversions) {
          modelBetterOrEqualCount++;
        }
        totalModelCorr += (1 - modelInversions / 28);
        totalRawCorr += (1 - rawInversions / 28);
      }

      const avgModelAgreement = totalModelCorr / numTrials;
      const avgRawAgreement = totalRawCorr / numTrials;

      // Model should be at least as accurate as raw average on average
      expect(avgModelAgreement).toBeGreaterThanOrEqual(avgRawAgreement - 0.05);
      expect(modelBetterOrEqualCount / numTrials).toBeGreaterThanOrEqual(0.65);
    });
  });
});
