const R = 6371;

export function haversineDist(p1, p2) {
  const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
  const dLon = (p2.lng - p1.lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1.lat * (Math.PI / 180)) *
      Math.cos(p2.lat * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ea580c',
  '#9333ea', '#0891b2', '#c026d3', '#ca8a04',
  '#4f46e5', '#db2777', '#059669', '#d97706',
  '#7c3aed', '#0d9488', '#be185d', '#65a30d',
  '#0284c7', '#e11d48', '#15803d', '#b45309',
];

export function randomNormal() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function generateMockData(options = {}) {
  const {
    numDemand = 1600,
    numCandidates = 20,
    seed = null,
  } = options;

  if (seed !== null) {
    // Simple seeded RNG for reproducibility
    let s = seed;
    const rng = () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
    // Override Math.random temporarily (this is a simplification)
    const orig = Math.random;
    Math.random = rng;
    const data = _generate(numDemand, numCandidates, options);
    Math.random = orig;
    return data;
  }

  return _generate(numDemand, numCandidates, options);
}

function _generate(numDemand, numCandidates, options) {
  const {
    centers = [
      { lng: -97.33, lat: 32.75, spread: 0.15, weightMult: 1.5 },
      { lng: -96.80, lat: 32.77, spread: 0.20, weightMult: 2.0 },
      { lng: -96.80, lat: 33.10, spread: 0.12, weightMult: 0.8 },
      { lng: -97.10, lat: 32.40, spread: 0.14, weightMult: 0.7 },
    ],
  } = options;

  const demand = [];
  for (let i = 0; i < numDemand; i++) {
    const center = centers[Math.floor(Math.random() * centers.length)];
    const lng = center.lng + randomNormal() * center.spread;
    const lat = center.lat + randomNormal() * center.spread;
    demand.push({
      id: i,
      lng,
      lat,
      weight: Math.floor(Math.abs(randomNormal() * 1000 * center.weightMult) + 100),
    });
  }

  const candidates = [];
  for (let i = 0; i < numCandidates; i++) {
    if (i < centers.length * 2) {
      const c = centers[i % centers.length];
      candidates.push({
        id: `c-${i}`,
        lng: c.lng + (Math.random() - 0.5) * 0.15,
        lat: c.lat + (Math.random() - 0.5) * 0.15,
      });
    } else {
      candidates.push({
        id: `c-${i}`,
        lng: -97.5 + Math.random() * 1.0,
        lat: 32.2 + Math.random() * 1.0,
      });
    }
  }

  return { demand, candidates };
}

let _nextId = 0;
export function nextCandidateId() {
  return `c-${Date.now()}-${_nextId++}`;
}
