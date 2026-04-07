import type { JoySlice } from './dataService';

const DB_NAME = 'joyplot-cache';
const DB_VERSION = 1;
const STORE_NAME = 'joyplotCache';
const MAX_CACHE_ENTRIES = 16;

export interface JoyplotCacheRecord {
  key: string;
  city: string;
  resolution: number;
  bbox: number[];
  geojson: any;
  cityCenter: [number, number] | null;
  maxPop: number;
  slices: JoySlice[];
  updatedAt: number;
}

function getIndexedDB() {
  if (typeof window === 'undefined') return null;
  return window.indexedDB ?? null;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function promisifyRequest<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openCacheDb(): Promise<IDBDatabase> {
  const indexedDB = getIndexedDB();
  if (!indexedDB) {
    return Promise.reject(new Error('IndexedDB is not available in this environment'));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  return dbPromise;
}

async function transactionComplete(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function createJoyplotCacheKey(city: string, resolution: number, bbox: number[]) {
  const normalizedCity = city.trim().toLowerCase();
  const bboxKey = bbox.join(',');
  return `${normalizedCity}:${resolution}:${bboxKey}`;
}

export async function getCachedJoyplot(key: string): Promise<JoyplotCacheRecord | null> {
  try {
    const db = await openCacheDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    const record = await promisifyRequest<IDBValidKey | JoyplotCacheRecord | null>(request);
    await transactionComplete(tx);
    return (record as JoyplotCacheRecord) ?? null;
  } catch (error) {
    console.warn('Joyplot cache read failed:', error);
    return null;
  }
}

async function trimCacheEntries() {
  try {
    const db = await openCacheDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const total = await promisifyRequest<number>(store.count());
    const excess = total - MAX_CACHE_ENTRIES;
    if (excess > 0) {
      const index = store.index('updatedAt');
      let removed = 0;
      const cursorRequest = index.openCursor();

      await new Promise<void>((resolve, reject) => {
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor || removed >= excess) {
            resolve();
            return;
          }
          cursor.delete();
          removed += 1;
          cursor.continue();
        };

        cursorRequest.onerror = () => reject(cursorRequest.error);
      });
    }

    await transactionComplete(tx);
  } catch (error) {
    console.warn('Joyplot cache trim failed:', error);
  }
}

export async function setCachedJoyplot(record: Omit<JoyplotCacheRecord, 'updatedAt'>) {
  try {
    const db = await openCacheDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ ...record, updatedAt: Date.now() });
    await transactionComplete(tx);
    await trimCacheEntries();
  } catch (error) {
    console.warn('Joyplot cache write failed:', error);
  }
}
