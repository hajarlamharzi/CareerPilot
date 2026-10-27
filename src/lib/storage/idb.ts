import { IDB_NAME, IDB_STORE_CV_FILES, IDB_VERSION } from "@/config/app";
import type { CvFileMeta } from "@/types";

/**
 * IndexedDB helper for binary CV documents. `localStorage` is unsuitable for
 * files, so uploaded blobs live here keyed by file id, with lightweight
 * metadata kept alongside.
 */

interface StoredCvFile {
  id: string;
  meta: CvFileMeta;
  blob: Blob;
}

function isIndexedDbAvailable(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error("IndexedDB is not available in this browser context."));
      return;
    }
    const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE_CV_FILES)) {
        db.createObjectStore(IDB_STORE_CV_FILES, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open IndexedDB."));
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE_CV_FILES, mode);
        const store = transaction.objectStore(IDB_STORE_CV_FILES);
        const request = operation(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(request.error ?? new Error("IndexedDB request failed."));
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => {
          db.close();
          reject(transaction.error ?? new Error("IndexedDB transaction failed."));
        };
      }),
  );
}

export const cvFileStore = {
  available: isIndexedDbAvailable,

  async put(id: string, blob: Blob, meta: CvFileMeta): Promise<void> {
    const record: StoredCvFile = { id, meta, blob };
    await runTransaction("readwrite", (store) => store.put(record));
  },

  async get(id: string): Promise<StoredCvFile | null> {
    const result = await runTransaction<StoredCvFile | undefined>(
      "readonly",
      (store) => store.get(id),
    );
    return result ?? null;
  },

  async list(): Promise<CvFileMeta[]> {
    const result = await runTransaction<StoredCvFile[]>("readonly", (store) =>
      store.getAll(),
    );
    return result.map((record) => record.meta);
  },

  async remove(id: string): Promise<void> {
    await runTransaction("readwrite", (store) => store.delete(id));
  },

  async clear(): Promise<void> {
    await runTransaction("readwrite", (store) => store.clear());
  },
};
