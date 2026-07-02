// ═══════════════════════════════════════════════════════════════════════════
// STORAGE ABSTRACTION — bridges the app to either localStorage or Firebase.
// ═══════════════════════════════════════════════════════════════════════════
//
//   await Storage.load()              → returns the saved state object, or null
//   Storage.save(state)               → fire-and-forget save; throttled if cloud
//   Storage.onRemoteUpdate(callback)  → fires when another user updates data
//
// Two backends:
//   1. localStorage (default, offline-only) — used if firebase-config.js has
//      no apiKey, or if Firebase fails to initialize.
//   2. Firebase Firestore — MULTI-DOCUMENT model (one document per record). Used
//      if firebase-config.js has valid keys.
//
// ─── MULTI-DOCUMENT FIRESTORE MODEL (multi-user build) ──────────────────────
// Each record is its OWN document under a subcollection of the club:
//
//     clubs/blackstars                 ← parent "meta" doc: settings, schema,
//                                         campSchedule, recentSearches
//     clubs/blackstars/members/{id}    ← one document per member (attendance is
//                                         here, deep-merged field-by-field)
//     clubs/blackstars/invoices/{id}   ← one document per invoice
//     …one subcollection per collection (see COLLECTIONS).
//
// Why: (1) N users can write at the same time — different records = different
// documents, no clobbering; (2) field-level merge:true deep-merges nested maps,
// so two coaches marking the same member's attendance both keep their marks;
// (3) save() writes only the records that changed; (4) no 1 MiB document limit.
//
// The hardened data-loss guard and the "server is the source of truth" reads
// from the single-document build are PRESERVED below.
// ═══════════════════════════════════════════════════════════════════════════

