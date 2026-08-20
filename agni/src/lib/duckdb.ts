/** DuckDB-WASM instance, shared across the app.
 *
 *  Agni ships its heavier tabular data as Parquet and queries it here rather
 *  than baking it into tiles. Population is the reason: nationally it is
 *  874,919 Kontur hexagons, which is ~113 MB as PMTiles (past GitHub's
 *  per-file limit) but 3.9 MB as a geometry-free Parquet — and a query engine
 *  is what the dashboard's aggregate KPIs and charts need anyway.
 *
 *  The bundle layout follows the joyplot app in this repo: Vite `?url` imports
 *  so the wasm and worker are emitted as real assets, and manual bundle
 *  selection so no CDN is involved.
 *
 *  Everything heavy is behind a dynamic import. The DuckDB JS API alone is
 *  ~400 kB and the wasm builds are 36–41 MB (8–9 MB gzipped); none of it
 *  belongs in the startup path of a map whose core layer is a few thousand
 *  fire points. It loads when the population layer is first switched on. */

import type { AsyncDuckDB, DuckDBBundles } from "@duckdb/duckdb-wasm";
import duckdbWasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvpWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdbWasmEh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import ehWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";

const BUNDLES: DuckDBBundles = {
  mvp: { mainModule: duckdbWasm, mainWorker: mvpWorker },
  eh: { mainModule: duckdbWasmEh, mainWorker: ehWorker },
};

let dbPromise: Promise<AsyncDuckDB> | null = null;

/** The shared database, instantiated on first call. */
export function getDuckDB(): Promise<AsyncDuckDB> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const duckdb = await import("@duckdb/duckdb-wasm");
      const bundle = await duckdb.selectBundle(BUNDLES);
      const worker = new Worker(bundle.mainWorker!);
      const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      return db;
    })();
    dbPromise.catch(() => {
      dbPromise = null; // let a failed instantiation be retried
    });
  }
  return dbPromise;
}
