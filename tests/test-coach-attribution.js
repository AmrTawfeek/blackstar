// v6.410 — COACH ATTRIBUTION CHECK. Commission follows the invoice LINE's coach. After a coach
// reassignment the enrollment gets the new coach but old invoice lines keep the old one, so the
// wrong coach keeps earning (the "printed Karma, saw another coach's students" bug). This tool
// finds those lines and re-credits them. The money-critical assertion: re-crediting MOVES the
// commission off the old coach and onto the current one.
const H = require('./qc-harness.js');
const R = H.reporter('COACH ATTRIBUTION CHECK');
const run = (c, s) => H.vm.runInContext(s, c);

function seed(ctx) {
  run(ctx, `
    state.user = { role:'admin' }; state.session = { role:'admin' };
    state.settings = state.settings || {}; state.settings.commissionBasis = 'attendance';
    state.coaches = [{ id:1, name:'Karma', rate:30, active:'Y' }, { id:2, name:'RealCoach', rate:30, active:'Y' }];
    state.members = [
      // Reassigned: enrollment now coach 2, but the June invoice line still credits coach 1.
      { id:5001, name:'Jassim Alabdulla', coachId:2, sport:'Taekwondo',
        enrollments:[{ sport:'Taekwondo', coachId:2, classes:12, price:620 }],
        subscriptions:[{ id:'s1', activity:'Taekwondo', coachId:2, start:'2026-06-01', end:'2026-09-01', totalClasses:12, attendedClasses:4, status:'Active' }],
        dailyAttendance:{ '2026-06': { Taekwondo: { '02':'Y','03':'Y','04':'Y','05':'Y' } } } },
      // Correctly attributed: line coach == enrollment coach → must NOT be flagged.
      { id:5002, name:'Correct Kid', coachId:2, sport:'Taekwondo',
        enrollments:[{ sport:'Taekwondo', coachId:2, classes:12, price:600 }],
        subscriptions:[{ id:'s2', activity:'Taekwondo', coachId:2, start:'2026-06-01', end:'2026-09-01', totalClasses:12, status:'Active' }] },
    ];
    state.invoices = [
      { id:9001, ref:'INV-J', customerId:5001, date:'2026-06-20', month:'2026-06', sport:'Taekwondo', amount:620, amountPaid:620, category:'Membership',
        lineItems:[{ sport:'Taekwondo', coachId:1, coach:'Karma', classes:12, price:620 }] },
      { id:9002, ref:'INV-C', customerId:5002, date:'2026-06-20', month:'2026-06', sport:'Taekwondo', amount:600, amountPaid:600, category:'Membership',
        lineItems:[{ sport:'Taekwondo', coachId:2, coach:'RealCoach', classes:12, price:600 }] },
    ];
    state.salaries = [];
    // Resolve confirmSaved synchronously so the tool's save path runs its onOk in-harness.
    window.confirmSaved = function(msg, opts){ if (opts && opts.onOk) { try { opts.onOk(); } catch(_){} } return Promise.resolve({ok:true}); };
  `);
}

R.section('detection');
{
  const ctx = H.makeCtx({ role: 'admin' }); seed(ctx);
  const ms = run(ctx, `_coachAttrMismatches()`);
  R.ok('exactly ONE mismatch found (the reassigned member)', ms.length === 1, ms.length);
  R.ok('it names the member, sport and month', ms[0] && ms[0].memberName === 'Jassim Alabdulla' && ms[0].sport === 'Taekwondo' && ms[0].month === '2026-06', ms[0]);
  R.ok('from = the stale coach (Karma), to = the current coach', ms[0] && ms[0].fromCoach === 1 && ms[0].toCoach === 2, ms[0]);
  R.ok('a correctly-attributed line is NOT flagged', !ms.some(m => m.memberName === 'Correct Kid'), ms.map(m => m.memberName));
}