(function() {
  // Versioned local key — a new deployment uses a NEW key so stale data from an
  // older version is never read as authoritative. The local copy is a non-
  // authoritative emergency cache only; the cloud is the single source of truth.
  const LS_KEY = 'blackstars-crm-v2';
  const LS_LEGACY_KEYS = ['blackstars-crm-v1'];
  const SAVE_THROTTLE_MS = 1500;   // per-record writes are cheap → snappier multi-user sync

  // Per-record collections (each becomes a subcollection). Anything else in the
  // saved state (settings, campSchedule, recentSearches, schema/version meta) is
  // stored on the parent "meta" document.
  const COLLECTIONS = [
    'members', 'coaches', 'invoices', 'expenses', 'salaries', 'sales', 'advices',
    'trials', 'rentals', 'rentalCustomers', 'schedule', 'swimGroups', 'auditLog',
    'membershipTransfers', 'cashCounts', 'families', 'notes', 'products', 'drivers',
    'posts',
  ];
  const isCollectionKey = k => COLLECTIONS.indexOf(k) !== -1;
  const DEVICE_ONLY = ['user', 'route', 'session'];
  const MAX_BATCH_OPS = 400;   // Firestore hard limit is 500 ops/batch.

  // Refresh the local emergency cache from CONFIRMED cloud data (only after a
  // successful SERVER read). Superseded legacy keys are dropped.
  function _refreshLocalFromCloud(data) {
    if (!data) return;
    try {
      const persistable = { ...data };
      for (const k of DEVICE_ONLY) delete persistable[k];
      localStorage.setItem(LS_KEY, JSON.stringify(persistable));
      for (const k of LS_LEGACY_KEYS) { try { localStorage.removeItem(k); } catch (_) {} }
    } catch (e) { console.warn('[Storage] local cache refresh failed (non-fatal):', e); }
  }

  let activeBackend = null;
  let remoteUpdateCallback = null;
  let saveTimer = null;
  let pendingState = null;
  let lastUser = null;

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const _stable = v => { try { return JSON.stringify(v); } catch (_) { return String(v); } };
  let _idSeq = 0;
  function genId(prefix) {
    _idSeq = (_idSeq + 1) % 100000;
    return (prefix || 'rec') + '_' + Date.now().toString(36) + '_' + _idSeq.toString(36);
  }
  function indexById(arr, prefix) {
    const m = new Map();
    for (const r of (Array.isArray(arr) ? arr : [])) {
      if (!r || typeof r !== 'object') continue;
      if (r.id == null || r.id === '') r.id = genId(prefix);
      m.set(String(r.id), r);
    }
    return m;
  }
  function chunk(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }
  // True field-level update: only the top-level fields that changed. Fields the
  // writer didn't touch are omitted, so merge:true can never clobber a concurrent
  // edit to a DIFFERENT field. Nested maps (e.g. member.dailyAttendance) are sent
  // whole but Firestore deep-merges them, preserving sibling keys other users set.
  function fieldDelta(prev, cur) {
    const FieldValue = window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue;
    const delta = {};
    for (const k of Object.keys(cur)) { if (_stable(prev[k]) !== _stable(cur[k])) delta[k] = cur[k]; }
    for (const k of Object.keys(prev)) { if (!(k in cur)) delta[k] = FieldValue ? FieldValue.delete() : null; }
    if (cur.id != null) delta.id = cur.id;
    return delta;
  }

  // ─── Data-loss guard (hardened — preserved from the single-doc build) ───────
  // In multi-document mode a "wipe" save would issue deletes for every record, so
  // the same protection applies. cloudReadFailed blocks ALL cloud writes until a
  // real SERVER read succeeds.
  let lastKnownGood = 0, lkgMembers = 0, lkgInvoices = 0;
  let loadErrored = false, cloudReadFailed = false;
  const _counts = s => ({ m: (s && s.members && s.members.length) || 0, i: (s && s.invoices && s.invoices.length) || 0 });
  function _blockReason(state) {
    const force = (typeof window !== 'undefined' && window.__allowEmptySave);
    const c = _counts(state);
    if (force) return null;
    if (cloudReadFailed) return 'cloud not confirmed (working from offline copy)';
    if (c.m + c.i === 0 && (lastKnownGood > 0 || loadErrored)) return 'whole dataset is empty';
    if (lkgInvoices > 5 && c.i === 0) return `invoices went to 0 (had ${lkgInvoices})`;
    if (lkgMembers > 5 && c.m === 0) return `members went to 0 (had ${lkgMembers})`;
    if (lkgInvoices > 20 && c.i < lkgInvoices * 0.1) return `invoices dropped ${lkgInvoices}→${c.i}`;
    if (lkgMembers > 20 && c.m < lkgMembers * 0.1) return `members dropped ${lkgMembers}→${c.m}`;
    return null;
  }
  function blockEmptyWrite(state) {
    const force = (typeof window !== 'undefined' && window.__allowEmptySave);
    const reason = _blockReason(state);
    if (reason) {
      console.error(`[Storage] BLOCKED save — refusing to overwrite good data: ${reason}. (Use "Clear all data" / Restore if intentional.)`);
      try { if (typeof window !== 'undefined' && typeof window.__onCloudWriteBlocked === 'function') window.__onCloudWriteBlocked(lastKnownGood, reason); } catch (_) {}
      return true;
    }
    const c = _counts(state);
    if (force && c.m + c.i === 0) { lkgMembers = 0; lkgInvoices = 0; lastKnownGood = 0; }
    if (c.m > 0) lkgMembers = c.m;
    if (c.i > 0) lkgInvoices = c.i;
    if (c.m + c.i > 0) lastKnownGood = c.m + c.i;
    return false;
  }
  function noteServerLoaded(data) {
    const c = _counts(data);
    if (c.m > 0) lkgMembers = c.m;
    if (c.i > 0) lkgInvoices = c.i;
    if (c.m + c.i > 0) lastKnownGood = c.m + c.i;
    cloudReadFailed = false;
    // Expose a confirmation flag so the UI can show "loaded from the server at HH:MM".
    try {
      if (typeof window !== 'undefined') {
        let docs = 0; for (const k of COLLECTIONS) if (Array.isArray(data && data[k])) docs += data[k].length;
        window.__lastCloudRead = { at: Date.now(), source: 'server', members: c.m, invoices: c.i, documents: docs + 1 /* + parent meta */ };
        if (typeof window.__onCloudReadOK === 'function') window.__onCloudReadOK(window.__lastCloudRead);
      }
    } catch (_) {}
  }

  // ─── localStorage backend (unchanged emergency cache) ───────────────────────
  const localBackend = {
    name: 'local',
    async load() {
      try {
        let raw = localStorage.getItem(LS_KEY);
        if (!raw) { for (const k of LS_LEGACY_KEYS) { const lr = localStorage.getItem(k); if (lr) { raw = lr; break; } } }
        return raw ? JSON.parse(raw) : null;
      } catch (e) { console.warn('[Storage:local] load failed:', e); return null; }
    },
    save(state) {
      if (blockEmptyWrite(state)) return;
      try {
        const persistable = { ...state };
        for (const k of DEVICE_ONLY) delete persistable[k];
        localStorage.setItem(LS_KEY, JSON.stringify(persistable));
      } catch (e) {
        const isQuota = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014 || /quota/i.test(e.message || ''));
        if (isQuota) { console.error('[Storage:local] save failed — quota exceeded:', e); throw e; }
        console.warn('[Storage:local] save failed:', e);
      }
    },
    onRemoteUpdate() {},
    async getLock() { return null; },
    async setLock() { return true; },
    async clearLock() {},
    onLockChange() {},
    async signIn(email, password) {
      if ((email === 'admin' || email === 'admin@blackstars.qa') && password === 'admin123') { lastUser = { email, uid: 'local-admin', isAdmin: true }; return lastUser; }
      throw new Error('Invalid credentials');
    },
    async signOut() { lastUser = null; },
    currentUser() { return lastUser; },
    isCloud: false,
    needsMigration() { return false; },
    async migrateToMultiDoc() { return { migrated: false, reason: 'offline mode (localStorage)' }; },
  };

  // ─── Firebase backend (MULTI-DOCUMENT) ──────────────────────────────────────
  function buildFirebaseBackend() {
    const cfg = window.FIREBASE_CONFIG || {};
    if (!cfg.apiKey) return null;
    if (!window.firebase || !window.firebase.initializeApp) {
      console.warn('[Storage:firebase] Firebase SDK not loaded — falling back to localStorage');
      return null;
    }

    let app, db, auth;
    try {
      app = window.firebase.initializeApp({
        apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId,
        storageBucket: cfg.storageBucket, messagingSenderId: cfg.messagingSenderId, appId: cfg.appId,
      });
      db = window.firebase.firestore();
      auth = window.firebase.auth();
      // ── LOCAL EMULATOR support (test the cloud path before deployment). Only when
      // firebase-config.js sets useEmulator:true; production is untouched. ──
      if (cfg.useEmulator) {
        const host = cfg.emulatorHost || '127.0.0.1';
        try {
          db.useEmulator(host, cfg.firestoreEmulatorPort || 8080);
          auth.useEmulator('http://' + host + ':' + (cfg.authEmulatorPort || 9099), { disableWarnings: true });
          console.log(`[Storage:firebase] 🔧 Using LOCAL emulators — Firestore ${host}:${cfg.firestoreEmulatorPort || 8080}, Auth ${host}:${cfg.authEmulatorPort || 9099}`);
        } catch (e) { console.warn('[Storage:firebase] useEmulator failed:', e); }
      } else {
        db.enablePersistence({ synchronizeTabs: true }).catch(err => {
          if (err.code === 'failed-precondition') console.warn('[Storage:firebase] Persistence not available (multiple tabs)');
          else if (err.code === 'unimplemented') console.warn('[Storage:firebase] Persistence not supported by this browser');
        });
      }
    } catch (e) { console.error('[Storage:firebase] Init failed:', e); return null; }

    const PARENT = cfg.dataPath || 'clubs/blackstars';
    const parentRef = () => db.doc(PARENT);
    const colRef = name => db.collection(PARENT + '/' + name);

    const _base = {};                  // collection → Map<id, jsonString> (last server truth)
    for (const name of COLLECTIONS) _base[name] = new Map();
    let _baseMeta = '';
    const _live = {};                  // collection → Map<id, record> (for realtime delivery)
    for (const name of COLLECTIONS) _live[name] = new Map();
    let _liveMeta = {};
    const _seeded = {}; let _metaSeeded = false;
    const _unsubs = [];
    let writeInFlight = false, pendingAfterWrite = null, lastWriteFailed = false, needsMigrationFlag = false;

    function pickMeta(state) {
      const meta = {};
      for (const k of Object.keys(state || {})) { if (isCollectionKey(k) || DEVICE_ONLY.indexOf(k) !== -1) continue; meta[k] = state[k]; }
      return meta;
    }
    function setBaseFromState(state) {
      for (const name of COLLECTIONS) {
        const m = new Map();
        const idx = indexById(state[name], name.slice(0, 3));
        for (const [id, rec] of idx) m.set(id, _stable(rec));
        _base[name] = m;
      }
      _baseMeta = _stable(pickMeta(state));
    }

    function _flushWrite(state) {
      writeInFlight = true;
      const ops = [];
      for (const name of COLLECTIONS) {
        const baseMap = _base[name] || new Map();
        const curIdx = indexById(state[name], name.slice(0, 3));
        for (const [id, rec] of curIdx) {
          const prevStr = baseMap.get(id);
          const now = _stable(rec);
          if (prevStr === now) continue;
          if (prevStr === undefined) { ops.push({ kind: 'set', name, id, data: rec }); continue; }
          ops.push({ kind: 'set', name, id, data: fieldDelta(JSON.parse(prevStr), rec) });
        }
        for (const id of baseMap.keys()) { if (!curIdx.has(id)) ops.push({ kind: 'del', name, id }); }
      }
      const meta = pickMeta(state); meta._updatedAt = Date.now();
      const metaStr = _stable(meta); const metaChanged = metaStr !== _baseMeta;

      if (ops.length === 0 && !metaChanged) {
        writeInFlight = false;
        if (pendingAfterWrite) { const n = pendingAfterWrite; pendingAfterWrite = null; _flushWrite(n); }
        return;
      }
      const batches = chunk(ops, MAX_BATCH_OPS); if (batches.length === 0) batches.push([]);
      // ── SAVE VISIBILITY: summarise EXACTLY what is being written to Firestore. ──
      const perCol = {}; let nSet = 0, nDel = 0;
      for (const op of ops) { perCol[op.name] = (perCol[op.name] || 0) + 1; if (op.kind === 'set') nSet++; else nDel++; }
      const writeSummary = {
        at: new Date().toISOString(), path: PARENT, records: ops.length, sets: nSet, deletes: nDel, metaChanged, byCollection: perCol,
        docs: ops.map(o => ({ doc: PARENT + '/' + o.name + '/' + o.id, kind: o.kind, fields: o.kind === 'set' ? Object.keys(o.data) : undefined, data: o.kind === 'set' ? o.data : undefined })),
      };
      console.log(`%c[Storage] ⤴ writing ${ops.length} doc(s)${metaChanged ? ' + settings' : ''} to Firestore (${PARENT})`, 'color:#5b8def;font-weight:600', perCol);
      try {
        if (typeof window !== 'undefined') {
          window.__lastCloudWrite = writeSummary;   // inspect in devtools to SEE the stored object
          window.__cloudWriteLog = (window.__cloudWriteLog || []);
          window.__cloudWriteLog.push({ at: writeSummary.at, records: ops.length, metaChanged, ok: null });
          if (window.__cloudWriteLog.length > 50) window.__cloudWriteLog.shift();
          if (typeof window.__onCloudSaveStatus === 'function') window.__onCloudSaveStatus({ phase: 'saving', records: ops.length });
        }
      } catch (_) {}
      const commits = batches.map((group, bi) => {
        const batch = db.batch();
        for (const op of group) {
          const ref = colRef(op.name).doc(op.id);
          if (op.kind === 'set') batch.set(ref, op.data, { merge: true });
          else batch.delete(ref);
        }
        if (bi === 0 && metaChanged) batch.set(parentRef(), meta, { merge: true });
        return batch.commit();
      });
      Promise.all(commits)
        .then(() => {
          lastWriteFailed = false; setBaseFromState(state);
          console.log(`%c[Storage] ✅ stored in Firestore — ${nSet} written, ${nDel} deleted${metaChanged ? ', settings updated' : ''} @ ${new Date().toLocaleTimeString()}`, 'color:#16a34a;font-weight:700');
          try { if (typeof window !== 'undefined') { const L = window.__cloudWriteLog; if (L && L.length) L[L.length - 1].ok = true; if (typeof window.__onCloudSaveStatus === 'function') window.__onCloudSaveStatus({ phase: 'saved', records: ops.length, at: Date.now() }); } } catch (_) {}
        })
        .catch(e => {
          lastWriteFailed = true;
          console.error('[Storage] ❌ save FAILED (kept locally, will retry on next change):', (e && e.code) || e, e);
          try {
            if (typeof window !== 'undefined') {
              const L = window.__cloudWriteLog; if (L && L.length) L[L.length - 1].ok = false;
              if (typeof window.__onCloudSaveError === 'function') window.__onCloudSaveError(e);
              if (typeof window.__onCloudSaveStatus === 'function') window.__onCloudSaveStatus({ phase: 'error', error: (e && e.code) || String(e) });
            }
          } catch (_) {}
        })
        .finally(() => { writeInFlight = false; if (pendingAfterWrite) { const n = pendingAfterWrite; pendingAfterWrite = null; _flushWrite(n); } });
    }

    function assembleLive() {
      const out = {};
      for (const k of Object.keys(_liveMeta)) { if (isCollectionKey(k)) continue; out[k] = _liveMeta[k]; }
      for (const name of COLLECTIONS) out[name] = Array.from(_live[name].values());
      return out;
    }

    return {
      name: 'firebase',
      isCloud: true,
      // Session lock decommissioned — concurrency is safe by design.
      async getLock() { return null; },
      async setLock() { return true; },
      async clearLock() {},
      onLockChange() {},
      needsMigration() { return needsMigrationFlag; },

      async load() {
        try {
          const parentSnap = await parentRef().get({ source: 'server' });
          const parent = parentSnap.exists ? (parentSnap.data() || {}) : null;
          const colResults = await Promise.all(COLLECTIONS.map(name =>
            colRef(name).get({ source: 'server' })
              .then(qs => { const arr = []; qs.forEach(d => arr.push(d.data())); return [name, arr]; })
              .catch(e => { console.warn('[Storage:firebase] read ' + name + ' failed:', (e && e.code) || e); return [name, null]; })
          ));
          const assembled = {}; let anySubData = false, anyReadFail = false;
          for (const [name, arr] of colResults) { if (arr === null) { anyReadFail = true; continue; } assembled[name] = arr; if (arr.length) anySubData = true; }

          // A partial/failed SERVER read → don't trust it, block writes (read-only).
          if (anyReadFail) {
            loadErrored = true; cloudReadFailed = true;
            console.warn('[Storage:firebase] SERVER read incomplete — offline copy READ-ONLY (cloud writes blocked).');
            try { if (typeof window !== 'undefined' && typeof window.__onCloudReadFailed === 'function') window.__onCloudReadFailed(new Error('partial read')); } catch (_) {}
            return await localBackend.load();
          }

          // Legacy single-document back-compat: old doc kept collections INLINE.
          const parentHasInlineArrays = parent && COLLECTIONS.some(k => Array.isArray(parent[k]) && parent[k].length);
          if (!anySubData && parentHasInlineArrays) {
            needsMigrationFlag = true; loadErrored = false; cloudReadFailed = false;
            noteServerLoaded(parent); _refreshLocalFromCloud(parent);
            console.warn('[Storage:firebase] Legacy single-document detected — running on inline data. Migration recommended.');
            return parent;
          }
          if (!parent && !anySubData) { loadErrored = false; cloudReadFailed = false; return null; }

          const result = {};
          if (parent) for (const k of Object.keys(parent)) { if (!isCollectionKey(k)) result[k] = parent[k]; }
          Object.assign(result, assembled);
          needsMigrationFlag = false; loadErrored = false; cloudReadFailed = false;
          noteServerLoaded(result); _refreshLocalFromCloud(result);
          try { console.log(`%c[Storage] ✅ loaded from Firestore — ${(result.members || []).length} members, ${(result.invoices || []).length} invoices from ${PARENT}`, 'color:#16a34a;font-weight:600'); } catch (_) {}
          setBaseFromState(result);
          _liveMeta = pickMeta(result);
          for (const name of COLLECTIONS) { _live[name] = new Map(); for (const r of (assembled[name] || [])) if (r && r.id != null) _live[name].set(String(r.id), r); }
          return result;
        } catch (e) {
          console.warn('[Storage:firebase] SERVER load failed — offline copy READ-ONLY (cloud writes blocked):', (e && e.code) || e);
          loadErrored = true; cloudReadFailed = true;
          try { if (typeof window !== 'undefined' && typeof window.__onCloudReadFailed === 'function') window.__onCloudReadFailed(e); } catch (_) {}
          return await localBackend.load();
        }
      },

      save(state) {
        if (blockEmptyWrite(state)) return;
        try { localBackend.save(state); } catch (e) { console.warn('[Storage:firebase] local safety-net save failed:', e); }
        if (writeInFlight) { pendingAfterWrite = state; return; }
        _flushWrite(state);
      },

      onRemoteUpdate(callback) {
        remoteUpdateCallback = callback;
        while (_unsubs.length) { try { _unsubs.pop()(); } catch (_) {} }
        const deliver = () => { if (!callback) return; try { callback(assembleLive()); } catch (e) { console.warn('[Storage:firebase] deliver failed:', e); } };
        for (const name of COLLECTIONS) {
          _seeded[name] = false;
          const unsub = colRef(name).onSnapshot(qs => {
            qs.docChanges().forEach(ch => {
              const id = String(ch.doc.id);
              if (ch.type === 'removed') _live[name].delete(id);
              else _live[name].set(id, ch.doc.data());
            });
            const fromLocalWrite = qs.metadata && qs.metadata.hasPendingWrites;
            if (!_seeded[name]) { _seeded[name] = true; return; }
            if (fromLocalWrite) return;
            deliver();
          }, err => console.warn('[Storage:firebase] ' + name + ' listener error:', err));
          _unsubs.push(unsub);
        }
        const metaUnsub = parentRef().onSnapshot(snap => {
          if (snap.exists) { const d = snap.data() || {}; _liveMeta = {}; for (const k of Object.keys(d)) if (!isCollectionKey(k)) _liveMeta[k] = d[k]; }
          const fromLocalWrite = snap.metadata && snap.metadata.hasPendingWrites;
          if (!_metaSeeded) { _metaSeeded = true; return; }
          if (fromLocalWrite) return;
          deliver();
        }, err => console.warn('[Storage:firebase] meta listener error:', err));
        _unsubs.push(metaUnsub);
      },

      // One-time migration: legacy single doc → subcollections. Idempotent.
      async migrateToMultiDoc(onProgress) {
        const report = p => { try { if (typeof onProgress === 'function') onProgress(p); } catch (_) {} };
        const parentSnap = await parentRef().get({ source: 'server' }).catch(() => parentRef().get());
        if (!parentSnap.exists) return { migrated: false, reason: 'no data document found' };
        const data = parentSnap.data() || {};
        const inlineCols = COLLECTIONS.filter(k => Array.isArray(data[k]) && data[k].length);
        if (inlineCols.length === 0) { needsMigrationFlag = false; return { migrated: false, reason: 'already multi-document (nothing inline to migrate)' }; }
        const ops = []; const perCollection = {};
        for (const name of inlineCols) {
          const idx = indexById(data[name], name.slice(0, 3));
          perCollection[name] = idx.size;
          for (const [id, rec] of idx) ops.push({ name, id, data: rec });
        }
        report({ phase: 'writing', totalDocs: ops.length, perCollection });
        let done = 0;
        for (const group of chunk(ops, MAX_BATCH_OPS)) {
          const batch = db.batch();
          for (const op of group) batch.set(colRef(op.name).doc(op.id), op.data, { merge: true });
          await batch.commit();
          done += group.length; report({ phase: 'writing', written: done, totalDocs: ops.length, perCollection });
        }
        const FieldValue = window.firebase.firestore.FieldValue;
        const cleanup = { _multiDoc: true, _migratedAt: Date.now() };
        for (const name of inlineCols) cleanup[name] = FieldValue.delete();
        await parentRef().set(cleanup, { merge: true });
        needsMigrationFlag = false;
        return { migrated: true, collections: inlineCols, totalDocs: ops.length, perCollection };
      },

      async signIn(email, password) {
        try {
          const e = email.includes('@') ? email : (email + '@blackstars.qa');
          const cred = await auth.signInWithEmailAndPassword(e, password);
          lastUser = { email: cred.user.email, uid: cred.user.uid, isAdmin: true };
          return lastUser;
        } catch (e) {
          console.warn('[Storage:firebase] signIn failed:', e.code, e.message);
          throw new Error(e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found' ? 'Invalid email or password' : 'Sign-in failed: ' + (e.message || e.code));
        }
      },
      async signOut() { while (_unsubs.length) { try { _unsubs.pop()(); } catch (_) {} } await auth.signOut().catch(() => {}); lastUser = null; },
      currentUser() { if (lastUser) return lastUser; const u = auth.currentUser; if (u) lastUser = { email: u.email, uid: u.uid, isAdmin: true }; return lastUser; },
      async updatePassword(newPassword) {
        const u = auth.currentUser; if (!u) throw new Error('Not signed in');
        try { await u.updatePassword(newPassword); return true; }
        catch (e) { if (e && e.code === 'auth/requires-recent-login') throw new Error('Please sign out and sign in again, then change your password.'); throw new Error(e.message || 'Could not change password'); }
      },
      async provisionMemberLogin(email, password) {
        let secondary;
        try { secondary = firebase.app('memberProvisioner'); }
        catch (_) { secondary = firebase.initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId }, 'memberProvisioner'); }
        try { await secondary.auth().createUserWithEmailAndPassword(email, password); await secondary.auth().signOut().catch(() => {}); return 'created'; }
        catch (e) { if (e && e.code === 'auth/email-already-in-use') return 'exists'; throw e; }
      },
      async sendPasswordReset(email) { await auth.sendPasswordResetEmail(email); return true; },
    };
  }

  // ─── Public API ──────────────────────────────────────────────────────────────
  window.Storage = {
    init() { activeBackend = buildFirebaseBackend() || localBackend; console.log(`[Storage] Active backend: ${activeBackend.name}`); return activeBackend.name; },
    backendName() { return activeBackend?.name || 'none'; },
    isCloud() { return !!activeBackend?.isCloud; },
    async load() { if (!activeBackend) this.init(); return await activeBackend.load(); },
    save(state) {
      if (!activeBackend) this.init();
      pendingState = state;
      if (activeBackend.isCloud) { clearTimeout(saveTimer); saveTimer = setTimeout(() => { activeBackend.save(pendingState); pendingState = null; }, SAVE_THROTTLE_MS); }
      else activeBackend.save(state);
    },
    saveNow(state) { clearTimeout(saveTimer); activeBackend.save(state); pendingState = null; },
    onRemoteUpdate(cb) { if (!activeBackend) this.init(); activeBackend.onRemoteUpdate(cb); },
    needsMigration() { if (!activeBackend) this.init(); return activeBackend.needsMigration ? activeBackend.needsMigration() : false; },
    async migrateToMultiDoc(onProgress) { if (!activeBackend) this.init(); if (!activeBackend.migrateToMultiDoc) throw new Error('Migration requires cloud sign-in (Firebase).'); return await activeBackend.migrateToMultiDoc(onProgress); },
    async getLock() { if (!activeBackend) this.init(); return activeBackend.getLock ? await activeBackend.getLock() : null; },
    async setLock(lock) { if (!activeBackend) this.init(); return activeBackend.setLock ? await activeBackend.setLock(lock) : true; },
    async clearLock(sessionId) { if (!activeBackend) this.init(); if (activeBackend.clearLock) await activeBackend.clearLock(sessionId); },
    onLockChange(cb) { if (!activeBackend) this.init(); if (activeBackend.onLockChange) activeBackend.onLockChange(cb); },
    async signIn(email, password) { if (!activeBackend) this.init(); return await activeBackend.signIn(email, password); },
    async signOut() { if (!activeBackend) this.init(); await activeBackend.signOut(); },
    currentUser() { if (!activeBackend) this.init(); return activeBackend.currentUser(); },
    async updatePassword(newPassword) { if (!activeBackend) this.init(); if (!activeBackend.updatePassword) throw new Error('Password change isn’t available in offline mode'); return await activeBackend.updatePassword(newPassword); },
    async provisionMemberLogin(email, password) { if (!activeBackend) this.init(); if (!activeBackend.provisionMemberLogin) throw new Error('Creating member logins requires cloud sign-in (Firebase).'); return await activeBackend.provisionMemberLogin(email, password); },
    async sendPasswordReset(email) { if (!activeBackend) this.init(); if (!activeBackend.sendPasswordReset) throw new Error('Password reset requires cloud sign-in (Firebase).'); return await activeBackend.sendPasswordReset(email); },
  };
})();
