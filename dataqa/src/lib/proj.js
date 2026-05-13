import proj4 from 'proj4';

export function setupProj4() {
  if (!proj4.defs('EPSG:27700')) {
    proj4.defs('EPSG:27700',
      '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 ' +
      '+ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs'
    );
  }
}

export function transformCoords(coords) {
  if (typeof coords[0] === 'number') {
    if (Math.abs(coords[0]) > 180 || Math.abs(coords[1]) > 90) {
      const p = proj4('EPSG:27700', 'EPSG:4326', [coords[0], coords[1]]);
      return [p[0], p[1]];
    }
    return coords;
  }
  return coords.map(transformCoords);
}

export function needsReprojection(coords) {
  if (!coords) return false;
  let c = coords;
  while (Array.isArray(c[0])) c = c[0];
  return Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90;
}

export { proj4 };
