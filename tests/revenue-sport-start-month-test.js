// Regression test: REVENUE is recognized in each SPORT's START month (club policy,
// confirmed 2026-07-01). A member with June sports + a July Summer Camp on ONE
// invoice has that revenue split June vs July, and the invoice appears under BOTH
// months. Payment dates are stored on the ledger but do NOT move revenue.
// COMMISSION stays on the invoice month (lineBillMonth), unchanged.
//
// Models Zaid Mohamad Alatrash's invoice: Kick Boxing (starts 10 Jun) + Swimming
// (starts 8 Jun) = 750 in June; Summer Camp (starts 4 Jul) = 1500 in July.
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

const testCode = `
state = {
  user: { name: 'Admin' },
  settings: { commissionBasis: 'attendance', commissionStartDate: '' },
  coaches: [ { id: 2, name: 'Aya', rate: 30, fixedSalary: 0, active: 'Y' } ],
  members: [
    { id: 30, name: 'Zaid', status: 'Active', expiryDate: '2099-12-31',
      subscriptions: [
        { activity:'Kick Boxing', coachId:2, totalClasses:8, invoiceNumber:'INVZ', start:'2026-06-10', end:'2026-08-09' },
        { activity:'Swimming',    coachId:2, totalClasses:8, invoiceNumber:'INVZ', start:'2026-06-08', end:'2026-08-07' },
        { activity:'Summer Camp',        totalClasses:0, invoiceNumber:'INVZ', start:'2026-07-04', end:'2026-08-03' },
      ],
      dailyAttendance: {} },
  ],
  invoices: [
    // ONE invoice issued in June; amount is the correct line-sum (2250).
    { id: 1, ref:'INVZ', date:'2026-06-07', month:'2026-06', amount:2250, amountPaid:750, customerId:30, category:'Membership',
      lineItems: [
        { sport:'Kick Boxing', coachId:2, price:375 },
        { sport:'Swimming',    coachId:2, price:375 },
        { sport:'Summer Camp',        price:1500 },
      ],
      payments: [ {date:'2026-06-07', month:'2026-06', amount:750, method:'card'} ] },
  ],
  expenses: [], salaries: [], sales: [], trials: [], rentals: [], rentalCustomers: [], schedule: [], swimGroups: [], advices: [],
  families: [], products: [], drivers: [], cashCounts: [], notes: [], membershipTransfers: [], posts: [], auditLog: [],
};

let pass = 0, fail = 0;
function ok(c, label){ if (c) pass++; else { fail++; console.log('  \\u2717 ' + label); } }
function near(a, b){ return Math.abs((a||0) - (b||0)) < 0.5; }

const inv = state.invoices[0];

// 1) REVENUE splits by each sport's START month.
ok(near(billedInMonth('2026-06'), 750),  'revenue June = Kick Boxing 375 + Swimming 375 = 750  (got ' + billedInMonth('2026-06') + ')');
ok(near(billedInMonth('2026-07'), 1500), 'revenue July = Summer Camp 1500 (starts 4 Jul)  (got ' + billedInMonth('2026-07') + ')');

// 2) The SAME invoice appears under BOTH months.
ok(invoiceTouchesMonth(inv, '2026-06') === true, 'invoice appears under June');
ok(invoiceTouchesMonth(inv, '2026-07') === true, 'invoice appears under July');

// 3) Per-line revenue month follows the sport start; commission month stays the invoice month.
const campLine = inv.lineItems.find(l => l.sport === 'Summer Camp');
const kbLine   = inv.lineItems.find(l => l.sport === 'Kick Boxing');
ok(lineRevenueMonth(campLine, inv) === '2026-07', 'Summer Camp revenue month = July (its start)');
ok(lineRevenueMonth(kbLine, inv)   === '2026-06', 'Kick Boxing revenue month = June (its start)');
ok(lineBillMonth(campLine, inv)    === '2026-06', 'commission month for Summer Camp stays the invoice month (June)');

// 4) Payment date does NOT move revenue: the 750 was paid in June, but July revenue is
//    still 1500 (driven by the camp's start month, not the payment).
ok(near(billedInMonth('2026-07'), 1500), 'payment date (June) does not reduce July revenue');

// 5) PRECISE per-payment attribution (invoicePaidInMonth).
// (a) UNTAGGED single payment (750, June) → waterfalls to the EARLIEST month first:
//     June fully paid (due 0), July still unpaid.
ok(near(invoicePaidInMonth(inv, '2026-06'), 750), 'untagged 750 fills June first → June paid 750  (got ' + invoicePaidInMonth(inv, '2026-06') + ')');
ok(near(invoicePaidInMonth(inv, '2026-07'), 0),   'untagged: July still unpaid  (got ' + invoicePaidInMonth(inv, '2026-07') + ')');
// (b) TAG the installments: 750 for a June sport (Kick Boxing) + 750 for the July
//     Summer Camp (physically paid 30 Jun, but tagged to the camp → counts in JULY).
inv.payments = [
  { date:'2026-06-07', month:'2026-06', amount:750, method:'card', sport:'Kick Boxing' },
  { date:'2026-06-30', month:'2026-06', amount:750, method:'card', sport:'Summer Camp' },
];
inv.amountPaid = 1500;
ok(near(invoicePaidInMonth(inv, '2026-06'), 750),  'tagged: June paid = 750 (Kick Boxing installment)  (got ' + invoicePaidInMonth(inv, '2026-06') + ')');
ok(near(invoicePaidInMonth(inv, '2026-07'), 750),  'tagged: July paid = 750 (Summer Camp installment, though paid 30 Jun)  (got ' + invoicePaidInMonth(inv, '2026-07') + ')');
// due follows: June 750-750=0, July 1500-750=750.
ok(near(billedInMonth('2026-06') - invoicePaidInMonth(inv, '2026-06'), 0),   'tagged: June due = 0');
ok(near(billedInMonth('2026-07') - invoicePaidInMonth(inv, '2026-07'), 750), 'tagged: July due = 750');

globalThis.__pass = pass; globalThis.__fail = fail;
`;

vm.runInContext(appSrc + '\n' + testCode, ctx, { filename: 'revenue-start-month.js' });
console.log('\n===== REVENUE BY SPORT START MONTH RESULTS =====');
console.log('PASS: ' + ctx.__pass + '   FAIL: ' + ctx.__fail);
console.log('===============================================');
process.exit(ctx.__fail ? 1 : 0);
