/**
 * firebase.ts — Re-export shim for backward compatibility.
 *
 * All implementation has been split into focused modules:
 *   src/firebase/init.ts           — App init, db, auth instances, error types
 *   src/firebase/auth.ts           — Auth subscription, sign-in/out, getCurrentUid
 *   src/firebase/firestoreDigests.ts — CRUD operations for digest documents
 *
 * All existing imports throughout the app continue to work unchanged.
 */

export { auth, db, googleProvider, OperationType, handleFirestoreError } from './firebase/init';
export type { FirestoreErrorInfo } from './firebase/init';
export { subscribeAuth, getCurrentUid, signInWithGoogle, signOutUser } from './firebase/auth';
export {
  getFirestoreDigests,
  saveFirestoreDigest,
  getFirestoreDigestDetails,
  deleteFirestoreDigest,
} from './firebase/firestoreDigests';
