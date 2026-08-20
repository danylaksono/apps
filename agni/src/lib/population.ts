/** Kontur H3 population, served from Parquet through DuckDB-WASM.
 *
 *  874,919 hexagons cover Indonesia — too many to draw at once, and ~113 MB if
 *  tiled. Instead the Parquet carries each res-8 cell with its res-7/6/5
 *  parents precomputed, and the map asks for one aggregate per viewport:
 *
 *    zoom -> H3 resolution -> SUM(population) GROUP BY that resolution's cell
 *
 *  so the number of hexagons on screen stays roughly constant however far out
 *  you are. Geometry is rebuilt from the cell id with h3-js; none is stored.
 *
 *  The parent columns exist because DuckDB's h3 extension is not available in
 *  duckdb-wasm — they are computed offline in pipeline/build_tiles.py. */

import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import { POPULATION_PARQUET_URL } from "./config";
import { getDuckDB } from "./duckdb";
import { useLayersStore } from "../store/layers";

/** Zoom -> H3 resolution. Tuned so a full viewport holds roughly 10–15k cells
 *  at every step: res 5 is 9.3k cells nationally, res 6 is 47.8k, res 7 is
 *  221.8k and res 8 is the full 874.9k. */
function resolutionForZoom(zoom: number): 5 | 6 | 7 | 8 {
  if (zoom < 5.5) return 5;
  if (zoom < 7.5) return 6;
  if (zoom < 9.5) return 7;
  return 8;
}

/** Column holding the cell id at a resolution; res 8 is the table's own key. */
function cellColumn(res: number): string {
  return res === 8 ? "h3" : `h3_r${res}`;
}

/** Hard ceiling on hexagons handed to MapLibre in one update. Hit only by
 *  pathological viewports; the resolution ladder normally keeps us well under. */
const MAX_CELLS = 24000;

let ready: Promise<void> | null = null;

/** Load the Parquet into DuckDB, once. */
export function initPopulation(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const db = await getDuckDB();
      const res = await fetch(POPULATION_PARQUET_URL);
      if (!res.ok) throw new Error(`population parquet ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      await db.registerFileBuffer("population.parquet", buf);
      const conn = await db.connect();
      try {
        await conn.query(
          `CREATE TABLE IF NOT EXISTS population AS
             SELECT * FROM read_parquet('population.parquet')`,
        );
      } finally {
        await conn.close();
      }
    })();
    ready.catch(() => {
      ready = null; // let a failed load be retried on the next toggle
    });
  }
  return ready;
}

function quoteList(cells: string[]): string {
  return cells.map((c) => `'${c}'`).join(",");
}

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Aggregate population for the cells visible in `bounds` at `zoom`. */
export async function queryPopulation(
  bounds: Bounds,
  zoom: number,
): Promise<FeatureCollection> {
  // Dynamic alongside DuckDB itself: h3-js is only ever needed once someone
  // asks for this layer, and it has no business in the startup bundle.
  const { cellToBoundary, cellArea, UNITS, polygonToCells } = await import(
    "h3-js"
  );
  await initPopulation();
  const res = resolutionForZoom(zoom);
  const col = cellColumn(res);

  // Below res 6 the answer is the whole country anyway, so skip the filter
  // rather than listing every res-5 cell in it. Above it, the viewport's res-5
  // cells are few, and matching on h3_r5 uses the hierarchy already in the
  // table as the spatial index.
  let where = "";
  if (res > 5) {
    const { west, south, east, north } = bounds;
    const coarse = polygonToCells(
      [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
      5,
      true,
    );
    if (!coarse.length) return { type: "FeatureCollection", features: [] };
    where = `WHERE h3_r5 IN (${quoteList(coarse)})`;
  }

  const db = await getDuckDB();
  const conn = await db.connect();
  let rows: { cell: string; pop: number }[];
  try {
    const result = await conn.query(
      `SELECT ${col} AS cell, sum(population) AS pop
         FROM population ${where}
        GROUP BY 1
        ORDER BY pop DESC
        LIMIT ${MAX_CELLS}`,
    );
    rows = result.toArray().map((r) => ({
      cell: String(r.cell),
      pop: Number(r.pop) || 0,
    }));
  } finally {
    await conn.close();
  }

  const features: Feature<Polygon>[] = [];
  for (const { cell, pop } of rows) {
    if (!cell || cell === "null") continue;
    // h3-js returns [lat, lng] pairs unless asked for GeoJSON order
    const ring = cellToBoundary(cell, true);
    features.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [[...ring, ring[0]]] },
      properties: {
        population: Math.round(pop),
        // Density, not the raw sum: a res-5 cell holds ~343x the people of a
        // res-8 one, so a ramp on the sum would change meaning at every zoom
        // step. Per km² is comparable across the whole ladder, which is what
        // lets the legend state fixed numbers.
        density: pop / cellArea(cell, UNITS.km2),
      },
    });
  }
  return { type: "FeatureCollection", features };
}


// ------------------------------------------------------------- map glue ---

/** Registry id of the layer this module feeds. */
const LAYER_ID = "population";

/** Last viewport actually rendered, so panning within one cell aggregation
 *  does not re-run the query. */
let lastKey = "";
/** Monotonic token: a slow query for an old viewport must not overwrite a
 *  newer one that already landed. */
let seq = 0;
let started = false;

function viewportKey(b: Bounds, res: number): string {
  // Round to whole degrees — finer than the cell size at any zoom this
  // resolution ladder produces, and it keeps small pans from re-querying.
  const r = (n: number) => Math.round(n * 4) / 4;
  return `${res}:${r(b.west)},${r(b.south)},${r(b.east)},${r(b.north)}`;
}

/** Query the visible aggregate and push it into the map source.
 *
 *  Safe to call on every `moveend` and on every store change: it returns
 *  immediately unless the layer is on and the viewport has actually moved to a
 *  different aggregation. */
export function refreshPopulation(map: MaplibreMap): void {
  const { visibility, setAvailability } = useLayersStore.getState();
  if (!visibility[LAYER_ID] || !map.getLayer(LAYER_ID)) {
    lastKey = "";
    return;
  }

  const b = map.getBounds();
  const bounds: Bounds = {
    west: b.getWest(),
    south: b.getSouth(),
    east: b.getEast(),
    north: b.getNorth(),
  };
  const zoom = map.getZoom();
  const key = viewportKey(bounds, resolutionForZoom(zoom));
  if (key === lastKey) return;
  lastKey = key;

  // First run pulls duckdb-wasm and a 3.9 MB Parquet; say so rather than
  // leaving the layer blank with the toggle on.
  if (!started) {
    started = true;
    setAvailability(LAYER_ID, "checking", "loading population…");
  }

  const token = ++seq;
  void queryPopulation(bounds, zoom)
    .then((fc) => {
      if (token !== seq) return; // a newer viewport already won
      const src = map.getSource(LAYER_ID) as GeoJSONSource | undefined;
      if (!src) return;
      src.setData(fc);
      setAvailability(LAYER_ID, "ok");
    })
    .catch((err) => {
      console.warn("[agni] population query failed", err);
      if (token !== seq) return;
      lastKey = "";
      started = false;
      setAvailability(LAYER_ID, "unavailable", "query failed");
    });
}
