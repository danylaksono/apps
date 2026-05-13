import { createConnection, escapeName, loadSpatial, registerFile } from './duckdb';
import { wkbToGeoJSON } from './wkb';
import { transformCoords, setupProj4, needsReprojection } from './proj';
import { fmt } from './format';

setupProj4();

export async function analyzeFile(file, sentinel, log) {
  const buf = await file.arrayBuffer();
  await registerFile(file.name, buf);
  const conn = await createConnection();

  const safeName = escapeName(file.name);

  try {
    const schemaResult = await conn.query(`DESCRIBE SELECT * FROM read_parquet('${safeName}')`);
    const schema = schemaResult.toArray().map(r => ({
      col: r.column_name,
      dtype: r.column_type
    }));

    const geomCols = new Set(
      schema.filter(s =>
        /geometry|wkb_geometry|geom/i.test(s.col) || /^(WKB|BLOB|BIT)$/i.test(s.dtype)
      ).map(s => s.col)
    );

    const totalResult = await conn.query(`SELECT COUNT(*) AS n FROM read_parquet('${safeName}')`);
    const totalRows = Number(totalResult.toArray()[0].n);

    const statCols = schema.filter(s => !geomCols.has(s.col));
    if (!statCols.length) throw new Error('No non-geometry columns found');

    const rows = [];
    for (const { col, dtype } of statCols) {
      const q = `"${col.replace(/"/g, '""')}"`;
      const isNum = /INT|FLOAT|DOUBLE|DECIMAL|NUMERIC|REAL|HUGEINT|BIGINT|SMALLINT|TINYINT/i.test(dtype);
      const sentNum = (isNum && sentinel !== '' && !isNaN(Number(sentinel))) ? Number(sentinel) : null;

      let sentinelPred = '';
      if (sentinel !== '') {
        if (sentNum !== null) {
          sentinelPred = `AND ${q} <> ${sentNum}`;
        } else {
          sentinelPred = `AND TRY_CAST(${q} AS VARCHAR) <> '${sentinel.replace(/'/g, "''")}'`;
        }
      }

      let nullCount = 0;
      try {
        const nullRes = await conn.query(`
          SELECT COUNT(*) AS valid FROM read_parquet('${safeName}')
          WHERE ${q} IS NOT NULL ${sentinelPred}
        `);
        nullCount = totalRows - Number(nullRes.toArray()[0].valid);
      } catch { nullCount = totalRows; }

      let count = 0, mean = null, std = null, min = null, q25 = null, q50 = null, q75 = null, max = null;
      let unique = null, top = null, freq = null;

      if (isNum) {
        try {
          const r = await conn.query(`
            SELECT
              COUNT(${q}) AS cnt, AVG(${q}::DOUBLE) AS avg, STDDEV(${q}::DOUBLE) AS std,
              MIN(${q}) AS mn, MAX(${q}) AS mx,
              PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${q}::DOUBLE) AS p25,
              PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ${q}::DOUBLE) AS p50,
              PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${q}::DOUBLE) AS p75
            FROM read_parquet('${safeName}')
            WHERE ${q} IS NOT NULL ${sentinelPred}
          `);
          const row = r.toArray()[0];
          count = Number(row?.cnt ?? 0);
          mean = fmt(row?.avg); std = fmt(row?.std);
          min = fmt(row?.mn); max = fmt(row?.mx);
          q25 = fmt(row?.p25); q50 = fmt(row?.p50); q75 = fmt(row?.p75);
        } catch (e) {
          log(`  ⚠ numeric stats failed for ${col}: ${e.message}`, 'warn');
        }
      } else {
        try {
          const r = await conn.query(`
            SELECT COUNT(${q}) AS cnt, COUNT(DISTINCT ${q}) AS uniq
            FROM read_parquet('${safeName}')
            WHERE ${q} IS NOT NULL ${sentinelPred}
          `);
          const row = r.toArray()[0];
          count = Number(row?.cnt ?? 0);
          unique = Number(row?.uniq ?? 0);
        } catch (e) {
          log(`  ⚠ count failed for ${col}: ${e.message}`, 'warn');
        }
        try {
          const topRes = await conn.query(`
            SELECT ${q}::VARCHAR AS val, COUNT(*) AS n
            FROM read_parquet('${safeName}')
            WHERE ${q} IS NOT NULL ${sentinelPred}
            GROUP BY val ORDER BY n DESC LIMIT 1
          `);
          const topRow = topRes.toArray()[0];
          if (topRow) { top = String(topRow.val ?? ''); freq = Number(topRow.n ?? 0); }
        } catch { /* skip */ }
      }

      rows.push({ col, dtype, nullCount, count, mean, std, min, q25, q50, q75, max, unique, top, freq });
    }

    await conn.close();
    return {
      laCode: file.name.replace(/\.parquet$/i, ''),
      totalRows,
      rows,
      columns: statCols.map(s => s.col)
    };
  } catch (e) {
    await conn.close();
    throw e;
  }
}

