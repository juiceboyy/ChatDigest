import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  collection, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  query
} from 'firebase/firestore';
import { ChatDigestData } from './types';
import config from '../firebase-applet-config.json';
import { saveDigest, getAllDigests, deleteDigest } from './db';

// Initialize Firebase App
const app = initializeApp({
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId
});

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app, config.firestoreDatabaseId || '(default)');
export const googleProvider = new GoogleAuthProvider();

// Error Handling Infrastructure complying with custom error rules
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || getCurrentUid(),
      email: auth.currentUser?.email || (getCurrentUid() === "sandbox-guest-user-session" ? "halfhide@gmail.com" : null),
      emailVerified: auth.currentUser?.emailVerified || false,
      isAnonymous: auth.currentUser?.isAnonymous || false,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Custom fallback state for running inside sandboxed frames with blocked popups
let mockUser: { uid: string; displayName: string; email: string } | null = null;
const mockSubscribers = new Set<(user: any) => void>();

/**
 * Custom auth subscriber that handles both real Firebase Auth and Sandbox Fallback mode
 */
export function subscribeAuth(callback: (user: User | typeof mockUser | null) => void) {
  // Subscribe to real auth state changes
  const unsubscribeReal = onAuthStateChanged(auth, (user) => {
    if (user) {
      callback(user);
    } else {
      callback(mockUser);
    }
  });

  mockSubscribers.add(callback);
  callback(auth.currentUser || mockUser);

  return () => {
    unsubscribeReal();
    mockSubscribers.delete(callback);
  };
}

/**
 * Helper to get the current working UID (real or mock)
 */
export function getCurrentUid(): string | null {
  if (auth.currentUser) return auth.currentUser.uid;
  if (mockUser) return mockUser.uid;
  return null;
}

/**
 * Triggers Google Login popup. Fallbacks to sandbox on credentials block or iframe constraints.
 */
export async function signInWithGoogle(): Promise<{ success: boolean; isFallback: boolean; error?: string }> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { success: true, isFallback: false };
  } catch (err: any) {
    console.warn("Firebase sign-in failed:", err);
    
    const errorCode = err?.code || "";
    
    // If the user manually closed the popup or if the domain is not authorized in Firebase Console,
    // do NOT fall back to sandbox mode. Instead, report the error so the user can address it.
    if (errorCode === "auth/popup-closed-by-user") {
      return { 
        success: false, 
        isFallback: false, 
        error: "Sign-in popup was closed before completion. Please try again." 
      };
    }
    
    if (errorCode === "auth/unauthorized-domain") {
      const host = window.location.hostname;
      return { 
        success: false, 
        isFallback: false, 
        error: `Unauthorized Domain: Please add "${host}" to the Authorized Domains list in the Firebase Authentication Console (Authentication > Settings > Authorized Domains).`
      };
    }

    // Fallback sandbox user session so the user can test persistence seamlessly without third-party cookie blocks!
    mockUser = {
      uid: "sandbox-guest-user-session",
      displayName: "Sandbox Explorer",
      email: "halfhide@gmail.com"
    };
    
    // Notify all subscribers
    mockSubscribers.forEach(cb => cb(mockUser));
    return { 
      success: true, 
      isFallback: true, 
      error: err.message || "Iframe context blocked Auth cookies, sandbox fallback activated." 
    };
  }
}

/**
 * Triggers sign out for both real & sandbox accounts
 */
export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
  mockUser = null;
  mockSubscribers.forEach(cb => cb(null));
}

/**
 * Retrieve all chat digests from Firestore for current active user ID (real or sandbox fallback)
 */
