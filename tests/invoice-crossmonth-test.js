// Regression test for the cross-month invoicing fixes (#1 + #2):
//   • A sport added in a LATER month carries its own billMonth → its REVENUE and
//     its COACH COMMISSION both land in that later month (not the invoice's month).
//   • Single-month invoices are completely unchanged.
// Loads the REAL app.js in a vm (its revenue/commission functions are the subject).
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

// Fully-attended Y marks for a sport/month so commission lines are eligible (active member).
const att = (n) => { const o = {}; for (let d = 1; d <= n; d++) o[String(d)] = 'Y'; return o; };

const testCode = `
state = {
  user: { name: 'Admin' },
  settings: { commissionBasis: 'payment', commissionStartDate: '' },
  coaches: [
    { id: 2, name: 'CoachB', rate: 30, fixedSalary: 0, active: 'Y' },
    { id: 3, name: 'CoachC', rate: 30, fixedSalary: 0, active: 'Y' },
  ],
  members: [
    { id: 10, name: 'M-AddSport', status: 'Active', expiryDate: '2099-12-31', coachId: 2,
      enrollments: [ { sport:'A', coachId:2, classes:8, price:400 }, { sport:'B', coachId:2, classes:8, price:600 } ],
      subscriptions: [
        { activity:'A', coachId:2, totalClasses:8, attendedClasses:8, start:'2026-06-01', end:'2026-06-30', invoiceNumber:'INV1' },
        { activity:'B', coachId:2, totalClasses:8, attendedClasses:8, start:'2026-07-01', end:'2026-07-31', invoiceNumber:'INV1' },
      ],
      dailyAttendance: { '2026-06': { 'A': ${JSON.stringify(att(8))} }, '2026-07': { 'B': ${JSON.stringify(att(8))} } } },
    { id: 11, name: 'M-Control', status: 'Active', expiryDate: '2099-12-31', coachId: 3,
      enrollments: [ { sport:'C', coachId:3, classes:8, price:500 } ],
      subscriptions: [ { activity:'C', coachId:3, totalClasses:8, attendedClasses:8, start:'2026-06-01', end:'2026-06-30', invoiceNumber:'INV2' } ],
      dailyAttendance: { '2026-06': { 'C': ${JSON.stringify(att(8))} } } },
  ],
  invoices: [
    // ONE invoice, sport A billed June, sport B ADDED in July (carries billMonth).
    { id: 1, ref:'INV1', date:'2026-06-15', month:'2026-06', amount:1000, amountPaid:1000, customerId:10, category:'Membership',
      payments: [ {date:'2026-06-15',month:'2026-06',amount:400,method:'cash'}, {date:'2026-07-03',month:'2026-07',amount:600,method:'cash'} ],
      lineItems: [ { sport:'A', coachId:2, classes:8, price:400 }, { sport:'B', coachId:2, classes:8, price:600, billMonth:'2026-07' } ] },
    // CONTROL: a plain single-month invoice (no billMonth) — must be unaffected.
    { id: 2, ref:'INV2', date:'2026-06-10', month:'2026-06', amount:500, amountPaid:500, customerId:11, category:'Membership',
      payments: [ {date:'2026-06-10',month:'2026-06',amount:500,method:'cash'} ],
      lineItems: [ { sport:'C', coachId:3, classes:8, price:500 } ] },
  ],
  expenses: [], salaries: [], sales: [], trials: [], rentals: [], schedule: [], swimGroups: [], advices: [],
  families: [], products: [], drivers: [], cashCounts: [], notes: [], membershipTransfers: [], posts: [], auditLog: [],
};

let pass = 0, fail = 0;
function ok(c, label){ if (c) pass++; else { fail++; console.log('  \\u2717 ' + label); } }
function near(a, b){ return Math.abs((a||0) - (b||0)) < 0.5; }

// 1) REVENUE splits across months by line billMonth.
ok(near(billedInMonth('2026-06'), 400 + 500), 'billed June = 400 (A) + 500 (control) = 900  (got ' + billedInMonth('2026-06') + ')');
ok(near(billedInMonth('2026-07'), 600),       'billed July = 600 (B added in July)  (got ' + billedInMonth('2026-07') + ')');

// 2) COMMISSION (payment basis) follows the sport's month — the core fix.
const jun2 = computeMonthlyPay(2, '2026-06');
const jul2 = computeMonthlyPay(2, '2026-07');
ok(near(jun2.commissionBase, 400), 'CoachB June commission base = 400 (sport A only)  (got ' + jun2.commissionBase + ')');
ok(near(jul2.commissionBase, 600), 'CoachB July commission base = 600 (sport B, added in July)  (got ' + jul2.commissionBase + ')');

// 3) Member-commission report rows carry the per-line month.
const repJun = computeMemberCommissions('2026-06').filter(r => r.coachId === 2);
const repJul = computeMemberCommissions('2026-07').filter(r => r.coachId === 2);
ok(repJun.length === 1 && repJun[0].sport === 'A' && repJun[0].month === '2026-06', 'report June row = sport A @ 2026-06');
ok(repJul.length === 1 && repJul[0].sport === 'B' && repJul[0].month === '2026-07', 'report July row = sport B @ 2026-07');

// 4) CONTROL: single-month invoice unchanged — all in June, nothing leaks to July.
const jun3 = computeMonthlyPay(3, '2026-06');
const jul3 = computeMonthlyPay(3, '2026-07');
ok(near(jun3.commissionBase, 500), 'Control CoachC June base = 500  (got ' + jun3.commissionBase + ')');
ok(near(jul3.commissionBase, 0),   'Control CoachC July base = 0 (no cross-month leak)  (got ' + jul3.commissionBase + ')');

globalThis.__pass = pass; globalThis.__fail = fail;
`;

vm.runInContext(appSrc + '\n' + testCode, ctx, { filename: 'crossmonth.js' });
console.log('\\n========= INVOICE CROSS-MONTH RESULTS =========');
console.log('PASS: ' + ctx.__pass + '   FAIL: ' + ctx.__fail);
console.log('===============================================');
process.exit(ctx.__fail ? 1 : 0);
