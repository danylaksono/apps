import * as duckdb from '@duckdb/duckdb-wasm';

let db = null;
let conn = null;

export const initDuckDB = async () => {
  if (db && conn) return { db, conn };

  try {
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
    const worker_url = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
    );
    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();
    const database = new duckdb.AsyncDuckDB(logger, worker);
    await database.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(worker_url);

    const connection = await database.connect();
    db = database;
    conn = connection;
    
    return { db, conn };
  } catch (e) {
    console.error("DuckDB initialization failed:", e);
    throw e;
  }
};

export const getDb = () => ({ db, conn });
