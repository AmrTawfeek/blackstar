// v6.459 — the Charts dashboard gained MULTI-SELECT month + year filters. Both empty = the default
// last-8-months view; otherwise a month is in scope when it passes BOTH active filters (empty filter
// passes everything), and every chart (KPIs, revenue/cost, category, sport, coach, payroll, members)
// follows that scope. Behaviour verified end-to-end in a browser; this locks the wiring + scope math.
const H = require('./qc-harness.js');
const R = H.reporter('CHARTS · multi-select month + year filters');
const run = (c, s) => H.vm.runInContext(s, c);

R.section('source: the filter controls + scope logic are wired');
{
  const src = H.readSrc();
  R.ok('a month multi-select is rendered', /monthMultiHTML\('ch-month'/.test(src));
  R.ok('a year multi-select is rendered', /multiFilterHTML\('ch-year'/.test(src));
  R.ok('a month is in scope only when it passes BOTH filters', /chF\.months\.length === 0 \|\| chF\.months\.includes\(mk\)[\s\S]{0,120}chF\.years\.length === 0 \|\| chF\.years\.includes\(mk\.slice\(0, 4\)\)/.test(src));
  R.ok('no filter ⇒ the default last-8-months window', /const scoped = hasFilter \? inScope : months\.slice\(-8\)/.test(src));
  R.ok('category revenue follows the scoped period (not all-time)', /billedByCategoryInPeriod\(m => scopedSet\.has\(m\)\)/.test(src));
  R.ok('sport revenue follows the scoped period', /billedBySportInPeriod\(m => scopedSet\.has\(m\)\)/.test(src));
  R.ok('the month filter is bound + re-renders', /bindMonthMulti\('ch-month', \(mSel\) => \{ window\._chFilter\.months = mSel; PAGES\.charts\(main\)/.test(src));
  R.ok('the year filter is bound + re-renders', /bindMultiFilter\('ch-year', \(v\) => \{ window\._chFilter\.years = v; PAGES\.charts\(main\)/.test(src));
  R.ok('a Clear button resets both filters', /window\._chFilter = \{ months: \[\], years: \[\] \}; PAGES\.charts\(main\)/.test(src));
}

R.section('the scope math selects exactly the right months');
{
  const ctx = H.makeCtx({ role: 'admin', today: '2026-08-15' });
  // Replicate the in-scope predicate from PAGES.charts.
  const scope = (months, chF) => months.filter(mk =>
    (chF.months.length === 0 || chF.months.includes(mk)) &&
    (chF.years.length === 0 || chF.years.includes(mk.slice(0, 4))));
  const months = ['2025-11', '2025-12', '2026-06', '2026-07', '2026-08'];
  R.ok('year 2026 → the three 2026 months', JSON.stringify(scope(months, { months: [], years: ['2026'] })) === JSON.stringify(['2026-06', '2026-07', '2026-08']));
  R.ok('year 2025 → the two 2025 months', JSON.stringify(scope(months, { months: [], years: ['2025'] })) === JSON.stringify(['2025-11', '2025-12']));
  R.ok('specific months → exactly those', JSON.stringify(scope(months, { months: ['2026-06', '2026-08'], years: [] })) === JSON.stringify(['2026-06', '2026-08']));
  R.ok('month + year AND together (Aug-2026 ∧ year 2025 → none)', scope(months, { months: ['2026-08'], years: ['2025'] }).length === 0);
  R.ok('both empty passes everything (caller defaults to last-8)', scope(months, { months: [], years: [] }).length === 5);
}

R.section('the Charts screen still renders (admin) with a filter applied');
{
  const ctx = H.seed(H.makeCtx({ role: 'admin' }));
  run(ctx, `window._chFilter = { months: [], years: [] };`);
  R.ok('renders with no filter', H.renderScreen(ctx, 'charts').ok, H.renderScreen(ctx, 'charts').error);
  run(ctx, `window._chFilter = { months: [], years: ['2026'] };`);
  R.ok('renders with a year filter', H.renderScreen(ctx, 'charts').ok, H.renderScreen(ctx, 'charts').error);
}

R.done();
