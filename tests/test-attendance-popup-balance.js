// v6.399 — the popup after marking Y/N showed an inaccurate "Sessions remaining".
//
// It computed remaining = planned − attended, but counted `attended` over the RAW sub.start/end
// window, while every OTHER screen (the member card, subscription history, ready-to-renew) counts
// it over subAttendanceWindow(). The two differ exactly when:
//   • a member trained BEFORE the package start date — the first package of a sport has no earlier
//     period to claim those marks, so they belong to it (v6.386); the raw window drops them, so
//     `attended` was too low and "remaining" too HIGH.
//   • a renewal starts after a gap — the corrected window carries the gap class to the new package.
// So the popup disagreed with the member card for the same member. This test drives the REAL
// _sessionsLeftFromDoc logic against both windows and shows the corrected one matches the card.
const vm = require('vm'), fs = require('fs'), path = require('path');
const DIR = [path.join(__dirname, 'crm238', 'blackstars-localhost'), path.join(__dirname, '..')].find(p => { try { return fs.existsSync(path.join(p, 'app.js')); } catch (_) { return false; } });
const appSrc = fs.readFileSync(path.join(DIR, 'app.js'), 'utf8');
const pagesSrc = fs.readFileSync(path.join(DIR, 'pages.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗ FAIL:', n, got !== undefined ? '→ ' + JSON.stringify(got) : ''); } };

function makeCtx() {
  const c = { console: { log() {}, warn() {}, error() {} }, JSON, Math, Date, String, Number, Array, Object, Set, Map, isNaN, isFinite, parseInt, parseFloat, RegExp };
  c.window = c; c.globalThis = c;
  c.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  c.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  c.location = { hash: '' }; c.navigator = { userAgent: 'n' }; c.addEventListener = () => {};
  vm.createContext(c); try { vm.runInContext(appSrc, c); } catch (_) {}
  return c;
}
const C = makeCtx();

// the SHIPPED popup logic, re-expressed against the app's real helpers so we exercise the same
// window + count functions the popup uses.
function sessionsLeft(doc, sport, dateISO, useWindow) {
  return vm.runInContext(`(function(){
    const doc = ${JSON.stringify(doc)};
    const sub = subForAttendanceDate(doc, ${JSON.stringify(sport)}, ${JSON.stringify(dateISO)});
    const planned = sub ? (parseInt(sub.totalClasses) || 0) : 0;
    if (!sub || planned <= 0) return null;
    const win = ${useWindow} ? subAttendanceWindow(doc, sub) : { from: sub.start || null, to: sub.end || null };
    const live = liveAttendanceCount(doc, ${JSON.stringify(sport)}, win.from, win.to);
    const attended = live.y || 0;
    return { attended, planned, left: Math.max(0, planned - attended) };
  })()`, C);
}
// the member card counts attendance for a sub the SAME way — over subAttendanceWindow.
function cardAttended(doc, sub, sport) {
  return vm.runInContext(`(function(){
    const doc = ${JSON.stringify(doc)}; const sub = ${JSON.stringify(sub)};
    const win = subAttendanceWindow(doc, sub);
    return liveAttendanceCount(doc, ${JSON.stringify(sport)}, win.from, win.to).y || 0;
  })()`, C);
}

