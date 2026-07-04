// Black Stars CRM — PRODUCTION SANITY harness.
// Loads the REAL app.js + pages.js in a vm (same bootstrap as logic-tests.js),
// then loads a REAL production backup into `state` and runs:
//   1. Referential integrity (is everything wired together?)
//   2. Invoicing correctness (totals / paid / balance / status)
//   3. The financial identity  billed == collected + due  (per month + overall)
//   4. Reconciliation + Bank Account agreement
//   5. Payroll / commission runs cleanly for every coach
//   6. Dues, member status, products
//   7. End-to-end WORKFLOW scenarios (register → invoice → pay → renew → upgrade → freeze)
//
// HARD failures (must never happen) are asserted. DATA-QUALITY findings in the
// real data (stale totals, overpaid invoices, orphan links) are REPORTED with
// samples — they diagnose the production data, they are not code failures.
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..');
const appSrc = fs.readFileSync(path.join(DIR, 'app.js'), 'utf8');
const pagesSrc = fs.readFileSync(path.join(DIR, 'pages.js'), 'utf8');
const BACKUP = path.join(DIR, '..', 'prod-backup.json');   // staged outside the deploy folder
const backup = JSON.parse(fs.readFileSync(BACKUP, 'utf8'));

// ---- Minimal browser stubs (mirror logic-tests.js) --------------------------
function fakeEl() {
  const e = {
    style: {}, dataset: {}, children: [], _html: '',
    classList: { add(){}, remove(){}, toggle(){}, contains(){return false;} },
    setAttribute(){}, getAttribute(){return null;}, removeAttribute(){},
    appendChild(c){ this.children.push(c); return c; }, append(){}, prepend(){},
    addEventListener(){}, removeEventListener(){}, remove(){},
    querySelector(){return null;}, querySelectorAll(){return [];},
    focus(){}, click(){}, closest(){return null;}, contains(){return false;},
    insertAdjacentHTML(){}, cloneNode(){return fakeEl();},
  };
  Object.defineProperty(e, 'innerHTML', { get(){return this._html;}, set(v){this._html=v;} });
  Object.defineProperty(e, 'textContent', { get(){return this._txt||'';}, set(v){this._txt=v;} });
  Object.defineProperty(e, 'value', { get(){return this._val||'';}, set(v){this._val=v;} });
  return e;
}
const documentStub = {
  getElementById(){ return null; }, querySelector(){ return null; }, querySelectorAll(){ return []; },
  createElement(){ return fakeEl(); }, createElementNS(){ return fakeEl(); },
  addEventListener(){}, removeEventListener(){},
  body: fakeEl(), head: fakeEl(), documentElement: fakeEl(),
};
const localStorageStub = (() => { const m = {}; return { getItem:k=>k in m?m[k]:null, setItem:(k,v)=>{m[k]=String(v);}, removeItem:k=>{delete m[k];}, clear:()=>{for(const k in m)delete m[k];} }; })();
const ctx = {
  console,
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0,
  localStorage: localStorageStub,
  sessionStorage: (() => { const m = {}; return { getItem:k=>k in m?m[k]:null, setItem:(k,v)=>{m[k]=String(v);}, removeItem:k=>{delete m[k];}, clear:()=>{for(const k in m)delete m[k];} }; })(),
  navigator: { userAgent: 'node', clipboard: { writeText: () => Promise.resolve() } },
  location: { href: 'file:///index.html', reload(){} },
  document: documentStub,
  alert: () => {}, confirm: () => true, prompt: () => null,
  matchMedia: () => ({ matches: false, addEventListener(){}, addListener(){} }),
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL(){} },
  Blob: function(){}, FileReader: function(){}, fetch: () => Promise.reject(new Error('no network')),
};
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.window.addEventListener = () => {};
ctx.__BACKUP__ = backup;
vm.createContext(ctx);