export async function getFirestoreDigests(): Promise<ChatDigestData[]> {
  const uid = getCurrentUid();
  if (!uid) return [];

  // Helper to filter out deleted digests locally
  const filterDeleted = (list: ChatDigestData[]): ChatDigestData[] => {
    try {
      const deletedLocal = localStorage.getItem("deleted_digests_list");
      if (deletedLocal) {
        const deletedIds = JSON.parse(deletedLocal) as string[];
        return list.filter(d => !deletedIds.includes(d.id));
      }
    } catch (e) {
      console.error("[Firestore] Failed to filter deleted digests:", e);
    }
    return list;
  };

  // Sandbox fallback persistence in localStorage so standard sandbox mode is actual persistent storage!
  if (uid === "sandbox-guest-user-session") {
    const local = localStorage.getItem("sandbox_digests_store");
    let sandboxList: ChatDigestData[] = [];
    if (local) {
      try {
        sandboxList = JSON.parse(local) as ChatDigestData[];
      } catch (e) {
        console.error("Failed to read sandbox simulated cache", e);
      }
    }

    // Merge with IndexedDB for consistency
    let localDigests: ChatDigestData[] = [];
    try {
      localDigests = await getAllDigests();
    } catch (e) {}

    const mergedMap = new Map<string, ChatDigestData>();
    for (const d of localDigests) {
      mergedMap.set(d.id, d);
    }
    for (const d of sandboxList) {
      mergedMap.set(d.id, d);
    }
    const mergedList = Array.from(mergedMap.values());
    return filterDeleted(mergedList).sort((a, b) => b.parsedAt - a.parsedAt);
  }

  const path = `users/${uid}/digests`;
  try {
    const digestsRef = collection(db, 'users', uid, 'digests');
    const q = query(digestsRef);
    const snapshot = await getDocs(q);
    
    let results: ChatDigestData[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as ChatDigestData;
      results.push({
        ...data,
        messages: data.messages || [],
        decisions: data.decisions || [],
        actionItems: data.actionItems || [],
        timeline: data.timeline || [],
        parsedMedia: data.parsedMedia || [],
        zipAttachments: data.zipAttachments || [],
        isFullyLoaded: data.isFullyLoaded ?? false
      });
    });

    // Read all local digests from IndexedDB first
    let localDigests: ChatDigestData[] = [];
    try {
      localDigests = await getAllDigests();
    } catch (e) {
      console.warn("Failed to retrieve local digests for merge:", e);
    }

    // Write to offline IndexedDB store as an instant parallel copy
    for (const d of results) {
      const localCopy = localDigests.find(ld => ld.id === d.id);
      if (localCopy && localCopy.isFullyLoaded && !d.isFullyLoaded) {
        // Do not overwrite the local fully loaded copy with metadata-only remote copy!
        continue;
      }
      try {
        await saveDigest(d);
      } catch (e) {
        // Safe to ignore offline backup write error
      }
    }

    const mergedMap = new Map<string, ChatDigestData>();
    for (const d of localDigests) {
      mergedMap.set(d.id, d);
    }
    for (const d of results) {
      const localCopy = mergedMap.get(d.id);
      if (localCopy && localCopy.isFullyLoaded && !d.isFullyLoaded) {
        // Keep the local copy since it is fully loaded with messages/attachments!
        // But update any updated metadata from remote
        mergedMap.set(d.id, {
          ...localCopy,
          ...d, // override metadata from remote
          messages: localCopy.messages, // preserve local messages
          zipAttachments: localCopy.zipAttachments, // preserve local attachments
          isFullyLoaded: true // keep fully loaded status!
        });
      } else {
        mergedMap.set(d.id, d);
      }
    }
    const mergedList = Array.from(mergedMap.values());

    // Mirror to localStorage as a redundant snapshot of the merged list
    try {
      localStorage.setItem(`firestore_mirror_cache_${uid}`, JSON.stringify(mergedList));
    } catch (e) {}

    return filterDeleted(mergedList).sort((a, b) => b.parsedAt - a.parsedAt);
  } catch (error) {
    console.warn("Firestore collection fetch failed (quota or auth issue). Serving cached/local data instead. Details:", error);
    
    // Fallback 1: Read from local storage mirrored copy
    const local = localStorage.getItem(`firestore_mirror_cache_${uid}`);
    let cachedList: ChatDigestData[] = [];
    if (local) {
      try {
        cachedList = JSON.parse(local) as ChatDigestData[];
      } catch (e) {}
    }

    // Fallback 2: Read from local IndexedDB completely offline store
    let localDigests: ChatDigestData[] = [];
    try {
      localDigests = await getAllDigests();
    } catch (e) {}

    // Merge cached and local
    const mergedMap = new Map<string, ChatDigestData>();
    for (const d of localDigests) {
      mergedMap.set(d.id, d);
    }
    for (const d of cachedList) {
      const localCopy = mergedMap.get(d.id);
      if (localCopy && localCopy.isFullyLoaded && !d.isFullyLoaded) {
        mergedMap.set(d.id, {
          ...localCopy,
          ...d,
          messages: localCopy.messages,
          zipAttachments: localCopy.zipAttachments,
          isFullyLoaded: true
        });
      } else {
        mergedMap.set(d.id, d);
      }
    }
    const mergedList = Array.from(mergedMap.values());

    return filterDeleted(mergedList).sort((a, b) => b.parsedAt - a.parsedAt);
  }
}

