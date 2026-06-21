import { useState, useEffect, useCallback } from 'react';
import { ChatDigestData } from '../types';
import { initDB, getAllDigests, saveDigest, deleteDigest } from '../db';
import {
  subscribeAuth,
  getCurrentUid,
  signInWithGoogle,
  signOutUser,
  getFirestoreDigests,
  saveFirestoreDigest,
  deleteFirestoreDigest,
  getFirestoreDigestDetails,
} from '../firebase';

interface UseDigestStorageReturn {
  digests: ChatDigestData[];
  setDigests: React.Dispatch<React.SetStateAction<ChatDigestData[]>>;
  activeDigest: ChatDigestData | null;
  setActiveDigest: React.Dispatch<React.SetStateAction<ChatDigestData | null>>;
  loading: boolean;
  currentUser: any | null;
  isSandboxUser: boolean;
  authLoading: boolean;
  isLoggingIn: boolean;
  dbError: string | null;
  setDbError: React.Dispatch<React.SetStateAction<string | null>>;
  handleLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
  handleParsed: (data: ChatDigestData) => Promise<void>;
  handleDeleteDigest: (id: string) => void;
  executeDeleteDigest: (id: string) => Promise<void>;
  handleRenameDigest: (id: string, newTitle: string) => Promise<void>;
  handleUpdateActionItem: (actionItemId: string, completed: boolean) => Promise<void>;
  handleUpdateActionItemAssignee: (actionItemId: string, assignee: string) => Promise<void>;
  deleteConfirmId: string | null;
  setDeleteConfirmId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useDigestStorage(): UseDigestStorageReturn {
  const [digests, setDigests] = useState<ChatDigestData[]>([]);
  const [activeDigest, setActiveDigest] = useState<ChatDigestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isSandboxUser, setIsSandboxUser] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Subscribe to auth state and load digests accordingly
  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeAuth(async (user) => {
      if (!active) return;
      setCurrentUser(user);
      setIsSandboxUser(user?.uid === 'sandbox-guest-user-session');
      setAuthLoading(false);
      setLoading(true);
      setDbError(null);

      try {
        if (user) {
          const stored = await getFirestoreDigests();
          if (active) {
            setDigests(stored);
            if (stored.length > 0) {
              setActiveDigest((prev) => {
                const exists = stored.find((d) => d.id === prev?.id);
                return exists || stored[0];
              });
            } else {
              setActiveDigest(null);
            }
          }
        } else {
          await initDB();
          const stored = await getAllDigests();
          if (active) {
            setDigests(stored);
            if (stored.length > 0) {
              setActiveDigest((prev) => {
                const exists = stored.find((d) => d.id === prev?.id);
                return exists || stored[0];
              });
            } else {
              setActiveDigest(null);
            }
          }
        }
      } catch (err: any) {
        console.error('Storage loading failed:', err);
        if (active) {
          setDbError(
            'Unable to retrieve saved digests from Firebase cloud database. Sandbox data fallback is active.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Lazy load full digest details when selection changes
  useEffect(() => {
    let active = true;

    async function loadDetails() {
      if (!activeDigest || activeDigest.isFullyLoaded || !getCurrentUid() || isSandboxUser) return;

      setLoading(true);
      try {
        const details = await getFirestoreDigestDetails(activeDigest.id);
        if (!active) return;

        const fullDigest = { ...activeDigest, ...details, isFullyLoaded: true };
        setActiveDigest(fullDigest);
        setDigests((prev) => prev.map((d) => (d.id === activeDigest.id ? fullDigest : d)));
      } catch (err: any) {
        console.error('Failed to load digest granular details:', err);
        setDbError('Unable to retrieve chat histories or files from cloud storage.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDetails();
    return () => { active = false; };
  }, [activeDigest?.id, currentUser, isSandboxUser]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setDbError(null);
    try {
      const res = await signInWithGoogle();
      if (res.isFallback) {
        setDbError(
          'Your browser context blocked popup cookies inside the sandboxed frame. Successfully launched safe local sandbox persistence!'
        );
      } else if (res.error) {
        setDbError(res.error);
      }
    } catch (e: any) {
      console.error(e);
      setDbError('Failed to authenticate user connection. Standard offline database active.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOutUser();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleParsed = useCallback(async (data: ChatDigestData) => {
    const fullData = { ...data, isFullyLoaded: true };
    try {
      setDigests((prev) =>
        [fullData, ...prev].filter((d, i, self) => self.findIndex((x) => x.id === d.id) === i)
      );
      setActiveDigest(fullData);

      await saveDigest(fullData);

      if (getCurrentUid()) {
        saveFirestoreDigest(fullData).catch((err) => {
          console.warn('Background Firestore sync failed:', err);
        });
      }
    } catch (err: any) {
      console.error('Failed to save parsed digest:', err);
      setDigests((prev) =>
        [fullData, ...prev].filter((d, i, self) => self.findIndex((x) => x.id === d.id) === i)
      );
      setActiveDigest(fullData);
    }
  }, []);

  const handleDeleteDigest = (id: string) => {
    setDeleteConfirmId(id);
  };

  const executeDeleteDigest = async (id: string) => {
    console.log(`[App] executeDeleteDigest starting for ID: ${id}`);
    setDeleteConfirmId(null);

    try {
      const deletedLocal = localStorage.getItem('deleted_digests_list');
      const list = deletedLocal ? (JSON.parse(deletedLocal) as string[]) : [];
      if (!list.includes(id)) {
        list.push(id);
        localStorage.setItem('deleted_digests_list', JSON.stringify(list));
      }
    } catch (e) {
      console.error('[App] Failed to write deleted tracking to localStorage:', e);
    }

    // Optimistic UI update
    const filtered = digests.filter((d) => d.id !== id);
    setDigests(filtered);
    setActiveDigest((prev) => {
      if (prev?.id !== id) return prev;
      return filtered.length > 0 ? filtered[0] : null;
    });

    try {
      if (getCurrentUid()) {
        await deleteFirestoreDigest(id);
      } else {
        await deleteDigest(id);
      }
    } catch (err) {
      console.error('[App] Failed to delete digest database record:', err);
    }
  };

  const handleRenameDigest = useCallback(
    async (id: string, newTitle: string) => {
      setDigests((prev) => prev.map((d) => (d.id === id ? { ...d, title: newTitle } : d)));
      setActiveDigest((prev) => (prev?.id === id ? { ...prev, title: newTitle } : prev));

      try {
        const existing = digests.find((d) => d.id === id);
        if (!existing) return;
        const updated = { ...existing, title: newTitle };
        await saveDigest(updated);
        if (getCurrentUid()) {
          saveFirestoreDigest(updated).catch((err) => {
            console.warn('Background Firestore rename sync failed:', err);
          });
        }
      } catch (err) {
        console.error('[App] Failed to save renamed digest:', err);
      }
    },
    [digests]
  );

  const handleUpdateActionItem = useCallback(
    async (actionItemId: string, completed: boolean) => {
      if (!activeDigest) return;

      const updatedDigest = {
        ...activeDigest,
        actionItems: activeDigest.actionItems.map((item) =>
          item.id === actionItemId ? { ...item, completed } : item
        ),
      };

      setDigests((prev) => prev.map((d) => (d.id === updatedDigest.id ? updatedDigest : d)));
      setActiveDigest(updatedDigest);

      try {
        await saveDigest(updatedDigest);
        if (getCurrentUid()) {
          saveFirestoreDigest(updatedDigest).catch((err) => {
            console.warn('Background Firestore action item update failed:', err);
          });
        }
      } catch (err) {
        console.error(err);
      }
    },
    [activeDigest]
  );

  const handleUpdateActionItemAssignee = useCallback(
    async (actionItemId: string, assignee: string) => {
      if (!activeDigest) return;

      const updatedDigest = {
        ...activeDigest,
        actionItems: activeDigest.actionItems.map((item) =>
          item.id === actionItemId ? { ...item, sender: assignee } : item
        ),
      };

      setDigests((prev) => prev.map((d) => (d.id === updatedDigest.id ? updatedDigest : d)));
      setActiveDigest(updatedDigest);

      try {
        await saveDigest(updatedDigest);
        if (getCurrentUid()) {
          saveFirestoreDigest(updatedDigest).catch((err) => {
            console.warn('Background Firestore assignee update failed:', err);
          });
        }
      } catch (err) {
        console.error(err);
      }
    },
    [activeDigest]
  );

  return {
    digests,
    setDigests,
    activeDigest,
    setActiveDigest,
    loading,
    currentUser,
    isSandboxUser,
    authLoading,
    isLoggingIn,
    dbError,
    setDbError,
    handleLogin,
    handleLogout,
    handleParsed,
    handleDeleteDigest,
    executeDeleteDigest,
    handleRenameDigest,
    handleUpdateActionItem,
    handleUpdateActionItemAssignee,
    deleteConfirmId,
    setDeleteConfirmId,
  };
}
