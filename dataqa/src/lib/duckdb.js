import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

const MANUAL_BUNDLES = {
  mvp: {
    mainModule: duckdb_wasm,
    mainWorker: mvp_worker,
  },
  eh: {
    mainModule: duckdb_wasm_eh,
    mainWorker: eh_worker,
  },
};

let db = null;
let initPromise = null;

export async function getDB() {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
    const worker = new Worker(bundle.mainWorker);
    const logger = new duckdb.VoidLogger();
    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    return db;
  })();

  return initPromise;
}

export async function registerFile(name, buffer) {
  const database = await getDB();
  await database.registerFileBuffer(name, new Uint8Array(buffer));
}

export async function createConnection() {
  const database = await getDB();
  return database.connect();
}

export async function loadSpatial(conn) {
  try {
    await conn.query('INSTALL spatial; LOAD spatial;');
    return true;
  } catch {
    return false;
  }
}

export function escapeName(name) {
  return name.replace(/'/g, "''");
}
