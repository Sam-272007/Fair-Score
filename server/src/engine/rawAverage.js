export function computeRawAverages(rows) {
  const teamMap = new Map();

  for (const { team, score } of rows) {
    if (!teamMap.has(team)) {
      teamMap.set(team, { nScores: 0, sum: 0, mean: 0 });
    }
    const record = teamMap.get(team);
    record.nScores += 1;
    record.sum += score;
  }

  for (const record of teamMap.values()) {
    record.mean = record.nScores > 0 ? record.sum / record.nScores : 0;
  }

  return teamMap;
}
