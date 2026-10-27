/**
 * Sample Datasets for Quick Analyze and Evaluator Demonstrations
 */

// 1. "Unlucky Team" Dataset:
// 12 teams, 6 judges, 3 judges per team.
// Team 01 is the strongest project but drew strict judges (J1, J2, J3), dropping its raw rank to 3rd.
// Team 02 is weaker but drew lenient judges (J4, J5, J6), winning the raw average at 1st.
// The bipartite graph is fully connected. The iterative model recovers judge bias, restoring Team 01 to 1st place.
export const UNLUCKY_TEAM_ROWS = [
  // Team 01: true quality 8.0, evaluated by strict judges J1 (-2), J2 (-1), J3 (0) -> scores 6.0, 7.0, 8.0 -> raw mean 7.0
  { judge: 'J1 (Strict)', team: 'Team 01', score: 6.0 },
  { judge: 'J2 (Mod-Strict)', team: 'Team 01', score: 7.0 },
  { judge: 'J3 (Neutral-A)', team: 'Team 01', score: 8.0 },

  // Team 02: true quality 7.6, evaluated by lenient judges J4 (0), J5 (+1), J6 (+2) -> scores 7.6, 8.6, 9.6 -> raw mean 8.6
  { judge: 'J4 (Neutral-B)', team: 'Team 02', score: 7.6 },
  { judge: 'J5 (Mod-Lenient)', team: 'Team 02', score: 8.6 },
  { judge: 'J6 (Lenient)', team: 'Team 02', score: 9.6 },

  // Team 03: true quality 7.2
  { judge: 'J1 (Strict)', team: 'Team 03', score: 5.2 },
  { judge: 'J3 (Neutral-A)', team: 'Team 03', score: 7.2 },
  { judge: 'J5 (Mod-Lenient)', team: 'Team 03', score: 8.2 },

  // Team 04: true quality 6.8
  { judge: 'J2 (Mod-Strict)', team: 'Team 04', score: 5.8 },
  { judge: 'J4 (Neutral-B)', team: 'Team 04', score: 6.8 },
  { judge: 'J6 (Lenient)', team: 'Team 04', score: 8.8 },

  // Team 05: true quality 6.4
  { judge: 'J1 (Strict)', team: 'Team 05', score: 4.4 },
  { judge: 'J4 (Neutral-B)', team: 'Team 05', score: 6.4 },
  { judge: 'J6 (Lenient)', team: 'Team 05', score: 8.4 },

  // Team 06: true quality 6.0
  { judge: 'J2 (Mod-Strict)', team: 'Team 06', score: 5.0 },
  { judge: 'J3 (Neutral-A)', team: 'Team 06', score: 6.0 },
  { judge: 'J5 (Mod-Lenient)', team: 'Team 06', score: 7.0 },

  // Team 07: true quality 5.6
  { judge: 'J1 (Strict)', team: 'Team 07', score: 3.6 },
  { judge: 'J2 (Mod-Strict)', team: 'Team 07', score: 4.6 },
  { judge: 'J5 (Mod-Lenient)', team: 'Team 07', score: 6.6 },

  // Team 08: true quality 5.2
  { judge: 'J3 (Neutral-A)', team: 'Team 08', score: 5.2 },
  { judge: 'J4 (Neutral-B)', team: 'Team 08', score: 5.2 },
  { judge: 'J6 (Lenient)', team: 'Team 08', score: 7.2 },

  // Team 09: true quality 4.8
  { judge: 'J2 (Mod-Strict)', team: 'Team 09', score: 3.8 },
  { judge: 'J4 (Neutral-B)', team: 'Team 09', score: 4.8 },
  { judge: 'J5 (Mod-Lenient)', team: 'Team 09', score: 5.8 },

  // Team 10: true quality 4.4
  { judge: 'J1 (Strict)', team: 'Team 10', score: 2.4 },
  { judge: 'J3 (Neutral-A)', team: 'Team 10', score: 4.4 },
  { judge: 'J6 (Lenient)', team: 'Team 10', score: 6.4 },

  // Team 11: true quality 4.0
  { judge: 'J2 (Mod-Strict)', team: 'Team 11', score: 3.0 },
  { judge: 'J3 (Neutral-A)', team: 'Team 11', score: 4.0 },
  { judge: 'J6 (Lenient)', team: 'Team 11', score: 6.0 },

  // Team 12: true quality 3.6
  { judge: 'J1 (Strict)', team: 'Team 12', score: 1.6 },
  { judge: 'J5 (Mod-Lenient)', team: 'Team 12', score: 4.6 },
  { judge: 'J4 (Neutral-B)', team: 'Team 12', score: 3.6 }
];

export const UNLUCKY_TEAM_CSV = [
  'judge,team,score',
  ...UNLUCKY_TEAM_ROWS.map((r) => `${r.judge},${r.team},${r.score}`)
].join('\n');

// 2. "Disconnected Set" Dataset:
// Two isolated evaluation pods with zero shared judges:
// Pod 1 (Fintech Track): Judge Alice & Judge Bob score Teams Alpha, Beta, Gamma, Delta.
// Pod 2 (Health Track): Judge Carol & Judge Dave score Teams Omega, Sigma, Theta, Zeta.
// Graph connectivity splits into 2 components, triggering DISCONNECTED warning.
export const DISCONNECTED_ROWS = [
  // Pod 1
  { judge: 'Judge Alice', team: 'Team Alpha', score: 8.5 },
  { judge: 'Judge Bob', team: 'Team Alpha', score: 8.0 },
  { judge: 'Judge Alice', team: 'Team Beta', score: 7.0 },
  { judge: 'Judge Bob', team: 'Team Beta', score: 6.5 },
  { judge: 'Judge Alice', team: 'Team Gamma', score: 9.0 },
  { judge: 'Judge Bob', team: 'Team Gamma', score: 9.5 },
  { judge: 'Judge Alice', team: 'Team Delta', score: 6.0 },
  { judge: 'Judge Bob', team: 'Team Delta', score: 5.5 },

  // Pod 2 (no shared judges with Pod 1)
  { judge: 'Judge Carol', team: 'Team Omega', score: 8.0 },
  { judge: 'Judge Dave', team: 'Team Omega', score: 7.5 },
  { judge: 'Judge Carol', team: 'Team Sigma', score: 9.0 },
  { judge: 'Judge Dave', team: 'Team Sigma', score: 8.5 },
  { judge: 'Judge Carol', team: 'Team Theta', score: 6.5 },
  { judge: 'Judge Dave', team: 'Team Theta', score: 7.0 },
  { judge: 'Judge Carol', team: 'Team Zeta', score: 5.0 },
  { judge: 'Judge Dave', team: 'Team Zeta', score: 6.0 }
];

export const DISCONNECTED_CSV = [
  'judge,team,score',
  ...DISCONNECTED_ROWS.map((r) => `${r.judge},${r.team},${r.score}`)
].join('\n');
