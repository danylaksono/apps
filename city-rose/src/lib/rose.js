import { BIN_SIZE, NUM_BINS } from './constants';
import { calculateBearing, calculateDistance } from './geo';

export function processRoseData(elements) {
  const bins = new Array(NUM_BINS).fill(0);
  let total = 0;

  elements.forEach((element) => {
    if (!element.geometry || element.geometry.length < 2) {
      return;
    }

    for (let i = 0; i < element.geometry.length - 1; i += 1) {
      const current = element.geometry[i];
      const next = element.geometry[i + 1];
      const distance = calculateDistance(current.lat, current.lon, next.lat, next.lon);
      const bearing = calculateBearing(current.lat, current.lon, next.lat, next.lon);

      bins[Math.floor(bearing / BIN_SIZE) % NUM_BINS] += distance;
      bins[Math.floor((((bearing + 180) % 360) / BIN_SIZE) % NUM_BINS)] += distance;
      total += distance * 2;
    }
  });

  if (!total) {
    throw new Error('Unable to calculate orientation data from street geometry.');
  }

  return bins.map((value) => value / total);
}
