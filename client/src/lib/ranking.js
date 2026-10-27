/**
 * Computes standard competition ranking (1, 2, 2, 4) for a list of items sorted descending by score.
 * Treats differences < epsilon (default 1e-9) as ties.
 *
 * @param {Array<{ id: string, score: number }>} items
 * @param {number} [epsilon=1e-9]
 * @returns {Map<string, number>} Map from item id to 1-based rank
 */
export function computeRanks(items, epsilon = 1e-9) {
  // Sort descending by score
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
