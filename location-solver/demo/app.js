import { LocationSolver, generateMockData } from '../index.js';

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json',
  center: [-97.05, 32.75],
  zoom: 9,
  maxZoom: 15,
  minZoom: 7,
});

map.on('load', () => {
  const { demand, candidates } = generateMockData({
    numDemand: 1600,
    numCandidates: 20,
    seed: 42,
  });

  const solver = new LocationSolver({
    p: 8,
    autoSolve: false,
    maxIterations: 50,
    title: 'DFW Location Solver',
    subtitle: 'P-median facility location. Drag markers, add or remove candidates, and re-solve.',
    onSolveEnd: (solution, stats) => {
      console.log('Solve complete', {
        selectedFacilities: stats.selectedCount,
        timeMs: stats.timeMs.toFixed(0),
      });
    },
  });

  solver.attach(map);
  solver.setData(demand, candidates);
  solver.solve();

  const panel = solver.getContainer();
  document.getElementById('solver-container').appendChild(panel);
});
