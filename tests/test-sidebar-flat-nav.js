// v6.419 — sidebar changes: (1) My Dashboard icon fixed from the ZWJ 🧑‍🏫 (rendered as two
// glyphs) to a single-glyph 🏠; (2) the coach "My Salary" page is disabled (hidden from nav);
// (3) the whole nav is ONE flat list — no category section headers.
const H = require('./qc-harness.js');
const R = H.reporter('SIDEBAR · flat nav + coach tweaks');
const run = (c, s) => H.vm.runInContext(s, c);

R.section('ROUTES config: icon fixed + My Salary hidden');
{
  const ctx = H.makeCtx({ role: 'admin' });
  R.ok('My Dashboard icon is the single-glyph 🏠 (no ZWJ)', run(ctx, `ROUTES.coachhome.icon`) === '🏠', run(ctx, `ROUTES.coachhome.icon`));
  R.ok('My Dashboard icon is NOT the old teacher ZWJ emoji', !/‍/.test(run(ctx, `ROUTES.coachhome.icon`)));
  R.ok('My Salary (coachsalary) is hidden — page disabled', run(ctx, `!!ROUTES.coachsalary.hidden`) === true);
}

R.section('a coach sees a flat list without My Salary');
{
  const ctx = H.makeCtx({ role: 'coach' });
  run(ctx, `state.session = { role:'coach', coachId:1 }; state.user = { role:'coach', coachId:1 };`);
  // Replay the exact flat-entries filter renderSidebar now uses.
  const keys = run(ctx, `(function(){
    const sections = ['Main','Membership','Activities','Summer Camp','Team & Sports','Finance','Insights','System'];
    const out = [];
    for (const section of sections) for (const [key, route] of Object.entries(ROUTES)) {
      if (route.section !== section || route.hidden) continue;
      if (!roleCanAccess(currentRole(), key)) continue;
      if (route.memberOnly && currentRole() !== 'student') continue;
      if (route.coachOnly && currentRole() !== 'coach') continue;
      if (route.adminOnly && currentRole() !== 'admin') continue;
      out.push(key);
    }
    return out;
  })()`);
  R.ok('coach nav INCLUDES My Dashboard', keys.includes('coachhome'), keys);
  R.ok('coach nav EXCLUDES the disabled My Salary', !keys.includes('coachsalary'), keys);
  R.ok('Main-section items come before later sections (order preserved)', keys.indexOf('coachhome') === 0 || keys.indexOf('coachhome') < keys.indexOf('schedule'), keys);
}

R.section('admin still sees the full set, just flat (no page-category headers)');
{
  const ctx = H.makeCtx({ role: 'admin' });
  const keys = run(ctx, `(function(){
    const sections = ['Main','Membership','Activities','Summer Camp','Team & Sports','Finance','Insights','System'];
    const out = [];
    for (const section of sections) for (const [key, route] of Object.entries(ROUTES)) {
      if (route.section !== section || route.hidden) continue;
      if (!roleCanAccess(currentRole(), key)) continue;
      if (route.memberOnly && currentRole() !== 'student') continue;
      if (route.coachOnly && currentRole() !== 'coach') continue;
      if (route.adminOnly && currentRole() !== 'admin') continue;
      out.push(key);
    }
    return out;
  })()`);
  R.ok('admin gets Members, Invoices, Salaries etc.', keys.includes('members') && keys.includes('invoices') && keys.includes('salaries'));
  R.ok('coach-only pages are NOT in the admin list', !keys.includes('coachhome'));
}

R.section('source: page nav is flat; only the footer "More" keeps a section toggle');
{
  const src = H.readSrc('app.js');
  R.ok('the flat entries collector exists', /const flatEntries = \[\];/.test(src));
  R.ok('page-nav items append straight to nav (no per-section group append)', !/nav\.append\(header\);/.test(src) && /nav\.append\(item\);/.test(src));
  R.ok('the old collapsible page-category state is gone', !/bs-nav-collapsed/.test(src));
  // The footer "More" toggle is the ONLY remaining nav-section-toggle (utilities, not pages).
  const toggles = (src.match(/nav-section-toggle/g) || []).length;
  R.ok('exactly one nav-section-toggle remains (footer More)', toggles === 1, 'count=' + toggles);
}

R.done();
