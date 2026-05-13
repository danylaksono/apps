export function wkbToGeoJSON(raw) {
  let bytes;
  if (typeof raw === 'string') {
    const hex = raw.startsWith('\\x') ? raw.slice(2) : raw;
    bytes = new Uint8Array(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
  } else if (raw instanceof Uint8Array) {
    bytes = raw;
  } else {
    bytes = new Uint8Array(raw);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset);
  let pos = 0;

  function readUint8() { return view.getUint8(pos++); }
  function readUint32(le) { const v = view.getUint32(pos, le); pos += 4; return v; }
  function readFloat64(le) { const v = view.getFloat64(pos, le); pos += 8; return v; }

  function readGeom() {
    const le = readUint8() === 1;
    const type = readUint32(le) & 0xFFFF;
    switch (type) {
      case 1: return { type: 'Point', coordinates: readPoint(le) };
      case 2: return { type: 'LineString', coordinates: readPoints(le) };
      case 3: return { type: 'Polygon', coordinates: readRings(le) };
      case 4: return { type: 'MultiPoint', coordinates: readGeoms(le).map(g => g.coordinates) };
      case 5: return { type: 'MultiLineString', coordinates: readGeoms(le).map(g => g.coordinates) };
      case 6: return { type: 'MultiPolygon', coordinates: readGeoms(le).map(g => g.coordinates) };
      default: throw new Error(`Unsupported WKB type: ${type}`);
    }
  }

  function readPoint(le) { return [readFloat64(le), readFloat64(le)]; }
  function readPoints(le) { const n = readUint32(le); return Array.from({ length: n }, () => readPoint(le)); }
  function readRings(le) { const n = readUint32(le); return Array.from({ length: n }, () => readPoints(le)); }
  function readGeoms(le) { const n = readUint32(le); return Array.from({ length: n }, () => readGeom()); }

  return readGeom();
}

export function getFirstCoord(geom) {
  if (!geom || !geom.coordinates) return null;
  let c = geom.coordinates;
  while (Array.isArray(c[0])) c = c[0];
  return c;
}
