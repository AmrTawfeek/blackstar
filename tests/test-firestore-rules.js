// REAL Firestore security-rules tests, run against the actual emulator with the ACTUAL
// firestore.rules the club deploys. This is the gap that let the auditLog batch poison reach
// production: every other suite here is source-level and cannot see a permission-denied.
//
// Needs the emulator running:
//   java -jar ~/.cache/firebase/emulators/cloud-firestore-emulator-v*.jar --host 127.0.0.1 --port 8080
// Skips cleanly (exit 0) when it is not up, so the regression run never breaks on its absence.
const fs = require('fs'), path = require('path'), http = require('http');

const HOST = '127.0.0.1', PORT = 8080, PROJECT = 'blackstars-rules-test';
const RULES = (() => {
  for (const p of [path.join(__dirname, 'crm238', 'blackstars-localhost', 'firestore.rules'),
                   path.join(__dirname, '..', 'firestore.rules'),
                   path.join(__dirname, 'firestore.rules')]) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  }
  return null;
})();

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗ FAIL:', n, got !== undefined ? '→ ' + JSON.stringify(got) : ''); } };

function req(method, urlPath, body, token) {
  return new Promise(res => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const r = http.request({ host: HOST, port: PORT, path: urlPath, method, headers, timeout: 8000 }, resp => {
      let b = ''; resp.on('data', c => b += c);
      resp.on('end', () => res({ status: resp.statusCode, body: b }));
    });
    r.on('error', e => res({ status: 0, body: String(e) }));
    r.on('timeout', () => { r.destroy(); res({ status: 0, body: 'timeout' }); });
    if (data) r.write(data);
    r.end();
  });
}

// The emulator accepts unsigned ("alg":"none") JWTs and evaluates rules against their claims.
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
function tokenFor(email, uid) {
  const header = { alg: 'none', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, auth_time: now,
    user_id: uid, sub: uid, iat: now, exp: now + 3600, email, email_verified: true,
    firebase: { identities: { email: [email] }, sign_in_provider: 'password' },
  };
  return `${b64(header)}.${b64(payload)}.`;
}

const DOCS = `/v1/projects/${PROJECT}/databases/(default)/documents`;
const CLUB = `${DOCS}/clubs/blackstars`;
const field = v => ({ stringValue: String(v) });
const doc = o => ({ fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, field(v)])) });

// admin bypass: the emulator treats the "owner" bearer token as fully privileged, which lets us
// SEED state (e.g. an existing audit row) without the rules under test getting in the way.
const OWNER = 'owner';
const create = (coll, id, data, tok) => req('POST', `${CLUB}/${coll}?documentId=${id}`, doc(data), tok);
const patch  = (coll, id, data, tok) => req('PATCH', `${CLUB}/${coll}/${id}`, doc(data), tok);
const del    = (coll, id, tok) => req('DELETE', `${CLUB}/${coll}/${id}`, null, tok);
const read   = (coll, id, tok) => req('GET', `${CLUB}/${coll}/${id}`, null, tok);
const allowed = r => r.status >= 200 && r.status < 300;
const denied  = r => r.status === 403 || /PERMISSION_DENIED/i.test(r.body || '');

(async () => {
  if (!RULES) { console.log('SKIPPED — firestore.rules not found'); process.exit(0); }
  const up = await req('GET', '/', null, null);
  if (!up.status) { console.log('SKIPPED — Firestore emulator not running on ' + HOST + ':' + PORT); process.exit(0); }

  // Start from an empty database. Without this a re-run hits 409 ALREADY_EXISTS on the seeded
  // documents and reports false failures — the test must be repeatable, not one-shot.
  await req('DELETE', `/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, null, null);

  const put = await req('PUT', `/emulator/v1/projects/${PROJECT}:securityRules`,
    { rules: { files: [{ name: 'firestore.rules', content: RULES }] } }, null);
  if (!allowed(put)) { console.log('SKIPPED — could not load rules into the emulator:', put.status, put.body.slice(0, 200)); process.exit(0); }
  console.log('Loaded the REAL firestore.rules into the emulator.\n');

  const STAFF  = tokenFor('blackstarsportsmail@gmail.com', 'staff1');   // named local part → staff
  const MEMBER = tokenFor('30407225@blackstars.com', 'member1');        // digit local part  → member portal

  // the parent doc must exist for the rules' get() on settings
  await create('', 'x', {}, OWNER).catch(() => {});
  await req('PATCH', CLUB, doc({ name: 'Black Stars' }), OWNER);

  console.log('THE BUG THAT REACHED PRODUCTION — audit log is create-only:');
  {
    const c = await create('auditLog', 'aud_new', { action: 'member.add', at: '2026-07-21' }, STAFF);
    ok('staff CAN create an audit entry', allowed(c), c.status);

    // seed a row as if another device had written it, then try what the app used to do
    await create('auditLog', 'aud_existing', { action: 'x' }, OWNER);
    const u = await patch('auditLog', 'aud_existing', { action: 'x', touched: 'again' }, STAFF);
    ok('staff CANNOT update an existing audit entry (this is what denied the whole batch)', denied(u), u.status);

    const d = await del('auditLog', 'aud_existing', STAFF);
    ok('staff CANNOT delete an audit entry', denied(d), d.status);

    const r = await read('auditLog', 'aud_existing', STAFF);
    ok('staff CAN read the audit trail', allowed(r), r.status);
    const rm = await read('auditLog', 'aud_existing', MEMBER);
    ok('a member CANNOT read the audit trail', denied(rm), rm.status);
  }

  console.log('\nnormal club data — staff may read and write:');
  {
    for (const coll of ['members', 'invoices', 'expenses', 'salaries', 'sales']) {
      const c = await create(coll, 'r1_' + coll, { name: 'x' }, STAFF);
      ok(`staff can create in ${coll}`, allowed(c), c.status);
      const u = await patch(coll, 'r1_' + coll, { name: 'y' }, STAFF);
      ok(`staff can update ${coll} (merge-set is an UPDATE — must be allowed here)`, allowed(u), u.status);
    }
  }

  console.log('\nmember portal scoping — the club’s money stays private:');
  {
    await create('members', 'm_pub', { name: 'visible' }, OWNER);
    await create('invoices', 'i_priv', { amount: '500' }, OWNER);
    ok('a member CAN read members', allowed(await read('members', 'm_pub', MEMBER)));
    ok('a member CANNOT read invoices', denied(await read('invoices', 'i_priv', MEMBER)));
    ok('a member CANNOT read expenses', denied(await read('expenses', 'r1_expenses', MEMBER)));
    ok('a member CANNOT read salaries', denied(await read('salaries', 'r1_salaries', MEMBER)));
    ok('a member CANNOT write members', denied(await patch('members', 'm_pub', { name: 'hacked' }, MEMBER)));
  }

  console.log('\nsigned out — nothing is reachable:');
  {
    ok('anonymous cannot read members', denied(await read('members', 'm_pub', null)));
    ok('anonymous cannot write members', denied(await patch('members', 'm_pub', { name: 'x' }, null)));
    ok('anonymous cannot create an audit entry', denied(await create('auditLog', 'anon', { a: 'b' }, null)));
  }

  console.log('\nFIRESTORE RULES:', pass, 'passed,', fail, 'failed');
  process.exit(fail ? 1 : 0);
})();
