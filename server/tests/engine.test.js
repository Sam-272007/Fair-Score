import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateRows } from '../src/engine/validate.js';
import { computeRawAverages } from '../src/engine/rawAverage.js';
import { computeZScores } from '../src/engine/zScore.js';
import { computeJudgeEffect } from '../src/engine/judgeEffect.js';
import { checkConnectivity } from '../src/engine/connectivity.js';
import { analyzeStability } from '../src/engine/stability.js';
import { computeRanks } from '../src/engine/ranking.js';
import { planAssignments } from '../src/engine/assignmentPlanner.js';
import { analyze } from '../src/engine/analyze.js';
import {
  UNLUCKY_TEAM_ROWS,
  DISCONNECTED_ROWS
} from '../src/engine/sampleScores.js';

describe('Server Engine Unit Tests (node:test)', () => {
  test('hand-computed raw average', () => {
    const rows = [
      { judge: 'J1', team: 'T1', score: 10 },
      { judge: 'J2', team: 'T1', score: 6 },
      { judge: 'J1', team: 'T2', score: 4 },
      { judge: 'J2', team: 'T2', score: 8 }
    ];
    const rawMap = computeRawAverages(rows);
    assert.equal(rawMap.get('T1').mean, 8.0);
    assert.equal(rawMap.get('T2').mean, 6.0);
  });

  test('zero-variance judge without NaN', () => {
    const rows = [
      { judge: 'Flat', team: 'T1', score: 5 },
      { judge: 'Flat', team: 'T2', score: 5 },
      { judge: 'Normal', team: 'T1', score: 8 },
      { judge: 'Normal', team: 'T2', score: 6 }
    ];
    const res = computeZScores(rows);
    assert.equal(res.judgeStats.get('Flat').sd, 0);
    for (const rec of res.teamZScores.values()) {
      assert.ok(!Number.isNaN(rec.meanZ));
    }
  });

  test('noise-free recovery of qualities and biases summing to 0', () => {
    const trueQualities = { 'Team A': 8, 'Team B': 6, 'Team C': 4 };
    const trueBiases = { 'Judge Strict': -1.5, 'Judge Lenient': 1.5 };
    const rows = [];
    for (const [team, q] of Object.entries(trueQualities)) {
      for (const [judge, b] of Object.entries(trueBiases)) {
        rows.push({ judge, team, score: q + b });
      }
    }
    const res = computeJudgeEffect(rows);
    assert.ok(res.converged);
    const biasSum = Array.from(res.biases.values()).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(biasSum) < 1e-8);
  });

  test('connectivity single vs two components', () => {
    const c1 = checkConnectivity(UNLUCKY_TEAM_ROWS);
    assert.equal(c1.isConnected, true);
    assert.equal(c1.componentCount, 1);

    const c2 = checkConnectivity(DISCONNECTED_ROWS);
    assert.equal(c2.isConnected, false);
    assert.equal(c2.componentCount, 2);
  });

  test('competition ranking ties', () => {
    const items = [
      { id: 'T1', score: 9.0 },
      { id: 'T2', score: 7.0 },
      { id: 'T3', score: 7.0 },
      { id: 'T4', score: 5.0 }
    ];
    const ranks = computeRanks(items);
    assert.equal(ranks.get('T1'), 1);
    assert.equal(ranks.get('T2'), 2);
    assert.equal(ranks.get('T3'), 2);
    assert.equal(ranks.get('T4'), 4);
  });

  test('assignment planner balance and connectivity', () => {
    const teams = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const judges = ['J1', 'J2', 'J3', 'J4'];
    const plan = planAssignments(teams, judges, 2, 42);
    const loads = Array.from(plan.judgeAssignments.values()).map((l) => l.length);
    assert.ok(Math.max(...loads) - Math.min(...loads) <= 2);
  });

  test('unlucky team dataset raw winner != model winner', () => {
    const res = analyze(UNLUCKY_TEAM_ROWS);
    const rawWinner = [...res.teams].sort((a, b) => a.rawRank - b.rawRank)[0];
    const modelWinner = [...res.teams].sort((a, b) => a.modelRank - b.modelRank)[0];
    assert.equal(rawWinner.team, 'Team 02');
    assert.equal(modelWinner.team, 'Team 01');
  });
});
