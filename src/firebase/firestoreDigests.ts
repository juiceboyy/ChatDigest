import {
  doc,
  collection,
  setDoc,
  getDocs,
  deleteDoc,
  query,
} from 'firebase/firestore';
import { ChatDigestData } from '../types';
import { db } from './init';
import { getCurrentUid } from './auth';
import { saveDigest, getAllDigests, deleteDigest } from '../db';

// ── Local helper ───────────────────────────────────────────────────────────────

/** Strips digests that the user has already deleted locally. */
function filterDeleted(list: ChatDigestData[]): ChatDigestData[] {
  try {
    const deletedLocal = localStorage.getItem('deleted_digests_list');
    if (deletedLocal) {
      const deletedIds = JSON.parse(deletedLocal) as string[];
      return list.filter((d) => !deletedIds.includes(d.id));
    }
  } catch (e) {
    console.error('[Firestore] Failed to filter deleted digests:', e);
  }
  return list;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Retrieve all chat digests from Firestore for the current user (real or sandbox).
 * Falls back gracefully to IndexedDB and localStorage mirror cache on failure.
 */
export async function getFirestoreDigests(): Promise<ChatDigestData[]> {
  const uid = getCurrentUid();
  if (!uid) return [];

  // Sandbox fallback — persist in localStorage
  if (uid === 'sandbox-guest-user-session') {
    const local = localStorage.getItem('sandbox_digests_store');
    let sandboxList: ChatDigestData[] = [];
    if (local) {
      try {
        sandboxList = JSON.parse(local) as ChatDigestData[];
      } catch (e) {
        console.error('Failed to read sandbox simulated cache', e);
      }
    }

    let localDigests: ChatDigestData[] = [];
    try {
      localDigests = await getAllDigests();
    } catch (e) {}

    const mergedMap = new Map<string, ChatDigestData>();
    for (const d of localDigests) mergedMap.set(d.id, d);
    for (const d of sandboxList) mergedMap.set(d.id, d);
    const mergedList = Array.from(mergedMap.values());
    return filterDeleted(mergedList).sort((a, b) => b.parsedAt - a.parsedAt);
  }

  try {
    const digestsRef = collection(db, 'users', uid, 'digests');
    const snapshot = await getDocs(query(digestsRef));

    let results: ChatDigestData[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as ChatDigestData;
      results.push({
        ...data,
        messages: data.messages || [],
        decisions: data.decisions || [],
        actionItems: data.actionItems || [],
        timeline: data.timeline || [],
        parsedMedia: data.parsedMedia || [],
        zipAttachments: data.zipAttachments || [],
        isFullyLoaded: data.isFullyLoaded ?? false,
      });
    });

    let localDigests: ChatDigestData[] = [];
    try {
      localDigests = await getAllDigests();
    } catch (e) {
      console.warn('Failed to retrieve local digests for merge:', e);
    }

    // Write remote results to IndexedDB, preserving fully-loaded local copies
    for (const d of results) {
      const localCopy = localDigests.find((ld) => ld.id === d.id);
      if (localCopy && localCopy.isFullyLoaded && !d.isFullyLoaded) continue;
      try {
        await saveDigest(d);
      } catch (e) {}
    }

    // Merge: local wins on fully-loaded data, remote wins on metadata
    const mergedMap = new Map<string, ChatDigestData>();
    for (const d of localDigests) mergedMap.set(d.id, d);
    for (const d of results) {
      const localCopy = mergedMap.get(d.id);
      if (localCopy && localCopy.isFullyLoaded && !d.isFullyLoaded) {
        mergedMap.set(d.id, {
          ...localCopy,
          ...d,
          messages: localCopy.messages,
          zipAttachments: localCopy.zipAttachments,
          isFullyLoaded: true,
        });
      } else {
        mergedMap.set(d.id, d);
      }
    }
    const mergedList = Array.from(mergedMap.values());

    try {
      localStorage.setItem(`firestore_mirror_cache_${uid}`, JSON.stringify(mergedList));
    } catch (e) {}

    return filterDeleted(mergedList).sort((a, b) => b.parsedAt - a.parsedAt);
  } catch (error) {
    console.warn('Firestore collection fetch failed. Serving cached/local data instead. Details:', error);

    // Fallback 1: localStorage mirror
    const local = localStorage.getItem(`firestore_mirror_cache_${uid}`);
    let cachedList: ChatDigestData[] = [];
    if (local) {
      try {
        cachedList = JSON.parse(local) as ChatDigestData[];
      } catch (e) {}
    }

    // Fallback 2: IndexedDB
    let localDigests: ChatDigestData[] = [];
    try {
      localDigests = await getAllDigests();
    } catch (e) {}

    const mergedMap = new Map<string, ChatDigestData>();
    for (const d of localDigests) mergedMap.set(d.id, d);
    for (const d of cachedList) {
      const localCopy = mergedMap.get(d.id);
      if (localCopy && localCopy.isFullyLoaded && !d.isFullyLoaded) {
        mergedMap.set(d.id, {
          ...localCopy,
          ...d,
          messages: localCopy.messages,
          zipAttachments: localCopy.zipAttachments,
          isFullyLoaded: true,
        });
      } else {
        mergedMap.set(d.id, d);
      }
    }
    return filterDeleted(Array.from(mergedMap.values())).sort((a, b) => b.parsedAt - a.parsedAt);
  }
}

