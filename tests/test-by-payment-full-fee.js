// v6.450 — "By payment (full fee in payment month)" must pay the coach their % of the
// WHOLE billed fee, attendance irrelevant, and must NOT count a DELETED invoice.
// Reproduces the reported Aziz / Kayid case: a 960 membership, 1/8 attended, plus a
// deleted duplicate 960 invoice. Correct pay = 60% × 960 = 576 (once), not 144, not 1152.
const H = require('./qc-harness.js');
const R = H.reporter('BY-PAYMENT · full fee + deleted-invoice skip');
const run = (c, s) => H.vm.runInContext(s, c);

function seed(ctx) {
  run(ctx, `
    state.settings = state.settings || {};
    state.settings.commissionBasis = 'payment';
    state.settings.commissionStartDate = '';
    state.coaches = [{ id: 11, name: 'Aziz', rate: 60, role: 'coach', active: true }];
    state.members = [{
      id: 256, name: 'Kayid Alshammari', sport: 'Kick Boxing', coachId: 11,
      joinDate: '2026-08-02', expiryDate: '2026-09-01', status: 'Active',
      enrollments: [{ sport: 'Kick Boxing', coachId: 11, classes: 8, price: 960 }],
      subscriptions: [{ _sid: 's256', activity: 'Kick Boxing', coachId: 11, totalClasses: 8,
                        start: '2026-08-02', end: '2026-09-01', status: 'active' }],
      // only 1 of 8 attended → old code prorated 960×1/8 = 120
      dailyAttendance: { '2026-08': { 'Kick Boxing': { '03': 'Y' } } }
    }];
    state.invoices = [
      // the LIVE invoice
      { id: 861804851, ref: 'INV946350', customerId: 256, category: 'Membership', sport: 'Kick Boxing',
        date: '2026-08-02', month: '2026-08', amount: 960, amountPaid: 960, coachId: 11,
        lineItems: [{ sport: 'Kick Boxing', coachId: 11, coach: 'Aziz', classes: 8, price: 960, billMonth: '2026-08' }] },
      // the DELETED duplicate (must NOT be paid)
      { id: 692043396, ref: 'INV946349', customerId: 256, category: 'Membership', sport: 'Kick Boxing',
        date: '2026-08-02', month: '2026-08', amount: 960, amountPaid: 0, deleted: true,
        lineItems: [{ sport: 'Kick Boxing', coachId: 11, coach: 'Aziz', classes: 10, price: 960, billMonth: '2026-08' }] }
    ];
    state.expenses = []; state.salaries = [];
  `);
}

R.section('computeMonthlyPay pays the FULL fee, once');
{
  const ctx = H.makeCtx({ role: 'admin', today: '2026-08-03' }); seed(ctx);
  const base = run(ctx, `computeMonthlyPay(11, '2026-08').commissionBase`);
  const gross = run(ctx, `computeMonthlyPay(11, '2026-08').gross`);
  R.ok('commission base is the full 960 (not 120 attendance-prorated, not 1920 doubled)', base === 960, 'base=' + base);
  R.ok('gross = 60% × 960 = 576 (not 144, not 1152)', Math.abs(gross - 576) < 0.005, 'gross=' + gross);
}

R.section('a DELETED invoice earns nothing (no phantom duplicate)');
{
  const ctx = H.makeCtx({ role: 'admin', today: '2026-08-03' }); seed(ctx);
  // Remove the live invoice, leaving ONLY the deleted one → must pay 0.
  run(ctx, `state.invoices = state.invoices.filter(i => i.id !== 861804851);`);
  const gross = run(ctx, `computeMonthlyPay(11, '2026-08').gross`);
  R.ok('deleted-only → gross 0 (deleted invoice not counted)', gross === 0, 'gross=' + gross);
}

R.section('Summer Camp still earns nothing under by-payment');
{
  const ctx = H.makeCtx({ role: 'admin', today: '2026-08-03' }); seed(ctx);
  run(ctx, `state.invoices.push({ id: 700, ref:'INV700', customerId:256, category:'Membership',
    date:'2026-08-02', month:'2026-08', amount:1500,
    lineItems:[{ sport: SUMMER_CAMP, coachId: 11, price: 1500, billMonth:'2026-08' }] });`);
  const gross = run(ctx, `computeMonthlyPay(11, '2026-08').gross`);
  R.ok('camp line adds nothing → still 576', Math.abs(gross - 576) < 0.005, 'gross=' + gross);
}

R.section('source: all by-payment sites skip deleted invoices + use full price');
{
  const src = H.readSrc();
  R.ok('computeMonthlyPay payment loop skips deleted invoices', /for \(const inv of state\.invoices\) \{[\s\S]{0,400}if \(inv\.deleted\) continue;/.test(src));
  R.ok('computeMonthlyPay adds the full line price on !excluded', /if \(!elig\.excluded\) commissionBase \+= \(parseFloat\(li\.price\) \|\| 0\);/.test(src));
  R.ok('Revenue-Detail builders skip deleted invoices', (src.match(/if \(inv\.deleted\) continue;\s*\/\/ v6\.449/g) || []).length >= 2);
}

R.done();
