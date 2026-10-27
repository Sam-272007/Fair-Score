export function computeRanks(items, epsilon = 1e-9) {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const rankMap = new Map();

  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const diff = Math.abs(sorted[i].score - sorted[i - 1].score);
      if (diff >= epsilon) {
        currentRank = i + 1;
      }
    }
    rankMap.set(sorted[i].id, currentRank);
  }

  return rankMap;
}
