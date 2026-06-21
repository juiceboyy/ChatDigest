import { ChatDigestData } from './types';

const DB_NAME = 'ChatDigestPersistenceDB';
const DB_VERSION = 1;
const STORE_NAME = 'digests';

/**
 * Initializes the IndexedDB instance
 */
export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open database. Please check browser permissions.'));
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Saves a parsed WhatsApp Chat Digest to the local store
 */
export async function saveDigest(data: ChatDigestData): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(data);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error('Failed to save digest to offline IndexedDB store.'));
    };
  });
}

/**
 * Retrieves all stored digests from IndexedDB
 */
export async function getAllDigests(): Promise<ChatDigestData[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort digests, newest first
      const result = (request.result || []) as ChatDigestData[];
      result.sort((a, b) => b.parsedAt - a.parsedAt);
      resolve(result);
    };

    request.onerror = () => {
      reject(new Error('Failed to load past digests.'));
    };
  });
}

/**
 * Deletes a single digest
 */
export async function deleteDigest(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error('Failed to delete the digest.'));
    };
  });
}

/**
 * Update completion status of an action item inside any saved digest
 */
export async function updateActionItemStatus(
  digestId: string,
  actionItemId: string,
  completed: boolean
): Promise<ChatDigestData | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(digestId);

    getRequest.onsuccess = () => {
      const data = getRequest.result as ChatDigestData | undefined;
      if (!data) {
        resolve(null);
        return;
      }

      // Update the target action item
      data.actionItems = data.actionItems.map((item) =>
        item.id === actionItemId ? { ...item, completed } : item
      );

      // Re-save
      const putRequest = store.put(data);
      putRequest.onsuccess = () => {
        resolve(data);
      };
      putRequest.onerror = () => {
        reject(new Error('Failed to save action item checkbox state.'));
      };
    };

    getRequest.onerror = () => {
      reject(new Error('Failed to query data to update action items.'));
    };
  });
}

/**
 * Update assignee of an action item inside any saved digest
 */
export async function updateActionItemAssignee(
  digestId: string,
  actionItemId: string,
  assignee: string
): Promise<ChatDigestData | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(digestId);

    getRequest.onsuccess = () => {
      const data = getRequest.result as ChatDigestData | undefined;
      if (!data) {
        resolve(null);
        return;
      }

      // Update the target action item's sender (assignee)
      data.actionItems = data.actionItems.map((item) =>
        item.id === actionItemId ? { ...item, sender: assignee } : item
      );

      // Re-save
      const putRequest = store.put(data);
      putRequest.onsuccess = () => {
        resolve(data);
      };
      putRequest.onerror = () => {
        reject(new Error('Failed to save action item assignee.'));
      };
    };

    getRequest.onerror = () => {
      reject(new Error('Failed to query data to update action item assignee.'));
    };
  });
}

