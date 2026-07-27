// v6.409 — SALARY: settle-in-full reachable for over-advanced coaches + per-coach history panel.
// The money-critical part is the double-pay guard: paying a membership's PENDING commission early
// (settle in full) must stamp it so it NEVER trues-up again when it later expires. Verified here on
// the real commission engine, plus source guards for the two UI additions.
const H = require('./qc-harness.js');
const R = H.reporter('SALARY · settle-in-full + coach history');
const run = (c, s) => H.vm.runInContext(s, c);

// A coach with an advance that makes net NEGATIVE, but with real PENDING commission — the exact
// case the old UI hid behind a Carry-only button.
function seed(ctx) {
  run(ctx, `
    state.user = { role:'admin' }; state.session = { role:'admin' };
    state.coaches = [{ id:1, name:'Iyad', rate:30, active:'Y', commissionRate:30 }];
    state.settings = state.settings || {}; state.settings.commissionBasis = 'attendance';
    state.members = [{ id:9001, name:'Test Kid', phone:'+97455000001', sport:'Swimming', coachId:1,
      subscriptions:[{ id:'s9', activity:'Swimming', coachId:1, start:'2026-06-02', end:'2026-09-02', totalClasses:8, attendedClasses:2, status:'Active' }],
      enrollments:[{ sport:'Swimming', coachId:1, classes:8, price:800 }],
      dailyAttendance:{ '2026-06': { Swimming: { '02':'Y','03':'Y' } } } }];
    state.invoices = [{ id:8001, ref:'INV-S', customerId:9001, date:'2026-06-02', month:'2026-06', sport:'Swimming', amount:800, amountPaid:800, category:'Membership', coachId:1, lineItems:[{ sport:'Swimming', coachId:1, classes:8, price:800 }] }];
    state.salaries = [{ id:7001, coachId:1, kind:'advance', month:'2026-06', amount:250 }];
  `);
}

R.section('the fixture is the over-advanced-but-has-pending case');
{
  const ctx = H.makeCtx({ role: 'admin' }); seed(ctx);
  const p = run(ctx, `computeMonthlyPay(1,'2026-06')`);
  R.ok('gross is the attended commission (2 × 800/8 × 30% = 60)', Math.round(p.gross) === 60, p.gross);
  R.ok('pending is the unattended remainder (6 × 100 × 30% = 180)', Math.round(p.commissionPending) === 180, p.commissionPending);
  R.ok('net is NEGATIVE (60 − 250 advance = −190) → old UI showed only Carry', Math.round(p.net) === -190, p.net);
}

R.section('MONEY GUARD — settling pending in full stops the later true-up (no double-pay)');
{
  const ctx = H.makeCtx({ role: 'admin' }); seed(ctx);
  const before = run(ctx, `computeMonthlyPay(1,'2026-06').commissionPending`);
  R.ok('180 pending before settling', Math.round(before) === 180, before);

  run(ctx, `settleCoachPendingCommission(1, '2026-06')`);
  const stamp = run(ctx, `state.members[0].subscriptions[0].commissionSettled`);
  R.ok('the membership is stamped commissionSettled = the settle month', stamp === '2026-06', stamp);

  const afterPending = run(ctx, `computeMonthlyPay(1,'2026-06').commissionPending`);
  R.ok('after settling, THIS month shows 0 pending (it was paid in full)', Math.round(afterPending) === 0, afterPending);

  // The membership ends 2026-09-02. In October the true-up would normally realise the remaining
  // 6 classes into base — that MUST be suppressed now, or the coach is paid twice.
  const octBase = run(ctx, `computeMonthlyPay(1,'2026-10').commissionBase`);
  R.ok('the expiry-month true-up is SUPPRESSED — later base is 0 (no double pay)', Math.round(octBase * 100) / 100 === 0, octBase);

  // And a class attended AFTER the settle month earns nothing more either.
  run(ctx, `state.members[0].dailyAttendance['2026-07'] = { Swimming: { '05':'Y' } }`);
  const julBase = run(ctx, `computeMonthlyPay(1,'2026-07').commissionBase`);
  R.ok('a class attended after settlement also earns nothing (already paid in full)', Math.round(julBase * 100) / 100 === 0, julBase);
}

R.section('the settle payout is net + pending (the coach is not under-paid)');
{
  const ctx = H.makeCtx({ role: 'admin' }); seed(ctx);
  // _salEnsureRec with settle=true creates the paid record at net + pending.
  const rec = run(ctx, `(function(){ var r = _salEnsureRec(1,'2026-06', null, true); return { target: r.target, settledPending: r.settledPending }; })()`);
  // net was −190, pending 180 → net + pending = −10. The target is net + pendingPaid.
  R.ok('the paid record target includes the pending', Math.round(rec.settledPending) === 180, rec);
  R.ok('target = net + pending (−190 + 180 = −10)', Math.round(rec.target) === -10, rec.target);
}

R.section('the Salaries row now offers Settle alongside Carry (was Carry-only)');
{
  // (The row is painted into #sal-tbody, which the harness DOM stub discards — the behaviour is
  //  verified live in the browser; here we assert the row-render source wires all three.)
  const src = H.readSrc();
  R.ok('the screen renders without throwing', H.renderScreen(H.seed(H.makeCtx({ role: 'admin' })), 'salaries').ok);
  R.ok('over-advanced rows still offer Carry', /carrySalaryForward\(\$\{p\.coachId\}, '\$\{p\.month\}'\)/.test(src));
  R.ok('...and when there is pending, ALSO offer Settle-in-full (v6.410: direct settle action)',
    /p\.commissionPending > 0\.005/.test(src)
    && /_salSettlePending\(\$\{p\.coachId\}, '\$\{p\.month\}'\)[\s\S]{0,200}💰 \$\{t\('Settle'/.test(src));
  R.ok('every row has a per-coach history button', /showCoachSalaryHistory\(\$\{p\.coachId\}\)/.test(src));
}

R.section('the coach history panel exists and lists the coach’s months with pay actions');
{
  const src = H.readSrc();
  R.ok('showCoachSalaryHistory is defined', /window\.showCoachSalaryHistory = function/.test(src));
  R.ok('it iterates every available month via computeMonthlyPay', /availableMonths\(\{ includeFuture: true \}\)[\s\S]{0,400}computeMonthlyPay\(coachId, m\)/.test(src));
  R.ok('each month row can open the pay dialog', /markPaid\(\$\{coachId\}, '\$\{m\}'\)/.test(src));
  R.ok('it summarises total outstanding across months', /tOutstanding/.test(src) && /outstanding/.test(src));
}

R.done();
