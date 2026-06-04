// Black Stars CRM — logic test harness.
// Loads the REAL app.js + pages.js inside a vm with stubbed browser globals,
// seeds a realistic state, and asserts the critical business logic.
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const DIR = require('path').join(__dirname, '..');
const appSrc = fs.readFileSync(path.join(DIR, 'app.js'), 'utf8');
const pagesSrc = fs.readFileSync(path.join(DIR, 'pages.js'), 'utf8');

// ---- Minimal browser stubs --------------------------------------------------
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
  getElementById(){ return null; },
  querySelector(){ return null; },
  querySelectorAll(){ return []; },
  createElement(){ return fakeEl(); },
  createElementNS(){ return fakeEl(); },
  addEventListener(){}, removeEventListener(){},
  body: fakeEl(), head: fakeEl(), documentElement: fakeEl(),
};
const localStorageStub = (() => {
  const m = {};
  return { getItem:k=>k in m?m[k]:null, setItem:(k,v)=>{m[k]=String(v);}, removeItem:k=>{delete m[k];}, clear:()=>{for(const k in m)delete m[k];} };
})();

const ctx = {
  console,
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  requestAnimationFrame: () => 0,
  localStorage: localStorageStub,
  navigator: { userAgent: 'node', clipboard: { writeText: () => Promise.resolve() } },
  location: { href: 'file:///index.html', reload(){} },
  document: documentStub,
  alert: () => {}, confirm: () => true, prompt: () => null,
  matchMedia: () => ({ matches: false, addEventListener(){}, addListener(){} }),
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL(){} },
  Blob: function(){}, FileReader: function(){},
  fetch: () => Promise.reject(new Error('no network in test')),
};
ctx.window = ctx;
ctx.globalThis = ctx;
ctx.self = ctx;
ctx.window.addEventListener = () => {};   // swallow DOMContentLoaded bootstrap

vm.createContext(ctx);

// ---- Test scenario seed -----------------------------------------------------
// Dates relative to a fixed "today" the app computes itself (TODAY). We seed
// expiry dates clearly in the past/future so status logic is unambiguous.
const seed = `
state = {
  user: { name: 'Administrator', email: 'admin' },
  settings: {},
  coaches: [
    { id: 1, name: 'Mostafa', rate: 0, fixedSalary: 3000, active: 'Y' },
    { id: 2, name: 'Abdel Salam', rate: 30, fixedSalary: 0, active: 'Y' },
    { id: 3, name: 'Aya', rate: 25, fixedSalary: 0, active: 'N' },
  ],
  members: [
    // 0: active, MMA under coach 2, has 2nd mobile
    { id: 10, name: 'Karim', nameArabic: 'كريم', phone: '+974 5011 1111', phone2: '+974 5041 3948', qid: '28812345678', expiryDate: '2099-12-31', status: 'Active', coachId: 2, enrollments: [{ sport: 'MMA', coachId: 2, classes: 12, price: 350 }], subscriptions: [{ activity:'MMA', coachId:2, totalClasses:12, attendedClasses:5, start:'2026-05-01', end:'2026-05-31', invoiceNumber:'INV0001' }], dailyAttendance: { '2026-06': { 'MMA': { '3':'Y','5':'Y' } } } },
    // 1: expired
    { id: 11, name: 'Sara', nameArabic: '', phone: '+974 5022 2222', qid: '', expiryDate: '2020-01-01', status: 'Active', coachId: 2, enrollments: [{ sport: 'Karate', coachId: 2 }] },
    // 2: duplicate of Karim (same phone + same EN name) -> should be flagged
    { id: 12, name: 'karim', nameArabic: '', phone: '+97450111111', qid: '', expiryDate: '2099-12-31', status: 'Active', coachId: 2, enrollments: [{ sport: 'MMA', coachId: 2 }] },
    // 3: shares phone with a different name (family) -> NOT a duplicate
    { id: 13, name: 'Mona', nameArabic: '', phone: '+974 5011 1111', qid: '', expiryDate: '2099-12-31', status: 'Active', coachId: 1, enrollments: [{ sport: 'Swimming', coachId: 1 }] },
    // 4: frozen
    { id: 14, name: 'Frozen Guy', phone: '+974 5099 9999', expiryDate: '2020-01-01', currentFreezeUntil: '2099-01-01', status: 'Active', coachId: 1, enrollments: [{ sport: 'Boxing', coachId: 1 }] },
    // 5: archived (deleted)
    { id: 15, name: 'Gone', phone: '+974 5088 8888', expiryDate: '2099-12-31', deleted: true, status: 'Active', coachId: 1, enrollments: [] },
    // 6: multi-sport
    { id: 16, name: 'Multi', phone: '+974 5077 7777', expiryDate: '2099-12-31', status: 'Active', coachId: 2, enrollments: [{ sport: 'Kick Boxing', coachId: 2 }, { sport: 'Gymnastic', coachId: 1 }] },
  ],
  invoices: [
    { id: 1, ref: 'INV0001', date: '2026-06-03', month: '2026-06', amount: 350, method: 'cash', category: 'Membership', sport: 'MMA', coachId: 2, customerId: 10 },
    { id: 2, ref: 'INV0002', date: '2026-06-03', month: '2026-06', amount: 175, method: 'cash', category: 'Membership', sport: 'Summer Camp', coachId: null, customerId: 10 },
    { id: 3, ref: 'INV0005', date: '2026-06-03', month: '2026-06', amount: 200, method: 'card', category: 'Product', sport: null, coachId: null, customerId: 16 },
  ],
  products: [
    { id: 1, name: 'Gloves', price: 80, stock: 10, lowStockThreshold: 3 },
    { id: 2, name: 'Gi', price: 150, stock: 2, lowStockThreshold: 3 },
  ],
  sales: [
    { id: 1, date: '2026-06-03', customerId: 16, items: [{ productId: 1, qty: 3, unitPrice: 80 }] },
  ],
  expenses: [],
  salaries: [],
  schedule: [],
  rentals: [],
  audit: [],
};
`;

