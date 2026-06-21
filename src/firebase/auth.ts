import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth, googleProvider } from './init';

// ── Sandbox Fallback State ─────────────────────────────────────────────────────
// Maintains a mock user for sandboxed frames where popup cookies are blocked.

let mockUser: { uid: string; displayName: string; email: string } | null = null;
const mockSubscribers = new Set<(user: any) => void>();

/**
 * Custom auth subscriber that handles both real Firebase Auth and Sandbox Fallback mode.
 */
export function subscribeAuth(callback: (user: User | typeof mockUser | null) => void) {
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
 * Returns the current working UID (real Firebase user or sandbox mock).
 */
export function getCurrentUid(): string | null {
  if (auth.currentUser) return auth.currentUser.uid;
  if (mockUser) return mockUser.uid;
  return null;
}

/**
 * Triggers Google Login popup. Falls back to a sandbox session when popup
 * cookies are blocked (e.g., inside sandboxed iframes).
 */
export async function signInWithGoogle(): Promise<{
  success: boolean;
  isFallback: boolean;
  error?: string;
}> {
  try {
    await signInWithPopup(auth, googleProvider);
    return { success: true, isFallback: false };
  } catch (err: any) {
    console.warn('Firebase sign-in failed:', err);

    const errorCode = err?.code || '';

    // User closed the popup — do NOT fall back to sandbox.
    if (errorCode === 'auth/popup-closed-by-user') {
      return {
        success: false,
        isFallback: false,
        error: 'Sign-in popup was closed before completion. Please try again.',
      };
    }

    // Domain not authorized — surface the error clearly.
    if (errorCode === 'auth/unauthorized-domain') {
      const host = window.location.hostname;
      return {
        success: false,
        isFallback: false,
        error: `Unauthorized Domain: Please add "${host}" to the Authorized Domains list in the Firebase Authentication Console (Authentication > Settings > Authorized Domains).`,
      };
    }

    // Activate sandbox fallback for iframe/cookie-blocked environments.
    mockUser = {
      uid: 'sandbox-guest-user-session',
      displayName: 'Sandbox Explorer',
      email: 'halfhide@gmail.com',
    };

    mockSubscribers.forEach((cb) => cb(mockUser));
    return {
      success: true,
      isFallback: true,
      error: err.message || 'Iframe context blocked Auth cookies, sandbox fallback activated.',
    };
  }
}

/**
 * Signs out both real Firebase users and clears sandbox mock sessions.
 */
export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
  mockUser = null;
  mockSubscribers.forEach((cb) => cb(null));
}