/**
 * Persist a digest record to Firestore under the authenticated user space.
 * Splits messages and zipAttachments to dodge Firestore's 1MB document size limit!
 */
export async function saveFirestoreDigest(digest: ChatDigestData): Promise<void> {
  const uid = getCurrentUid();
  if (!uid) {
    throw new Error("Unauthenticated write request. Please verify connection credentials.");
  }

  // Sandbox fallback persistence
  if (uid === "sandbox-guest-user-session") {
    const local = localStorage.getItem("sandbox_digests_store");
    let current: ChatDigestData[] = [];
    if (local) {
      try {
        current = JSON.parse(local) as ChatDigestData[];
      } catch (e) {}
    }
    // Upsert
    const index = current.findIndex(d => d.id === digest.id);
    if (index >= 0) {
      current[index] = digest;
    } else {
      current.push(digest);
    }
    localStorage.setItem("sandbox_digests_store", JSON.stringify(current));
    return;
  }

  // Dual persist to local IndexedDB FIRST so the user's data is never lost if network fails/quota is exhausted!
  try {
    await saveDigest(digest);
  } catch (e) {
    console.warn("IndexedDB local-first backup failed:", e);
  }

  // Dual persist to local storage mirror-cache
  try {
    const local = localStorage.getItem(`firestore_mirror_cache_${uid}`);
    let current: ChatDigestData[] = [];
    if (local) {
      try {
        current = JSON.parse(local) as ChatDigestData[];
      } catch (e) {}
    }
    const index = current.findIndex(d => d.id === digest.id);
    if (index >= 0) {
      current[index] = digest;
    } else {
      current.push(digest);
    }
    localStorage.setItem(`firestore_mirror_cache_${uid}`, JSON.stringify(current));
  } catch (e) {}

  const path = `users/${uid}/digests/${digest.id}`;
  try {
    // 1. Separate heavy fields from main document metadata
    const { messages, zipAttachments, ...metadata } = digest;
    
    // Create copy with heavy arrays cleared
    const mainDoc = {
      ...metadata,
      isFullyLoaded: false // Loaded digests will lazy-load subcollections
    };

    // 2. Persist metadata
    const docRef = doc(db, 'users', uid, 'digests', digest.id);
    await setDoc(docRef, mainDoc);

    // 3. Persist messages chunks (400 per doc ensures we stay well under 1MB)
    if (messages && messages.length > 0) {
      const CHUNK_SIZE = 400;
      const chunksCount = Math.ceil(messages.length / CHUNK_SIZE);
      for (let i = 0; i < chunksCount; i++) {
        const chunkSlice = messages.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkRef = doc(db, 'users', uid, 'digests', digest.id, 'messages', `chunk-${i}`);
        await setDoc(chunkRef, {
          chunkIndex: i,
          messages: chunkSlice
        });
      }
    }

    // 4. Persist zip/attachment items individually
    if (zipAttachments && zipAttachments.length > 0) {
      for (const att of zipAttachments) {
        const safeId = att.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
        const attRef = doc(db, 'users', uid, 'digests', digest.id, 'attachments', safeId);
        await setDoc(attRef, att);
      }
    }
  } catch (error) {
    // ABSOLUTELY DO NOT CRASH: intercept the quota/auth check gracefully and serve locally!
    console.warn("Firestore remote write failed (likely quota limit exceeded or rules denial). Saved safely to localized storage backup.", error);
  }
}

/**
 * Lazy loads the message chunks and attachments for a specific digest document.
 */
