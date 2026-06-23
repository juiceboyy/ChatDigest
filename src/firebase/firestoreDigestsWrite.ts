import {
  doc,
  collection,
  setDoc,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import { ChatDigestData } from '../types';
import { db } from './init';
import { getCurrentUid } from './auth';
import { saveDigest, deleteDigest } from '../db';

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
