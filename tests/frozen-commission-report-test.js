// Regression test for the FROZEN commission rule in the Member Commission report
// (computeMemberCommissions → lineCommissionEligibility).
//
// Club rule (interpretation B, confirmed by the user):
//   • FROZEN member → the coach earns ONLY the classes actually attended
//     (pro-rated attended ÷ total). The remaining/deferred portion is withheld
//     until the member returns, or the freeze ends and they expire.
//   • The old bug: a frozen membership with NO class plan (total unknown) fell into
//     the "nothing to pro-rate → full fee" branch and paid the coach the WHOLE fee
//     (this is what showed 353 / 338 for the frozen Almarri rows). A paused flat
//     membership must earn 0 until it resolves.
//   • Active members are unchanged (pro-rate by attendance; flat active = full fee).
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const appSrc = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function fakeEl() {
  const e = { style:{}, dataset:{}, children:[], classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    setAttribute(){}, getAttribute(){return null;}, appendChild(c){return c;}, addEventListener(){}, querySelector(){return null;}, querySelectorAll(){return [];} };
  Object.defineProperty(e,'innerHTML',{get(){return '';},set(){}}); return e;
}
const ctx = {
  console, setTimeout:()=>0, clearTimeout:()=>{}, setInterval:()=>0, clearInterval:()=>{}, requestAnimationFrame:()=>0,
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}}, sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  navigator:{userAgent:'node'}, location:{href:'file:///index.html',reload(){}},
  document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>fakeEl(),addEventListener(){},body:fakeEl(),head:fakeEl(),documentElement:fakeEl()},
  alert:()=>{}, confirm:()=>true, prompt:()=>null, matchMedia:()=>({matches:false,addEventListener(){}}),
};
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.window.addEventListener = () => {};
vm.createContext(ctx);

const att = (days) => { const o = {}; for (const d of days) o[String(d)] = 'Y'; return o; };

const testCode = `
state = {
  user: { name: 'Admin' },
  settings: { commissionBasis: 'attendance', commissionStartDate: '' },
  coaches: [ { id: 2, name: 'CoachB', rate: 50, fixedSalary: 0, active: 'Y' } ],
  members: [
    // FROZEN, class-based: attended 2 of 6, fee 1200 → report base = 2/6 x 1200 = 400 (NOT 1200).
    { id: 20, name: 'Frozen-Class', status: 'Frozen', currentFreezeUntil: '2099-01-01', expiryDate: '2099-12-31', coachId: 2,
      subscriptions: [ { activity:'A', coachId:2, totalClasses:6, invoiceNumber:'INVF1', start:'2026-06-01', end:'2026-06-30' } ],
      dailyAttendance: { '2026-06': { 'A': ${JSON.stringify(att([1,2]))} } } },
    // FROZEN, FLAT (no class plan): fee 1000 → report base = 0 (the circled bug used to pay full).
    { id: 21, name: 'Frozen-Flat', status: 'Frozen', currentFreezeUntil: '2099-01-01', expiryDate: '2099-12-31', coachId: 2,
      subscriptions: [ { activity:'B', coachId:2, totalClasses:0, invoiceNumber:'INVF2', start:'2026-06-01', end:'2026-06-30' } ],
      dailyAttendance: {} },
    // CONTROL — ACTIVE class-based: attended 3 of 6, fee 600 → 300 (unchanged pro-rate).
    { id: 22, name: 'Active-Class', status: 'Active', expiryDate: '2099-12-31', coachId: 2,
      subscriptions: [ { activity:'C', coachId:2, totalClasses:6, invoiceNumber:'INVA', start:'2026-06-01', end:'2026-06-30' } ],
      dailyAttendance: { '2026-06': { 'C': ${JSON.stringify(att([1,2,3]))} } } },
  ],
  invoices: [
    { id: 1, ref:'INVF1', date:'2026-06-05', month:'2026-06', amount:1200, amountPaid:1200, customerId:20, category:'Membership',
      lineItems: [ { sport:'A', coachId:2, classes:6, price:1200 } ], payments: [] },
    { id: 2, ref:'INVF2', date:'2026-06-05', month:'2026-06', amount:1000, amountPaid:1000, customerId:21, category:'Membership',
      lineItems: [ { sport:'B', coachId:2, price:1000 } ], payments: [] },
    { id: 3, ref:'INVA', date:'2026-06-05', month:'2026-06', amount:600, amountPaid:600, customerId:22, category:'Membership',
      lineItems: [ { sport:'C', coachId:2, classes:6, price:600 } ], payments: [] },
  ],
  expenses: [], salaries: [], sales: [], trials: [], rentals: [], rentalCustomers: [], schedule: [], swimGroups: [], advices: [],
  families: [], products: [], drivers: [], cashCounts: [], notes: [], membershipTransfers: [], posts: [], auditLog: [],
};

let pass = 0, fail = 0;
function ok(c, label){ if (c) pass++; else { fail++; console.log('  \\u2717 ' + label); } }
function near(a, b){ return Math.abs((a||0) - (b||0)) < 0.5; }

const rows = computeMemberCommissions('2026-06');
const rFrozen = rows.find(r => r.memberId === 20);
const rFlat   = rows.find(r => r.memberId === 21);
const rActive = rows.find(r => r.memberId === 22);

// 1) Frozen class-based → pro-rated by attendance, NOT full.
ok(rFrozen && near(rFrozen.commissionBase, 400), 'frozen class-based: 2/6 x 1200 = 400, NOT full 1200  (got ' + (rFrozen && rFrozen.commissionBase) + ')');
ok(rFrozen && rFrozen.mode === 'frozen', 'frozen row tagged mode=frozen');
ok(rFrozen && near(rFrozen.commission, 200), 'frozen commission = 400 x 50% = 200  (got ' + (rFrozen && rFrozen.commission) + ')');

// 2) Frozen FLAT (no class plan) → 0, not full fee (the circled bug).
ok(rFlat && near(rFlat.commissionBase, 0), 'frozen flat (no class plan): 0, not full 1000  (got ' + (rFlat && rFlat.commissionBase) + ')');

// 3) Active control unchanged.
ok(rActive && near(rActive.commissionBase, 300), 'active control: 3/6 x 600 = 300  (got ' + (rActive && rActive.commissionBase) + ')');

globalThis.__pass = pass; globalThis.__fail = fail;
`;

vm.runInContext(appSrc + '\n' + testCode, ctx, { filename: 'frozen-report.js' });
console.log('\n===== FROZEN COMMISSION REPORT RESULTS =====');
console.log('PASS: ' + ctx.__pass + '   FAIL: ' + ctx.__fail);
console.log('============================================');
process.exit(ctx.__fail ? 1 : 0);
