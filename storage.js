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
  const SAVE_THROTTLE_MS = 1500;   // Debounce Firestore writes to limit billing

  let activeBackend = null;
  let remoteUpdateCallback = null;
  let saveTimer = null;
  let pendingState = null;
  let lastUser = null;   // {email, uid, isAdmin}

  // ─── localStorage backend ─────────────────────────────────────────────────
  const localBackend = {
    name: 'local',
    async load() {
      try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        console.warn('[Storage:local] load failed:', e);
        return null;
      }
    },
    save(state) {
      try {
        const persistable = { ...state };
        delete persistable.user;
        delete persistable.route;
        localStorage.setItem(LS_KEY, JSON.stringify(persistable));
      } catch (e) {
        console.warn('[Storage:local] save failed:', e);
      }
    },
    onRemoteUpdate() { /* no-op — localStorage has no remote */ },
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
    let unsubscribe = null;
    let skipNextRemoteUpdate = false;   // suppress echo after our own writes

    return {
      name: 'firebase',
      isCloud: true,
      async load() {
        try {
          const snap = await docRef().get({ source: 'default' });
          if (!snap.exists) {
            // First time — return null so the app shows empty state / welcome
            return null;
          }
          return snap.data();
        } catch (e) {
          console.warn('[Storage:firebase] load failed, falling back to local cache:', e);
          // Try local backup
          return await localBackend.load();
        }
      },
      save(state) {
        const persistable = { ...state, _updatedAt: Date.now() };
        delete persistable.user;
        delete persistable.route;
        skipNextRemoteUpdate = true;
        docRef().set(persistable, { merge: false })
          .catch(e => console.warn('[Storage:firebase] save failed (will retry on next save):', e));
        // Also save locally as a safety net (in case Firestore offline cache misses)
        localBackend.save(state);
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
  };
})();
