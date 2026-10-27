export const UNLUCKY_TEAM_ROWS = [
  { judge: 'J1 (Strict)', team: 'Team 01', score: 6.0 },
  { judge: 'J2 (Mod-Strict)', team: 'Team 01', score: 7.0 },
  { judge: 'J3 (Neutral-A)', team: 'Team 01', score: 8.0 },
  { judge: 'J4 (Neutral-B)', team: 'Team 02', score: 7.6 },
  { judge: 'J5 (Mod-Lenient)', team: 'Team 02', score: 8.6 },
  { judge: 'J6 (Lenient)', team: 'Team 02', score: 9.6 },
  { judge: 'J1 (Strict)', team: 'Team 03', score: 5.2 },
  { judge: 'J3 (Neutral-A)', team: 'Team 03', score: 7.2 },
  { judge: 'J5 (Mod-Lenient)', team: 'Team 03', score: 8.2 },
  { judge: 'J2 (Mod-Strict)', team: 'Team 04', score: 5.8 },
  { judge: 'J4 (Neutral-B)', team: 'Team 04', score: 6.8 },
  { judge: 'J6 (Lenient)', team: 'Team 04', score: 8.8 },
  { judge: 'J1 (Strict)', team: 'Team 05', score: 4.4 },
  { judge: 'J4 (Neutral-B)', team: 'Team 05', score: 6.4 },
  { judge: 'J6 (Lenient)', team: 'Team 05', score: 8.4 },
  { judge: 'J2 (Mod-Strict)', team: 'Team 06', score: 5.0 },
  { judge: 'J3 (Neutral-A)', team: 'Team 06', score: 6.0 },
  { judge: 'J5 (Mod-Lenient)', team: 'Team 06', score: 7.0 },
  { judge: 'J1 (Strict)', team: 'Team 07', score: 3.6 },
  { judge: 'J2 (Mod-Strict)', team: 'Team 07', score: 4.6 },
  { judge: 'J5 (Mod-Lenient)', team: 'Team 07', score: 6.6 },
  { judge: 'J3 (Neutral-A)', team: 'Team 08', score: 5.2 },
  { judge: 'J4 (Neutral-B)', team: 'Team 08', score: 5.2 },
  { judge: 'J6 (Lenient)', team: 'Team 08', score: 7.2 },
  { judge: 'J2 (Mod-Strict)', team: 'Team 09', score: 3.8 },
  { judge: 'J4 (Neutral-B)', team: 'Team 09', score: 4.8 },
  { judge: 'J5 (Mod-Lenient)', team: 'Team 09', score: 5.8 },
  { judge: 'J1 (Strict)', team: 'Team 10', score: 2.4 },
  { judge: 'J3 (Neutral-A)', team: 'Team 10', score: 4.4 },
  { judge: 'J6 (Lenient)', team: 'Team 10', score: 6.4 },
  { judge: 'J2 (Mod-Strict)', team: 'Team 11', score: 3.0 },
  { judge: 'J3 (Neutral-A)', team: 'Team 11', score: 4.0 },
  { judge: 'J6 (Lenient)', team: 'Team 11', score: 6.0 },
  { judge: 'J1 (Strict)', team: 'Team 12', score: 1.6 },
  { judge: 'J5 (Mod-Lenient)', team: 'Team 12', score: 4.6 },
  { judge: 'J4 (Neutral-B)', team: 'Team 12', score: 3.6 }
];

export const UNLUCKY_TEAM_CSV = [
  'judge,team,score',
  ...UNLUCKY_TEAM_ROWS.map((r) => `${r.judge},${r.team},${r.score}`)
].join('\n');

export const DISCONNECTED_ROWS = [
  { judge: 'Judge Alice', team: 'Team Alpha', score: 8.5 },
  { judge: 'Judge Bob', team: 'Team Alpha', score: 8.0 },
  { judge: 'Judge Alice', team: 'Team Beta', score: 7.0 },
  { judge: 'Judge Bob', team: 'Team Beta', score: 6.5 },
  { judge: 'Judge Alice', team: 'Team Gamma', score: 9.0 },
  { judge: 'Judge Bob', team: 'Team Gamma', score: 9.5 },
  { judge: 'Judge Alice', team: 'Team Delta', score: 6.0 },
  { judge: 'Judge Bob', team: 'Team Delta', score: 5.5 },
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
