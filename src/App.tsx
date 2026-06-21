import React, { useState, useEffect } from 'react';
import { 
  Plus, History, MessageSquare, ShieldAlert, CheckCircle2, Cloud,
  Cpu, FileCode, CheckSquare, RefreshCw, Layers, LogIn, LogOut, ShieldCheck, User as UserIcon
} from 'lucide-react';
import { ChatDigestData } from './types';
import { initDB, getAllDigests, saveDigest, deleteDigest, updateActionItemStatus, updateActionItemAssignee } from './db';
import { 
  subscribeAuth, 
  getCurrentUid, 
  signInWithGoogle, 
  signOutUser, 
  getFirestoreDigests, 
  saveFirestoreDigest, 
  deleteFirestoreDigest,
  getFirestoreDigestDetails
} from './firebase';
import UploadZone from './components/UploadZone';
import HistorySidebar from './components/HistorySidebar';
import Dashboard from './components/Dashboard';
import ConfirmationModal from './components/ConfirmationModal';

export default function App() {
  const [digests, setDigests] = useState<ChatDigestData[]>([]);
  const [activeDigest, setActiveDigest] = useState<ChatDigestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Collapsed on mobile by default
  const [dbError, setDbError] = useState<string | null>(null);
  
  // Custom Confirmation Dialog State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Auth and sync state
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isSandboxUser, setIsSandboxUser] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Subscribe and synchronize data with Firebase / IndexedDB fallback
  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeAuth(async (user) => {
      if (!active) return;
      setCurrentUser(user);
      setIsSandboxUser(user?.uid === "sandbox-guest-user-session");
      setAuthLoading(false);
      setLoading(true);
      setDbError(null);

      try {
        if (user) {
          // Cloud Storage (or localStorage sandbox fallback)
          const stored = await getFirestoreDigests();
          if (active) {
            setDigests(stored);
            if (stored.length > 0) {
              setActiveDigest((prev) => {
                // Keep selected if still exists, or default first
                const exists = stored.find(d => d.id === prev?.id);
                return exists || stored[0];
              });
            } else {
              setActiveDigest(null);
            }
          }
        } else {
          // Offline DB fallback
          await initDB();
          const stored = await getAllDigests();
          if (active) {
            setDigests(stored);
            if (stored.length > 0) {
              setActiveDigest((prev) => {
                const exists = stored.find(d => d.id === prev?.id);
                return exists || stored[0];
              });
            } else {
              setActiveDigest(null);
            }
          }
        }
      } catch (err: any) {
        console.error("Storage loading failed:", err);
        if (active) {
          setDbError("Unable to retrieve saved digests from Firebase cloud database. Sandbox data fallback is active.");
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

  // Lazy load message log and binary attachments when activeDigest changes
  useEffect(() => {
    let active = true;
    
    async function loadDetails() {
      if (!activeDigest || activeDigest.isFullyLoaded || !getCurrentUid() || isSandboxUser) {
        return;
      }
      
      setLoading(true);
      try {
        const details = await getFirestoreDigestDetails(activeDigest.id);
        if (!active) return;
        
        const fullDigest = {
          ...activeDigest,
          ...details,
          isFullyLoaded: true
        };
        
        setActiveDigest(fullDigest);
        setDigests((prev) => prev.map((d) => d.id === activeDigest.id ? fullDigest : d));
      } catch (err: any) {
        console.error("Failed to load digest granular details:", err);
        setDbError("Unable to retrieve chat histories or files from cloud storage.");
      } finally {
        if (active) setLoading(false);
      }
    }
    
    loadDetails();
    
    return () => {
      active = false;
    };
  }, [activeDigest?.id, currentUser, isSandboxUser]);

  // Login handler
  const handleLogin = async () => {
    setIsLoggingIn(true);
    setDbError(null);
    try {
      const res = await signInWithGoogle();
      if (res.isFallback) {
        setDbError("Your browser context blocked popup cookies inside the sandboxed frame. Successfully launched safe local sandbox persistence!");
      } else if (res.error) {
        setDbError(res.error);
      }
    } catch (e: any) {
      console.error(e);
      setDbError("Failed to authenticate user connection. Standard offline database active.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout handler
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

  // Save new digest
  const handleParsed = async (data: ChatDigestData) => {
    try {
      if (getCurrentUid()) {
        await saveFirestoreDigest(data);
        const stored = await getFirestoreDigests();
        setDigests(stored);
        setActiveDigest(data);
      } else {
        await saveDigest(data);
        const stored = await getAllDigests();
        setDigests(stored);
        setActiveDigest(data);
      }
      // Close sidebar drawer if open on mobile
      setSidebarOpen(false);
    } catch (err: any) {
      console.error(err);
      // Fallback state update
      setDigests((prev) => [data, ...prev].filter((d, i, self) => self.findIndex(x => x.id === d.id) === i));
      setActiveDigest(data);
    }
  };

  // Delete a digest record
  const handleDeleteDigest = (id: string) => {
    setDeleteConfirmId(id);
  };

  const executeDeleteDigest = async (id: string) => {
    console.log(`[App] executeDeleteDigest starting for ID: ${id}`);
    setDeleteConfirmId(null);
    try {
      if (getCurrentUid()) {
        console.log(`[App] Deleting Cloud/Sandbox Digest with UID: ${getCurrentUid()}`);
        await deleteFirestoreDigest(id);
      } else {
        console.log("[App] Deleting local IndexedDB digest offline");
        await deleteDigest(id);
      }
    } catch (err) {
      console.error("[App] Failed to delete digest database record:", err);
    } finally {
      console.log("[App] Updating React state for digests");
      const filtered = digests.filter((d) => d.id !== id);
      setDigests(filtered);
      if (activeDigest?.id === id) {
        console.log("[App] Deleted active digest; updating activeDigest selection");
        setActiveDigest(filtered.length > 0 ? filtered[0] : null);
      }
    }
  };

  // Update checkbox item state in storage with Firebase support
  const handleUpdateActionItem = async (actionItemId: string, completed: boolean) => {
    if (!activeDigest) return;

    const updatedDigest = {
      ...activeDigest,
      actionItems: activeDigest.actionItems.map((item) =>
        item.id === actionItemId ? { ...item, completed } : item
      )
    };

    try {
      if (getCurrentUid()) {
        await saveFirestoreDigest(updatedDigest);
        setDigests((prev) => prev.map((d) => (d.id === updatedDigest.id ? updatedDigest : d)));
        setActiveDigest(updatedDigest);
      } else {
        const updated = await updateActionItemStatus(activeDigest.id, actionItemId, completed);
        if (updated) {
          setDigests((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
          setActiveDigest(updated);
        }
      }
    } catch (err) {
      console.error(err);
      setDigests((prev) => prev.map((d) => (d.id === updatedDigest.id ? updatedDigest : d)));
      setActiveDigest(updatedDigest);
    }
  };

  // Update assignee in storage with Firebase support
  const handleUpdateActionItemAssignee = async (actionItemId: string, assignee: string) => {
    if (!activeDigest) return;

    const updatedDigest = {
      ...activeDigest,
      actionItems: activeDigest.actionItems.map((item) =>
        item.id === actionItemId ? { ...item, sender: assignee } : item
      )
    };

    try {
      if (getCurrentUid()) {
        await saveFirestoreDigest(updatedDigest);
        setDigests((prev) => prev.map((d) => (d.id === updatedDigest.id ? updatedDigest : d)));
        setActiveDigest(updatedDigest);
      } else {
        const updated = await updateActionItemAssignee(activeDigest.id, actionItemId, assignee);
        if (updated) {
          setDigests((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
          setActiveDigest(updated);
        }
      }
    } catch (err) {
      console.error(err);
      setDigests((prev) => prev.map((d) => (d.id === updatedDigest.id ? updatedDigest : d)));
      setActiveDigest(updatedDigest);
    }
  };

  const handleStartNewImport = () => {
    setActiveDigest(null);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-gray-200 font-sans flex flex-col antialiased selection:bg-blue-600/30 selection:text-blue-200" id="chatdigest-application">
      
      {/* DB Connection Warning Alerts */}
      {dbError && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-400 p-3.5 text-xs text-center flex items-center justify-center gap-2 animate-fadeIn" id="conn-warning">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{dbError}</span>
        </div>
      )}

      {/* MASTER TOP APPLICATION BAR */}
      <header className="sticky top-0 z-40 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" id="app-topbar">
        {/* Brand Signage */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-blue-500 rounded-lg blur-md opacity-25"></div>
            <div className="relative p-2 bg-blue-600 text-white rounded-lg border border-white/10 shadow-md">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-white leading-none">
              ChatDigest 
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded ml-2.5 uppercase tracking-wider font-mono">
                Firebase Cloud Sync Ready
              </span>
            </h1>
            <p className="text-[10px] text-gray-500 font-light mt-1">Hybrid Cloud-Native WhatsApp Parser & Analytical Dashboard</p>
          </div>
        </div>

        {/* Global Controls & Auth */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          {/* User Profile / Login Panel */}
          {authLoading ? (
            <div className="h-9 w-24 bg-white/5 rounded-lg animate-pulse flex items-center justify-center border border-white/5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-gray-500" />
            </div>
          ) : currentUser ? (
            <div className="flex items-center gap-2.5 bg-white/5 p-1.5 pl-3 pr-2.5 rounded-xl border border-white/10 text-xs">
              <div className="flex items-center gap-2">
                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt={currentUser.displayName || "User"} 
                    className="w-5 h-5 rounded-full object-cover border border-white/20" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <UserIcon className="w-3.5 h-3.5 text-indigo-400" />
                )}
                <div className="text-left leading-normal">
                  <p className="font-semibold text-gray-200 select-all leading-none">{currentUser.displayName || "Active User"}</p>
                  <p className="text-[9px] text-[#22c55e] font-mono mt-0.5 flex items-center gap-1 font-bold">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    {isSandboxUser ? "Guest Mode" : "Sync Active"}
                  </p>
                </div>
              </div>
              <div className="h-6 w-px bg-white/10 mx-1" />
              <button
                onClick={handleLogout}
                disabled={loading}
                className="p-1.5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 rounded-lg transition-all cursor-pointer"
                title="Log out of custom account"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md hover:shadow-indigo-500/10 border border-indigo-500/20"
            >
              {isLoggingIn ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LogIn className="w-3.5 h-3.5" />
              )}
              Cloud Sync with Google
            </button>
          )}

          {/* Mobile drawer toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors"
          >
            <History className="w-4 h-4" />
          </button>

          <button
            onClick={handleStartNewImport}
            className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-indigo-400 transition-colors rounded-xl border border-white/10 text-xs font-semibold flex items-center gap-1.5"
            id="top-new-import-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            New Import
          </button>
        </div>
      </header>

      {/* TWO COLUMN PANELS LAYOUT */}
      <div className="flex-1 flex relative overflow-hidden" id="workspace-layout">
        
        {/* LHS SIDEBAR: Past Imports list */}
        {/* Desktop permanent list */}
        <div className="hidden lg:block w-76 shrink-0 h-full overflow-hidden" id="desktop-sidebar-pane">
          <HistorySidebar
            digests={digests}
            selectedId={activeDigest?.id || null}
            onSelect={(d) => {
              setActiveDigest(d);
              setSidebarOpen(false);
            }}
            onDelete={handleDeleteDigest}
            onNewImport={handleStartNewImport}
          />
        </div>

        {/* Mobile floating sidebar slide drawer */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex" id="mobile-sidebar-drawer">
            {/* Backdrop cover */}
            <div 
              className="fixed inset-0 bg-[#0A0A0A]/80 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            ></div>
            
            <div className="relative w-80 max-w-[85vw] h-full bg-[#121212] border-r border-white/10 animate-slideRight">
              <HistorySidebar
                digests={digests}
                selectedId={activeDigest?.id || null}
                onSelect={(d) => {
                  setActiveDigest(d);
                  setSidebarOpen(false);
                }}
                onDelete={handleDeleteDigest}
                onNewImport={handleStartNewImport}
              />
            </div>
          </div>
        )}

        {/* WORKSPACE CONTENT AREA */}
        <main className="flex-1 overflow-y-auto bg-[#0A0A0A]" id="main-scroller">
          {loading ? (
            <div className="h-96 flex flex-col items-center justify-center gap-3 animate-pulse text-gray-500" id="main-loader-state">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-xs font-semibold tracking-wider font-mono">LOADING LOCAL PLATFORM...</p>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto px-4 py-8 md:px-8 space-y-8" id="content-container">
              
              {activeDigest ? (
                // Selected report parsed view
                <div className="animate-fadeIn" key={activeDigest.id} id="content-loaded-wrapper">
                  <Dashboard
                    digest={activeDigest}
                    onUpdateActionItem={handleUpdateActionItem}
                    onUpdateActionItemAssignee={handleUpdateActionItemAssignee}
                    onSaveDigest={handleParsed}
                  />
                </div>
              ) : (
                // Blank upload landing page
                <div className="animate-fadeIn py-8" id="upload-stage-wrapper">
                  <div className="text-center max-w-xl mx-auto space-y-4 mb-10" id="app-intro">
                    <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Analyze WhatsApp Exports with Gemini AI</h2>
                    <p className="text-gray-400 font-light text-xs sm:text-sm leading-relaxed">
                      Transform plain WhatsApp backup text exports into clean, analytical digests backed by Gemini AI. Effortlessly track discussions, map consensus agreements, and outline action items securely.
                    </p>
                  </div>

                  <UploadZone onParsed={handleParsed} />

                  {/* Highlights and local capabilities cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl mx-auto mt-14" id="utility-capabilities-grid">
                    <div className="p-5 bg-[#121212] rounded-xl border border-white/5 text-left space-y-3 hover:border-white/10 transition-colors">
                      <div className="p-2 bg-white/5 text-blue-400 rounded-lg border border-white/10 inline-block">
                        <CheckSquare className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs uppercase tracking-wider font-bold text-gray-300">Action Tracker</h4>
                      <p className="text-[11px] text-gray-500 leading-relaxed font-light">
                        Scans messages for structures like "I will" or "todo" assignments to organize checklist follow-ups.
                      </p>
                    </div>

                    <div className="p-5 bg-[#121212] rounded-xl border border-white/5 text-left space-y-3 hover:border-white/10 transition-colors">
                      <div className="p-2 bg-white/5 text-emerald-400 rounded-lg border border-white/10 inline-block">
                        <Layers className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs uppercase tracking-wider font-bold text-gray-300">Key Decisions</h4>
                      <p className="text-[11px] text-gray-500 leading-relaxed font-light">
                        Groups consensus statements with phrases containing words like "agreed," "confirmed," or "deal" into list nodes.
                      </p>
                    </div>

                    <div className="p-5 bg-[#121212] rounded-xl border border-white/5 text-left space-y-3 hover:border-white/10 transition-colors">
                      <div className="p-2 bg-white/5 text-indigo-400 rounded-lg border border-white/10 inline-block">
                        <Plus className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs uppercase tracking-wider font-bold text-gray-300">Isolated Storage</h4>
                      <p className="text-[11px] text-gray-500 leading-relaxed font-light">
                        Persists logs directly inside IndexedDB offline caches on your own device, guaranteeing privacy.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </main>
      </div>

      {/* Global minimal clean footer */}
      <footer className="py-4 border-t border-white/5 text-center text-[10px] text-gray-500 bg-[#0F0F0F] shrink-0 select-none" id="app-footer">
        <p>© 2026 ChatDigest • Private Isolated Infrastructure • Geometric Balance Theme</p>
      </footer>

      {/* Custom Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmId !== null}
        title="Delete Chat Digest"
        message="Are you sure you want to delete this chat digest? This action cannot be undone and will erase all parsed records from storage."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteConfirmId) {
            executeDeleteDigest(deleteConfirmId);
          }
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
