// v6.409 — SCHEDULE: (1) editable custom class names (Kids Kick-Boxing, Adult Boxing…), and
// (2) a daily portrait "poster" export to share as a WhatsApp status. The canvas poster is
// verified live in the browser (produces a real PNG); here we lock the wiring + the label logic.
const H = require('./qc-harness.js');
const R = H.reporter('SCHEDULE · custom class names + daily poster');
const src = H.readSrc();

R.section('custom class NAMES');
{
  R.ok('the tile shows a custom label when set, else the sport', /escapeHtml\(c\.label \|\| c\.sport\)/.test(src));
  R.ok('the Edit-Class modal has a class-name input', /id="sch-label"/.test(src) && /Class name \(optional\)/.test(src));
  R.ok('the placeholder is the sport name (blank = use sport)', /id="sch-label"[\s\S]{0,120}placeholder="\$\{escapeHtml\(sport\)\}"/.test(src));
  R.ok('saving stores the label on an EDITED class (or clears it when blank)',
    /existing\.coachId = coachId;[\s\S]{0,80}if \(_label\) existing\.label = _label; else delete existing\.label;/.test(src));
  R.ok('saving stores the label on a NEW class', /_rec = \{ id: nextId[\s\S]{0,120}if \(_label\) _rec\.label = _label;/.test(src));
  R.ok('a label equal to the sport name is NOT stored (kept clean)', /_labelRaw && _labelRaw !== sport/.test(src));
}

R.section('daily poster (WhatsApp status)');
{
  R.ok('exportDayStatus is defined', /function exportDayStatus\(dayKey, lang\)/.test(src));
  R.ok('it is a PORTRAIT canvas (1080 wide, ≥1920 tall)', /const W = 1080/.test(src) && /const H = Math\.max\(1920,/.test(src));
  R.ok('it only lists slots that HAVE classes this day', /classesAt\(day\.key, slot\.hour\)\.filter\(isFiltered\)[\s\S]{0,60}filter\(s => s\.cls\.length\)/.test(src));
  R.ok('each class chip uses the custom label when set', /const nm = c\.label \|\| \(ar \? sportNameAR\(c\.sport\) : c\.sport\)/.test(src));
  R.ok('it shows the coach on each chip', /\(ar \? 'المدرب: ' : 'Coach: '\) \+ cn/.test(src));
  R.ok('it downloads a PNG named for the day', /a\.download = `BlackStars-\$\{ar \? 'AR-' : ''\}\$\{day\.label\}-status\.png`/.test(src));

  R.ok('a Day-poster button + day picker are in the toolbar', /id="sch-status"/.test(src) && /id="sch-status-day"/.test(src));
  R.ok('the day picker defaults to today', /_todayKey/.test(src) && /\['sun','mon','tue','wed','thu','fri','sat'\]\[new Date\(\)\.getDay\(\)\]/.test(src));
  R.ok('the poster button is wired (EN + AR)', /sch-status'\)\?\.addEventListener\('click', \(\) => exportDayStatus/.test(src) && /sch-status-ar'\)\?\.addEventListener/.test(src));
  R.ok('the weekly PNG export still exists (not replaced)', /function exportPng\(lang\)/.test(src) && /id="sch-png"/.test(src));
}

R.section('the Schedule screen still renders in every role');
{
  for (const role of ['admin', 'receptionist', 'coach']) {
    const out = H.renderScreen(H.seed(H.makeCtx({ role })), 'schedule');
    R.ok(`renders for ${role}`, out.ok, out.error);
  }
}

R.done();
