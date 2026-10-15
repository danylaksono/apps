import { haversineDist } from './utils.js';

export function solvePMedian(options = {}) {
  const {
    demand = [],
    candidates = [],
    p = 8,
    maxIterations = 50,
    progress = null,
  } = options;

  if (p <= 0 || candidates.length === 0 || demand.length === 0) {
    return { selected: [], allocations: [], totalCost: 0 };
  }

  const nCandidates = candidates.length;
  const actualP = Math.min(p, nCandidates);

  let selected = Array.from({ length: actualP }, (_, i) => i);
  let unselected = Array.from({ length: nCandidates }, (_, i) => i).filter(
    (i) => !selected.includes(i)
  );

  const calculateCost = (selIndices) => {
    const allocs = new Int32Array(demand.length);
    const selCands = selIndices.map((i) => candidates[i]);
    let cost = 0;

    for (let i = 0; i < demand.length; i++) {
      let minDist = Infinity;
      let bestCandIdx = -1;
      for (let j = 0; j < selCands.length; j++) {
        const dist = haversineDist(demand[i], selCands[j]);
        if (dist < minDist) {
          minDist = dist;
          bestCandIdx = j;
        }
      }
      cost += minDist * demand[i].weight;
      allocs[i] = bestCandIdx;
    }
    return { cost, allocs };
  };

  let currentRes = calculateCost(selected);
  let bestCost = currentRes.cost;
  let bestAlloc = currentRes.allocs;

  let improved = true;
  let iterations = 0;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < selected.length; i++) {
      for (let j = 0; j < unselected.length; j++) {
        const newSelected = [...selected];
        newSelected[i] = unselected[j];

        const testRes = calculateCost(newSelected);

        if (testRes.cost < bestCost - 1e-6) {
          bestCost = testRes.cost;
          bestAlloc = testRes.allocs;

          const temp = selected[i];
          selected[i] = unselected[j];
          unselected[j] = temp;

          improved = true;
          break;
        }
      }
      if (improved) break;
    }

    if (progress) {
      progress({ iteration: iterations, cost: bestCost });
    }
  }

  return { selected, allocations: bestAlloc, totalCost: bestCost, iterations };
}

export function computeStats(demand, candidates, solution) {
  const { selected, allocations, totalCost } = solution;

  let maxDist = 0;
  let totalPop = 0;
  const distances = [];
  const selectedCands = selected.map((i) => candidates[i]);

  for (let i = 0; i < demand.length; i++) {
    const assignedIdx = allocations[i];
    if (assignedIdx === -1) continue;
    const cand = selectedCands[assignedIdx];
    const d = haversineDist(demand[i], cand);
    maxDist = Math.max(maxDist, d);
    distances.push(d);
    totalPop += demand[i].weight;
  }

  distances.sort((a, b) => a - b);
  const medianDist =
    distances.length > 0
      ? distances[Math.floor(distances.length / 2)]
      : 0;
  const avgDist =
    distances.length > 0
      ? distances.reduce((s, v) => s + v, 0) / distances.length
      : 0;

  return { totalCost, maxDist, medianDist, avgDist, totalPop };
}
