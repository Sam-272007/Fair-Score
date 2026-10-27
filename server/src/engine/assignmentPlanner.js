import { createMulberry32, seededShuffle } from './rng.js';
import { checkConnectivity } from './connectivity.js';

export function planAssignments(teams, judges, k, seed = 42) {
  const teamList = teams.map((t) => (typeof t === 'object' && t !== null ? t.id : String(t)));
  const judgeList = judges.map((j) => (typeof j === 'object' && j !== null ? j.id : String(j)));

  const T = teamList.length;
  const J = judgeList.length;

  if (T < 2) {
    throw new Error(`Assignment planner requires at least 2 teams (received ${T}).`);
  }
  if (J < 2) {
    throw new Error(`Assignment planner requires at least 2 judges (received ${J}).`);
  }
  if (typeof k !== 'number' || k < 2 || k > J) {
    throw new Error(`k must be between 2 and ${J} (number of judges). Received: ${k}`);
  }

  const rng = createMulberry32(seed);
  const shuffledTeams = seededShuffle(teamList, rng);

  const teamAssignments = new Map();
  const judgeAssignments = new Map();
  const pairs = [];

  for (const jId of judgeList) {
    judgeAssignments.set(jId, []);
  }

  for (let i = 0; i < T; i++) {
    const tId = shuffledTeams[i];
    const assignedJudges = [];

    for (let j = 0; j < k; j++) {
      const judgeIdx = (i + j) % J;
      const judgeId = judgeList[judgeIdx];
      assignedJudges.push(judgeId);
      judgeAssignments.get(judgeId).push(tId);
      pairs.push({ judge: judgeId, team: tId });
    }

    teamAssignments.set(tId, assignedJudges);
  }

  const loads = Array.from(judgeAssignments.values()).map((list) => list.length);
  const minLoad = Math.min(...loads);
  const maxLoad = Math.max(...loads);
  if (maxLoad - minLoad > 2) {
    throw new Error(
      `Assignment verification failed: judge workload difference (${maxLoad - minLoad}) exceeds allowed threshold of 2.`
    );
  }

  const conn = checkConnectivity(pairs.map((p) => ({ ...p, score: 0 })));
  if (!conn.isConnected) {
    throw new Error(
      `Assignment verification failed: planned assignments create ${conn.componentCount} disconnected components.`
    );
  }

  return {
    teamAssignments,
    judgeAssignments,
    pairs
  };
}