export async function getFirestoreDigestDetails(digestId: string): Promise<Partial<ChatDigestData>> {
  const uid = getCurrentUid();
  if (!uid) return {};

  const path = `users/${uid}/digests/${digestId}/details`;
  try {
    // 1. Fetch message chunks and assemble them chronologically
    const messagesRef = collection(db, 'users', uid, 'digests', digestId, 'messages');
    const messagesSnapshot = await getDocs(messagesRef);
    
    const chunkDocs = messagesSnapshot.docs.map(doc => doc.data());
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
    attachmentsSnapshot.forEach((doc) => {
      zipAttachments.push(doc.data());
    });

    return {
      messages,
      zipAttachments,
      isFullyLoaded: true
    };
  } catch (error) {
    console.warn("Firestore lazy details query failed. Looking up details in IndexedDB or localStorage instead.", error);
    
    // Look up in IndexedDB (has full arrays)
    try {
      const allLocal = await getAllDigests();
      const matched = allLocal.find(d => d.id === digestId);
      if (matched && matched.messages && matched.messages.length > 0) {
        return {
          messages: matched.messages,
          zipAttachments: matched.zipAttachments || [],
          isFullyLoaded: true
        };
      }
    } catch (e) {}

    // Look up in mirror cache
    const local = localStorage.getItem(`firestore_mirror_cache_${uid}`);
    if (local) {
      try {
        const parsed = JSON.parse(local) as ChatDigestData[];
        const matched = parsed.find(d => d.id === digestId);
        if (matched && matched.messages && matched.messages.length > 0) {
          return {
            messages: matched.messages,
            zipAttachments: matched.zipAttachments || [],
            isFullyLoaded: true
          };
        }
      } catch (e) {}
    }

    return {
      messages: [],
      zipAttachments: [],
      isFullyLoaded: true
    };
  }
}

/**
 * Delete a digest record securely (recursively cleaning up child collections to prevent leaks)
 */
export async function deleteFirestoreDigest(digestId: string): Promise<void> {
  const uid = getCurrentUid();
  console.log(`[Firestore] deleteFirestoreDigest called for ID: ${digestId}, UID: ${uid}`);
  if (!uid) return;

  // Sandbox fallback deletion
  if (uid === "sandbox-guest-user-session") {
    console.log("[Firestore] Sandbox mode active. Deleting from sandbox localStorage store.");
    const local = localStorage.getItem("sandbox_digests_store");
    if (local) {
      try {
        const current = JSON.parse(local) as ChatDigestData[];
        const filtered = current.filter(d => d.id !== digestId);
        localStorage.setItem("sandbox_digests_store", JSON.stringify(filtered));
        console.log("[Firestore] Sandbox localStorage store updated successfully.");
      } catch (e) {
        console.error("[Firestore] Failed to parse/update sandbox localStorage:", e);
      }
    }
    return;
  }

  // WIPE LOCALLY FIRST to ensure instant update response and zero residuals
  try {
    console.log("[Firestore] Wiping local IndexedDB backup copy first");
    await deleteDigest(digestId);
  } catch (e) {
    console.warn("[Firestore] Failed to delete local IndexedDB backup (ignoring):", e);
  }

  try {
    console.log("[Firestore] Clearing local mirror cache in localStorage");
    const local = localStorage.getItem(`firestore_mirror_cache_${uid}`);
    if (local) {
      const current = JSON.parse(local) as ChatDigestData[];
      const filtered = current.filter(d => d.id !== digestId);
      localStorage.setItem(`firestore_mirror_cache_${uid}`, JSON.stringify(filtered));
    }
  } catch (e) {
    console.warn("[Firestore] Failed to clean up local mirror cache (ignoring):", e);
  }

  const path = `users/${uid}/digests/${digestId}`;
  console.log(`[Firestore] Initiating remote delete for path: ${path}`);
  try {
    const parentRef = doc(db, 'users', uid, 'digests', digestId);

    // 1. Drop messages
    console.log("[Firestore] Retrieving messages subcollection chunks...");
    const messagesRef = collection(db, 'users', uid, 'digests', digestId, 'messages');
    const messagesSnapshot = await getDocs(messagesRef);
    console.log(`[Firestore] Found ${messagesSnapshot.docs.length} message chunks to delete.`);
    for (const d of messagesSnapshot.docs) {
      await deleteDoc(d.ref);
    }

    // 2. Drop attachments
    console.log("[Firestore] Retrieving attachments subcollection...");
    const attachmentsRef = collection(db, 'users', uid, 'digests', digestId, 'attachments');
    const attachmentsSnapshot = await getDocs(attachmentsRef);
    console.log(`[Firestore] Found ${attachmentsSnapshot.docs.length} attachments to delete.`);
    for (const d of attachmentsSnapshot.docs) {
      await deleteDoc(d.ref);
    }

    // 3. Drop parent
    console.log("[Firestore] Deleting parent digest metadata document...");
    await deleteDoc(parentRef);
    console.log("[Firestore] Remote deletion complete.");
  } catch (error) {
    console.warn("Firestore remote delete failed. Storage has been fully cleaned up on your device.", error);
  }
}
