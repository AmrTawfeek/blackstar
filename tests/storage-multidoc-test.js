// Multi-document storage harness (v6.211.0 multi-user build).
// Runs the REAL storage.js against an in-memory mock of the Firebase compat SDK
// that faithfully reproduces Firestore's set(merge:true) DEEP-merge semantics, and
// asserts migration + diff-save + the all-important CONCURRENT ATTENDANCE case
// (two coaches marking different members — and the same member's different cells —
// at the same time, with zero data loss / corruption).
const vm = require('vm');
const fs = require('fs');
const path = require('path');

// ─── In-memory Firestore mock with DEEP merge (matches real merge:true) ─────
function makeFirestore() {
  const store = new Map();   // fullPath -> docData
  const listeners = [];
  const segs = p => p.split('/').filter(Boolean);
  const clone = o => JSON.parse(JSON.stringify(o));
  const isPlainObj = v => v && typeof v === 'object' && !Array.isArray(v);

  // Firestore set(merge:true): nested maps merge recursively; arrays/primitives
  // replace; a FieldValue.delete() sentinel removes the key.
  function deepMerge(target, data) {
    const out = isPlainObj(target) ? clone(target) : {};
    for (const k of Object.keys(data)) {
      const v = data[k];
      if (v && v.__fv === 'delete') { delete out[k]; continue; }
      if (isPlainObj(v) && isPlainObj(out[k])) out[k] = deepMerge(out[k], v);
      else out[k] = clone(v);
    }
    return out;
  }
  function notify(p) {
    for (const l of listeners) {
      if (l.kind === 'doc' && l.path === p) l.fire();
      if (l.kind === 'col' && p.startsWith(l.path + '/') && segs(p).length === segs(l.path).length + 1) l.fire();
    }
  }
  function docRef(p) {
    return {
      _path: p,
      async get() { return { exists: store.has(p), id: segs(p).slice(-1)[0], data: () => store.has(p) ? clone(store.get(p)) : undefined, metadata: { hasPendingWrites: false } }; },
      async set(data, opts) { store.set(p, (opts && opts.merge) ? deepMerge(store.get(p), data) : clone(data)); notify(p); },
      async delete() { store.delete(p); notify(p); },
      onSnapshot(cb) { const l = { kind: 'doc', path: p, fire: () => cb({ exists: store.has(p), id: segs(p).slice(-1)[0], data: () => store.has(p) ? clone(store.get(p)) : undefined, metadata: { hasPendingWrites: false } }) }; listeners.push(l); l.fire(); return () => {}; },
    };
  }
  function colRef(p) {
    const under = () => [...store.keys()].filter(k => k.startsWith(p + '/') && segs(k).length === segs(p).length + 1);
    return {
      _path: p,
      doc(id) { return docRef(p + '/' + id); },
      async get() { const keys = under(); return { size: keys.length, forEach(fn) { for (const k of keys) fn({ id: segs(k).slice(-1)[0], data: () => clone(store.get(k)) }); } }; },
      onSnapshot(cb) {
        const snap = () => { const keys = under(); return { size: keys.length, metadata: { hasPendingWrites: false }, forEach(fn) { for (const k of keys) fn({ id: segs(k).slice(-1)[0], data: () => clone(store.get(k)) }); }, docChanges() { return keys.map(k => ({ type: 'added', doc: { id: segs(k).slice(-1)[0], data: () => clone(store.get(k)) } })); } }; };
        const l = { kind: 'col', path: p, fire: () => cb(snap()) }; listeners.push(l); l.fire(); return () => {};
      },
    };
  }
  function batch() { const ops = []; return { set(r, d, o) { ops.push(() => r.set(d, o)); return this; }, delete(r) { ops.push(() => r.delete()); return this; }, async commit() { for (const op of ops) await op(); } }; }
  return { db: { doc: p => docRef(p), collection: p => colRef(p), batch, enablePersistence() { return Promise.resolve(); } }, store };
}

const { db, store } = makeFirestore();
const firebase = {
  initializeApp: () => ({}),
  firestore: Object.assign(() => db, { FieldValue: { delete: () => ({ __fv: 'delete' }) } }),
  auth: () => ({ currentUser: null, signInWithEmailAndPassword: async () => ({ user: { email: 'a@b.c', uid: 'u1' } }), signOut: async () => {} }),
};
const lsMem = {};
const localStorage = { getItem: k => (k in lsMem ? lsMem[k] : null), setItem: (k, v) => { lsMem[k] = String(v); }, removeItem: k => { delete lsMem[k]; } };
const win = {};
const sandbox = { window: win, firebase, localStorage, console, setTimeout, clearTimeout, JSON, Math, Date, Promise, Array, Object, String, Map };
win.firebase = firebase; win.localStorage = localStorage;
win.FIREBASE_CONFIG = { apiKey: 'fake', projectId: 'p', dataPath: 'clubs/blackstars' };

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'storage.js'), 'utf8'), sandbox);
const Storage = win.Storage;