R.section('detection excludes cases it cannot judge');
{
  const ctx = H.makeCtx({ role: 'admin' }); seed(ctx);
  // Summer Camp earns no commission → never flagged.
  run(ctx, `state.invoices.push({ id:9003, ref:'INV-CAMP', customerId:5001, date:'2026-06-20', month:'2026-06', category:'Membership', lineItems:[{ sport:'Summer Camp', coachId:1, price:1000 }] });`);
  // A deleted invoice → never flagged.
  run(ctx, `state.invoices.push({ id:9004, ref:'INV-DEL', deleted:true, customerId:5001, date:'2026-06-20', month:'2026-06', category:'Membership', lineItems:[{ sport:'Taekwondo', coachId:1, price:620 }] });`);
  // A member with NO current coach for the sport → can't judge, not flagged.
  run(ctx, `state.members.push({ id:5003, name:'No Coach Kid', sport:'Taekwondo', enrollments:[{ sport:'Taekwondo', price:500 }], subscriptions:[] });
            state.invoices.push({ id:9005, ref:'INV-NC', customerId:5003, date:'2026-06-20', month:'2026-06', category:'Membership', lineItems:[{ sport:'Taekwondo', coachId:1, price:500 }] });`);
  const ms = run(ctx, `_coachAttrMismatches()`);
  R.ok('still only the ONE genuine mismatch (camp / deleted / no-current-coach all skipped)', ms.length === 1, ms.map(m => m.ref));
}

R.section('MONEY GUARD — re-crediting moves the commission off the old coach onto the current one');
{
  const ctx = H.makeCtx({ role: 'admin' }); seed(ctx);
  const karmaBefore = run(ctx, `computeMonthlyPay(1,'2026-06').commissionBase`);
  const realBefore = run(ctx, `computeMonthlyPay(2,'2026-06').commissionBase`);
  R.ok('BEFORE: Karma earns commission on Jassim (base > 0)', karmaBefore > 0.005, karmaBefore);

  const okFix = run(ctx, `window._coachAttrFix(9001, 0)`);
  R.ok('the fix applies', okFix === true);
  R.ok('the invoice line now credits the current coach', run(ctx, `state.invoices.find(i=>i.id===9001).lineItems[0].coachId`) === 2);

  const karmaAfter = run(ctx, `computeMonthlyPay(1,'2026-06').commissionBase`);
  const realAfter = run(ctx, `computeMonthlyPay(2,'2026-06').commissionBase`);
  // Karma had ONLY Jassim, so her base drops to 0; the current coach picks Jassim up.
  R.ok('AFTER: Karma no longer earns Jassim commission (drops to 0)', Math.round(karmaAfter * 100) / 100 === 0, { karmaBefore, karmaAfter });
  R.ok('AFTER: the current coach GAINED the commission (money moved to them)', realAfter > realBefore + 0.005, { realBefore, realAfter });
  // (The amounts differ because with the stale coach the subscription did not match the line, so
  // the old coach was paid the inflated FLAT fee; the current coach now earns the correct
  // attendance-based amount — a fair correction, not a leak.)
  R.ok('the re-credit is audited', run(ctx, `(state.auditLog||[]).some(a => a.action === 'invoice.recredit')`) === true);
  R.ok('no mismatch remains after the fix', run(ctx, `_coachAttrMismatches().length`) === 0);
}

R.section('access + wiring');
{
  const src = H.readSrc();
  R.ok('coachAttributionCheck is admin-only', /coachAttributionCheck = function \(\) \{[\s\S]{0,120}currentRole\(\) !== 'admin'/.test(src));
  R.ok('the Salaries screen exposes the check for admins', /currentRole\(\) === 'admin' \?[\s\S]{0,120}coachAttributionCheck\(\)/.test(src));
  R.ok('each fix re-credits to coachIdForSport (the current enrollment coach)', /coachIdForSport\(mem, li\.sport\)/.test(src));
  const out = H.renderScreen(H.seed(H.makeCtx({ role: 'admin' })), 'salaries');
  R.ok('Salaries still renders', out.ok, out.error);
}

R.done();
