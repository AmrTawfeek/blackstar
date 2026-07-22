// v6.393 — "permission-denied / your session expired" popping up FREQUENTLY while adding data.
//
// The session was fine. The security rules make auditLog IMMUTABLE:
//     match /auditLog/{docId} { allow create: if isStaff(); allow update, delete: if false; }
// but every op was written as set(…, {merge:true}), and a merge-set on a document that ALREADY
// EXISTS is an UPDATE in rules terms. A colleague's audit row reaches this device through the
// snapshot listener and lands in `state` but NOT in our `_base`, so the very next save re-sends
// it — as an update — and Firestore denies it. A Firestore batch is ATOMIC, so that single
// denied row failed the WHOLE write and took the member being added down with it.
//
// Fixes: (a) auditLog is append-only — never re-send a row the server already holds;
//        (b) audit ops commit in their OWN batch, so an audit failure can never fail a member.
const fs = require('fs'), path = require('path');
const DIR = [path.join(__dirname, 'crm238', 'blackstars-localhost'), path.join(__dirname, '..')].find(p => { try { return fs.existsSync(path.join(p, 'app.js')); } catch (_) { return false; } });
const storageSrc = fs.readFileSync(path.join(DIR, 'storage.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(DIR, 'app.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗ FAIL:', n, got !== undefined ? '→ ' + JSON.stringify(got) : ''); } };

// ── Model the delta rule exactly as shipped, to show the poisoned op is no longer produced.
function buildOps(src, { baseHas, serverKnows }) {
  // mirrors: if (name === 'auditLog') { if (prevStr !== undefined || _auditKnown.has(id)) continue; push create }
  const guarded = /if \(name === 'auditLog'\) \{\s*\n\s*if \(prevStr !== undefined \|\| _auditKnown\.has\(id\)\) continue;/.test(src);
  const ops = [];
  // a normal business record always goes
  ops.push({ name: 'members', id: '270', kind: 'set' });
  // the colleague's audit row: in local state, NOT in our base, but present on the server
  if (!guarded) ops.push({ name: 'auditLog', id: 'a1', kind: 'set', merge: true });      // old: UPDATE → denied
  else if (!(baseHas || serverKnows)) ops.push({ name: 'auditLog', id: 'a1', kind: 'set', _audit: true });
  return ops;
}

console.log('the poisoned write is no longer produced:');
{
  // exactly the production situation: not in our base, but the server has it
  const ops = buildOps(storageSrc, { baseHas: false, serverKnows: true });
  ok('no auditLog op is emitted for a row the server already holds', !ops.some(o => o.name === 'auditLog'), ops);
  ok('the member write still goes out', ops.some(o => o.name === 'members'), ops);

  const old = buildOps(storageSrc.replace(/if \(name === 'auditLog'\) \{/, 'if (false) {'), { baseHas: false, serverKnows: true });
  ok('control: the OLD rule DID emit it (this is what got denied)', old.some(o => o.name === 'auditLog'), old);
}

console.log('\na genuinely NEW local audit row is still recorded:');
{
  const ops = buildOps(storageSrc, { baseHas: false, serverKnows: false });
  ok('it is emitted', ops.some(o => o.name === 'auditLog'), ops);
  ok('...flagged so it commits in the isolated audit batch', ops.find(o => o.name === 'auditLog')._audit === true, ops);
}

console.log('\nan audit row already in our base is never updated:');
{
  const ops = buildOps(storageSrc, { baseHas: true, serverKnows: false });
  ok('no update op is produced', !ops.some(o => o.name === 'auditLog'), ops);
}

console.log('\nsource wiring — append-only + isolated + non-fatal:');
{
  ok('auditLog is excluded from the normal delta path',
    /if \(name === 'auditLog'\) \{[\s\S]{0,220}?_auditKnown\.has\(id\)\) continue;/.test(storageSrc));
  ok('audit ops commit in their OWN batch, separate from business data',
    /const bizOps = group\.filter\(op => !op\._audit\);[\s\S]{0,200}?const auditOps = group\.filter\(op => op\._audit\);/.test(storageSrc));
  ok('audit writes use set WITHOUT merge (a CREATE, so the immutability rule is never tripped)',
    /for \(const op of auditOps\) ab\.set\(colRef\(op\.name\)\.doc\(op\.id\), op\.data\);/.test(storageSrc));
  ok('an audit failure is caught and does NOT fail the save',
    /audit entry not written \(non-fatal\)/.test(storageSrc));
  ok('rows arriving from the live snapshot are marked server-held',
    /if \(name === 'auditLog'\) _auditKnown\.add\(id\);/.test(storageSrc));
  ok('rows from the initial load are marked server-held',
    /noteAuditFromServer\(result\.auditLog\)/.test(storageSrc));
}

console.log('\nthe message no longer blames the session when the session is fine:');
{
  ok('a signed-in user + permission-denied reads as "the server refused"',
    /_serverRefused = _isAuthReason && _stillSignedIn/.test(appSrc));
  ok('...and it stops telling them to sign in again (which cannot help)',
    /signing in again will not help/.test(appSrc));
  ok('only a REAL lapse is called a session expiry', /_sessionLapsed = _isAuthReason && !_stillSignedIn/.test(appSrc));
  ok('a real lapse offers in-place sign-in instead of a reload',
    /_sessionLapsed && typeof window\.showSessionResumePrompt === 'function'/.test(appSrc));
}

console.log('\nthe sign-in card is NEVER shown for a problem signing in cannot fix:');
{
  // v6.394 — the reported screenshot: permission-denied from a RULES rejection, retries failing
  // forever, and the app repeatedly asking a still-signed-in user to sign in again.
  ok('the resume prompt checks for a still-signed-in user before asking',
    /const _who = \(\(\) => \{ try \{ return window\.Storage\.currentUser && window\.Storage\.currentUser\(\); \}[\s\S]{0,120}?if \(_who\) \{ showServerRefusedBar\(\); return; \}/.test(appSrc));
  ok('a still-signed-in user gets the "server refused" bar instead of a sign-in card',
    /function showServerRefusedBar\(\)/.test(appSrc) && /The server refused this change', 'رفض الخادم هذا التغيير'/.test(appSrc));
  ok('...which states plainly that signing in again will not help',
    /signing in again will not help[\s\S]{0,200}?keeps retrying/.test(appSrc));
  ok('...and still offers a manual retry', /showServerRefusedBar[\s\S]{0,1600}?cloud-retry-now/.test(appSrc));
  ok('the sign-in card is only reached when NO user remains',
    /genuinely signed out — ask, in place[\s\S]{0,120}?_sessionPromptOpen = true;/.test(appSrc));
}

console.log('\nevery confirmSaved operation shows a pending state and the real result:');
{
  ok('a saving indicator is shown while waiting', /_showSaving\(\);\s*\/\/ v6\.393/.test(appSrc));
  ok('...cleared on success', /_hideSaving\(\);\s*\n\s*if \(r && r\.ok\)/.test(appSrc));
  ok('...and cleared on failure', /\.catch\(e => \{ _hideSaving\(\);/.test(appSrc));
  ok('it is announced to screen readers', /aria-live', 'polite'/.test(appSrc));
  ok('it respects reduced-motion', /prefers-reduced-motion:reduce/.test(appSrc));
  ok('nested saves do not leave it stuck (depth counted)', /_savingDepth = Math\.max\(0, _savingDepth - 1\)/.test(appSrc));
}

console.log('\nAUDIT BATCH POISON:', pass, 'passed,', fail, 'failed');
process.exit(fail ? 1 : 0);
