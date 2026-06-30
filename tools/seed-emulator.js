// ═══════════════════════════════════════════════════════════════════════════
// SEED THE LOCAL FIREBASE EMULATOR FROM A BACKUP JSON
// ═══════════════════════════════════════════════════════════════════════════
//
// Loads your exported backup (the "Backup all data" JSON, which IS a full export
// of the Firestore database) into the LOCAL emulator so you can test the real
// cloud + multi-user path before touching production.
//
// Prereqs:  the emulator must be running (firebase emulators:start) and
//           firebase-admin installed (npm i firebase-admin).
//
// Usage (from the blackstars-localhost folder):
//   node tools/seed-emulator.js                         # legacy single-doc (test the in-app Migrate button)
//   node tools/seed-emulator.js --multi                 # pre-migrated multi-document
//   node tools/seed-emulator.js "C:\path\to\backup.json"   # use a specific backup file
//
// It also creates a staff login in the Auth emulator:  admin@blackstars.qa / admin123
// (so you can sign in to the app — type "admin" / "admin123").
// ═══════════════════════════════════════════════════════════════════════════

const admin = require('firebase-admin');
const fs = require('fs');

const PROJECT = 'demo-blackstars';            // must match .firebaserc / firebase-config.LOCAL.js
const DATA_PATH = 'clubs/blackstars';
const DEFAULT_BACKUP = 'C:/Users/kshawky/Downloads/blackstars-backup-2026-06-30 (9).json';

// Point the Admin SDK at the running emulators.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

const MULTI = process.argv.includes('--multi');
const backupArg = process.argv.find(a => a.toLowerCase().endsWith('.json'));
const BACKUP = backupArg || DEFAULT_BACKUP;

// The per-record collections (everything else is meta on the parent doc).
const COLLECTIONS = [
  'members', 'coaches', 'invoices', 'expenses', 'salaries', 'sales', 'advices',
  'trials', 'rentals', 'rentalCustomers', 'schedule', 'swimGroups', 'auditLog',
  'membershipTransfers', 'cashCounts', 'families', 'notes', 'products', 'drivers', 'posts',
];

admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();

let _seq = 0;
const genId = p => p.slice(0, 3) + '_' + Date.now().toString(36) + '_' + (_seq++).toString(36);

async function commitInChunks(docs) {
  let batch = db.batch(), n = 0, total = 0;
  for (const { ref, data } of docs) {
    batch.set(ref, data, { merge: true });
    if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
    total++;
  }
  if (n % 400 !== 0) await batch.commit();
  return total;
}

(async () => {
  if (!fs.existsSync(BACKUP)) { console.error('Backup file not found:', BACKUP); process.exit(1); }
  const data = JSON.parse(fs.readFileSync(BACKUP, 'utf8'));
  delete data.user; delete data.route; delete data.session;   // device-local only
  console.log('Loaded backup:', BACKUP);
  console.log('  members:', (data.members || []).length, ' invoices:', (data.invoices || []).length,
              ' auditLog:', (data.auditLog || []).length);

  // 1) Staff login so the app can sign in (and writes pass the security rules).
  try {
    await admin.auth().createUser({ email: 'admin@blackstars.qa', password: 'admin123' });
    console.log('✓ Created Auth user  admin@blackstars.qa / admin123');
  } catch (e) {
    if (e.code === 'auth/email-already-exists') console.log('• Auth user admin@blackstars.qa already exists');
    else throw e;
  }

  if (!MULTI) {
    // 2a) LEGACY single document — so you can exercise the in-app "Migrate" button.
    await db.doc(DATA_PATH).set({ ...data, __schema: data.__schema || data.schemaVersion || 9, _seededAt: Date.now() });
    console.log(`✓ Seeded LEGACY single document at ${DATA_PATH}`);
    console.log('  → In the app: Settings → Data & Backup → Migrate to multi-document, then test multi-user.');
  } else {
    // 2b) Pre-migrated MULTI-document layout.
    let total = 0;
    for (const name of COLLECTIONS) {
      const arr = Array.isArray(data[name]) ? data[name] : [];
      const docs = arr.filter(Boolean).map(rec => {
        if (rec.id == null || rec.id === '') rec.id = genId(name);
        return { ref: db.collection(`${DATA_PATH}/${name}`).doc(String(rec.id)), data: rec };
      });
      const n = await commitInChunks(docs);
      if (n) console.log(`  ${name}: ${n}`);
      total += n;
    }
    const meta = {};
    for (const k of Object.keys(data)) if (!COLLECTIONS.includes(k)) meta[k] = data[k];
    meta._multiDoc = true; meta._migratedAt = Date.now();
    await db.doc(DATA_PATH).set(meta, { merge: true });
    console.log(`✓ Seeded MULTI-document: ${total} record documents + meta`);
  }

  // 3) Read back a couple of counts as proof.
  const ms = await db.collection(`${DATA_PATH}/members`).get();
  const parent = await db.doc(DATA_PATH).get();
  console.log(`Verify → members subcollection docs: ${ms.size}; parent has inline members array: ${Array.isArray((parent.data() || {}).members)}`);
  console.log('Done. Open the app (with firebase-config.LOCAL.js in place) and sign in as admin / admin123.');
  process.exit(0);
})().catch(e => { console.error('Seed failed:', e); process.exit(1); });
