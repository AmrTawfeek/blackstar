// Regression test: "Settle pending commission in full" (admin pays a coach's whole
// salary this month, incl. the not-yet-attended remainder, and it does NOT carry
// forward). Marking sub.commissionSettled = month must:
//   • zero the PENDING for that month and every month after,
//   • earn the coach nothing further after the settled month,
//   • never true-up at expiry (already paid).
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
    // Active member, Karate 8 classes, attended 2 in June, membership runs far into the future.
    { id: 30, name: 'M-Active', status: 'Active', expiryDate: '2099-12-31', coachId: 2,
      subscriptions: [ { activity:'Karate', coachId:2, totalClasses:8, invoiceNumber:'INVK', start:'2026-06-01', end:'2099-12-31' } ],
      dailyAttendance: { '2026-06': { 'Karate': ${JSON.stringify(att([1,2]))} } } },
  ],
  invoices: [
    { id: 1, ref:'INVK', date:'2026-06-01', month:'2026-06', amount:800, amountPaid:800, customerId:30, category:'Membership',
      lineItems: [ { sport:'Karate', coachId:2, classes:8, price:800 } ], payments: [] },
  ],
  expenses: [], salaries: [], sales: [], trials: [], rentals: [], rentalCustomers: [], schedule: [], swimGroups: [], advices: [],
  families: [], products: [], drivers: [], cashCounts: [], notes: [], membershipTransfers: [], posts: [], auditLog: [],
};

let pass = 0, fail = 0;
function ok(c, label){ if (c) pass++; else { fail++; console.log('  \\u2717 ' + label); } }
function near(a, b){ return Math.abs((a||0) - (b||0)) < 0.5; }

// perClass = 800/8 = 100. Attended 2 → base 200. Remaining 6 → pending 600.
const jun = computeMonthlyPay(2, '2026-06');
ok(near(jun.commissionBase, 200),        'before settle: June earned = 2 x 100 = 200  (got ' + jun.commissionBase + ')');
ok(near(jun.commissionPendingBase, 600), 'before settle: June pending = 6 x 100 = 600  (got ' + jun.commissionPendingBase + ')');

// Admin settles the pending in full as of June.
const n = settleCoachPendingCommission(2, '2026-06');
ok(n === 1, 'settle marked exactly 1 active membership  (got ' + n + ')');

// After settle: June still shows the attended 200, but pending is now 0 (paid out).
const jun2 = computeMonthlyPay(2, '2026-06');
ok(near(jun2.commissionBase, 200),      'after settle: June earned still 200 (attended)  (got ' + jun2.commissionBase + ')');
ok(near(jun2.commissionPendingBase, 0), 'after settle: June pending = 0 (settled)  (got ' + jun2.commissionPendingBase + ')');

// Next month earns the coach NOTHING for this membership, and nothing pends.
const jul = computeMonthlyPay(2, '2026-07');
ok(near(jul.commissionBase, 0),        'after settle: July earned = 0 (not carried forward)  (got ' + jul.commissionBase + ')');
ok(near(jul.commissionPendingBase, 0), 'after settle: July pending = 0  (got ' + jul.commissionPendingBase + ')');

// Even if the membership later EXPIRES, there is NO true-up (already paid).
state.members[0].subscriptions[0].end = '2026-06-30';   // now ended
state.members[0].expiryDate = '2026-06-30';
const junE = computeMonthlyPay(2, '2026-06');
ok(near(junE.commissionBase, 200), 'expiry after settle: NO true-up — base stays 200 (not 800)  (got ' + junE.commissionBase + ')');

globalThis.__pass = pass; globalThis.__fail = fail;
`;

vm.runInContext(appSrc + '\n' + testCode, ctx, { filename: 'settle-pending.js' });
console.log('\n===== SETTLE PENDING COMMISSION RESULTS =====');
console.log('PASS: ' + ctx.__pass + '   FAIL: ' + ctx.__fail);
console.log('=============================================');
process.exit(ctx.__fail ? 1 : 0);