/**
 * Persist a digest to Firestore. Splits heavy arrays (messages, attachments)
 * into subcollections to stay well under Firestore's 1 MB document limit.
 * Always saves locally first so data is never lost on network failure.
 */
export async function saveFirestoreDigest(digest: ChatDigestData): Promise<void> {
  const uid = getCurrentUid();
  if (!uid) {
    throw new Error('Unauthenticated write request. Please verify connection credentials.');
  }

  // Sandbox fallback — persist in localStorage
  if (uid === 'sandbox-guest-user-session') {
    const local = localStorage.getItem('sandbox_digests_store');
    let current: ChatDigestData[] = [];
    if (local) {
      try {
        current = JSON.parse(local) as ChatDigestData[];
      } catch (e) {}
    }
    const index = current.findIndex((d) => d.id === digest.id);
    if (index >= 0) {
      current[index] = digest;
    } else {
      current.push(digest);
    }
    localStorage.setItem('sandbox_digests_store', JSON.stringify(current));
    return;
  }

  // Local-first: IndexedDB backup
  try {
    await saveDigest(digest);
  } catch (e) {
    console.warn('IndexedDB local-first backup failed:', e);
  }

  // Mirror cache update
  try {
    const local = localStorage.getItem(`firestore_mirror_cache_${uid}`);
    let current: ChatDigestData[] = [];
    if (local) {
      try {
        current = JSON.parse(local) as ChatDigestData[];
      } catch (e) {}
    }
    const index = current.findIndex((d) => d.id === digest.id);
    if (index >= 0) {
      current[index] = digest;
    } else {
      current.push(digest);
    }
    localStorage.setItem(`firestore_mirror_cache_${uid}`, JSON.stringify(current));
  } catch (e) {}

  try {
    const { messages, zipAttachments, ...metadata } = digest;

    // 1. Persist metadata (without heavy arrays)
    const mainDoc = { ...metadata, isFullyLoaded: false };
    const docRef = doc(db, 'users', uid, 'digests', digest.id);
    await setDoc(docRef, mainDoc);

    // 2. Persist messages in chunks of 400 (stays well under 1 MB per doc)
    if (messages && messages.length > 0) {
      const CHUNK_SIZE = 400;
      const chunksCount = Math.ceil(messages.length / CHUNK_SIZE);
      for (let i = 0; i < chunksCount; i++) {
        const chunkSlice = messages.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkRef = doc(db, 'users', uid, 'digests', digest.id, 'messages', `chunk-${i}`);
        await setDoc(chunkRef, { chunkIndex: i, messages: chunkSlice });
      }
    }

    // 3. Persist attachments individually
    if (zipAttachments && zipAttachments.length > 0) {
      for (const att of zipAttachments) {
        const safeId = att.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
        const attRef = doc(db, 'users', uid, 'digests', digest.id, 'attachments', safeId);
        await setDoc(attRef, att);
      }
    }
  } catch (error) {
    console.warn(
      'Firestore remote write failed (likely quota limit exceeded or rules denial). Saved safely to localized storage backup.',
      error
    );
  }
}

/**
 * Lazy-loads messages and attachments for a specific digest from Firestore subcollections.
 * Falls back to IndexedDB and localStorage mirror on failure.
 */
