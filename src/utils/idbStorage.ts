/**
 * Client-side IndexedDB storage for files to ensure 100% reliable downloads
 * even when deployed on static hosting (GitHub Pages, Vercel, Netlify) without a backend server.
 */

const DB_NAME = 'cloudsend_file_store';
const STORE_NAME = 'files';
const DB_VERSION = 1;

export function openFileDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function storeFileBlobLocally(idOrKey: string, blob: Blob): Promise<void> {
  try {
    const db = await openFileDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(blob, idOrKey);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Could not store file in IndexedDB:', err);
  }
}

export async function getFileBlobLocally(idOrKey: string): Promise<Blob | null> {
  try {
    const db = await openFileDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(idOrKey);

      request.onsuccess = () => {
        const result = request.result;
        if (result instanceof Blob) {
          resolve(result);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Could not retrieve file from IndexedDB:', err);
    return null;
  }
}
