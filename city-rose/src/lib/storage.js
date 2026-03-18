/**
 * IndexedDB persistence for city data.
 *
 * Stores the last successfully fetched city so that:
 *  - page reloads restore the previous visualization instantly
 *  - switching explore ↔ print never causes a blank state
 *  - loading a new city shows the old one (dimmed) while fetching
 */

const DB_NAME = "city-rose";
const DB_VERSION = 1;
const STORE_NAME = "city-data";
const CACHE_KEY = "last-city";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txn(mode) {
  return openDB().then((db) => {
    const tx = db.transaction(STORE_NAME, mode);
    return tx.objectStore(STORE_NAME);
  });
}

function idbGet(key) {
  return txn("readonly").then(
    (store) =>
      new Promise((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      }),
  );
}

function idbPut(key, value) {
  return txn("readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      }),
  );
}

// ── Public API ──────────────────────────────────────────────

/**
 * Save a full city payload to IndexedDB.
 * @param {{ cityName: string, bbox: number[], coords: {lat:number,lon:number}, osmElements: object[], roseData: number[] }} data
 */
export async function saveCityData(data) {
  try {
    await idbPut(CACHE_KEY, data);
  } catch (err) {
    console.warn("[storage] Failed to save city data:", err);
  }
}

/**
 * Load the previously cached city payload (or null).
 * @returns {Promise<{ cityName: string, bbox: number[], coords: {lat:number,lon:number}, osmElements: object[], roseData: number[] } | null>}
 */
export async function loadCityData() {
  try {
    return await idbGet(CACHE_KEY);
  } catch (err) {
    console.warn("[storage] Failed to load city data:", err);
    return null;
  }
}