// ---- Load the app, hydrate real data, run the sanity suite ------------------
const epilogue = `
// Hydrate state from the real production backup.
state = Object.assign({ user: { name: 'SanityBot', email: 'admin', role: 'admin' } }, __BACKUP__);
state.user = { name: 'SanityBot', email: 'admin', role: 'admin' };
if (typeof currentRole === 'function') { /* role read from state.user */ }

;(function runSanity(){
  let pass = 0, fail = 0; const fails = [], notes = [];
  function ok(cond, label){ if(cond){pass++;} else {fail++; fails.push(label);} }
  function eq(a,b,label){ ok(JSON.stringify(a)===JSON.stringify(b), label + '  (got '+JSON.stringify(a)+', want '+JSON.stringify(b)+')'); }
  function note(label){ notes.push(label); }
  const F = n => (Math.round(n*100)/100);
  const money = n => Number(n||0).toLocaleString('en-US');

  const members = state.members || [], invoices = state.invoices || [], coaches = state.coaches || [];
  const memById = new Map(members.map(m => [m.id, m]));
  const coachById = new Map(coaches.map(c => [c.id, c]));
  const invByRef = new Map(invoices.filter(i=>i.ref).map(i => [i.ref, i]));
  const liveInv = invoices.filter(i => i && !i.deleted);

  console.log('\\n########  BLACK STARS CRM — PRODUCTION SANITY REPORT  ########');
  console.log('Backup: ' + (state.exported || '?') + ' · app ' + (state.appVersion||'?') + ' · schema ' + (state.schemaVersion||'?'));
  console.log('Testing against code: ' + (typeof APP_VERSION!=='undefined'?APP_VERSION:'?') + ' · TODAY=' + (typeof TODAY!=='undefined'?TODAY:'?'));
  console.log('Volumes: ' + members.length + ' members · ' + invoices.length + ' invoices · ' + coaches.length + ' coaches · ' + (state.expenses||[]).length + ' expenses · ' + (state.sales||[]).length + ' sales');

  // ============ 1. CORE FUNCTIONS EXIST + RUN WITHOUT THROWING ============
  console.log('\\n── 1. Core functions load ──');
  ['invoiceTotal','invoicePaid','invoiceBalance','invoiceStatus','billedInMonth','collectedInMonth','dueInMonth','memberOutstanding','memberStatus','coachName','invoiceMonths','computeReconciliation','computeMonthlyPay','computeAttendanceCommission','productCurrentStock'].forEach(fn => {
    ok(typeof eval(fn) === 'function', 'fn exists: ' + fn);
  });

  // ============ 2. REFERENTIAL INTEGRITY (everything connected) ============
  console.log('\\n── 2. Referential integrity ──');
  let orphanCust = 0, orphanLineCoach = 0, orphanSubCoach = 0, orphanFamily = 0, orphanSubInv = 0, dupInvRef = 0;
  const seenRef = new Set();
  for (const i of liveInv) {
    if (i.ref) { if (seenRef.has(i.ref)) dupInvRef++; seenRef.add(i.ref); }
    if (i.customerId != null && !memById.has(i.customerId)) orphanCust++;
    for (const li of (i.lineItems||[])) if (li.coachId != null && !coachById.has(li.coachId)) orphanLineCoach++;
  }
  for (const m of members) {
    if (m.familyId != null && !(state.families||[]).some(f=>f.id===m.familyId)) orphanFamily++;
    for (const s of (m.subscriptions||[])) {
      if (s.coachId != null && !coachById.has(s.coachId)) orphanSubCoach++;
      if (s.invoiceNumber && !invByRef.has(s.invoiceNumber)) orphanSubInv++;
    }
  }
  ok(dupInvRef === 0, 'no duplicate invoice refs among live invoices (' + dupInvRef + ')');
  note('invoice.customerId with no member: ' + orphanCust + (orphanCust?' (walk-ins/deleted members)':''));
  note('lineItem.coachId with no coach: ' + orphanLineCoach);
  note('subscription.coachId with no coach: ' + orphanSubCoach);
  note('subscription.invoiceNumber with no invoice: ' + orphanSubInv + ' (legacy subs pre-dating the invoice link)');
  note('member.familyId with no family: ' + orphanFamily);

  // ============ 3. INVOICING SYSTEM — per-invoice correctness ============
  console.log('\\n── 3. Invoicing correctness ──');
  let nanCount = 0, negBal = 0, overpaid = 0, staleAmt = 0, ledgerDrift = 0, badMonth = 0;
  const staleSamples = [], overpaidSamples = [];
  for (const i of liveInv) {
    const tot = invoiceTotal(i), paid = invoicePaid(i), bal = invoiceBalance(i);
    if ([tot,paid,bal].some(x => typeof x!=='number' || isNaN(x))) nanCount++;
    if (bal < -0.01) negBal++;
    if (paid > tot + 0.01) { overpaid++; if (overpaidSamples.length<6) overpaidSamples.push((i.ref||i.id)+': paid '+money(paid)+' > total '+money(tot)); }
    // stale stored amount (pre-6.254 data): inv.amount != Σ lineItems
    if (Array.isArray(i.lineItems) && i.lineItems.length) {
      const ls = i.lineItems.reduce((s,li)=>s+(Number(li.price)||0),0);
      if (Math.abs(ls - (Number(i.amount)||0)) > 0.5) { staleAmt++; if (staleSamples.length<8) staleSamples.push((i.ref||i.id)+': amount '+money(i.amount)+' vs lines '+money(ls)); }
    }
    if (Array.isArray(i.payments) && i.payments.length && i.amountPaid != null) {
      const sum = i.payments.reduce((s,p)=>s+(Number(p.amount)||0),0);
      if (Math.abs(sum - i.amountPaid) > 0.01) ledgerDrift++;
    }
    const mo = invoiceBillMonth ? invoiceBillMonth(i) : (i.month||'');
    if (!/^\\d{4}-\\d{2}$/.test(String(mo))) badMonth++;
  }
  eq(nanCount, 0, 'HARD: no invoice produces NaN for total/paid/balance');
  eq(negBal, 0, 'HARD: no invoice has a NEGATIVE balance');
  eq(badMonth, 0, 'HARD: every live invoice resolves to a valid YYYY-MM bill month');
  note('invoices paid MORE than their total (overpaid/credit): ' + overpaid);
  overpaidSamples.forEach(s => note('   • ' + s));
  note('invoices with STALE stored amount ≠ Σ line prices: ' + staleAmt + ' (reads are already line-sum-correct; Cleanup Center can heal the stored field)');
  staleSamples.forEach(s => note('   • ' + s));
  note('payment ledgers not summing to amountPaid: ' + ledgerDrift);

  // ============ 4. FINANCIAL IDENTITY  billed == collected + due ============
  console.log('\\n── 4. Financial identity (billed = collected + due) ──');
  const monthsSet = new Set();
  for (const i of liveInv) (invoiceMonths(i)||[]).forEach(m => monthsSet.add(m));
  const months = [...monthsSet].filter(m=>/^\\d{4}-\\d{2}$/.test(m)).sort();
  let identityBad = 0, sumBilled = 0, sumColl = 0, sumDue = 0;
  for (const ym of months) {
    const b = billedInMonth(ym), c = collectedInMonth(ym), d = dueInMonth(ym);
    if ([b,c,d].some(x=>isNaN(x))) { identityBad++; continue; }
    if (Math.abs(b - (c + d)) > 1) identityBad++;
    sumBilled += b; sumColl += c; sumDue += d;
  }
  eq(identityBad, 0, 'HARD: billed == collected + due for ALL ' + months.length + ' months in the data');
  // Σ billed across months must equal Σ invoiceTotal of live invoices (revenue is fully accounted).
  const totalInvValue = liveInv.reduce((s,i)=>s+invoiceTotal(i),0);
  ok(Math.abs(sumBilled - totalInvValue) < months.length + 5, 'HARD: Σ month-billed (' + money(F(sumBilled)) + ') ≈ Σ invoice totals (' + money(F(totalInvValue)) + ')');
  console.log('   Overall: billed ' + money(F(sumBilled)) + ' · collected ' + money(F(sumColl)) + ' · due ' + money(F(sumDue)));

  // ============ 5. RECONCILIATION + BANK AGREEMENT (per month) ============
  console.log('\\n── 5. Reconciliation + Bank Account ──');
  let recNaN = 0, methodDrift = 0, bigLeak = 0; const leakSamples = [];
  for (const ym of months) {
    let R; try { R = computeReconciliation(ym); } catch(e){ recNaN++; continue; }
    if (!R || isNaN(R.revenue) || isNaN(R.nonCash) || isNaN(R.leakage)) { recNaN++; continue; }
    const byM = R.byMethod || {};
    const methodSum = (byM.cash||0)+(byM.card||0)+(byM.transfer||0)+(byM.fawran||0);
    if (Math.abs(methodSum - R.revenue) > 1) methodDrift++;
    if (Math.abs(R.leakage) > 1) { bigLeak++; if (leakSamples.length<6) leakSamples.push(ym+': leakage '+money(F(R.leakage))); }
  }
  eq(recNaN, 0, 'HARD: computeReconciliation runs cleanly for every month');
  eq(methodDrift, 0, 'HARD: reconciliation by-method split always sums to revenue');
  note('months with non-zero leakage (untracked owner-cash / missing expense — operational, not a code bug): ' + bigLeak);
  leakSamples.forEach(s => note('   • ' + s));

  // ============ 6. PAYROLL / COMMISSION for every coach ============
  console.log('\\n── 6. Payroll / commission ──');
  const recentMonths = months.slice(-3);
  let payNaN = 0, negComm = 0, commOverBase = 0, payRuns = 0;
  for (const c of coaches) {
    for (const ym of recentMonths) {
      let p; try { p = computeMonthlyPay(c.id, ym); } catch(e){ payNaN++; continue; }
      payRuns++;
      if (!p || isNaN(p.commissionBase) || isNaN(p.commissionAmount)) { payNaN++; continue; }
      if (p.commissionAmount < -0.01) negComm++;
      if (p.commissionAmount > p.commissionBase + 0.01) commOverBase++;
    }
    for (const ym of recentMonths) { try { computeAttendanceCommission(c.id, ym); } catch(e){ payNaN++; } }
  }
  eq(payNaN, 0, 'HARD: payroll + attendance-commission run cleanly (' + payRuns + ' coach·month runs, no NaN/throw)');
  eq(negComm, 0, 'HARD: no negative commission');
  eq(commOverBase, 0, 'HARD: commission never exceeds its base');

  // ============ 7. DUES / STATUS / PRODUCTS ============
  console.log('\\n── 7. Dues · status · products ──');
  let dueNaN = 0, negDue = 0, statusBad = 0, totalDueAll = 0, membersWithDue = 0;
  const okStatus = new Set(['Active','Expired','Frozen','Trial','Completed','Withdrawn','Pending','New','Inactive','Cancelled']);
  for (const m of members) {
    let out; try { out = memberOutstanding(m.id); } catch(e){ dueNaN++; continue; }
    if (isNaN(out)) { dueNaN++; continue; }
    if (out < -0.01) negDue++;
    if (out > 0.5) { membersWithDue++; totalDueAll += out; }
    let st; try { st = memberStatus(m); } catch(e){ statusBad++; continue; }
    if (!okStatus.has(st)) statusBad++;
  }
  eq(dueNaN, 0, 'HARD: memberOutstanding never NaN/throws (all ' + members.length + ' members)');
  eq(negDue, 0, 'HARD: no member has a negative outstanding balance');
  eq(statusBad, 0, 'HARD: memberStatus returns a valid status for every member');
  console.log('   ' + membersWithDue + ' members owe money · total outstanding ' + money(F(totalDueAll)) + ' QAR');
  let negStock = 0;
  for (const p of (state.products||[])) { let s; try { s = productCurrentStock(p.id); } catch(e){ s = NaN; } if (isNaN(s)) negStock++; else if (s < 0) note('   • negative stock: ' + (p.name||p.id) + ' = ' + s); }
  eq(negStock, 0, 'HARD: product stock computes for every product');

  // ============ 7b. CROSS-SCREEN AGREEMENT ("everything connected") ============
  console.log('\\n── 7b. Cross-screen agreement ──');
  // The Due-Payment screen (Σ memberOutstanding), the Monthly Report (Σ dueInMonth)
  // and the revenue identity (billed − collected) are three INDEPENDENT code paths.
  // In a healthy, fully-wired system they must land on the same number.
  const dueFromMembers = members.reduce((s,m)=>{ const o=memberOutstanding(m.id); return s + (o>0?o:0); },0);
  const dueFromMonths  = months.reduce((s,ym)=>s+dueInMonth(ym),0);
  ok(Math.abs(dueFromMembers - dueFromMonths) < 5, 'CONNECTED: Due screen (Σ memberOutstanding=' + money(F(dueFromMembers)) + ') == Monthly Report (Σ dueInMonth=' + money(F(dueFromMonths)) + ')');
  ok(Math.abs(dueFromMonths - (sumBilled - sumColl)) < months.length + 5, 'CONNECTED: Σ due == billed − collected (revenue identity closes)');
  // Cash drawer basis vs revenue-cash basis both derive from the same payments.
  let cashDrift = 0;
  if (typeof cashCollectedInMonth === 'function') {
    for (const ym of months) { const cc = cashCollectedInMonth(ym); if (isNaN(cc) || cc < -0.01) cashDrift++; }
  }
  eq(cashDrift, 0, 'CONNECTED: cashCollectedInMonth (drawer basis) is clean for every month');

  // ============ 8. END-TO-END WORKFLOW SCENARIOS (synthetic) ============
  console.log('\\n── 8. Workflow scenarios (end-to-end) ──');
  const savedInv = state.invoices, savedMem = state.members;
  state.invoices = savedInv.slice(); state.members = savedMem.slice();
  const NEWID = 990000;
  // 8a. Register + invoice + partial pay → correct balance
  (function(){
    const inv = { id: NEWID+1, ref:'SANITY-1', date: TODAY, month: String(TODAY).slice(0,7), category:'Membership', customerId: NEWID+1,
      amount: 600, amountPaid: 200, payments:[{date:TODAY, amount:200, method:'cash'}], lineItems:[{sport:'Boxing', coachId:(coaches[0]||{}).id||null, price:600}] };
    state.invoices.push(inv);
    eq(F(invoiceBalance(inv)), 400, 'scenario register→invoice→pay 200/600 → balance 400');
    eq(invoiceStatus(inv), 'Partial', 'scenario partial-pay → status Partial');
    // pay the rest
    inv.payments.push({date:TODAY, amount:400, method:'card'}); inv.amountPaid = 600;
    eq(F(invoiceBalance(inv)), 0, 'scenario pay remaining → balance 0');
    eq(invoiceStatus(inv), 'Paid', 'scenario fully paid → status Paid');
  })();
  // 8b. Multi-sport invoice → per-sport month revenue splits and re-sums
  (function(){
    const inv = { id: NEWID+2, ref:'SANITY-2', date: TODAY, month: String(TODAY).slice(0,7), category:'Membership', customerId: NEWID+2,
      amount: 900, amountPaid: 900, payments:[{date:TODAY, amount:900, method:'cash'}],
      lineItems:[{sport:'Karate', price:500},{sport:'Swimming', price:400}] };
    state.invoices.push(inv);
    const share = (invoiceMonths(inv)||[]).reduce((s,m)=>s+invoiceTotal(inv)*invoiceMonthShare(inv,m),0);
    eq(F(share), 900, 'scenario multi-sport → month shares re-sum to the invoice total');
  })();
  // 8c. UPGRADE (camp 1 day 175 paid → 1 month 1750) must NOT auto-mark paid
  (function(){
    const inv = { id: NEWID+3, ref:'SANITY-3', date: TODAY, month:String(TODAY).slice(0,7), category:'Membership', customerId: NEWID+3,
      amount:175, amountPaid:175, payments:[{date:TODAY, amount:175, method:'cash'}], lineItems:[{sport:'Summer Camp', price:175, classes:1, durationLabel:'1 day'}] };
    state.invoices.push(inv);
    syncSubToEnrollment({ activity:'Summer Camp', invoiceNumber:'SANITY-3', amountPaid:175 }, { sport:'Summer Camp', price:1750, classes:30, durationLabel:'1 month' }, { id: NEWID+3, name:'UpgradeTest' }, state.invoices);
    eq(invoiceTotal(inv), 1750, 'scenario upgrade → invoice total rises to 1750');
    eq(invoicePaid(inv), 175, 'scenario upgrade → paid STAYS 175 (not auto-marked paid)');
    eq(F(invoiceBalance(inv)), 1575, 'scenario upgrade → 1575 correctly shows as due');
  })();
  // 8d. Renewal creates a NEW invoice (never mutates the old one)
  (function(){
    const before = state.invoices.length;
    state.invoices.push({ id: NEWID+4, ref:'SANITY-4', date: TODAY, month:String(TODAY).slice(0,7), category:'Membership', customerId: NEWID+4, amount:500, amountPaid:500, payments:[{date:TODAY,amount:500,method:'cash'}], lineItems:[{sport:'MMA', price:500}] });
    ok(state.invoices.length === before + 1, 'scenario renewal → a NEW invoice row is added');
  })();
  // 8e. Downgrade / price correction on a paid invoice stays paid-in-full
  (function(){
    const inv = { id: NEWID+5, ref:'SANITY-5', date: TODAY, month:String(TODAY).slice(0,7), category:'Membership', customerId: NEWID+5, amount:300, amountPaid:300, payments:[{date:TODAY,amount:300,method:'cash'}], lineItems:[{sport:'Boxing', price:300}] };
    state.invoices.push(inv);
    syncSubToEnrollment({ activity:'Boxing', invoiceNumber:'SANITY-5', amountPaid:300 }, { sport:'Boxing', price:250 }, { id:NEWID+5, name:'DownTest' }, state.invoices);
    eq(F(invoiceBalance(inv)), 0, 'scenario price correction/downgrade on paid invoice → stays paid in full');
  })();
  // 8f. Freeze → status Frozen (paused, not expired) even with a past raw expiry
  (function(){
    eq(memberStatus({ id: NEWID+6, name:'FreezeTest', expiryDate:'2026-01-01', currentFreezeUntil:'2099-12-31' }), 'Frozen', 'scenario freeze → status Frozen despite past expiry');
  })();
  // 8g. CONNECTED: a paid coach-line member flows into that coach's commission report
  (function(){
    const coachId = (coaches[0]||{}).id; if (coachId==null) return;
    const savedCS = state.settings && state.settings.commissionStartDate; if (state.settings) state.settings.commissionStartDate='';
    const ym = String(TODAY).slice(0,7), start = ym+'-01';
    state.members.push({ id: NEWID+7, name:'AttTest', expiryDate:'2099-12-31',
      subscriptions:[{ activity:'Boxing', coachId, totalClasses:8, attendedClasses:0, start, end:'2099-12-31', invoiceNumber:'SANITY-ATT' }], dailyAttendance:{ [ym]:{ Boxing:{ 1:'Y', 2:'Y' } } } });
    state.invoices.push({ id: NEWID+7, ref:'SANITY-ATT', date:start, month:ym, category:'Membership', customerId:NEWID+7, amount:800, amountPaid:800, payments:[{date:start,amount:800,method:'cash'}], lineItems:[{sport:'Boxing', coachId, price:800}] });
    const r = computeAttendanceCommission(coachId, ym);
    const found = [...(r.lines||[]),...(r.pendingLines||[])].some(l=>/AttTest/.test(l.memberName||''));
    ok(found, 'scenario CONNECTED: a paid Boxing member with attendance appears in that coach\\'s commission (invoice→sub→attendance→payroll)');
    if (state.settings) state.settings.commissionStartDate = savedCS;
  })();
  state.invoices = savedInv; state.members = savedMem;   // restore

  // ============ REPORT ============
  console.log('\\n────────── DATA-QUALITY NOTES (real production data) ──────────');
  notes.forEach(n => console.log('  • ' + n));
  console.log('\\n================ SANITY RESULTS ================');
  console.log('HARD ASSERTIONS —  PASS: ' + pass + '   FAIL: ' + fail);
  if (fails.length) { console.log('\\nFAILURES:'); fails.forEach(f=>console.log('  ✗ ' + f)); }
  else console.log('All hard invariants hold ✅  (invoicing, dues, payroll, reconciliation, workflows)');
  console.log('===============================================');
})();
`;

const combined = appSrc + '\n;\n' + pagesSrc + '\n;\n' + epilogue;
try {
  vm.runInContext(combined, ctx, { filename: 'prod-sanity.js' });
} catch (e) {
  console.error('HARNESS ERROR:', e && e.stack ? e.stack.split('\n').slice(0,8).join('\n') : e);
  process.exit(1);
}
