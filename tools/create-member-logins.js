/**
 * create-member-logins.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ONE-TIME (re-runnable) script that creates a Firebase Authentication login for
 * every member, so members can sign in with their MOBILE NUMBER.
 *
 *   • login email   = <digits>@members.blackstars.qa   (hidden; built from the mobile)
 *   • password      = the member's mobile number (digits) — they must change it on
 *                     first login (the app forces this).
 *
 * It reads your members straight from Firestore (clubs/blackstars), so it always
 * matches your live data. Re-running it is safe: existing accounts are skipped.
 *
 * ─── HOW TO RUN (once, on your own computer) ─────────────────────────────────
 * 1. Firebase Console → Project settings → Service accounts → "Generate new
 *    private key". Save the file next to this script as `service-account.json`.
 * 2. Install the SDK:   npm install firebase-admin
 * 3. Run:               node create-member-logins.js
 *
 * Passwords must be >= 6 chars (Firebase rule). Mobiles shorter than 6 digits are
 * skipped and listed at the end so you can handle them manually.
 *
 * SECURITY: keep service-account.json private (never commit/deploy it). Delete it
 * when you're done if you like — you can always regenerate it.
 */

const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

const MEMBER_EMAIL_DOMAIN = 'members.blackstars.qa';   // must match the app
const DATA_PATH = 'clubs/blackstars';                  // must match storage.js cfg.dataPath

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const auth = admin.auth();

const digitsOf = s => String(s || '').replace(/\D/g, '');

(async () => {
  const snap = await db.doc(DATA_PATH).get();
  if (!snap.exists) { console.error('No document at ' + DATA_PATH); process.exit(1); }
  const members = (snap.data().members || []).filter(m => m && !m.deleted);
  console.log(`Found ${members.length} active members.`);

  let created = 0, skipped = 0; const problems = [];
  for (const m of members) {
    const digits = digitsOf(m.phone) || digitsOf(m.phone2);
    if (digits.length < 6) { problems.push(`${m.name || m.id}: mobile too short / missing ("${m.phone || ''}")`); continue; }
    const email = `${digits}@${MEMBER_EMAIL_DOMAIN}`;
    try {
      await auth.getUserByEmail(email);
      skipped++;                       // already exists
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        try {
          await auth.createUser({ email, password: digits, displayName: m.name || ('Member ' + m.id) });
          created++;
          console.log(`  ✓ ${m.name || m.id} → ${email}`);
        } catch (ce) { problems.push(`${m.name || m.id} (${email}): ${ce.message}`); }
      } else {
        problems.push(`${m.name || m.id} (${email}): ${e.message}`);
      }
    }
  }
  console.log(`\nDone. Created ${created}, skipped ${skipped} (already existed).`);
  if (problems.length) { console.log(`\n${problems.length} need attention:`); problems.forEach(p => console.log('  - ' + p)); }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