let pass = 0, fail = 0;
const ok = (c, label) => { if (c) pass++; else { fail++; console.log('  ✗ ' + label); } };
const tick = () => new Promise(r => setTimeout(r, 20));

(async function run() {
  // Seed a legacy single document from the real backup, and make members[0] carry
  // a known attendance map so the concurrency assertions are deterministic.
  const backup = JSON.parse(fs.readFileSync('C:/Users/kshawky/Downloads/blackstars-backup-2026-06-30 (9).json', 'utf8'));
  const M0 = backup.members[0], M1 = backup.members[1];
  M0.dailyAttendance = { '2026-06': { swimming: { '5': 'Y' } } };
  store.set('clubs/blackstars', JSON.parse(JSON.stringify(backup)));

  Storage.init();
  ok(Storage.backendName() === 'firebase', 'backend resolves to firebase');

  const l1 = await Storage.load();
  ok(l1 && l1.members.length === backup.members.length, 'legacy load returns all members inline');
  ok(Storage.needsMigration() === true, 'needsMigration() true on legacy single-doc');

  const res = await Storage.migrateToMultiDoc();
  ok(res.migrated === true && res.totalDocs > 500, 'migrate fans out (' + res.totalDocs + ' docs)');
  ok([...store.keys()].filter(k => k.startsWith('clubs/blackstars/members/')).length === backup.members.length, 'one document per member');
  ok(!Array.isArray(store.get('clubs/blackstars').members), 'inline members stripped from parent');
  ok(Storage.needsMigration() === false, 'needsMigration() false after migration');

  const live = await Storage.load();
  ok(live.members.length === backup.members.length, 'multi-doc load reassembles members');
  ok(live.settings && live.settings.commissionBasis != null, 'settings reassembled from meta');

  // ── CONCURRENCY 1: two coaches, DIFFERENT members, at the same time ──────────
  const a0 = live.members.find(m => m.id === M0.id);
  const a1 = live.members.find(m => m.id === M1.id);
  a0.dailyAttendance['2026-06'].swimming['6'] = 'Y';   // coach A marks member 0
  a1.phone = '50000001';                                // reception edits member 1
  Storage.saveNow(live); await tick();
  ok(store.get('clubs/blackstars/members/' + M0.id).dailyAttendance['2026-06'].swimming['6'] === 'Y', 'member 0 attendance written');
  ok(store.get('clubs/blackstars/members/' + M1.id).phone === '50000001', 'member 1 edit written (different doc, no clash)');

  // ── CONCURRENCY 2: two coaches, SAME member, DIFFERENT sport/day cells ───────
  // Simulate coach B (another device) adding a boxing mark directly to the cloud.
  await db.doc('clubs/blackstars/members/' + M0.id).set(
    { dailyAttendance: { '2026-06': { boxing: { '6': 'Y' } } } }, { merge: true });
  // Coach A's in-memory copy never saw boxing; A now adds a new swimming day and saves.
  a0.dailyAttendance['2026-06'].swimming['7'] = 'Y';
  Storage.saveNow(live); await tick();
  const att = store.get('clubs/blackstars/members/' + M0.id).dailyAttendance['2026-06'];
  ok(att.swimming['5'] === 'Y' && att.swimming['6'] === 'Y' && att.swimming['7'] === 'Y', 'all of coach A swimming marks preserved');
  ok(att.boxing && att.boxing['6'] === 'Y', "coach B's boxing mark on the SAME member NOT clobbered (deep-merge)");

  // ── CONCURRENCY 3: field-level merge on a non-attendance field ───────────────
  await db.doc('clubs/blackstars/members/' + M0.id).set({ qid: '28800000000' }, { merge: true });  // remote sets QID
  a0.email = 'changed@example.com';                                                                 // local edits email
  Storage.saveNow(live); await tick();
  const md = store.get('clubs/blackstars/members/' + M0.id);
  ok(md.email === 'changed@example.com' && md.qid === '28800000000', 'concurrent edits to different fields both survive');

  // ── Delete a record ─────────────────────────────────────────────────────────
  const delId = live.invoices[0].id;
  live.invoices = live.invoices.filter(x => x.id !== delId);
  Storage.saveNow(live); await tick();
  ok(!store.has('clubs/blackstars/invoices/' + delId), 'removed invoice document is deleted');

  // ── Empty-write guard still protects the database ───────────────────────────
  win.__allowEmptySave = false;
  Storage.saveNow({ members: [], invoices: [] }); await tick();
  ok(store.has('clubs/blackstars/members/' + M0.id), 'empty-write guard prevents mass deletion');

  console.log('\n========= MULTI-DOC + ATTENDANCE-CONCURRENCY RESULTS =========');
  console.log('PASS: ' + pass + '   FAIL: ' + fail);
  console.log('==============================================================');
  process.exit(fail ? 1 : 0);
})();