// ---- Assertions -------------------------------------------------------------
const epilogue = `
${seed}
;(function runTests(){
  let pass = 0, fail = 0; const fails = [];
  function ok(cond, label){ if(cond){pass++;} else {fail++; fails.push(label);} }
  function eq(a,b,label){ ok(JSON.stringify(a)===JSON.stringify(b), label + '  (got '+JSON.stringify(a)+', want '+JSON.stringify(b)+')'); }

  // --- date / number helpers ---
  eq(daysInMonth('2026-02'), 28, 'daysInMonth Feb 2026');
  eq(daysInMonth('2024-02'), 29, 'daysInMonth Feb 2024 leap');
  eq(daysInMonth('2026-04'), 30, 'daysInMonth Apr');
  eq(nextId([{id:3},{id:7},{id:2}]), 8, 'nextId max+1');
  eq(nextId([]), 1, 'nextId empty -> 1');
  eq(pctChangeStr(0,100), '∞', 'pct from zero -> ∞');
  eq(pctChangeStr(0,0), '—', 'pct 0->0 -> dash');
  eq(pctChangeStr(100,150), '50.0', 'pct +50');
  eq(pctChangeStr(100,50), '-50.0', 'pct -50');

  // --- phone helpers ---
  ok(isRealPhone('+97455551234'), 'isRealPhone real');
  ok(!isRealPhone('+97470001234'), 'isRealPhone placeholder false');
  ok(!isRealPhone(''), 'isRealPhone empty false');
  ok(phonesMatch('+974 5011 1111', '+97450111111'), 'phonesMatch diff formatting');
  ok(!phonesMatch('+97450111111', '+97450222222'), 'phonesMatch different false');

  // --- name / duplicate detection ---
  ok(namesMatch({name:'Karim'},{name:'  karim '}), 'namesMatch EN case/space');
  ok(namesMatch({nameArabic:'كريم'},{nameArabic:'كريم'}), 'namesMatch AR');
  ok(!namesMatch({name:'Karim'},{name:'Mona'}), 'namesMatch different false');
  const dup = findDuplicateMember('+97450111111','karim','',999);
  ok(dup && dup.id===10, 'findDuplicateMember finds same phone+name');
  const noDup = findDuplicateMember('+974 5011 1111','Totally Different','',999);
  ok(noDup===null, 'findDuplicateMember different name same phone -> null (family ok)');
  const selfExcluded = findDuplicateMember('+97450111111','karim','',10);
  ok(selfExcluded && selfExcluded.id===12, 'findDuplicateMember excludes self, finds other dup');
  const clusters = findAllDuplicateMembers();
  const karimCluster = clusters.find(c => c.some(m=>m.id===10) && c.some(m=>m.id===12));
  ok(!!karimCluster, 'findAllDuplicateMembers clusters Karim+karim');
  const monaInCluster = clusters.some(c => c.some(m=>m.id===13) && c.some(m=>m.id===10));
  ok(!monaInCluster, 'family (Mona) NOT clustered with Karim despite shared phone');

  // --- member status ---
  eq(memberStatus(state.members.find(m=>m.id===10)), 'Active', 'status active (future expiry)');
  eq(memberStatus(state.members.find(m=>m.id===11)), 'Expired', 'status expired (past expiry)');
  eq(memberStatus(state.members.find(m=>m.id===14)), 'Frozen', 'status frozen');

  // --- coach name ---
  eq(coachName(2), 'Abdel Salam', 'coachName found');

  // --- customerInfo incl. phone2 ---
  const ci = customerInfo({ customerId: 10 });
  eq(ci.phone2, '+974 5041 3948', 'customerInfo exposes phone2');
  eq(ci.nameArabic, 'كريم', 'customerInfo exposes arabic name');

  // --- stock ---
  eq(productCurrentStock(1), 7, 'stock 10 - 3 sold = 7');
  eq(productCurrentStock(2), 2, 'stock untouched = 2');

  // --- invoice ref ---
  eq(nextInvoiceRef(), 'INV0006', 'nextInvoiceRef after INV0005');

  // --- COMMISSION (real payroll fn), incl. Summer Camp exclusion ---
  const payBefore = computeMonthlyPay(2, '2026-06');
  eq(payBefore.commissionBase, 350, 'commission base = MMA 350 (Summer Camp excluded)');
  eq(Math.round(payBefore.commissionAmount), 105, 'commission 30% of 350 = 105');

  // --- MERGE preserves commission (replace inv 1+2 with one lineItem invoice) ---
  state.invoices = state.invoices.filter(i => i.id!==1 && i.id!==2);
  state.invoices.push({ id: 99, ref:'INV0001', date:'2026-06-03', month:'2026-06', amount:525, method:'cash', category:'Membership', sport:null, coachId:null, customerId:10,
    lineItems:[{sport:'MMA',coachId:2,price:350},{sport:'Summer Camp',coachId:null,price:175}] });
  const payAfter = computeMonthlyPay(2, '2026-06');
  eq(payAfter.commissionBase, 350, 'commission base STILL 350 after merge (lineItems honored)');

  // --- pagination ---
  const pager = makePager(2); pager.page = 2;
  eq(paginate([1,2,3,4,5], pager), [3,4], 'paginate page 2 size 2');

  // --- attendance counting ---
  const am = { id: 50, dailyAttendance: { '2026-06': { 'MMA': { '3':'Y','5':'Y','7':'N' }, 'Boxing': { '2':'Y' } } } };
  const lac = liveAttendanceCount(am, 'MMA');
  eq([lac.y, lac.n, lac.total], [2,1,3], 'liveAttendanceCount MMA y/n/total');
  eq(attendedClassesFor(am, 'MMA'), 2, 'attendedClassesFor MMA = 2');
  eq(attendanceFor(am, '2026-06', 'MMA'), {'3':'Y','5':'Y','7':'N'}, 'attendanceFor returns day map');
  const lacAll = liveAttendanceCount(am, null);
  eq([lacAll.y, lacAll.n], [3,1], 'liveAttendanceCount all sports y/n');

  // --- age / birthday ---
  ok(memberAge('') === null, 'memberAge empty -> null');
  ok(Number.isInteger(memberAge('2000-06-15')) && memberAge('2000-06-15') >= 0, 'memberAge valid -> int');
  ok(memberAge('not-a-date') === null, 'memberAge invalid -> null');
  const dub = daysUntilBirthday('1990-12-31');
  ok(dub === null || (dub >= 0 && dub <= 366), 'daysUntilBirthday in range');
  ok(isBirthdayInMonth('1990-06-15', '2026-06') === true, 'isBirthdayInMonth June match');
  ok(isBirthdayInMonth('1990-07-15', '2026-06') === false, 'isBirthdayInMonth July vs June');

  // --- QID lookup ---
  const byQid = findMembersByQid('28812345678');
  ok(byQid.length === 1 && byQid[0].id === 10, 'findMembersByQid finds Karim');
  ok(findMembersByQid('28812345678', 10).length === 0, 'findMembersByQid excludeId works');
  ok(findMembersByQid('').length === 0, 'findMembersByQid empty -> []');

  // --- number to words (invoice receipts) ---
  eq(numberToWords(0), 'Zero', 'numberToWords zero');
  ok(/Hundred/.test(numberToWords(525)) && numberToWords(525).length > 0, 'numberToWords 525 has Hundred');
  ok(typeof numberToWords(1000) === 'string' && numberToWords(1000).length > 0, 'numberToWords 1000 non-empty');

  // --- month helpers (note: invoice 1+2 were merged into id 99, still 2026-06) ---
  ok(availableMonths().includes('2026-06'), 'availableMonths includes 2026-06');
  eq(latestDataMonth(), '2026-06', 'latestDataMonth = 2026-06');

  // --- formatters / edge cases ---
  eq(fmt(null), '—', 'fmt null'); eq(fmt(NaN), '—', 'fmt NaN'); eq(fmt(1234), '1,234', 'fmt thousands');
  eq(fmtMoney(null), '—', 'fmtMoney null'); eq(fmtMoney(500), '500 QAR', 'fmtMoney 500');
  eq(escapeHtml('<b>"x"&\\''), '&lt;b&gt;&quot;x&quot;&amp;&#39;', 'escapeHtml escapes all');
  eq(escapeHtml(null), '', 'escapeHtml null -> empty');
  eq(normalizePhoneForCompare('+974 50-11 (x)'), '974' + '5011', 'normalizePhone strips non-digits');
  eq(numberToWords(-5), 'Negative Five', 'numberToWords negative');
  ok(paginate([1,2,3], (()=>{const p=makePager(2);p.page=99;return p;})()).length === 0, 'paginate out-of-range -> [] (no crash)');

  // --- computeStats: must not produce NaN/throw ---
  let stats = null, statsErr = null;
  try { stats = computeStats(); } catch(e){ statsErr = e.message; }
  ok(!statsErr, 'computeStats does not throw' + (statsErr?': '+statsErr:''));
  ok(stats && Number.isFinite(stats.currRevenue), 'computeStats.currRevenue is finite');
  ok(stats && Number.isFinite(stats.currExpenses), 'computeStats.currExpenses is finite');

  // --- mirrored closure logic (exact expressions used inside page closures) ---
  // Members multi-select sport filter
  function memberInSports(m, fSports){ if(fSports&&fSports.length){const s=new Set([m.sport,...((m.enrollments||[]).map(e=>e.sport))].filter(Boolean)); return fSports.some(sp=>s.has(sp));} return true; }
  ok(memberInSports(state.members.find(x=>x.id===16), ['Gymnastic']), 'multi-sport filter: Multi matches [Gymnastic]');
  ok(!memberInSports(state.members.find(x=>x.id===16), ['Karate']), 'multi-sport filter: Multi excluded by [Karate]');
  ok(memberInSports(state.members.find(x=>x.id===16), []), 'multi-sport filter: [] matches all');
  // Attendance attended filter
  function rowAttended(data, days){ return days.some(d => data[String(d)] === 'Y'); }
  ok(rowAttended({'3':'Y','5':'N'}, [3]) === true, 'attended filter: Y on day 3');
  ok(rowAttended({'3':'Y','5':'N'}, [5]) === false, 'attended filter: N on day 5');
  // Second-mobile search hay
  const hm = state.members.find(x=>x.id===10);
  const hay = [hm.name, hm.nameArabic, hm.phone, hm.phone2, hm.qid].filter(Boolean).join(' ').toLowerCase();
  ok(hay.includes('5041 3948'.toLowerCase()) || hay.includes('+974 5041 3948'.toLowerCase()), 'search hay includes 2nd mobile');
  ok(hay.includes('كريم'), 'search hay includes arabic name');

  // --- active-state helpers ---
  eq(activeCoaches().map(c=>c.id), [1,2], 'activeCoaches excludes inactive (id 3)');
  ok(isCoachActive({active:'Y'}) && !isCoachActive({active:'N'}) && isCoachActive({}), 'isCoachActive Y/N/default');
  ok(activeMembers().every(m=>!m.deleted) && !activeMembers().some(m=>m.id===15), 'activeMembers excludes archived');
  ok(isActiveStatus(state.members.find(m=>m.id===10)) === true, 'isActiveStatus active member');
  ok(isActiveStatus(state.members.find(m=>m.id===11)) === false, 'isActiveStatus expired member');

  // --- date deltas ---
  ok(daysUntil('') === null, 'daysUntil empty -> null');
  ok(daysUntil('not-a-date') === null, 'daysUntil invalid -> null');
  ok(daysUntil('2099-12-31') > 0, 'daysUntil future > 0');
  ok(daysUntil('2000-01-01') < 0, 'daysUntil past < 0');

  // --- payroll with an advance (net = gross - advance) ---
  state.salaries = [{ coachId: 2, month: '2026-06', kind: 'advance', amount: 50 }];
  const payAdv = computeMonthlyPay(2, '2026-06');
  eq(payAdv.advance, 50, 'advance recorded = 50');
  ok(Number.isFinite(payAdv.gross) && Number.isFinite(payAdv.net), 'pay gross/net finite');
  eq(payAdv.gross - payAdv.advance, payAdv.net, 'net = gross - advance');

  // --- coach revenue-report line enrichment (period / attendance / status) ---
  // mirrors the exact gathering logic added to downloadRevenueDetailPDF
  function gatherCoachLines(coachId, monthKey){
    const out=[];
    for (const inv of state.invoices){
      if (inv.month !== monthKey) continue;
      if ((inv.category||'Membership') !== 'Membership') continue;
      const mem = inv.customerId ? state.members.find(x=>x.id===inv.customerId) : null;
      const lis = Array.isArray(inv.lineItems)&&inv.lineItems.length ? inv.lineItems : [{sport:inv.sport,coachId:inv.coachId,price:inv.amount||0}];
      for (const li of lis){
        if (li.coachId !== coachId) continue;
        if (li.sport === SUMMER_CAMP) continue;
        let sub=null;
        if (mem){ sub=(mem.subscriptions||[]).find(s=>s.invoiceNumber===inv.ref&&s.activity===li.sport)||(mem.subscriptions||[]).find(s=>s.activity===li.sport&&s.coachId===li.coachId); }
        out.push({ memberName: mem?mem.name:(inv.customerName||'—'), sport: li.sport, price: parseFloat(li.price)||0,
          start: sub?.start||null, end: sub?.end||null, attended: mem?attendedClassesFor(mem,li.sport):0, total: sub?.totalClasses||null, status: mem?memberStatus(mem):'—' }); }
    }
    return out;
  }
  const cl = gatherCoachLines(2, '2026-06');   // after merge: invoice 99 (ref INV0001) MMA 350
  const karimLine = cl.find(l => l.sport === 'MMA');
  ok(!!karimLine, 'coach report has Karim MMA line');
  eq(karimLine.start, '2026-05-01', 'report line start date from subscription');
  eq(karimLine.end, '2026-05-31', 'report line end date from subscription');
  eq(karimLine.attended, 2, 'report line attended = live count (2)');
  eq(karimLine.total, 12, 'report line total classes = 12');
  eq(karimLine.status, 'Active', 'report line member status');
  ok(!cl.some(l => l.sport === SUMMER_CAMP), 'report excludes Summer Camp line');

  // --- duplicate-invoice guard logic (generate latest invoice) ---
  function dupCheck(memberId, mth){ return state.invoices.filter(inv => inv.customerId===memberId && inv.month===mth && (inv.category||'Membership')==='Membership'); }
  ok(dupCheck(10, '2026-06').length >= 1, 'dup-guard: detects existing June membership invoice for member 10');
  ok(dupCheck(11, '2026-06').length === 0, 'dup-guard: no false positive for member without June invoice');

  // ─── ATTENDANCE-BASIS COMMISSION (opt-in mode) ───────────────────────────
  state.settings = state.settings || {};
  state.settings.commissionBasis = 'attendance';
  // Isolated coaches/members so we don't tangle with earlier payment-mode data.
  state.coaches.push({ id:7, name:'CoachCross', rate:50, fixedSalary:0, active:'Y' });
  state.coaches.push({ id:8, name:'CoachPend',  rate:50, fixedSalary:0, active:'Y' });
  state.coaches.push({ id:9, name:'CoachFlat',  rate:50, fixedSalary:0, active:'Y' });
  // 70: 8-class / 800 Boxing, started 28 Apr, ended 27 May; attended 1 in Apr, 4 in May (3 left).
  state.members.push({ id:70, name:'Cross', phone:'+97455000070', expiryDate:'2026-05-27', status:'Active', coachId:7,
    subscriptions:[{ activity:'Boxing', coachId:7, totalClasses:8, amountPaid:800, start:'2026-04-28', end:'2026-05-27', invoiceNumber:'INVATT' }],
    dailyAttendance:{ '2026-04':{'Boxing':{'28':'Y'}}, '2026-05':{'Boxing':{'2':'Y','9':'Y','16':'Y','23':'Y'}} } });
  // 71: still active, 10-class / 1000, attended 2 in June → 8 pending.
  state.members.push({ id:71, name:'Pend', phone:'+97455000071', expiryDate:'2099-12-31', status:'Active', coachId:8,
    subscriptions:[{ activity:'Boxing', coachId:8, totalClasses:10, amountPaid:1000, start:'2026-06-01', end:'2099-12-31', invoiceNumber:'INVACT' }],
    dailyAttendance:{ '2026-06':{'Boxing':{'2':'Y','9':'Y'}} } });
  // 72: no class count (Football) → must fall back to full fee in payment month.
  state.members.push({ id:72, name:'Flat', phone:'+97455000072', expiryDate:'2026-07-01', status:'Active', coachId:9,
    subscriptions:[{ activity:'Football', coachId:9, totalClasses:null, amountPaid:500, start:'2026-06-01', end:'2026-07-01', invoiceNumber:'INVFB' }], dailyAttendance:{} });
  // 73: Summer Camp → never earns commission.
  state.members.push({ id:73, name:'Camp', phone:'+97455000073', expiryDate:'2026-07-01', status:'Active', coachId:9,
    subscriptions:[{ activity:'Summer Camp', coachId:9, totalClasses:8, amountPaid:600, start:'2026-06-01', end:'2026-07-01', invoiceNumber:'INVCAMP' }], dailyAttendance:{} });
  state.invoices.push({ id:700, ref:'INVATT',  date:'2026-04-28', month:'2026-04', amount:800,  category:'Membership', sport:'Boxing',      coachId:7, customerId:70, lineItems:[{sport:'Boxing',coachId:7,price:800}] });
  state.invoices.push({ id:701, ref:'INVACT',  date:'2026-06-01', month:'2026-06', amount:1000, category:'Membership', sport:'Boxing',      coachId:8, customerId:71, lineItems:[{sport:'Boxing',coachId:8,price:1000}] });
  state.invoices.push({ id:702, ref:'INVFB',   date:'2026-06-01', month:'2026-06', amount:500,  category:'Membership', sport:'Football',    coachId:9, customerId:72, lineItems:[{sport:'Football',coachId:9,price:500}] });
  state.invoices.push({ id:703, ref:'INVCAMP', date:'2026-06-01', month:'2026-06', amount:600,  category:'Membership', sport:'Summer Camp', coachId:9, customerId:73, lineItems:[{sport:'Summer Camp',coachId:9,price:600}] });
  // settlement fixtures: a fixed-salary coach + a payment-basis coach with two June invoices
  state.coaches.push({ id:10, name:'CoachFixed', rate:0, fixedSalary:3000, active:'Y' });
  state.coaches.push({ id:11, name:'CoachPay', rate:100, fixedSalary:0, active:'Y' });
  state.invoices.push({ id:705, ref:'P1', date:'2026-06-01', month:'2026-06', amount:1000, category:'Membership', sport:'Boxing', coachId:11, customerId:0, lineItems:[{sport:'Boxing',coachId:11,price:1000}] });
  state.invoices.push({ id:706, ref:'P2', date:'2026-06-20', month:'2026-06', amount:500,  category:'Membership', sport:'Boxing', coachId:11, customerId:0, lineItems:[{sport:'Boxing',coachId:11,price:500}] });
  // frozen vs expired: identical subs (6 classes / 1200, 2 attended in April, sub ended 15 May)
  state.coaches.push({ id:12, name:'CoachFrozen',  rate:50, fixedSalary:0, active:'Y' });
  state.coaches.push({ id:13, name:'CoachExpired', rate:50, fixedSalary:0, active:'Y' });
  state.members.push({ id:75, name:'Frozen', phone:'+97455000075', expiryDate:'2026-05-15', currentFreezeUntil:'2099-12-31', status:'Frozen', coachId:12,
    subscriptions:[{ activity:'Boxing', coachId:12, totalClasses:6, amountPaid:1200, start:'2026-04-01', end:'2026-05-15', invoiceNumber:'INVFRZ' }],
    dailyAttendance:{ '2026-04':{'Boxing':{'5':'Y','12':'Y'}} } });
  state.members.push({ id:76, name:'Expired', phone:'+97455000076', expiryDate:'2026-05-15', status:'Expired', coachId:13,
    subscriptions:[{ activity:'Boxing', coachId:13, totalClasses:6, amountPaid:1200, start:'2026-04-01', end:'2026-05-15', invoiceNumber:'INVEXP' }],
    dailyAttendance:{ '2026-04':{'Boxing':{'5':'Y','12':'Y'}} } });
  state.invoices.push({ id:707, ref:'INVFRZ', date:'2026-04-01', month:'2026-04', amount:1200, category:'Membership', sport:'Boxing', coachId:12, customerId:75, lineItems:[{sport:'Boxing',coachId:12,price:1200}] });
  state.invoices.push({ id:708, ref:'INVEXP', date:'2026-04-01', month:'2026-04', amount:1200, category:'Membership', sport:'Boxing', coachId:13, customerId:76, lineItems:[{sport:'Boxing',coachId:13,price:1200}] });
  // deleted/archived member must NOT count toward commission
  state.coaches.push({ id:15, name:'CoachDel', rate:100, fixedSalary:0, active:'Y' });
  state.members.push({ id:78, name:'DeletedMem', deleted:true, coachId:15, subscriptions:[{activity:'Boxing',coachId:15,totalClasses:6,amountPaid:500,start:'2026-06-01',end:'2026-07-01',invoiceNumber:'INVDEL'}], dailyAttendance:{} });
  state.members.push({ id:79, name:'LiveMem', coachId:15, subscriptions:[{activity:'Boxing',coachId:15,totalClasses:6,amountPaid:500,start:'2026-06-01',end:'2026-07-01',invoiceNumber:'INVLIVE'}], dailyAttendance:{} });
  state.invoices.push({ id:710, ref:'INVDEL',  date:'2026-06-01', month:'2026-06', amount:500, category:'Membership', sport:'Boxing', coachId:15, customerId:78, lineItems:[{sport:'Boxing',coachId:15,price:500}] });
  state.invoices.push({ id:711, ref:'INVLIVE', date:'2026-06-01', month:'2026-06', amount:500, category:'Membership', sport:'Boxing', coachId:15, customerId:79, lineItems:[{sport:'Boxing',coachId:15,price:500}] });
  // two identical invoices for the same member = a duplicate the finder must catch
  state.members.push({ id:80, name:'DupMem', coachId:16, subscriptions:[], dailyAttendance:{} });
  state.invoices.push({ id:713, ref:'DUP1', date:'2026-06-03', month:'2026-06', amount:450, category:'Membership', sport:'Boxing', coachId:16, customerId:80, lineItems:[{sport:'Boxing',coachId:16,price:450}] });
  state.invoices.push({ id:714, ref:'DUP2', date:'2026-06-03', month:'2026-06', amount:450, category:'Membership', sport:'Boxing', coachId:16, customerId:80, lineItems:[{sport:'Boxing',coachId:16,price:450}] });

  const apr = computeMonthlyPay(7, '2026-04');
  const may = computeMonthlyPay(7, '2026-05');
  eq(Math.round(apr.commissionBase), 100, 'attendance: April = 1 attended class × (800/8)');
  eq(Math.round(may.commissionBase), 700, 'attendance: May = 4 attended + 3 true-up at expiry');
  eq(Math.round(apr.commissionAmount + may.commissionAmount), 400, 'attendance: life total = fee × rate (800×50%) — reconciles');
  const p8 = computeMonthlyPay(8, '2026-06');
  eq(Math.round(p8.commissionBase), 200, 'attendance: active member June = 2 attended × 100');
  eq(Math.round(p8.commissionPendingBase), 800, 'attendance: pending base = 8 remaining classes × 100 (this is the freeze/not-yet-attended case)');
  eq(Math.round(p8.commissionPending), 400, 'attendance: pending amount = 800 × 50%');
  const p9 = computeMonthlyPay(9, '2026-06');
  eq(Math.round(p9.commissionBase), 500, 'attendance: no-class-count falls back to full fee; Summer Camp excluded');
  eq(p9.commissionPendingBase, 0, 'attendance: no pending for flat/camp lines');
  // ── Settlement "up to date" (partial month; lifetime-remaining pending) ──
  const s1 = computeMonthlyPay(7, null, '2026-05-10');
  eq(Math.round(s1.commissionBase), 300, 'settlement cumulative: April(1) + May≤10th(2) = 3 attended × 100');
  eq(Math.round(s1.commissionPendingBase), 500, 'settlement: 5 classes still unattended as of 10 May → pending');
  // The reported "leaving / expiry" scenario: 6-class / 1000 MMA, 2 attended in
  // June, membership ends 02 Jul. Settle to 01 Jul → 100 earned + 200 pending.
  // Settle to 02 Jul (expiry) → full 300, nothing pending.
  state.coaches.push({ id:14, name:'CoachJul', rate:30, fixedSalary:0, active:'Y' });
  state.members.push({ id:77, name:'JulTest', phone:'+97455000077', expiryDate:'2026-07-02', status:'Active', coachId:14,
    subscriptions:[{ activity:'MMA', coachId:14, totalClasses:6, amountPaid:1000, start:'2026-06-02', end:'2026-07-02', invoiceNumber:'INVJUL' }],
    dailyAttendance:{ '2026-06':{'MMA':{'5':'Y','12':'Y'}} } });
  state.invoices.push({ id:709, ref:'INVJUL', date:'2026-06-02', month:'2026-06', amount:1000, category:'Membership', sport:'MMA', coachId:14, customerId:77, lineItems:[{sport:'MMA',coachId:14,price:1000}] });
  const j1 = computeMonthlyPay(14, null, '2026-07-01');
  eq(Math.round(j1.commissionAmount), 100, 'settle 01 Jul: 2 of 6 attended in June = 100 (NOT 0)');
  eq(Math.round(j1.commissionPending), 200, 'settle 01 Jul: 4 remaining classes pending = 200');
  const j2 = computeMonthlyPay(14, null, '2026-07-02');
  eq(Math.round(j2.commissionAmount), 300, 'settle 02 Jul (expiry): full commission = 300');
  eq(j2.commissionPendingBase, 0, 'settle 02 Jul: nothing pending after expiry true-up');
  const sf = computeMonthlyPay(10, null, '2026-06-15');
  eq(sf.fixedFull, 3000, 'settlement: full monthly fixed kept for reference');
  eq(sf.fixed, 1500, 'settlement: fixed prorated 15/30 days = 1500');
  // frozen vs expired (the new rule)
  eq(Math.round(computeMonthlyPay(12, '2026-04').commissionBase), 400, 'frozen: attended classes still paid in their month (2 × 1200/6 = 400)');
  const fz = computeMonthlyPay(12, '2026-05');
  eq(Math.round(fz.commissionBase), 0, 'frozen: NOT trued-up at sub end — no full payout while frozen');
  eq(Math.round(fz.commissionPendingBase), 800, 'frozen: remaining 4 classes stay pending');
  const ex = computeMonthlyPay(13, '2026-05');
  eq(Math.round(ex.commissionBase), 800, 'expired (not frozen): trued-up — remaining 4 paid in full at expiry');
  eq(ex.commissionPendingBase, 0, 'expired: nothing pending after the true-up');
  // restore default so we don't affect any later logic
  state.settings.commissionBasis = 'payment';
  eq(Math.round(computeMonthlyPay(15, '2026-06').commissionBase), 500, 'deleted/archived member excluded from commission (payment): only the live member counts');
  state.settings.commissionBasis = 'attendance';
  eq(Math.round(computeMonthlyPay(15, '2026-06').commissionPendingBase), 500, 'deleted/archived member excluded (attendance): only live member contributes pending');
  state.settings.commissionBasis = 'payment';
  const dupGroups = detectDuplicateInvoices();
  ok(dupGroups.some(g => g.length === 2 && g.every(r => r.inv.customerId === 80)), 'dup finder: flags the two identical invoices for member 80');
  ok(!dupGroups.some(g => g.some(r => r.inv.id === 705) && g.some(r => r.inv.id === 706)), 'dup finder: same member but different amounts are NOT flagged');
  ok(findDuplicateInvoiceOf(80, 'Boxing', '2026-06', 450, null), 'pre-save guard: detects an existing matching invoice');
  ok(!findDuplicateInvoiceOf(80, 'Boxing', '2026-06', 999, null), 'pre-save guard: different amount is not a match');
  ok(!findDuplicateInvoiceOf(80, 'MMA', '2026-06', 450, null), 'pre-save guard: different sport is not a match');
  ok(!findDuplicateInvoiceOf(null, 'Boxing', '2026-06', 450, null), 'pre-save guard: walk-in (no member) is never blocked');
  // payment basis must honour the settlement date cap on invoice dates
  const pd1 = computeMonthlyPay(11, null, '2026-06-15');
  eq(Math.round(pd1.commissionBase), 1000, 'settlement(payment): 01-Jun invoice counts, 20-Jun excluded at 15-Jun cutoff');
  const pd2 = computeMonthlyPay(11, null, '2026-06-25');
  eq(Math.round(pd2.commissionBase), 1500, 'settlement(payment): both June invoices count at 25-Jun cutoff');
  // sanity: 2-arg calls unchanged by the new optional param
  eq(Math.round(computeMonthlyPay(11, '2026-06').commissionBase), 1500, 'monthly (no date) still sums the whole month');

  // ── Enrollment scenarios: duplicate sports, mistake-delete, per-sport start ──
  ok(duplicateEnrollmentSport([{ sport: 'Boxing' }, { sport: 'MMA' }, { sport: 'Boxing' }]) === 'Boxing', 'enroll: duplicate sport is detected (blocks add + edit)');
  ok(duplicateEnrollmentSport([{ sport: 'Boxing' }, { sport: 'MMA' }]) === null, 'enroll: distinct sports are allowed');
  eq(enrollmentStartDate({ start: '2026-07-10' }, { startDate: '2026-05-01' }), '2026-07-10', 'enroll: per-sport start date overrides the member start');
  eq(enrollmentStartDate({}, { startDate: '2026-05-01' }), '2026-05-01', 'enroll: with no per-sport date it inherits the member start');
  // mistake-delete: combined invoice keeps the other sport; single-sport invoice is removed
  state.members.push({ id: 90, name: 'CombMem', enrollments: [{ sport: 'Boxing', coachId: 99 }, { sport: 'MMA', coachId: 99 }],
    subscriptions: [{ activity: 'Boxing', end: '2026-08-01', invoiceNumber: 'C1' }, { activity: 'MMA', end: '2026-09-01', invoiceNumber: 'C1' }], expiryDate: '2026-09-01' });
  state.invoices.push({ id: 900, ref: 'C1', date: '2026-06-01', month: '2026-06', amount: 800, category: 'Membership', customerId: 90, sport: 'Boxing, MMA', lineItems: [{ sport: 'Boxing', coachId: 99, price: 300 }, { sport: 'MMA', coachId: 99, price: 500 }] });
  state.members.push({ id: 91, name: 'SoloMem', enrollments: [{ sport: 'Karate', coachId: 99 }], subscriptions: [{ activity: 'Karate', end: '2026-07-01', invoiceNumber: 'K1' }], expiryDate: '2026-07-01' });
  state.invoices.push({ id: 901, ref: 'K1', date: '2026-06-01', month: '2026-06', amount: 400, category: 'Membership', customerId: 91, sport: 'Karate' });
  const comb = state.members.find(x => x.id === 90);
  removeEnrollmentData(comb, 'MMA');
  eq(comb.enrollments.length, 1, 'mistake-delete: enrollment removed (combined invoice case)');
  ok(comb.enrollments[0].sport === 'Boxing', 'mistake-delete: the other sport is kept');
  eq(comb.subscriptions.length, 1, 'mistake-delete: matching subscription removed');
  const inv900 = state.invoices.find(i => i.id === 900);
  ok(inv900 && inv900.lineItems.length === 1 && Math.round(inv900.amount) === 300, 'mistake-delete: combined invoice kept, amount reduced to the remaining sport');
  eq(comb.expiryDate, '2026-08-01', 'mistake-delete: member expiry recomputed to the remaining sport');
  const solo = state.members.find(x => x.id === 91);
  removeEnrollmentData(solo, 'Karate');
  ok(!state.invoices.find(i => i.id === 901), 'mistake-delete: single-sport invoice fully removed');
  eq(solo.enrollments.length, 0, 'mistake-delete: last enrollment removed cleanly');
  ok(duplicateEnrollmentSport([{ sport: 'Summer Camp' }, { sport: 'Summer Camp' }]) === 'Summer Camp', 'enroll: duplicate Summer Camp also blocked');
  ok(duplicateEnrollmentSport([{ sport: 'Summer Camp' }, { sport: 'Boxing' }]) === null, 'enroll: Summer Camp + another sport is allowed');
  eq(enrollmentStartDate({}, null), TODAY, 'enroll: no member context → defaults to today');
  // unpaid enrollment (no invoice) removal + other members must stay untouched
  state.members.push({ id: 92, name: 'UnpaidMem', enrollments: [{ sport: 'Boxing', coachId: 99 }, { sport: 'Karate', coachId: 99 }], subscriptions: [{ activity: 'Boxing', end: '2026-08-01' }, { activity: 'Karate', end: '2026-09-01' }], expiryDate: '2026-09-01' });
  state.members.push({ id: 93, name: 'OtherMem', enrollments: [{ sport: 'Boxing', coachId: 99 }], subscriptions: [{ activity: 'Boxing', end: '2026-08-01', invoiceNumber: 'O1' }] });
  state.invoices.push({ id: 930, ref: 'O1', date: '2026-06-01', month: '2026-06', amount: 300, category: 'Membership', customerId: 93, sport: 'Boxing' });
  const unpaid = state.members.find(x => x.id === 92);
  removeEnrollmentData(unpaid, 'Boxing');
  eq(unpaid.enrollments.length, 1, 'mistake-delete: unpaid enrollment (no invoice) removed fine');
  ok(unpaid.subscriptions.length === 1 && unpaid.subscriptions[0].activity === 'Karate', 'mistake-delete: unpaid sub removed, the other kept');
  ok(state.invoices.find(i => i.id === 930), "mistake-delete: another member's invoice is NOT touched");
  removeEnrollmentData(unpaid, 'MMA');
  eq(unpaid.enrollments.length, 1, 'mistake-delete: removing a sport the member does not have is a safe no-op');

  // ── Per-sport start + validity → derived member dates ──
  const dm = deriveMemberDates([
    { sport: 'Boxing', start: '2026-05-01', validity: 30 },   // ends 2026-05-31
    { sport: 'MMA',    start: '2026-06-04', validity: 60 },   // ends 2026-08-03 (latest)
  ], null);
  eq(dm.startDate, '2026-05-01', 'derive: member start = earliest sport start');
  eq(dm.expiryDate, '2026-08-03', 'derive: member expiry = latest sport end (start + own validity)');
  eq(dm.firstRegistration, '2026-05-01', 'derive: blank first-registration falls back to earliest sport start');
  const dm2 = deriveMemberDates([{ sport: 'Karate', start: '2026-06-01', validity: 30 }], '2026-01-15');
  eq(dm2.firstRegistration, '2026-01-15', 'derive: entered first-registration is kept');
  eq(dm2.expiryDate, '2026-07-01', 'derive: single sport expiry = its start + its validity');
  // each sport keeps an independent validity (not one shared number)
  const dm3 = deriveMemberDates([
    { sport: 'Boxing', start: '2026-06-01', validity: 30 },
    { sport: 'MMA',    start: '2026-06-01', validity: 90 },
  ], null);
  eq(dm3.expiryDate, '2026-08-30', 'derive: differing per-sport validity respected (90d wins over 30d)');
  eq(daysBetween('2026-05-01', '2026-07-15'), 75, 'daysBetween: counts whole days');
  // legacy sub (has start/end, no stored validity) → inferred validity must rebuild the SAME end
  const legStart = '2026-05-01', legEnd = '2026-07-15';
  eq(addDays(legStart, daysBetween(legStart, legEnd)), legEnd, 'legacy: inferred validity rebuilds the original end (no date mangling on edit)');

  // ── Coach change on an existing sport UPDATES the sub (no duplicate) + re-attributes the invoice line ──
  const ccSub = { activity: 'Boxing', coachId: 7, coach: coachName(7), invoiceNumber: 'CC1', start: '2026-06-01', validity: 30, end: '2026-07-01', totalClasses: 8, amountPaid: 300 };
  const ccInv = { id: 950, ref: 'CC1', category: 'Membership', coachId: 7, coach: coachName(7), lineItems: [{ sport: 'Boxing', coachId: 7, coach: coachName(7), price: 300 }] };
  syncSubToEnrollment(ccSub, { sport: 'Boxing', coachId: 8, classes: 10, price: 300, start: '2026-06-01', validity: 30 }, { startDate: '2026-06-01' }, [ccInv]);
  eq(ccSub.coachId, 8, 'coach-change: existing subscription is updated to the new coach (not duplicated)');
  eq(ccSub.totalClasses, 10, 'coach-change: classes synced onto the existing sub');
  eq(ccInv.lineItems[0].coachId, 8, 'coach-change: invoice line re-attributed to the new coach (commission follows)');
  eq(ccInv.coachId, 8, 'coach-change: invoice top-level coach re-attributed');

  // ── Backup round-trip preserves data + the new per-sport sub fields ──
  const rt = JSON.parse(JSON.stringify({ activity: 'Boxing', start: '2026-06-01', validity: 45, end: '2026-07-16' }));
  ok(rt.start === '2026-06-01' && rt.validity === 45 && rt.end === '2026-07-16', 'backup: per-sport start/validity/end survive a JSON round-trip');
  const imp = JSON.parse(JSON.stringify({ appVersion: 'x', members: state.members, invoices: state.invoices }));
  ok(imp.members.length === state.members.length && imp.invoices.length === state.invoices.length, 'backup: members + invoices survive export→restore');

  // ── Partial payments (cash-basis revenue, full-fee commission) ──
  const pinv = { id: 960, ref: 'P1', amount: 650, month: '2026-06', date: '2026-06-01', category: 'Membership', customerId: 96, amountPaid: 300, payments: [{ date: '2026-06-01', month: '2026-06', amount: 300, method: 'cash' }] };
  eq(invoicePaid(pinv), 300, 'partial: collected so far = 300');
  eq(invoiceBalance(pinv), 350, 'partial: balance = 650 − 300 = 350');
  eq(invoiceStatus(pinv), 'Partial', 'partial: status is Partial');
  eq(cashInMonth(pinv, '2026-06'), 300, 'partial: June revenue counts only the 300 collected (cash basis)');
  recordInvoicePayment(pinv, 350, { date: '2026-07-05', method: 'cash' });   // settle the rest in July
  eq(invoiceBalance(pinv), 0, 'partial: balance cleared after the 2nd payment');
  eq(invoiceStatus(pinv), 'Paid', 'partial: status becomes Paid once settled');
  eq(cashInMonth(pinv, '2026-06'), 300, 'partial: June still 300 (each payment lands in its own month)');
  eq(cashInMonth(pinv, '2026-07'), 350, 'partial: the 350 settlement is revenue in July');
  const linv = { id: 961, amount: 400, month: '2026-05' };   // legacy invoice (no amountPaid)
  eq(invoicePaid(linv), 400, 'legacy: an invoice with no amountPaid is treated as fully paid');
  eq(invoiceStatus(linv), 'Paid', 'legacy: status Paid (no false "unpaid")');
  state.members.push({ id: 96, name: 'PartMem' });
  state.invoices.push(pinv);
  state.invoices.push({ id: 962, amount: 500, category: 'Membership', customerId: 96, amountPaid: 200 });
  eq(Math.round(memberOutstanding(96)), 300, 'partial: member outstanding = sum of balances (0 + 300)');
  // deposit taken at enrollment: part paid now, rest due
  var depTotal = 1000, depPaid = Math.max(0, Math.min(300, depTotal));
  var depInv = { id: 970, amount: depTotal, category: 'Membership', customerId: 97, amountPaid: depPaid, payments: [{ month: '2026-06', amount: depPaid }] };
  eq(invoiceBalance(depInv), 700, 'deposit: 300 paid on a 1000 invoice leaves 700 due');
  eq(invoiceStatus(depInv), 'Partial', 'deposit: status is Partial');
  eq(cashInMonth(depInv, '2026-06'), 300, 'deposit: only the 300 deposit counts as revenue');
  eq(Math.max(0, Math.min(1500, depTotal)), 1000, 'deposit: a deposit above the total is clamped to the total');
  // correcting a wrongly-entered paid amount via Edit Invoice
  var fixInv = { id: 980, amount: 2400, date: '2026-06-14', month: '2026-06', amountPaid: 2400, payments: [{ month: '2026-06', amount: 2400 }] };
  fixInv.amountPaid = 1000;
  fixInv.payments = [{ date: '2026-06-14', month: '2026-06', amount: 1000, method: 'cash' }];
  eq(invoiceBalance(fixInv), 1400, 'edit-invoice: correcting paid to 1000 on a 2400 total leaves 1400 due');
  eq(invoiceStatus(fixInv), 'Partial', 'edit-invoice: corrected invoice becomes Partial');
  eq(cashInMonth(fixInv, '2026-06'), 1000, 'edit-invoice: revenue reflects the corrected 1000');

  // ── Qatar ID OCR parsing (the field extraction, not the image->text step) ──
  var NL = String.fromCharCode(10);
  var idText = ['State Of Qatar','Residency Permit','ID.No: 32176000771','D.O.B: 28/10/2021','Expiry: 13/02/2027','Nationality: SYRIA','Occupation:','Name: ALEEN OSAMA ALAWAD','الإسم: الين اسامه العوض','الجنسية: سورية','Passport Number: N015239024','Passport Expiry: 31/01/2028','Serial No: 30432176000771'].join(NL);
  var idp = parseQatarId(idText);
  eq(idp.qid, '32176000771', 'QID: reads the 11-digit ID not the 14-digit serial');
  eq(idp.birthdate, '2021-10-28', 'QID: birthdate from the D.O.B line not Expiry');
  eq(idp.nameEn, 'Aleen Osama Alawad', 'QID: English name title-cased');
  eq(idp.nameAr, 'الين اسامه العوض', 'QID: Arabic name read from the label line');
  eq(idp.nationality, 'Syria', 'QID: nationality from the Nationality line');
  var emptyId = parseQatarId('totally unrelated text with no id fields');
  ok(emptyId.qid === null && emptyId.birthdate === null && emptyId.nameEn === null, 'QID: returns nulls when nothing matches');
  var noLabel = parseQatarId(['32176000771','28/10/2021','13/02/2027'].join(NL));
  eq(noLabel.birthdate, '2021-10-28', 'QID: with no label, picks the earliest past date as birthdate');

  // ── Phone search: ignore spaces + country code, match partials ──
  ok(phoneSearchMatches('66995549', '97466995549'),       'phone search: paste +974… finds national-only stored');
  ok(phoneSearchMatches('6699 5549', '97466995549'),      'phone search: spaces in stored ignored');
  ok(phoneSearchMatches('+974 6699 5549', '97466995549'), 'phone search: full vs full');
  ok(phoneSearchMatches('+974 6699 5549', '66995549'),    'phone search: type national finds +974 stored');
  ok(phoneSearchMatches('66995549', '6699'),              'phone search: partial fragment matches');
  ok(!phoneSearchMatches('66995549', '1234'),             'phone search: unrelated digits do NOT match');
  ok(phonesMatch('+974 6699 5549', '66995549'),           'dup detect: +974 vs national match');
  ok(phonesMatch('6699 5549', '66995549'),                'dup detect: spaces ignored');

  // ── Bilingual renewal reminder (Arabic first, always both languages) ──
  const remMember = { name: 'Test EN', expiryDate: '2026-06-30', enrollments: [{ sport: 'Boxing' }] };
  const remMsg = buildReminderMessage(remMember, 'expiring', 2);
  ok(remMsg.includes('Black Stars Sports Club'), 'reminder: includes English block');
  ok(remMsg.includes('نادي بلاك ستارز الرياضي'), 'reminder: includes Arabic block even without an Arabic name');
  ok(remMsg.indexOf('مرحبا') < remMsg.indexOf('Hi Test EN'), 'reminder: Arabic comes before English');
  ok(remMsg.includes('💪') || remMsg.includes('🥋'), 'reminder: contains motivational emoji');

  console.log('\\n================ TEST RESULTS ================');
  console.log('PASS: ' + pass + '   FAIL: ' + fail);
  if (fails.length) { console.log('\\nFAILURES:'); fails.forEach(f=>console.log('  ✗ ' + f)); }
  else console.log('All assertions passed ✅');
  console.log('=============================================');
})();
`;

const combined = appSrc + '\n;\n' + pagesSrc + '\n;\n' + epilogue;
try {
  vm.runInContext(combined, ctx, { filename: 'combined.js' });
} catch (e) {
  console.error('HARNESS ERROR:', e && e.stack ? e.stack.split('\n').slice(0,5).join('\n') : e);
  process.exit(1);
}