console.log('the reported bug — a member who trained BEFORE the package start:');
{
  // Kick Boxing package starts 19 Jul (12 classes); the member trained on 15 & 18 Jul too.
  const jaber = {
    id: 1, name: 'Jaber', sport: 'Summer Camp',
    subscriptions: [
      { _sid: 'sc', activity: 'Summer Camp', totalClasses: 12, start: '2026-06-29', end: '2026-07-28' },
      { _sid: 'kb', activity: 'Kick Boxing', totalClasses: 12, start: '2026-07-19', end: '2026-08-18' },
    ],
    dailyAttendance: { '2026-07': { 'Kick Boxing': { '15': 'Y', '18': 'Y', '20': 'Y' } } },
  };
  const raw = sessionsLeft(jaber, 'Kick Boxing', '2026-07-20', false);
  const fixed = sessionsLeft(jaber, 'Kick Boxing', '2026-07-20', true);
  const card = cardAttended(jaber, jaber.subscriptions[1], 'Kick Boxing');
  ok('the corrected count includes the pre-start classes (3 attended)', fixed.attended === 3, fixed);
  ok('...so remaining is 9, not 10', fixed.left === 9, fixed);
  ok('the member card agrees with the corrected popup', card === fixed.attended, { card, popup: fixed.attended });
  ok('control: the OLD raw window under-counted (only 1 attended, 11 left)', raw.attended === 1 && raw.left === 11, raw);
  ok('...and DISAGREED with the member card — the reported inaccuracy', raw.attended !== card, { raw: raw.attended, card });
}

console.log('\na normal single-package member is completely unaffected:');
{
  const normal = {
    id: 2, name: 'Sara',
    subscriptions: [{ _sid: 's1', activity: 'Swimming', totalClasses: 8, start: '2026-07-01', end: '2026-08-01' }],
    dailyAttendance: { '2026-07': { 'Swimming': { '03': 'Y', '10': 'Y' } } },
  };
  const raw = sessionsLeft(normal, 'Swimming', '2026-07-10', false);
  const fixed = sessionsLeft(normal, 'Swimming', '2026-07-10', true);
  ok('raw and corrected give the same answer (2 attended, 6 left)', raw.left === 6 && fixed.left === 6, { raw, fixed });
  ok('so nothing changes for the common case', JSON.stringify(raw) === JSON.stringify(fixed));
}

console.log('\na renewal after a gap counts the gap class toward the NEW package:');
{
  const renewer = {
    id: 3, name: 'Renewer',
    subscriptions: [
      { _sid: 'a', activity: 'Kick Boxing', totalClasses: 8, start: '2026-07-06', end: '2026-07-20' },
      { _sid: 'b', activity: 'Kick Boxing', totalClasses: 8, start: '2026-07-25', end: '2026-08-25' },
    ],
    dailyAttendance: { '2026-07': { 'Kick Boxing': { '22': 'Y', '28': 'Y' } } },   // 22 is in the gap
  };
  const fixed = sessionsLeft(renewer, 'Kick Boxing', '2026-07-28', true);
  const card = cardAttended(renewer, renewer.subscriptions[1], 'Kick Boxing');
  ok('the new package counts the gap class + its own (2 attended)', fixed.attended === 2, fixed);
  ok('...matching the member card', card === fixed.attended, { card, popup: fixed.attended });
}

console.log('\nsource wiring — the popup + its over-cap guard use the corrected window:');
{
  const _sldSeg = pagesSrc.slice(pagesSrc.indexOf('function _sessionsLeftFromDoc'), pagesSrc.indexOf('function _sessionsLeftFromDoc') + 1400);
  ok('_sessionsLeftFromDoc uses subAttendanceWindow', /subAttendanceWindow\(doc, sub\)/.test(_sldSeg) && /liveAttendanceCount\(doc, sport, win\.from, win\.to\)/.test(_sldSeg));
  ok('the "already attended all classes" guard uses it too', /subAttendanceWindow\(m, sub\)[\s\S]{0,120}?liveAttendanceCount\(m, sport, _win\.from, _win\.to\)/.test(pagesSrc));
  ok('no raw sub.start/end liveAttendanceCount remains in the mark handler',
    !/liveAttendanceCount\(m, sport, sub\.start \|\| null, sub\.end \|\| null\)/.test(pagesSrc.slice(pagesSrc.indexOf('function _sessionsLeftFromDoc') - 3000, pagesSrc.indexOf('function _sessionsLeftFromDoc'))));
}

console.log('\nATTENDANCE POPUP BALANCE:', pass, 'passed,', fail, 'failed');
process.exit(fail ? 1 : 0);
