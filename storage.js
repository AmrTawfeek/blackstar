// ═══════════════════════════════════════════════════════════════════════════
// STORAGE ABSTRACTION — bridges the app to either localStorage or Firebase.
// ═══════════════════════════════════════════════════════════════════════════
//
// The app uses a tiny three-function interface:
//   await Storage.load()              → returns the saved state object, or null
//   Storage.save(state)               → fire-and-forget save; throttled if cloud
//   Storage.onRemoteUpdate(callback)  → fires when another device updates data
//
// Two backends:
//   1. localStorage (default, offline-only) — used if firebase-config.js has
//      no apiKey, or if Firebase fails to initialize.
//   2. Firebase Firestore — used if firebase-config.js has valid keys.
//      Offline persistence is enabled, so the app keeps working without
//      internet and syncs when it comes back.
//
// The current login user is shared across the app via Storage.currentUser().
//
// ═══════════════════════════════════════════════════════════════════════════

(function() {
  const LS_KEY = 'blackstars-crm-v1';
  const SAVE_THROTTLE_MS = 3000;   // Debounce Firestore writes (also eases write-stream pressure)

  let activeBackend = null;
  let remoteUpdateCallback = null;
  let saveTimer = null;
  let pendingState = null;
  let lastUser = null;   // {email, uid, isAdmin}

  // ─── Data-loss guard ──────────────────────────────────────────────────────
  // The cloud save is a FULL-document overwrite (merge:false). If the app ever
  // holds empty/partial state (a failed cloud read, a fresh deploy, a device
  // that hasn't synced) and then saves, it would wipe everyone's data. So we
  // refuse to write an EMPTY dataset over a known-populated one. `lastKnownGood`
  // is the count of records we last confirmed exist; `loadErrored` means we
  // could not trust the cloud read, so we treat the cloud as "might have data".
  let lastKnownGood = 0;
  let loadErrored = false;
  const recordCount = s => s ? ((s.members?.length || 0) + (s.invoices?.length || 0)) : 0;
  function blockEmptyWrite(state) {
    const n = recordCount(state);
    const force = (typeof window !== 'undefined' && window.__allowEmptySave);
    if (n === 0 && !force && (lastKnownGood > 0 || loadErrored)) {
      console.error(`[Storage] BLOCKED empty write — refusing to overwrite ${lastKnownGood || 'existing'} records with 0. (Use "Clear all data" if this is intentional.)`);
      try { if (typeof window !== 'undefined' && typeof window.__onCloudWriteBlocked === 'function') window.__onCloudWriteBlocked(lastKnownGood); } catch (_) {}
      return true;
    }
    if (n === 0 && force) lastKnownGood = 0;   // accepted reset = new empty baseline
    if (n > 0) lastKnownGood = n;
    return false;
  }
  // Exposed for the app layer / diagnostics.
  function noteLoaded(data) { const n = recordCount(data); if (n > 0) lastKnownGood = n; }

  // ─── localStorage backend ─────────────────────────────────────────────────
  const localBackend = {
    name: 'local',
    async load() {
      try {
        const raw = localStorage.getItem(LS_KEY);
        const data = raw ? JSON.parse(raw) : null;
        noteLoaded(data);
        return data;
      } catch (e) {
        console.warn('[Storage:local] load failed:', e);
        return null;
      }
    },
    save(state) {
      if (blockEmptyWrite(state)) return;   // guard: never wipe good data with empty
      try {
        const persistable = { ...state };
        delete persistable.user;
        delete persistable.route;
        localStorage.setItem(LS_KEY, JSON.stringify(persistable));
      } catch (e) {
        // Quota errors must reach the app layer so the user gets a loud warning
        // (their change wasn't saved). Other errors are swallowed as before.
        const isQuota = e && (e.name === 'QuotaExceededError' || e.code === 22 ||
          e.code === 1014 || /quota/i.test(e.message || ''));
        if (isQuota) {
          console.error('[Storage:local] save failed — quota exceeded:', e);
          throw e;
        }
        console.warn('[Storage:local] save failed:', e);
      }
    },
    onRemoteUpdate() { /* no-op — localStorage has no remote */ },
    // Session lock is a no-op locally (single device = always the sole writer).
    async getLock() { return null; },
    async setLock() { return true; },
    async clearLock() {},
    onLockChange() {},
    async signIn(email, password) {
      // Local backend: just accept the legacy admin/admin123 check
      if ((email === 'admin' || email === 'admin@blackstars.qa') && password === 'admin123') {
        lastUser = { email, uid: 'local-admin', isAdmin: true };
        return lastUser;
      }
      throw new Error('Invalid credentials');
    },
    async signOut() { lastUser = null; },
    currentUser() { return lastUser; },
    isCloud: false,
  };

  // ─── Firebase backend ─────────────────────────────────────────────────────
  // Built lazily — only initializes if firebase-config.js has valid keys.
  function buildFirebaseBackend() {
    const cfg = window.FIREBASE_CONFIG || {};
    if (!cfg.apiKey) return null;

    // Validate the Firebase SDK is loaded (modular v9+ via CDN)
    if (!window.firebase || !window.firebase.initializeApp) {
      console.warn('[Storage:firebase] Firebase SDK not loaded — falling back to localStorage');
      return null;
    }

    // Initialize Firebase app (only once)
    let app, db, auth;
    try {
      app = window.firebase.initializeApp({
        apiKey: cfg.apiKey,
        authDomain: cfg.authDomain,
        projectId: cfg.projectId,
        storageBucket: cfg.storageBucket,
        messagingSenderId: cfg.messagingSenderId,
        appId: cfg.appId,
      });
      db = window.firebase.firestore();
      auth = window.firebase.auth();
      // Enable offline persistence (works offline, syncs when reconnected)
      db.enablePersistence({ synchronizeTabs: true }).catch(err => {
        if (err.code === 'failed-precondition') {
          console.warn('[Storage:firebase] Persistence not available (multiple tabs)');
        } else if (err.code === 'unimplemented') {
          console.warn('[Storage:firebase] Persistence not supported by this browser');
        }
      });
    } catch (e) {
      console.error('[Storage:firebase] Init failed:', e);
      return null;
    }

    const docRef = () => db.doc(cfg.dataPath || 'clubs/blackstars');
    const lockRef = () => db.doc((cfg.dataPath || 'clubs/blackstars') + '_session');
    let lockUnsub = null;
    let unsubscribe = null;
    let skipNextRemoteUpdate = false;   // suppress echo after our own writes
    let writeInFlight = false;          // a Firestore write is currently pending
    let pendingAfterWrite = null;       // newest state to write once the current one finishes
    let lastWriteFailed = false;        // surfaced to the app for a "saving paused" notice

    // Performs ONE Firestore write and, only after it settles, flushes the most
    // recent pending state (if any). Keeping a single write outstanding at a time is
    // what prevents "resource-exhausted: write stream exhausted maximum allowed
    // queued writes" when many saves happen quickly.
    function _flushWrite(state) {
      const persistable = { ...state, _updatedAt: Date.now() };
      delete persistable.user;
      delete persistable.route;
      delete persistable.session;
      writeInFlight = true;
      skipNextRemoteUpdate = true;
      docRef().set(persistable, { merge: false })
        .then(() => { lastWriteFailed = false; })
        .catch(e => {
          lastWriteFailed = true;
          console.warn('[Storage:firebase] save failed (kept locally, will retry on next change):', e && e.code || e);
          try { if (typeof window !== 'undefined' && typeof window.__onCloudSaveError === 'function') window.__onCloudSaveError(e); } catch (_) {}
        })
        .finally(() => {
          writeInFlight = false;
          // If newer data arrived while we were writing, write that now (one more,
          // single, outstanding write — never a pile-up).
          if (pendingAfterWrite) {
            const next = pendingAfterWrite;
            pendingAfterWrite = null;
            _flushWrite(next);
          }
        });
    }

    return {
      name: 'firebase',
      isCloud: true,
      // ── Session lock (single active writer) ──────────────────────────────
      // Stored in a SEPARATE small doc so heartbeats never churn the main data
      // document. Shape: { sessionId, holderName, role, ts (epoch ms) }.
      async getLock() {
        try { const s = await lockRef().get({ source: 'server' }); return s.exists ? s.data() : null; }
        catch (e) { try { const s = await lockRef().get(); return s.exists ? s.data() : null; } catch (_) { return null; } }
      },
      async setLock(lock) {
        try { await lockRef().set(lock, { merge: false }); return true; }
        catch (e) { console.warn('[Storage:firebase] setLock failed:', e && e.code || e); return false; }
      },
      async clearLock(sessionId) {
        // Only clear if we still hold it (avoid stomping a newer holder).
        try {
          const s = await lockRef().get();
          if (s.exists && s.data() && s.data().sessionId === sessionId) await lockRef().set({ sessionId: null, ts: 0 }, { merge: false });
        } catch (_) {}
      },
      onLockChange(cb) {
        try { if (lockUnsub) lockUnsub(); lockUnsub = lockRef().onSnapshot(s => cb(s.exists ? s.data() : null), () => {}); }
        catch (e) { console.warn('[Storage:firebase] onLockChange failed:', e); }
      },
      async load() {
        try {
          const snap = await docRef().get({ source: 'default' });
          if (!snap.exists) {
            // First time — return null so the app shows empty state / welcome
            loadErrored = false;
            return null;
          }
          loadErrored = false;
          const data = snap.data();
          noteLoaded(data);
          return data;
        } catch (e) {
          console.warn('[Storage:firebase] load failed, falling back to local cache:', e);
          loadErrored = true;   // we could NOT trust the cloud → block empty overwrites
          // Try local backup
          return await localBackend.load();
        }
      },
      save(state) {
        if (blockEmptyWrite(state)) return;   // guard: never wipe good cloud data with empty
        // Always keep a local safety-net copy first (instant, free, never lost).
        try { localBackend.save(state); }
        catch (e) { console.warn('[Storage:firebase] local safety-net save failed:', e); }
        // Coalesce: if a Firestore write is already in flight, DON'T fire another one
        // (that's what exhausts the write-stream queue). Just remember the newest state
        // and flush it once the current write resolves. This guarantees at most ONE
        // outstanding write at a time, with the latest data always winning.
        if (writeInFlight) { pendingAfterWrite = state; return; }
        _flushWrite(state);
      },
      onRemoteUpdate(callback) {
        remoteUpdateCallback = callback;
        if (unsubscribe) unsubscribe();
        unsubscribe = docRef().onSnapshot(snap => {
          if (skipNextRemoteUpdate) { skipNextRemoteUpdate = false; return; }
          if (snap.exists && callback) callback(snap.data());
        }, err => console.warn('[Storage:firebase] snapshot listener error:', err));
      },
      async signIn(email, password) {
        try {
          // Convert short "admin" to the canonical email if needed
          const e = email.includes('@') ? email : (email + '@blackstars.qa');
          const cred = await auth.signInWithEmailAndPassword(e, password);
          lastUser = {
            email: cred.user.email,
            uid: cred.user.uid,
            isAdmin: true,   // Single-account model: all authed users are admin
          };
          return lastUser;
        } catch (e) {
          console.warn('[Storage:firebase] signIn failed:', e.code, e.message);
          throw new Error(e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found'
            ? 'Invalid email or password'
            : 'Sign-in failed: ' + (e.message || e.code));
        }
      },
      async signOut() {
        await auth.signOut().catch(() => {});
        lastUser = null;
      },
      currentUser() {
        if (lastUser) return lastUser;
        const u = auth.currentUser;
        if (u) {
          lastUser = { email: u.email, uid: u.uid, isAdmin: true };
        }
        return lastUser;
      },
      async updatePassword(newPassword) {
        const u = auth.currentUser;
        if (!u) throw new Error('Not signed in');
        try {
          await u.updatePassword(newPassword);   // stored securely by Firebase Auth
          return true;
        } catch (e) {
          if (e && e.code === 'auth/requires-recent-login') throw new Error('Please sign out and sign in again, then change your password.');
          throw new Error(e.message || 'Could not change password');
        }
      },
      // Create a member login WITHOUT disturbing the admin's current session, by
      // using a separate ("secondary") Firebase app just for provisioning.
      async provisionMemberLogin(email, password) {
        let secondary;
        try { secondary = firebase.app('memberProvisioner'); }
        catch (_) { secondary = firebase.initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId }, 'memberProvisioner'); }
        try {
          await secondary.auth().createUserWithEmailAndPassword(email, password);
          await secondary.auth().signOut().catch(() => {});
          return 'created';
        } catch (e) {
          if (e && e.code === 'auth/email-already-in-use') return 'exists';
          throw e;   // surface rate-limit / weak-password / network errors to the caller
        }
      },
      async sendPasswordReset(email) {
        await auth.sendPasswordResetEmail(email);   // emailed reset link (real inboxes only)
        return true;
      },
    };
  }

  // ─── Public API ────────────────────────────────────────────────────────────
  window.Storage = {
    init() {
      // Try Firebase first; fall back to localStorage if not configured
      activeBackend = buildFirebaseBackend() || localBackend;
      console.log(`[Storage] Active backend: ${activeBackend.name}`);
      return activeBackend.name;
    },
    backendName() { return activeBackend?.name || 'none'; },
    isCloud() { return !!activeBackend?.isCloud; },
    async load() {
      if (!activeBackend) this.init();
      return await activeBackend.load();
    },
    save(state) {
      if (!activeBackend) this.init();
      // Throttle: collect rapid saves into one (cloud writes cost money + take time)
      pendingState = state;
      if (activeBackend.isCloud) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          activeBackend.save(pendingState);
          pendingState = null;
        }, SAVE_THROTTLE_MS);
      } else {
        // Local saves are instant + free
        activeBackend.save(state);
      }
    },
    saveNow(state) {
      // Bypass throttle (e.g. on logout)
      clearTimeout(saveTimer);
      activeBackend.save(state);
      pendingState = null;
    },
    onRemoteUpdate(cb) {
      if (!activeBackend) this.init();
      activeBackend.onRemoteUpdate(cb);
    },
    // ── Session lock pass-throughs ──
    async getLock() { if (!activeBackend) this.init(); return activeBackend.getLock ? await activeBackend.getLock() : null; },
    async setLock(lock) { if (!activeBackend) this.init(); return activeBackend.setLock ? await activeBackend.setLock(lock) : true; },
    async clearLock(sessionId) { if (!activeBackend) this.init(); if (activeBackend.clearLock) await activeBackend.clearLock(sessionId); },
    onLockChange(cb) { if (!activeBackend) this.init(); if (activeBackend.onLockChange) activeBackend.onLockChange(cb); },
    async signIn(email, password) {
      if (!activeBackend) this.init();
      return await activeBackend.signIn(email, password);
    },
    async signOut() {
      if (!activeBackend) this.init();
      await activeBackend.signOut();
    },
    currentUser() {
      if (!activeBackend) this.init();
      return activeBackend.currentUser();
    },
    async updatePassword(newPassword) {
      if (!activeBackend) this.init();
      if (!activeBackend.updatePassword) throw new Error('Password change isn\u2019t available in offline mode');
      return await activeBackend.updatePassword(newPassword);
    },
    async provisionMemberLogin(email, password) {
      if (!activeBackend) this.init();
      if (!activeBackend.provisionMemberLogin) throw new Error('Creating member logins requires cloud sign-in (Firebase).');
      return await activeBackend.provisionMemberLogin(email, password);
    },
    async sendPasswordReset(email) {
      if (!activeBackend) this.init();
      if (!activeBackend.sendPasswordReset) throw new Error('Password reset requires cloud sign-in (Firebase).');
      return await activeBackend.sendPasswordReset(email);
    },
  };
})();
