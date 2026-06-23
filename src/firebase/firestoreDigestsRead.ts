import {
  collection,
  getDocs,
  query,
} from 'firebase/firestore';
import { ChatDigestData } from '../types';
import { db } from './init';
import { getCurrentUid } from './auth';
import { saveDigest, getAllDigests } from '../db';
import { saveFirestoreDigest } from './firestoreDigestsWrite';

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

    // Background sync: any local digest that is NOT in Firestore should be uploaded
    for (const localDigest of localDigests) {
      const existsOnRemote = results.some((r) => r.id === localDigest.id);
      if (!existsOnRemote) {
        console.log(`[Firestore] Syncing local-only digest ${localDigest.id} to cloud.`);
        saveFirestoreDigest(localDigest).catch((err) => {
          console.warn(`[Firestore] Background sync failed for ${localDigest.id}:`, err);
        });
      }
    }

    // Write remote results to IndexedDB, preserving fully-loaded local copies
    for (const d of results) {
      const localCopy = localDigests.find((ld) => ld.id === d.id);
      if (localCopy && localCopy.isFullyLoaded && !d.isFullyLoaded && localCopy.datesFixed === d.datesFixed) continue;
      try {
        await saveDigest(d);
      } catch (e) {}
    }

    // Merge: local wins on fully-loaded data, remote wins on metadata
    const mergedMap = new Map<string, ChatDigestData>();
    for (const d of localDigests) mergedMap.set(d.id, d);
    for (const d of results) {
      const localCopy = mergedMap.get(d.id);
      if (localCopy && localCopy.isFullyLoaded && !d.isFullyLoaded && localCopy.datesFixed === d.datesFixed) {
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
      if (localCopy && localCopy.isFullyLoaded && !d.isFullyLoaded && localCopy.datesFixed === d.datesFixed) {
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