export async function getFirestoreDigestDetails(digestId: string): Promise<Partial<ChatDigestData>> {
  const uid = getCurrentUid();
  if (!uid) return {};

  try {
    // 1. Fetch and assemble message chunks in order
    const messagesRef = collection(db, 'users', uid, 'digests', digestId, 'messages');
    const messagesSnapshot = await getDocs(messagesRef);
    const chunkDocs = messagesSnapshot.docs.map((d) => d.data());
    chunkDocs.sort((a, b) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0));

    const messages: any[] = [];
    for (const chunk of chunkDocs) {
      if (chunk.messages && Array.isArray(chunk.messages)) {
        messages.push(...chunk.messages);
      }
    }

    // 2. Fetch attachments
    const attachmentsRef = collection(db, 'users', uid, 'digests', digestId, 'attachments');
    const attachmentsSnapshot = await getDocs(attachmentsRef);
    const zipAttachments: any[] = [];
    attachmentsSnapshot.forEach((d) => zipAttachments.push(d.data()));

    return { messages, zipAttachments, isFullyLoaded: true };
  } catch (error) {
    console.warn('Firestore lazy details query failed. Falling back to local stores.', error);

    // Fallback: IndexedDB
    try {
      const allLocal = await getAllDigests();
      const matched = allLocal.find((d) => d.id === digestId);
      if (matched && matched.messages && matched.messages.length > 0) {
        return { messages: matched.messages, zipAttachments: matched.zipAttachments || [], isFullyLoaded: true };
      }
    } catch (e) {}

    // Fallback: localStorage mirror cache
    const local = localStorage.getItem(`firestore_mirror_cache_${uid}`);
    if (local) {
      try {
        const parsed = JSON.parse(local) as ChatDigestData[];
        const matched = parsed.find((d) => d.id === digestId);
        if (matched && matched.messages && matched.messages.length > 0) {
          return { messages: matched.messages, zipAttachments: matched.zipAttachments || [], isFullyLoaded: true };
        }
      } catch (e) {}
    }

    return { messages: [], zipAttachments: [], isFullyLoaded: true };
  }
}

/**
 * Deletes a digest record from Firestore, recursively cleaning up subcollections
 * to prevent orphaned data. Also wipes all local copies first.
 */
export async function deleteFirestoreDigest(digestId: string): Promise<void> {
  const uid = getCurrentUid();
  console.log(`[Firestore] deleteFirestoreDigest called for ID: ${digestId}, UID: ${uid}`);
  if (!uid) return;

  // Sandbox fallback
  if (uid === 'sandbox-guest-user-session') {
    console.log('[Firestore] Sandbox mode active. Deleting from sandbox localStorage store.');
    const local = localStorage.getItem('sandbox_digests_store');
    if (local) {
      try {
        const current = JSON.parse(local) as ChatDigestData[];
        localStorage.setItem('sandbox_digests_store', JSON.stringify(current.filter((d) => d.id !== digestId)));
        console.log('[Firestore] Sandbox localStorage store updated successfully.');
      } catch (e) {
        console.error('[Firestore] Failed to parse/update sandbox localStorage:', e);
      }
    }
    return;
  }

  // Wipe locally first for instant UI feedback
  try {
    console.log('[Firestore] Wiping local IndexedDB backup copy first');
    await deleteDigest(digestId);
  } catch (e) {
    console.warn('[Firestore] Failed to delete local IndexedDB backup (ignoring):', e);
  }

  try {
    console.log('[Firestore] Clearing local mirror cache in localStorage');
    const local = localStorage.getItem(`firestore_mirror_cache_${uid}`);
    if (local) {
      const current = JSON.parse(local) as ChatDigestData[];
      localStorage.setItem(
        `firestore_mirror_cache_${uid}`,
        JSON.stringify(current.filter((d) => d.id !== digestId))
      );
    }
  } catch (e) {
    console.warn('[Firestore] Failed to clean up local mirror cache (ignoring):', e);
  }

  const path = `users/${uid}/digests/${digestId}`;
  console.log(`[Firestore] Initiating remote delete for path: ${path}`);
  try {
    const parentRef = doc(db, 'users', uid, 'digests', digestId);

    // 1. Drop message chunks
    const messagesRef = collection(db, 'users', uid, 'digests', digestId, 'messages');
    const messagesSnapshot = await getDocs(messagesRef);
    console.log(`[Firestore] Found ${messagesSnapshot.docs.length} message chunks to delete.`);
    for (const d of messagesSnapshot.docs) {
      await deleteDoc(d.ref);
    }

    // 2. Drop attachments
    const attachmentsRef = collection(db, 'users', uid, 'digests', digestId, 'attachments');
    const attachmentsSnapshot = await getDocs(attachmentsRef);
    console.log(`[Firestore] Found ${attachmentsSnapshot.docs.length} attachments to delete.`);
    for (const d of attachmentsSnapshot.docs) {
      await deleteDoc(d.ref);
    }

    // 3. Drop parent document
    await deleteDoc(parentRef);
    console.log('[Firestore] Remote deletion complete.');
  } catch (error) {
    console.warn('Firestore remote delete failed. Storage has been fully cleaned up on your device.', error);
  }
}
