export function checkConnectivity(rows) {
  const adj = new Map();
  const allJudges = new Set();
  const allTeams = new Set();

  function addEdge(u, v) {
    if (!adj.has(u)) adj.set(u, new Set());
    if (!adj.has(v)) adj.set(v, new Set());
    adj.get(u).add(v);
    adj.get(v).add(u);
  }

  for (const { judge, team } of rows) {
    const jNode = `J:${judge}`;
    const tNode = `T:${team}`;
    allJudges.add(judge);
    allTeams.add(team);
    addEdge(jNode, tNode);
  }

  const visited = new Set();
  const components = [];
  const allNodes = Array.from(adj.keys());

  for (const startNode of allNodes) {
    if (visited.has(startNode)) continue;

    const compJudges = [];
    const compTeams = [];
    const queue = [startNode];
    visited.add(startNode);

    let head = 0;
    while (head < queue.length) {
      const current = queue[head++];
      if (current.startsWith('J:')) {
        compJudges.push(current.slice(2));
      } else {
        compTeams.push(current.slice(2));
      }

      const neighbors = adj.get(current) || [];
      for (const nbr of neighbors) {
        if (!visited.has(nbr)) {
          visited.add(nbr);
          queue.push(nbr);
        }
      }
    }

    components.push({
      judges: compJudges.sort(),
      teams: compTeams.sort()
    });
  }

  const componentCount = components.length;
  const isConnected = componentCount === 1;
  const warnings = [];

  if (!isConnected) {
    warnings.push({
      code: 'DISCONNECTED',
      severity: 'error',
      message: `The scoring graph is partitioned into ${componentCount} separate groups with zero overlapping judges. Cross-group rankings cannot be mathematically guaranteed.`
    });
  }

  return {
    isConnected,
    componentCount,
    components,
    warnings
  };
}