export async function loadSpatialData(file, laCode, log) {
  const conn = await createConnection();
  const safeName = escapeName(file.name);

  try {
    const useSpatial = await loadSpatial(conn);

    const schemaRes = await conn.query(`DESCRIBE SELECT * FROM read_parquet('${safeName}')`);
    const schema = schemaRes.toArray();

    const geomField = schema.find(s =>
      /geometry|wkb_geometry|geom/i.test(s.column_name) ||
      /^(WKB|BLOB|GEOMETRY)$/i.test(s.column_type)
    );
    const geomCol = geomField ? geomField.column_name : 'geometry';
    const geomQ = `"${geomCol}"`;

    const geomType = (geomField?.column_type || '').toUpperCase();
    const isBlob = /^(BLOB|WKB_BLOB|WKB)$/.test(geomType);
    const geomExpr = (useSpatial && isBlob) ? `ST_GeomFromWKB(${geomQ})` : geomQ;

    let query;
    let usedSpatialTransform = false;

    if (useSpatial) {
      let needs27700 = false;
      try {
        const probeQ = `SELECT ST_AsGeoJSON(${geomExpr}) AS _g FROM read_parquet('${safeName}') WHERE ${geomQ} IS NOT NULL LIMIT 1`;
        const probeRes = await conn.query(probeQ);
        const probeRow = probeRes.toArray()[0];
        if (probeRow && probeRow._g) {
          const probeGeom = JSON.parse(probeRow._g);
          if (probeGeom && needsReprojection(probeGeom.coordinates)) {
            needs27700 = true;
          }
        }
      } catch (e) {
        log(`  ⚠ Geometry probe failed: ${e.message}`, 'warn');
      }

      if (needs27700) {
        try {
          query = `SELECT ST_AsGeoJSON(ST_Transform(${geomExpr}, 'EPSG:27700', 'EPSG:4326', always_xy => true)) AS _geojson, * EXCLUDE (${geomQ}) FROM read_parquet('${safeName}')`;
          await conn.query(query + ' LIMIT 1');
          usedSpatialTransform = true;
          log('  Detected EPSG:27700 — reprojecting via ST_Transform', 'info');
        } catch (e) {
          log(`  ⚠ ST_Transform failed, using client-side reprojection: ${e.message}`, 'warn');
          query = null;
        }
      }

      if (!query) {
        query = `SELECT ST_AsGeoJSON(${geomExpr}) AS _geojson, * EXCLUDE (${geomQ}) FROM read_parquet('${safeName}')`;
      }
    } else {
      query = `SELECT * FROM read_parquet('${safeName}')`;
    }

    const res = await conn.query(query);
    const arrowRows = res.toArray();

    const features = [];
    const propsList = [];

    for (const r of arrowRows) {
      const obj = r.toJSON();
      let geom = null;

      if (useSpatial && obj._geojson) {
        try { geom = JSON.parse(obj._geojson); } catch { /* skip */ }
        delete obj._geojson;
        if (!usedSpatialTransform && geom?.coordinates) {
          try { geom.coordinates = transformCoords(geom.coordinates); } catch { /* skip */ }
        }
      } else if (!useSpatial && obj[geomCol]) {
        try {
          geom = wkbToGeoJSON(obj[geomCol]);
          if (geom?.coordinates) {
            try { geom.coordinates = transformCoords(geom.coordinates); } catch { /* skip */ }
          }
        } catch (e) {
          log(`  ⚠ WKB decode failed for a row: ${e.message}`, 'warn');
        }
        delete obj[geomCol];
      }

      if (!geom || !geom.coordinates) continue;

      features.push({ type: 'Feature', geometry: geom, properties: obj });
      propsList.push(obj);
    }

    const columns = Object.keys(propsList[0] || {}).filter(c => c !== geomCol && c !== '_geojson');

    if (features.length === 0) {
      log('  ⚠ 0 valid geometries found', 'warn');
    } else {
      log(`  Loaded ${features.length.toLocaleString()} features`, 'ok');
    }

    await conn.close();
    return {
      geojson: { type: 'FeatureCollection', features },
      columns,
      propsList,
      featureCount: features.length
    };
  } catch (e) {
    try { await conn.close(); } catch { /* skip */ }
    throw e;
  }
}
