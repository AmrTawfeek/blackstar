/* ═══════════════════════════════════════════════════════════════════════
   Pages — Dashboard, Members, Coaches, Invoices, Expenses, Salaries, Sales, Reports, Settings
   ═══════════════════════════════════════════════════════════════════════ */

// ─── Compute summary stats ──────────────────────────────────────────
// Returns figures for the CURRENT month and the PREVIOUS month. The keys are
// `curr*` / `prev*`. Legacy code may still reference `may*` / `apr*` — those
// are kept as aliases below so we don't break things during the transition.
function computeStats() {
  const curr = currentMonth();
  // Previous month: take 1st of current, subtract a day, format YYYY-MM
  const d = new Date(curr + '-01T00:00:00');
  d.setDate(0);
  const prev = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;

  const currRevenue = state.invoices.reduce((s, i) => s + cashInMonth(i, curr), 0);
  const prevRevenue = state.invoices.reduce((s, i) => s + cashInMonth(i, prev), 0);

  // Split revenue: coaching/membership vs court rental
  const currRentalRevenue = state.invoices.filter(i => i.activityType === 'rental').reduce((s, i) => s + cashInMonth(i, curr), 0);
  const prevRentalRevenue = state.invoices.filter(i => i.activityType === 'rental').reduce((s, i) => s + cashInMonth(i, prev), 0);
  const currCoachingRevenue = currRevenue - currRentalRevenue;
  const prevCoachingRevenue = prevRevenue - prevRentalRevenue;

  const currRentalCount = state.invoices.filter(i => i.month === curr && i.activityType === 'rental').length;
  const prevRentalCount = state.invoices.filter(i => i.month === prev && i.activityType === 'rental').length;

  // Product sales revenue (sales auto-create invoices with category='Product')
  const currSalesRevenue = state.invoices.filter(i => i.activityType === 'sale').reduce((s, i) => s + cashInMonth(i, curr), 0);
  const prevSalesRevenue = state.invoices.filter(i => i.activityType === 'sale').reduce((s, i) => s + cashInMonth(i, prev), 0);

  const currExpenses = state.expenses.filter(e => e.month === curr).reduce((s,e) => s+e.amount, 0);
  const prevExpenses = state.expenses.filter(e => e.month === prev).reduce((s,e) => s+e.amount, 0);

  // Total payroll cost = sum of gross pay for every active coach/staff this month.
  // Previously this read `state.salaries[].salary` which doesn't exist in the
  // current lightweight schema (salaries[] now stores advances + paid records),
  // so the KPI showed 0 always. Use the canonical computeMonthlyPay() instead.
  const currSalaries = (state.coaches || [])
    .filter(c => isCoachActive(c))
    .map(c => computeMonthlyPay(c.id, curr))
    .filter(p => p)
    .reduce((sum, p) => sum + (p.gross || 0), 0);
  const prevSalaries = (state.coaches || [])
    .filter(c => isCoachActive(c))
    .map(c => computeMonthlyPay(c.id, prev))
    .filter(p => p)
    .reduce((sum, p) => sum + (p.gross || 0), 0);

  const currSales = state.sales.filter(s => s.month === curr).reduce((s,x) => s+(x.paid||0), 0);
  const prevSales = state.sales.filter(s => s.month === prev).reduce((s,x) => s+(x.paid||0), 0);

  // Member counts exclude archived (soft-deleted) members
  const activeMembersList = activeMembers();
  const activeMembers_ = activeMembersList.filter(m => isActiveStatus(m)).length;
  const expiredMembers = activeMembersList.filter(m => memberStatus(m) === 'Expired').length;
  const completedMembers = activeMembersList.filter(m => memberStatus(m) === 'Completed').length;
  const frozenMembers = activeMembersList.filter(m => memberStatus(m) === 'Frozen').length;

  const currProfit = currRevenue - currExpenses - currSalaries;
  const prevProfit = prevRevenue - prevExpenses - prevSalaries;

  return {
    currMonth: curr, prevMonth: prev,
    currRevenue, prevRevenue,
    currCoachingRevenue, prevCoachingRevenue,
    currRentalRevenue, prevRentalRevenue,
    currRentalCount, prevRentalCount,
    currSalesRevenue, prevSalesRevenue,
    currExpenses, prevExpenses,
    currSalaries, prevSalaries,
    currSales, prevSales,
    currProfit, prevProfit,
    activeMembers: activeMembers_, expiredMembers, completedMembers, frozenMembers,
    totalMembers: activeMembersList.length,
    archivedMembers: state.members.length - activeMembersList.length,
    deltaRevenue: currRevenue - prevRevenue,
    deltaExpenses: currExpenses - prevExpenses,
    // Legacy aliases — to be removed once all references are updated.
    aprRevenue: prevRevenue, mayRevenue: currRevenue,
    aprCoachingRevenue: prevCoachingRevenue, mayCoachingRevenue: currCoachingRevenue,
    aprRentalRevenue: prevRentalRevenue, mayRentalRevenue: currRentalRevenue,
    aprRentalCount: prevRentalCount, mayRentalCount: currRentalCount,
    aprExpenses: prevExpenses, mayExpenses: currExpenses,
    aprSalaries: prevSalaries, maySalaries: currSalaries,
    aprSales: prevSales, maySales: currSales,
    aprProfit: prevProfit, mayProfit: currProfit,
  };
}

function kpiDelta(curr, prev) {
  if (!prev) return '';
  const d = curr - prev;
  const pct = (d / prev * 100).toFixed(1);
  const cls = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
  const arrow = d > 0 ? '▲' : d < 0 ? '▼' : '−';
  return `<div class="kpi-delta ${cls}">${arrow} ${Math.abs(pct)}%</div>`;
}

// Percent change for the month-over-month comparison tables. Guards the
// zero-denominator case so cells never render "Infinity%" or "NaN%":
//   prev 0, curr 0  → "—"   (no change to report)
//   prev 0, curr >0 → "∞"   (grew from nothing)
//   otherwise       → signed value to 1 decimal, e.g. "12.3" or "-4.0"
function pctChangeStr(prev, curr) {
  if (!prev) return curr ? '∞' : '—';
  return ((curr - prev) / prev * 100).toFixed(1);
}

// Tiny inline sparkline from an array of values
function sparkline(values, color) {
  const vals = values.filter(v => typeof v === 'number');
  if (vals.length < 2) return '';
  const w = 64, h = 20, max = Math.max(...vals), min = Math.min(...vals);
  const range = max - min || 1;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const last = vals[vals.length - 1], first = vals[0];
  const col = color || (last >= first ? 'var(--green)' : 'var(--red)');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="margin-top:6px;overflow:visible">
    <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${w}" cy="${(h - ((last - min) / range) * h).toFixed(1)}" r="2.2" fill="${col}"/>
  </svg>`;
}

// ─── DASHBOARD ──────────────────────────────────────────────────
PAGES.dashboard = (main) => {
  const s = computeStats();

  // ─── "Needs attention today" — consolidated action items ───
  const threshold = state.settings?.expiringSoonDays || 3;
  const lowStockThreshold = state.settings?.lowStockThreshold || 3;
  const expiredList = [], expiringList = [], finishedList = [], lowStockList = [];
  for (const m of state.members) {
    if (m.deleted) continue;  // archived members don't trigger alerts
    if (memberStatus(m) === 'Withdrawn') continue;  // withdrawn members don't need renewal alerts
    // expiry-based
    if (m.expiryDate) {
      const d = daysUntil(m.expiryDate);
      if (d != null) {
        if (d < 0) expiredList.push({ m, days: d });
        else if (d <= threshold) expiringList.push({ m, days: d });
      }
    }
    // finished all classes but still active (likely needs renewal)
    for (const sub of (m.subscriptions || [])) {
      if (sub.month !== 'may') continue;
      const tot = sub.totalClasses || 0;
      const liveSp = liveAttendanceCount(m, sub.activity);
      const att = liveSp.total > 0 ? liveSp.y : (sub.attendedClasses || 0);
      if (tot > 0 && att >= tot && m.status === 'Active') {
        finishedList.push({ m, sport: sub.activity || m.sport });
        break;
      }
    }
  }
  // low stock (products tracked in state.products if present)
  for (const p of (state.products || [])) {
    const liveStock = typeof productCurrentStock === 'function' ? productCurrentStock(p.id) : (p.stock || 0);
    const threshold = p.lowStockThreshold || lowStockThreshold;
    if (liveStock <= threshold) {
      lowStockList.push({ ...p, stock: liveStock });
    }
  }
  expiringList.sort((a, b) => a.days - b.days);
  const expiringSoon = expiringList.length, alreadyExpired = expiredList.length;
  const totalActions = alreadyExpired + expiringSoon + finishedList.length + lowStockList.length;

  // ─── Birthdays this month ───────────────────────────────────────
  // Active members whose birthday falls in the current calendar month,
  // sorted by upcoming-soonest (or already-passed-this-month last).
  const birthdayList = state.members
    .filter(m => !m.deleted && m.birthdate && isBirthdayInMonth(m.birthdate) && isActiveStatus(m))
    .map(m => ({ m, days: daysUntilBirthday(m.birthdate) }))
    .sort((a, b) => a.days - b.days);

  // ─── Renewing this week (next 7 days) ───────────────────────────
  const renewingThisWeek = state.members
    .filter(m => !m.deleted && m.expiryDate && memberStatus(m) !== 'Frozen' && memberStatus(m) !== 'Withdrawn')
    .map(m => ({ m, days: daysUntil(m.expiryDate) }))
    .filter(x => x.days != null && x.days >= 0 && x.days <= 7);

  // ─── Top performing sport this month ────────────────────────────
  // Count how many DISTINCT members are enrolled per sport with an active sub
  const sportCounts = {};
  for (const m of state.members) {
    if (m.deleted) continue;
    if (!isActiveStatus(m)) continue;
    const sports = new Set();
    if (m.sport) sports.add(m.sport);
    (m.enrollments || []).forEach(e => { if (e.sport) sports.add(e.sport); });
    for (const sp of sports) {
      sportCounts[sp] = (sportCounts[sp] || 0) + 1;
    }
  }
  const topSport = Object.entries(sportCounts).sort((a, b) => b[1] - a[1])[0];

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Dashboard</h1>
        <div class="subtitle">Black Stars Sports Club · ${(() => { const a = availableMonths(); return a.length ? (a.length === 1 ? fmtMonth(a[0]) : `${fmtMonth(a[0])} – ${fmtMonth(a[a.length-1])}`) : 'No data yet'; })()}</div>
      </div>
      <div class="topbar-actions">
        <button class="btn ghost" id="export-btn">📥 Export</button>
        <button class="btn primary" id="refresh-btn">🔄 Refresh</button>
      </div>
    </div>

    ${state.members.length === 0 && state.invoices.length === 0 ? `
      <div class="card" style="border:1px solid rgba(91,141,239,.4);background:linear-gradient(135deg,rgba(91,141,239,.10),rgba(242,96,96,.06));margin-bottom:16px;padding:20px">
        <div style="display:flex;align-items:flex-start;gap:16px">
          <div style="font-size:42px">👋</div>
          <div style="flex:1">
            <h2 style="margin:0 0 6px;font-size:18px">Welcome to Black Stars CRM</h2>
            <p class="text-dim" style="font-size:13px;margin-bottom:14px">This is a fresh install with no data yet. Pick how to get started:</p>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              <button class="btn primary" onclick="navigate('dataimport')">📥 Import my Excel sheets</button>
              <button class="btn ghost" onclick="navigate('settings')">📂 Restore from backup</button>
              <button class="btn ghost" onclick="navigate('members')">➕ Add members manually</button>
              <button class="btn ghost" onclick="(() => { if(confirm('Load 207 demo members and sample data to explore the app? You can clear it later.')) { loadDemoData(); render(); toast('Demo data loaded'); } })()">🧪 Just load demo data to try it out</button>
            </div>
            <div class="text-mute" style="font-size:11px;margin-top:12px">
              💡 ${isCloudStorage()
                ? 'Your data is stored in the cloud (Firebase) and syncs across every device you sign in on — nothing is tied to this one browser.'
                : 'Once you start using the app, your data stays in this browser. When you receive a newer version of the app, your data is preserved automatically — no manual restore needed unless you want to revert.'}
            </div>
          </div>
        </div>
      </div>
    ` : ''}

    ${totalActions > 0 ? `
      <div class="card" style="border:1px solid rgba(242,163,60,.35);background:linear-gradient(180deg,rgba(242,163,60,.08),transparent);margin-bottom:16px">
        <div class="card-header" style="margin-bottom:8px">
          <div><div class="card-title" style="display:flex;align-items:center;gap:8px">🔔 Needs attention today <span class="badge" style="background:var(--accent-2);color:#1a1a1a">${totalActions}</span></div>
          <div class="card-subtitle">Action items based on today's data — tap any to act</div></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
          ${alreadyExpired ? `
            <div onclick="navigate('expiring')" style="cursor:pointer;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:12px">
              <div style="font-size:24px;font-weight:800;color:var(--red)">${alreadyExpired}</div>
              <div style="font-size:12px;font-weight:600">Expired memberships</div>
              <div class="text-mute" style="font-size:10px;margin-top:2px">Need renewal now →</div>
            </div>` : ''}
          ${expiringSoon ? `
            <div onclick="navigate('expiring')" style="cursor:pointer;background:rgba(242,163,60,.1);border:1px solid rgba(242,163,60,.3);border-radius:8px;padding:12px">
              <div style="font-size:24px;font-weight:800;color:var(--accent-2)">${expiringSoon}</div>
              <div style="font-size:12px;font-weight:600">Expiring in ≤ ${threshold} days</div>
              <div class="text-mute" style="font-size:10px;margin-top:2px">${expiringList.slice(0,2).map(x => escapeHtml(x.m.name.split(' ')[0])).join(', ')}${expiringSoon > 2 ? '…' : ''} →</div>
            </div>` : ''}
          ${finishedList.length ? `
            <div onclick="navigate('members')" style="cursor:pointer;background:rgba(91,141,239,.1);border:1px solid rgba(91,141,239,.3);border-radius:8px;padding:12px">
              <div style="font-size:24px;font-weight:800;color:var(--blue)">${finishedList.length}</div>
              <div style="font-size:12px;font-weight:600">Finished all classes</div>
              <div class="text-mute" style="font-size:10px;margin-top:2px">Likely need renewal →</div>
            </div>` : ''}
          ${lowStockList.length ? `
            <div onclick="navigate('products')" style="cursor:pointer;background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.3);border-radius:8px;padding:12px">
              <div style="font-size:24px;font-weight:800;color:#8b5cf6">${lowStockList.length}</div>
              <div style="font-size:12px;font-weight:600">Low stock items</div>
              <div class="text-mute" style="font-size:10px;margin-top:2px">${lowStockList.slice(0,2).map(p => escapeHtml(p.name)).join(', ')} →</div>
            </div>` : ''}
        </div>
      </div>
    ` : `
      <div class="card" style="border:1px solid rgba(16,185,129,.3);background:rgba(16,185,129,.06);margin-bottom:16px;display:flex;align-items:center;gap:12px;padding:14px 16px">
        <span style="font-size:22px">✅</span>
        <div><div style="font-weight:600;color:var(--green)">All clear — nothing needs attention right now</div>
        <div class="text-mute" style="font-size:11px">No expired memberships, none expiring soon, stock levels healthy</div></div>
      </div>
    `}

    <!-- Birthdays · Renewing soon · Top sport (small info row) -->
    ${(birthdayList.length || renewingThisWeek.length || topSport) ? `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:16px">
      ${birthdayList.length ? `
        <div class="card" style="padding:12px 14px;border:1px solid rgba(245,158,11,.25);background:rgba(245,158,11,.05);cursor:pointer" onclick="navigate('members')" title="Open Members page">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:18px">🎂</span>
            <div style="font-weight:600;font-size:13px">${birthdayList.length} birthday${birthdayList.length === 1 ? '' : 's'} this month</div>
          </div>
          <div class="text-mute" style="font-size:11px;line-height:1.5">
            ${birthdayList.slice(0, 4).map(({m, days}) => {
              const age = memberAge(m.birthdate);
              const ageNext = age != null ? age + (days > 0 ? 1 : 0) : null;
              return `${escapeHtml(m.name.split(' ')[0])}${ageNext != null ? ` (${ageNext})` : ''}${days === 0 ? ' 🎉' : days <= 7 ? ` · in ${days}d` : ''}`;
            }).join(', ')}${birthdayList.length > 4 ? `… +${birthdayList.length - 4}` : ''}
          </div>
        </div>` : ''}
      ${renewingThisWeek.length ? `
        <div class="card" style="padding:12px 14px;border:1px solid rgba(242,163,60,.25);background:rgba(242,163,60,.05);cursor:pointer" onclick="navigate('expiring')" title="Open Expiring page">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:18px">⏰</span>
            <div style="font-weight:600;font-size:13px">${renewingThisWeek.length} renewing this week</div>
          </div>
          <div class="text-mute" style="font-size:11px;line-height:1.5">
            Members with expiry in the next 7 days — chase those renewals
          </div>
        </div>` : ''}
      ${topSport ? `
        <div class="card" style="padding:12px 14px;border:1px solid rgba(91,141,239,.25);background:rgba(91,141,239,.05)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:18px">🏆</span>
            <div style="font-weight:600;font-size:13px">Most popular: ${escapeHtml(topSport[0])}</div>
          </div>
          <div class="text-mute" style="font-size:11px;line-height:1.5">
            ${topSport[1]} active member${topSport[1] === 1 ? '' : 's'} enrolled
          </div>
        </div>` : ''}
    </div>
    ` : ''}

    <!-- KPI cards -->
    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-icon">💰</div>
        <div class="kpi-label">Total Revenue (${fmtMonth(s.prevMonth).split(' ')[0]}+${fmtMonth(s.currMonth).split(' ')[0]})</div>
        <div class="kpi-value num">${fmt(s.prevRevenue + s.currRevenue)} <span style="font-size:13px;color:var(--text-dim);font-weight:500">QAR</span></div>
        ${kpiDelta(s.currRevenue, s.prevRevenue)}
        ${sparkline([s.prevRevenue, s.currRevenue])}
      </div>
      <div class="kpi blue">
        <div class="kpi-icon">👥</div>
        <div class="kpi-label">Active Members</div>
        <div class="kpi-value num">${s.activeMembers}</div>
        <div class="kpi-delta flat">${s.frozenMembers ? `${s.frozenMembers} ❄️ frozen · ` : ''}${s.completedMembers ? `${s.completedMembers} completed · ` : ''}${s.expiredMembers} expired</div>
      </div>
      <div class="kpi orange">
        <div class="kpi-icon">💸</div>
        <div class="kpi-label">Total Expenses</div>
        <div class="kpi-value num">${fmt(s.prevExpenses + s.currExpenses + s.prevSalaries + s.currSalaries)} <span style="font-size:13px;color:var(--text-dim);font-weight:500">QAR</span></div>
        <div class="kpi-delta flat">Ops + payroll</div>
      </div>
      <div class="kpi ${s.currProfit >= 0 ? 'green' : 'red'}">
        <div class="kpi-icon">${s.currProfit >= 0 ? '📈' : '📉'}</div>
        <div class="kpi-label">${fmtMonth(s.currMonth).split(' ')[0]} Net Profit</div>
        <div class="kpi-value num">${fmt(s.currProfit)} <span style="font-size:13px;color:var(--text-dim);font-weight:500">QAR</span></div>
        ${kpiDelta(s.currProfit, s.prevProfit)}
        ${sparkline([s.prevProfit, s.currProfit])}
      </div>
    </div>

    <!-- Revenue stream breakdown -->
    <div class="kpi-grid mb-3">
      <div class="kpi green">
        <div class="kpi-icon">🥋</div>
        <div class="kpi-label">Coaching Revenue (${fmtMonth(s.prevMonth).split(' ')[0]}+${fmtMonth(s.currMonth).split(' ')[0]})</div>
        <div class="kpi-value num">${fmt(s.prevCoachingRevenue + s.currCoachingRevenue)} <span style="font-size:13px;color:var(--text-dim);font-weight:500">QAR</span></div>
        <div class="kpi-delta flat">Memberships + classes</div>
      </div>
      <div class="kpi cyan">
        <div class="kpi-icon">🏟</div>
        <div class="kpi-label">Court Rental Revenue</div>
        <div class="kpi-value num">${fmt(s.prevRentalRevenue + s.currRentalRevenue)} <span style="font-size:13px;color:var(--text-dim);font-weight:500">QAR</span></div>
        <div class="kpi-delta flat">${s.prevRentalCount + s.currRentalCount} bookings</div>
      </div>
      <div class="kpi purple">
        <div class="kpi-icon">🛒</div>
        <div class="kpi-label">Equipment Sales</div>
        <div class="kpi-value num">${fmt(s.aprSales + s.maySales)} <span style="font-size:13px;color:var(--text-dim);font-weight:500">QAR</span></div>
        <div class="kpi-delta flat">Uniforms & gear</div>
      </div>
      <div class="kpi">
        <div class="kpi-icon">📊</div>
        <div class="kpi-label">Revenue Mix (${fmtMonth(s.currMonth).split(' ')[0]})</div>
        <div class="kpi-value num">${s.mayRevenue > 0 ? Math.round(s.mayCoachingRevenue / s.mayRevenue * 100) : 0}<span style="font-size:14px">%</span> <span style="font-size:12px;color:var(--text-dim);font-weight:500">coaching</span></div>
        <div class="kpi-delta flat">${s.mayRevenue > 0 ? Math.round(s.mayRentalRevenue / s.mayRevenue * 100) : 0}% rental</div>
      </div>
    </div>

    <!-- Revenue chart + Members breakdown -->
    <div class="row row-2-1 mb-3">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Revenue vs Expenses</div>
            <div class="card-subtitle">Monthly comparison</div>
          </div>
        </div>
        <div id="rev-chart"></div>
      </div>
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Members by Sport</div>
            <div class="card-subtitle">Active enrollments</div>
          </div>
        </div>
        <div id="sport-chart"></div>
      </div>
    </div>

    <!-- Top coaches + Recent invoices -->
    <div class="row row-2 mb-3">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Top Coaches by Students</div>
            <div class="card-subtitle">Most-enrolled coaches</div>
          </div>
        </div>
        <div id="coach-leaderboard"></div>
      </div>
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Recent Invoices</div>
            <div class="card-subtitle">Latest 8 transactions</div>
          </div>
          <button class="btn ghost sm" onclick="navigate('invoices')">View all →</button>
        </div>
        <div id="recent-invoices"></div>
      </div>
    </div>

    <!-- Monthly summary table -->
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Monthly Summary</div>
          <div class="card-subtitle">${fmtMonth(s.prevMonth).split(' ')[0]} vs ${fmtMonth(s.currMonth).split(' ')[0]} comparison</div>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th class="text-right">${fmtMonth(s.prevMonth).split(' ')[0]}</th>
              <th class="text-right">${fmtMonth(s.currMonth).split(' ')[0]}</th>
              <th class="text-right">Change</th>
              <th class="text-right">% Δ</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Revenue</td><td class="text-right num">${fmtMoney(s.aprRevenue)}</td><td class="text-right num">${fmtMoney(s.mayRevenue)}</td><td class="text-right num ${s.mayRevenue-s.aprRevenue>=0?'text-up':'text-down'}">${s.mayRevenue-s.aprRevenue>=0?'+':''}${fmt(s.mayRevenue-s.aprRevenue)}</td><td class="text-right num text-dim">${pctChangeStr(s.aprRevenue, s.mayRevenue)}%</td></tr>
            <tr><td>Operating expenses</td><td class="text-right num">${fmtMoney(s.aprExpenses)}</td><td class="text-right num">${fmtMoney(s.mayExpenses)}</td><td class="text-right num ${s.mayExpenses-s.aprExpenses>=0?'text-down':'text-up'}">${s.mayExpenses-s.aprExpenses>=0?'+':''}${fmt(s.mayExpenses-s.aprExpenses)}</td><td class="text-right num text-dim">${pctChangeStr(s.aprExpenses, s.mayExpenses)}%</td></tr>
            <tr><td>Salaries & commissions</td><td class="text-right num">${fmtMoney(s.aprSalaries)}</td><td class="text-right num">${fmtMoney(s.maySalaries)}</td><td class="text-right num ${s.maySalaries-s.aprSalaries>=0?'text-down':'text-up'}">${s.maySalaries-s.aprSalaries>=0?'+':''}${fmt(s.maySalaries-s.aprSalaries)}</td><td class="text-right num text-dim">${pctChangeStr(s.aprSalaries, s.maySalaries)}%</td></tr>
            <tr><td>Sales (gear)</td><td class="text-right num">${fmtMoney(s.aprSales)}</td><td class="text-right num">${fmtMoney(s.maySales)}</td><td class="text-right num ${s.maySales-s.aprSales>=0?'text-up':'text-down'}">${s.maySales-s.aprSales>=0?'+':''}${fmt(s.maySales-s.aprSales)}</td><td class="text-right num text-dim">${pctChangeStr(s.aprSales, s.maySales)}%</td></tr>
            <tr style="font-weight:700;background:var(--surface-2)"><td>Net profit</td><td class="text-right num ${s.aprProfit>=0?'text-up':'text-down'}">${fmtMoney(s.aprProfit)}</td><td class="text-right num ${s.mayProfit>=0?'text-up':'text-down'}">${fmtMoney(s.mayProfit)}</td><td class="text-right num ${s.mayProfit-s.aprProfit>=0?'text-up':'text-down'}">${s.mayProfit-s.aprProfit>=0?'+':''}${fmt(s.mayProfit-s.aprProfit)}</td><td class="text-right num">—</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Backup reminder & version info -->
    <div class="card" style="margin-top:14px;display:flex;align-items:center;gap:14px;padding:14px 16px;background:rgba(91,141,239,.05);border:1px solid rgba(91,141,239,.2)">
      <div style="font-size:26px">💾</div>
      <div style="flex:1">
        <div style="font-weight:600;font-size:13px">Backup before updates</div>
        <div class="text-mute" style="font-size:11px;margin-top:2px">
          Running <b>v${APP_VERSION}</b>. ${isCloudStorage()
            ? 'Your data is stored in the cloud (Firebase) and syncs across devices — a JSON export is just an extra offline copy you can keep for safety.'
            : 'When you receive a new version of this app, ALWAYS export a backup first, then import it after replacing files. Your data lives in this browser only.'}
        </div>
      </div>
      <button class="btn primary sm" id="dash-backup-now">💾 Backup now</button>
      <button class="btn ghost sm" onclick="navigate('settings')">⚙️ Settings</button>
    </div>
  `;

  // Post-render
  drawRevenueChart();
  drawSportDonut();
  drawCoachLeaderboard();
  drawRecentInvoices();

  $('#refresh-btn').addEventListener('click', () => { render(); toast('Refreshed'); });
  $('#export-btn').addEventListener('click', exportDashboardCSV);
  const dashBackup = $('#dash-backup-now');
  if (dashBackup) dashBackup.addEventListener('click', () => window.downloadBackup());
};

// ─── Revenue chart (bars) ───────────────────────────────────
function drawRevenueChart() {
  const s = computeStats();
  const container = $('#rev-chart');
  const maxVal = Math.max(s.aprRevenue, s.mayRevenue, s.aprExpenses + s.aprSalaries, s.mayExpenses + s.maySalaries, 1);

  const months = [
    { label: fmtMonth(s.prevMonth), rev: s.prevRevenue, exp: s.prevExpenses + s.prevSalaries, profit: s.prevProfit },
    { label: fmtMonth(s.currMonth), rev: s.currRevenue, exp: s.currExpenses + s.currSalaries, profit: s.currProfit },
  ];

  container.innerHTML = `
    <div style="display:flex;gap:24px;height:280px;align-items:flex-end;padding:30px 16px 32px">
      ${months.map(m => `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;height:100%;position:relative">
          <div style="display:flex;gap:8px;align-items:flex-end;height:100%;width:100%;justify-content:center">
            <div style="width:42px;background:linear-gradient(180deg,var(--green) 0%,#0ea874 100%);height:${(m.rev/maxVal*100).toFixed(1)}%;border-radius:6px 6px 0 0;position:relative">
              <div style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);font-size:11px;font-weight:600;white-space:nowrap">${fmt(m.rev)}</div>
            </div>
            <div style="width:42px;background:linear-gradient(180deg,var(--accent-2) 0%,#d18a26 100%);height:${(m.exp/maxVal*100).toFixed(1)}%;border-radius:6px 6px 0 0;position:relative">
              <div style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);font-size:11px;font-weight:600;white-space:nowrap">${fmt(m.exp)}</div>
            </div>
            <div style="width:42px;background:linear-gradient(180deg,${m.profit>=0?'var(--blue)':'var(--red)'} 0%,${m.profit>=0?'#3870d0':'#c93535'} 100%);height:${(Math.abs(m.profit)/maxVal*100).toFixed(1)}%;border-radius:6px 6px 0 0;position:relative">
              <div style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);font-size:11px;font-weight:600;white-space:nowrap;color:${m.profit>=0?'var(--blue)':'var(--red)'}">${fmt(m.profit)}</div>
            </div>
          </div>
          <div style="margin-top:10px;font-size:12px;color:var(--text-dim);font-weight:500">${m.label}</div>
        </div>
      `).join('')}
    </div>
    <div style="display:flex;gap:16px;justify-content:center;padding:8px 0 4px;border-top:1px solid var(--border)">
      <div class="legend-item"><div class="legend-swatch" style="background:var(--green)"></div><span style="font-size:12px">Revenue</span></div>
      <div class="legend-item"><div class="legend-swatch" style="background:var(--accent-2)"></div><span style="font-size:12px">Expenses</span></div>
      <div class="legend-item"><div class="legend-swatch" style="background:var(--blue)"></div><span style="font-size:12px">Profit</span></div>
    </div>
  `;
}

// ─── Sport donut chart (SVG) ────────────────────────────────
function drawSportDonut() {
  const container = $('#sport-chart');
  const breakdown = {};
  for (const m of state.members.filter(x => isActiveStatus(x))) {
    breakdown[m.sport] = (breakdown[m.sport] || 0) + 1;
  }
  const sorted = Object.entries(breakdown).sort((a,b) => b[1] - a[1]);
  const total = sorted.reduce((s, [_, n]) => s+n, 0);

  const COLORS = ['#f26060','#5b8def','#10b981','#f2a33c','#8b5cf6','#06b6d4','#ec4899','#d4af37'];

  // SVG donut
  const cx = 80, cy = 80, r = 60, sw = 22;
  let angle = -Math.PI / 2;
  const arcs = sorted.map(([sport, count], i) => {
    const slice = (count / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle + slice);
    const y2 = cy + r * Math.sin(angle + slice);
    const large = slice > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    angle += slice;
    return `<path d="${path}" fill="${COLORS[i % COLORS.length]}" />`;
  }).join('');

  container.innerHTML = `
    <div class="donut-row">
      <svg class="donut" viewBox="0 0 160 160">
        ${arcs}
        <circle cx="${cx}" cy="${cy}" r="${r-sw}" fill="var(--surface)" />
        <text x="${cx}" y="${cy-4}" text-anchor="middle" font-size="28" font-weight="700" fill="var(--text)">${total}</text>
        <text x="${cx}" y="${cy+14}" text-anchor="middle" font-size="10" fill="var(--text-mute)" text-transform="uppercase">Active</text>
      </svg>
      <div class="donut-legend">
        ${sorted.map(([sport, n], i) => `
          <div class="legend-item">
            <div class="legend-swatch" style="background:${COLORS[i % COLORS.length]}"></div>
            <span class="legend-label">${sport}</span>
            <span class="legend-value">${n}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ─── Coach leaderboard ───────────────────────────────────────
function drawCoachLeaderboard() {
  const container = $('#coach-leaderboard');
  const counts = {};
  for (const m of state.members.filter(x => isActiveStatus(x))) {
    counts[m.coachId] = (counts[m.coachId] || 0) + 1;
  }
  const sorted = state.coaches
    .map(c => ({ ...c, count: counts[c.id] || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const max = sorted[0]?.count || 1;

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px;padding-top:4px">
      ${sorted.map((c, i) => `
        <div style="display:flex;align-items:center;gap:10px">
          <div class="avatar" style="width:28px;height:28px;font-size:11px;background:linear-gradient(135deg,${['#f26060','#5b8def','#10b981','#f2a33c','#8b5cf6','#06b6d4','#ec4899','#d4af37'][i % 8]},${['#c93535','#3870d0','#0ea874','#d18a26','#7c4ce0','#0494b1','#d13d8a','#b89030'][i % 8]})">${initials(c.name)}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px">
              <div style="font-size:13px;font-weight:500">${escapeHtml(c.name)}</div>
              <div style="font-size:12px;color:var(--text-dim)">${c.count} <span style="color:var(--text-mute);font-size:10px">students · ${c.rate}%</span></div>
            </div>
            <div style="height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${(c.count/max*100).toFixed(1)}%;background:linear-gradient(90deg,var(--accent),var(--accent-2));border-radius:3px"></div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── Recent invoices ────────────────────────────────────────
function drawRecentInvoices() {
  const container = $('#recent-invoices');
  const recent = [...state.invoices].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 8);

  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Customer</th><th>Activity</th><th class="text-right">Amount</th></tr></thead>
        <tbody>
          ${recent.map(i => {
            const isRental = i.activityType === 'rental';
            const sportLabel = isRental ? '🏟 Rental' : (i.sport || '—');
            const cust = i.customerName || i.description.split(/\s/).slice(0, 2).join(' ');
            return `
              <tr>
                <td class="text-dim" style="white-space:nowrap">${fmtDate(i.date)}</td>
                <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(cust)}</td>
                <td>${i.sport ? `<span class="badge ${isRental ? 'pending' : ''}" style="font-size:10px">${escapeHtml(sportLabel)}</span>` : '<span class="text-mute">—</span>'}</td>
                <td class="text-right num font-bold">${fmt(i.amount)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ─── Export dashboard CSV ──────────────────────────────────
function exportDashboardCSV() {
  const s = computeStats();
  const rows = [
    ['Metric', fmtMonth(s.prevMonth), fmtMonth(s.currMonth), 'Change'],
    ['Revenue (QAR)', s.prevRevenue, s.currRevenue, s.currRevenue - s.prevRevenue],
    ['Operating Expenses (QAR)', s.prevExpenses, s.currExpenses, s.currExpenses - s.prevExpenses],
    ['Salaries & Commissions (QAR)', s.prevSalaries, s.currSalaries, s.currSalaries - s.prevSalaries],
    ['Sales — gear (QAR)', s.prevSales, s.currSales, s.currSales - s.prevSales],
    ['Net Profit (QAR)', s.prevProfit, s.currProfit, s.currProfit - s.prevProfit],
    ['Active Members', s.activeMembers, s.activeMembers, 0],
    ['Total Members', s.totalMembers, s.totalMembers, 0],
  ];
  const csv = rows.map(r => r.join(',')).join('\n');
  downloadFile('blackstars-dashboard.csv', csv, 'text/csv');
  toast('Exported dashboard.csv');
}

function downloadFile(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename, style: { display: 'none' }});
  document.body.append(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 100);
}

// ─── MEMBERS ──────────────────────────────────────────────────
PAGES.members = (main) => {
  let filter = loadFilter('members', { search: '', status: 'all', sports: [], coach: 'all', nationality: 'all', incomplete: 'all' });
  if (!Array.isArray(filter.sports)) filter.sports = filter.sport && filter.sport !== 'all' ? [filter.sport] : [];  // migrate old single-sport filter
  const pg = makePager(10);
  const selected = new Set();   // member ids ticked for bulk actions (persists across pages)

  const dash = '<span class="text-mute">—</span>';
  let sort = { key: null, dir: 1 };   // active header sort (1=asc, -1=desc)

  // Attendance percentage for sorting (−1 = no data, sorts to the bottom on asc).
  function attPctVal(m) {
    const mr = (m.subscriptions || []).filter(s => s.totalClasses).slice(-1)[0];
    if (!mr) return -1;
    const live = liveAttendanceCount(m, mr.activity);
    const att = live.total > 0 ? live.y : (mr.attendedClasses || 0);
    return mr.totalClasses ? att / mr.totalClasses : -1;
  }
  function attCellHtml(m) {
    const mr = (m.subscriptions || []).filter(s => s.totalClasses).slice(-1)[0];
    if (!mr) return dash;
    const live = liveAttendanceCount(m, mr.activity);
    const att = live.total > 0 ? live.y : (mr.attendedClasses || 0);
    const pct = mr.totalClasses ? Math.round(att / mr.totalClasses * 100) : null;
    const color = pct == null ? 'var(--text-mute)' : pct >= 75 ? 'var(--green)' : pct >= 40 ? 'var(--accent-2)' : 'var(--red)';
    return `<span class="num" style="color:${color};font-weight:600">${att}/${mr.totalClasses}</span>`;
  }
  function expiryCellHtml(m) {
    if (!m.expiryDate) return dash;
    const d = daysUntil(m.expiryDate);
    const soon = state.settings?.expiringSoonDays || 3;
    const color = d == null ? 'inherit' : d < 0 ? 'var(--red)' : d <= soon ? 'var(--accent-2)' : 'inherit';
    const suffix = d == null ? '' : d < 0 ? ` <span style="font-size:10px;color:var(--red)">(${Math.abs(d)}d ago)</span>`
      : d <= soon ? ` <span style="font-size:10px;color:var(--accent-2);font-weight:600">⚠ ${d}d</span>` : '';
    return `<span style="color:${color}">${fmtDate(m.expiryDate)}</span>${suffix}`;
  }
  const distinct = (vals) => Array.from(new Set(vals.filter(v => v != null && String(v).trim() !== ''))).sort();

  // ── ONE source of truth for every members-table column ──
  // always:true → can't be hidden (English name). def → visible by default.
  // filter: 'fuzzy' | 'text' | 'select' | 'date' | null. opts() supplies <select> values.
  function allColumns() {
    return [
      { key: 'name', label: 'Member', always: true, def: true, filter: 'fuzzy',
        sortVal: m => (m.name || '').toLowerCase(),
        getVal: m => m.name || '',
        cell: m => `<div style="display:flex;align-items:center;gap:10px">
            <div class="avatar" style="width:32px;height:32px;font-size:11px;background:linear-gradient(135deg,var(--blue),var(--purple))">${initials(m.name)}</div>
            <div><div style="font-weight:600">${escapeHtml(m.name)}</div>
            <div class="text-mute" style="font-size:11px">${isRealPhone(m.phone) ? phoneCell(m.phone) : (m.email ? escapeHtml(m.email) : '')}</div></div>
          </div>` },
      { key: 'arabicName', label: 'Arabic Name', def: true, filter: 'fuzzy',
        sortVal: m => (m.nameArabic || ''), getVal: m => m.nameArabic || '',
        cell: m => m.nameArabic ? `<span dir="rtl">${escapeHtml(m.nameArabic)}</span>` : dash },
      { key: 'qid', label: 'QID', def: false, filter: 'text',
        sortVal: m => (m.qid || ''), getVal: m => m.qid || '',
        cell: m => m.qid ? escapeHtml(m.qid) : dash },
      { key: 'nationality', label: 'Nationality', def: false, filter: 'select',
        opts: () => distinct(state.members.map(x => x.nationality)),
        sortVal: m => (m.nationality || '').toLowerCase(), getVal: m => m.nationality || '',
        cell: m => m.nationality ? escapeHtml(m.nationality) : dash },
      { key: 'email', label: 'Email', def: false, filter: 'text',
        sortVal: m => (m.email || '').toLowerCase(), getVal: m => m.email || '',
        cell: m => m.email ? escapeHtml(m.email) : dash },
      { key: 'phone2', label: 'Phone 2', def: false, filter: 'text',
        sortVal: m => (m.phone2 || ''), getVal: m => m.phone2 || '',
        cell: m => isRealPhone(m.phone2) ? phoneCell(m.phone2) : dash },
      { key: 'joinDate', label: 'Joined', def: false, filter: 'date',
        sortVal: m => (m.joinDate || ''), getVal: m => m.joinDate || '',
        cell: m => m.joinDate ? fmtDate(m.joinDate) : dash },
      { key: 'level', label: 'Level', def: false, filter: 'select',
        opts: () => distinct(state.members.map(x => x.level)),
        sortVal: m => (m.level || '').toLowerCase(), getVal: m => m.level || '',
        cell: m => m.level ? escapeHtml(m.level) : dash },
      { key: 'birthdate', label: 'Birthdate', def: false, filter: 'date',
        sortVal: m => (m.birthdate || ''), getVal: m => m.birthdate || '',
        cell: m => m.birthdate ? fmtDate(m.birthdate) : dash },
      { key: 'outstanding', label: 'Outstanding', def: false, filter: null, num: true,
        sortVal: m => (typeof memberOutstanding === 'function' ? memberOutstanding(m.id) : 0),
        getVal: m => '',
        cell: m => { const o = (typeof memberOutstanding === 'function') ? memberOutstanding(m.id) : 0; return o > 0 ? `<span style="color:var(--red);font-weight:600">${fmt(o)}</span>` : dash; } },
      { key: 'sport', label: 'Sport', def: true, filter: 'select',
        opts: () => (typeof SPORTS !== 'undefined' && SPORTS.length) ? SPORTS.slice() : distinct(state.members.map(x => x.sport)),
        sortVal: m => (m.sport || '').toLowerCase(),
        getVal: m => [m.sport, ...((m.enrollments || []).map(e => e.sport))].filter(Boolean).join(' '),
        cell: m => `${escapeHtml(m.sport)}${(m.enrollments && m.enrollments.length > 1) ? ` <span class="badge blue" style="font-size:9px;padding:1px 5px" title="${m.enrollments.map(e => escapeHtml(e.sport)).join(', ')}">+${m.enrollments.length - 1}</span>` : ''}` },
      { key: 'coach', label: 'Coach', def: true, filter: 'select',
        opts: () => distinct(state.coaches.map(c => c.name)),
        sortVal: m => (coachName(m.coachId) || '').toLowerCase(),
        getVal: m => coachName(m.coachId) || '',
        cell: m => m.sport === SUMMER_CAMP && (!m.enrollments || m.enrollments.every(e => e.sport === SUMMER_CAMP)) ? '<span class="text-mute" style="font-style:italic">—</span>' : escapeHtml(coachName(m.coachId)) },
      { key: 'attendance', label: 'Attendance', def: true, filter: null, num: true,
        sortVal: m => attPctVal(m), getVal: m => '', cell: m => attCellHtml(m) },
      { key: 'lastRenewal', label: 'Last Renewal', def: true, filter: 'date',
        sortVal: m => (lastRenewalDate(m) || ''), getVal: m => lastRenewalDate(m) || '',
        cell: m => { const lr = lastRenewalDate(m); return lr ? fmtDate(lr) : dash; } },
      { key: 'expiry', label: 'Expiry', def: true, filter: 'date',
        sortVal: m => (m.expiryDate || ''), getVal: m => m.expiryDate || '',
        cell: m => expiryCellHtml(m) },
      { key: 'status', label: 'Status', def: true, filter: 'select',
        opts: () => ['Active', 'Expired', 'Frozen', 'Completed', 'Withdrawn'],
        sortVal: m => memberStatus(m).toLowerCase(), getVal: m => memberStatus(m),
        cell: m => `<span class="badge ${m.deleted ? 'pending' : memberStatus(m).toLowerCase()}">${m.deleted ? '📦 Archived' : memberStatus(m)}</span>` },
    ];
  }
  function isColVisible(c) {
    if (c.always) return true;
    const saved = state.settings && Array.isArray(state.settings.memberColsV2) ? state.settings.memberColsV2 : null;
    return saved ? saved.includes(c.key) : c.def;
  }
  function visibleColumns() { return allColumns().filter(isColVisible); }

  window.openMemberColumns = function() {
    const cols = allColumns();
    showModal({
      title: '🧩 Table columns',
      body: `<div style="font-size:13px;line-height:1.6">
        <p class="text-mute">Tick the columns to show. Only <b>Member</b> (English name + mobile) is always shown.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px">
          ${cols.map(c => `<label style="display:flex;align-items:center;gap:8px;cursor:${c.always ? 'not-allowed' : 'pointer'};opacity:${c.always ? '.6' : '1'}">
            <input type="checkbox" class="mcol-cb" value="${c.key}" ${isColVisible(c) ? 'checked' : ''} ${c.always ? 'disabled checked' : ''}> ${escapeHtml(c.label)}${c.always ? ' <span class="text-mute" style="font-size:10px">(always)</span>' : ''}
          </label>`).join('')}
        </div>
      </div>`,
      actions: [
        { label: 'Reset to default', class: 'btn ghost', onclick: () => { if (state.settings) delete state.settings.memberColsV2; save(); closeModal(); render(); } },
        { label: 'Close', class: 'btn ghost', onclick: closeModal },
        { label: 'Apply', class: 'btn primary', onclick: () => {
            const chosen = $$('.mcol-cb').filter(cb => cb.checked && !cb.disabled).map(cb => cb.value);
            if (!state.settings) state.settings = {};
            state.settings.memberColsV2 = chosen; save(); closeModal(); render();
          } },
      ],
    });
  };
  window.exportMembersChoice = function() {
    const filtered = applyFilter();
    const allActive = state.members.filter(m => !m.deleted);
    showModal({
      title: '📥 Export members',
      body: `<div style="font-size:13px;line-height:1.7">
        <p>Which members would you like to export to CSV?</p>
        <p class="text-mute">The CSV always includes the full detail set (name, Arabic name, sport, coach, phone, phone 2, email, QID, birthdate, level, joined, expiry, status).</p>
      </div>`,
      actions: [
        { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
        { label: `Filtered (${filtered.length})`, class: 'btn ghost', onclick: () => { closeModal(); exportMembersCSV(filtered); } },
        { label: `All members (${allActive.length})`, class: 'btn primary', onclick: () => { closeModal(); exportMembersCSV(allActive); } },
      ],
    });
  };

  function applyFilter(f = filter) {
    return state.members.filter(m => {
      // Archived (soft-deleted) members are hidden unless explicitly requested
      // via the status filter. Default "all" status still excludes them.
      if (m.deleted && f.status !== 'Archived') return false;
      if (!m.deleted && f.status === 'Archived') return false;
      if (f.search) {
        const raw = f.search.trim();
        const q = raw.toLowerCase();
        const hay = [m.name, m.nameArabic, m.phone, m.phone2, m.qid, m.email, m.nationality].filter(Boolean).join(' ').toLowerCase();
        let hit = hay.includes(q);
        if (!hit) {
          // Phone-aware fallback: match by digits, ignoring spaces and +974.
          const qDigits = raw.replace(/\D/g, '');
          if (qDigits.length >= 4) hit = phoneSearchMatches(m.phone, qDigits) || phoneSearchMatches(m.phone2, qDigits);
        }
        // Fuzzy (typo-tolerant) fallback on the names, e.g. "mohamed" → "Mohammed".
        if (!hit && q.length >= 3 && !/\d/.test(q)) hit = fuzzyMatch(m.name, q) || fuzzyMatch(m.nameArabic, q);
        if (!hit) return false;
      }
      if (f.status !== 'all' && f.status !== 'Archived' && memberStatus(m) !== f.status) return false;
      // Sport filter (multi-select): keep if the member is in ANY selected sport
      if (f.sports && f.sports.length) {
        const sports = new Set([m.sport, ...((m.enrollments||[]).map(e=>e.sport))].filter(Boolean));
        if (!f.sports.some(sp => sports.has(sp))) return false;
      }
      // Coach filter: check the legacy primary coachId AND every enrollment row
      if (f.coach !== 'all') {
        const cid = parseInt(f.coach);
        const coachIds = new Set([m.coachId, ...((m.enrollments||[]).map(e=>e.coachId))].filter(Boolean));
        if (!coachIds.has(cid)) return false;
      }
      if (f.nationality !== 'all' && (m.nationality || '') !== f.nationality) return false;
      // Data-quality filter: missing any of the key fields, OR a specific field
      if (f.incomplete !== 'all') {
        const hasPhone = !!(m.phone && m.phone.trim() && !m.phone.startsWith('+9747000'));
        const hasQid = !!(m.qid && m.qid.trim());
        const hasEmail = !!(m.email && m.email.trim());
        const hasBirthdate = !!(m.birthdate && m.birthdate.trim());
        const hasNationality = !!(m.nationality && m.nationality.trim());
        if (f.incomplete === 'any') {
          // Show only members missing at least one field
          if (hasPhone && hasQid && hasEmail && hasBirthdate && hasNationality) return false;
        } else if (f.incomplete === 'phone' && hasPhone) return false;
        else if (f.incomplete === 'qid' && hasQid) return false;
        else if (f.incomplete === 'email' && hasEmail) return false;
        else if (f.incomplete === 'birthdate' && hasBirthdate) return false;
        else if (f.incomplete === 'nationality' && hasNationality) return false;
      }
      return true;
    });
  }

  function refresh() {
    let allRows = applyFilter();
    const cols = visibleColumns();
    // Header sort
    if (sort.key) {
      const d = cols.find(x => x.key === sort.key);
      if (d) allRows = allRows.slice().sort((a, b) => {
        let va = d.sortVal(a), vb = d.sortVal(b);
        if (d.num) { va = +va || 0; vb = +vb || 0; return (va - vb) * sort.dir; }
        return String(va).localeCompare(String(vb)) * sort.dir;
      });
    }
    const rows = paginate(allRows, pg);

    // "Filters hiding rows" banner — same helper as the Enrolled report. The
    // baseline is the default (unfiltered) view; we clamp so the Archived view
    // (a different set, not a subset) never shows a negative count.
    const DEFAULT_F = { search: '', status: 'all', sports: [], coach: 'all', nationality: 'all', incomplete: 'all' };
    const baseline = applyFilter(DEFAULT_F).length;
    const anyFilterActive = filter.search || filter.status !== 'all' || (filter.sports && filter.sports.length) ||
      filter.coach !== 'all' || filter.nationality !== 'all' || filter.incomplete !== 'all';
    const hiddenByFilters = Math.max(0, baseline - allRows.length);
    const banner = $('#members-filter-banner');
    if (banner) {
      if (anyFilterActive && hiddenByFilters > 0) {
        banner.style.display = 'flex';
        banner.innerHTML = `
          <span style="font-size:16px">⚠️</span>
          <div style="flex:1;font-size:12px">
            Filters are hiding <b>${hiddenByFilters}</b> member${hiddenByFilters === 1 ? '' : 's'}. If you don't see someone, clear filters.
          </div>
          <button class="btn ghost sm" id="members-clear-filters" style="white-space:nowrap">↻ Clear filters</button>`;
        $('#members-clear-filters')?.addEventListener('click', () => {
          filter = { ...DEFAULT_F };
          saveFilter('members', filter);
          pg.page = 1;
          const reset = { 'search-input': '', 'filter-status': 'all', 'filter-coach': 'all', 'filter-nationality': 'all', 'filter-incomplete': 'all' };
          Object.entries(reset).forEach(([id, v]) => { const el = $('#' + id); if (el) el.value = v; });
          $$('.filter-sport-cb').forEach(cb => { cb.checked = false; });
          const sl = $('#filter-sport-label'); if (sl) sl.textContent = 'All sports';
          refresh();
        });
      } else {
        banner.style.display = 'none';
        banner.innerHTML = '';
      }
    }
    $('#members-tbody').innerHTML = rows.length ? rows.map(m => {
      return `
      <tr style="cursor:pointer" data-id="${m.id}">
        <td style="text-align:center" onclick="event.stopPropagation()"><input type="checkbox" class="member-cb" value="${m.id}" ${selected.has(m.id) ? 'checked' : ''} style="cursor:pointer"></td>
        ${cols.map(c => `<td>${c.cell(m)}</td>`).join('')}
        <td class="text-right" style="white-space:nowrap">
          ${m.deleted ? `
            <button class="btn primary sm" onclick="event.stopPropagation();restoreMember(${m.id})" title="Restore this archived member">↩ Restore</button>
            <button class="btn ghost sm" onclick="event.stopPropagation();permanentlyDeleteMember(${m.id})" title="Permanently delete — cannot be undone" style="color:var(--red)">🗑 Delete forever</button>
          ` : `
            <button class="btn ghost sm" onclick="event.stopPropagation();addRenewal(${m.id})" title="Record renewal">🔄</button>
            <button class="btn ghost sm" onclick="event.stopPropagation();switchSport(${m.id})" title="Switch sport / change coach">🔀</button>
            <button class="btn ghost sm" onclick="event.stopPropagation();duplicateMember(${m.id})" title="Add sibling — copy ALL details to a new member">⧉</button>
            <button class="btn ghost sm" onclick="event.stopPropagation();editMember(${m.id})">✏️</button>
            <button class="btn ghost sm" onclick="event.stopPropagation();deleteMember(${m.id})" title="Archive (soft delete)">🗑</button>
          `}
        </td>
      </tr>`;
    }).join('') : `<tr><td colspan="${cols.length + 2}" class="empty"><div class="empty-icon">👥</div>No members match your filters</td></tr>`;

    $('#members-count').textContent = `${allRows.length} of ${state.members.length}`;

    // Pagination bar
    $('#members-pagination').innerHTML = paginationBar(pg, allRows.length, 'members');
    bindPagination('members', pg, allRows.length, refresh);

    $$('#members-tbody tr[data-id]').forEach(tr => {
      tr.addEventListener('click', () => viewMember(parseInt(tr.dataset.id)));
    });

    // ── Bulk selection wiring (tbody is rebuilt each refresh) ──
    const updateBulkBar = () => {
      const cnt = $('#members-bulk-count');
      if (cnt) cnt.textContent = String(selected.size);
      const bar = $('#members-bulkbar');
      if (bar) bar.style.display = selected.size ? 'flex' : 'none';
      const pageIds = rows.map(m => m.id);
      const sa = $('#members-select-all');
      if (sa) {
        const onPage = pageIds.filter(id => selected.has(id)).length;
        sa.checked = pageIds.length > 0 && onPage === pageIds.length;
        sa.indeterminate = onPage > 0 && onPage < pageIds.length;
      }
    };
    $$('#members-tbody .member-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = parseInt(cb.value);
        if (cb.checked) selected.add(id); else selected.delete(id);
        updateBulkBar();
      });
    });
    const selectAll = $('#members-select-all');
    if (selectAll) {
      selectAll.onchange = () => {
        rows.forEach(m => { if (selectAll.checked) selected.add(m.id); else selected.delete(m.id); });
        $$('#members-tbody .member-cb').forEach(cb => { cb.checked = selectAll.checked; });
        updateBulkBar();
      };
    }
    updateBulkBar();

    // Reflect the active sort on the column arrows (header is static across refreshes)
    $$('.sort-ind').forEach(s => {
      const k = s.getAttribute('data-k');
      if (sort.key === k) { s.textContent = sort.dir > 0 ? '▲' : '▼'; s.style.opacity = '1'; }
      else { s.textContent = '⇅'; s.style.opacity = '.35'; }
    });
  }

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Members</h1>
        <div class="subtitle"><span id="members-count">${state.members.length} of ${state.members.length}</span> · ${(() => {
          const a = state.members.filter(m => memberStatus(m) === 'Active').length;
          const e = state.members.filter(m => memberStatus(m) === 'Expired').length;
          const f = state.members.filter(m => memberStatus(m) === 'Frozen').length;
          const c = state.members.filter(m => memberStatus(m) === 'Completed').length;
          const w = state.members.filter(m => memberStatus(m) === 'Withdrawn').length;
          const parts = [
            `<span style="color:var(--green)">${a} active</span>`,
            `<span style="color:var(--red)">${e} expired</span>`,
          ];
          if (f) parts.push(`<span style="color:var(--blue)">❄️ ${f} frozen</span>`);
          if (c) parts.push(`<span style="color:var(--purple)">${c} completed</span>`);
          if (w) parts.push(`<span style="color:var(--accent-2)">↩ ${w} withdrawn</span>`);
          return parts.join(' · ');
        })()}</div>
      </div>
      <div class="topbar-actions">
        <button class="btn ghost" id="find-duplicates" title="Scan all members for duplicate phone numbers">🔍 Find Duplicates</button>
        <button class="btn ghost" id="member-columns" title="Show / hide table columns">🧩 Columns</button>
        <button class="btn ghost" id="export-members">📥 Export CSV</button>
        <button class="btn primary" id="add-member">+ Add Member</button>
      </div>
    </div>

    <div style="background:rgba(91,141,239,.08);border:1px solid rgba(91,141,239,.25);border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px;font-size:12px;color:var(--text-dim)">
      <span style="font-size:16px">💡</span>
      <div style="flex:1">
        Use <strong>+ Add Member</strong> for new registrations. For existing members paying again, click the <strong>🔄</strong> button or open the <strong style="color:var(--blue);cursor:pointer" onclick="navigate('history')">History page</strong>.
      </div>
    </div>

    ${(() => {
      const recent = getRecentMembers();
      if (!recent.length) return '';
      return `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:11px;color:var(--text-mute);flex-wrap:wrap">
          <span style="text-transform:uppercase;letter-spacing:.6px;font-weight:600">🕐 Recent</span>
          ${recent.map(m => `<a href="#" onclick="event.preventDefault();viewMember(${m.id})" style="color:var(--blue);text-decoration:none;background:rgba(91,141,239,.08);padding:4px 10px;border-radius:999px;font-weight:500;font-size:11px" title="View ${escapeHtml(m.name)}">${escapeHtml(m.name)}</a>`).join('')}
        </div>
      `;
    })()}

    <div class="card">
      <div id="members-filter-banner" style="display:none;align-items:center;gap:10px;padding:10px 14px;margin-bottom:12px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);border-radius:8px"></div>
      <div id="members-bulkbar" style="display:none;align-items:center;gap:10px;padding:10px 14px;margin-bottom:12px;background:rgba(91,141,239,.10);border:1px solid rgba(91,141,239,.30);border-radius:8px">
        <span style="font-size:16px">☑️</span>
        <div style="flex:1;font-size:13px;font-weight:600"><span id="members-bulk-count">0</span> selected</div>
        <button class="btn ghost sm" id="members-bulk-export" title="Export the selected members to CSV">📥 Export selected</button>
        <button class="btn ghost sm" id="members-bulk-archive" title="Archive (soft-delete) the selected members" style="color:var(--red)">🗑 Archive selected</button>
        <button class="btn ghost sm" id="members-bulk-clear">Clear</button>
      </div>
      <div class="filter-bar">
        <div class="search"><input id="search-input" type="text" placeholder="Search name, phone, QID, email..." value="${escapeHtml(filter.search || '')}" /></div>
        <select id="filter-status" class="btn ghost">
          <option value="all" ${filter.status === 'all' ? 'selected' : ''}>All status</option>
          <option value="Active" ${filter.status === 'Active' ? 'selected' : ''}>Active</option>
          <option value="Completed" ${filter.status === 'Completed' ? 'selected' : ''}>Completed</option>
          <option value="Frozen" ${filter.status === 'Frozen' ? 'selected' : ''}>❄️ Frozen</option>
          <option value="Expired" ${filter.status === 'Expired' ? 'selected' : ''}>Expired</option>
          <option value="Withdrawn" ${filter.status === 'Withdrawn' ? 'selected' : ''}>↩ Withdrawn</option>
          <option value="Archived" ${filter.status === 'Archived' ? 'selected' : ''}>📦 Archived</option>
        </select>
        <div style="position:relative">
          <button type="button" id="filter-sport-btn" class="btn ghost" style="min-width:140px;text-align:left;display:inline-flex;align-items:center;justify-content:space-between;gap:8px" title="Filter by one or more sports">
            <span id="filter-sport-label">${filter.sports && filter.sports.length ? (filter.sports.length === 1 ? escapeHtml(filter.sports[0]) : filter.sports.length + ' sports') : 'All sports'}</span>
            <span style="opacity:.6">▾</span>
          </button>
          <div id="filter-sport-menu" style="display:none;position:absolute;left:0;top:100%;z-index:50;background:var(--surface);border:1px solid var(--border);border-radius:8px;margin-top:4px;padding:8px;min-width:180px;max-height:300px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,.4)">
            ${SPORTS.map(s => `<label style="display:flex;align-items:center;gap:8px;padding:5px 6px;cursor:pointer;font-size:13px"><input type="checkbox" class="filter-sport-cb" value="${escapeHtml(s)}" ${(filter.sports||[]).includes(s) ? 'checked' : ''} /> ${escapeHtml(s)}</label>`).join('')}
          </div>
        </div>
        <select id="filter-coach" class="btn ghost">
          <option value="all" ${filter.coach === 'all' ? 'selected' : ''}>All coaches</option>
          ${state.coaches.map(c => `<option value="${c.id}" ${String(filter.coach) === String(c.id) ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
        <select id="filter-nationality" class="btn ghost">
          <option value="all" ${filter.nationality === 'all' ? 'selected' : ''}>🌍 All nationalities</option>
          ${[...new Set(state.members.map(m => m.nationality).filter(Boolean))].sort().map(n => `<option value="${escapeHtml(n)}" ${filter.nationality === n ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('')}
        </select>
        <select id="filter-incomplete" class="btn ghost" title="Find records missing key fields">
          <option value="all" ${filter.incomplete === 'all' ? 'selected' : ''}>📋 All data</option>
          <option value="any" ${filter.incomplete === 'any' ? 'selected' : ''}>⚠️ Missing any field</option>
          <option value="phone" ${filter.incomplete === 'phone' ? 'selected' : ''}>⚠️ No phone</option>
          <option value="qid" ${filter.incomplete === 'qid' ? 'selected' : ''}>⚠️ No QID</option>
          <option value="email" ${filter.incomplete === 'email' ? 'selected' : ''}>⚠️ No email</option>
          <option value="birthdate" ${filter.incomplete === 'birthdate' ? 'selected' : ''}>⚠️ No birthdate</option>
          <option value="nationality" ${filter.incomplete === 'nationality' ? 'selected' : ''}>⚠️ No nationality</option>
        </select>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:36px;text-align:center"><input type="checkbox" id="members-select-all" title="Select/clear all on this page" style="cursor:pointer"></th>
              ${visibleColumns().map(c => `
                <th data-sortkey="${c.key}" style="cursor:pointer;user-select:none" title="Sort by ${escapeHtml(c.label)}">
                  <div style="display:flex;align-items:center;gap:4px;white-space:nowrap">${escapeHtml(c.label)} <span class="sort-ind" data-k="${c.key}" style="opacity:.35;font-size:10px">⇅</span></div>
                </th>`).join('')}
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody id="members-tbody"></tbody>
        </table>
      </div>
      <div id="members-pagination"></div>
    </div>
  `;

  // Wrap refresh to also persist filter for restoring on return
  const refreshAndSave = () => { saveFilter('members', filter); refresh(); };

  $('#search-input').addEventListener('input', e => { filter.search = e.target.value; pg.page = 1; refreshAndSave(); });
  $('#filter-status').addEventListener('change', e => { filter.status = e.target.value; pg.page = 1; refreshAndSave(); });
  // Multi-select sport filter
  const fSportBtn = $('#filter-sport-btn');
  const fSportMenu = $('#filter-sport-menu');
  if (fSportBtn && fSportMenu) {
    fSportBtn.addEventListener('click', e => { e.stopPropagation(); fSportMenu.style.display = fSportMenu.style.display === 'none' ? 'block' : 'none'; });
    document.addEventListener('click', e => { if (!fSportBtn.contains(e.target) && !fSportMenu.contains(e.target)) fSportMenu.style.display = 'none'; });
    $$('.filter-sport-cb').forEach(cb => cb.addEventListener('change', () => {
      filter.sports = $$('.filter-sport-cb').filter(x => x.checked).map(x => x.value);
      const n = filter.sports.length;
      $('#filter-sport-label').textContent = n === 0 ? 'All sports' : (n === 1 ? filter.sports[0] : n + ' sports');
      pg.page = 1;
      refreshAndSave();
    }));
  }
  $('#filter-coach').addEventListener('change', e => { filter.coach = e.target.value; pg.page = 1; refreshAndSave(); });
  $('#filter-nationality').addEventListener('change', e => { filter.nationality = e.target.value; pg.page = 1; refreshAndSave(); });
  $('#filter-incomplete').addEventListener('change', e => { filter.incomplete = e.target.value; pg.page = 1; refreshAndSave(); });
  $('#add-member').addEventListener('click', () => addMember());
  $('#export-members').addEventListener('click', () => exportMembersChoice());
  const colBtn = $('#member-columns'); if (colBtn) colBtn.addEventListener('click', () => openMemberColumns());
  $('#find-duplicates').addEventListener('click', showDuplicatesModal);

  // ── Header sort (click a column) ──
  $$('thead th[data-sortkey]').forEach(th => {
    th.addEventListener('click', () => {
      const k = th.getAttribute('data-sortkey');
      if (sort.key === k) sort.dir = -sort.dir; else { sort.key = k; sort.dir = 1; }
      pg.page = 1; refresh();
    });
  });

  // Bulk action bar (static elements — wired once)
  $('#members-bulk-clear').addEventListener('click', () => { selected.clear(); refresh(); });
  $('#members-bulk-export').addEventListener('click', () => {
    exportMembersCSV(state.members.filter(m => selected.has(m.id)));
  });
  $('#members-bulk-archive').addEventListener('click', () => {
    const list = state.members.filter(m => selected.has(m.id) && !m.deleted);
    if (!list.length) { toast('No active members selected to archive', 'error'); return; }
    if (!confirm(`Archive ${list.length} member${list.length === 1 ? '' : 's'}?\n\nThis is a soft delete — no data is destroyed. They can be restored anytime from the Members page → status filter "Archived".`)) return;
    const ts = new Date().toISOString();
    list.forEach(m => {
      m.deleted = true;
      m.deletedAt = ts;
      m.deletedReason = 'Bulk archive';
      audit('member.archive', `member:${m.id}`, `Archived ${m.name} (bulk)`, { memberId: m.id, name: m.name, reason: 'Bulk archive' });
    });
    selected.clear();
    save();
    refresh();
    toast(`📦 Archived ${list.length} member${list.length === 1 ? '' : 's'} · history preserved`);
  });

  refresh();
};

// ─── DUPLICATES MODAL ────────────────────────────────────────────
// Shows all clusters of members that share the same phone (normalized).
// Each cluster row gives admin a one-click view of all suspects so they
// can decide whether to archive duplicates or merge their history.
function showDuplicatesModal() {
  const clusters = findAllDuplicateMembers();
  if (!clusters.length) {
    showModal({
      title: '🔍 Duplicate Scan',
      body: `
        <div style="text-align:center;padding:30px 20px">
          <div style="font-size:48px;margin-bottom:14px">✅</div>
          <div style="font-size:16px;font-weight:600;margin-bottom:6px">No duplicates found</div>
          <div class="text-mute" style="font-size:13px">All ${activeMembers().length} active members have unique phone numbers.</div>
        </div>
      `,
      actions: [{ label: 'Close', class: 'btn primary', onclick: closeModal }],
    });
    return;
  }

  // Sort clusters: largest first, then alphabetical
  clusters.sort((a, b) => b.length - a.length || (a[0].name || '').localeCompare(b[0].name || ''));

  const totalDupes = clusters.reduce((s, c) => s + c.length, 0);
  const archivedCount = clusters.reduce((s, c) => s + c.filter(m => m.deleted).length, 0);

  const clustersHtml = clusters.map((cluster, idx) => {
    const phone = cluster[0].phone;  // representative
    const rowsHtml = cluster.map(m => {
      const archived = m.deleted ? ' <span class="badge" style="background:rgba(245,158,11,.15);color:var(--accent-2);font-size:9px;padding:1px 6px">📦 ARCHIVED</span>' : '';
      const status = m.deleted ? '—' : memberStatus(m);
      const stClass = m.deleted ? '' : status.toLowerCase();
      // Show sport + coach + expiry to help admin decide which one is "real"
      const sport = m.sport || (m.enrollments?.[0]?.sport) || '—';
      const lastSeen = m.expiryDate ? fmtDate(m.expiryDate) : (m.joinDate ? fmtDate(m.joinDate) : '—');
      return `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid var(--border)">
            <div style="font-weight:600">${escapeHtml(m.name)}${m.nameArabic ? ` · <span class="text-mute" style="font-weight:normal" dir="rtl">${escapeHtml(m.nameArabic)}</span>` : ''}${archived}</div>
            <div class="text-mute" style="font-size:11px">${escapeHtml(sport)} · ${escapeHtml(coachName(m.coachId))}${m.qid ? ' · QID ' + escapeHtml(m.qid) : ''}</div>
          </td>
          <td style="padding:8px 10px;border-bottom:1px solid var(--border);font-size:11px" class="text-mute">${escapeHtml(m.phone || '')}</td>
          <td style="padding:8px 10px;border-bottom:1px solid var(--border);font-size:11px">${m.deleted ? '<span class="text-mute">archived</span>' : `<span class="badge ${stClass}" style="font-size:10px">${status}</span>`}</td>
          <td style="padding:8px 10px;border-bottom:1px solid var(--border);font-size:11px" class="text-mute">${lastSeen}</td>
          <td style="padding:8px 10px;border-bottom:1px solid var(--border);text-align:right;white-space:nowrap">
            <button class="btn ghost sm" onclick="closeModal();viewMember(${m.id})" title="Open profile">👁 View</button>
            ${m.deleted
              ? `<button class="btn ghost sm" onclick="closeModal();restoreMember(${m.id})" title="Restore archived" style="color:var(--green)">↩ Restore</button>
                 <button class="btn ghost sm" onclick="closeModal();permanentlyDeleteMember(${m.id})" title="Permanently delete — cannot be undone" style="color:var(--red)">🗑 Delete forever</button>`
              : `<button class="btn ghost sm" onclick="closeModal();deleteMember(${m.id})" title="Archive (soft delete)" style="color:var(--red)">📦 Archive</button>`}
          </td>
        </tr>
      `;
    }).join('');
    return `
      <div style="border:1px solid var(--border);border-radius:10px;margin-bottom:14px;overflow:hidden">
        <div style="padding:10px 14px;background:var(--surface-2);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:700;font-size:13px">Cluster ${idx + 1} · ${cluster.length} members share name + phone <code style="background:var(--surface);padding:2px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:12px">${escapeHtml(phone || '—')}</code></div>
            <div class="text-mute" style="font-size:11px;margin-top:2px">Review each one. Keep the legitimate record, archive the rest.</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }).join('');

  showModal({
    title: `🔍 Duplicate Scan — ${clusters.length} cluster${clusters.length === 1 ? '' : 's'} found`,
    wide: true,
    body: `
      <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:8px;padding:12px 14px;margin-bottom:14px;font-size:12px;display:flex;gap:10px;align-items:flex-start">
        <span style="font-size:18px">⚠️</span>
        <div style="flex:1;line-height:1.6">
          <b>${totalDupes} members in ${clusters.length} cluster${clusters.length === 1 ? '' : 's'}</b> share both a phone number and a name${archivedCount ? ` (${archivedCount} already archived)` : ''} — these are very likely the same person entered more than once. (Members who share only a phone but have different names — e.g. a family — are not shown here.)<br>
          For each cluster, decide which record is the real one. Archive the others — their invoices and attendance history stay intact.
        </div>
      </div>
      ${clustersHtml}
    `,
    actions: [
      { label: 'Close', class: 'btn primary', onclick: closeModal },
    ],
  });
}
window.showDuplicatesModal = showDuplicatesModal;

function viewMember(id) {
  const m = state.members.find(x => x.id === id);
  if (!m) return;
  // Track in recently-viewed list (top 5 in sessionStorage)
  pushRecentMember(id);
  // Merge subscriptions + standalone renewals (older imports). New renewals
  // since v77 are pushed to subscriptions[] directly, so this guards against
  // legacy data where renewals[] entries lack a matching subscription row.
  const subRids = new Set((m.subscriptions || []).map(s => s._rid).filter(Boolean));
  const standaloneRenewals = (m.renewals || [])
    .filter(r => !r._rid || !subRids.has(r._rid))
    .map(r => ({ ...r, manual: true, month: ymToShort((r.start || '').slice(0,7)) || (r.start || '').slice(0,7) }));
  const allSubs = [
    ...(m.subscriptions || []),
    ...standaloneRenewals,
  ].sort((a, b) => (b.start || '').localeCompare(a.start || ''));

  const subs = allSubs.map(s => {
    const total = s.totalClasses;
    // Live count for this sport — falls back to static field if no marks yet
    const liveForSport = liveAttendanceCount(m, s.activity);
    const attended = liveForSport.total > 0 ? liveForSport.y : s.attendedClasses;
    const isLive = liveForSport.total > 0;
    const pct = total && attended != null ? Math.round((attended / total) * 100) : null;
    const attCell = total ? `
      <div style="min-width:140px">
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
          <span class="font-bold">${attended ?? 0} / ${total}${isLive ? ' <span style="color:var(--green);font-weight:400" title="From attendance grid">●</span>' : ''}</span>
          ${pct != null ? `<span class="text-dim">${pct}%</span>` : ''}
        </div>
        <div style="height:4px;background:var(--surface-2);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${pct || 0}%;background:${pct >= 75 ? 'var(--green)' : pct >= 40 ? 'var(--accent-2)' : 'var(--red)'};border-radius:2px"></div>
        </div>
      </div>` : '<span class="text-mute">—</span>';
    return `
      <tr>
        <td><span class="badge blue">${(s.month || '').toUpperCase()}</span></td>
        <td>${escapeHtml(s.activity || '—')}${s.activity === SUMMER_CAMP && s.durationLabel ? ` <span class="badge" style="background:rgba(245,158,11,.15);color:var(--accent-2);font-size:9px;padding:1px 6px">🌞 ${escapeHtml(s.durationLabel)}</span>` : ''}</td>
        <td>${s.activity === SUMMER_CAMP ? '<span class="text-mute" style="font-size:11px;font-style:italic">no coach</span>' : escapeHtml(s.coach || '—')}</td>
        <td>${s.start ? fmtDate(s.start) : '—'}</td>
        <td>${s.end ? fmtDate(s.end) : '—'}</td>
        <td>${attCell}</td>
        <td class="text-right num">${s.amountPaid ? fmt(s.amountPaid) : '—'}</td>
        <td>${s.status ? `<span class="badge ${s.status.toLowerCase()==='expired'?'expired':'active'}">${s.status}</span>` : '—'}</td>
      </tr>
    `;
  }).join('');

  // Aggregate stats — live attendance count if any cells marked, fallback to subscription rows
  const totalSubs = allSubs.length;
  const totalClassesSum = allSubs.reduce((s,x) => s + (x.totalClasses || 0), 0);
  const attendedSum = attendedClassesFor(m);
  const paidSum = allSubs.reduce((s,x) => s + (x.amountPaid || 0), 0);
  const liveCount = liveAttendanceCount(m);   // for display: show breakdown if marks exist

  showModal({
    title: `Member: ${escapeHtml(m.name)}`,
    body: `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
        <div class="avatar" style="width:64px;height:64px;font-size:24px;background:linear-gradient(135deg,var(--blue),var(--purple))">${initials(m.name)}</div>
        <div>
          <div style="font-size:18px;font-weight:700">${escapeHtml(m.name)}</div>
          ${m.nameArabic ? `<div style="font-size:14px;color:var(--text-dim)" dir="rtl">${escapeHtml(m.nameArabic)}</div>` : ''}
          <div class="text-dim">${escapeHtml(m.sport)} · ${escapeHtml(coachName(m.coachId))}${m.level ? ` · ${escapeHtml(m.level)}` : ''}${m.nationality ? ` · 🌍 ${escapeHtml(m.nationality)}` : ''}</div>
          ${(m.enrollments && m.enrollments.length > 1) ? `<div class="mt-1" style="display:flex;flex-wrap:wrap;gap:6px">${m.enrollments.map(e => `<span class="badge blue" title="${escapeHtml(coachName(e.coachId))} · ${e.classes || 0} classes">${escapeHtml(e.sport)} · ${fmt(e.price)} QAR</span>`).join('')}</div>` : ''}
          ${m.siblingGroup ? `<div class="text-mute" style="font-size:11px;margin-top:4px">👨‍👩‍👧 Split from group registration: "${escapeHtml(m.siblingGroup)}"</div>` : ''}
          ${(m.renewalsBySport && Object.keys(m.renewalsBySport).length) ? `<div class="mt-1" style="display:flex;flex-wrap:wrap;gap:6px">${Object.entries(m.renewalsBySport).map(([sp, c]) => `<span class="badge" style="background:rgba(242,163,60,.15);color:var(--accent-2)" title="Renewed ${c} time${c>1?'s':''}">🔄 ${escapeHtml(sp)}: ${c}</span>`).join('')}</div>` : ''}
          ${(m.invoiceLinks && m.invoiceLinks.length) ? `<div class="text-mute" style="font-size:11px;margin-top:4px">🧾 ${m.invoiceLinks.length} invoice${m.invoiceLinks.length>1?'s':''} · ${fmt(m.invoiceLinks.reduce((a,x)=>a+(x.amount||0),0))} QAR paid${m.invoiceLinks.filter(x=>x.ref).length?' · '+m.invoiceLinks.filter(x=>x.ref).map(x=>x.ref).join(', '):''}</div>` : ''}
          <div class="mt-1"><span class="badge ${memberStatus(m).toLowerCase()}">${memberStatus(m)}</span> <span class="badge">${(m.months || []).join(' + ').toUpperCase()}</span>${(() => {
            const ob = memberOutstanding(m.id);
            return ob > 0.001 ? ` <span class="badge" style="background:rgba(242,163,60,.18);color:var(--accent-2)" title="Outstanding balance across this member's invoices">💰 ${fmt(ob)} due</span>` : '';
          })()}</div>
        </div>
      </div>
      <div class="row row-2 mb-3">
        <div><div class="text-mute" style="font-size:11px;text-transform:uppercase">Mobile</div><div>${phoneCell(m.phone, { stop: false })}${m.phone2 ? `<div style="margin-top:2px">${phoneCell(m.phone2, { stop: false })} <span class="text-mute" style="font-size:10px">(2nd)</span></div>` : ''}</div></div>
        <div><div class="text-mute" style="font-size:11px;text-transform:uppercase">Email</div><div>${escapeHtml(m.email || '—')}</div></div>
        <div><div class="text-mute" style="font-size:11px;text-transform:uppercase">QID</div><div class="font-mono">${escapeHtml(m.qid || '—')}</div></div>
        <div><div class="text-mute" style="font-size:11px;text-transform:uppercase">Birthdate</div><div>${m.birthdate ? `${fmtDate(m.birthdate)}${(() => {
          const age = memberAge(m.birthdate);
          const isBd = isBirthdayInMonth(m.birthdate);
          const dToB = daysUntilBirthday(m.birthdate);
          let parts = [];
          if (age != null) parts.push(`<span class="text-mute" style="font-size:11px">· ${age} yrs</span>`);
          if (isBd) parts.push(`<span class="badge" style="font-size:9px;padding:1px 6px;background:rgba(245,158,11,.18);color:var(--accent-2);margin-left:4px" title="Birthday this month — say happy birthday!">🎂 ${dToB === 0 ? 'today!' : dToB <= 30 ? `in ${dToB}d` : 'this month'}</span>`);
          return parts.join(' ');
        })()}` : '—'}</div></div>
        <div><div class="text-mute" style="font-size:11px;text-transform:uppercase">First Registration</div><div>${m.firstRegistration ? fmtDate(m.firstRegistration) : (m.joinDate ? fmtDate(m.joinDate) : '—')}${(() => {
          const t = memberTenure(m.firstRegistration || m.joinDate);
          return t ? ` <span class="text-mute" style="font-size:11px">· ${t}</span>` : '';
        })()}</div></div>
        <div><div class="text-mute" style="font-size:11px;text-transform:uppercase">Start / Renewal</div><div>${m.startDate ? fmtDate(m.startDate) : '—'}</div></div>
        <div><div class="text-mute" style="font-size:11px;text-transform:uppercase">Expiry</div><div>${m.expiryDate ? fmtDate(m.expiryDate) : '—'}</div></div>
        <div><div class="text-mute" style="font-size:11px;text-transform:uppercase">Level</div><div>${escapeHtml(m.level || '—')}</div></div>
        <div><div class="text-mute" style="font-size:11px;text-transform:uppercase">No. of Renewals</div><div>${m.renewalCount || (m.renewalsBySport ? Object.values(m.renewalsBySport).reduce((a,b)=>a+b,0) : 0) || 0}${(m.renewalsBySport && Object.keys(m.renewalsBySport).length) ? ` <span class="text-mute" style="font-size:10px">(${Object.entries(m.renewalsBySport).map(([s,c])=>`${escapeHtml(s)}:${c}`).join(', ')})</span>` : ''}</div></div>
      </div>
      <div class="kpi-grid mb-3" style="grid-template-columns:repeat(4,1fr);gap:8px">
        <div class="kpi" style="padding:10px 12px"><div class="kpi-label" style="font-size:10px">Subs</div><div class="kpi-value" style="font-size:18px">${totalSubs}</div></div>
        <div class="kpi blue" style="padding:10px 12px"><div class="kpi-label" style="font-size:10px">Classes ${liveCount.total ? '· live' : ''}</div><div class="kpi-value" style="font-size:18px">${attendedSum}/${totalClassesSum}</div></div>
        <div class="kpi green" style="padding:10px 12px"><div class="kpi-label" style="font-size:10px">Paid</div><div class="kpi-value" style="font-size:18px">${fmt(paidSum)}</div></div>
        <div class="kpi orange" style="padding:10px 12px"><div class="kpi-label" style="font-size:10px">Att Rate</div><div class="kpi-value" style="font-size:18px">${totalClassesSum ? Math.round(attendedSum/totalClassesSum*100) : 0}%</div></div>
      </div>
      <h3 style="font-size:13px;font-weight:600;margin-bottom:8px">Subscription History (${totalSubs})</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Month</th><th>Activity</th><th>Coach</th><th>Start</th><th>End</th><th>Attendance</th><th class="text-right">Paid</th><th>Status</th></tr></thead>
          <tbody>${subs || '<tr><td colspan="8" class="text-mute" style="padding:16px">No subscription records</td></tr>'}</tbody>
        </table>
      </div>
    `,
    actions: [
      { label: '📜 Full History', class: 'btn ghost', onclick: () => { closeModal(); openMemberHistory(id); } },
      { label: 'Edit', class: 'btn ghost', onclick: () => { closeModal(); editMember(id); } },
      { label: 'Close', class: 'btn primary', onclick: closeModal },
    ],
  });
}
window.viewMember = viewMember;

function addMember() {
  showMemberForm({ id: nextId(state.members), name: '', sport: 'MMA', coachId: 1, phone: '', email: '', joinDate: TODAY, status: 'Active' });
}

window.editMember = function(id) {
  const m = state.members.find(x => x.id === id);
  if (m) showMemberForm({ ...m });
};

// Build the pre-filled stub for an "Add Sibling" duplicate (pure → unit-testable).
// Copies ALL of the member's profile + plan details (name, IDs, contact, nationality,
// level, sport/coach + every enrollment, etc.). Deliberately drops the transactional /
// status history so the sibling starts fresh and isn't shown as already paid: no
// subscriptions, attendance, expiry, renewals, switches, payments, freezes, or archive
// flags. (Invoices live in state.invoices keyed by customerId, so they never copy.)
function buildMemberDuplicateStub(src, newId) {
  const clone = JSON.parse(JSON.stringify(src));
  const EXCLUDE = [
    'id', 'subscriptions', 'attendance', 'attendanceGrid', 'expiryDate', 'startDate',
    'validity', 'renewals', 'sportSwitches', 'payments', 'paymentHistory',
    'currentFreezeUntil', 'freeze', 'freezes', 'freezeHistory', 'deleted', 'deletedAt',
    'deletedReason', 'lastRemindedAt', 'createdAt', 'updatedAt', 'recentAt',
  ];
  EXCLUDE.forEach(k => { delete clone[k]; });
  clone.id = newId;
  clone.status = 'Active';
  clone._duplicatedFrom = src.name || null;
  return clone;
}

// Add a sibling: copy ALL of a member's details into a fresh Add-Member form. The
// new record gets a new id and starts unpaid (no financial/attendance history), so
// saving registers the sibling as their own new member.
window.duplicateMember = function(id) {
  const src = state.members.find(x => x.id === id);
  if (!src) return;
  closeModal();
  showMemberForm(buildMemberDuplicateStub(src, nextId(state.members)));
  toast(`Copied all details from ${src.name || 'member'} — update the name/QID, then save to register the sibling`);
};

window.freezeMember = function(id) {
  const m = state.members.find(x => x.id === id);
  if (!m) return;
  const isFrozen = m.currentFreezeUntil && TODAY <= m.currentFreezeUntil;
  if (isFrozen) {
    showModal({
      title: `Already Frozen: ${escapeHtml(m.name)}`,
      body: `<div style="text-align:center;padding:20px"><div style="font-size:40px;margin-bottom:10px">❄️</div>
        <p>${escapeHtml(m.name)} is already frozen until <b>${fmtDate(m.currentFreezeUntil)}</b>.</p>
        <p class="text-mute" style="font-size:12px">You can end the freeze early using the Unfreeze button on the profile, or wait until it ends automatically.</p></div>`,
      actions: [{ label: 'Close', primary: true, onclick: closeModal }],
    });
    return;
  }
  showModal({
    title: `❄️ Freeze membership: ${escapeHtml(m.name)}`,
    body: `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="text-mute" style="font-size:13px">A freeze pauses the membership for the chosen number of days. The expiry date will automatically shift forward by the same number of days.</div>
        <div>
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:8px">Freeze duration</label>
          <div id="freeze-presets" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
            ${[1,3,7,14,30,60,90].map(d => `<button type="button" class="btn ghost sm freeze-preset" data-days="${d}" style="padding:6px 14px;font-size:12px">${d} day${d===1?'':'s'}</button>`).join('')}
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <input type="number" id="freeze-days" min="1" max="365" value="7" style="flex:1;padding:10px 14px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)" />
            <span class="text-mute" style="font-size:12px">days</span>
          </div>
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px">Reason (optional)</label>
          <input type="text" id="freeze-reason" placeholder="e.g. travel, injury, vacation" style="width:100%;padding:10px 14px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)" maxlength="80" />
        </div>
        <div id="freeze-preview" style="background:var(--surface-2);border-radius:8px;padding:12px;font-size:12px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span class="text-mute">Current expiry:</span>
            <span class="font-bold">${m.expiryDate ? fmtDate(m.expiryDate) : '—'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span class="text-mute">Freeze starts:</span>
            <span class="font-bold">${fmtDate(TODAY)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span class="text-mute">Resume on:</span>
            <span class="font-bold" id="freeze-resume">${fmtDate(addDays(TODAY, 7))}</span>
          </div>
          <div style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px;display:flex;justify-content:space-between">
            <span class="text-mute">New expiry:</span>
            <span class="font-bold" style="color:var(--blue)" id="freeze-new-expiry">${m.expiryDate ? fmtDate(addDays(m.expiryDate, 7)) : '—'}</span>
          </div>
        </div>
      </div>
    `,
    actions: [
      { label: 'Cancel', onclick: closeModal },
      { label: '❄️ Apply Freeze', primary: true, onclick: () => {
        const days = parseInt(document.getElementById('freeze-days').value);
        if (!days || days < 1) { toast('Enter a duration of at least 1 day', 'error'); return; }
        const reason = document.getElementById('freeze-reason').value.trim();
        applyFreeze(m, days, reason);
        save();
        closeModal();
        toast(`${m.name} frozen for ${days} day${days===1?'':'s'}.`, 'success');
        viewMember(m.id);
      }},
    ],
  });
  // Live preview updates + preset chip wiring
  setTimeout(() => {
    const inp = document.getElementById('freeze-days');
    if (!inp) return;
    function updatePreview() {
      const d = parseInt(inp.value) || 0;
      const resume = document.getElementById('freeze-resume');
      const newExp = document.getElementById('freeze-new-expiry');
      if (resume) resume.textContent = d > 0 ? fmtDate(addDays(TODAY, d)) : '—';
      if (newExp) newExp.textContent = (d > 0 && m.expiryDate) ? fmtDate(addDays(m.expiryDate, d)) : (m.expiryDate ? fmtDate(m.expiryDate) : '—');
      // Highlight matching preset chip
      document.querySelectorAll('.freeze-preset').forEach(btn => {
        const match = parseInt(btn.dataset.days) === d;
        btn.classList.toggle('primary', match);
        btn.classList.toggle('ghost', !match);
      });
    }
    inp.addEventListener('input', updatePreview);
    document.querySelectorAll('.freeze-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        inp.value = btn.dataset.days;
        updatePreview();
        inp.focus();
      });
    });
    updatePreview();   // initial highlight (7 is default)
  }, 50);
};

window.unfreezeMember = function(id) {
  const m = state.members.find(x => x.id === id);
  if (!m || !m.currentFreezeUntil) return;
  if (!confirm(`End the freeze for ${m.name} now?\n\nThe expiry date stays where it is (already shifted when the freeze was applied). Future activity resumes immediately.`)) return;
  // Mark the freeze as ended early
  const f = (m.freezes || []).find(fr => fr.end === m.currentFreezeUntil);
  if (f) f.endedEarly = TODAY;
  m.currentFreezeUntil = null;
  save();
  toast(`${m.name} unfrozen.`, 'success');
  viewMember(m.id);
};

window.deleteMember = function(id) {
  const m = state.members.find(x => x.id === id);
  if (!m) return;
  if (m.deleted) {
    // Already archived — offer to restore instead
    if (confirm(`${m.name} is already archived (since ${fmtDate((m.deletedAt || '').slice(0,10))}).\n\nRestore them?`)) {
      delete m.deleted;
      delete m.deletedAt;
      delete m.deletedReason;
      save();
      render();
      toast(`Restored ${m.name}`);
    }
    return;
  }
  // Show what's linked so admin knows what's being archived (not destroyed)
  const invoiceCount = (state.invoices || []).filter(i => i.customerId === id).length;
  const saleCount = (state.sales || []).filter(s => s.customerId === id).length;
  const rentalCount = (state.rentals || []).filter(r => r.memberId === id).length;
  const switchCount = (m.sportSwitches || []).length;
  const attendanceMonths = Object.keys(m.dailyAttendance || {}).length;
  const linked = [];
  if (invoiceCount) linked.push(`${invoiceCount} invoice${invoiceCount === 1 ? '' : 's'}`);
  if (saleCount) linked.push(`${saleCount} sale${saleCount === 1 ? '' : 's'}`);
  if (rentalCount) linked.push(`${rentalCount} rental${rentalCount === 1 ? '' : 's'}`);
  if (switchCount) linked.push(`${switchCount} sport switch${switchCount === 1 ? '' : 'es'}`);
  if (attendanceMonths) linked.push(`${attendanceMonths} attendance month${attendanceMonths === 1 ? '' : 's'}`);
  const linkedMsg = linked.length
    ? `\n\nPRESERVED (history stays intact):\n• ${linked.join('\n• ')}\n• Coach commission already earned\n• Member ID, name, all data`
    : '\n\nNo linked records.';
  const reason = prompt(`Archive ${m.name}?\n\nThis is a SOFT delete — no data is destroyed:${linkedMsg}\n\n` +
    `${m.name} will be hidden from active lists but can be restored anytime\n` +
    `from the Members page → status filter "Archived".\n\nReason (optional):`, '');
  if (reason === null) return;  // user pressed Cancel
  // Soft-delete: mark with flag + timestamp instead of removing from array
  m.deleted = true;
  m.deletedAt = new Date().toISOString();
  m.deletedReason = reason || null;
  audit('member.archive', `member:${m.id}`,
    `Archived ${m.name}${reason ? ' — ' + reason : ''}`,
    { memberId: m.id, name: m.name, reason });
  save();
  render();
  toast(`📦 Archived ${m.name}${linked.length ? ' · ' + linked.length + ' record types preserved' : ''}`);
};

window.restoreMember = function(id) {
  const m = state.members.find(x => x.id === id);
  if (!m || !m.deleted) return;
  delete m.deleted;
  delete m.deletedAt;
  delete m.deletedReason;
  audit('member.restore', `member:${m.id}`, `Restored ${m.name}`, { memberId: m.id, name: m.name });
  save();
  render();
  toast(`Restored ${m.name}`);
};

// Hard-delete an ARCHIVED member. Irreversible (unlike restore). Lets the user
// choose whether to also purge linked invoices/sales/rentals, with a final confirm.
window.permanentlyDeleteMember = function(id) {
  const m = state.members.find(x => x.id === id);
  if (!m) return;
  if (!m.deleted) { toast('Archive the member first, then you can permanently delete.', 'error'); return; }
  const invs = (state.invoices || []).filter(i => i.customerId === id).length;
  const sales = (state.sales || []).filter(s => s.customerId === id).length;
  const rentals = (state.rentals || []).filter(r => r.memberId === id).length;
  const purge = (alsoRecords) => {
    state.members = state.members.filter(x => x.id !== id);
    if (alsoRecords) {
      state.invoices = (state.invoices || []).filter(i => i.customerId !== id);
      state.sales = (state.sales || []).filter(s => s.customerId !== id);
      state.rentals = (state.rentals || []).filter(r => r.memberId !== id);
    }
    audit('member.purge', `member:${id}`, `Permanently deleted ${m.name}${alsoRecords ? ' + linked records' : ' (records kept)'}`,
      { memberId: id, name: m.name, alsoRecords, invoices: invs, sales, rentals });
    save(); closeModal(); render();
    toast(`Permanently deleted ${m.name}`);
  };
  const linkedBits = [invs ? `${invs} invoice${invs > 1 ? 's' : ''}` : '', sales ? `${sales} sale${sales > 1 ? 's' : ''}` : '', rentals ? `${rentals} rental${rentals > 1 ? 's' : ''}` : ''].filter(Boolean);
  showModal({
    title: `⚠️ Permanently delete "${escapeHtml(m.name)}"?`,
    body: `<div style="font-size:13px;line-height:1.65">
      <p><b>This cannot be undone.</b> Unlike Archive, the member will be erased and can't be restored.</p>
      <p>${linkedBits.length ? `Linked financial records: <b>${linkedBits.join(', ')}</b>.` : 'No linked invoices, sales, or rentals.'}</p>
      <p class="text-mute">💾 Tip: back up your data first (Settings → Backup). Choose what to remove:</p>
    </div>`,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      ...(linkedBits.length ? [{ label: 'Member only (keep records)', class: 'btn ghost', onclick: () => { if (confirm(`Permanently delete "${m.name}" but KEEP their ${linkedBits.join(', ')} as history?`)) purge(false); } }] : []),
      { label: linkedBits.length ? '🗑 Delete everything' : '🗑 Delete forever', class: 'btn danger', onclick: () => { if (confirm(`Last chance — permanently erase "${m.name}"${linkedBits.length ? ' AND all their ' + linkedBits.join(', ') : ''}? This CANNOT be undone.`)) purge(true); } },
    ],
  });
};
// Each row: { sport, coachId, classes, price }. Lets a member register into
// several sports at once, e.g. Karate 6/350 + Kick-Boxing 4/300 + Swimming 6/450.
window._enrollRows = [];

function enrollRowHtml(row, idx) {
  const sportOpts = SPORTS.map(s => `<option ${s === row.sport ? 'selected' : ''}>${s}</option>`).join('');
  // Registration dropdown: only active coaches selectable, but if this row
  // already points to an inactive coach (e.g. editing history), keep it shown.
  // Build the coach options, matching the row's saved coach robustly:
  //  • type-safe compare so a saved "1" (string) still matches coach id 1
  //  • if the assigned coach is inactive/archived, still show it (selected)
  //  • if no valid coach is assigned (unset or deleted), show a "— Select
  //    coach —" placeholder so the mandatory field is explicit, never blank.
  const selList = coachesForSport(row.sport, row.coachId);
  const assignedCoach = (row.coachId != null && row.coachId !== '')
    ? state.coaches.find(c => String(c.id) === String(row.coachId))
    : null;
  if (assignedCoach && !selList.some(c => c.id === assignedCoach.id)) {
    selList.push(assignedCoach);
  }
  const coachOpts =
    `<option value="" ${assignedCoach ? '' : 'selected'}>— Select coach —</option>` +
    selList.map(c => `<option value="${c.id}" ${assignedCoach && c.id === assignedCoach.id ? 'selected' : ''}>${coachOptionLabel(c, row.sport)}</option>`).join('');
  // Visual warning: highlight Classes/Price fields if they're empty or zero
  const classesNum = parseInt(row.classes) || 0;
  const priceNum = parseFloat(row.price) || 0;
  const classesStyle = classesNum <= 0 ? 'border:1px solid var(--accent);background:rgba(242,96,96,.04)' : '';
  const priceStyle = priceNum <= 0 ? 'border:1px solid var(--accent);background:rgba(242,96,96,.04)' : '';

  // Summer Camp special handling: replace the Classes input with a Duration
  // dropdown. The selected duration maps to a number of days (stored in
  // `classes`) AND a default price. Admin can still override the price.
  const isCamp = row.sport === SUMMER_CAMP;
  const campPrices = (state.settings?.summerCampPrices) || DEFAULT_SUMMER_CAMP_PRICES;
  // For existing camp rows, infer the matching label from days OR durationLabel
  const matchedLabel = isCamp
    ? (row.durationLabel || (campPrices.find(p => p.days === classesNum)?.label) || '')
    : '';

  const classesField = isCamp
    ? `<div class="field" style="margin:0"><label style="font-size:10px">Duration <span style="color:var(--accent)">*</span></label>
         <select data-en="durationLabel" data-i="${idx}" style="${classesNum <= 0 ? classesStyle : ''}">
           <option value="">— pick —</option>
           ${campPrices.map(p => `<option value="${escapeHtml(p.label)}" ${matchedLabel === p.label ? 'selected' : ''}>${escapeHtml(p.label)} · ${fmt(p.price)} QAR</option>`).join('')}
         </select>
       </div>`
    : `<div class="field" style="margin:0"><label style="font-size:10px">Classes <span style="color:var(--accent)">*</span></label><input data-en="classes" data-i="${idx}" type="number" min="0" step="1" value="${row.classes ?? ''}" placeholder="6" style="${classesStyle}" /></div>`;

  // For Summer Camp: no coach assignment, no commission. Show a disabled
  // placeholder so the row layout stays aligned.
  const coachField = isCamp
    ? `<div class="field" style="margin:0">
         <label style="font-size:10px;color:var(--text-mute)">Coach</label>
         <div style="padding:10px 14px;background:var(--surface);border:1px dashed var(--border);border-radius:8px;color:var(--text-mute);font-size:12px;font-style:italic">Not required</div>
       </div>`
    : `<div class="field" style="margin:0"><label style="font-size:10px">Coach <span style="color:var(--accent)">*</span></label><select data-en="coachId" data-i="${idx}">${coachOpts}</select></div>`;

  // Per-sport validity. Summer Camp uses its duration (days) as its validity.
  const valSel = parseInt(row.validity) || DEFAULT_VALIDITY;
  const validityField = isCamp
    ? `<div class="field" style="margin:0"><label style="font-size:10px;color:var(--text-mute)">Validity</label><div style="padding:10px 12px;background:var(--surface);border:1px dashed var(--border);border-radius:8px;color:var(--text-mute);font-size:11px;font-style:italic">${classesNum > 0 ? classesNum + ' days (duration)' : 'set duration'}</div></div>`
    : `<div class="field" style="margin:0"><label style="font-size:10px">Validity <span style="color:var(--accent)">*</span></label><select data-en="validity" data-i="${idx}">${VALIDITY_OPTIONS.map(v => `<option value="${v}" ${v === valSel ? 'selected' : ''}>${v} days</option>`).join('')}</select></div>`;
  // This sport's own expiry = its start + its validity (days)
  const eDays = isCamp ? classesNum : valSel;
  const expiryHint = (row.start && eDays > 0) ? `⏳ ${escapeHtml(row.sport)} expires <b>${fmtDate(addDays(row.start, eDays))}</b>` : '';

  const buttonCell = row.paid
    ? `<div style="display:flex;gap:4px;align-items:end">
         <button type="button" class="btn ghost sm" data-en-withdraw="${idx}" style="padding:8px 10px;color:var(--accent-2);margin-bottom:1px;border:1px solid var(--accent-2);background:rgba(245,158,11,.06)" title="Member already paid — process a withdrawal (refund based on attendance)">↩ Withdraw</button>
         <button type="button" class="btn ghost sm" data-en-delete="${idx}" style="padding:8px 9px;color:var(--red);margin-bottom:1px;border:1px solid var(--red)" title="Added by mistake — delete this enrollment with NO refund">🗑</button>
       </div>`
    : `<button type="button" class="btn ghost sm" data-en-remove="${idx}" style="padding:8px 10px;color:var(--red);margin-bottom:1px" ${window._enrollRows.length <= 1 ? 'tabindex="-1"' : ''} title="Remove sport">✕</button>`;

  return `
    <div class="enroll-block" data-enroll-idx="${idx}" style="border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px;background:rgba(59,130,246,.045)">
      <div style="display:grid;grid-template-columns:1.3fr 1.3fr .8fr .9fr auto;gap:8px;align-items:end">
        <div class="field" style="margin:0"><label style="font-size:10px">Sport <span style="color:var(--accent)">*</span></label><select data-en="sport" data-i="${idx}" ${row.paid ? 'disabled title="Already paid — use Switch Sport instead to change"' : ''}>${sportOpts}</select></div>
        ${coachField}
        ${classesField}
        <div class="field" style="margin:0"><label style="font-size:10px">Price (QAR) <span style="color:var(--accent)">*</span></label><input data-en="price" data-i="${idx}" type="number" min="0" step="0.01" value="${row.price ?? ''}" placeholder="350" style="${priceStyle}" ${row.paid ? 'title="Editing this updates the linked invoice (revenue + commission)"' : ''} /></div>
        ${buttonCell}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
        <div class="field" style="margin:0"><label style="font-size:10px">📅 Start date <span style="color:var(--accent)">*</span></label><input data-en="start" data-i="${idx}" type="date" value="${row.start || ''}" /></div>
        ${validityField}
      </div>
      ${expiryHint ? `<div style="font-size:10px;color:var(--blue);margin-top:7px;padding-left:2px">${expiryHint}</div>` : ''}${isCamp ? `<div style="font-size:10px;color:var(--blue);margin-top:5px;padding-left:2px">🌞 Summer Camp · revenue goes to club, no coach commission</div>` : ''}${row.paid ? `<div style="font-size:10px;color:var(--text-mute);margin-top:5px;padding-left:2px">🔒 Paid — editing the <b>price</b> adjusts the linked invoice (revenue + commission update too); editing start/validity adjusts this sport's window. For a refund use <b style="color:var(--accent-2)">↩ Withdraw</b>, <b style="color:var(--red)">🗑</b> to delete a mistake, or <b style="color:var(--blue)">Switch Sport</b> from the member profile.</div>` : ''}
    </div>`;
}

// Auto membership expiry = latest end across all enrolled sports (start + validity;
// Summer Camp uses its day count). Returns 'YYYY-MM-DD' or '' if not computable.
function autoExpiryFromRows() {
  const ends = (window._enrollRows || []).map(r => {
    const days = r.sport === SUMMER_CAMP ? (parseInt(r.classes) || 0) : (parseInt(r.validity) || 0);
    return (r.start && days > 0) ? addDays(r.start, days) : null;
  }).filter(Boolean).sort();
  return ends.length ? ends[ends.length - 1] : '';
}

function renderEnrollRows() {
  const wrap = document.getElementById('enroll-rows');
  if (!wrap) return;
  wrap.innerHTML = window._enrollRows.map((r, i) => enrollRowHtml(r, i)).join('');
  const totalEl = document.getElementById('enroll-total');
  if (totalEl) {
    const total = window._enrollRows.reduce((s, r) => s + (parseFloat(r.price) || 0), 0);
    const cls = window._enrollRows.reduce((s, r) => s + (parseInt(r.classes) || 0), 0);
    totalEl.textContent = `${window._enrollRows.length} sport${window._enrollRows.length !== 1 ? 's' : ''} · ${cls} classes/days · ${fmt(total)} QAR`;
  }
  // Membership expiry — editable date input. Auto-fills with the latest sport end
  // and tracks it live, UNLESS the user has manually overridden the value.
  const auto = autoExpiryFromRows();
  const expInp = document.getElementById('f-expiry');
  if (expInp && !window._expiryManual && auto) expInp.value = auto;
  const expHint = document.getElementById('f-expiry-hint');
  if (expHint) {
    expHint.innerHTML = window._expiryManual
      ? '✎ Manual override · <a id="f-expiry-auto" style="color:var(--blue);cursor:pointer">↻ reset to auto</a>'
      : (auto ? `Auto from latest sport end: <b>${fmtDate(auto)}</b>` : 'Add a sport to compute the expiry.');
    const autoLink = document.getElementById('f-expiry-auto');
    if (autoLink) autoLink.onclick = () => { window._expiryManual = false; renderEnrollRows(); };
  }
  updatePaidNowHint();
  // Wire inputs
  wrap.querySelectorAll('[data-en]').forEach(inp => {
    const handle = (e) => {
      const i = parseInt(e.target.dataset.i);
      const key = e.target.dataset.en;
      const row = window._enrollRows[i];
      const val = e.target.value;
      if (key === 'coachId') {
        row.coachId = val ? parseInt(val) : null;
      } else if (key === 'sport') {
        const wasCamp = row.sport === SUMMER_CAMP;
        const isNowCamp = val === SUMMER_CAMP;
        row.sport = val;
        // If the currently-picked coach doesn't teach the new sport, clear it so
        // the admin must re-pick from the (now correctly filtered) coach list.
        if (!isNowCamp && row.coachId) {
          const cc = state.coaches.find(c => String(c.id) === String(row.coachId));
          if (cc && !coachTeachesSport(cc, val)) row.coachId = null;
        }
        // Switching to/from Summer Camp resets duration-related fields
        if (wasCamp && !isNowCamp) {
          row.durationLabel = null;
          row.classes = '';
          row.price = '';
        } else if (!wasCamp && isNowCamp) {
          row.classes = '';
          row.price = '';
          row.durationLabel = null;
          row.coachId = null;  // Summer Camp has no coach
        }
        renderEnrollRows();
        return;
      } else if (key === 'durationLabel') {
        // Find the matching price entry and auto-fill classes (days) + price
        const prices = (state.settings?.summerCampPrices) || DEFAULT_SUMMER_CAMP_PRICES;
        const match = prices.find(p => p.label === val);
        if (match) {
          row.durationLabel = match.label;
          row.classes = match.days;
          // Only auto-fill price if user hasn't typed one yet
          const currentPrice = parseFloat(row.price);
          if (!currentPrice || currentPrice === 0) {
            row.price = match.price;
          }
        } else {
          row.durationLabel = null;
          row.classes = '';
        }
        renderEnrollRows();
        return;
      } else {
        row[key] = val;
      }
      if (key === 'price' || key === 'classes' || key === 'validity' || key === 'start') renderEnrollRows();
    };
    inp.addEventListener('change', handle);
    inp.addEventListener('input', (e) => {
      // For text inputs only — selects fire 'change' instead
      if (e.target.tagName === 'INPUT') {
        const i = parseInt(e.target.dataset.i);
        const key = e.target.dataset.en;
        window._enrollRows[i][key] = key === 'coachId' ? parseInt(e.target.value) : e.target.value;
      }
    });
  });
  wrap.querySelectorAll('[data-en-remove]').forEach(btn => {
    btn.addEventListener('click', e => {
      const i = parseInt(e.currentTarget.dataset.enRemove);
      window._enrollRows.splice(i, 1);
      renderEnrollRows();
    });
  });
  // Withdraw button — opens the refund/withdrawal flow for paid enrollments
  wrap.querySelectorAll('[data-en-withdraw]').forEach(btn => {
    btn.addEventListener('click', e => {
      const i = parseInt(e.currentTarget.dataset.enWithdraw);
      const row = window._enrollRows[i];
      const memberId = window._editingMemberId;
      if (!memberId || !row) return;
      // Close the edit modal first, then open the withdraw modal
      closeModal();
      withdrawSport(memberId, row.originalSport || row.sport);
    });
  });
  // Delete (added by mistake) — removes the enrollment, subscription and invoice
  // line with NO refund record (distinct from Withdraw).
  wrap.querySelectorAll('[data-en-delete]').forEach(btn => {
    btn.addEventListener('click', e => {
      const i = parseInt(e.currentTarget.dataset.enDelete);
      const row = window._enrollRows[i];
      const memberId = window._editingMemberId;
      if (!memberId || !row) return;
      removeEnrollmentMistake(memberId, row.originalSport || row.sport);
    });
  });
}

// Live "Paid now (deposit)" hint: shows the balance that will be due.
function updatePaidNowHint() {
  const hint = document.getElementById('f-paidnow-hint');
  const inp = document.getElementById('f-paidnow');
  if (!hint || !inp) return;
  const total = (window._enrollRows || []).reduce((s, r) => s + (parseFloat(r.price) || 0), 0);
  const raw = inp.value;
  if (raw === '' || raw == null) { hint.textContent = `Full payment: ${fmt(total)} QAR`; hint.style.color = 'var(--text-mute)'; return; }
  const paid = Math.max(0, Math.min(parseFloat(raw) || 0, total));
  const bal = Math.max(0, total - paid);
  if (bal > 0.001) { hint.textContent = `Paid ${fmt(paid)} · ${fmt(bal)} due`; hint.style.color = 'var(--accent-2)'; }
  else { hint.textContent = `Paid in full: ${fmt(total)} QAR`; hint.style.color = 'var(--green)'; }
}

function addEnrollRow() {  const last = window._enrollRows[window._enrollRows.length - 1];
  window._enrollRows.push({ sport: SPORTS[0], coachId: state.coaches[0]?.id, classes: '', price: '', start: TODAY, validity: DEFAULT_VALIDITY });
  renderEnrollRows();
}

// Delete an enrollment that was added by mistake — no refund (use Withdraw for that).
window.removeEnrollmentMistake = function(memberId, sport) {
  const m = state.members.find(x => x.id === memberId);
  if (!m || !sport) return;
  if (!confirm(`Delete the "${sport}" enrollment as a MISTAKE?\n\nThis removes the enrollment, its subscription and its invoice line entirely — with NO refund record. If the member actually paid and needs money back, use ↩ Withdraw instead.`)) return;
  removeEnrollmentData(m, sport);
  save();
  closeModal();
  render();
  toast(`"${sport}" enrollment removed`);
};

function showMemberForm(m) {
  const isNew = !state.members.find(x => x.id === m.id);
  // Make memberId available to handlers (e.g. withdraw button) defined in
  // enrollRowHtml — they need to know which member is being edited.
  window._editingMemberId = isNew ? null : m.id;
  // Seed enrollment rows from the member's actual enrollments when editing.
  // If a member has no enrollments[] yet but does have subscriptions[], rebuild
  // one row per latest subscription. For brand-new members, start with one blank row.
  // The `paid` flag tells the row whether the × delete should be disabled (and a
  // "Withdraw" button shown instead). A row is "paid" if it has an existing
  // invoice line item for this customer + this sport (price > 0).
  function isEnrollmentPaid(memberId, sport) {
    if (!memberId) return false;
    return (state.invoices || []).some(inv =>
      inv.customerId === memberId &&
      (inv.category || 'Membership') === 'Membership' &&
      (inv.lineItems || []).some(li => li.sport === sport && (parseFloat(li.price) || 0) > 0)
    );
  }
  // Latest subscription for a sport (subs are append-only, last wins) — gives
  // us this sport's own start date + validity to pre-fill its card.
  function latestSubFor(member, sport) {
    let found = null;
    for (const s of (member.subscriptions || [])) if (s.activity === sport) found = s;
    return found;
  }
  if (isNew) {
    if (m._duplicatedFrom && m.enrollments && m.enrollments.length) {
      // Sibling copy: pre-fill the same sports/coaches/classes/prices, but as a
      // fresh unpaid registration starting today (no carried-over payments).
      window._enrollRows = m.enrollments.map(e => ({
        sport: e.sport, coachId: e.coachId,
        classes: e.classes ?? '', price: e.price ?? '',
        start: TODAY, validity: DEFAULT_VALIDITY, paid: false,
      }));
    } else {
      window._enrollRows = [{ sport: m.sport || SPORTS[0], coachId: m.coachId || state.coaches[0]?.id, classes: '', price: '', start: TODAY, validity: DEFAULT_VALIDITY, paid: false }];
    }
  } else if (m.enrollments && m.enrollments.length) {
    window._enrollRows = m.enrollments.map(e => {
      const sub = latestSubFor(m, e.sport);
      return {
        sport: e.sport, coachId: e.coachId,
        classes: e.classes ?? '', price: e.price ?? '',
        // Each sport carries its OWN start date + validity (from its subscription)
        start: (sub && sub.start) || m.startDate || TODAY,
        validity: (sub && sub.validity) || (sub && daysBetween(sub.start, sub.end)) || m.validity || DEFAULT_VALIDITY,
        // Track if this enrollment has an associated paid invoice. If yes, the
        // × delete button is replaced with a "Withdraw" action that creates a
        // refund invoice + coach commission deduction (see withdrawSport()).
        paid: isEnrollmentPaid(m.id, e.sport),
        originalSport: e.sport,  // remember original sport for paid-row lookup if user edits
      };
    });
  } else if (m.subscriptions && m.subscriptions.length) {
    // Build from latest subscription per sport
    const bySport = new Map();
    for (const s of m.subscriptions) {
      if (!s.activity) continue;
      bySport.set(s.activity, s);  // last wins (subscriptions are append-only)
    }
    window._enrollRows = [...bySport.values()].map(s => ({
      sport: s.activity, coachId: s.coachId,
      classes: s.totalClasses ?? '', price: s.amountPaid ?? '',
      start: s.start || m.startDate || TODAY,
      validity: s.validity || daysBetween(s.start, s.end) || m.validity || DEFAULT_VALIDITY,
      paid: isEnrollmentPaid(m.id, s.activity),
      originalSport: s.activity,
    }));
    if (!window._enrollRows.length) {
      window._enrollRows = [{ sport: m.sport || SPORTS[0], coachId: m.coachId || state.coaches[0]?.id, classes: '', price: '', start: m.startDate || TODAY, validity: m.validity || DEFAULT_VALIDITY, paid: false }];
    }
  } else {
    window._enrollRows = [{ sport: m.sport || SPORTS[0], coachId: m.coachId || state.coaches[0]?.id, classes: '', price: '', start: m.startDate || TODAY, validity: m.validity || DEFAULT_VALIDITY, paid: false }];
  }
  // Membership expiry: default to auto (latest sport end). If the member already
  // has a stored expiry that differs from the auto value, treat it as a manual
  // override so editing the member preserves it (still editable / resettable).
  const _autoExp = autoExpiryFromRows();
  window._expiryManual = !!(m.expiryDate && _autoExp && m.expiryDate !== _autoExp);
  const _expInit = (window._expiryManual ? m.expiryDate : (_autoExp || m.expiryDate)) || '';
  showModal({
    title: isNew ? (m._duplicatedFrom ? `Add Sibling (copied from ${escapeHtml(m._duplicatedFrom)})` : 'Add Member') : 'Edit Member',
    body: `
      ${m._duplicatedFrom ? `<div style="margin-bottom:12px;padding:9px 12px;background:rgba(91,141,239,.10);border:1px solid rgba(91,141,239,.30);border-radius:8px;font-size:12px;color:var(--text-dim)">⧉ All details copied from <b>${escapeHtml(m._duplicatedFrom)}</b>. Update this sibling's <b>name</b>, <b>QID</b> and <b>birthdate</b>. Nothing financial or attendance was copied — saving registers them fresh.</div>` : ''}
      <div style="margin-bottom:14px;padding:10px 12px;background:rgba(245,158,11,.08);border:1px dashed var(--accent-2);border-radius:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <button type="button" class="btn ghost sm" id="id-scan-btn" style="color:var(--accent-2);border:1px solid var(--accent-2);white-space:nowrap">📷 Scan Qatar ID</button>
        <input type="file" id="id-scan-file" accept="image/*" capture="environment" style="display:none" />
        <span id="id-scan-status" class="text-mute" style="font-size:11px;flex:1;min-width:180px">Upload a photo of the residency permit to auto-fill name, QID, birthdate &amp; nationality. Always double-check what's read.</span>
      </div>
      <div class="form-row">
        <div class="field"><label>Full name (English) <span style="color:var(--accent)">*</span></label><input id="f-name" value="${escapeHtml(m.name)}" placeholder="Required if Arabic name is empty" /></div>
        <div class="field"><label>Name (Arabic) <span class="text-mute" style="font-size:10px">(or English required)</span></label><input id="f-name-ar" value="${escapeHtml(m.nameArabic || '')}" dir="rtl" /></div>
      </div>
      <div class="form-row">
        ${phoneInputHtml('f-phone', m.phone, { label: 'Mobile number' })}
        ${phoneInputHtml('f-phone2', m.phone2, { label: 'Second mobile (optional)', required: false })}
        <div class="field"><label>Email <span class="text-mute" style="font-size:10px">(optional)</span></label><input id="f-email" type="email" value="${escapeHtml(m.email || '')}" /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>QID</label><input id="f-qid" value="${escapeHtml(m.qid || '')}" placeholder="288…" /></div>
        <div class="field"><label>Birthdate <span class="text-mute" style="font-size:10px">(must be 3+ years old)</span></label><input id="f-bdate" type="date" value="${m.birthdate || ''}" /></div>
        <div class="field"><label>Nationality</label>
          <input id="f-nationality" list="nationalities-list" autocomplete="off" value="${escapeHtml(m.nationality || '')}" placeholder="Type to search…" />
          <datalist id="nationalities-list">${NATIONALITIES.map(n => `<option value="${escapeHtml(n)}"></option>`).join('')}</datalist>
        </div>
      </div>
      <div style="margin-top:6px;padding:12px;background:rgba(59,130,246,.07);border:1px solid rgba(59,130,246,.22);border-radius:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-size:11px;color:var(--blue);text-transform:uppercase;letter-spacing:.6px;font-weight:600">🥋 Sport enrollments <span style="color:var(--accent)">*</span></div>
          <button type="button" class="btn ghost sm" id="enroll-add" style="padding:5px 12px;color:var(--blue);font-weight:600">+ Add sport</button>
        </div>
        <div id="enroll-rows"></div>
        <div style="display:flex;justify-content:flex-end;margin-top:4px"><span id="enroll-total" class="text-dim" style="font-size:11px;font-weight:600"></span></div>
        <div class="text-mute" style="font-size:10px;margin-top:4px">A member can register into multiple sports at once. Each row needs <b>sport, coach, classes, and price</b>.</div>
      </div>
      <div class="form-row">
        <div class="field"><label>Level</label><select id="f-level">
          <option value="">—</option>
          <option ${m.level==='Beginner'?'selected':''}>Beginner</option>
          <option ${m.level==='Intermediate'?'selected':''}>Intermediate</option>
          <option ${m.level==='Advanced'?'selected':''}>Advanced</option>
          <option ${m.level==='Pro'?'selected':''}>Pro</option>
        </select></div>
        <div class="field"><label>Status</label><select id="f-status">
          <option ${m.status==='Active'?'selected':''}>Active</option>
          <option ${m.status==='Expired'?'selected':''}>Expired</option>
          <option ${m.status==='Withdrawn'?'selected':''}>Withdrawn</option>
        </select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>First registration date <span class="text-mute" style="font-size:10px;font-weight:400">(blank = earliest sport's start)</span></label><input id="f-firstreg" type="date" value="${m.firstRegistration || ''}" /></div>
        <div class="field"><label>Membership expiry <span class="text-mute" style="font-size:10px;font-weight:400">(auto — latest sport end · editable)</span></label><input id="f-expiry" type="date" value="${_expInit}" onchange="window._expiryManual=true;renderEnrollRows()" /><div id="f-expiry-hint" class="text-mute" style="font-size:10px;margin-top:4px"></div></div>
      </div>
      ${isNew ? `
      <div style="margin-top:6px;padding:12px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:8px">
        <div style="font-size:11px;color:var(--green);text-transform:uppercase;letter-spacing:.6px;font-weight:600;margin-bottom:8px">💳 First payment (auto-creates invoice)</div>
        <div class="form-row">
          <div class="field"><label>Method</label><select id="f-method"><option value="cash">Cash</option><option value="card">Card</option></select></div>
          <div class="field"><label>Paid now (deposit) <span class="text-mute" style="font-size:10px">(blank = pay full)</span></label><input id="f-paidnow" type="number" min="0" step="0.01" placeholder="full amount" /><div id="f-paidnow-hint" class="text-mute" style="font-size:10px;margin-top:3px"></div></div>
        </div>
        <div class="text-dim" style="font-size:11px">Invoice total is taken from the sport prices above (one invoice covering all enrolled sports). Enter a deposit to record a partial payment — the balance shows as due.</div>
      </div>
      ` : ''}
    `,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: isNew ? 'Add' : 'Save', class: 'btn primary', onclick: () => {
        // ─── Validation ────────────────────────────────────────────
        let nameEn = $('#f-name').value.trim();
        // Gently fix obviously-wrong casing (all-lowercase or ALL-UPPERCASE) to
        // Title Case; leave intentional mixed-case (e.g. "McDonald") untouched.
        if (nameEn && (nameEn === nameEn.toLowerCase() || nameEn === nameEn.toUpperCase())) nameEn = titleCaseName(nameEn);
        const nameAr = $('#f-name-ar').value.trim();
        const phoneInput = readPhoneInput('f-phone');
        const phone = phoneInput.phone;
        const phone2Input = readPhoneInput('f-phone2');
        if (phone2Input.digits && !phone2Input.valid) {
          toast('Second mobile looks invalid — ' + (phone2Input.error || 'too short') + '. Fix it or clear it.', 'error');
          ($('#f-phone2-digits') || {}).focus?.();
          return;
        }
        const phone2 = phone2Input.digits ? phone2Input.phone : null;
        const email = $('#f-email').value.trim();
        const birthdate = $('#f-bdate').value;

        // 1. At least one name (English OR Arabic)
        if (!nameEn && !nameAr) {
          toast('Please enter a name (English or Arabic)', 'error');
          ($('#f-name') || {}).focus?.();
          return;
        }
        // 1b. At least a first AND last name (in English or Arabic)
        if (!hasFirstAndLast(nameEn) && !hasFirstAndLast(nameAr)) {
          toast('Please enter at least a first and last name', 'error');
          ($('#f-name') || {}).focus?.();
          return;
        }

        // 2. Mobile mandatory + at least 8 digits (national portion)
        if (!phoneInput.valid) {
          toast(phoneInput.error || 'Mobile number is invalid', 'error');
          document.getElementById('f-phone-digits')?.focus();
          return;
        }

        // 2b. Composite-key uniqueness — a member is identified by
        // Mobile + Name (English OR Arabic). We reject TRUE duplicates and
        // send the admin straight to the existing record. Comparison is
        // against ALL members (active + archived) so an archived member can't
        // be silently re-created.
        //   • Same phone + same name  → SAME person → block, open their edit
        //   • Same phone + diff name  → distinct person (e.g. family) → allowed
        //   • Same QID (any name)     → SAME person → block, open their edit
        //     (a national ID can't legitimately belong to two members)
        const qidVal = $('#f-qid').value.trim();
        // (a) Composite key — same mobile + same name = the SAME person.
        //     Always blocked; the admin is taken to the existing record.
        const nameDup = findDuplicateMember(phone, nameEn, nameAr, m.id);
        if (nameDup) {
          const archivedNote = nameDup.deleted ? ' (currently archived)' : '';
          toast(`"${nameDup.name || nameDup.nameArabic}" already exists with mobile ${nameDup.phone}${archivedNote}. Opening their profile to edit instead.`, 'error');
          closeModal();
          if (typeof editMember === 'function') editMember(nameDup.id);
          else if (typeof viewMember === 'function') viewMember(nameDup.id);
          return;
        }
        // (b) QID match — a national ID can't belong to two people. Behaviour is
        //     configurable in Settings: 'block' (default, open the existing
        //     record) or 'warn' (confirm and allow if admin insists).
        const qidDup = qidVal ? (findMembersByQid(qidVal, m.id)[0] || null) : null;
        if (qidDup) {
          const archivedNote = qidDup.deleted ? ' (currently archived)' : '';
          const qidMode = state.settings?.qidDuplicateMode || 'block';
          if (qidMode === 'warn') {
            if (!confirm(`⚠ QID ${qidDup.qid} already belongs to "${qidDup.name || qidDup.nameArabic}"${archivedNote}.\n\nSave anyway?\n\nOK = save as a separate member · Cancel = review.`)) return;
            // admin confirmed — fall through and save
          } else {
            toast(`QID ${qidDup.qid} already belongs to "${qidDup.name || qidDup.nameArabic}"${archivedNote}. Opening their profile to edit instead.`, 'error');
            closeModal();
            if (typeof editMember === 'function') editMember(qidDup.id);
            else if (typeof viewMember === 'function') viewMember(qidDup.id);
            return;
          }
        }

        // 3. Email format (only if filled)
        if (email) {
          const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
          if (!emailOk) {
            toast('Email format is invalid (e.g. name@example.com)', 'error');
            $('#f-email')?.focus();
            return;
          }
        }

        // 4. Birthdate must make member at least 3 years old (if provided)
        if (birthdate) {
          const bd = new Date(birthdate);
          if (isNaN(bd.getTime())) {
            toast('Birthdate is invalid', 'error');
            $('#f-bdate')?.focus();
            return;
          }
          const today = new Date(TODAY);
          let age = today.getFullYear() - bd.getFullYear();
          const m = today.getMonth() - bd.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
          if (age < 3) {
            toast(`Member must be at least 3 years old (currently ${age})`, 'error');
            $('#f-bdate')?.focus();
            return;
          }
          if (bd > today) {
            toast('Birthdate cannot be in the future', 'error');
            $('#f-bdate')?.focus();
            return;
          }
        }

        // 5. Sport enrollments — at least one complete row
        // A complete row = has sport AND classes>0 AND price>0.
        // Coach is required EXCEPT for Summer Camp (which has no coach).
        const allRows = window._enrollRows || [];
        const rowComplete = (r) => {
          if (!r.sport) return false;
          if ((parseInt(r.classes) || 0) <= 0) return false;
          if ((parseFloat(r.price) || 0) <= 0) return false;
          // Coach required only for non-Summer-Camp sports
          if (r.sport !== SUMMER_CAMP && !state.coaches.some(c => String(c.id) === String(r.coachId))) return false;
          return true;
        };
        const completeRows = allRows.filter(rowComplete);
        const partialRows = allRows.filter(r =>
          (r.sport || r.coachId || r.classes || r.price) && !rowComplete(r)
        );
        if (!completeRows.length) {
          if (allRows.length === 0) {
            toast('Add at least one sport enrollment', 'error');
          } else {
            // Identify which fields are missing on the first partial row
            const p = partialRows[0] || allRows[0];
            const isCamp = p.sport === SUMMER_CAMP;
            const missing = [];
            if (!p.sport) missing.push('sport');
            if (!isCamp && !state.coaches.some(c => String(c.id) === String(p.coachId))) missing.push('coach');
            if (!(parseInt(p.classes) > 0)) missing.push(isCamp ? 'duration' : 'classes (>0)');
            if (!(parseFloat(p.price) > 0)) missing.push('price (>0)');
            toast(`Sport enrollment is incomplete — missing: ${missing.join(', ')}`, 'error');
          }
          return;
        }
        if (partialRows.length) {
          if (!confirm(`You have ${partialRows.length} incomplete sport row(s) — they'll be discarded on save. Continue?`)) return;
        }

        // ─── End validation ────────────────────────────────────────
        // Collect enrollment rows (validated)
        const enrollments = completeRows.map(r => ({
          sport: r.sport,
          // Summer Camp has no coach — store null. Other sports parse the int.
          coachId: r.sport === SUMMER_CAMP ? null : parseInt(r.coachId),
          classes: parseInt(r.classes) || 0,
          price: parseFloat(r.price) || 0,
          // Summer Camp keeps its duration label for display in invoices + member detail
          durationLabel: r.sport === SUMMER_CAMP ? (r.durationLabel || null) : null,
          // Each sport carries its OWN start date + validity (its own expiry)
          start: r.start || null,
          validity: r.sport === SUMMER_CAMP ? (parseInt(r.classes) || DEFAULT_VALIDITY) : (parseInt(r.validity) || DEFAULT_VALIDITY),
        }));
        // Block duplicate sports — a member can hold only one active enrollment per sport.
        const dupSport = duplicateEnrollmentSport(enrollments);
        if (dupSport) {
          toast(`"${dupSport}" is enrolled more than once. A member can have only one active enrollment per sport — remove the extra row, or use Switch Sport to change a sport.`, 'error');
          return;
        }
        // Derive member-level fields from the per-sport cards:
        //  • member start  = earliest sport start
        //  • first reg     = the entered value, else earliest sport start
        //  • member expiry = latest sport end (start + validity), computed
        const primary = enrollments[0];
        const validity = primary.validity || DEFAULT_VALIDITY;   // kept for back-compat / fallbacks
        const md = deriveMemberDates(enrollments, $('#f-firstreg').value || null);
        const minStart = md.startDate;

        const data = {
          id: m.id,
          name: nameEn,
          nameArabic: nameAr || null,
          phone,
          phone2,
          email: email || null,
          qid: $('#f-qid').value.trim() || null,
          birthdate: birthdate || null,
          nationality: $('#f-nationality').value.trim() || null,
          level: $('#f-level').value || null,
          sport: primary.sport,
          coachId: primary.coachId,
          firstRegistration: md.firstRegistration,
          startDate: md.startDate,
          joinDate: md.firstRegistration,
          expiryDate: ($('#f-expiry') && $('#f-expiry').value) ? $('#f-expiry').value : md.expiryDate,
          validity,                           // <-- primary sport's validity (back-compat)
          status: ($('#f-status').value === 'Withdrawn' && enrollments.length) ? 'Active' : $('#f-status').value,
          subscriptions: m.subscriptions || [],
          renewals: m.renewals || [],
          months: m.months || [],
          enrollments,                        // <-- all concurrent sports stored here
        };

        if (isNew) {
          state.members.push(data);
          pushRecentMember(data.id);
          audit('member.create', `member:${data.id}`,
            `Added ${data.name || data.nameArabic}`,
            { memberId: data.id, name: data.name, nameArabic: data.nameArabic, phone: data.phone, sports: enrollments.map(e => e.sport) });

          const totalPay = enrollments.reduce((s, e) => s + e.price, 0);
          if (totalPay > 0) {
            const method = $('#f-method')?.value || 'cash';
            const activityDate = data.startDate || data.joinDate;
            const monthKey = activityDate.slice(0, 7);
            const ref = nextInvoiceRef();
            const sportList = enrollments.map(e => e.sport).join(', ');
            // Deposit / partial: "Paid now" defaults to the full total.
            const paidRaw = $('#f-paidnow')?.value;
            const paidNow = (paidRaw === '' || paidRaw == null) ? totalPay : Math.max(0, Math.min(parseFloat(paidRaw) || 0, totalPay));
            const newInv = {
              id: nextId(state.invoices),
              date: activityDate,
              description: `${data.name} — ${sportList} subscription`,
              amount: totalPay,
              amountPaid: paidNow,
              payments: paidNow > 0 ? [{ date: activityDate, month: monthKey, amount: paidNow, method }] : [],
              method,
              month: monthKey,
              ref,
              sport: sportList,
              coach: coachName(primary.coachId),
              coachId: primary.coachId,   // primary coach (backwards compat)
              customerId: data.id,
              customerName: data.name,
              category: 'Membership',
              activityType: 'subscription',
              // Each lineItem keeps its own coachId so commission can split per-sport
              lineItems: enrollments.map(e => ({
                sport: e.sport,
                coach: coachName(e.coachId),
                coachId: e.coachId,
                classes: e.classes,
                price: e.price,
                durationLabel: e.durationLabel || null,
              })),
            };
            state.invoices.push(newInv);

            // One subscription record per enrolled sport. Most sports share
            // the transaction-level validity, but Summer Camp uses its own
            // duration (stored in e.classes as days).
            enrollments.forEach((e, i) => {
              const isCamp = e.sport === SUMMER_CAMP;
              const eStart = enrollmentStartDate(e, data);   // per-sport start (defaults to member start)
              const subValidity = isCamp ? (e.classes || DEFAULT_VALIDITY) : (e.validity || DEFAULT_VALIDITY);
              const subEnd = addDays(eStart, subValidity);
              data.subscriptions.push({
                month: ymToShort(eStart.slice(0, 7)) || eStart.slice(0, 7),
                activity: e.sport,
                coach: coachName(e.coachId),
                coachId: e.coachId,
                firstRegistration: data.firstRegistration || null,
                start: eStart,
                validity: subValidity,
                end: subEnd,
                status: 'active',
                totalClasses: e.classes || null,
                attendedClasses: 0,
                priceCompleted: null,
                amountPaid: e.price,
                invoiceNumber: ref,
                durationLabel: e.durationLabel || null,
                _sid: 's' + Date.now() + '_' + i,
              });
            });

            // Update member's expiry to the LATEST of all sport end dates
            // (so the member is "active" until their last sport ends)
            const allEnds = data.subscriptions.map(s => s.end).filter(Boolean);
            if (allEnds.length) {
              const latest = allEnds.sort().pop();
              if (!data.expiryDate || latest > data.expiryDate) data.expiryDate = latest;
            }

            save();
            closeModal();
            render();
            toast(`Member added · ${enrollments.length} sport${enrollments.length !== 1 ? 's' : ''} · invoice ${ref}` + (invoiceBalance(newInv) > 0.001 ? ` · ${fmt(paidNow)} paid, ${fmt(invoiceBalance(newInv))} due` : ''));
            showNewMemberInvoiceModal(newInv.id, data.name);
            return;
          }

          save();
          closeModal();
          render();
          toast('Member added');
          return;
        }

        // Editing existing — merge new fields over the original so we don't
        // wipe dailyAttendance, freezes, currentFreezeUntil, renewalsBySport, etc.
        const idx = state.members.findIndex(x => x.id === m.id);
        const existing = state.members[idx];
        // Sync enrollment edits and detect new sports added during edit.
        const subs = (existing.subscriptions || []).slice();
        const newSubs = [];          // newly-added enrollments to invoice
        for (const e of enrollments) {
          // Find this sport's existing subscription (by SPORT — one per sport).
          // Changing the coach updates that sub instead of creating a duplicate.
          let matched = false;
          for (let i = subs.length - 1; i >= 0; i--) {
            const s = subs[i];
            if (s.activity === e.sport) {
              syncSubToEnrollment(s, e, existing, state.invoices);
              matched = true;
              break;
            }
          }
          if (!matched && e.price > 0) {
            // Brand-new sport for this member — record it as a subscription
            // and create an invoice for it.
            newSubs.push(e);
          }
        }

        // Create one combined invoice for ALL newly-added sports (if any)
        if (newSubs.length > 0) {
          // Each newly-added sport can carry its OWN start date (a member who
          // adds a sport a week later). Defaults to the member's start date.
          const startOf = (e) => enrollmentStartDate(e, existing);
          const startDate = newSubs.map(startOf).sort()[0];   // earliest new-sport start (invoice date)
          const monthKey = startDate.slice(0, 7);
          const totalNew = newSubs.reduce((s, e) => s + e.price, 0);
          const ref = nextInvoiceRef();
          const sportList = newSubs.map(e => e.sport).join(', ');
          const primaryNew = newSubs[0];

          state.invoices.push({
            id: nextId(state.invoices),
            date: startDate,
            description: `${existing.name} — ${sportList} added`,
            amount: totalNew,
            amountPaid: totalNew,
            payments: [{ date: startDate, month: monthKey, amount: totalNew, method: 'cash' }],
            method: 'cash',
            month: monthKey,
            ref,
            sport: sportList,
            coach: coachName(primaryNew.coachId),
            coachId: primaryNew.coachId,
            customerId: existing.id,
            customerName: existing.name,
            category: 'Membership',
            activityType: 'subscription',
            lineItems: newSubs.map(e => ({
              sport: e.sport,
              coach: coachName(e.coachId),
              coachId: e.coachId,
              classes: e.classes,
              price: e.price,
              durationLabel: e.durationLabel || null,
            })),
          });

          // Push subscription rows for each new sport. Summer Camp uses
          // its own duration; others share the form's validity.
          newSubs.forEach((e, i) => {
            const isCamp = e.sport === SUMMER_CAMP;
            const eStart = startOf(e);                          // this sport's own start date
            const subValidity = isCamp ? (e.classes || DEFAULT_VALIDITY) : (e.validity || DEFAULT_VALIDITY);
            const subEnd = addDays(eStart, subValidity);
            subs.push({
              _sid: 's' + Date.now() + '_add' + i,
              month: ymToShort(eStart.slice(0, 7)) || eStart.slice(0, 7),
              activity: e.sport,
              coach: coachName(e.coachId),
              coachId: e.coachId,
              firstRegistration: existing.firstRegistration || null,
              start: eStart,
              validity: subValidity,
              end: subEnd,
              status: 'active',
              totalClasses: e.classes || null,
              attendedClasses: 0,
              priceCompleted: null,
              amountPaid: e.price,
              invoiceNumber: ref,
              durationLabel: e.durationLabel || null,
            });
          });
          // Update member's expiry to the LATEST end across all sports
          const allEnds = subs.map(s => s.end).filter(Boolean);
          if (allEnds.length) {
            const latest = allEnds.sort().pop();
            if (!data.expiryDate || latest > data.expiryDate) data.expiryDate = latest;
          }

          toast(`Member updated · ${newSubs.length} new sport${newSubs.length===1?'':'s'} added · invoice ${ref}`, 'success');
        } else {
          toast('Member updated');
        }

        data.subscriptions = subs;
        // Member expiry = latest end across ALL sports (covers edited start/validity too)
        const subEnds = subs.map(s => s.end).filter(Boolean).sort();
        if (subEnds.length) data.expiryDate = subEnds[subEnds.length - 1];
        state.members[idx] = Object.assign({}, existing, data);
        pushRecentMember(data.id);
        audit('member.update', `member:${data.id}`,
          `Updated ${data.name || data.nameArabic}`,
          { memberId: data.id, name: data.name, nameArabic: data.nameArabic, phone: data.phone });
        save();
        closeModal();
        render();
      }},
    ],
  });

  // Post-render: populate enrollment rows and wire the "+ Add sport" button
  renderEnrollRows();
  const addBtn = document.getElementById('enroll-add');
  if (addBtn) addBtn.addEventListener('click', addEnrollRow);
  document.getElementById('f-paidnow')?.addEventListener('input', updatePaidNowHint);
  // Scan-ID: lazy OCR (Tesseract.js, loaded from CDN on first use).
  const scanBtn = document.getElementById('id-scan-btn');
  const scanFile = document.getElementById('id-scan-file');
  if (scanBtn && scanFile) {
    scanBtn.addEventListener('click', () => scanFile.click());
    scanFile.addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) scanIdCard(f); e.target.value = ''; });
  }
  // Membership expiry is derived per-sport now (each card = start + validity),
  // shown live in #f-expiry-readout by renderEnrollRows(). No member-level
  // start/validity/expiry inputs to reconcile anymore.
}

// Success modal after creating a new member with auto-invoice
function showNewMemberInvoiceModal(invoiceId, customerName) {
  const inv = state.invoices.find(i => i.id === invoiceId);
  const bal = inv ? invoiceBalance(inv) : 0;
  const payLine = inv ? (bal > 0.001
    ? `<div style="font-size:14px;margin:8px 0 4px"><b style="color:var(--green)">${fmt(invoicePaid(inv))} QAR</b> paid · <b style="color:var(--accent-2)">${fmt(bal)} QAR due</b> <span class="text-mute">(total ${fmt(inv.amount)})</span></div>`
    : `<div style="font-size:14px;margin:8px 0 4px"><b style="color:var(--green)">${fmt(inv.amount)} QAR</b> paid in full</div>`) : '';
  showModal({
    title: '✅ Member & Invoice Created',
    body: `
      <div style="text-align:center;padding:10px 0">
        <div style="font-size:42px;margin-bottom:10px">🎉</div>
        <div style="font-size:16px;font-weight:600;margin-bottom:6px">${escapeHtml(customerName)} added successfully</div>
        ${payLine}
        <div class="text-dim" style="font-size:13px;margin-bottom:4px">A subscription invoice has been created automatically.</div>
        <div class="text-mute" style="font-size:12px">You can export it as a PDF (filename will be the customer's name) to share with the customer.</div>
      </div>
    `,
    actions: [
      { label: 'Done', class: 'btn ghost', onclick: closeModal },
      { label: '✏️ Edit member', class: 'btn ghost', onclick: () => { closeModal(); if (inv && inv.customerId) editMember(inv.customerId); } },
      { label: '💬 Send to WhatsApp', class: 'btn ghost', onclick: () => { closeModal(); sendInvoiceWhatsApp(invoiceId); } },
      { label: '⬇ Export Invoice PDF', class: 'btn primary', onclick: () => { closeModal(); printInvoicePDF(invoiceId); } },
    ],
  });
}

function exportMembersCSV(list) {
  const members = Array.isArray(list) ? list : state.members;
  if (!members.length) { toast('No members to export', 'error'); return; }
  const rows = [['ID','Name','Name (Arabic)','Sport','Coach','Phone','Phone 2','Email','QID','Birthdate','Level','Joined','Expiry','Status']];
  for (const m of members) {
    rows.push([m.id, m.name, m.nameArabic || '', m.sport, coachName(m.coachId), m.phone || '', m.phone2 || '', m.email || '', m.qid || '', m.birthdate || '', m.level || '', m.joinDate, m.expiryDate || '', m.status]);
  }
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadFile('members.csv', csv, 'text/csv');
  toast(`Exported ${members.length} member${members.length === 1 ? '' : 's'}`);
}

// ─── COACHES ──────────────────────────────────────────────────

// Coach profile modal — stats, sports, students, commission, status.
window.viewCoach = function(id) {
  const c = state.coaches.find(x => x.id === id);
  if (!c) return;
  const active = isCoachActive(c);

  // Aggregate this coach's subscriptions across all members
  function statsFor(month) {
    let students = new Set(), attended = 0, total = 0;
    const monthKey = month ? (month.length === 7 ? month : null) : null;
    for (const m of state.members) {
      for (const s of (m.subscriptions || [])) {
        if (s.coachId !== id) continue;
        if (month && s.month !== month) continue;
        students.add(m.id);
        const daily = monthKey ? attendanceFor(m, monthKey, s.activity || m.sport) : null;
        if (daily && Object.keys(daily).length) {
          const y = Object.values(daily).filter(v => v === 'Y').length;
          const n = Object.values(daily).filter(v => v === 'N').length;
          attended += y; total += (y + n) || (s.totalClasses || 0);
        } else {
          attended += s.attendedClasses || 0; total += s.totalClasses || 0;
        }
      }
    }
    // Revenue from invoices linked to this coach (real cash) — line-item aware
    // so a merged invoice credits each coach for only their own line.
    let revenue = 0;
    for (const inv of state.invoices) {
      if (monthKey && inv.month !== monthKey) continue;
      const lis = (Array.isArray(inv.lineItems) && inv.lineItems.length)
        ? inv.lineItems
        : [{ coachId: inv.coachId, price: inv.amount || 0 }];
      for (const li of lis) if (li.coachId === id) revenue += li.price || 0;
    }
    return { students: students.size, revenue, subValue: revenue, attended, total, rate: total ? attended / total * 100 : 0 };
  }
  const apr = statsFor('apr'), may = statsFor('may');
  const aprComm = (apr.commissionBase ?? apr.revenue) * (c.rate / 100), mayComm = (may.commissionBase ?? may.revenue) * (c.rate / 100);

  // Current students under this coach (any subscription), deduped
  const studentRows = [];
  const seen = new Set();
  for (const m of state.members) {
    const subs = (m.subscriptions || []).filter(s => s.coachId === id);
    if (!subs.length || seen.has(m.id)) continue;
    seen.add(m.id);
    const sports = [...new Set(subs.map(s => s.activity).filter(Boolean))].join(', ');
    studentRows.push(`
      <tr style="cursor:pointer" onclick="closeModal(); viewMember(${m.id})">
        <td>${escapeHtml(m.name)}</td>
        <td>${escapeHtml(sports || '—')}</td>
        <td><span class="badge ${memberStatus(m).toLowerCase()}">${memberStatus(m)}</span></td>
      </tr>`);
  }

  showModal({
    title: `Coach: ${escapeHtml(c.name)}`,
    body: `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
        <div class="avatar" style="width:64px;height:64px;font-size:24px;background:linear-gradient(135deg,var(--blue),var(--purple))">${initials(c.name)}</div>
        <div style="flex:1">
          <div style="font-size:18px;font-weight:700">${escapeHtml(c.name)}</div>
          <div class="text-dim">${(c.sports || []).join(' · ')}</div>
          <div class="mt-1">
            <span class="badge ${active ? 'active' : 'expired'}">${active ? 'Active' : 'Inactive'}</span>
            <span class="badge">${(c.role || 'coach') === 'staff' ? '👔 Staff' : '🥋 Coach'}</span>
            ${c.fixedSalary > 0 ? `<span class="badge blue">Fixed ${fmt(c.fixedSalary)} QAR</span>` : ''}
            ${c.rate > 0 ? `<span class="badge blue">${c.rate}% commission</span>` : ''}
          </div>
        </div>
      </div>
      ${!active ? `<div style="margin-bottom:14px;padding:10px 14px;background:rgba(242,96,96,.08);border:1px solid rgba(242,96,96,.25);border-radius:8px;font-size:12px;color:var(--red)">This coach is inactive and won't appear when registering new members or renewals. Existing records are kept.</div>` : ''}

      ${(c.phone || c.email || c.qid || c.birthdate) ? `
      <div style="margin-bottom:16px;padding:12px;background:var(--surface-2);border-radius:8px">
        <div style="font-size:10px;color:var(--text-mute);text-transform:uppercase;letter-spacing:.6px;font-weight:600;margin-bottom:8px">📇 Contact & Profile</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px 16px;font-size:13px">
          ${c.phone ? `<div><span class="text-mute" style="font-size:10px;display:block;text-transform:uppercase">Mobile</span>${phoneCell(c.phone, { stop: false })}</div>` : ''}
          ${c.email ? `<div><span class="text-mute" style="font-size:10px;display:block;text-transform:uppercase">Email</span>✉️ ${escapeHtml(c.email)}</div>` : ''}
          ${c.qid ? `<div><span class="text-mute" style="font-size:10px;display:block;text-transform:uppercase">QID</span>🆔 ${escapeHtml(c.qid)}</div>` : ''}
          ${c.birthdate ? `<div><span class="text-mute" style="font-size:10px;display:block;text-transform:uppercase">Birthdate</span>🎂 ${fmtDate(c.birthdate)}</div>` : ''}
        </div>
      </div>` : `
      <div style="margin-bottom:16px;padding:10px;background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.2);border-radius:8px;font-size:12px;color:var(--text-dim)">
        ⚠️ Contact details incomplete. Click <b>Edit</b> to add mobile, QID, and other profile info.
      </div>`}
      <div class="kpi-grid mb-3" style="grid-template-columns:repeat(4,1fr);gap:8px">
        <div class="kpi" style="padding:10px 12px"><div class="kpi-label" style="font-size:10px">May Students</div><div class="kpi-value" style="font-size:18px">${may.students}</div></div>
        <div class="kpi green" style="padding:10px 12px"><div class="kpi-label" style="font-size:10px">May Revenue</div><div class="kpi-value" style="font-size:18px">${fmt(may.revenue)}</div></div>
        <div class="kpi blue" style="padding:10px 12px"><div class="kpi-label" style="font-size:10px">May Pay</div><div class="kpi-value" style="font-size:18px">${fmt(mayComm)}</div></div>
        <div class="kpi orange" style="padding:10px 12px"><div class="kpi-label" style="font-size:10px">Att Rate</div><div class="kpi-value" style="font-size:18px">${may.total ? Math.round(may.rate) : 0}%</div></div>
      </div>
      <div class="row row-2 mb-3" style="font-size:12px">
        <div><div class="text-mute" style="font-size:10px;text-transform:uppercase">Apr Students</div><div>${apr.students}</div></div>
        <div><div class="text-mute" style="font-size:10px;text-transform:uppercase">Apr Revenue</div><div>${fmt(apr.revenue)} QAR</div></div>
        <div><div class="text-mute" style="font-size:10px;text-transform:uppercase">Apr Pay</div><div>${fmt(aprComm)} QAR</div></div>
        <div><div class="text-mute" style="font-size:10px;text-transform:uppercase">May Classes</div><div>${may.attended}/${may.total}</div></div>
      </div>
      <h3 style="font-size:13px;font-weight:600;margin-bottom:8px">Students with this coach (${studentRows.length})</h3>
      <div class="table-wrap" style="max-height:240px;overflow:auto">
        <table>
          <thead><tr><th>Name</th><th>Sport(s)</th><th>Status</th></tr></thead>
          <tbody>${studentRows.join('') || '<tr><td colspan="3" class="text-mute" style="padding:16px">No students assigned</td></tr>'}</tbody>
        </table>
      </div>
    `,
    actions: [
      { label: active ? '🚫 Deactivate' : '✅ Activate', class: 'btn ghost', onclick: () => { toggleCoachActive(id); closeModal(); viewCoach(id); } },
      { label: 'Edit', class: 'btn ghost', onclick: () => { closeModal(); editCoach(id); } },
      { label: 'Close', class: 'btn primary', onclick: closeModal },
    ],
  });
};

// Add or edit a coach/staff. Second arg is the default role for NEW people:
// 'coach' (default) → presets commission=30, fixed=0, sports panel shown
// 'staff'           → presets commission=0,  fixed=3000, sports panel hidden
window.editCoach = function(id, defaultRole) {
  const isNew = !id;
  const startRole = defaultRole || 'coach';
  const c = id ? state.coaches.find(x => x.id === id) : {
    id: null, name: '',
    rate: startRole === 'staff' ? 0 : 30,
    fixedSalary: startRole === 'staff' ? 3000 : 0,
    role: startRole,
    sports: [],
    active: 'Y',
    phone: '', qid: '', birthdate: '', email: '',
  };
  if (!c) return;
  const sportChecks = SPORTS.map(s => `
    <label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;margin:2px 8px 2px 0;cursor:pointer">
      <input type="checkbox" class="coach-sport" value="${s}" ${(c.sports || []).includes(s) ? 'checked' : ''} /> ${s}
    </label>`).join('');
  const role = c.role || 'coach';
  const titleNew = startRole === 'staff' ? 'Add Staff Member' : 'Add Coach';
  showModal({
    title: isNew ? titleNew : 'Edit Person',
    wide: true,
    body: `
      <div style="margin-bottom:6px;font-size:11px;color:var(--blue);text-transform:uppercase;letter-spacing:.6px;font-weight:600">👤 Identity</div>
      <div class="form-row">
        <div class="field"><label>Name <span style="color:var(--accent)">*</span></label><input id="c-name" value="${escapeHtml(c.name)}" placeholder="${role === 'staff' ? 'e.g. Sara (admin)' : 'e.g. Ahmed Salah'}" /></div>
        <div class="field"><label>Role</label>
          <select id="c-role">
            <option value="coach" ${role==='coach'?'selected':''}>🥋 Coach — teaches classes</option>
            <option value="staff" ${role==='staff'?'selected':''}>👔 Staff — admin / reception / cleaner</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        ${phoneInputHtml('c-phone', c.phone, { label: 'Mobile' })}
        <div class="field"><label>Email <span class="text-mute" style="font-size:10px">(optional)</span></label><input id="c-email" type="email" value="${escapeHtml(c.email || '')}" placeholder="name@example.com" /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>QID <span class="text-mute" style="font-size:10px">(optional)</span></label><input id="c-qid" value="${escapeHtml(c.qid || '')}" placeholder="288…" /></div>
        <div class="field"><label>Birthdate <span class="text-mute" style="font-size:10px">(optional)</span></label><input id="c-bdate" type="date" value="${c.birthdate || ''}" /></div>
      </div>

      <div style="margin:14px 0 6px;font-size:11px;color:var(--blue);text-transform:uppercase;letter-spacing:.6px;font-weight:600">💰 Pay configuration</div>
      <div class="form-row">
        <div class="field"><label>Fixed monthly salary (QAR)</label><input id="c-fixed" type="number" min="0" step="0.01" value="${c.fixedSalary || 0}" /></div>
        <div class="field"><label>Commission rate (%)</label><input id="c-rate" type="number" min="0" max="100" step="1" value="${c.rate || 0}" /></div>
      </div>
      <div class="text-mute" style="font-size:11px;margin-top:-6px;margin-bottom:10px">
        💡 Monthly pay = <b>Fixed</b> + (<b>Commission %</b> × eligible membership revenue). For a pure coach: Fixed=0, Commission=30%. For admin/cleaner: Fixed=3000, Commission=0%.
      </div>

      <div style="margin:14px 0 6px;font-size:11px;color:var(--blue);text-transform:uppercase;letter-spacing:.6px;font-weight:600">⚙️ Other</div>
      <div class="field"><label>Status</label>
        <select id="c-active"><option value="Y" ${isCoachActive(c)?'selected':''}>Active — included in payroll</option><option value="N" ${!isCoachActive(c)?'selected':''}>Inactive — hidden, won't appear on payroll</option></select>
      </div>
      <div class="field" id="c-sports-field" style="display:${role === 'staff' ? 'none' : 'block'}">
        <label>Sports taught</label>
        <div style="padding:8px;background:var(--surface-2);border-radius:8px">${sportChecks}</div>
      </div>
    `,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: isNew ? 'Add' : 'Save', class: 'btn primary', onclick: () => {
        // ── Validation ──
        const name = $('#c-name').value.trim();
        const phoneInput = readPhoneInput('c-phone');
        const phone = phoneInput.phone;
        const email = $('#c-email').value.trim();
        const birthdate = $('#c-bdate').value;

        if (!name) { toast('Name required', 'error'); $('#c-name')?.focus(); return; }
        if (!phoneInput.valid) {
          toast(phoneInput.error || 'Mobile number is invalid', 'error');
          document.getElementById('c-phone-digits')?.focus();
          return;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
          toast('Email format is invalid', 'error');
          $('#c-email')?.focus();
          return;
        }
        if (birthdate) {
          const bd = new Date(birthdate);
          const today = new Date(TODAY);
          if (bd > today) { toast('Birthdate cannot be in the future', 'error'); return; }
        }
        // ── End validation ──

        const rate = parseFloat($('#c-rate').value) || 0;
        const fixedSalary = parseFloat($('#c-fixed').value) || 0;
        const roleVal = $('#c-role').value || 'coach';
        const sports = $$('.coach-sport').filter(x => x.checked).map(x => x.value);
        const activeVal = $('#c-active').value;
        const qid = $('#c-qid').value.trim() || null;

        if (fixedSalary === 0 && rate === 0) {
          if (!confirm('Both fixed salary AND commission % are 0. This person will earn nothing. Save anyway?')) return;
        }
        if (isNew) {
          state.coaches.push({
            id: nextId(state.coaches),
            name, rate, fixedSalary, role: roleVal, sports, active: activeVal,
            phone, email: email || null, qid, birthdate: birthdate || null,
          });
        } else {
          Object.assign(c, {
            name, rate, fixedSalary, role: roleVal, sports, active: activeVal,
            phone, email: email || null, qid, birthdate: birthdate || null,
          });
        }
        save(); closeModal(); render();
        toast(isNew ? `${roleVal === 'staff' ? 'Staff member' : 'Coach'} added` : 'Saved');
      }},
    ],
  });
  // Wire role change → adapt the form on the fly
  setTimeout(() => {
    const roleSel = $('#c-role');
    const fixedInp = $('#c-fixed');
    const rateInp = $('#c-rate');
    const sportsField = $('#c-sports-field');
    if (!roleSel || !fixedInp || !rateInp) return;
    roleSel.addEventListener('change', () => {
      const isStaff = roleSel.value === 'staff';
      if (isStaff && parseFloat(rateInp.value) === 30 && parseFloat(fixedInp.value) === 0) {
        fixedInp.value = 3000;
        rateInp.value = 0;
      } else if (!isStaff && parseFloat(rateInp.value) === 0 && parseFloat(fixedInp.value) === 3000) {
        fixedInp.value = 0;
        rateInp.value = 30;
      }
      if (sportsField) sportsField.style.display = isStaff ? 'none' : 'block';
    });
  }, 50);
};

// ═══════════════════════════════════════════════════════════════════
// SCHEDULE — visual weekly class grid with drag-and-drop editing + PNG export
// ═══════════════════════════════════════════════════════════════════
PAGES.campschedule = (main) => {
  if (!state.campSchedule || !state.campSchedule.days) state.campSchedule = defaultCampSchedule();
  const cs = state.campSchedule;
  const groups = CAMP_GROUPS;

  const dayNum = (k) => CAMP_DAYS.indexOf(k) + 1;
  const isAdmin = currentRole() === 'admin';
  // Default the date to today if within the camp window, else the camp start.
  let selDate = window.__campDate || ((TODAY >= cs.startDate && TODAY <= cs.endDate) ? TODAY : cs.startDate);
  let selDay = campDayKeyForDate(selDate) || (window.__campDay && cs.days[window.__campDay] ? window.__campDay : 'sunday');
  let selOff = !!window.__campDate && campDayKeyForDate(window.__campDate) === null;   // Fri/Sat date selected
  window.__campDay = selDay; window.__campDate = selDate;
  const firstDateForDay = (dayKey) => {
    let d = cs.startDate;
    for (let i = 0; i < 21 && d <= cs.endDate; i++) { if (campDayKeyForDate(d) === dayKey) return d; d = addDays(d, 1); }
    return null;
  };

  function cellHtml(dayKey, rowIdx, g) {
    const cell = ((cs.days[dayKey] || [])[rowIdx] || {})[g.key] || { activity: '', coach: '' };
    const act = cell.activity || '';
    return `<td class="camp-cell" data-cc="${dayKey}|${rowIdx}|${g.key}" ${isAdmin ? 'draggable="true"' : ''} title="${isAdmin ? 'Click to edit · drag to move' : 'Click to edit'}"
      style="padding:14px;border:1px solid var(--border);cursor:pointer;vertical-align:middle;background:var(--surface)">
      ${act
        ? `<div style="font-weight:800;color:${g.color};font-size:14px;line-height:1.25">${campActivityIcon(act)} ${escapeHtml(act)}</div>${cell.coach ? `<div style="font-size:11px;color:var(--text-mute);margin-top:3px">(${escapeHtml(cell.coach)})</div>` : ''}`
        : '<div style="color:var(--text-mute);font-size:12px">— tap to add —</div>'}
    </td>`;
  }

  function buildGrid() {
    if (selOff) {
      return `<div style="padding:52px 20px;text-align:center">
        <div style="font-size:46px">🌙</div>
        <div style="font-size:21px;font-weight:800;margin-top:10px">Day Off</div>
        <div class="text-mute" style="font-size:13px;margin-top:6px">${escapeHtml(fmtDate(window.__campDate))} — the camp runs <b>Sunday to Thursday</b>, so there are no classes on Friday or Saturday.</div>
      </div>`;
    }
    let actIdx = -1;
    const rows = CAMP_SLOTS.map(slot => {
      const timeCell = `<td style="padding:10px 12px;border:1px solid var(--border);font-weight:700;font-size:12px;white-space:nowrap;background:var(--surface-2)">${slot.time}</td>`;
      if (slot.type === 'break') {
        return `<tr>${timeCell}<td colspan="3" style="padding:12px;border:1px solid var(--border);text-align:center;font-weight:800;letter-spacing:.5px;background:${slot.bg || 'var(--surface-2)'}">${escapeHtml(slot.label)}</td></tr>`;
      }
      actIdx++;
      const ri = actIdx;
      return `<tr>${timeCell}${groups.map(g => cellHtml(selDay, ri, g)).join('')}</tr>`;
    }).join('');
    return `<table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr>
        <th style="padding:12px;border:1px solid var(--border);background:var(--surface-2);width:120px">TIME</th>
        ${groups.map(g => `<th style="padding:12px;border:1px solid var(--border);background:${g.color};color:#fff;font-weight:800;letter-spacing:.4px">${escapeHtml(g.label.toUpperCase())}</th>`).join('')}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>☀️ Summer Camp Schedule</h1>
        <div class="subtitle">Black Stars Academy · Sun–Thu · ${escapeHtml(fmtDate(cs.startDate))} – ${escapeHtml(fmtDate(cs.endDate))}</div>
      </div>
      <div class="topbar-actions">
        <button class="btn ghost" id="camp-print" title="Print the selected day (or save as PDF from the print dialog)">🖨 Print</button>
        <button class="btn ghost" id="camp-reset" title="Restore the original camp schedule for all five days">↺ Reset to default</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <label style="font-weight:600;font-size:13px">Day</label>
      <select id="camp-day" class="btn ghost" style="font-weight:600">
        ${CAMP_DAYS.map(k => `<option value="${k}" ${k === selDay ? 'selected' : ''}>${CAMP_DAY_LABELS[k]} · Day ${dayNum(k)}</option>`).join('')}
      </select>
      <span style="width:1px;height:22px;background:var(--border)"></span>
      <label style="font-weight:600;font-size:13px">Date</label>
      <input type="date" id="camp-date" class="btn ghost" value="${selDate}" min="${cs.startDate}" max="${cs.endDate}" style="font-weight:600" />
      <button class="btn ghost" id="camp-today" title="Jump to today's date">📅 Today</button>
      <span id="camp-datelabel" class="text-mute" style="font-size:12px"></span>
      <span class="text-mute" style="font-size:12px;margin-left:auto">${isAdmin ? 'Click to edit · drag a class to move it.' : 'Click any class to edit it.'}</span>
    </div>

    <div class="card" id="camp-grid" style="overflow:auto">${buildGrid()}</div>
  `;

  function rerender() { const g = $('#camp-grid'); if (g) g.innerHTML = buildGrid(); wireCells(); }
  function wireCells() {
    $$('#camp-grid .camp-cell').forEach(td => {
      td.addEventListener('click', () => {
        const parts = (td.getAttribute('data-cc') || '').split('|');
        editCampCell(parts[0], parseInt(parts[1]), parts[2]);
      });
      if (isAdmin) {
        td.addEventListener('dragstart', e => { e.dataTransfer.setData('text/cc', td.getAttribute('data-cc') || ''); td.style.opacity = '.4'; });
        td.addEventListener('dragend', () => { td.style.opacity = ''; });
        td.addEventListener('dragover', e => e.preventDefault());
        td.addEventListener('drop', e => {
          e.preventDefault();
          const from = e.dataTransfer.getData('text/cc');
          const to = td.getAttribute('data-cc');
          if (from && to && from !== to) swapCampCells(from, to);
        });
      }
    });
  }
  function swapCampCells(fromCC, toCC) {
    const f = fromCC.split('|'), t = toCC.split('|');
    const fday = f[0], fr = parseInt(f[1]), fg = f[2];
    const tday = t[0], tr = parseInt(t[1]), tg = t[2];
    if (!cs.days[fday] || !cs.days[tday]) return;
    if (!cs.days[fday][fr]) cs.days[fday][fr] = {};
    if (!cs.days[tday][tr]) cs.days[tday][tr] = {};
    const a = cs.days[fday][fr][fg] || { activity: '', coach: '' };
    const b = cs.days[tday][tr][tg] || { activity: '', coach: '' };
    cs.days[fday][fr][fg] = b;
    cs.days[tday][tr][tg] = a;
    save(); rerender(); toast('Class moved');
  }
  function editCampCell(dayKey, rowIdx, gkey) {
    const g = groups.find(x => x.key === gkey);
    if (!cs.days[dayKey][rowIdx]) cs.days[dayKey][rowIdx] = {};
    const cell = cs.days[dayKey][rowIdx][gkey] || { activity: '', coach: '' };
    // Only coaches who teach this activity (when it's a real sport) and are active.
    const coachNames = coachesForSport(cell.activity || '', null).map(c => c.name).filter(Boolean);
    const curCoach = cell.coach || '';
    const coachOpts = ['<option value="">— none —</option>']
      .concat(coachNames.map(n => `<option ${n === curCoach ? 'selected' : ''}>${escapeHtml(n)}</option>`));
    if (curCoach && !coachNames.includes(curCoach)) coachOpts.splice(1, 0, `<option selected>${escapeHtml(curCoach)}</option>`);
    showModal({
      title: `Edit · ${CAMP_DAY_LABELS[dayKey]} · ${g ? g.label : gkey}`,
      body: `
        <div class="field"><label>Activity</label><input id="cc-act" value="${escapeHtml(cell.activity || '')}" placeholder="e.g. Karate" /></div>
        <div class="field"><label>Coach (optional)</label><select id="cc-coach">${coachOpts.join('')}</select></div>
      `,
      actions: [
        { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
        { label: 'Clear', class: 'btn ghost', onclick: () => { cs.days[dayKey][rowIdx][gkey] = { activity: '', coach: '' }; save(); closeModal(); rerender(); } },
        { label: 'Save', class: 'btn primary', onclick: () => {
            cs.days[dayKey][rowIdx][gkey] = { activity: ($('#cc-act').value || '').trim(), coach: ($('#cc-coach').value || '').trim() };
            save(); closeModal(); rerender(); toast('Class updated');
          } },
      ],
    });
  }

  function updateDateLabel() {
    const el = $('#camp-datelabel'); if (!el) return;
    const d = window.__campDate;
    const k = d ? campDayKeyForDate(d) : null;
    if (!d) { el.textContent = ''; return; }
    el.textContent = k ? `→ ${CAMP_DAY_LABELS[k]} · Day ${dayNum(k)}` : `→ ${fmtDate(d)} is an off day (Fri/Sat)`;
    el.style.color = k ? 'var(--text-mute)' : 'var(--accent)';
  }

  function buildPrintHtml(dayKey, dateLabel) {
    const head = groups.map(g => `<th style="padding:10px;border:1px solid #ccc;background:${g.color};color:#fff;font-weight:800;letter-spacing:.4px">${escapeHtml(g.label.toUpperCase())}</th>`).join('');
    let ai = -1;
    const rows = CAMP_SLOTS.map(slot => {
      const time = `<td style="padding:8px 10px;border:1px solid #ccc;font-weight:700;font-size:12px;white-space:nowrap;background:#f4f4f6">${slot.time}</td>`;
      if (slot.type === 'break') {
        const bg = (slot.label || '').includes('Breakfast') ? '#fdf0c8' : (slot.label || '').includes('Prayer') ? '#dff3e1' : '#eceef0';
        return `<tr>${time}<td colspan="3" style="padding:10px;border:1px solid #ccc;text-align:center;font-weight:800;letter-spacing:.5px;background:${bg}">${escapeHtml(slot.label)}</td></tr>`;
      }
      ai++; const ri = ai;
      const cells = groups.map(g => {
        const cell = ((cs.days[dayKey] || [])[ri] || {})[g.key] || { activity: '', coach: '' };
        return `<td style="padding:12px;border:1px solid #ccc;background:#fff;vertical-align:middle">${cell.activity ? `<div style="font-weight:800;color:${g.color};font-size:14px">${campActivityIcon(cell.activity)} ${escapeHtml(cell.activity)}</div>${cell.coach ? `<div style="font-size:11px;color:#777;margin-top:2px">(${escapeHtml(cell.coach)})</div>` : ''}` : ''}</td>`;
      }).join('');
      return `<tr>${time}${cells}</tr>`;
    }).join('');
    return `<div style="text-align:center;margin-bottom:14px">
        <div style="font-size:22px;font-weight:900;color:#f26060">★ BLACK STARS ACADEMY</div>
        <div style="font-size:16px;font-weight:800;margin-top:2px">SUMMER CAMP SCHEDULE</div>
        <div style="font-size:13px;color:#444;margin-top:4px">${escapeHtml(dateLabel)}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;font-family:Arial,sans-serif">
        <thead><tr><th style="padding:10px;border:1px solid #ccc;background:#f4f4f6;width:110px">TIME</th>${head}</tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }
  function printCamp() {
    const dateLabel = `${CAMP_DAY_LABELS[selDay]} · Day ${dayNum(selDay)}${window.__campDate ? ' · ' + fmtDate(window.__campDate) : ''} · Camp ${fmtDate(cs.startDate)} – ${fmtDate(cs.endDate)}`;
    const w = window.open('', '_blank');
    if (!w) { toast('Allow pop-ups to print', 'error'); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Summer Camp — ${escapeHtml(CAMP_DAY_LABELS[selDay])}</title><style>@page{size:landscape;margin:12mm}body{font-family:Arial,sans-serif;padding:10px;color:#111}</style></head><body onload="window.print()">${buildPrintHtml(selDay, dateLabel)}</body></html>`);
    w.document.close();
  }

  const daySel = $('#camp-day');
  if (daySel) daySel.addEventListener('change', e => {
    selOff = false;
    selDay = e.target.value; window.__campDay = selDay;
    const d = firstDateForDay(selDay);
    if (d) { window.__campDate = d; const di = $('#camp-date'); if (di) di.value = d; }
    updateDateLabel(); rerender();
  });
  const dateInp = $('#camp-date');
  if (dateInp) dateInp.addEventListener('change', e => {
    const v = e.target.value; if (!v) return;
    window.__campDate = v;
    const k = campDayKeyForDate(v);
    selOff = !k;
    if (k) { selDay = k; window.__campDay = k; const ds = $('#camp-day'); if (ds) ds.value = k; }
    rerender(); updateDateLabel();
  });
  const todayBtn = $('#camp-today');
  if (todayBtn) todayBtn.addEventListener('click', () => {
    const di = $('#camp-date'); if (di) di.value = TODAY;
    window.__campDate = TODAY;
    const k = campDayKeyForDate(TODAY);
    selOff = !k;
    if (k) { selDay = k; window.__campDay = k; const ds = $('#camp-day'); if (ds) ds.value = k; }
    rerender(); updateDateLabel();
    if (!k) toast('Today is an off day (Fri/Sat) — Day Off', 'info');
  });
  const printBtn = $('#camp-print');
  if (printBtn) printBtn.addEventListener('click', printCamp);

  const resetBtn = $('#camp-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    if (!confirm('Reset the Summer Camp schedule for all five days back to the original?')) return;
    state.campSchedule = defaultCampSchedule();
    save(); toast('Summer Camp schedule reset'); navigate('campschedule');
  });
  wireCells();
  updateDateLabel();
};

PAGES.schedule = (main) => {
  const DAYS = [
    { key: 'sat', label: 'SATURDAY' },
    { key: 'sun', label: 'SUNDAY' },
    { key: 'mon', label: 'MONDAY' },
    { key: 'tue', label: 'TUESDAY' },
    { key: 'wed', label: 'WEDNESDAY' },
    { key: 'thu', label: 'THURSDAY' },
    { key: 'fri', label: 'FRIDAY' },
  ];
  // 1-hour time slots from 3PM to 8PM
  const SLOTS = [
    { hour: 15, label: '3PM - 4PM' },
    { hour: 16, label: '4PM - 5PM' },
    { hour: 17, label: '5PM - 6PM' },
    { hour: 18, label: '6PM - 7PM' },
    { hour: 19, label: '7PM - 8PM' },
    { hour: 20, label: '8PM - 9PM' },
  ];
  // Color + emoji per sport — used in cells AND in palette
  const SPORT_THEME = {
    'Gymnastic':   { color: '#10b981', emoji: '🤸' },
    'Taekwondo':   { color: '#5b8def', emoji: '🥋' },
    'Kick Boxing': { color: '#ef4444', emoji: '🥊' },
    'Boxing':      { color: '#f97316', emoji: '🥊' },
    'Football':    { color: '#22c55e', emoji: '⚽' },
    'MMA':         { color: '#f59e0b', emoji: '👊' },
    'Karate':      { color: '#84cc16', emoji: '🥋' },
    'Swimming':    { color: '#06b6d4', emoji: '🏊' },
    'Zumba':       { color: '#ec4899', emoji: '💃' },
  };
  const sportColor = sp => (SPORT_THEME[sp] || { color: '#5b8def', emoji: '🏃' }).color;
  const sportEmoji = sp => (SPORT_THEME[sp] || { color: '#5b8def', emoji: '🏃' }).emoji;

  let filter = { coachId: 'all', sport: 'all' };

  // Find classes for a given day + slot
  function classesAt(day, hour) {
    return (state.schedule || []).filter(c => c.day === day && c.slot === hour);
  }

  function isFiltered(c) {
    if (filter.coachId !== 'all' && c.coachId !== parseInt(filter.coachId)) return false;
    if (filter.sport !== 'all' && c.sport !== filter.sport) return false;
    return true;
  }

  // Hover popover: show a class's top-10 most active members.
  function schHoverPop() {
    let p = document.getElementById('sch-hover-pop');
    if (!p) {
      p = document.createElement('div');
      p.id = 'sch-hover-pop';
      p.style.cssText = 'position:fixed;z-index:9999;width:240px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.45);padding:11px 13px;font-size:12px;pointer-events:none;display:none';
      document.body.appendChild(p);
    }
    return p;
  }
  function showSchHover(block) {
    const sport = block.getAttribute('data-sport');
    if (!sport) return;
    const cidRaw = block.getAttribute('data-coachid');
    const coachId = cidRaw === '' || cidRaw == null ? null : parseInt(cidRaw);
    const top = topActiveMembersForClass(sport, coachId, 10);
    const coach = state.coaches.find(c => c.id === coachId);
    const pop = schHoverPop();
    pop.innerHTML =
      `<div style="font-weight:700;margin-bottom:2px">${sportEmoji(sport)} ${escapeHtml(sport)}${coach ? ' · ' + escapeHtml(coach.name) : ''}</div>` +
      `<div style="color:var(--text-mute);font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px">Top ${top.length || 0} most active</div>` +
      (top.length
        ? top.map((m, i) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:2px 0"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i + 1}. ${escapeHtml(m.name)}</span><span style="font-family:monospace;color:var(--text-dim);flex-shrink:0">${m.attended}</span></div>`).join('')
        : '<div style="color:var(--text-mute)">No enrolled members yet</div>');
    pop.style.display = 'block';
    const r = block.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = r.right + 8, top2 = r.top;
    if (left + pw > window.innerWidth - 8) left = Math.max(8, r.left - pw - 8);
    if (top2 + ph > window.innerHeight - 8) top2 = Math.max(8, window.innerHeight - ph - 8);
    pop.style.left = left + 'px';
    pop.style.top = top2 + 'px';
  }
  function hideSchHover() {
    const p = document.getElementById('sch-hover-pop');
    if (p) p.style.display = 'none';
  }

  function refresh() {
    // Build the grid
    let grid = '';
    // Header row
    grid += `<div class="sch-row sch-header">
      <div class="sch-time-h">TIME</div>
      ${DAYS.map(d => `<div class="sch-day-h">${d.label}</div>`).join('')}
    </div>`;

    // Time-slot rows
    for (const slot of SLOTS) {
      grid += `<div class="sch-row">`;
      grid += `<div class="sch-time-cell">${slot.label}</div>`;
      for (const day of DAYS) {
        const cls = classesAt(day.key, slot.hour);
        const dropZone = `data-day="${day.key}" data-slot="${slot.hour}"`;
        const items = cls.map(c => {
          const dimmed = !isFiltered(c);
          const coach = state.coaches.find(x => x.id === c.coachId);
          const warn = (coach && !isCoachActive(coach))
            ? `<span title="${escapeHtml(coach.name)} is now inactive — reassign or remove this class" style="flex-shrink:0">⚠️</span>` : '';
          return `<div class="sch-class" data-id="${c.id}" data-sport="${escapeHtml(c.sport)}" data-coachid="${c.coachId != null ? c.coachId : ''}" style="background:${sportColor(c.sport)};color:white;padding:6px 8px;border-radius:6px;font-size:11px;font-weight:600;margin:2px 0;display:flex;align-items:center;justify-content:space-between;gap:4px;cursor:pointer;opacity:${dimmed ? '0.18' : '1'};transition:opacity .15s;${coach && !isCoachActive(coach) ? 'outline:2px solid #facc15;outline-offset:-2px' : ''}">
            <div style="flex:1;min-width:0;overflow:hidden">
              <div style="display:flex;align-items:center;gap:4px"><span>${sportEmoji(c.sport)}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.sport)}</span></div>
              <div style="font-size:9px;font-weight:500;opacity:.95;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(coach ? coach.name : 'No coach')}${coach && !isCoachActive(coach) ? ' · inactive' : ''}</div>
            </div>
            ${warn}
            <button class="sch-del" data-id="${c.id}" title="Remove" style="background:rgba(0,0,0,.25);border:none;color:white;width:18px;height:18px;border-radius:50%;cursor:pointer;font-size:11px;flex-shrink:0;padding:0;display:flex;align-items:center;justify-content:center">×</button>
          </div>`;
        }).join('');
        grid += `<div class="sch-cell" ${dropZone}>${items}</div>`;
      }
      grid += `</div>`;
    }

    $('#sch-grid').innerHTML = grid;

    // Wire drag-and-drop on cells
    $$('.sch-cell').forEach(cell => {
      cell.addEventListener('dragover', e => {
        e.preventDefault();
        cell.classList.add('drag-over');
      });
      cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
      cell.addEventListener('drop', e => {
        e.preventDefault();
        cell.classList.remove('drag-over');
        const sport = e.dataTransfer.getData('sport');
        const moveId = e.dataTransfer.getData('moveId');
        const day = cell.dataset.day;
        const slot = parseInt(cell.dataset.slot);
        if (moveId) {
          // Moving an existing class to a new cell
          const c = state.schedule.find(x => x.id === parseInt(moveId));
          if (c) { c.day = day; c.slot = slot; }
        } else if (sport) {
          // Adding a new class — ask which coach to assign
          pickCoachAndAdd(sport, day, slot);
          return;   // wait for modal to close before refreshing
        }
        save(); refresh();
      });
    });

    // Wire delete buttons
    $$('.sch-del').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        const cls = state.schedule.find(c => c.id === id);
        if (!confirm(`Remove this class${cls && cls.sport ? ' (' + cls.sport + ')' : ''} from the schedule?`)) return;
        state.schedule = state.schedule.filter(c => c.id !== id);
        save(); refresh();
      });
    });

    // Make existing class blocks draggable (move them between cells)
    $$('.sch-class').forEach(block => {
      block.setAttribute('draggable', 'true');
      block.addEventListener('dragstart', e => {
        e.dataTransfer.setData('moveId', block.dataset.id);
        block.classList.add('dragging');
      });
      block.addEventListener('dragend', () => block.classList.remove('dragging'));
      block.addEventListener('mouseenter', () => showSchHover(block));
      block.addEventListener('mouseleave', hideSchHover);
      // Click on the body (not the × button) → change coach
      block.addEventListener('click', e => {
        if (e.target.classList.contains('sch-del')) return;
        const id = parseInt(block.dataset.id);
        const c = state.schedule.find(x => x.id === id);
        if (c) pickCoachAndAdd(c.sport, c.day, c.slot, c);
      });
    });

    // Stats
    const total = (state.schedule || []).length;
    const matching = (state.schedule || []).filter(isFiltered).length;
    $('#sch-count').textContent = filter.coachId !== 'all' || filter.sport !== 'all'
      ? `${matching} of ${total} classes match the filter`
      : `${total} classes scheduled · drag a sport tile onto a cell to add`;
  }

  // Modal: pick a coach for a sport (or edit existing class)
  function pickCoachAndAdd(sport, day, slot, existing) {
    const slotLabel = (SLOTS.find(s => s.hour === slot) || {}).label || `${slot}:00`;
    const dayLabel = (DAYS.find(d => d.key === day) || {}).label || day;
    const eligible = coachesForSport(sport, existing && existing.coachId);
    const opts = eligible.map(c =>
      `<option value="${c.id}" ${existing && existing.coachId === c.id ? 'selected' : ''}>${coachOptionLabel(c, sport)}</option>`
    ).join('');
    const noneNote = eligible.length ? '' : `<div class="text-mute" style="font-size:11px;margin-top:6px">No active coach teaches ${escapeHtml(sport)}. Add the sport to a coach in the Team page, or activate a coach.</div>`;
    showModal({
      title: existing ? `Edit Class — ${escapeHtml(sport)}` : `Add Class — ${escapeHtml(sport)}`,
      body: `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;padding:10px;background:${sportColor(sport)};border-radius:8px;color:white">
          <div style="font-size:30px">${sportEmoji(sport)}</div>
          <div>
            <div style="font-weight:700;font-size:16px">${escapeHtml(sport)}</div>
            <div style="font-size:12px;opacity:.9">${dayLabel} · ${slotLabel}</div>
          </div>
        </div>
        <div class="field">
          <label>Coach</label>
          <select id="sch-coach" style="width:100%">${opts}</select>
          ${noneNote}
        </div>
      `,
      actions: [
        ...(existing ? [{ label: 'Remove class', class: 'btn ghost', onclick: () => {
          if (!confirm('Remove this class from the schedule?')) return;
          state.schedule = state.schedule.filter(c => c.id !== existing.id);
          save(); closeModal(); refresh();
          toast('Class removed');
        } }] : []),
        { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
        { label: existing ? 'Save' : 'Add Class', class: 'btn primary', onclick: () => {
          const coachId = parseInt($('#sch-coach').value);
          // A coach can't teach two classes in the same time slot on the same day.
          const clash = (state.schedule || []).find(c =>
            c.day === day && c.slot === slot && c.coachId === coachId &&
            (!existing || c.id !== existing.id));
          if (coachId && clash) {
            toast(`${coachName(coachId)} already has ${clash.sport} in this slot — one class per coach per time slot.`, 'error');
            return;
          }
          if (existing) {
            existing.coachId = coachId;
          } else {
            state.schedule.push({
              id: nextId(state.schedule || []),
              day, slot, sport, coachId,
            });
          }
          save(); closeModal(); refresh();
          toast(existing ? 'Class updated' : 'Class added');
        }},
      ],
    });
  }

  // ─── PNG Export ────────────────────────────────────────────────────
  // Builds a self-contained HTML snapshot and uses html2canvas-style technique
  // via a hidden iframe + canvas. Since we can't load external libs, we use
  // a pure-JS approach: serialize to SVG → render to canvas → toBlob → download.
  function exportPng(lang) {
    const ar = lang === 'ar';
    // Render the schedule into an SVG-style canvas drawing
    const cellW = 180, cellH = 90, timeW = 110, headerH = 60, brandH = 100;
    const BLOCK_H = 40, GAP = 4;
    const cols = DAYS.length + 1;
    const rows = SLOTS.length;
    const W = timeW + DAYS.length * cellW;
    // Variable row heights: a slot with more stacked classes gets a taller row
    // so 2- and 3-class cells stay readable instead of being crammed together.
    const rowHeights = SLOTS.map(slot => {
      let maxN = 0;
      DAYS.forEach(day => { maxN = Math.max(maxN, classesAt(day.key, slot.hour).filter(isFiltered).length); });
      return Math.max(cellH, maxN * BLOCK_H + (maxN + 1) * GAP);
    });
    const bodyH = rowHeights.reduce((a, b) => a + b, 0);
    const H = brandH + headerH + bodyH + 40;

    // RTL coordinate helpers: in Arabic the TIME column sits on the right and the
    // days fill leftward (Saturday rightmost → Thursday leftmost).
    const timeX = ar ? (W - timeW) : 0;
    const dayX = (i) => ar ? (W - timeW - (i + 1) * cellW) : (timeW + i * cellW);

    const canvas = document.createElement('canvas');
    canvas.width = W * 2;   // 2x for retina-quality
    canvas.height = H * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    try { ctx.direction = ar ? 'rtl' : 'ltr'; } catch (e) {}

    // Brand header
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, W, brandH);
    const monthName = ar ? monthNameAR(new Date()) : new Date().toLocaleString('en', { month: 'long', year: 'numeric' }).toUpperCase();
    if (ar) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f26060';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('★ بلاك ستارز', W - 24, 50);
      ctx.fillStyle = '#9ba6b6';
      ctx.font = '15px sans-serif';
      ctx.fillText('نادٍ رياضي · جدول الحصص', W - 24, 78);
      ctx.fillStyle = '#5b8def';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(monthName, 24, 60);
    } else {
      ctx.fillStyle = '#f26060';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('★ BLACK STARS', 24, 50);
      ctx.fillStyle = '#9ba6b6';
      ctx.font = '14px sans-serif';
      ctx.fillText('Sports Club · Class Schedule', 24, 75);
      ctx.fillStyle = '#5b8def';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(monthName, W - 24, 60);
    }
    ctx.textAlign = 'left';

    // Column headers
    const headerY = brandH;
    ctx.fillStyle = '#1a2030';
    ctx.fillRect(0, headerY, W, headerH);
    ctx.fillStyle = '#e8eaf0';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ar ? 'الوقت' : 'TIME', timeX + timeW / 2, headerY + 38);
    DAYS.forEach((d, i) => {
      const x = dayX(i) + cellW / 2;
      ctx.fillText(ar ? dayNameAR(d.key) : d.label, x, headerY + 38);
    });
    ctx.textAlign = 'left';

    // Body rows (variable height per row)
    let y = headerY + headerH;
    SLOTS.forEach((slot, rowIdx) => {
      const rowH = rowHeights[rowIdx];
      // Time cell
      ctx.fillStyle = '#131826';
      ctx.fillRect(timeX, y, timeW, rowH);
      ctx.fillStyle = '#e8eaf0';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ar ? timeLabelAR(slot.label) : slot.label, timeX + timeW / 2, y + rowH / 2 + 4);

      // Day cells
      DAYS.forEach((day, colIdx) => {
        const x = dayX(colIdx);
        const cls = classesAt(day.key, slot.hour).filter(isFiltered);
        // Cell background
        ctx.fillStyle = colIdx % 2 === 0 ? '#0e131f' : '#0a0e1a';
        ctx.fillRect(x, y, cellW, rowH);
        // Cell border
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#252b3d';
        ctx.strokeRect(x, y, cellW, rowH);

        if (cls.length) {
          const n = cls.length;
          const single = n === 1;
          const blockH = (rowH - (n + 1) * GAP) / n;
          cls.forEach((c, ci) => {
            const by = y + GAP + ci * (blockH + GAP);
            const bx = x + 6, bw = cellW - 12;
            // Colored block
            ctx.fillStyle = sportColor(c.sport);
            ctx.fillRect(bx, by, bw, blockH);
            // Dark outline so two same-coloured sports don't blend into one
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(0,0,0,0.40)';
            ctx.strokeRect(bx, by, bw, blockH);
            // Labels
            const cx = x + cellW / 2, cy = by + blockH / 2;
            const coach = state.coaches.find(co => co.id === c.coachId);
            const sportTxt = ar ? sportNameAR(c.sport) : c.sport.toUpperCase();
            const txt = `${sportEmoji(c.sport)} ${sportTxt}`;
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.font = `bold ${single ? 15 : 12}px sans-serif`;
            ctx.fillText(txt, cx, cy + (coach ? (single ? -2 : -4) : 4));
            if (coach) {
              ctx.font = `${single ? 12 : 9}px sans-serif`;
              ctx.fillStyle = 'rgba(255,255,255,0.92)';
              const cn = (ar && coach.nameArabic) ? coach.nameArabic : coach.name;
              ctx.fillText(cn, cx, cy + (single ? 18 : 9));
            }
          });
        }
      });
      y += rowH;
    });

    // Footer
    ctx.fillStyle = '#5a627a';
    ctx.font = '11px sans-serif';
    if (ar) {
      ctx.textAlign = 'right';
      ctx.fillText('تم الإنشاء ' + new Date().toLocaleDateString('ar-EG'), W - 24, H - 16);
      ctx.textAlign = 'left';
      ctx.fillText('الوعب · فيلِج ريزورت · الدوحة · قطر', 24, H - 16);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText('Generated ' + new Date().toLocaleDateString(), 24, H - 16);
      ctx.textAlign = 'right';
      ctx.fillText('Waab · Village Resort · Doha · Qatar', W - 24, H - 16);
    }

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fname = `BlackStars-Schedule-${ar ? 'AR-' : ''}${monthName.replace(/\s/g,'-')}.png`;
      a.download = fname;
      a.click();
      URL.revokeObjectURL(url);
      toast(ar ? '📸 تم حفظ الجدول (عربي)' : '📸 Schedule PNG saved');
    });
  }

  // ─── Render the page ───────────────────────────────────────────────
  // Sports offered in the schedule come from the ENABLED sports in Settings, so
  // newly-added sports show up and disabled sports can't be booked. Summer Camp
  // has its own page, so it's excluded here. Falls back to the themed list.
  const scheduleSports = (state.settings && Array.isArray(state.settings.sports) && state.settings.sports.length)
    ? state.settings.sports.filter(s => s.enabled !== false && s.name !== SUMMER_CAMP)
        .slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(s => s.name)
    : Object.keys(SPORT_THEME);
  const coachOpts = state.coaches.map(c => `<option value="${c.id}">${escapeHtml(c.name)}${isCoachActive(c) ? '' : ' (inactive)'}</option>`).join('');
  const sportOpts = scheduleSports.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  // Sport palette (draggable tiles) — static, built once per page render
  const sportTiles = scheduleSports.map(sport => `
    <div class="sport-tile" draggable="true" data-sport="${escapeHtml(sport)}"
         style="background:${sportColor(sport)};color:white;padding:8px 14px;border-radius:8px;font-weight:700;font-size:12px;cursor:grab;user-select:none;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 6px rgba(0,0,0,.15)">
      <span style="font-size:16px">${sportEmoji(sport)}</span> ${escapeHtml(sport)}
    </div>
  `).join('');

  main.innerHTML = `
    <style>
      .sch-row { display: grid; grid-template-columns: 110px repeat(${DAYS.length}, 1fr); }
      .sch-time-h, .sch-day-h, .sch-time-cell {
        background: var(--surface-2);
        color: var(--text);
        padding: 12px 10px;
        font-weight: 700;
        font-size: 12px;
        text-align: center;
        border: 1px solid var(--border);
      }
      .sch-time-cell {
        background: var(--surface);
        color: var(--text);
        font-size: 11px;
        display: flex; align-items: center; justify-content: center;
      }
      .sch-day-h { background: linear-gradient(180deg, var(--surface-2), var(--surface)); }
      .sch-cell {
        background: var(--surface);
        border: 1px solid var(--border);
        min-height: 78px;
        padding: 4px;
        transition: background .12s, border-color .12s;
      }
      .sch-cell.drag-over {
        background: rgba(91,141,239,.15);
        border-color: var(--blue);
      }
      .sport-tile { transition: transform .12s, box-shadow .12s; }
      .sport-tile:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,.25); }
      .sport-tile.dragging { opacity: .5; }
      .sch-class.dragging { opacity: .4; }
      .sch-class:hover .sch-del { background: rgba(255,255,255,.3); }
      .sch-del:hover { background: rgba(255,255,255,.5) !important; }
    </style>

    <div class="topbar">
      <div>
        <h1>🗓 Class Schedule</h1>
        <div class="subtitle"><span id="sch-count"></span></div>
      </div>
      <div class="topbar-actions">
        <button class="btn ghost" id="sch-clear" title="Remove all scheduled classes">🗑 Clear all</button>
        <button class="btn primary" id="sch-png">📸 Export PNG</button>
        <button class="btn ghost" id="sch-png-ar" title="تصدير الجدول بالعربية">📸 PNG (عربي)</button>
      </div>
    </div>

    <div class="card" style="padding:14px;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">
        <div style="font-size:11px;color:var(--text-mute);text-transform:uppercase;letter-spacing:.6px;font-weight:700">Sports — drag onto the grid</div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${sportTiles}</div>
    </div>

    <div class="card" style="padding:14px;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="font-size:11px;color:var(--text-mute);text-transform:uppercase;letter-spacing:.6px;font-weight:700">Filters</div>
        <select id="sch-filter-coach" class="btn ghost">
          <option value="all">All coaches</option>
          ${coachOpts}
        </select>
        <select id="sch-filter-sport" class="btn ghost">
          <option value="all">All sports</option>
          ${sportOpts}
        </select>
        <div style="font-size:11px;color:var(--text-mute);margin-left:auto">Filters dim non-matching classes; export honors the filter</div>
      </div>
    </div>

    <div id="sch-grid" style="background:var(--surface);border-radius:10px;overflow:hidden"></div>

    <div style="margin-top:12px;padding:10px 14px;background:rgba(91,141,239,.08);border:1px solid rgba(91,141,239,.25);border-radius:8px;font-size:12px;color:var(--text-dim)">
      💡 <strong style="color:var(--blue)">How to use:</strong> Drag a sport tile from the top onto any cell to add a class (you'll pick the coach). Click an existing class to change the coach. Drag a class between cells to move it. The × button removes a class. Friday is the off day so it's not shown.
    </div>
  `;

  refresh();

  // Wire sport tile drag (once — they don't change between refreshes)
  $$('.sport-tile').forEach(tile => {
    tile.addEventListener('dragstart', e => {
      e.dataTransfer.setData('sport', tile.dataset.sport);
      tile.classList.add('dragging');
    });
    tile.addEventListener('dragend', () => tile.classList.remove('dragging'));
  });

  // Filter wiring
  $('#sch-filter-coach').addEventListener('change', e => { filter.coachId = e.target.value; refresh(); });
  $('#sch-filter-sport').addEventListener('change', e => { filter.sport = e.target.value; refresh(); });

  // Export PNG
  $('#sch-png').addEventListener('click', () => exportPng('en'));
  const pngAr = $('#sch-png-ar'); if (pngAr) pngAr.addEventListener('click', () => exportPng('ar'));

  // Clear all
  $('#sch-clear').addEventListener('click', () => {
    if (!(state.schedule || []).length) { toast('Schedule is already empty'); return; }
    showModal({
      title: '🗑 Clear all classes?',
      body: `<p>This will remove all <b>${state.schedule.length}</b> scheduled classes. This action cannot be undone.</p>`,
      actions: [
        { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
        { label: 'Yes, clear all', class: 'btn danger', onclick: () => {
          state.schedule = [];
          save(); closeModal(); refresh();
          toast('Schedule cleared');
        }},
      ],
    });
  });
};

PAGES.coaches = (main) => {
  // Revenue/commission come from actual invoices linked to each coach (real cash).
  // Students + attendance come from member subscriptions.
  // Per-coach commission % is configured in Settings → Coach Commission Rates.
  function coachStats(coachId, month) {
    let studentSet = new Set();
    let classesAttended = 0;
    let classesTotal = 0;
    const monthKey = month ? (month.length === 7 ? month : null) : null;
    for (const m of state.members) {
      for (const s of (m.subscriptions || [])) {
        if (s.coachId !== coachId) continue;
        if (month && s.month !== month) continue;
        studentSet.add(m.id);
        const daily = monthKey ? attendanceFor(m, monthKey, s.activity || m.sport) : null;
        if (daily && Object.keys(daily).length) {
          const yCount = Object.values(daily).filter(v => v === 'Y').length;
          const nCount = Object.values(daily).filter(v => v === 'N').length;
          classesAttended += yCount;
          classesTotal += (yCount + nCount) || (s.totalClasses || 0);
        } else {
          classesAttended += s.attendedClasses || 0;
          classesTotal += s.totalClasses || 0;
        }
      }
    }
    // Revenue split: all invoices for transparency, but commission is only
    // computed on invoices linked to currently-Active members (per user rule).
    // Invoices without a member link (e.g. court rentals) still count as
    // revenue but never contribute to commission.
    let invoiceRevenue = 0;
    let activeMemberRevenue = 0;
    for (const inv of state.invoices) {
      if (inv.coachId !== coachId) continue;
      if (monthKey && inv.month !== monthKey) continue;
      const amount = inv.amount || 0;
      invoiceRevenue += amount;
      if (inv.customerId) {
        const mem = state.members.find(x => x.id === inv.customerId);
        if (mem && isActiveStatus(mem)) activeMemberRevenue += amount;
      }
    }
    return {
      students: studentSet.size,
      revenue: invoiceRevenue,             // total revenue from this coach (display)
      commissionBase: activeMemberRevenue, // commission is calculated on this
      completedRevenue: invoiceRevenue,
      subscriptionValue: invoiceRevenue,
      classesAttended,
      classesTotal,
      attRate: classesTotal ? (classesAttended / classesTotal * 100) : 0,
    };
  }

  // Compute stats for previous + current month dynamically (was hardcoded
  // 'apr'/'may'). Uses currentMonth() helper and previous-month math.
  const currentM = currentMonth();          // e.g. '2026-06'
  const [cy, cm] = currentM.split('-').map(Number);
  const prevDate = new Date(cy, cm - 2, 1); // cm is 1-indexed; -2 = previous month
  const prevM = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`;
  const aprStats = {};
  const mayStats = {};
  for (const c of state.coaches) {
    aprStats[c.id] = coachStats(c.id, prevM);
    mayStats[c.id] = coachStats(c.id, currentM);
  }

  let filter = { active: 'all', search: '', role: 'coach' };

  function visibleCoaches() {
    return state.coaches.filter(c => {
      const isActive = (c.active || 'Y') === 'Y';
      if (filter.active === 'active' && !isActive) return false;
      if (filter.active === 'inactive' && isActive) return false;
      if (filter.role && filter.role !== 'all' && (c.role || 'coach') !== filter.role) return false;
      if (filter.search && !c.name.toLowerCase().includes(filter.search.toLowerCase())) return false;
      return true;
    });
  }

  function refresh() {
    const coaches = visibleCoaches();
    const activeCount = state.coaches.filter(c => (c.active || 'Y') === 'Y').length;
    const inactiveCount = state.coaches.length - activeCount;

    // Table body
    $('#coach-tbody').innerHTML = coaches.length ? coaches.map(c => {
      const apr = aprStats[c.id];
      const may = mayStats[c.id];
      const aprComm = (apr.commissionBase ?? apr.revenue) * (c.rate / 100);
      const mayComm = (may.commissionBase ?? may.revenue) * (c.rate / 100);
      const trendStudents = may.students - apr.students;
      const trendRevenue = may.revenue - apr.revenue;
      const isActive = (c.active || 'Y') === 'Y';
      return `
        <tr style="${isActive ? '' : 'opacity:.55'}">
          <td>
            <div style="display:flex;align-items:center;gap:10px;cursor:pointer" onclick="viewCoach(${c.id})" title="View coach profile">
              <div class="avatar" style="width:32px;height:32px;font-size:11px;background:linear-gradient(135deg,var(--blue),var(--purple))">${initials(c.name)}</div>
              <div>
                <div class="font-bold" style="color:var(--blue)">${escapeHtml(c.name)}</div>
                <div class="text-mute" style="font-size:10px">${(c.sports || []).join(' · ')}</div>
              </div>
            </div>
          </td>
          <td>
            <button class="btn ghost sm" onclick="toggleCoachActive(${c.id})" title="Click to toggle"
              style="font-weight:700;color:${isActive ? 'var(--green)' : 'var(--red)'};border:1px solid ${isActive ? 'var(--green)' : 'var(--red)'}">
              ${isActive ? 'Y · Active' : 'N · Inactive'}
            </button>
          </td>
          <td><span class="badge blue">${c.rate}%</span></td>
          <td class="text-right num">${apr.students}</td>
          <td class="text-right num">
            ${may.students}
            ${trendStudents !== 0 ? `<span style="color:${trendStudents>0?'var(--green)':'var(--red)'};font-size:10px;margin-left:4px">${trendStudents>0?'↑':'↓'}${Math.abs(trendStudents)}</span>` : ''}
          </td>
          <td class="text-right num text-dim">${fmt(apr.revenue)}</td>
          <td class="text-right num">
            ${fmt(may.revenue)}
            ${trendRevenue !== 0 ? `<span style="color:${trendRevenue>0?'var(--green)':'var(--red)'};font-size:10px;margin-left:4px">${trendRevenue>0?'+':''}${fmt(trendRevenue)}</span>` : ''}
          </td>
          <td class="text-right num text-dim" title="Active-member revenue: ${fmt(apr.commissionBase ?? apr.revenue)} × ${c.rate}%">${fmt(aprComm)}</td>
          <td class="text-right num font-bold" title="Active-member revenue: ${fmt(may.commissionBase ?? may.revenue)} × ${c.rate}%">
            ${fmt(mayComm)}
            ${(may.commissionBase ?? may.revenue) < may.revenue ? `<div style="font-size:9px;color:var(--text-mute);font-weight:400">base ${fmt(may.commissionBase ?? may.revenue)}</div>` : ''}
          </td>
          <td class="text-right num" style="color:${may.attRate >= 75 ? 'var(--green)' : may.attRate >= 40 ? 'var(--accent-2)' : 'var(--red)'}">
            ${may.classesTotal ? Math.round(may.attRate) + '%' : '—'}
          </td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="10" class="empty">No coaches match this filter</td></tr>`;

    // Footer totals (only over visible coaches)
    $('#coach-tfoot').innerHTML = `
      <tr style="font-weight:700;background:var(--surface-2)">
        <td colspan="3">Total (${coaches.length} shown)</td>
        <td class="text-right num">${coaches.reduce((s,c) => s + aprStats[c.id].students, 0)}</td>
        <td class="text-right num">${coaches.reduce((s,c) => s + mayStats[c.id].students, 0)}</td>
        <td class="text-right num">${fmt(coaches.reduce((s,c) => s + aprStats[c.id].revenue, 0))}</td>
        <td class="text-right num">${fmt(coaches.reduce((s,c) => s + mayStats[c.id].revenue, 0))}</td>
        <td class="text-right num">${fmt(coaches.reduce((s,c) => s + (aprStats[c.id].commissionBase ?? aprStats[c.id].revenue) * c.rate / 100, 0))}</td>
        <td class="text-right num">${fmt(coaches.reduce((s,c) => s + (mayStats[c.id].commissionBase ?? mayStats[c.id].revenue) * c.rate / 100, 0))}</td>
        <td></td>
      </tr>
    `;

    $('#coach-subtitle').textContent = `${state.coaches.length} coaches · ${activeCount} active · ${inactiveCount} inactive`;

    // Quick cards
    $('#coach-cards').innerHTML = coaches.map(c => {
      const may = mayStats[c.id];
      const comm = (may.commissionBase ?? may.revenue) * (c.rate / 100);
      const isActive = (c.active || 'Y') === 'Y';
      return `
        <div class="kpi" onclick="viewCoach(${c.id})" style="cursor:pointer;${isActive ? '' : 'opacity:.55'}" title="View coach profile">
          <div class="kpi-icon">🥋</div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <div class="avatar" style="width:36px;height:36px;font-size:13px">${initials(c.name)}</div>
            <div style="flex:1">
              <div style="font-weight:700;font-size:14px">${escapeHtml(c.name)}</div>
              <div class="text-mute" style="font-size:11px">${c.rate}% · ${(c.sports || [])[0] || '—'}</div>
            </div>
            <span class="badge ${isActive ? 'active' : 'expired'}" style="font-size:9px">${isActive ? 'Active' : 'Inactive'}</span>
          </div>
          <div class="row row-2" style="gap:8px">
            <div><div class="text-mute" style="font-size:10px;text-transform:uppercase">Students</div><div class="font-bold num">${may.students}</div></div>
            <div><div class="text-mute" style="font-size:10px;text-transform:uppercase">May Pay</div><div class="font-bold num">${fmt(comm)}</div></div>
          </div>
          <div class="text-mute mt-2" style="font-size:10px">Att: ${may.classesAttended}/${may.classesTotal} (${may.classesTotal ? Math.round(may.attRate) : 0}%)</div>
        </div>
      `;
    }).join('');
  }

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Team</h1>
        <div class="subtitle"><span id="coach-subtitle"></span></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn ghost" onclick="editCoach(null, 'staff')" title="For admin, reception, cleaner, etc. — fixed monthly salary, no commission">+ Add Staff</button>
        <button class="btn primary" onclick="editCoach(null, 'coach')" title="For coaches who teach classes — commission-based">+ Add Coach</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div><div class="card-title">Coach Performance — ${fmtMonth(currentMonth())}</div><div class="card-subtitle">Real data from attendance sheets · commission is calculated on active-member revenue only · Staff (admin/cleaner) are not listed here, see Salaries page</div></div>
      </div>
      <div class="filter-bar">
        <div class="search"><input id="coach-search" type="text" placeholder="Search by name..." /></div>
        <select id="coach-role-filter" class="btn ghost">
          <option value="coach">🥋 Coaches</option>
          <option value="staff">👔 Staff</option>
          <option value="all">All (coaches + staff)</option>
        </select>
        <select id="coach-active-filter" class="btn ghost">
          <option value="all">All statuses</option>
          <option value="active">Active only (Y)</option>
          <option value="inactive">Inactive only (N)</option>
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Coach</th>
              <th>Active</th>
              <th>Rate</th>
              <th class="text-right">${fmtMonth(prevM).split(' ')[0]} Students</th>
              <th class="text-right">${fmtMonth(currentM).split(' ')[0]} Students</th>
              <th class="text-right">${fmtMonth(prevM).split(' ')[0]} Revenue</th>
              <th class="text-right">${fmtMonth(currentM).split(' ')[0]} Revenue</th>
              <th class="text-right">${fmtMonth(prevM).split(' ')[0]} Commission</th>
              <th class="text-right">${fmtMonth(currentM).split(' ')[0]} Commission</th>
              <th class="text-right">Att Rate (${fmtMonth(currentM).split(' ')[0]})</th>
            </tr>
          </thead>
          <tbody id="coach-tbody"></tbody>
          <tfoot id="coach-tfoot"></tfoot>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div><div class="card-title">Quick Cards</div></div></div>
      <div class="kpi-grid" id="coach-cards"></div>
    </div>
  `;

  $('#coach-search').addEventListener('input', e => { filter.search = e.target.value; refresh(); });
  $('#coach-active-filter').addEventListener('change', e => { filter.active = e.target.value; refresh(); });
  $('#coach-role-filter').addEventListener('change', e => { filter.role = e.target.value; refresh(); });
  refresh();
};

// Toggle a coach's active flag (Y <-> N)
window.toggleCoachActive = function(coachId) {
  const c = state.coaches.find(x => x.id === coachId);
  if (!c) return;
  c.active = (c.active || 'Y') === 'Y' ? 'N' : 'Y';
  save();
  render();
  toast(`${c.name} marked ${c.active === 'Y' ? 'Active' : 'Inactive'}`);
};

// ─── INVOICES ──────────────────────────────────────────────────
PAGES.invoices = (main) => {
  let filter = { search: '', month: 'all', method: 'all', sport: 'all', coach: 'all', category: 'all' };
  const pg = makePager(10);
  const selected = new Set();   // invoice ids ticked for merging

  function applyFilter() {
    return state.invoices.filter(i => {
      if (filter.search) {
        const q = filter.search.toLowerCase();
        const cust = customerInfo(i);   // live name + phone if linked
        const hay = [i.description, cust.name, cust.nameArabic, cust.phone, cust.phone2, cust.qid, i.coach, i.sport, i.ref, i.category]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter.month !== 'all' && i.month !== filter.month) return false;
      if (filter.method !== 'all' && i.method !== filter.method) return false;
      if (filter.sport !== 'all' && i.sport !== filter.sport) return false;
      if (filter.coach !== 'all' && i.coach !== filter.coach) return false;
      if (filter.category !== 'all' && (i.category || 'Membership') !== filter.category) return false;
      return true;
    });
  }

  function refresh() {
    const allRows = applyFilter().sort((a,b) => b.date.localeCompare(a.date));
    const total = allRows.reduce((s,r) => s+r.amount, 0);
    const rows = paginate(allRows, pg);
    $('#inv-tbody').innerHTML = rows.length ? rows.map(i => {
      // Customer cell — always use LIVE member info if linked. Deleted members
      // show as struck-through; walk-ins fall back to snapshot.
      const cust = customerInfo(i);
      const custCell = cust.name ? `
        <div style="display:flex;align-items:center;gap:8px">
          <div class="avatar" style="width:24px;height:24px;font-size:10px;background:linear-gradient(135deg,var(--blue),var(--purple))">${initials(cust.name)}</div>
          <div>
            <div class="font-bold" style="${cust.isDeleted ? 'text-decoration:line-through;color:var(--text-mute)' : ''}">${escapeHtml(cust.name)}</div>
            ${cust.phone ? `<div class="text-mute" style="font-size:10px">${phoneCell(cust.phone)}</div>` : ''}
          </div>
        </div>` : `<span class="text-mute">${escapeHtml((i.description || '').split(/\s/).slice(0, 2).join(' '))}</span>`;
      // Service cell — description with sport badge
      const sportBadgeColor = {
        'MMA':'',
        'Boxing':'',
        'Kick Boxing':'',
        'Karate':'',
        'Taekwondo':'',
        'Gymnastic':'blue',
        'Football':'',
        'Swimming':'cyan',
        'Zumba':'purple',
        'Merchandise':'pending',
        'Court Rental':'pending',
      }[i.sport] || '';
      const sportLabel = i.sport === 'Court Rental' ? '🏟 Court Rental' : i.sport;
      return `
      <tr>
        <td style="text-align:center" onclick="event.stopPropagation()"><input type="checkbox" class="inv-cb" value="${i.id}" data-cust="${i.customerId || ''}" ${selected.has(i.id) ? 'checked' : ''} style="cursor:pointer"></td>
        <td class="font-mono" style="font-size:11px">${i.ref || `#${i.id}`}</td>
        <td class="text-dim" style="white-space:nowrap">${fmtDate(i.date)}</td>
        <td>${custCell}</td>
        <td>${i.category ? `<span class="badge ${i.category==='Court Rental'||i.category==='Boxing Room'?'pending':i.category==='Product'?'purple':'green'}" style="font-size:10px">${escapeHtml(i.category)}</span>` : '<span class="text-mute">—</span>'}</td>
        <td>${i.sport ? `<span class="badge ${sportBadgeColor}">${escapeHtml(sportLabel)}</span>` : '<span class="text-mute">—</span>'}</td>
        <td>${i.coach ? `<span class="text-dim">${escapeHtml(i.coach)}</span>` : '<span class="text-mute">—</span>'}</td>
        <td class="text-mute" style="font-size:11px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(i.description)}</td>
        <td><span class="badge ${i.method === 'card' ? 'blue' : ''}">${i.method}</span></td>
        <td class="text-right num font-bold">${fmt(i.amount)}${(() => {
          const st = invoiceStatus(i);
          if (st === 'Paid') return '';
          return `<div style="font-size:10px;font-weight:700;color:${st === 'Unpaid' ? 'var(--red)' : 'var(--accent-2)'};margin-top:2px">${st} · ${fmt(invoiceBalance(i))} due</div>`;
        })()}</td>
        <td class="text-right" style="white-space:nowrap">
          ${invoiceStatus(i) !== 'Paid' ? `<button class="btn ghost sm" onclick="recordPaymentUI(${i.id})" title="Record a payment toward the balance" style="color:var(--green)">💵 Pay</button>` : ''}
          ${i.customerId ? `<button class="btn ghost sm" onclick="showInvoiceHistory(${i.customerId})" title="See all invoices for this customer">📜</button>` : ''}
          <button class="btn ghost sm" onclick="printInvoicePDF(${i.id})" title="Export invoice as PDF (filename = customer name)">⬇ Export</button>
          <button class="btn ghost sm" onclick="sendInvoiceWhatsApp(${i.id})" title="Send invoice as WhatsApp message" style="color:#25D366">💬</button>
          <button class="btn ghost sm" onclick="editInvoiceQuick(${i.id})" title="Edit coach/sport">✏️</button>
          <button class="btn ghost sm" onclick="deleteInvoice(${i.id})" title="Delete">🗑</button>
        </td>
      </tr>`;
    }).join('') : `<tr><td colspan="11" class="empty"><div class="empty-icon">📄</div>No invoices match</td></tr>`;
    $('#inv-count').textContent = `${allRows.length} invoices · ${fmtMoney(total)}`;
    $('#inv-pagination').innerHTML = paginationBar(pg, allRows.length, 'inv');
    bindPagination('inv', pg, allRows.length, refresh);

    // ── Merge selection wiring (tbody rebuilt each refresh) ──
    const updateMergeBar = () => {
      const cnt = $('#inv-merge-count');
      if (cnt) cnt.textContent = String(selected.size);
      const bar = $('#inv-mergebar');
      if (bar) bar.style.display = selected.size ? 'flex' : 'none';
      const pageIds = rows.map(r => r.id);
      const sa = $('#inv-select-all');
      if (sa) {
        const onPage = pageIds.filter(id => selected.has(id)).length;
        sa.checked = pageIds.length > 0 && onPage === pageIds.length;
        sa.indeterminate = onPage > 0 && onPage < pageIds.length;
      }
    };
    $$('#inv-tbody .inv-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = parseInt(cb.value);
        if (cb.checked) selected.add(id); else selected.delete(id);
        updateMergeBar();
      });
    });
    const selAll = $('#inv-select-all');
    if (selAll) {
      selAll.onchange = () => {
        rows.forEach(r => { if (selAll.checked) selected.add(r.id); else selected.delete(r.id); });
        $$('#inv-tbody .inv-cb').forEach(cb => { cb.checked = selAll.checked; });
        updateMergeBar();
      };
    }
    updateMergeBar();
  }

  // Build unique sport + coach options from data
  const sportsInInvoices = [...new Set(state.invoices.map(i => i.sport).filter(Boolean))].sort();
  const coachesInInvoices = [...new Set(state.invoices.map(i => i.coach).filter(Boolean))].sort();

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Invoices</h1>
        <div class="subtitle"><span id="inv-count">Loading...</span></div>
      </div>
      <div class="topbar-actions">
        <button class="btn ghost" id="quick-rental-inv" title="Log a court/room rental with auto-invoice">🏟 + Add Rental</button>
        <button class="btn ghost" id="generate-latest-inv" title="Pick a member and auto-create an invoice from their latest enrollment">⚡ Generate latest invoice</button>
        <button class="btn ghost" id="export-inv">📥 Export</button>
        <button class="btn ghost" onclick="findDuplicateInvoices()" title="Find membership invoices that look like duplicates (same member, sport, month and amount)">🔍 Find duplicates</button>
        <button class="btn primary" id="add-inv">+ New Invoice</button>
      </div>
    </div>
    <div class="card">
      <div class="filter-bar">
        <div class="search"><input id="inv-search" type="text" placeholder="Search customer name, mobile, QID, coach, sport..." /></div>
        <select id="inv-month" class="btn ghost">
          <option value="all">All months</option>
          ${[...new Set(state.invoices.map(i => i.month).filter(Boolean))].sort().reverse().map(m => `<option value="${m}">${fmtMonth(m)}</option>`).join('')}
        </select>
        <select id="inv-category" class="btn ghost">
          <option value="all">All categories</option>
          ${INVOICE_CATS.map(c => `<option>${c}</option>`).join('')}
        </select>
        <select id="inv-sport" class="btn ghost">
          <option value="all">All activities</option>
          ${sportsInInvoices.map(s => `<option>${escapeHtml(s)}</option>`).join('')}
        </select>
        <select id="inv-coach" class="btn ghost">
          <option value="all">All coaches</option>
          ${coachesInInvoices.map(c => `<option>${escapeHtml(c)}</option>`).join('')}
        </select>
        <select id="inv-method" class="btn ghost">
          <option value="all">All methods</option>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
        </select>
      </div>
      <div id="inv-mergebar" style="display:none;align-items:center;gap:10px;padding:10px 14px;margin-bottom:12px;background:rgba(91,141,239,.10);border:1px solid rgba(91,141,239,.30);border-radius:8px">
        <span style="font-size:16px">🧾</span>
        <div style="flex:1;font-size:13px;font-weight:600"><span id="inv-merge-count">0</span> invoices selected</div>
        <button class="btn primary sm" id="inv-merge-go" title="Combine the selected invoices (same customer) into one">🔗 Merge into one invoice</button>
        <button class="btn ghost sm" id="inv-merge-clear">Clear</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:34px;text-align:center"><input type="checkbox" id="inv-select-all" title="Select/clear all on this page" style="cursor:pointer"></th>
              <th>Ref</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Category</th>
              <th>Activity</th>
              <th>Coach</th>
              <th>Description</th>
              <th>Method</th>
              <th class="text-right">Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="inv-tbody"></tbody>
        </table>
      </div>
      <div id="inv-pagination"></div>
    </div>
  `;
  $('#inv-search').addEventListener('input', e => { filter.search = e.target.value; pg.page = 1; refresh(); });
  $('#inv-month').addEventListener('change', e => { filter.month = e.target.value; pg.page = 1; refresh(); });
  $('#inv-method').addEventListener('change', e => { filter.method = e.target.value; pg.page = 1; refresh(); });
  $('#inv-sport').addEventListener('change', e => { filter.sport = e.target.value; pg.page = 1; refresh(); });
  $('#inv-coach').addEventListener('change', e => { filter.coach = e.target.value; pg.page = 1; refresh(); });
  $('#inv-category').addEventListener('change', e => { filter.category = e.target.value; pg.page = 1; refresh(); });
  $('#add-inv').addEventListener('click', addInvoice);
  $('#inv-merge-clear').addEventListener('click', () => { selected.clear(); refresh(); });
  $('#inv-merge-go').addEventListener('click', () => mergeSelectedInvoices());

  function mergeSelectedInvoices() {
    const invs = state.invoices.filter(i => selected.has(i.id));
    if (invs.length < 2) { toast('Tick at least 2 invoices to merge', 'error'); return; }
    const custIds = [...new Set(invs.map(i => i.customerId || null))];
    if (custIds.length !== 1 || custIds[0] == null) {
      toast('Merge needs invoices that all belong to the same linked customer', 'error');
      return;
    }
    const custId = custIds[0];
    const cust = state.members.find(m => m.id === custId);
    // Preserve each invoice as a line item (keeps per-sport coach for commission)
    const lineItems = [];
    for (const inv of invs) {
      const existing = (Array.isArray(inv.lineItems) && inv.lineItems.length)
        ? inv.lineItems
        : [{ sport: inv.sport, coachId: inv.coachId, coach: inv.coach, price: inv.amount || 0, description: inv.description }];
      existing.forEach(li => lineItems.push({
        sport: li.sport || null,
        coachId: li.coachId ?? null,
        coach: li.coach || (li.coachId ? coachName(li.coachId) : null),
        price: li.price || 0,
        description: li.description || inv.description || '',
      }));
    }
    const totalAmt = lineItems.reduce((s, li) => s + (li.price || 0), 0);
    const months = [...new Set(invs.map(i => i.month))];
    const dates = invs.map(i => i.date).sort();
    const methods = [...new Set(invs.map(i => i.method))];
    const cats = [...new Set(invs.map(i => i.category || 'Membership'))];
    const coachIdsUniform = [...new Set(lineItems.map(li => li.coachId))];
    const sportsUniform = [...new Set(lineItems.map(li => li.sport))];
    const refs = invs.map(i => i.ref || `#${i.id}`);

    const monthWarn = months.length > 1
      ? `<div style="color:var(--red);font-size:12px;margin-top:8px">⚠️ These span different months (${months.join(', ')}). The merged invoice lands in ${dates[0].slice(0,7)}, which moves revenue between months.</div>` : '';
    const catWarn = cats.length > 1
      ? `<div style="color:var(--red);font-size:12px;margin-top:8px">⚠️ Mixed categories (${cats.join(', ')}); the merged invoice will be "${cats[0]}".</div>` : '';
    const liHtml = lineItems.map(li => `<li>${escapeHtml(li.sport || '—')}${li.coach ? ' · ' + escapeHtml(li.coach) : ' · no coach'} — <b>${fmt(li.price)}</b></li>`).join('');

    showModal({
      title: '🔗 Merge invoices into one',
      body: `
        <div style="font-size:13px;line-height:1.6">
          Combining <b>${invs.length} invoices</b> for <b>${escapeHtml(cust ? cust.name : 'this customer')}</b> into one invoice with these line items:
          <ul style="margin:8px 0 0 18px">${liHtml}</ul>
          <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">New total: <b style="color:var(--green)">${fmt(totalAmt)} QAR</b></div>
          <div style="font-size:12px;color:var(--text-mute);margin-top:8px">✓ Each line keeps its own coach, so commission stays accurate — the MMA line still credits its coach and Summer Camp stays coach-less. The original ${invs.length} invoices (${refs.join(', ')}) are removed and replaced by one.</div>
          ${monthWarn}${catWarn}
        </div>`,
      actions: [
        { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
        { label: `Merge ${invs.length} → 1`, class: 'btn primary', onclick: () => {
          const keepDate = dates[0];
          const merged = {
            id: nextId(state.invoices),
            date: keepDate,
            month: keepDate.slice(0, 7),
            description: (cust ? cust.name : (invs[0].customerName || '')) + ' — ' + lineItems.map(li => li.sport || 'item').join(' + '),
            amount: totalAmt,
            method: methods.length === 1 ? methods[0] : invs[0].method,
            ref: refs[0],
            category: cats[0],
            activityType: invs[0].activityType || (cats[0] === 'Membership' ? 'subscription' : 'other'),
            sport: sportsUniform.length === 1 ? sportsUniform[0] : null,
            coach: (coachIdsUniform.length === 1 && lineItems[0].coach) ? lineItems[0].coach : null,
            coachId: coachIdsUniform.length === 1 ? coachIdsUniform[0] : null,
            customerId: custId,
            customerName: cust ? cust.name : (invs[0].customerName || null),
            lineItems,
            mergedFrom: refs,
          };
          state.invoices = state.invoices.filter(i => !selected.has(i.id));
          state.invoices.push(merged);
          audit('invoice.merge', `invoice:${merged.id}`, `Merged ${invs.length} invoices (${refs.join(', ')}) into ${merged.ref} · ${fmt(totalAmt)} QAR`, { customerId: custId, refs, total: totalAmt });
          selected.clear();
          save();
          closeModal();
          refresh();
          toast(`🔗 Merged ${invs.length} invoices into one · ${fmt(totalAmt)} QAR`);
        } },
      ],
    });
  }
  $('#generate-latest-inv').addEventListener('click', () => generateLatestInvoice(refresh));
  $('#quick-rental-inv').addEventListener('click', () => addRental(refresh));
  $('#export-inv').addEventListener('click', () => {
    // Export the CURRENT filtered set (was: all invoices regardless of filter)
    const all = applyFilter().sort((a,b) => b.date.localeCompare(a.date));
    if (!all.length) { toast('No invoices to export', 'error'); return; }
    const rows = [['Ref','Date','Month','Category','Customer','Mobile','QID','Activity','Coach','Description','Method','Amount']];
    for (const i of all) {
      const cust = customerInfo(i);
      rows.push([
        i.ref || `#${i.id}`,
        i.date || '',
        i.month || '',
        i.category || 'Membership',
        cust.name || '',
        cust.phone || '',
        cust.qid || '',
        i.sport || '',
        i.coach || '',
        i.description || '',
        i.method || '',
        i.amount || 0,
      ]);
    }
    downloadFile(`invoices-${TODAY}.csv`, rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n'), 'text/csv');
    toast(`Exported ${all.length} invoice${all.length === 1 ? '' : 's'}`);
  });
  refresh();
};

// ─── Unified invoice creation ────────────────────────────────────────
// One screen handles all invoice categories:
//   - Membership / Other  → classic fields (desc, sport, coach, amount, member)
//   - Product             → POS-style cart with line items + walk-in/member selector
//   - Rental              → redirects to the Rentals page (facility-specific form)
// Each invoice still has ONE category — line items only stack within Product type.
function addInvoice() {
  const sports = ['MMA','Boxing','Kick Boxing','Karate','Taekwondo','Gymnastic','Football','Swimming','Zumba','Court Rental','Merchandise'];
  const coachOptions = activeCoaches().map(c => c.name).concat(['Yasmin (guest)','Ibrahim (guest)']);

  // Cart state for Product category (shared with the existing helpers
  // renderSaleLines / wireSaleModal / completeSale)
  window._saleLines = [];
  window._saleCust = { type: 'walkin', memberId: null, name: '', phone: '' };

  showModal({
    title: 'New Invoice',
    body: `
      <div class="field"><label>Revenue category</label>
        <select id="f-category">${INVOICE_CATS.map(c => `<option ${c==='Membership'?'selected':''}>${c}</option>`).join('')}</select>
      </div>
      <div id="f-category-hint" class="text-mute" style="font-size:11px;margin-top:2px;margin-bottom:14px"></div>

      <!-- BODY: swaps based on selected category -->
      <div id="f-body"></div>
    `,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: 'Create', class: 'btn primary', id: 'f-save', onclick: () => saveUnifiedInvoice() },
    ],
  });

  const catSel = $('#f-category');
  catSel.addEventListener('change', () => renderInvoiceBody(catSel.value));
  renderInvoiceBody(catSel.value);

  function renderInvoiceBody(category) {
    const body = $('#f-body');
    const hint = $('#f-category-hint');
    const saveBtn = $('#f-save');
    // Switch modal width: Product needs the wide layout for the 2-column cart;
    // other categories use the default compact 600px width.
    const modalEl = document.querySelector('.modal');
    if (modalEl) modalEl.classList.toggle('wide', category === 'Product');

    if (category === 'Court Rental' || category === 'Boxing Room') {
      hint.innerHTML = '🏟 Rentals have their own form (facility, hours, customer history). Click below to go to the Rentals page.';
      saveBtn.textContent = 'Go to Rentals';
      saveBtn.onclick = () => { closeModal(); navigate('rentals'); };
      body.innerHTML = `
        <div style="text-align:center;padding:30px;background:var(--surface-2);border-radius:10px">
          <div style="font-size:42px;margin-bottom:8px">🏟</div>
          <div style="font-weight:600;margin-bottom:4px">Use the Rentals page</div>
          <div class="text-mute" style="font-size:12px">Rentals need a facility, hourly rate, hours, and customer info — those live on the Rentals page where you also get search-by-mobile and per-customer history.</div>
        </div>
      `;
      return;
    }

    if (category === 'Product') {
      hint.innerHTML = '🛍 Product sales: pick items from the catalog, choose member or walk-in customer. Stock will decrement automatically.';
      // Guard: if there are no products in the catalog yet, the cart UI is
      // useless (empty dropdown). Show a friendly "set up products first" panel
      // that links to the Products page.
      if (!(state.products || []).length) {
        saveBtn.textContent = 'Go to Products';
        saveBtn.onclick = () => { closeModal(); navigate('products'); };
        body.innerHTML = `
          <div style="text-align:center;padding:30px;background:var(--surface-2);border-radius:10px">
            <div style="font-size:42px;margin-bottom:8px">📦</div>
            <div style="font-weight:600;margin-bottom:4px">No products in your catalog yet</div>
            <div class="text-mute" style="font-size:12px;margin-bottom:14px">Before you can record a product sale, add items (uniforms, gloves, water bottles, etc.) to your Products page with their price and stock quantity.</div>
            <div class="text-mute" style="font-size:11px">Click <b>Go to Products</b> below, then click <b>+ Add Product</b> there.</div>
          </div>
        `;
        return;
      }
      saveBtn.textContent = '💾 Complete Sale';
      saveBtn.onclick = () => completeUnifiedSale();
      // Reset cart state each time the user enters Product mode (so switching
      // categories back and forth doesn't accumulate empty lines).
      window._saleLines = [];
      window._saleCust = { type: 'walkin', memberId: null, name: '', phone: '' };
      // Re-use the POS-style cart UI from the old Sales page
      body.innerHTML = renderPosBody();
      setTimeout(() => wireSaleModal(), 0);
      return;
    }

    // Membership / Other (default)
    hint.innerHTML = category === 'Membership'
      ? '🥋 Membership / subscription / renewal payment. Link a member so attendance and coach revenue track correctly.'
      : '📝 General invoice (training camps, deposits, refunds, etc.).';
    saveBtn.textContent = 'Add invoice';
    saveBtn.onclick = () => saveUnifiedInvoice();
    body.innerHTML = `
      <div class="field"><label>Customer (or description)</label><input id="f-desc" placeholder="e.g. Rakan kickboxing 12 classes" /></div>
      <div class="form-row">
        <div class="field"><label>Activity</label><select id="f-sport"><option value="">— select —</option>${sports.map(s => `<option>${s}</option>`).join('')}</select></div>
        <div class="field"><label>Amount (QAR)</label><input id="f-amt" type="number" step="0.01" /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Coach</label><select id="f-coach"><option value="">— select —</option>${coachOptions.map(c => `<option>${escapeHtml(c)}</option>`).join('')}</select></div>
        <div class="field"><label>Method</label><select id="f-method"><option value="cash">Cash</option><option value="card">Card</option></select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Date</label><input id="f-date" type="date" value="${TODAY}" /></div>
        <div class="field"><label>Paid now (QAR) <span class="text-mute" style="font-size:10px;font-weight:400">(blank = full)</span></label><input id="f-paid" type="number" min="0" step="0.01" placeholder="full amount" /></div>
      </div>
      <div class="field"><label>Match member (optional)</label>${memberPickerHtml('f-cust', { placeholder: '— none —' })}</div>
    `;
    bindMemberPicker('f-cust', { placeholder: '— none —' });
  }

  function renderPosBody() {
    // Borrowed from the old Sales page newSale() — same DOM ids so wireSaleModal/
    // completeSale/renderSaleLines work without changes.
    return `
      <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:14px;min-width:0">
        <div style="min-width:0">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div style="font-weight:700;font-size:13px">🛒 Cart</div>
            <button type="button" class="btn ghost sm" id="sale-add-line">+ Add line</button>
          </div>
          <div id="sale-lines" style="display:flex;flex-direction:column;gap:4px;max-height:340px;overflow-y:auto;overflow-x:hidden;border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--surface-2)"></div>
          <div id="sale-empty-hint" class="text-mute" style="font-size:11px;margin-top:4px;text-align:center">Click "+ Add line" to start</div>

          <div style="margin-top:12px;background:var(--surface-2);border-radius:8px;padding:10px;font-size:13px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span class="text-mute">Subtotal</span><span id="sale-subtotal" class="font-bold">0.00</span></div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span class="text-mute">Discount (QAR)</span>
              <input type="number" id="sale-discount" min="0" step="0.01" value="0" style="width:100px;text-align:right;background:transparent;border:1px solid var(--border);border-radius:4px;padding:3px 6px;color:var(--text)" />
            </div>
            <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);margin-top:6px;padding-top:6px;font-size:15px">
              <span class="font-bold">Total</span><span id="sale-total" class="font-bold" style="color:var(--green)">0.00</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
              <span class="text-mute">Paid (QAR)</span>
              <input type="number" id="sale-paid" min="0" step="0.01" value="0" style="width:100px;text-align:right;background:transparent;border:1px solid var(--border);border-radius:4px;padding:3px 6px;color:var(--text)" />
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:11px">
              <span class="text-mute">Balance</span><span id="sale-balance" class="font-bold" style="color:var(--accent-2)">0.00</span>
            </div>
          </div>
        </div>
        <div style="min-width:0">
          <div style="font-weight:700;font-size:13px;margin-bottom:6px">👤 Customer</div>
          <div style="display:flex;gap:6px;margin-bottom:8px">
            <button type="button" class="btn ghost sm" data-cust-type="member" id="cust-tab-member" style="flex:1">🎟 Member</button>
            <button type="button" class="btn ghost sm" data-cust-type="walkin" id="cust-tab-walkin" style="flex:1;background:var(--accent);color:white">🚶 Walk-in</button>
          </div>
          <div id="cust-member-fields" style="display:none">
            <div class="field" style="margin-bottom:8px"><label>Member</label>${memberPickerHtml('sale-cust', { placeholder: 'Search by name / mobile / QID...' })}</div>
          </div>
          <div id="cust-walkin-fields">
            <div class="field" style="margin-bottom:8px"><label>Name *</label><input type="text" id="sale-walkin-name" placeholder="Required" /></div>
            <div style="margin-bottom:8px">${phoneInputHtml('sale-walkin-phone', '', { label: 'Mobile', fieldStyle: 'margin:0' })}</div>
          </div>

          <div style="font-weight:700;font-size:13px;margin:14px 0 6px">📝 Details</div>
          <div class="field" style="margin-bottom:8px"><label>Date</label><input type="date" id="sale-date" value="${TODAY}" /></div>
          <div class="field" style="margin-bottom:8px"><label>Method</label><select id="sale-method-pos"><option value="cash">Cash</option><option value="card">Card</option></select></div>
          <div class="field" style="margin-bottom:8px"><label>Notes</label><input type="text" id="sale-notes" /></div>
        </div>
      </div>
      <div style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:8px;padding:10px;margin-top:12px;font-size:12px">
        💡 An invoice will be created automatically. Stock levels update too.
      </div>
    `;
  }

  function saveUnifiedInvoice() {
    // Membership / Other branch
    const desc = $('#f-desc')?.value.trim();
    const amt = parseFloat($('#f-amt')?.value);
    const method = $('#f-method')?.value;
    const date = $('#f-date')?.value;
    if (!desc || !amt || !date) { toast('Description, amount and date required', 'error'); return; }
    const custId = parseInt($('#f-cust')?.value) || null;
    const custMember = custId ? state.members.find(m => m.id === custId) : null;
    const category = $('#f-category').value;
    const mth = date.slice(0, 7);
    const sport = $('#f-sport').value || null;
    // Partial payment: "Paid now" defaults to the full amount.
    const paidRaw = $('#f-paid')?.value;
    const paidNow = (paidRaw === '' || paidRaw == null) ? amt : Math.max(0, Math.min(parseFloat(paidRaw) || 0, amt));
    // Block accidental duplicates: same member + sport + month + amount.
    if (category === 'Membership' && custId) {
      const dup = findDuplicateInvoiceOf(custId, sport, mth, amt, null);
      if (dup) {
        if (!confirm(`⚠️ ${custMember ? custMember.name : 'This member'} already has a Membership invoice for ${sport || 'this activity'} in ${fmtMonth(mth)} of ${fmt(amt)} QAR (${dup.ref || ('INV' + dup.id)}).\n\nCreating another will count the fee twice and double the coach's commission. Create it anyway?`)) {
          return;
        }
      }
    }
    state.invoices.push({
      id: nextId(state.invoices),
      date,
      description: desc,
      amount: amt,
      amountPaid: paidNow,
      payments: paidNow > 0 ? [{ date, month: mth, amount: paidNow, method }] : [],
      method,
      month: mth,
      ref: nextInvoiceRef(),
      category,
      activityType: category === 'Membership' ? 'subscription' : 'other',
      sport,
      coach: $('#f-coach').value || (custMember ? coachName(custMember.coachId) : null),
      coachId: custMember ? custMember.coachId : null,
      customerId: custId,
      customerName: custMember ? custMember.name : null,
    });
    save();
    closeModal();
    render();
    toast(paidNow < amt ? `Invoice added · ${fmt(paidNow)} paid, ${fmt(amt - paidNow)} balance` : 'Invoice added');
  }

  function completeUnifiedSale() {
    // Delegates to the existing completeSale (which already handles stock,
    // sale record, and invoice creation). On completion: close + refresh.
    completeSale(() => { closeModal(); render(); });
  }
}

// Show all invoices for a customer in a modal
window.showInvoiceHistory = function(customerId) {
  const m = state.members.find(x => x.id === customerId);
  if (!m) return;
  const invs = state.invoices
    .filter(i => i.customerId === customerId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = invs.reduce((s, i) => s + (i.amount || 0), 0);
  showModal({
    title: `Invoice history: ${escapeHtml(m.name)}`,
    body: `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
        <div class="avatar" style="width:44px;height:44px;background:linear-gradient(135deg,var(--blue),var(--purple))">${initials(m.name)}</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:15px">${escapeHtml(m.name)}${m.nameArabic ? ` <span class="text-mute" style="font-size:12px" dir="rtl">${escapeHtml(m.nameArabic)}</span>` : ''}</div>
          <div class="text-dim" style="font-size:12px">${isRealPhone(m.phone) ? phoneCell(m.phone, { stop: false }) + ' · ' : ''}${escapeHtml(m.sport)} · ${escapeHtml(coachName(m.coachId))}</div>
        </div>
        <div class="text-right">
          <div class="text-mute" style="font-size:11px">Total billed</div>
          <div class="font-bold" style="font-size:18px">${fmt(total)} QAR</div>
        </div>
      </div>
      ${invs.length ? `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Ref</th><th>Date</th><th>Activity</th><th>Description</th><th>Method</th><th class="text-right">Amount</th><th></th></tr></thead>
          <tbody>
            ${invs.map(i => `
              <tr>
                <td class="font-mono" style="font-size:11px">${escapeHtml(i.ref || `#${i.id}`)}</td>
                <td class="text-dim" style="white-space:nowrap">${fmtDate(i.date)}</td>
                <td>${i.sport ? `<span class="badge">${escapeHtml(i.sport)}</span>` : '<span class="text-mute">—</span>'}</td>
                <td class="text-mute" style="font-size:12px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(i.description || '—')}</td>
                <td><span class="badge ${i.method === 'card' ? 'blue' : ''}">${i.method}</span></td>
                <td class="text-right num font-bold">${fmt(i.amount)}</td>
                <td class="text-right"><button class="btn ghost sm" onclick="closeModal();printInvoicePDF(${i.id})" title="Export PDF">⬇</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : `<div class="empty"><div class="empty-icon">📄</div>No invoices linked to this member yet.</div>`}
    `,
    actions: [{ label: 'Close', class: 'btn primary', onclick: closeModal }],
  });
};

// Pick a member then auto-create an invoice from their latest enrollment
function generateLatestInvoice(onDone) {
  showModal({
    title: '⚡ Generate latest invoice',
    body: `
      <div style="margin-bottom:14px;color:var(--text-dim);font-size:13px">
        Pick a member — the app will create a new invoice based on their latest enrollment(s).
        Coach, sport, and amount are filled automatically; you can adjust the payment method below.
      </div>
      <div class="field"><label>Member</label>${memberPickerHtml('gli-cust', { placeholder: 'Search member by name, mobile, or QID…' })}</div>
      <div id="gli-preview" style="margin-top:12px;display:none;background:var(--surface-2);border-radius:8px;padding:12px;font-size:13px"></div>
      <div class="form-row" style="margin-top:10px">
        <div class="field"><label>Date</label><input type="date" id="gli-date" value="${TODAY}" /></div>
        <div class="field"><label>Method</label><select id="gli-method"><option value="cash">Cash</option><option value="card">Card</option></select></div>
      </div>
    `,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: '⚡ Generate', class: 'btn primary', onclick: () => {
        const custId = parseInt($('#gli-cust').value);
        if (!custId) { toast('Pick a member first', 'error'); return; }
        const m = state.members.find(x => x.id === custId);
        if (!m) return;
        // Pull enrollment data; fall back to most recent subscription
        let enrollments = (m.enrollments || []).filter(e => e.sport && e.coachId);
        if (!enrollments.length) {
          // Build from latest subscription per sport
          const bySport = new Map();
          for (const s of (m.subscriptions || [])) {
            if (s.activity) bySport.set(s.activity, s);
          }
          enrollments = [...bySport.values()].map(s => ({
            sport: s.activity, coachId: s.coachId,
            classes: s.totalClasses, price: s.amountPaid,
          }));
        }
        if (!enrollments.length) { toast('No enrollments found for this member', 'error'); return; }

        const date = $('#gli-date').value || TODAY;
        const method = $('#gli-method').value || 'cash';
        const totalAmt = enrollments.reduce((s, e) => s + (e.price || 0), 0);
        if (totalAmt <= 0) { toast('Enrollment prices are 0 — nothing to invoice', 'error'); return; }

        // Build descriptive line (e.g. "Boxing 8cls · MMA 8cls")
        const desc = enrollments.map(e => `${e.sport}${e.classes ? ' ' + e.classes + 'cls' : ''}`).join(' · ');
        const primary = enrollments[0];
        const coach = state.coaches.find(c => c.id === primary.coachId);
        const mth = date.slice(0, 7);
        // Guard: don't silently re-invoice the same member in the same month —
        // a second Membership invoice would DOUBLE the coach's commission base.
        const dupes = state.invoices.filter(inv =>
          inv.customerId === m.id && inv.month === mth && (inv.category || 'Membership') === 'Membership');
        if (dupes.length) {
          const refs = dupes.map(i => i.ref || ('INV' + i.id)).join(', ');
          if (!confirm(`⚠️ ${m.name} already has a membership invoice in ${fmtMonth(mth)} (${refs}).\n\n` +
              `Creating another one will count their fee twice and double the coach's commission for ${fmtMonth(mth)}. ` +
              `Create it anyway?`)) {
            return;
          }
        }
        const newInv = {
          id: nextId(state.invoices),
          date,
          description: desc + (m.name ? ` — ${m.name}` : ''),
          amount: totalAmt,
          method,
          month: mth,
          ref: nextInvoiceRef(),
          category: 'Membership',
          activityType: 'subscription',
          sport: primary.sport,
          coach: coach ? coach.name : null,
          coachId: primary.coachId,
          customerId: m.id,
          customerName: m.name,
        };
        state.invoices.push(newInv);
        save();
        closeModal();
        toast(`Invoice ${newInv.ref} created — ${fmt(totalAmt)} QAR`, 'success');
        if (onDone) onDone(); else render();
      }},
    ],
  });
  bindMemberPicker('gli-cust', { placeholder: 'Search member…' });
  // Live preview when member changes
  setTimeout(() => {
    const hidden = document.getElementById('gli-cust');
    const preview = document.getElementById('gli-preview');
    if (!hidden || !preview) return;
    function update() {
      const id = parseInt(hidden.value);
      if (!id) { preview.style.display = 'none'; return; }
      const m = state.members.find(x => x.id === id);
      if (!m) { preview.style.display = 'none'; return; }
      let enrollments = (m.enrollments || []).filter(e => e.sport && e.coachId);
      if (!enrollments.length) {
        const bySport = new Map();
        for (const s of (m.subscriptions || [])) if (s.activity) bySport.set(s.activity, s);
        enrollments = [...bySport.values()].map(s => ({ sport: s.activity, coachId: s.coachId, classes: s.totalClasses, price: s.amountPaid }));
      }
      const total = enrollments.reduce((s, e) => s + (e.price || 0), 0);
      preview.style.display = 'block';
      preview.innerHTML = enrollments.length ? `
        <div style="font-weight:600;margin-bottom:6px">Will invoice:</div>
        ${enrollments.map(e => `<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0">
          <span>${escapeHtml(e.sport)}${e.classes ? ` · ${e.classes} classes` : ''} · ${escapeHtml(state.coaches.find(c=>c.id===e.coachId)?.name || '—')}</span>
          <span class="font-bold">${fmt(e.price || 0)} QAR</span>
        </div>`).join('')}
        <div style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px;display:flex;justify-content:space-between">
          <span class="font-bold">Total</span><span class="font-bold" style="color:var(--green)">${fmt(total)} QAR</span>
        </div>` : '<div class="text-mute">No enrollment data — generate not possible.</div>';
    }
    // Poll for hidden-value changes (the member picker sets `.value` via
    // property assignment, which MutationObserver can't see).
    let lastVal = hidden.value;
    update();
    const poll = setInterval(() => {
      if (!document.body.contains(hidden)) { clearInterval(poll); return; }
      if (hidden.value !== lastVal) { lastVal = hidden.value; update(); }
    }, 200);
  }, 50);
}

// Lazy-load the OCR engine (only when the user actually scans an ID).
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = () => window.Tesseract ? resolve(window.Tesseract) : reject(new Error('OCR engine failed to initialise'));
    s.onerror = () => reject(new Error('Could not load the OCR engine — this feature needs an internet connection.'));
    document.head.appendChild(s);
  });
}

// Read a Qatar residency-permit photo and auto-fill the member form. Fills only
// EMPTY fields (never overwrites something already typed) and reports what it
// did so the admin can verify.
async function scanIdCard(file) {
  const statusEl = document.getElementById('id-scan-status');
  const btn = document.getElementById('id-scan-btn');
  const setStatus = (msg, color) => { if (statusEl) { statusEl.textContent = msg; statusEl.style.color = color || 'var(--text-mute)'; } };
  if (btn) btn.disabled = true;
  try {
    setStatus('Loading OCR engine…');
    const T = await loadTesseract();
    setStatus('Reading the ID… this can take 10–30s');
    const { data } = await T.recognize(file, 'eng+ara', {
      logger: m => { if (m.status === 'recognizing text') setStatus(`Reading the ID… ${Math.round((m.progress || 0) * 100)}%`); },
    });
    const f = parseQatarId(data && data.text || '');
    // Fill only empty fields
    const fill = (id, val) => {
      if (!val) return null;
      const elx = document.getElementById(id);
      if (!elx) return null;
      if ((elx.value || '').trim()) return 'kept';   // user already entered something
      elx.value = val;
      return 'filled';
    };
    const filled = [];
    const skipped = [];
    const missed = [];
    const apply = (id, val, label) => {
      if (!val) { missed.push(label); return; }
      const r = fill(id, val);
      if (r === 'filled') filled.push(label);
      else if (r === 'kept') skipped.push(label);
    };
    apply('f-name', f.nameEn, 'English name');
    apply('f-name-ar', f.nameAr, 'Arabic name');
    apply('f-qid', f.qid, 'QID');
    apply('f-bdate', f.birthdate, 'birthdate');
    apply('f-nationality', f.nationality, 'nationality');

    if (filled.length) {
      setStatus(`✓ Filled: ${filled.join(', ')}.${missed.length ? ' Couldn\'t read: ' + missed.join(', ') + '.' : ''}${skipped.length ? ' Kept your: ' + skipped.join(', ') + '.' : ''} Please verify.`, 'var(--green)');
      toast(`Scanned ID · filled ${filled.length} field${filled.length === 1 ? '' : 's'} — please verify`, 'success');
    } else {
      setStatus(`Couldn't read the fields clearly${missed.length ? ' (' + missed.join(', ') + ')' : ''}. Try a sharper, well-lit photo, or enter manually.`, 'var(--accent-2)');
      toast('Could not read the ID clearly — please enter manually', 'error');
    }
  } catch (err) {
    setStatus((err && err.message) || 'Scan failed — please enter manually.', 'var(--red)');
    toast((err && err.message) || 'Scan failed', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// One-click cleanup: Title-case all member English names (anas madni → Anas Madni).
window.fixNameCapitalization = function() {
  const changes = [];
  for (const m of state.members) {
    if (!m.name) continue;
    const fixed = titleCaseName(m.name);
    if (fixed !== m.name) changes.push({ m, fixed });
  }
  if (!changes.length) { toast('All member names already look fine — nothing to change'); return; }
  const samples = changes.slice(0, 6).map(c => `• ${c.m.name} → ${c.fixed}`).join('\n');
  if (!confirm(`Fix capitalisation on ${changes.length} member name${changes.length === 1 ? '' : 's'}?\n\n${samples}${changes.length > 6 ? '\n…and ' + (changes.length - 6) + ' more' : ''}\n\nThis updates the saved English names. Back up first if unsure.`)) return;
  changes.forEach(c => { c.m.name = c.fixed; });
  if (typeof audit === 'function') audit('members.fix_names', 'members', `Title-cased ${changes.length} member name(s)`, { count: changes.length });
  save();
  render();
  toast(`Fixed ${changes.length} name${changes.length === 1 ? '' : 's'}`);
};

window.recordPaymentUI = function(id) {
  const inv = state.invoices.find(i => i.id === id);
  if (!inv) return;
  const bal = invoiceBalance(inv);
  const cust = customerInfo(inv);
  showModal({
    title: '💵 Record payment',
    body: `
      <div style="margin-bottom:12px;font-size:13px">
        ${cust.name ? `<div class="font-bold">${escapeHtml(cust.name)}</div>` : ''}
        <div class="text-mute" style="font-size:12px">${inv.ref || '#' + inv.id} · ${escapeHtml(inv.sport || inv.description || '')}</div>
        <div style="margin-top:8px;display:flex;gap:18px;flex-wrap:wrap">
          <span class="text-mute">Total <b style="color:var(--text)">${fmt(inv.amount)}</b></span>
          <span class="text-mute">Paid <b style="color:var(--green)">${fmt(invoicePaid(inv))}</b></span>
          <span class="text-mute">Balance <b style="color:var(--accent-2)">${fmt(bal)}</b></span>
        </div>
      </div>
      <div class="form-row">
        <div class="field"><label>Payment amount (QAR)</label><input id="pay-amt" type="number" min="0" step="0.01" value="${bal.toFixed(2)}" /></div>
        <div class="field"><label>Date</label><input id="pay-date" type="date" value="${TODAY}" /></div>
        <div class="field"><label>Method</label><select id="pay-method"><option value="cash">Cash</option><option value="card">Card</option></select></div>
      </div>
      <div class="text-mute" style="font-size:11px;margin-top:4px">Counts as revenue in the month of the payment date.</div>
    `,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: '💵 Record payment', class: 'btn primary', onclick: () => {
        const amt = parseFloat($('#pay-amt').value) || 0;
        if (amt <= 0) { toast('Enter a payment amount', 'error'); return; }
        let pay = amt;
        if (amt > bal + 0.001) {
          if (!confirm(`That's more than the ${fmt(bal)} balance — record only the ${fmt(bal)} balance?`)) return;
          pay = bal;   // never collect more than is owed
        }
        recordInvoicePayment(inv, pay, { date: $('#pay-date').value || TODAY, method: $('#pay-method').value || 'cash' });
        save();
        closeModal();
        render();
        const nb = invoiceBalance(inv);
        toast(nb > 0.001 ? `Payment recorded · ${fmt(nb)} balance remaining` : '✓ Paid in full');
      }},
    ],
  });
};

window.editInvoiceQuick = function(id) {
  const inv = state.invoices.find(i => i.id === id);
  if (!inv) return;
  const sports = ['MMA','Boxing','Kick Boxing','Karate','Taekwondo','Gymnastic','Football','Swimming','Zumba','Court Rental','Merchandise'];
  const coachOptions = state.coaches.map(c => c.name).concat(['Yasmin (guest)','Ibrahim (guest)']);

  // ─ Build "linked stock items" panel ─
  // Items can be linked two ways:
  //   1. Hard link: the invoice belongs to a sale transaction → its items[] are explicit
  //   2. Soft match: scan product catalog for names appearing in the description
  const descLow = (inv.description || '').toLowerCase();
  const linkedSale = (state.sales || []).find(s => s.invoiceId === inv.id);
  const linkedExplicit = linkedSale ? (linkedSale.items || []).map(it => ({
    item: (state.products || []).find(p => p.id === it.productId) || { name: it.name, price: it.unitPrice, category: '' },
    qty: it.qty, hard: true,
  })).filter(x => x.item) : [];
  const linkedSoft = [];
  if (linkedExplicit.length === 0) {
    const STOP_WORDS = new Set(['the','and','for','of','with','old','new','xl','blackstars','black','stars']);
    for (const item of (state.products || [])) {
      if (!item.name || item.name.length < 4) continue;
      const nameLow = item.name.toLowerCase();
      const nameWords = nameLow.split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w));
      if (nameWords.length === 0) continue;
      const allFound = nameWords.every(w => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*`, 'i').test(descLow));
      if (allFound) {
        if (!linkedSoft.find(x => x.item.id === item.id)) {
          linkedSoft.push({ item, qty: null, hard: false });
        }
      }
    }
    linkedSoft.splice(5);
  }
  const linkedItems = [...linkedExplicit, ...linkedSoft];

  const stockPanel = linkedItems.length ? `
    <div style="margin-top:8px;padding:12px;background:rgba(91,141,239,.08);border:1px solid rgba(91,141,239,.25);border-radius:8px">
      <div style="font-size:11px;color:var(--blue);text-transform:uppercase;letter-spacing:.6px;font-weight:600;margin-bottom:8px">
        📦 Linked inventory${linkedExplicit.length ? '' : ' (auto-matched)'}
      </div>
      ${linkedItems.map(({item, qty, hard}) => {
        const remaining = item.id ? (typeof productCurrentStock === 'function' ? productCurrentStock(item.id) : (item.stock || 0)) : 0;
        const threshold = item.lowStockThreshold || 3;
        const stockColor = remaining <= 0 ? 'var(--red)' : remaining <= threshold ? 'var(--accent-2)' : 'var(--green)';
        const stockLabel = remaining <= 0 ? 'OUT' : remaining <= threshold ? 'LOW' : 'OK';
        return `
          <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
            <div style="flex:1">
              <div class="font-bold" style="font-size:13px">${escapeHtml(item.name)}${hard && qty ? ` × ${qty}` : ''}</div>
              <div class="text-mute" style="font-size:11px">${escapeHtml(item.category || '—')} · Unit ${fmt(item.price || 0)} QAR</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:11px;color:var(--text-mute)">Current stock</div>
              <div style="font-weight:700;color:${stockColor}">
                ${remaining}
                <span style="font-size:9px;background:${stockColor};color:#fff;padding:1px 4px;border-radius:3px;margin-left:4px">${stockLabel}</span>
              </div>
            </div>
            <button class="btn ghost sm" onclick="closeModal();window.navigate('invoices');setTimeout(()=>{const q=document.querySelector('#inv-search');if(q){q.value='${escapeHtml(item.name).replace(/'/g,"\\'")}';q.dispatchEvent(new Event('input'));}},200);" title="Filter invoices by this item">→</button>
          </div>
        `;
      }).join('')}
      ${linkedExplicit.length === 0 ? `<div class="text-mute" style="font-size:10px;margin-top:6px">These were matched by name in the description. To create a hard link, use + New Invoice → Product category.</div>` : ''}
    </div>
  ` : '';

  showModal({
    title: `Edit Invoice ${inv.ref || '#'+inv.id}`,
    body: `
      <div class="field"><label>Description</label><input id="ef-desc" value="${escapeHtml(inv.description || '')}" /></div>
      <div class="form-row">
        <div class="field"><label>Revenue category</label><select id="ef-category">${INVOICE_CATS.map(c => `<option ${c===(inv.category||'Membership')?'selected':''}>${c}</option>`).join('')}</select></div>
        <div class="field"><label>Activity</label><select id="ef-sport"><option value="">— none —</option>${sports.map(s => `<option ${s===inv.sport?'selected':''}>${s}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Coach</label><select id="ef-coach"><option value="">— none —</option>${coachOptions.map(c => `<option ${c===inv.coach?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select></div>
        <div class="field"><label>Customer</label>${memberPickerHtml('ef-cust', { placeholder: '— none —', selectedId: inv.customerId || null })}</div>
      </div>
      <div class="form-row">
        <div class="field"><label>Method</label><select id="ef-method"><option value="cash" ${inv.method==='cash'?'selected':''}>Cash</option><option value="card" ${inv.method==='card'?'selected':''}>Card</option></select></div>
        <div class="field"><label>Amount / total (QAR)</label><input id="ef-amt" type="number" step="0.01" value="${inv.amount}" oninput="document.getElementById('ef-balance').textContent=Math.max(0,(parseFloat(document.getElementById('ef-amt').value)||0)-(parseFloat(document.getElementById('ef-paid').value)||0)).toFixed(2)" /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Paid / collected (QAR) <span class="text-mute" style="font-size:10px">(correct a wrong entry)</span></label><input id="ef-paid" type="number" step="0.01" min="0" value="${invoicePaid(inv)}" oninput="document.getElementById('ef-balance').textContent=Math.max(0,(parseFloat(document.getElementById('ef-amt').value)||0)-(parseFloat(document.getElementById('ef-paid').value)||0)).toFixed(2)" /></div>
        <div class="field"><label>Balance due (QAR)</label><div id="ef-balance" style="padding:10px 14px;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--accent-2);font-size:14px;font-weight:700">${invoiceBalance(inv).toFixed(2)}</div></div>
      </div>
      <div class="text-mute" style="font-size:11px;margin:2px 0 6px">When a member pays the rest <b>later</b>, use the <b style="color:var(--green)">💵 Pay</b> button on the invoice row — it dates the payment in the month received. Edit "Paid" here only to <b>fix a wrong amount</b>.</div>
      <div class="field"><label>Date</label><input id="ef-date" type="date" value="${inv.date}" /></div>
      ${stockPanel}
    `,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: 'Save', class: 'btn primary', onclick: () => {
        inv.description = $('#ef-desc').value.trim();
        inv.category = $('#ef-category').value;
        inv.activityType = (inv.category === 'Court Rental' || inv.category === 'Boxing Room') ? 'rental' : inv.category === 'Product' ? 'sale' : 'subscription';
        inv.sport = $('#ef-sport').value || null;
        inv.coach = $('#ef-coach').value || null;
        const cId = parseInt($('#ef-cust').value) || null;
        inv.customerId = cId;
        const cm = cId ? state.members.find(m => m.id === cId) : null;
        inv.customerName = cm ? cm.name : null;
        if (cm && !inv.coachId) inv.coachId = cm.coachId;
        inv.method = $('#ef-method').value;
        inv.amount = parseFloat($('#ef-amt').value) || 0;
        inv.date = $('#ef-date').value;
        inv.month = inv.date.slice(0, 7);
        // Correct the collected amount if it was edited (or if the total was
        // lowered below what's collected). Rebuild the ledger as a single
        // corrected entry on the invoice date — this is a fix, not a new
        // payment (for a real later payment, use the 💵 Pay button instead).
        let newPaid = parseFloat($('#ef-paid').value);
        if (isNaN(newPaid)) newPaid = invoicePaid(inv);
        newPaid = Math.max(0, Math.min(newPaid, inv.amount));   // can't collect more than the total
        if (Math.abs(newPaid - invoicePaid(inv)) > 0.001) {
          inv.amountPaid = newPaid;
          inv.payments = newPaid > 0 ? [{ date: inv.date, month: inv.month, amount: newPaid, method: inv.method || 'cash' }] : [];
        }
        save();
        closeModal();
        render();
        toast(invoiceBalance(inv) > 0.001 ? `Invoice updated · ${fmt(invoiceBalance(inv))} still due` : 'Invoice updated');
      }},
    ],
  });
  bindMemberPicker('ef-cust', { placeholder: '— none —' });
};

window.deleteInvoice = function(id) {
  if (!confirm('Delete this invoice?')) return;
  state.invoices = state.invoices.filter(i => i.id !== id);
  save();
  render();
  toast('Invoice deleted');
};

// Find likely-duplicate Membership invoices: more than one with the same member,
// sport, month and amount. Switch-credit invoices are ignored (intentional).
window.findDuplicateInvoices = function() {
  const dups = detectDuplicateInvoices();
  if (!dups.length) {
    showModal({ title: '🔍 Find duplicate invoices',
      body: '<p>No duplicate membership invoices found. 🎉</p><p class="text-mute" style="font-size:12px">Checks for more than one Membership invoice with the same member, sport, month and amount.</p>',
      actions: [{ label: 'Close', class: 'btn ghost', onclick: closeModal }] });
    return;
  }
  const extra = dups.reduce((s, g) => s + (g.length - 1), 0);
  const body = `
    <p class="text-mute" style="font-size:12px;margin-bottom:10px">${dups.length} group${dups.length === 1 ? '' : 's'} found — same member, sport, month and amount. That's <b>${extra}</b> extra invoice${extra === 1 ? '' : 's'} likely double-counting commission. The first in each group is kept; delete the others.</p>
    ${dups.map(g => `
      <div style="border:1px solid var(--border);border-radius:8px;margin-bottom:10px;overflow:hidden">
        <div style="background:var(--surface-2);padding:8px 10px;font-weight:600;font-size:13px">${escapeHtml(g[0].memName)} · ${escapeHtml(g[0].sport)} · ${fmtMonth(g[0].inv.month || '')} · ${fmt(g[0].inv.amount || 0)} QAR <span class="text-mute" style="font-weight:400">(${g.length} copies)</span></div>
        <table style="width:100%;font-size:13px"><tbody>
          ${g.map((row, idx) => `<tr>
            <td style="padding:6px 10px;border-top:1px solid var(--border)">${escapeHtml(row.inv.ref || ('INV' + row.inv.id))} · ${fmtDate(row.inv.date)}${idx === 0 ? ' <span class="badge">keep</span>' : ''}</td>
            <td style="padding:6px 10px;border-top:1px solid var(--border);text-align:right">${idx === 0 ? '' : `<button class="btn ghost sm" onclick="deleteDuplicateInvoice(${row.inv.id})" title="Delete this duplicate">🗑 Delete</button>`}</td>
          </tr>`).join('')}
        </tbody></table>
      </div>`).join('')}
  `;
  showModal({ title: '🔍 Duplicate invoices found', body, actions: [{ label: 'Close', class: 'btn ghost', onclick: closeModal }] });
};

window.deleteDuplicateInvoice = function(id) {
  if (!confirm('Delete this duplicate invoice? This cannot be undone.')) return;
  state.invoices = state.invoices.filter(i => i.id !== id);
  save();
  toast('Duplicate invoice deleted');
  findDuplicateInvoices();   // refresh the list in place
};

// ─── Membership ID Card (printable / saveable as PDF) ────────────────
// Opens a popup with a credit-card-sized layout containing the member's
// photo placeholder, name, member #, sport, coach, expiry, and a barcode-
// style strip showing the QID. Designed to print 2-up on a single A4.
window.printIdCard = function(memberId) {
  const m = state.members.find(x => x.id === memberId);
  if (!m) { toast('Member not found', 'error'); return; }
  const status = memberStatus(m);
  const statusColor = status === 'Active' ? '#10b981' : status === 'Expired' ? '#ef4444' : status === 'Frozen' ? '#5b8def' : '#666';
  const sports = (() => {
    const set = new Set();
    if (m.sport) set.add(m.sport);
    (m.enrollments || []).forEach(e => { if (e.sport) set.add(e.sport); });
    return [...set];
  })();
  const primarySport = sports[0] || '—';
  const coach = m.coachId ? coachName(m.coachId) : '—';

  const w = window.open('', '_blank');
  if (!w) { toast('Popup blocked — please allow popups', 'error'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ID Card · ${escapeHtml(m.name)}</title>
    <style>
      @page { size: A4; margin: 16mm; }
      body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f0f0f0; margin: 0; padding: 20px; }
      .sheet { max-width: 600px; margin: 20px auto; }
      .card {
        width: 85.6mm; height: 53.98mm;   /* ISO/IEC 7810 ID-1 (credit-card size) */
        background: linear-gradient(135deg, #1a1a2e 0%, #2d1a3d 100%);
        border-radius: 12px; padding: 14px; color: white;
        position: relative; box-shadow: 0 4px 16px rgba(0,0,0,.3);
        display: grid; grid-template-rows: auto 1fr auto; gap: 6px;
        font-family: 'Helvetica Neue', Arial, sans-serif;
      }
      .card-header { display: flex; align-items: center; justify-content: space-between; }
      .logo { font-size: 11px; font-weight: 800; letter-spacing: 1px; color: #f26060; }
      .star { color: #f26060; font-size: 14px; }
      .sub { font-size: 7px; color: rgba(255,255,255,.65); text-transform: uppercase; letter-spacing: .8px; margin-top: -2px; }
      .body { display: grid; grid-template-columns: 50px 1fr; gap: 10px; align-items: center; }
      .avatar { width: 50px; height: 50px; background: linear-gradient(135deg,#5b8def,#a855f7); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; color: white; }
      .info { font-size: 10px; line-height: 1.4; }
      .name { font-size: 13px; font-weight: 700; margin-bottom: 2px; }
      .meta { color: rgba(255,255,255,.7); }
      .footer { display: flex; align-items: center; justify-content: space-between; font-size: 7px; color: rgba(255,255,255,.6); border-top: 1px solid rgba(255,255,255,.15); padding-top: 4px; letter-spacing: .5px; }
      .status-pill { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 7px; font-weight: 700; letter-spacing: .5px; color: white; }
      .barcode { background: rgba(255,255,255,.1); padding: 2px 8px; border-radius: 3px; font-family: 'Courier New', monospace; font-size: 8px; letter-spacing: 2px; }
      .actions { text-align: center; margin: 14px 0; }
      .btn { padding: 8px 16px; background: #5b8def; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; margin: 0 4px; }
      .btn.ghost { background: #ddd; color: #333; }
      @media print { body { background: white; padding: 0; } .actions { display: none; } .sheet { max-width: none; } }
    </style>
    </head><body>
      <div class="sheet">
        <div class="actions">
          <button class="btn" onclick="window.print()">🖨 Print / Save as PDF</button>
          <button class="btn ghost" onclick="window.close()">Close</button>
        </div>
        <div class="card">
          <div class="card-header">
            <div>
              <div class="logo"><span class="star">★</span> BLACK STARS</div>
              <div class="sub">Sports Club · Waab, Doha</div>
            </div>
            <span class="status-pill" style="background:${statusColor}">${status.toUpperCase()}</span>
          </div>
          <div class="body">
            <div class="avatar">${initials(m.name)}</div>
            <div class="info">
              <div class="name">${escapeHtml(m.name)}</div>
              <div class="meta">${escapeHtml(primarySport)}${sports.length > 1 ? ` +${sports.length - 1}` : ''}${coach !== '—' ? ' · Coach ' + escapeHtml(coach) : ''}</div>
              <div class="meta">${m.expiryDate ? 'Valid until ' + fmtDate(m.expiryDate) : 'No expiry on file'}</div>
              ${m.phone && !m.phone.startsWith('+9747000') ? `<div class="meta">📱 ${escapeHtml(m.phone)}</div>` : ''}
            </div>
          </div>
          <div class="footer">
            <span>MEMBER #${String(m.id).padStart(5, '0')}</span>
            ${m.qid ? `<span class="barcode">${escapeHtml(m.qid)}</span>` : `<span style="opacity:.5">no QID</span>`}
          </div>
        </div>
      </div>
    </body></html>
  `);
  w.document.close();
};

// ─── Invoice PDF (uses browser's "Save as PDF" via print dialog) ────────
window.printInvoicePDF = function(id) {
  const inv = state.invoices.find(x => x.id === id);
  if (!inv) { toast('Invoice not found', 'error'); return; }

  // Prefer explicit invoice fields (stored), fall back to name matching from description
  let matchedMember = inv.customerId ? state.members.find(m => m.id === inv.customerId) : null;
  const descLower = (inv.description || '').toLowerCase();

  if (!matchedMember) {
    // First, try direct name matching against known members
    const sortedMembers = [...state.members].sort((a, b) => (b.name || '').length - (a.name || '').length);
    for (const m of sortedMembers) {
      const fullLower = (m.name || '').toLowerCase().trim();
      if (!fullLower || fullLower.length < 3) continue;
      if (descLower.includes(fullLower)) {
        matchedMember = m;
        break;
      }
      const firstTwo = fullLower.split(/\s+/).slice(0, 2).join(' ');
      if (firstTwo.length >= 4 && descLower.includes(firstTwo)) {
        matchedMember = m;
        break;
      }
    }
    if (!matchedMember) {
      const SKIP_WORDS = new Set(['the','and','for','book','booking','coach','class','classes','football','footbal','foot','swim','swimming','box','boxing','kick','mma','karate','gym','gymnastic','taekwondo','session','sessions','student']);
      for (const m of sortedMembers) {
        const firstName = (m.name || '').toLowerCase().split(/\s+/)[0];
        if (!firstName || firstName.length < 4 || SKIP_WORDS.has(firstName)) continue;
        const wordRe = new RegExp(`\\b${firstName}\\b`, 'i');
        if (wordRe.test(descLower)) {
          matchedMember = m;
          break;
        }
      }
    }
  }

  // Customer name — prefer live member info via customerInfo(), then matched
  // (description-derived) member, then cleaned description text as fallback.
  const liveCust = customerInfo(inv);
  let customerName, customerPhone = null;
  if (liveCust.name) {
    customerName = liveCust.name;
    customerPhone = liveCust.phone;
  } else if (matchedMember) {
    customerName = matchedMember.name;
    customerPhone = matchedMember.phone;
  } else {
    const cleaned = (inv.description || '')
      .replace(/\b(football|footbal|swim|swimming|boxing|box|kick|kickboxing|kickbox|mma|karate|gym|gymnastic|taekwondo|taekwando|session|sessions|class|classes|book|booking|bk|bok|bka|coach)\b/gi, '')
      .replace(/\b\d+\s*(cls|classes|sessions?|x|\*\d+)?\b/gi, '')
      .replace(/[\*\(\)]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    customerName = cleaned ? cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Walk-in Customer';
  }

  const ref = inv.ref || `INV-${String(inv.id).padStart(5,'0')}`;
  const issueDate = fmtDate(inv.date);
  const amountStr = Number(inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Filename-safe customer name (strips slashes/punctuation that browsers reject in filenames)
  const fileName = (customerName || 'Invoice')
    .replace(/[\/\\:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Invoice';
  const amountWords = numberToWords(Math.round(inv.amount));

  // Build a cleaner line-item label: strip the customer name out of the description so it doesn't repeat
  let itemLabel = inv.description || 'Service';
  if (matchedMember) {
    const nameLow = matchedMember.name.toLowerCase();
    // Try to remove full name first, then individual words of the name (case-insensitive, word-boundary)
    let cleaned = itemLabel.toLowerCase();
    cleaned = cleaned.replace(new RegExp(`\\b${nameLow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '');
    // Also remove each word of the matched name individually (handles "anas madani" → also strips just "anas")
    for (const word of nameLow.split(/\s+/)) {
      if (word.length >= 3) cleaned = cleaned.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
    }
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    itemLabel = cleaned || `${matchedMember.sport} subscription`;
    // Title-case
    itemLabel = itemLabel.split(' ').filter(w => w).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  } else {
    // No member match — keep as-is but title-case
    itemLabel = itemLabel.split(' ').filter(w => w).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(fileName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 15mm; }
  body {
    font-family: -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    color: #1a1a1a;
    background: #fff;
    line-height: 1.5;
    padding: 30px;
    max-width: 800px;
    margin: 0 auto;
  }

  /* Header */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #f26060;
    padding-bottom: 24px;
    margin-bottom: 32px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .logo {
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, #f26060 0%, #f2a33c 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    color: #fff;
    flex-shrink: 0;
  }
  .brand-info h1 {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -.3px;
    color: #1a1a1a;
  }
  .brand-info .tagline {
    font-size: 11px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: .8px;
    margin-top: 2px;
  }
  .header-right {
    text-align: right;
  }
  .invoice-label {
    font-size: 10px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 600;
  }
  .invoice-no {
    font-size: 18px;
    font-weight: 700;
    color: #f26060;
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    margin-top: 2px;
  }
  .invoice-date {
    font-size: 12px;
    color: #555;
    margin-top: 6px;
  }

  /* Bill To / From */
  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    margin-bottom: 36px;
  }
  .party-label {
    font-size: 10px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 600;
    margin-bottom: 6px;
  }
  .party-name {
    font-size: 15px;
    font-weight: 700;
    color: #1a1a1a;
    margin-bottom: 2px;
  }
  .party-detail {
    font-size: 12px;
    color: #555;
    line-height: 1.6;
  }

  /* Items table */
  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 24px;
  }
  .items-table thead th {
    background: #f7f7f8;
    padding: 12px 16px;
    text-align: left;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .6px;
    color: #555;
    font-weight: 600;
    border-bottom: 2px solid #e5e5ea;
  }
  .items-table thead th.right { text-align: right; }
  .items-table tbody td {
    padding: 16px;
    border-bottom: 1px solid #e5e5ea;
    font-size: 13px;
    color: #1a1a1a;
  }
  .items-table tbody td.right { text-align: right; }
  .item-desc {
    font-weight: 600;
    margin-bottom: 4px;
  }
  .item-sub {
    font-size: 11px;
    color: #888;
  }

  /* Total */
  .totals {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 32px;
  }
  .totals-table {
    min-width: 280px;
  }
  .totals-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    font-size: 13px;
  }
  .totals-row.grand {
    border-top: 2px solid #1a1a1a;
    margin-top: 8px;
    padding-top: 14px;
    font-size: 18px;
    font-weight: 700;
  }
  .totals-row.grand .amount {
    color: #f26060;
  }

  /* Payment info */
  .payment-info {
    background: #f7f7f8;
    border-radius: 10px;
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32px;
  }
  .payment-status {
    display: inline-block;
    padding: 4px 12px;
    background: #d1fae5;
    color: #065f46;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .5px;
  }
  .payment-method {
    font-size: 12px;
    color: #555;
  }
  .payment-method strong {
    color: #1a1a1a;
    text-transform: capitalize;
  }

  /* Amount in words */
  .amount-words {
    background: #fffbeb;
    border-left: 3px solid #f2a33c;
    padding: 10px 16px;
    margin-bottom: 32px;
    font-size: 12px;
    color: #78350f;
    font-style: italic;
  }
  .amount-words strong {
    font-style: normal;
    color: #1a1a1a;
  }

  /* Terms & Conditions */
  .terms {
    margin-top: 28px;
    padding: 20px 24px;
    background: #fafafa;
    border-radius: 10px;
    border: 1px solid #e5e5ea;
    page-break-inside: avoid;
  }
  .terms-heading {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #1a1a1a;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .terms-heading span:last-child {
    font-weight: 600;
  }
  .terms-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .terms-col h4 {
    font-size: 10px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: .8px;
    margin-bottom: 8px;
    font-weight: 700;
  }
  .terms-col ol {
    list-style: none;
    counter-reset: term;
    padding: 0;
    margin: 0;
  }
  .terms-col li {
    counter-increment: term;
    font-size: 10.5px;
    color: #444;
    line-height: 1.55;
    margin-bottom: 5px;
    padding-left: 18px;
    position: relative;
  }
  .terms-col li::before {
    content: counter(term) ".";
    position: absolute;
    left: 0;
    font-weight: 700;
    color: #f26060;
  }
  .terms-col.ar { direction: rtl; text-align: right; }
  .terms-col.ar li { padding-left: 0; padding-right: 18px; }
  .terms-col.ar li::before { left: auto; right: 0; }

  /* Footer */
  .footer {
    border-top: 1px solid #e5e5ea;
    padding-top: 20px;
    text-align: center;
    font-size: 11px;
    color: #888;
    line-height: 1.7;
  }
  .footer .thanks {
    font-size: 13px;
    color: #1a1a1a;
    font-weight: 600;
    margin-bottom: 4px;
  }

  /* Print button (hidden when printing) */
  .print-btn-wrap {
    text-align: center;
    margin: 30px 0 0;
  }
  .print-btn {
    background: #f26060;
    color: #fff;
    border: none;
    padding: 12px 32px;
    font-size: 14px;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    margin: 0 6px;
  }
  .print-btn.secondary {
    background: #e5e5ea;
    color: #1a1a1a;
  }
  .hint {
    color: #888;
    font-size: 11px;
    margin-top: 12px;
  }
  @media print {
    body { padding: 0; }
    .print-btn-wrap, .hint { display: none !important; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="logo">★</div>
      <div class="brand-info">
        <h1>Black Stars Sports Club</h1>
        <div class="tagline">Waab · Village Resort · Doha · Qatar</div>
      </div>
    </div>
    <div class="header-right">
      <div class="invoice-label">Invoice</div>
      <div class="invoice-no">${escapeHtml(ref)}</div>
      <div class="invoice-date">Issued ${issueDate}</div>
    </div>
  </div>

  <div class="parties">
    <div>
      <div class="party-label">From</div>
      <div class="party-name">Black Stars Sports Club</div>
      <div class="party-detail">
        Waab — Village Resort, Doha, Qatar<br>
        blackstarssportsclub@gmail.com<br>
        Tel: +974 3040 0103
      </div>
    </div>
    <div>
      <div class="party-label">Billed to</div>
      <div class="party-name">${escapeHtml(customerName)}</div>
      <div class="party-detail">
        ${customerPhone && !customerPhone.startsWith('+9747000') ? escapeHtml(customerPhone) + '<br>' : ''}
        ${liveCust.isMember && liveCust.qid ? 'QID: ' + escapeHtml(liveCust.qid) + '<br>' : (matchedMember && matchedMember.qid ? 'QID: ' + escapeHtml(matchedMember.qid) + '<br>' : '')}
        ${liveCust.nationality ? '🌍 ' + escapeHtml(liveCust.nationality) : ''}
      </div>
    </div>
  </div>

  <!-- Activity + Coach badges -->
  ${(inv.sport || inv.coach) ? `
  <div style="display:flex;gap:20px;margin-bottom:24px;padding:14px 20px;background:#f7f7f8;border-radius:10px">
    ${inv.sport ? `
      <div>
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:4px">Activity</div>
        <div style="font-size:14px;font-weight:700;color:#1a1a1a">${escapeHtml(inv.sport)}</div>
      </div>` : ''}
    ${inv.coach ? `
      <div>
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:4px">Coach</div>
        <div style="font-size:14px;font-weight:700;color:#1a1a1a">${escapeHtml(inv.coach)}</div>
      </div>` : ''}
    <div style="margin-left:auto">
      <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:4px">Period</div>
      <div style="font-size:14px;font-weight:700;color:#1a1a1a">${escapeHtml(fmtMonth(inv.month))}</div>
    </div>
  </div>
  ` : ''}

  <table class="items-table">
    <thead>
      <tr>
        <th>Description</th>
        <th class="right" style="width:90px">Qty</th>
        <th class="right" style="width:130px">Amount (QAR)</th>
      </tr>
    </thead>
    <tbody>
      ${(inv.lineItems && inv.lineItems.length) ? inv.lineItems.map(li => `
      <tr>
        <td>
          <div class="item-desc">${escapeHtml(li.sport)} subscription</div>
          <div class="item-sub">Coach: ${escapeHtml(li.coach || '—')} · Issued on ${issueDate}</div>
        </td>
        <td class="right">${li.classes || 1}</td>
        <td class="right">${Number(li.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>`).join('') : `
      <tr>
        <td>
          <div class="item-desc">${escapeHtml(itemLabel)}</div>
          <div class="item-sub">Issued on ${issueDate}</div>
        </td>
        <td class="right">1</td>
        <td class="right">${amountStr}</td>
      </tr>`}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-table">
      <div class="totals-row">
        <span>Subtotal</span>
        <span>${amountStr} QAR</span>
      </div>
      <div class="totals-row">
        <span>Tax (0%)</span>
        <span>0.00 QAR</span>
      </div>
      <div class="totals-row grand">
        <span>Total</span>
        <span class="amount">${amountStr} QAR</span>
      </div>
      ${invoiceBalance(inv) > 0.001 ? `
      <div class="totals-row">
        <span>Paid${inv.amountPaid > 0 ? '' : ' (deposit)'}</span>
        <span>${Number(invoicePaid(inv)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} QAR</span>
      </div>
      <div class="totals-row grand" style="color:#b45309">
        <span>Balance due</span>
        <span class="amount">${Number(invoiceBalance(inv)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} QAR</span>
      </div>` : ''}
    </div>
  </div>

  <div class="amount-words">
    <strong>Amount in words:</strong> ${escapeHtml(amountWords)} Qatari Riyals only.
  </div>

  <div class="payment-info">
    <div>
      ${(() => {
        const st = invoiceStatus(inv);
        if (st === 'Paid') return `<span class="payment-status">✓ Paid</span>`;
        if (st === 'Unpaid') return `<span class="payment-status" style="background:#fee2e2;color:#991b1b">● Unpaid — ${Number(invoiceBalance(inv)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} QAR due</span>`;
        return `<span class="payment-status" style="background:#fef3c7;color:#92400e">◐ Partially paid — ${Number(invoiceBalance(inv)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} QAR due</span>`;
      })()}
    </div>
    <div class="payment-method">
      Payment method: <strong>${escapeHtml(inv.method || 'Cash')}</strong>
    </div>
  </div>

  <div class="terms">
    <div class="terms-heading">
      <span>Terms &amp; Conditions</span>
      <span>الشروط والأحكام</span>
    </div>
    <div class="terms-grid">
      <div class="terms-col">
        <h4>English</h4>
        <ol>
          <li>All payments are non-refundable.</li>
          <li>Classes must be completed within the package validity period.</li>
          <li>Missed classes without prior notice will be counted.</li>
          <li>Students must arrive on time and follow coach instructions.</li>
          <li>The academy is not responsible for injuries resulting from failure to follow safety instructions.</li>
          <li>Each participant is entitled to two compensation classes — maximum limit.</li>
        </ol>
      </div>
      <div class="terms-col ar">
        <h4>عربي</h4>
        <ol>
          <li>جميع المدفوعات غير قابلة للاسترداد.</li>
          <li>يجب إكمال جميع الحصص خلال فترة صلاحية الباقة.</li>
          <li>سيتم احتساب الحصص الفائتة دون إشعار مسبق.</li>
          <li>يجب على الطالب الحضور في الوقت المحدد واتباع تعليمات المدرب.</li>
          <li>الأكاديمية غير مسؤولة عن الإصابات الناتجة عن عدم اتباع تعليمات السلامة.</li>
          <li>لكل مشترك حصتان تعويضيتان كحد أقصى.</li>
        </ol>
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="thanks">Thank you for choosing Black Stars Sports Club!</div>
    <div>For any questions about this invoice, contact us at blackstarssportsclub@gmail.com · +974 3040 0103</div>
    <div style="margin-top:10px;font-size:10px">This invoice was generated on ${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</div>
  </div>

  <div class="print-btn-wrap">
    <button class="print-btn" onclick="exportPdf()">⬇ Export PDF</button>
    <button class="print-btn secondary" onclick="window.print()">🖨 Print</button>
    <button class="print-btn secondary" onclick="window.close()">Close</button>
    <div class="hint">"Export PDF" opens the save dialog — the file is named after the customer. Choose "Save as PDF" as the destination.</div>
  </div>

  <script>
    // The document title is the customer name, so the browser's
    // "Save as PDF" dialog pre-fills the filename with it.
    function exportPdf() {
      // Ensure the title (filename) is the customer name at print time
      document.title = ${JSON.stringify(fileName)};
      window.print();
    }
    // Keyboard shortcut
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); exportPdf(); }
    });
  </script>
</body>
</html>`;

  // Open in a new window
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    toast('Pop-up blocked. Please allow pop-ups for this site.', 'error');
    URL.revokeObjectURL(url);
    return;
  }
  // Clean up the blob URL after a delay (window keeps reference)
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  toast(`Invoice opened — click "Export PDF" to save as ${fileName}.pdf`);
};

// ─── Send invoice to customer via WhatsApp ──────────────────────────
// Pre-fills a WhatsApp message with the invoice details (ref, items, total)
// at the customer's phone number. Admin reviews the message before sending.
// Note: WhatsApp's URL scheme doesn't allow file attachments from web apps —
// this sends a TEXT message that includes everything the customer needs.
window.sendInvoiceWhatsApp = function(id) {
  const inv = state.invoices.find(x => x.id === id);
  if (!inv) { toast('Invoice not found', 'error'); return; }

  // Resolve customer + phone
  const cust = customerInfo(inv);
  const phone = cust.phone || (inv.customerId
    ? state.members.find(m => m.id === inv.customerId)?.phone
    : null);
  if (!isRealPhone(phone)) {
    toast('Customer has no phone number on file', 'error');
    return;
  }

  // Build a clean text invoice. Limit to lineItems if present, else single line.
  const lines = [];
  lines.push(`*Black Stars Sports Club*`);
  lines.push(`Invoice ${inv.ref || `#${inv.id}`}`);
  lines.push(`Date: ${fmtDate(inv.date)}`);
  lines.push(``);
  if (cust.name) lines.push(`Customer: ${cust.name}`);
  lines.push(``);

  const lineItems = Array.isArray(inv.lineItems) && inv.lineItems.length
    ? inv.lineItems
    : null;
  if (lineItems) {
    lines.push(`*Items:*`);
    for (const li of lineItems) {
      const label = li.durationLabel
        ? `${li.sport} (${li.durationLabel})`
        : `${li.sport}${li.classes ? ' · ' + li.classes + ' classes' : ''}`;
      const coachClean = li.coach ? String(li.coach).replace(/^Coach\s+/i, '') : null;
      const coachPart = coachClean && coachClean !== '—' ? ` · Coach ${coachClean}` : '';
      lines.push(`• ${label}${coachPart} — ${fmt(li.price)} QAR`);
    }
  } else {
    lines.push(`${inv.description || inv.sport || 'Service'} — ${fmt(inv.amount)} QAR`);
  }
  lines.push(``);
  lines.push(`*Total: ${fmt(inv.amount)} QAR*`);
  if (invoiceBalance(inv) > 0.001) {
    lines.push(`Paid: ${fmt(invoicePaid(inv))} QAR`);
    lines.push(`*Balance due: ${fmt(invoiceBalance(inv))} QAR*`);
  }
  if (inv.method) lines.push(`Payment: ${inv.method}`);
  lines.push(``);
  lines.push(`Thank you! 🙏`);
  lines.push(`Black Stars Sports Club · Waab, Doha`);

  const text = lines.join('\n');
  const url = waLink(phone, text);
  if (!url) { toast('Invalid phone number', 'error'); return; }

  // Open WhatsApp with pre-filled message
  window.open(url, '_blank');
  toast(`💬 Opened WhatsApp for ${cust.name || phone}`);
};

// Convert number to English words (for amount in words on invoice)
function numberToWords(num) {
  if (num === 0) return 'Zero';
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

  function convertHundreds(n) {
    let result = '';
    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      result += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0 && n < 20) result += ones[n] + ' ';
    return result.trim();
  }

  if (num < 0) return 'Negative ' + numberToWords(-num);
  let result = '';
  if (num >= 1000000) {
    result += convertHundreds(Math.floor(num / 1000000)) + ' Million ';
    num %= 1000000;
  }
  if (num >= 1000) {
    result += convertHundreds(Math.floor(num / 1000)) + ' Thousand ';
    num %= 1000;
  }
  if (num > 0) result += convertHundreds(num);
  return result.trim();
}

// ─── EXPENSES ──────────────────────────────────────────────────
PAGES.expenses = (main) => {
  let filter = { search: '', month: 'all', category: 'all' };
  const pg = makePager(10);

  function refresh() {
    const allRows = state.expenses.filter(e => {
      if (filter.search && !e.description.toLowerCase().includes(filter.search.toLowerCase())) return false;
      if (filter.month !== 'all' && e.month !== filter.month) return false;
      if (filter.category !== 'all' && e.category !== filter.category) return false;
      return true;
    }).sort((a,b) => b.date.localeCompare(a.date));
    const rows = paginate(allRows, pg);

    const total = allRows.reduce((s,r) => s + (r.amount || 0), 0);
    // Per-category totals — replaces old monthly/equipment split since the
    // Type field is removed. Top 3 categories shown in the subtitle.
    const byCat = {};
    for (const r of allRows) {
      const c = r.category || 'Others';
      byCat[c] = (byCat[c] || 0) + (r.amount || 0);
    }
    const topCats = Object.entries(byCat).sort((a,b) => b[1] - a[1]).slice(0, 3);
    const topStr = topCats.map(([c, v]) => `${c} ${fmt(v)}`).join(' · ');

    $('#exp-tbody').innerHTML = rows.length ? rows.map(e => `
      <tr>
        <td class="text-dim" style="white-space:nowrap">${fmtDate(e.date)}</td>
        <td>${escapeHtml(e.description)}</td>
        <td><span class="badge">${escapeHtml(e.category || 'Others')}</span></td>
        <td><span class="badge ${e.method === 'card' ? 'blue' : e.method === 'transfer' ? 'cyan' : ''}">${escapeHtml(e.method || '—')}</span></td>
        <td class="text-right num font-bold">${fmt(e.amount)}</td>
        <td class="text-right" style="white-space:nowrap"><button class="btn ghost sm" onclick="editExpense(${e.id})" title="Edit">✏️</button> <button class="btn ghost sm" onclick="deleteExpense(${e.id})" title="Delete">🗑</button></td>
      </tr>
    `).join('') : `<tr><td colspan="6" class="empty"><div class="empty-icon">💸</div>No expenses match</td></tr>`;
    $('#exp-count').textContent = `${allRows.length} entries · ${fmtMoney(total)}${topStr ? ' · ' + topStr : ''}`;
    $('#exp-pagination').innerHTML = paginationBar(pg, allRows.length, 'exp');
    bindPagination('exp', pg, allRows.length, refresh);
  }

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Expenses</h1>
        <div class="subtitle"><span id="exp-count">Loading...</span></div>
      </div>
      <div class="topbar-actions">
        <button class="btn primary" id="add-exp">+ New Expense</button>
      </div>
    </div>
    <div class="card">
      <div class="filter-bar">
        <div class="search"><input id="exp-search" type="text" placeholder="Search description..." /></div>
        <select id="exp-month" class="btn ghost">
          <option value="all">All months</option>
          ${[...new Set(state.expenses.map(e => e.month).filter(Boolean))].sort().reverse().map(m => `<option value="${m}">${fmtMonth(m)}</option>`).join('')}
        </select>
        <select id="exp-cat" class="btn ghost">
          <option value="all">All categories</option>
          ${EXP_CATS.map(c => `<option>${escapeHtml(c)}</option>`).join('')}
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Method</th><th class="text-right">Amount</th><th></th></tr></thead>
          <tbody id="exp-tbody"></tbody>
        </table>
      </div>
      <div id="exp-pagination"></div>
    </div>
  `;
  $('#exp-search').addEventListener('input', e => { filter.search = e.target.value; pg.page = 1; refresh(); });
  $('#exp-month').addEventListener('change', e => { filter.month = e.target.value; pg.page = 1; refresh(); });
  $('#exp-cat').addEventListener('change', e => { filter.category = e.target.value; pg.page = 1; refresh(); });
  $('#add-exp').addEventListener('click', addExpense);
  refresh();
};

function addExpense() { showExpenseForm(null); }
window.editExpense = function(id) { showExpenseForm(id); };

function showExpenseForm(id) {
  const e = id ? state.expenses.find(x => x.id === id) : null;
  const isNew = !e;
  // Default to first available category if creating fresh; preserve existing on edit
  const cur = e || { description:'', amount:'', category: '', method:'', date: TODAY };
  const cats = EXP_CATS;
  showModal({
    title: isNew ? 'New Expense' : 'Edit Expense',
    body: `
      <div class="field"><label>Description <span style="color:var(--accent)">*</span></label><input id="f-desc" value="${escapeHtml(cur.description || '')}" placeholder="What was this expense for?" /></div>
      <div class="form-row">
        <div class="field"><label>Amount (QAR) <span style="color:var(--accent)">*</span></label><input id="f-amt" type="number" min="0" step="0.01" value="${cur.amount ?? ''}" placeholder="0.00" /></div>
        <div class="field"><label>Category <span style="color:var(--accent)">*</span></label>
          <select id="f-cat">
            <option value="" ${!cur.category ? 'selected' : ''}>— pick a category —</option>
            ${cats.map(c => `<option value="${escapeHtml(c)}" ${c === cur.category ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
          </select>
          <div class="text-mute" style="font-size:10px;margin-top:3px">Manage categories from System → Settings</div>
        </div>
      </div>
      <div class="form-row">
        <div class="field"><label>Date <span style="color:var(--accent)">*</span></label><input id="f-date" type="date" value="${cur.date || TODAY}" /></div>
        <div class="field"><label>Payment method <span style="color:var(--accent)">*</span></label>
          <select id="f-method">
            <option value="" ${!cur.method ? 'selected' : ''}>— pick a method —</option>
            <option value="cash" ${cur.method === 'cash' ? 'selected' : ''}>Cash</option>
            <option value="card" ${cur.method === 'card' ? 'selected' : ''}>Card</option>
            <option value="transfer" ${cur.method === 'transfer' ? 'selected' : ''}>Bank transfer</option>
          </select>
        </div>
      </div>
    `,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: isNew ? 'Add' : 'Save', class: 'btn primary', onclick: () => {
        // ── Full validation: every field is mandatory ─────────────
        const desc = $('#f-desc').value.trim();
        const amtRaw = $('#f-amt').value.trim();
        const amt = parseFloat(amtRaw);
        const category = $('#f-cat').value;
        const method = $('#f-method').value;
        const date = $('#f-date').value;
        if (!desc) { toast('Description is required', 'error'); $('#f-desc')?.focus(); return; }
        if (!amtRaw || isNaN(amt) || amt <= 0) { toast('Amount must be greater than 0', 'error'); $('#f-amt')?.focus(); return; }
        if (!category) { toast('Category is required', 'error'); $('#f-cat')?.focus(); return; }
        if (!method) { toast('Payment method is required', 'error'); $('#f-method')?.focus(); return; }
        if (!date) { toast('Date is required', 'error'); $('#f-date')?.focus(); return; }

        const data = {
          date, description: desc, amount: amt,
          category, method,
          month: date.slice(0, 7),
        };
        if (isNew) {
          state.expenses.push({ id: nextId(state.expenses), ...data });
          toast('Expense added');
        } else {
          // Preserve any legacy fields like `classification` from older data
          Object.assign(e, data);
          toast('Expense updated');
        }
        save();
        closeModal();
        render();
      }},
    ],
  });
}

window.deleteExpense = function(id) {
  if (!confirm('Delete this expense?')) return;
  state.expenses = state.expenses.filter(e => e.id !== id);
  save();
  render();
  toast('Expense deleted');
};

// ─── SALARIES ──────────────────────────────────────────────────
// ─── PAYROLL / SALARIES ───────────────────────────────────────────────
// Salaries are NOT manually entered records anymore. They are COMPUTED
// every time you open the page, from:
//   - each coach/staff's fixedSalary (set on the Coaches page)
//   - each coach/staff's commission rate × their membership revenue this month
// What admin tracks here:
//   - Advances given during the month (deducted from net)
//   - Paid date when payroll is processed
//   - Pay-slip generation (PDF + WhatsApp text)
// state.salaries[] now stores lightweight rows:
//   { id, coachId, month, kind: 'advance'|'paid', amount?, paidDate?, note? }

PAGES.salaries = (main) => {
  let filter = { month: latestDataMonth() || currentMonth(), settleDate: null };

  function refresh() {
    // Compute pay rows for every active coach/staff — either for the selected
    // month, or (if a settlement date is set) up to and including that date.
    const upto = filter.settleDate || null;
    const people = (state.coaches || [])
      .filter(c => isCoachActive(c))
      .map(c => upto ? computeMonthlyPay(c.id, null, upto) : computeMonthlyPay(c.id, filter.month))
      .filter(p => p) // skip any null
      // Sort: pending first, then by amount desc
      .sort((a, b) => {
        if (a.paidStatus !== b.paidStatus) return a.paidStatus === 'pending' ? -1 : 1;
        return b.gross - a.gross;
      });

    const totalGross = people.reduce((s,p) => s + p.gross, 0);
    const totalAdv = people.reduce((s,p) => s + p.advance, 0);
    const totalNet = people.reduce((s,p) => s + p.net, 0);
    const paidCount = people.filter(p => p.paidStatus === 'paid').length;

    $('#sal-tbody').innerHTML = people.length ? people.map(p => {
      const isStaff = p.role === 'staff';
      const breakdown = [];
      if (p.fixed > 0) breakdown.push(`Fixed ${fmt(p.fixed)}${p.uptoDate && p.fixedFull !== p.fixed ? ` (prorated from ${fmt(p.fixedFull)})` : ''}`);
      if (p.commissionRate > 0) {
        breakdown.push(`${p.commissionRate}% × ${fmt(p.commissionBase)} = ${fmt(p.commissionAmount)}`);
      }
      const breakdownStr = breakdown.join(' + ') || '—';
      const pendingNote = (p.basis === 'attendance' && p.commissionPending > 0)
        ? `<div style="color:var(--accent-2);margin-top:2px">⏳ ${fmt(p.commissionPending)} pending — paid as attended, or stays with the club if they leave</div>`
        : '';
      const netNegative = p.net < 0;
      const grossNegative = p.gross < 0;
      const netColor = netNegative ? 'var(--red)' : 'var(--green)';
      const grossColor = grossNegative ? 'var(--red)' : 'var(--text)';
      return `
        <tr>
          <td>
            <div class="font-bold">${escapeHtml(p.name)}${netNegative ? ' <span class="badge" style="background:rgba(242,96,96,.15);color:var(--red);font-size:9px;padding:1px 6px" title="Net pay is negative — admin should reconcile">⚠️ NEGATIVE</span>' : ''}</div>
            <div class="text-mute" style="font-size:10px">${isStaff ? '👔 Staff' : '🥋 Coach'} · ${p.uptoDate ? 'up to ' + fmtDate(p.uptoDate) : fmtMonth(p.month)}</div>
          </td>
          <td class="text-mute" style="font-size:11px">${breakdownStr}${pendingNote}</td>
          <td class="text-right num font-bold" style="color:${grossColor}">${fmt(p.gross)}</td>
          <td class="text-right">
            <button class="btn ghost sm" onclick="recordAdvance(${p.coachId}, '${p.month}')" title="Record an advance">
              ${p.advance > 0 ? `<span style="color:var(--accent-2)">${fmt(p.advance)}</span>` : '+ Add'}
            </button>
          </td>
          <td class="text-right num font-bold" style="color:${netColor}">${fmt(p.net)}</td>
          <td>
            ${p.paidStatus === 'paid'
              ? `<span class="badge active">Paid ${fmtDate(p.paidDate)}</span>`
              : '<span class="badge">Pending</span>'}
          </td>
          <td class="text-right" style="white-space:nowrap">
            <button class="btn ${p.paidStatus === 'paid' ? 'ghost' : 'primary'} sm" onclick="markPaid(${p.coachId}, '${p.month}')" title="${p.paidStatus === 'paid' ? 'Unmark / change date' : 'Mark as paid'}">
              ${p.paidStatus === 'paid' ? '✓' : '💰 Pay'}
            </button>
            <button class="btn ghost sm" onclick="showPayslip(${p.coachId}, '${p.month}')" title="Pay slip (PDF summary)">📄</button>
            <button class="btn ghost sm" onclick="showRevenueDetail(${p.coachId}, '${p.month}')" title="Revenue detail report (every member + sport)">📊</button>
            ${p.commissionRate > 0 ? `<button class="btn ghost sm" onclick="manageCoachStudents(${p.coachId})" title="Include / exclude students from this coach's commission">👥${salaryExclusionSet(p.coachId).size ? `<span style="color:var(--accent-2);font-weight:700"> ${salaryExclusionSet(p.coachId).size}</span>` : ''}</button>` : ''}
          </td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="7" class="empty">No active coaches/staff. Add them on the Team page.</td></tr>`;

    const foot = $('#sal-tfoot');
    if (foot) {
      foot.innerHTML = people.length ? `
        <tr style="border-top:2px solid var(--border);font-weight:700">
          <td>TOTAL · ${people.length} ${people.length === 1 ? 'person' : 'people'}</td>
          <td></td>
          <td class="text-right num">${fmt(totalGross)}</td>
          <td class="text-right num text-dim">${totalAdv > 0 ? fmt(totalAdv) : '—'}</td>
          <td class="text-right num" style="color:var(--green);font-size:15px">${fmt(totalNet)}</td>
          <td colspan="2" class="text-mute" style="font-size:11px">${paidCount} of ${people.length} paid</td>
        </tr>` : '';
    }
    $('#sal-count').textContent = filter.settleDate
      ? `${people.length} active · ${fmtMoney(totalNet)} net · settlement up to ${fmtDate(filter.settleDate)} · ${paidCount} paid`
      : `${people.length} active · ${fmtMoney(totalNet)} net payroll for ${fmtMonth(filter.month)} · ${paidCount} paid`;
  }

  // Generate the month list — include current and future so admin can pre-set
  const months = availableMonths({ includeFuture: true });
  if (!months.includes(filter.month)) months.unshift(filter.month);

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Salaries & Commissions</h1>
        <div class="subtitle"><span id="sal-count">Loading...</span></div>
      </div>
      <div class="topbar-actions">
        <button class="btn ghost" onclick="navigate('coaches')" title="Set fixed salaries + commission rates per person">⚙️ Configure on Team page</button>
        <button class="btn primary" onclick="downloadPayrollCSV('${filter.month}')">📥 Export payroll</button>
      </div>
    </div>
    <div style="background:rgba(91,141,239,.06);border:1px solid rgba(91,141,239,.2);border-radius:8px;padding:12px;margin-bottom:14px;display:flex;gap:10px;align-items:flex-start">
      <div style="font-size:20px">💡</div>
      <div style="font-size:12px;color:var(--text-dim);line-height:1.5">
        Salaries are computed automatically: <b>Fixed monthly</b> (set per person on the Team page) + <b>Commission %</b> × eligible membership revenue.
        Use this page to record advances and mark people as paid. The Team page is where you set each person's pay configuration.
      </div>
    </div>
    <div class="card">
      <div class="filter-bar" style="flex-wrap:wrap;align-items:center;gap:10px">
        <span style="font-size:12px;color:var(--text-mute)">Commission basis:</span>
        <select id="sal-basis" class="btn ghost" title="How commission is calculated. 'By attendance' pays per class the member attends; the rest is pending.">
          <option value="payment" ${(state.settings?.commissionBasis || 'payment') === 'payment' ? 'selected' : ''}>By payment (full fee in payment month)</option>
          <option value="attendance" ${state.settings?.commissionBasis === 'attendance' ? 'selected' : ''}>By attendance (per class attended)</option>
        </select>
        <span style="opacity:.35">|</span>
        <select id="sal-month" class="btn ghost" ${filter.settleDate ? 'disabled style="opacity:.5"' : ''}>
          ${months.map(m => `<option value="${m}" ${filter.month === m ? 'selected' : ''}>${fmtMonth(m)}</option>`).join('')}
        </select>
        <span style="font-size:12px;color:var(--text-mute)">or settle up to:</span>
        <input type="date" id="sal-date" class="btn ghost" value="${filter.settleDate || ''}" title="Calculate pay up to this date — e.g. a coach's last working day. Clear it to go back to the whole month." />
        <span id="sal-mode-note" style="font-size:11px;color:var(--accent-2);font-weight:600">${filter.settleDate ? '📅 Settlement — month up to ' + fmtDate(filter.settleDate) + ' only' : ''}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Name</th>
            <th>Breakdown</th>
            <th class="text-right">Gross (QAR)</th>
            <th class="text-right">Advance</th>
            <th class="text-right">Net Pay</th>
            <th>Status</th>
            <th></th>
          </tr></thead>
          <tbody id="sal-tbody"></tbody>
          <tfoot id="sal-tfoot"></tfoot>
        </table>
      </div>
    </div>
  `;
  $('#sal-month').addEventListener('change', e => { filter.month = e.target.value; refresh(); });
  const salBasis = $('#sal-basis');
  if (salBasis) salBasis.addEventListener('change', e => {
    if (!state.settings) state.settings = {};
    state.settings.commissionBasis = e.target.value === 'attendance' ? 'attendance' : 'payment';
    save();
    refresh();
    toast('Commission basis: ' + (state.settings.commissionBasis === 'attendance' ? 'by attendance ✅' : 'by payment'));
  });
  const salDate = $('#sal-date');
  if (salDate) salDate.addEventListener('change', e => {
    filter.settleDate = e.target.value || null;
    const sel = $('#sal-month');
    if (sel) { sel.disabled = !!filter.settleDate; sel.style.opacity = filter.settleDate ? '.5' : ''; }
    const note = $('#sal-mode-note');
    if (note) note.textContent = filter.settleDate ? '📅 Settlement — month up to ' + fmtDate(filter.settleDate) + ' only' : '';
    refresh();
  });
  refresh();
};

// Record (or edit) an advance for a specific person+month
window.recordAdvance = function(coachId, monthKey) {
  const c = state.coaches.find(x => x.id === coachId);
  if (!c) return;
  const existing = (state.salaries || []).find(s => s.coachId === coachId && s.month === monthKey && s.kind === 'advance');
  const cur = existing || { amount: 0, note: '', paidDate: TODAY };
  showModal({
    title: `Record advance · ${c.name} · ${fmtMonth(monthKey)}`,
    body: `
      <div class="text-mute" style="font-size:12px;margin-bottom:10px">Advances are deducted from this person's net pay for the selected month.</div>
      <div class="form-row">
        <div class="field"><label>Advance amount (QAR)</label><input id="adv-amount" type="number" min="0" step="0.01" value="${cur.amount || 0}" /></div>
        <div class="field"><label>Date given</label><input id="adv-date" type="date" value="${cur.paidDate || TODAY}" /></div>
      </div>
      <div class="field"><label>Note (optional)</label><input id="adv-note" value="${escapeHtml(cur.note || '')}" placeholder="e.g. Emergency advance" /></div>
      ${existing ? `<div style="margin-top:10px"><button type="button" class="btn ghost sm" onclick="deleteAdvance(${existing.id})" style="color:var(--red)">🗑 Delete this advance</button></div>` : ''}
    `,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: 'Save advance', class: 'btn primary', onclick: () => {
        const amt = parseFloat($('#adv-amount').value) || 0;
        if (amt < 0) { toast('Amount must be ≥ 0', 'error'); return; }
        const note = $('#adv-note').value.trim();
        const paidDate = $('#adv-date').value || TODAY;
        if (existing) {
          if (amt === 0) {
            state.salaries = state.salaries.filter(s => s.id !== existing.id);
            audit('salary.advance_removed', `coach:${coachId}`,
              `Removed advance for ${c.name} · ${fmtMonth(monthKey)}`,
              { coachId, month: monthKey });
          } else {
            Object.assign(existing, { amount: amt, note, paidDate });
            audit('salary.advance', `coach:${coachId}`,
              `Updated advance ${fmt(amt)} QAR for ${c.name} · ${fmtMonth(monthKey)}`,
              { coachId, month: monthKey, amount: amt });
          }
        } else if (amt > 0) {
          state.salaries.push({
            id: nextId(state.salaries),
            coachId, month: monthKey, kind: 'advance',
            amount: amt, note, paidDate,
          });
          audit('salary.advance', `coach:${coachId}`,
            `Recorded advance ${fmt(amt)} QAR for ${c.name} · ${fmtMonth(monthKey)}`,
            { coachId, month: monthKey, amount: amt });
        }
        save(); closeModal(); render();
        toast(amt > 0 ? `Advance saved (${fmt(amt)} QAR)` : 'Advance removed');
      }},
    ],
  });
};

// Include / exclude individual students from a coach's commission.
window.manageCoachStudents = function(coachId) {
  const c = state.coaches.find(x => x.id === coachId);
  if (!c) return;
  const students = coachStudents(coachId);
  const excluded = salaryExclusionSet(coachId);
  if (!students.length) {
    showModal({
      title: `👥 ${escapeHtml(c.name)} — students`,
      body: `<div class="text-mute" style="font-size:13px">No members currently contribute commission to this coach.</div>`,
      actions: [{ label: 'Close', class: 'btn primary', onclick: closeModal }],
    });
    return;
  }
  showModal({
    title: `👥 ${escapeHtml(c.name)} — commission students`,
    body: `<div style="font-size:13px;line-height:1.6">
        <p class="text-mute">Untick a member to <b>exclude</b> them from this coach's commission (e.g. a comped member or the coach's own child). Excluded members still keep their membership — only this coach's salary changes.</p>
        <div style="display:flex;gap:8px;margin:8px 0">
          <button class="btn ghost sm" id="mcs-all" type="button">Select all</button>
          <button class="btn ghost sm" id="mcs-none" type="button">Exclude all</button>
        </div>
        <div style="max-height:340px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:8px">
          ${students.map(s => `<label style="display:flex;align-items:center;gap:8px;padding:6px 4px;cursor:pointer;border-bottom:1px solid var(--border)">
            <input type="checkbox" class="mcs-cb" value="${s.id}" ${excluded.has(s.id) ? '' : 'checked'}>
            <span style="flex:1">${escapeHtml(s.name)}${s.deleted ? ' <span class="text-mute">(archived)</span>' : ''}</span>
            <span class="text-mute" style="font-size:11px">${s.sports.map(escapeHtml).join(', ')}</span>
          </label>`).join('')}
        </div>
      </div>`,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: 'Save', class: 'btn primary', onclick: () => {
          const excludedIds = $$('.mcs-cb').filter(cb => !cb.checked).map(cb => parseInt(cb.value));
          if (!state.settings) state.settings = {};
          if (!state.settings.salaryExclusions) state.settings.salaryExclusions = {};
          if (excludedIds.length) state.settings.salaryExclusions[coachId] = excludedIds;
          else delete state.settings.salaryExclusions[coachId];
          audit('salary.exclusions', `coach:${coachId}`, `Updated commission exclusions for ${c.name} (${excludedIds.length} excluded)`, { coachId, excluded: excludedIds });
          save(); closeModal(); render();
          toast(excludedIds.length ? `${excludedIds.length} member${excludedIds.length === 1 ? '' : 's'} excluded from ${c.name}'s commission` : `No members excluded from ${c.name}'s commission`);
        } },
    ],
  });
  setTimeout(() => {
    const all = document.getElementById('mcs-all'), none = document.getElementById('mcs-none');
    if (all) all.onclick = () => $$('.mcs-cb').forEach(cb => cb.checked = true);
    if (none) none.onclick = () => $$('.mcs-cb').forEach(cb => cb.checked = false);
  }, 0);
};

window.deleteAdvance = function(id) {
  const adv = (state.salaries || []).find(s => s.id === id);
  if (!confirm(`Delete this advance${adv && adv.amount ? ' of ' + fmt(adv.amount) + ' QAR' : ''}? This cannot be undone.`)) return;
  state.salaries = (state.salaries || []).filter(s => s.id !== id);
  if (adv) {
    const c = state.coaches.find(x => x.id === adv.coachId);
    audit('salary.advance_removed', `coach:${adv.coachId}`,
      `Removed advance${adv.amount ? ' (' + fmt(adv.amount) + ' QAR)' : ''} for ${c ? c.name : 'coach ' + adv.coachId}${adv.month ? ' · ' + fmtMonth(adv.month) : ''}`,
      { coachId: adv.coachId, month: adv.month, amount: adv.amount });
  }
  save(); closeModal(); render();
  toast('Advance removed');
};

// Mark person as paid for the month (or change paid date)
window.markPaid = function(coachId, monthKey) {
  const c = state.coaches.find(x => x.id === coachId);
  if (!c) return;
  const pay = computeMonthlyPay(coachId, monthKey);
  if (!pay) return;
  const existing = (state.salaries || []).find(s => s.coachId === coachId && s.month === monthKey && s.kind === 'paid');
  const cur = existing || { paidDate: TODAY };
  showModal({
    title: `Mark paid · ${c.name} · ${fmtMonth(monthKey)}`,
    body: `
      <div style="background:var(--surface-2);padding:12px;border-radius:8px;margin-bottom:14px;font-size:13px">
        <div style="display:flex;justify-content:space-between;padding:2px 0"><span class="text-mute">Fixed salary</span><span>${fmt(pay.fixed)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:2px 0"><span class="text-mute">Commission (${pay.commissionRate}% × ${fmt(pay.commissionBase)})</span><span>${fmt(pay.commissionAmount)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px solid var(--border);margin-top:4px;font-weight:700"><span>Gross</span><span>${fmt(pay.gross)}</span></div>
        ${pay.advance > 0 ? `<div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--accent-2)"><span class="text-mute">− Advance</span><span>−${fmt(pay.advance)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px solid var(--border);margin-top:4px;font-weight:700;font-size:16px;color:var(--green)"><span>NET PAY</span><span>${fmt(pay.net)}</span></div>
      </div>
      <div class="field"><label>Paid date</label><input id="paid-date" type="date" value="${cur.paidDate}" /></div>
    `,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      ...(existing ? [{ label: 'Mark unpaid', class: 'btn ghost', onclick: () => {
        state.salaries = state.salaries.filter(s => s.id !== existing.id);
        audit('salary.unpaid', `coach:${coachId}`,
          `Marked ${c.name} unpaid for ${fmtMonth(monthKey)}`,
          { coachId, month: monthKey, coachName: c.name });
        save(); closeModal(); render(); toast('Marked as pending');
      }}] : []),
      { label: existing ? 'Update' : '💰 Mark Paid', class: 'btn primary', onclick: () => {
        const paidDate = $('#paid-date').value || TODAY;
        if (existing) {
          existing.paidDate = paidDate;
        } else {
          state.salaries.push({
            id: nextId(state.salaries),
            coachId, month: monthKey, kind: 'paid',
            paidDate,
            // Snapshot the computed values so audits later show what was paid
            snapshotGross: pay.gross, snapshotNet: pay.net,
            snapshotFixed: pay.fixed, snapshotCommission: pay.commissionAmount,
            snapshotCommissionBase: pay.commissionBase,
          });
        }
        audit('salary.paid', `coach:${coachId}`,
          `${existing ? 'Updated payment for' : 'Paid'} ${c.name} · ${fmt(pay.net)} QAR for ${fmtMonth(monthKey)}`,
          { coachId, month: monthKey, coachName: c.name, net: pay.net, gross: pay.gross, advance: pay.advance });
        save(); closeModal(); render(); toast(`${c.name}: ${fmt(pay.net)} QAR marked paid`);
      }},
    ],
  });
};

// Show the pay slip modal: PDF download + WhatsApp text copy
window.showPayslip = function(coachId, monthKey) {
  const c = state.coaches.find(x => x.id === coachId);
  if (!c) return;
  const pay = computeMonthlyPay(coachId, monthKey);
  if (!pay) return;
  const advRows = (state.salaries || []).filter(s => s.coachId === coachId && s.month === monthKey && s.kind === 'advance');

  // Build WhatsApp-ready text
  const waLines = [
    `*Black Stars Sports Club*`,
    `Pay slip — ${fmtMonth(monthKey)}`,
    ``,
    `👤 ${c.name}`,
    `Role: ${c.role === 'staff' ? 'Staff' : 'Coach'}`,
    ``,
  ];
  if (pay.fixed > 0) waLines.push(`Fixed salary: ${fmt(pay.fixed)} QAR`);
  if (pay.commissionRate > 0) waLines.push(`Commission: ${pay.commissionRate}% × ${fmt(pay.commissionBase)} = ${fmt(pay.commissionAmount)} QAR`);
  waLines.push(`Gross: ${fmt(pay.gross)} QAR`);
  if (pay.advance > 0) {
    waLines.push(``);
    waLines.push(`Advances given:`);
    advRows.forEach(a => {
      waLines.push(`  ${fmtDate(a.paidDate)}: ${fmt(a.amount)} QAR${a.note ? ' (' + a.note + ')' : ''}`);
    });
    waLines.push(`Total advance: −${fmt(pay.advance)} QAR`);
  }
  waLines.push(``);
  waLines.push(`*NET PAY: ${fmt(pay.net)} QAR*`);
  if (pay.paidStatus === 'paid') waLines.push(`Paid on ${fmtDate(pay.paidDate)}`);
  const waText = waLines.join('\n');

  showModal({
    title: `Pay slip · ${c.name} · ${fmtMonth(monthKey)}`,
    body: `
      <div style="background:var(--surface-2);padding:14px;border-radius:8px;font-family:monospace;font-size:12px;white-space:pre-wrap;margin-bottom:14px">${escapeHtml(waText)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn primary" onclick="downloadPayslipPDF(${coachId}, '${monthKey}')">📄 Download PDF</button>
        <button class="btn ghost" id="copy-wa-btn">📋 Copy for WhatsApp</button>
      </div>
      <div class="text-mute" style="font-size:11px;margin-top:10px">
        💡 The WhatsApp text uses *asterisks* around bold text — WhatsApp renders them as bold automatically when pasted into a chat.
      </div>
    `,
    actions: [
      { label: 'Close', class: 'btn ghost', onclick: closeModal },
    ],
  });
  // Wire the copy button
  setTimeout(() => {
    const btn = $('#copy-wa-btn');
    if (btn) btn.addEventListener('click', () => {
      navigator.clipboard.writeText(waText).then(() => {
        toast('✓ Pay slip copied — paste into WhatsApp');
      }).catch(() => {
        toast('Copy failed — select the text and copy manually', 'error');
      });
    });
  }, 50);
};

// Download a pay slip as PDF (uses browser's print-to-PDF via a popup)
window.downloadPayslipPDF = function(coachId, monthKey) {
  const c = state.coaches.find(x => x.id === coachId);
  const pay = computeMonthlyPay(coachId, monthKey);
  if (!c || !pay) return;
  const advRows = (state.salaries || []).filter(s => s.coachId === coachId && s.month === monthKey && s.kind === 'advance');
  const w = window.open('', '_blank');
  if (!w) { toast('Popup blocked — please allow popups for this site', 'error'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payslip-${c.name}-${monthKey}</title>
    <style>
      body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; padding: 40px; max-width: 700px; margin: 0 auto; }
      .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #f26060; padding-bottom: 14px; margin-bottom: 24px; }
      .logo { font-size: 22px; font-weight: 800; color: #f26060; }
      .sub { color: #666; font-size: 11px; }
      h2 { font-size: 16px; margin: 18px 0 10px; color: #333; }
      .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 13px; }
      .row.bold { font-weight: 700; }
      .net { background: #f0fdf4; border: 2px solid #10b981; padding: 14px; margin-top: 16px; display: flex; justify-content: space-between; font-size: 18px; font-weight: 800; }
      .net .label { color: #059669; }
      .net .amount { color: #059669; }
      .footer { margin-top: 30px; color: #999; font-size: 10px; text-align: center; border-top: 1px solid #eee; padding-top: 14px; }
      .adv { background: #fef3c7; padding: 10px; border-radius: 6px; margin-top: 10px; font-size: 12px; }
      @media print { body { padding: 20px; } }
    </style>
    </head><body>
      <div class="header">
        <div><div class="logo">★ Black Stars</div><div class="sub">Sports Club · Waab, Doha</div></div>
        <div style="text-align:right">
          <div style="font-weight:700">PAY SLIP</div>
          <div class="sub">${fmtMonth(monthKey)}</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
        <div>
          <div style="font-size:18px;font-weight:700">${escapeHtml(c.name)}</div>
          <div class="sub">${c.role === 'staff' ? 'Staff' : 'Coach'}${c.sports && c.sports.length ? ' · ' + c.sports.join(', ') : ''}</div>
        </div>
        <div style="text-align:right;font-size:11px;color:#666">
          Generated ${fmtDate(TODAY)}<br>
          ${pay.paidStatus === 'paid' ? '<span style="color:#059669;font-weight:700">✓ PAID ' + fmtDate(pay.paidDate) + '</span>' : '<span style="color:#f59e0b">Pending payment</span>'}
        </div>
      </div>

      <h2>Earnings</h2>
      ${pay.fixed > 0 ? `<div class="row"><span>Fixed monthly salary</span><span>${fmt(pay.fixed)} QAR</span></div>` : ''}
      ${pay.commissionRate > 0 ? `
        <div class="row"><span>Commission base (eligible revenue)</span><span>${fmt(pay.commissionBase)} QAR</span></div>
        <div class="row"><span>Commission rate</span><span>${pay.commissionRate}%</span></div>
        <div class="row"><span>Commission earned</span><span>${fmt(pay.commissionAmount)} QAR</span></div>
      ` : ''}
      <div class="row bold"><span>Gross pay</span><span>${fmt(pay.gross)} QAR</span></div>

      ${pay.advance > 0 ? `
        <h2>Advances (deducted)</h2>
        <div class="adv">
          ${advRows.map(a => `<div class="row" style="border:none;padding:2px 0">
            <span>${fmtDate(a.paidDate)}${a.note ? ' — ' + escapeHtml(a.note) : ''}</span>
            <span>${fmt(a.amount)} QAR</span>
          </div>`).join('')}
          <div class="row bold" style="border:none;padding-top:6px;color:#dc2626"><span>Total advances</span><span>−${fmt(pay.advance)} QAR</span></div>
        </div>
      ` : ''}

      <div class="net">
        <div class="label">NET PAY</div>
        <div class="amount">${fmt(pay.net)} QAR</div>
      </div>

      <div class="footer">
        Black Stars Sports Club · This is a computer-generated document. ${pay.paidStatus === 'paid' ? 'Paid on ' + fmtDate(pay.paidDate) + '.' : 'For your records.'}
      </div>
      <script>setTimeout(() => window.print(), 200);</script>
    </body></html>
  `);
  w.document.close();
};

// ─── Revenue Detail Report ────────────────────────────────────────────
// Itemized breakdown showing the coach exactly which members + sports
// contributed to their commission base for a month. Includes sport-switch
// reconciliation lines (positive earnings + negative deductions). PDF only.
window.showRevenueDetail = function(coachId, monthKey) {
  const c = state.coaches.find(x => x.id === coachId);
  if (!c) return;
  // Gather every lineItem credited to this coach for the month
  let lines = [];
  for (const inv of state.invoices) {
    if (inv.month !== monthKey) continue;
    const cat = inv.category || 'Membership';
    if (cat !== 'Membership') continue;
    // RULE: commission follows the invoice — member's current status is irrelevant.
    // We still look up the member NAME for display, but don't filter by status.
    const mem = inv.customerId ? state.members.find(x => x.id === inv.customerId) : null;
    if (mem && mem.deleted) continue;   // archived member excluded from the report
    const lineItems = Array.isArray(inv.lineItems) && inv.lineItems.length
      ? inv.lineItems
      : [{ sport: inv.sport, coachId: inv.coachId, price: inv.amount || 0 }];
    for (const li of lineItems) {
      if (li.coachId !== coachId) continue;
      // Summer Camp doesn't generate coach commission — skip it
      if (li.sport === SUMMER_CAMP) continue;
      lines.push({
        memberName: mem ? mem.name : (inv.customerName || '— deleted member —'),
        memberId: mem ? mem.id : null,
        sport: li.sport,
        price: parseFloat(li.price) || 0,
        isSwitch: !!inv.switchCredit,
        invoiceRef: inv.ref || `INV${inv.id}`,
        invoiceDate: inv.date,
      });
    }
  }

  // Attendance basis: swap the invoice-derived rows for attendance-earned rows,
  // and capture the pending (paid-but-not-yet-attended) breakdown.
  const pay = computeMonthlyPay(coachId, monthKey);
  let pendingLines = [];
  if (pay && pay.basis === 'attendance' && pay.attendanceLines) {
    lines = (pay.attendanceLines.lines || []).map(l => ({
      memberName: l.memberName, sport: l.sport, price: l.amountBase,
      isSwitch: l.kind === 'switch', kind: l.kind, classes: l.classes,
      invoiceRef: '', invoiceDate: null,
    }));
    pendingLines = pay.attendanceLines.pendingLines || [];
  }

  showModal({
    title: `📊 Revenue Detail · ${c.name} · ${fmtMonth(monthKey)}`,
    body: `
      <div style="background:rgba(91,141,239,.06);border:1px solid rgba(91,141,239,.2);border-radius:8px;padding:10px;margin-bottom:14px;font-size:12px;color:var(--text-dim)">
        💡 This report lists every member who contributed to ${escapeHtml(c.name)}'s commission this month. Click <b>Download PDF</b> to send to the coach.
      </div>
      <div style="max-height:300px;overflow:auto;border:1px solid var(--border);border-radius:8px">
        <table style="width:100%;font-size:13px">
          <thead style="background:var(--surface-2);position:sticky;top:0">
            <tr>
              <th style="text-align:left;padding:8px">Member</th>
              <th style="text-align:left;padding:8px">Sport</th>
              <th style="text-align:right;padding:8px">Amount (QAR)</th>
              <th style="text-align:right;padding:8px">Commission (${pay.commissionRate}%)</th>
            </tr>
          </thead>
          <tbody>
            ${lines.length ? lines.map(l => `
              <tr>
                <td style="padding:6px 8px;border-top:1px solid var(--border)">
                  ${escapeHtml(l.memberName)}
                  ${l.isSwitch ? '<span class="badge" style="font-size:9px;padding:1px 6px;background:rgba(245,158,11,.15);color:var(--accent-2);margin-left:6px">SWITCH</span>' : ''}
                </td>
                <td style="padding:6px 8px;border-top:1px solid var(--border)">${escapeHtml(l.sport || '—')}</td>
                <td style="padding:6px 8px;border-top:1px solid var(--border);text-align:right;font-family:monospace;color:${l.price < 0 ? 'var(--red)' : 'var(--text)'}">${fmt(l.price)}</td>
                <td style="padding:6px 8px;border-top:1px solid var(--border);text-align:right;font-family:monospace;font-weight:600;color:${l.price < 0 ? 'var(--red)' : 'var(--text)'}">${fmt(l.price * pay.commissionRate / 100)}</td>
              </tr>
            `).join('') : '<tr><td colspan="4" style="padding:18px;text-align:center;color:var(--text-mute)">No commission-generating revenue this month</td></tr>'}
          </tbody>
        </table>
      </div>
      <div style="margin-top:14px;padding:12px;background:var(--surface-2);border-radius:8px;font-size:13px">
        <div style="display:flex;justify-content:space-between;padding:2px 0"><span class="text-mute">${lines.length} line${lines.length === 1 ? '' : 's'} · Commission base</span><span style="font-family:monospace;font-weight:700">${fmt(lines.reduce((s, l) => s + l.price, 0))} QAR</span></div>
        <div style="display:flex;justify-content:space-between;padding:2px 0"><span class="text-mute">Commission @ ${pay.commissionRate}%</span><span style="font-family:monospace;font-weight:700;color:var(--green)">${fmt(lines.reduce((s, l) => s + l.price, 0) * pay.commissionRate / 100)} QAR</span></div>
      </div>
      ${pendingLines.length ? `
        <div style="margin-top:14px">
          <div style="font-weight:700;font-size:13px;margin-bottom:6px">⏳ Pending — paid but not yet attended</div>
          <div class="text-mute" style="font-size:11px;margin-bottom:8px">These classes are already paid for. ${escapeHtml(c.name)} earns them as the member attends, or as a true-up when the membership ends — they'll show up in a future month's pay, on top of that month's commission.</div>
          <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
            <table style="width:100%;font-size:13px">
              <thead style="background:var(--surface-2)"><tr>
                <th style="text-align:left;padding:8px">Member</th><th style="text-align:left;padding:8px">Sport</th>
                <th style="text-align:right;padding:8px">Classes left</th><th style="text-align:right;padding:8px">Pending (QAR)</th>
              </tr></thead>
              <tbody>
                ${pendingLines.map(p => `<tr>
                  <td style="padding:6px 8px;border-top:1px solid var(--border)">${escapeHtml(p.memberName)}</td>
                  <td style="padding:6px 8px;border-top:1px solid var(--border)">${escapeHtml(p.sport || '—')}</td>
                  <td style="padding:6px 8px;border-top:1px solid var(--border);text-align:right">${p.classes}${p.total ? ' / ' + p.total : ''}</td>
                  <td style="padding:6px 8px;border-top:1px solid var(--border);text-align:right;font-family:monospace">${fmt(p.amountBase * pay.commissionRate / 100)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <div style="margin-top:8px;padding:10px 12px;background:rgba(245,158,11,.1);border-radius:8px;display:flex;justify-content:space-between;font-size:13px;font-weight:700"><span>Total pending for ${escapeHtml(c.name)}</span><span style="font-family:monospace">${fmt(pay.commissionPending)} QAR</span></div>
        </div>
      ` : ''}
    `,
    actions: [
      { label: 'Close', class: 'btn ghost', onclick: closeModal },
      { label: '📄 Download PDF', class: 'btn primary', onclick: () => downloadRevenueDetailPDF(coachId, monthKey) },
    ],
  });
};

window.downloadRevenueDetailPDF = function(coachId, monthKey) {
  const c = state.coaches.find(x => x.id === coachId);
  const pay = computeMonthlyPay(coachId, monthKey);
  if (!c || !pay) return;

  // Re-gather lines (same logic as showRevenueDetail)
  let lines = [];
  for (const inv of state.invoices) {
    if (inv.month !== monthKey) continue;
    if ((inv.category || 'Membership') !== 'Membership') continue;
    // RULE: commission follows the invoice — member's current status is irrelevant.
    const mem = inv.customerId ? state.members.find(x => x.id === inv.customerId) : null;
    if (mem && mem.deleted) continue;   // archived member excluded from the report
    const lineItems = Array.isArray(inv.lineItems) && inv.lineItems.length
      ? inv.lineItems
      : [{ sport: inv.sport, coachId: inv.coachId, price: inv.amount || 0 }];
    for (const li of lineItems) {
      if (li.coachId !== coachId) continue;
      // Summer Camp generates no coach commission — skip
      if (li.sport === SUMMER_CAMP) continue;
      // Link this invoice line to its subscription row (for period / attendance / status)
      let sub = null;
      if (mem) {
        sub = (mem.subscriptions || []).find(s => s.invoiceNumber === inv.ref && s.activity === li.sport)
           || (mem.subscriptions || []).find(s => s.activity === li.sport && s.coachId === li.coachId);
      }
      lines.push({
        memberName: mem ? mem.name : (inv.customerName || '— deleted member —'),
        sport: li.sport,
        price: parseFloat(li.price) || 0,
        isSwitch: !!inv.switchCredit,
        invoiceRef: inv.ref || `INV${inv.id}`,
        invoiceDate: inv.date,
        start: sub?.start || null,
        end: sub?.end || null,
        attended: mem ? attendedClassesFor(mem, li.sport) : (sub?.attendedClasses || 0),
        total: sub?.totalClasses || null,
        status: mem ? memberStatus(mem) : '—',
      });
    }
  }

  // Attendance basis: use attendance-earned rows + capture pending breakdown.
  let pendingLines = [];
  if (pay && pay.basis === 'attendance' && pay.attendanceLines) {
    lines = (pay.attendanceLines.lines || []).map(l => ({
      memberName: l.memberName, sport: l.sport, price: l.amountBase,
      isSwitch: l.kind === 'switch', invoiceRef: l.kind === 'trueup' ? 'expiry true-up' : (l.kind === 'attended' ? (l.classes + ' class' + (l.classes === 1 ? '' : 'es')) : ''),
      invoiceDate: null, start: l.start, end: l.end, attended: l.attended, total: l.total, status: l.status,
    }));
    pendingLines = pay.attendanceLines.pendingLines || [];
  }

  // Group by sport for the summary
  const bySport = {};
  for (const l of lines) {
    const k = l.sport || '—';
    if (!bySport[k]) bySport[k] = { count: 0, total: 0 };
    bySport[k].count++;
    bySport[k].total += l.price;
  }

  const advRows = (state.salaries || []).filter(s => s.coachId === coachId && s.month === monthKey && s.kind === 'advance');

  const w = window.open('', '_blank');
  if (!w) { toast('Popup blocked — please allow popups', 'error'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Revenue-Detail-${c.name}-${monthKey}</title>
    <style>
      body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; padding: 40px; max-width: 760px; margin: 0 auto; }
      .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #f26060; padding-bottom: 14px; margin-bottom: 24px; }
      .logo { font-size: 22px; font-weight: 800; color: #f26060; }
      .sub { color: #666; font-size: 11px; }
      h2 { font-size: 14px; margin: 20px 0 10px; color: #333; border-bottom: 1px solid #eee; padding-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 6px 0; }
      th { background: #f5f5f7; padding: 8px; text-align: left; font-size: 11px; color: #555; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
      td { padding: 7px 8px; border-bottom: 1px solid #eee; }
      td.num { text-align: right; font-family: 'Courier New', monospace; }
      td.neg { color: #dc2626; }
      .badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; margin-left: 6px; }
      .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
      .row.bold { font-weight: 700; border-top: 1px solid #ddd; margin-top: 4px; padding-top: 8px; }
      .net { background: #f0fdf4; border: 2px solid #10b981; padding: 14px; margin-top: 16px; display: flex; justify-content: space-between; font-size: 18px; font-weight: 800; }
      .net.neg { background: #fef2f2; border-color: #ef4444; }
      .net .label, .net .amount { color: #059669; }
      .net.neg .label, .net.neg .amount { color: #dc2626; }
      .footer { margin-top: 30px; color: #999; font-size: 10px; text-align: center; border-top: 1px solid #eee; padding-top: 14px; }
      .adv { background: #fef3c7; padding: 10px; border-radius: 6px; margin-top: 10px; font-size: 12px; }
      @media print { body { padding: 20px; } }
    </style>
    </head><body>
      <div class="header">
        <div><div class="logo">★ Black Stars</div><div class="sub">Sports Club · Waab, Doha</div></div>
        <div style="text-align:right">
          <div style="font-weight:700">REVENUE DETAIL</div>
          <div class="sub">${fmtMonth(monthKey)}</div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
        <div>
          <div style="font-size:18px;font-weight:700">${escapeHtml(c.name)}</div>
          <div class="sub">${c.role === 'staff' ? 'Staff' : 'Coach'}${c.sports && c.sports.length ? ' · ' + c.sports.join(', ') : ''}</div>
        </div>
        <div style="text-align:right;font-size:11px;color:#666">
          Generated ${fmtDate(TODAY)}<br>
          Commission rate: <b>${pay.commissionRate}%</b><br>
          Basis: <b>${pay.basis === 'attendance' ? 'by attendance' : 'by payment'}</b>
          ${pay.fixed > 0 ? '<br>Fixed monthly: <b>' + fmt(pay.fixed) + ' QAR</b>' : ''}
        </div>
      </div>

      <h2>Members & Sports Breakdown (${lines.length} line${lines.length === 1 ? '' : 's'})</h2>
      ${lines.length ? `
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Member</th>
            <th>Sport</th>
            <th>Start</th>
            <th>End</th>
            <th>Classes</th>
            <th>Status</th>
            <th style="text-align:right">Amount (QAR)</th>
            <th style="text-align:right">Commission (${pay.commissionRate}%)</th>
          </tr>
        </thead>
        <tbody>
          ${lines.map((l, i) => `
            <tr>
              <td style="color:#999">${i + 1}</td>
              <td>${escapeHtml(l.memberName)}${l.isSwitch ? '<span class="badge">SWITCH</span>' : ''}<div style="color:#999;font-size:10px">${escapeHtml(l.invoiceRef || '')}${l.invoiceDate ? ' · ' + fmtDate(l.invoiceDate) : ''}</div></td>
              <td>${escapeHtml(l.sport || '—')}</td>
              <td style="font-size:11px">${l.start ? fmtDate(l.start) : '—'}</td>
              <td style="font-size:11px">${l.end ? fmtDate(l.end) : '—'}</td>
              <td style="font-size:11px">${l.attended != null ? l.attended : 0}${l.total ? ' / ' + l.total : ''}</td>
              <td style="font-size:11px">${escapeHtml(l.status || '—')}</td>
              <td class="num ${l.price < 0 ? 'neg' : ''}">${fmt(l.price)}</td>
              <td class="num ${l.price < 0 ? 'neg' : ''}" style="font-weight:700">${fmt(l.price * pay.commissionRate / 100)}</td>
            </tr>
          `).join('')}
          <tr style="background:#f5f5f7;font-weight:700">
            <td colspan="7">Subtotal · Commission base</td>
            <td class="num">${fmt(lines.reduce((s, l) => s + l.price, 0))}</td>
            <td class="num">${fmt(lines.reduce((s, l) => s + l.price, 0) * pay.commissionRate / 100)}</td>
          </tr>
        </tbody>
      </table>
      ` : '<div style="padding:14px;background:#f5f5f7;border-radius:6px;color:#666;text-align:center">No commission-generating revenue this month.</div>'}

      ${pendingLines.length ? `
      <h2>⏳ Pending — paid but not yet attended</h2>
      <div style="font-size:11px;color:#666;margin-bottom:6px">Already paid for. ${escapeHtml(c.name)} earns these as the member attends, or as a true-up when the membership ends — they appear in a future month's pay on top of that month's commission.</div>
      <table>
        <thead><tr><th>Member</th><th>Sport</th><th>Start</th><th>End</th><th>Classes left</th><th style="text-align:right">Pending (QAR)</th></tr></thead>
        <tbody>
          ${pendingLines.map(p => `<tr>
            <td>${escapeHtml(p.memberName)}</td>
            <td>${escapeHtml(p.sport || '—')}</td>
            <td style="font-size:11px">${p.start ? fmtDate(p.start) : '—'}</td>
            <td style="font-size:11px">${p.end ? fmtDate(p.end) : '—'}</td>
            <td>${p.classes}${p.total ? ' / ' + p.total : ''}</td>
            <td class="num">${fmt(p.amountBase * pay.commissionRate / 100)}</td>
          </tr>`).join('')}
          <tr style="background:#fef3c7;font-weight:700"><td colspan="5">Total pending</td><td class="num">${fmt(pay.commissionPending)}</td></tr>
        </tbody>
      </table>
      ` : ''}

      <h2>Commission Calculation</h2>
      ${pay.fixed > 0 ? `<div class="row"><span>Fixed monthly salary</span><span style="font-family:monospace">${fmt(pay.fixed)} QAR</span></div>` : ''}
      ${pay.commissionRate > 0 ? `
        <div class="row"><span>Commission base (sum above)</span><span style="font-family:monospace">${fmt(pay.commissionBase)} QAR</span></div>
        <div class="row"><span>Commission rate</span><span style="font-family:monospace">× ${pay.commissionRate}%</span></div>
        <div class="row"><span>Commission earned</span><span style="font-family:monospace">${fmt(pay.commissionAmount)} QAR</span></div>
      ` : ''}
      <div class="row bold"><span>Gross pay</span><span style="font-family:monospace">${fmt(pay.gross)} QAR</span></div>

      ${pay.advance > 0 ? `
        <h2>Advances Given This Month</h2>
        <div class="adv">
          ${advRows.map(a => `<div class="row" style="border:none;padding:2px 0">
            <span>${fmtDate(a.paidDate)}${a.note ? ' — ' + escapeHtml(a.note) : ''}</span>
            <span style="font-family:monospace">${fmt(a.amount)} QAR</span>
          </div>`).join('')}
          <div class="row bold" style="border:none;padding-top:6px;color:#dc2626"><span>Total advances</span><span style="font-family:monospace">−${fmt(pay.advance)} QAR</span></div>
        </div>
      ` : ''}

      <div class="net ${pay.net < 0 ? 'neg' : ''}">
        <div class="label">NET PAY</div>
        <div class="amount">${fmt(pay.net)} QAR</div>
      </div>
      ${pay.net < 0 ? '<div style="margin-top:8px;font-size:11px;color:#dc2626"><b>Note:</b> Net pay is negative this month due to retroactive adjustments. To be reconciled in the next pay period.</div>' : ''}

      <div class="footer">
        Black Stars Sports Club · Generated ${fmtDate(TODAY)} · Computer-generated · ${pay.paidStatus === 'paid' ? 'Paid on ' + fmtDate(pay.paidDate) + '.' : 'For your records.'}
      </div>
      <script>setTimeout(() => window.print(), 200);</script>
    </body></html>
  `);
  w.document.close();
};

// Export the current month's payroll as CSV
window.downloadPayrollCSV = function(monthKey) {
  const people = (state.coaches || [])
    .filter(c => isCoachActive(c))
    .map(c => computeMonthlyPay(c.id, monthKey))
    .filter(p => p);
  const rows = [
    ['Name','Role','Month','Fixed','Commission Base','Commission Rate %','Commission Amount','Gross','Advance','Net','Status','Paid Date'],
    ...people.map(p => [
      p.name, p.role || 'coach', monthKey,
      p.fixed, p.commissionBase, p.commissionRate, p.commissionAmount,
      p.gross, p.advance, p.net,
      p.paidStatus, p.paidDate || '',
    ]),
  ];
  const csv = rows.map(r => r.map(v => {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(',')).join('\n');
  downloadFile(`payroll-${monthKey}.csv`, csv, 'text/csv');
  toast('Payroll CSV downloaded');
};

// ─── SALES + PRODUCTS ─────────────────────────────────────────────────
// New POS-style sales: each transaction has multiple line items, links to a
// customer (member or walk-in), and auto-generates an invoice. Stock decrements
// on every sale.

// ─── Helpers ───────────────────────────────────────────────────────────

// Compute the running stock for a product: starting `stock` minus all qty in
// non-historical sale transactions. Historical sales already had their stock
// subtracted at import time, so we skip them here.
function productCurrentStock(productId) {
  const p = (state.products || []).find(x => x.id === productId);
  if (!p) return 0;
  let sold = 0;
  for (const s of (state.sales || [])) {
    if (s.historical) continue;   // historical = stock already accounted for
    for (const it of (s.items || [])) {
      if (it.productId === productId) sold += it.qty || 0;
    }
  }
  return Math.max(0, (p.stock || 0) - sold);
}

// ─── PRODUCTS PAGE ─────────────────────────────────────────────────────
PAGES.products = (main) => {
  let filter = { search: '', category: 'all', stock: 'all' };
  const pg = makePager(15);

  function applyFilter() {
    return (state.products || []).filter(p => {
      if (filter.search) {
        const q = filter.search.toLowerCase();
        const hay = [p.name, p.category, p.sku].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter.category !== 'all' && p.category !== filter.category) return false;
      const stock = productCurrentStock(p.id);
      if (filter.stock === 'low' && stock > (p.lowStockThreshold || 3)) return false;
      if (filter.stock === 'out' && stock > 0) return false;
      if (filter.stock === 'available' && stock <= 0) return false;
      return true;
    });
  }

  function refresh() {
    const all = applyFilter();
    const rows = paginate(all, pg);
    $('#prod-tbody').innerHTML = rows.length ? rows.map(p => {
      const stock = productCurrentStock(p.id);
      const threshold = p.lowStockThreshold || 3;
      const stockColor = stock === 0 ? 'var(--red)' : stock <= threshold ? 'var(--accent-2)' : 'var(--green)';
      const stockLabel = stock === 0 ? 'Out of stock' : stock <= threshold ? 'Low' : 'In stock';
      return `
        <tr>
          <td><div class="font-bold">${escapeHtml(p.name)}</div>${p.sku ? `<div class="text-mute" style="font-size:11px">SKU: ${escapeHtml(p.sku)}</div>` : ''}</td>
          <td><span class="badge">${escapeHtml(p.category || '—')}</span></td>
          <td class="text-right num">${p.cost ? fmt(p.cost) : '<span class="text-mute">—</span>'}</td>
          <td class="text-right num font-bold">${fmt(p.price || 0)}</td>
          <td class="text-right" style="color:${stockColor};font-weight:700">${stock}</td>
          <td class="text-right num">${fmt(stock * (p.price || 0))}</td>
          <td><span class="badge" style="background:${stockColor==='var(--red)'?'rgba(239,68,68,.15)':stockColor==='var(--accent-2)'?'rgba(242,163,60,.15)':'rgba(16,185,129,.15)'};color:${stockColor};font-size:10px">${stockLabel}</span></td>
          <td class="text-right" style="white-space:nowrap">
            <button class="btn ghost sm" onclick="restockProduct(${p.id})" title="Restock (add inventory)">➕ Restock</button>
            <button class="btn ghost sm" onclick="editProduct(${p.id})" title="Edit">✏️</button>
            <button class="btn ghost sm" onclick="deleteProduct(${p.id})" title="Delete">🗑</button>
          </td>
        </tr>`;
    }).join('') : `<tr><td colspan="8" class="empty"><div class="empty-icon">📦</div>No products match</td></tr>`;
    $('#prod-count').textContent = `${all.length} product${all.length===1?'':'s'}`;
    renderPagination('prod-pagination', pg, all.length, refresh);
  }

  const cats = [...new Set((state.products || []).map(p => p.category).filter(Boolean))].sort();
  const totalValue = (state.products || []).reduce((s,p) => s + productCurrentStock(p.id) * (p.price || 0), 0);
  const totalCost = (state.products || []).reduce((s,p) => s + productCurrentStock(p.id) * (p.cost || 0), 0);
  const lowCount = (state.products || []).filter(p => {
    const st = productCurrentStock(p.id);
    return st > 0 && st <= (p.lowStockThreshold || 3);
  }).length;
  const outCount = (state.products || []).filter(p => productCurrentStock(p.id) === 0).length;

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>📦 Products</h1>
        <div class="subtitle"><span id="prod-count">Loading...</span> · ${fmt(totalValue)} QAR sell value · ${fmt(totalCost)} QAR cost value</div>
      </div>
      <div class="topbar-actions">
        <button class="btn primary" id="prod-add">+ New Product</button>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
      <div class="kpi green">
        <div class="kpi-label">📦 Products in catalog</div>
        <div class="kpi-value">${(state.products || []).length}</div>
        <div class="kpi-sub">${fmt(totalValue)} QAR sell value</div>
      </div>
      <div class="kpi blue">
        <div class="kpi-label">💰 Inventory cost (original)</div>
        <div class="kpi-value">${fmt(totalCost)}</div>
        <div class="kpi-sub">amount paid for stock${totalCost > 0 ? ` · margin ${fmt(totalValue - totalCost)} QAR` : ''}</div>
      </div>
      <div class="kpi orange">
        <div class="kpi-label">⚠️ Low stock</div>
        <div class="kpi-value">${lowCount}</div>
        <div class="kpi-sub">at or below threshold</div>
      </div>
      <div class="kpi red">
        <div class="kpi-label">⛔ Out of stock</div>
        <div class="kpi-value">${outCount}</div>
        <div class="kpi-sub">need restocking</div>
      </div>
    </div>

    <div class="card">
      <div class="filter-bar">
        <div class="search"><input id="prod-search" type="text" placeholder="Search product name, category, SKU..." /></div>
        <select id="prod-cat" class="btn ghost">
          <option value="all">All categories</option>
          ${cats.map(c => `<option>${escapeHtml(c)}</option>`).join('')}
        </select>
        <select id="prod-stock" class="btn ghost">
          <option value="all">All stock levels</option>
          <option value="available">In stock</option>
          <option value="low">⚠️ Low</option>
          <option value="out">⛔ Out</option>
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Product</th><th>Category</th><th class="text-right">Cost</th><th class="text-right">Sell price</th><th class="text-right">Stock</th><th class="text-right">Stock value</th><th>Status</th><th></th></tr></thead>
          <tbody id="prod-tbody"></tbody>
        </table>
      </div>
      <div id="prod-pagination"></div>
    </div>
  `;

  $('#prod-search').addEventListener('input', e => { filter.search = e.target.value; pg.page = 1; refresh(); });
  $('#prod-cat').addEventListener('change', e => { filter.category = e.target.value; pg.page = 1; refresh(); });
  $('#prod-stock').addEventListener('change', e => { filter.stock = e.target.value; pg.page = 1; refresh(); });
  $('#prod-add').addEventListener('click', addProduct);

  refresh();
};

// ─── Product modals ────────────────────────────────────────────────────
function productFormHtml(p) {
  const cats = [...new Set((state.products || []).map(x => x.category).filter(Boolean))].sort();
  return `
    <div class="form-row">
      <div class="field" style="flex:2"><label>Name *</label><input id="p-name" type="text" value="${escapeHtml(p.name || '')}" placeholder="e.g. Boxing Gloves" /></div>
      <div class="field"><label>SKU (optional)</label><input id="p-sku" type="text" value="${escapeHtml(p.sku || '')}" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Category</label>
        <input id="p-cat" type="text" value="${escapeHtml(p.category || '')}" list="prod-cat-list" placeholder="Apparel / Equipment / Swimming Gear / ..." />
        <datalist id="prod-cat-list">${cats.map(c => `<option value="${escapeHtml(c)}">`).join('')}</datalist>
      </div>
    </div>
    <div class="form-row">
      <div class="field"><label>Original value / cost (QAR) <span class="text-mute" style="font-size:10px;font-weight:400">(what you paid)</span></label><input id="p-cost" type="number" min="0" step="0.01" value="${p.cost ?? ''}" placeholder="0" /></div>
      <div class="field"><label>Sell price (QAR) *</label><input id="p-price" type="number" min="0" step="0.01" value="${p.price ?? ''}" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Stock quantity</label><input id="p-stock" type="number" min="0" step="1" value="${p.stock ?? 0}" /></div>
      <div class="field"><label>Low stock threshold</label><input id="p-lowst" type="number" min="0" step="1" value="${p.lowStockThreshold ?? 3}" /></div>
    </div>
  `;
}

function addProduct() {
  showModal({
    title: '📦 New Product',
    body: productFormHtml({}),
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: '💾 Save', class: 'btn primary', onclick: () => saveProduct(null) },
    ],
  });
}

window.editProduct = function(id) {
  const p = (state.products || []).find(x => x.id === id);
  if (!p) return;
  showModal({
    title: `📦 Edit: ${escapeHtml(p.name)}`,
    body: productFormHtml(p),
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: '💾 Save', class: 'btn primary', onclick: () => saveProduct(id) },
    ],
  });
};

function saveProduct(existingId) {
  const name = $('#p-name').value.trim();
  if (!name) { toast('Name required', 'error'); return; }
  const price = parseFloat($('#p-price').value) || 0;
  if (price <= 0) { toast('Sell price must be > 0', 'error'); return; }
  const cost = parseFloat($('#p-cost').value) || 0;
  const data = {
    name,
    sku: $('#p-sku').value.trim() || null,
    category: $('#p-cat').value.trim() || 'Other',
    cost,
    price,
    stock: parseInt($('#p-stock').value) || 0,
    lowStockThreshold: parseInt($('#p-lowst').value) || 3,
  };
  if (existingId) {
    const idx = state.products.findIndex(x => x.id === existingId);
    state.products[idx] = { ...state.products[idx], ...data };
    toast('Product updated');
  } else {
    state.products.push({ id: nextId(state.products || []), ...data });
    toast('Product added');
  }
  save();
  closeModal();
  render();
}

window.deleteProduct = function(id) {
  const p = (state.products || []).find(x => x.id === id);
  if (!p) return;
  // Check if used in sales
  const usedIn = (state.sales || []).filter(s => (s.items || []).some(it => it.productId === id)).length;
  if (usedIn > 0) {
    if (!confirm(`"${p.name}" appears in ${usedIn} past sale${usedIn===1?'':'s'}. Delete anyway? (Sales history won't be affected)`)) return;
  } else if (!confirm(`Delete product "${p.name}"?`)) return;
  state.products = state.products.filter(x => x.id !== id);
  save();
  render();
  toast('Product deleted');
};

window.restockProduct = function(id) {
  const p = (state.products || []).find(x => x.id === id);
  if (!p) return;
  const currentStock = productCurrentStock(id);
  showModal({
    title: `➕ Restock: ${escapeHtml(p.name)}`,
    body: `
      <div class="text-mute" style="font-size:13px;margin-bottom:12px">Current stock: <b>${currentStock}</b></div>
      <div class="form-row">
        <div class="field"><label>Add quantity</label><input id="rs-qty" type="number" min="1" step="1" value="10" /></div>
        <div class="field"><label>Cost per unit (optional)</label><input id="rs-cost" type="number" min="0" step="0.01" placeholder="for expense log" /></div>
      </div>
      <div class="form-row">
        <div class="field" style="flex:1"><label>Note (optional)</label><input id="rs-note" type="text" placeholder="Supplier / receipt ref" /></div>
      </div>
      <div style="background:rgba(96,165,250,.08);border:1px solid rgba(96,165,250,.25);border-radius:8px;padding:10px;margin-top:8px;font-size:12px">
        💡 If you enter a cost, an expense will be created automatically for the total amount.
      </div>
    `,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: '➕ Restock', class: 'btn primary', onclick: () => {
        const qty = parseInt($('#rs-qty').value) || 0;
        const cost = parseFloat($('#rs-cost').value) || 0;
        const note = $('#rs-note').value.trim();
        if (qty <= 0) { toast('Quantity must be > 0', 'error'); return; }
        // Bump base stock — current stock is recomputed from this anyway
        const idx = state.products.findIndex(x => x.id === id);
        state.products[idx].stock = (state.products[idx].stock || 0) + qty;
        // Auto-create expense if cost given
        if (cost > 0) {
          state.expenses.push({
            id: nextId(state.expenses || []),
            date: TODAY, month: TODAY.slice(0, 7),
            description: `Restock: ${qty}× ${p.name}` + (note ? ` (${note})` : ''),
            category: 'Equipment',
            amount: qty * cost,
            method: 'cash',
          });
        }
        save();
        closeModal();
        toast(`+${qty} ${p.name}` + (cost > 0 ? ` · expense ${fmt(qty*cost)} QAR logged` : ''));
        render();
      }},
    ],
  });
};

// ─── SALES PAGE (POS-style) ────────────────────────────────────────────
PAGES.sales = (main) => {
  let filter = { search: '', month: 'all', method: 'all', custType: 'all' };
  const pg = makePager(10);

  function applyFilter() {
    return (state.sales || []).filter(s => {
      if (filter.search) {
        const q = filter.search.toLowerCase();
        const cust = customerInfo(s);
        const itemsText = (s.items || []).map(it => it.name).join(' ');
        const hay = [cust.name, cust.nameArabic, cust.phone, cust.phone2, cust.qid, itemsText, s.notes].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter.month !== 'all' && s.month !== filter.month) return false;
      if (filter.method !== 'all' && s.method !== filter.method) return false;
      if (filter.custType !== 'all') {
        if (filter.custType === 'historical' && !s.historical) return false;
        if (filter.custType !== 'historical' && s.customerType !== filter.custType) return false;
      }
      return true;
    });
  }

  function refresh() {
    const all = applyFilter().sort((a,b) => (b.date || '').localeCompare(a.date || ''));
    const totalAmt = all.reduce((s,r) => s + (r.total || 0), 0);
    const totalPaid = all.reduce((s,r) => s + (r.paid || 0), 0);
    const totalDue = all.reduce((s,r) => s + (r.balance || 0), 0);
    const rows = paginate(all, pg);
    $('#sale-tbody').innerHTML = rows.length ? rows.map(s => {
      const itemsList = (s.items || []).map(it => `${it.qty}× ${escapeHtml(it.name)}`).join(', ');
      const cust = customerInfo(s);
      const custDisplay = s.historical
        ? '<span class="badge" style="background:var(--surface-2);color:var(--text-mute);font-size:10px">historical</span>'
        : (s.customerType === 'member'
          ? `<div class="font-bold" style="${cust.isDeleted ? 'text-decoration:line-through;color:var(--text-mute)' : ''}">${escapeHtml(cust.name || '—')}</div><div class="text-mute" style="font-size:11px">🎟 member${cust.phone ? ' · ' + phoneCell(cust.phone) : ''}</div>`
          : `<div class="font-bold">${escapeHtml(cust.name || 'Walk-in')}</div>${cust.phone ? `<div class="text-mute" style="font-size:11px">${phoneCell(cust.phone)}</div>` : ''}`);
      const balanceLabel = (s.balance || 0) > 0
        ? `<div style="font-size:10px;color:var(--accent-2)">${fmt(s.balance)} due</div>`
        : '';
      return `
        <tr>
          <td class="text-dim" style="white-space:nowrap;font-size:11px">${fmtDate(s.date)}<div class="font-mono text-mute" style="font-size:10px">${escapeHtml(s.invoiceId ? (state.invoices.find(i=>i.id===s.invoiceId)?.ref || '') : '')}</div></td>
          <td>${custDisplay}</td>
          <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;font-size:12px">${escapeHtml(itemsList || '—')}</td>
          <td class="text-right num font-bold">${fmt(s.total || 0)}${balanceLabel}</td>
          <td><span class="badge ${s.method === 'card' ? 'blue' : ''}">${s.method || 'cash'}</span></td>
          <td class="text-right" style="white-space:nowrap">
            ${s.invoiceId ? `<button class="btn ghost sm" onclick="printInvoicePDF(${s.invoiceId})" title="Print invoice">📄</button>` : ''}
            <button class="btn ghost sm" onclick="viewSaleDetail(${s.id})" title="Details">👁</button>
            <button class="btn ghost sm" onclick="deleteSale(${s.id})" title="Delete">🗑</button>
          </td>
        </tr>`;
    }).join('') : `<tr><td colspan="6" class="empty"><div class="empty-icon">🛒</div>No sales match</td></tr>`;
    $('#sale-count').textContent = `${all.length} sale${all.length===1?'':'s'} · ${fmt(totalAmt)} total · ${fmt(totalPaid)} collected · ${fmt(totalDue)} outstanding`;
    renderPagination('sale-pagination', pg, all.length, refresh);
  }

  const months = [...new Set((state.sales || []).map(s => s.month).filter(Boolean))].sort().reverse();

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>🛒 Sales</h1>
        <div class="subtitle"><span id="sale-count">Loading...</span></div>
      </div>
      <div class="topbar-actions">
        <button class="btn primary" id="sale-new">🛍 New Sale</button>
      </div>
    </div>

    <div class="card">
      <div class="filter-bar">
        <div class="search"><input id="sale-search" type="text" placeholder="Search items, customer name, mobile..." /></div>
        <select id="sale-month" class="btn ghost">
          <option value="all">All months</option>
          ${months.map(m => `<option value="${m}">${fmtMonth(m)}</option>`).join('')}
        </select>
        <select id="sale-method" class="btn ghost">
          <option value="all">All methods</option>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
        </select>
        <select id="sale-cust" class="btn ghost">
          <option value="all">All customers</option>
          <option value="member">🎟 Members</option>
          <option value="walkin">🚶 Walk-ins</option>
          <option value="historical">📜 Historical (imported)</option>
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date / Ref</th>
              <th>Customer</th>
              <th>Items</th>
              <th class="text-right">Total</th>
              <th>Method</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="sale-tbody"></tbody>
        </table>
      </div>
      <div id="sale-pagination"></div>
    </div>
  `;

  $('#sale-search').addEventListener('input', e => { filter.search = e.target.value; pg.page = 1; refresh(); });
  $('#sale-month').addEventListener('change', e => { filter.month = e.target.value; pg.page = 1; refresh(); });
  $('#sale-method').addEventListener('change', e => { filter.method = e.target.value; pg.page = 1; refresh(); });
  $('#sale-cust').addEventListener('change', e => { filter.custType = e.target.value; pg.page = 1; refresh(); });
  $('#sale-new').addEventListener('click', () => newSale(refresh));
  refresh();
};

// ─── New Sale modal (POS) ──────────────────────────────────────────────
// Live state held on window so the modal handlers can read/mutate it
function newSale(onDone) {
  window._saleLines = [];
  window._saleCust = { type: 'walkin', memberId: null, name: '', phone: '' };

  showModal({
    title: '🛍 New Sale',
    body: `
      <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:14px">
        <!-- Left: items + cart -->
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div style="font-weight:700;font-size:13px">🛒 Cart</div>
            <button type="button" class="btn ghost sm" id="sale-add-line">+ Add line</button>
          </div>
          <div id="sale-lines" style="display:flex;flex-direction:column;gap:6px;max-height:240px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--surface-2)"></div>
          <div id="sale-empty-hint" class="text-mute" style="font-size:11px;margin-top:4px;text-align:center">Click "+ Add line" to start</div>

          <div style="margin-top:12px;background:var(--surface-2);border-radius:8px;padding:10px;font-size:13px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span class="text-mute">Subtotal</span><span id="sale-subtotal" class="font-bold">0.00</span></div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span class="text-mute">Discount (QAR)</span>
              <input type="number" id="sale-discount" min="0" step="0.01" value="0" style="width:100px;text-align:right;background:transparent;border:1px solid var(--border);border-radius:4px;padding:3px 6px;color:var(--text)" />
            </div>
            <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);margin-top:6px;padding-top:6px;font-size:15px">
              <span class="font-bold">Total</span><span id="sale-total" class="font-bold" style="color:var(--green)">0.00</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
              <span class="text-mute">Paid (QAR)</span>
              <input type="number" id="sale-paid" min="0" step="0.01" value="0" style="width:100px;text-align:right;background:transparent;border:1px solid var(--border);border-radius:4px;padding:3px 6px;color:var(--text)" />
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:11px">
              <span class="text-mute">Balance</span><span id="sale-balance" class="font-bold" style="color:var(--accent-2)">0.00</span>
            </div>
          </div>
        </div>

        <!-- Right: customer + meta -->
        <div>
          <div style="font-weight:700;font-size:13px;margin-bottom:6px">👤 Customer</div>
          <div style="display:flex;gap:6px;margin-bottom:8px">
            <button type="button" class="btn ghost sm" data-cust-type="member" id="cust-tab-member" style="flex:1">🎟 Member</button>
            <button type="button" class="btn ghost sm" data-cust-type="walkin" id="cust-tab-walkin" style="flex:1;background:var(--accent);color:white">🚶 Walk-in</button>
          </div>
          <div id="cust-member-fields" style="display:none">
            <div class="field" style="margin-bottom:8px"><label>Member</label>${memberPickerHtml('sale-cust', { placeholder: 'Search by name / mobile / QID...' })}</div>
          </div>
          <div id="cust-walkin-fields">
            <div class="field" style="margin-bottom:8px"><label>Name *</label><input type="text" id="sale-walkin-name" placeholder="Required" /></div>
            <div style="margin-bottom:8px">${phoneInputHtml('sale-walkin-phone', '', { label: 'Mobile', fieldStyle: 'margin:0' })}</div>
          </div>

          <div style="font-weight:700;font-size:13px;margin:14px 0 6px">📝 Details</div>
          <div class="field" style="margin-bottom:8px"><label>Date</label><input type="date" id="sale-date" value="${TODAY}" /></div>
          <div class="field" style="margin-bottom:8px"><label>Method</label><select id="sale-method-pos"><option value="cash">Cash</option><option value="card">Card</option></select></div>
          <div class="field" style="margin-bottom:8px"><label>Notes</label><input type="text" id="sale-notes" /></div>
        </div>
      </div>
      <div style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:8px;padding:10px;margin-top:12px;font-size:12px">
        💡 An invoice will be created automatically. Stock levels update too.
      </div>
    `,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: '💾 Complete Sale', class: 'btn primary', onclick: () => completeSale(onDone) },
    ],
  });
  // Post-render wiring
  setTimeout(wireSaleModal, 50);
}

function renderSaleLines() {
  const wrap = $('#sale-lines');
  if (!wrap) return;
  const products = state.products || [];
  if (!window._saleLines.length) {
    wrap.innerHTML = '';
    const hint = $('#sale-empty-hint');
    if (hint) hint.style.display = 'block';
  } else {
    const hint = $('#sale-empty-hint');
    if (hint) hint.style.display = 'none';
    // Grid template: name fills, qty/price/total fixed widths, ✕ fixed.
    // Using fixed widths instead of fr units prevents the Product name from
    // being squeezed when the column container is narrow.
    const ROW_GRID = 'minmax(0,1fr) 70px 90px 80px 36px';
    const headerRow = `
      <div style="display:grid;grid-template-columns:${ROW_GRID};gap:6px;align-items:center;padding:0 6px 4px;font-size:10px;font-weight:600;color:var(--text-mute);text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--border);margin-bottom:4px">
        <div>Product</div>
        <div style="text-align:center">Qty</div>
        <div style="text-align:right">Unit price</div>
        <div style="text-align:right">Total</div>
        <div></div>
      </div>
    `;
    wrap.innerHTML = headerRow + window._saleLines.map((line, i) => {
      const inStock = line.productId ? productCurrentStock(line.productId) : 0;
      const overStock = line.productId && line.qty > inStock;
      const opts = products.map(p => `<option value="${p.id}" ${line.productId === p.id ? 'selected' : ''}>${escapeHtml(p.name)} · ${fmt(p.price)} · ${productCurrentStock(p.id)} in stock</option>`).join('');
      return `
        <div style="display:grid;grid-template-columns:${ROW_GRID};gap:6px;align-items:center;padding:4px 6px;background:${overStock ? 'rgba(239,68,68,.08)' : 'transparent'};border-radius:6px;min-width:0">
          <select data-line-i="${i}" data-line-k="productId" style="font-size:12px;min-width:0;width:100%;padding:6px 4px">
            <option value="">— pick product —</option>
            ${opts}
          </select>
          <input type="number" min="1" step="1" data-line-i="${i}" data-line-k="qty" value="${line.qty}" style="text-align:center;padding:6px 4px;width:100%;min-width:0" />
          <input type="number" min="0" step="0.01" data-line-i="${i}" data-line-k="unitPrice" value="${line.unitPrice}" style="text-align:right;padding:6px 4px;width:100%;min-width:0" />
          <div class="num font-bold text-right" style="padding:6px 4px;color:var(--green)">${fmt(line.qty * line.unitPrice)}</div>
          <button type="button" class="btn ghost sm" data-line-remove="${i}" style="color:var(--red);padding:4px;min-width:0;width:100%" title="Remove line">✕</button>
        </div>
        ${line.productId ? (() => {
          const p = products.find(x => x.id === line.productId) || {};
          const threshold = p.lowStockThreshold || 3;
          const color = (overStock || inStock === 0) ? 'var(--red)' : (inStock <= threshold ? 'var(--accent-2)' : 'var(--text-mute)');
          const note = overStock ? ` — only ${inStock} available, reduce qty` : (inStock === 0 ? ' — out of stock' : (inStock <= threshold ? ' · low' : ''));
          return `<div style="font-size:10px;color:${color};padding:0 8px;margin-top:-2px;font-weight:${overStock || inStock === 0 ? '600' : '400'}">📦 ${inStock} in stock${note}</div>`;
        })() : ''}
      `;
    }).join('');
    // Wire line inputs
    wrap.querySelectorAll('[data-line-i]').forEach(el => {
      el.addEventListener('change', e => {
        const i = parseInt(el.dataset.lineI);
        const k = el.dataset.lineK;
        if (k === 'productId') {
          const pid = parseInt(el.value) || null;
          window._saleLines[i].productId = pid;
          if (pid) {
            const p = (state.products || []).find(x => x.id === pid);
            if (p) {
              window._saleLines[i].name = p.name;
              window._saleLines[i].unitPrice = p.price;
            }
          }
        } else if (k === 'qty') {
          window._saleLines[i].qty = parseInt(el.value) || 0;
        } else if (k === 'unitPrice') {
          window._saleLines[i].unitPrice = parseFloat(el.value) || 0;
        }
        renderSaleLines();
        recalcSaleTotals();
      });
      // Also fire on input for unitPrice/qty so totals stay live
      if (el.type === 'number') {
        el.addEventListener('input', e => {
          const i = parseInt(el.dataset.lineI);
          const k = el.dataset.lineK;
          if (k === 'qty') window._saleLines[i].qty = parseInt(el.value) || 0;
          if (k === 'unitPrice') window._saleLines[i].unitPrice = parseFloat(el.value) || 0;
          recalcSaleTotals();
        });
      }
    });
    wrap.querySelectorAll('[data-line-remove]').forEach(b => {
      b.addEventListener('click', () => {
        const i = parseInt(b.dataset.lineRemove);
        window._saleLines.splice(i, 1);
        renderSaleLines();
        recalcSaleTotals();
      });
    });
  }
  recalcSaleTotals();
}

function recalcSaleTotals() {
  const subtotal = window._saleLines.reduce((s, l) => s + (l.qty || 0) * (l.unitPrice || 0), 0);
  const discount = parseFloat($('#sale-discount')?.value) || 0;
  const total = Math.max(0, subtotal - discount);
  const paid = parseFloat($('#sale-paid')?.value) || 0;
  const balance = Math.max(0, total - paid);
  if ($('#sale-subtotal')) $('#sale-subtotal').textContent = fmt(subtotal);
  if ($('#sale-total')) $('#sale-total').textContent = fmt(total);
  if ($('#sale-balance')) $('#sale-balance').textContent = fmt(balance);
}

function wireSaleModal() {
  // Add line button
  $('#sale-add-line').addEventListener('click', () => {
    window._saleLines.push({ productId: null, name: '', qty: 1, unitPrice: 0 });
    renderSaleLines();
  });
  // Discount + paid recalc
  $('#sale-discount').addEventListener('input', recalcSaleTotals);
  $('#sale-paid').addEventListener('input', recalcSaleTotals);

  // Customer tab switching
  function switchCust(type) {
    window._saleCust.type = type;
    $('#cust-member-fields').style.display = type === 'member' ? 'block' : 'none';
    $('#cust-walkin-fields').style.display = type === 'walkin' ? 'block' : 'none';
    $('#cust-tab-member').style.background = type === 'member' ? 'var(--accent)' : '';
    $('#cust-tab-member').style.color = type === 'member' ? 'white' : '';
    $('#cust-tab-walkin').style.background = type === 'walkin' ? 'var(--accent)' : '';
    $('#cust-tab-walkin').style.color = type === 'walkin' ? 'white' : '';
  }
  $('#cust-tab-member').addEventListener('click', () => switchCust('member'));
  $('#cust-tab-walkin').addEventListener('click', () => switchCust('walkin'));

  bindMemberPicker('sale-cust', { placeholder: 'Search member...' });

  // Start with one empty line
  window._saleLines.push({ productId: null, name: '', qty: 1, unitPrice: 0 });
  renderSaleLines();
}

function completeSale(onDone) {
  // Validate lines
  const validLines = window._saleLines
    .filter(l => l.productId && l.qty > 0 && l.unitPrice >= 0)
    .map(l => ({
      productId: l.productId,
      name: l.name,
      qty: l.qty,
      unitPrice: l.unitPrice,
      lineTotal: l.qty * l.unitPrice,
    }));
  if (!validLines.length) { toast('Add at least one item to the cart', 'error'); return; }

  // Validate customer
  let customerType, customerId, customerName, customerPhone;
  if (window._saleCust.type === 'member') {
    const mid = parseInt($('#sale-cust').value);
    if (!mid) { toast('Pick a member or switch to Walk-in', 'error'); return; }
    const m = state.members.find(x => x.id === mid);
    customerType = 'member';
    customerId = m.id;
    customerName = m.name;
    customerPhone = m.phone || null;
  } else {
    customerName = $('#sale-walkin-name').value.trim();
    const phoneInput = readPhoneInput('sale-walkin-phone');
    customerPhone = phoneInput.phone;
    if (!customerName) { toast('Walk-in customer name required', 'error'); $('#sale-walkin-name')?.focus(); return; }
    if (!phoneInput.valid) {
      toast(phoneInput.error || 'Walk-in mobile is invalid', 'error');
      document.getElementById('sale-walkin-phone-digits')?.focus();
      return;
    }
    // Auto-link to existing member if same mobile
    const matchedMember = (state.members || []).find(m => m.phone && m.phone === customerPhone);
    if (matchedMember) {
      customerType = 'member';
      customerId = matchedMember.id;
      customerName = matchedMember.name;  // use canonical name
    } else {
      customerType = 'walkin';
      customerId = null;
    }
  }

  // Stock check
  for (const line of validLines) {
    const stock = productCurrentStock(line.productId);
    if (line.qty > stock) {
      const p = state.products.find(x => x.id === line.productId);
      if (!confirm(`Only ${stock} ${p?.name || ''} in stock — you're selling ${line.qty}. Proceed anyway?`)) return;
      break;
    }
  }

  const subtotal = validLines.reduce((s,l) => s + l.lineTotal, 0);
  const discount = parseFloat($('#sale-discount').value) || 0;
  const total = Math.max(0, subtotal - discount);
  const paid = parseFloat($('#sale-paid').value) || total;   // default to fully paid
  const balance = Math.max(0, total - paid);
  const date = $('#sale-date').value || TODAY;
  const month = date.slice(0, 7);
  const method = $('#sale-method-pos').value || 'cash';
  const notes = $('#sale-notes').value.trim() || null;

  // Auto-create linked invoice
  const ref = nextInvoiceRef();
  const desc = `Sale: ${validLines.map(l => `${l.qty}× ${l.name}`).join(' · ')}${customerName ? ' — ' + customerName : ''}`;
  const newInv = {
    id: nextId(state.invoices),
    date, description: desc, amount: total, method, month, ref,
    category: 'Product', activityType: 'sale',
    sport: null, coach: null, coachId: null,
    customerId, customerName,
  };
  state.invoices.push(newInv);

  const saleId = nextId(state.sales || []);
  state.sales.push({
    id: saleId, date, month,
    items: validLines, subtotal, discount, total, paid, balance,
    method, customerType, customerId, customerName, customerPhone, notes,
    invoiceId: newInv.id,
    createdAt: new Date().toISOString(),
  });

  save();
  closeModal();
  toast(`Sale complete · ${fmt(total)} QAR · invoice ${ref}` + (balance > 0 ? ` · ${fmt(balance)} balance` : ''), 'success');
  if (onDone) onDone(); else render();
}

window.viewSaleDetail = function(id) {
  const s = (state.sales || []).find(x => x.id === id);
  if (!s) return;
  const inv = s.invoiceId ? state.invoices.find(i => i.id === s.invoiceId) : null;
  const cust = customerInfo(s);
  showModal({
    title: `🛒 Sale Detail` + (inv ? ` · ${inv.ref}` : ''),
    body: `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
        <div>
          <div class="text-mute" style="font-size:11px">Date</div>
          <div class="font-bold">${fmtDate(s.date)}</div>
        </div>
        <div>
          <div class="text-mute" style="font-size:11px">Customer</div>
          <div class="font-bold" style="${cust.isDeleted ? 'text-decoration:line-through;color:var(--text-mute)' : ''}">${escapeHtml(cust.name || 'Walk-in')}${cust.phone ? ` · ${phoneCell(cust.phone, { stop: false })}` : ''}</div>
          <div class="text-mute" style="font-size:11px">${s.historical ? 'Historical (imported)' : s.customerType === 'member' ? '🎟 Member' : '🚶 Walk-in'}${cust.nationality ? ' · 🌍 ' + escapeHtml(cust.nationality) : ''}</div>
        </div>
      </div>
      <div class="table-wrap" style="margin-bottom:12px">
        <table>
          <thead><tr><th>Item</th><th class="text-right">Qty</th><th class="text-right">Unit</th><th class="text-right">Total</th></tr></thead>
          <tbody>
            ${(s.items || []).map(it => `<tr><td>${escapeHtml(it.name)}</td><td class="text-right num">${it.qty}</td><td class="text-right num">${fmt(it.unitPrice)}</td><td class="text-right num font-bold">${fmt(it.lineTotal)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div style="background:var(--surface-2);border-radius:8px;padding:12px;font-size:13px">
        <div style="display:flex;justify-content:space-between;padding:2px 0"><span class="text-mute">Subtotal</span><span>${fmt(s.subtotal || 0)}</span></div>
        ${s.discount ? `<div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--accent-2)"><span class="text-mute">Discount</span><span>−${fmt(s.discount)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px solid var(--border);margin-top:4px;font-size:15px"><span class="font-bold">Total</span><span class="font-bold" style="color:var(--green)">${fmt(s.total || 0)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:2px 0;margin-top:4px"><span class="text-mute">Paid</span><span>${fmt(s.paid || 0)}</span></div>
        ${(s.balance || 0) > 0 ? `<div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--accent-2)"><span class="text-mute">Balance</span><span class="font-bold">${fmt(s.balance)}</span></div>` : ''}
      </div>
      ${s.notes ? `<div class="text-mute" style="font-size:12px;margin-top:10px">📝 ${escapeHtml(s.notes)}</div>` : ''}
    `,
    actions: [
      ...(inv ? [{ label: '📄 Print Invoice', class: 'btn ghost', onclick: () => { closeModal(); printInvoicePDF(inv.id); } }] : []),
      { label: 'Close', class: 'btn primary', onclick: closeModal },
    ],
  });
};

window.deleteSale = function(id) {
  const s = (state.sales || []).find(x => x.id === id);
  if (!s) return;
  const label = s.historical ? 'historical sale' : 'sale transaction';
  if (!confirm(`Delete this ${label}? Linked invoice (if any) will also be deleted.`)) return;
  if (s.invoiceId) state.invoices = state.invoices.filter(i => i.id !== s.invoiceId);
  state.sales = state.sales.filter(x => x.id !== id);
  save();
  render();
  toast('Sale deleted');
};

// ─── SPORTS MANAGEMENT ────────────────────────────────────────────
// Admin can add, rename, disable sports. Disabled sports remain in
// historical records but won't show in any new-registration dropdown.
PAGES.sports = (main) => {
  if (!state.settings) state.settings = {};
  if (!Array.isArray(state.settings.sports) || !state.settings.sports.length) {
    state.settings.sports = ['MMA','Boxing','Kick Boxing','Karate','Taekwondo','Gymnastic','Football','Swimming','Zumba']
      .map((name, i) => ({ name, enabled: true, order: i }));
    save();
  }

  function countUsage(sportName) {
    // How many enrollments reference this sport?
    let count = 0;
    for (const m of (state.members || [])) {
      for (const e of (m.enrollments || [])) {
        if (e.sport === sportName) count++;
      }
      for (const s of (m.subscriptions || [])) {
        if (s.activity === sportName) count++;
      }
    }
    return count;
  }

  function refresh() {
    const sports = state.settings.sports.slice().sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    const tbody = $('#sports-tbody');
    if (!tbody) return;
    tbody.innerHTML = sports.length ? sports.map((s, idx) => {
      const usage = countUsage(s.name);
      const isEnabled = s.enabled !== false;
      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:18px">🥋</span>
              <div>
                <div class="font-bold">${escapeHtml(s.name)}</div>
                ${!isEnabled ? '<div class="text-mute" style="font-size:10px;color:var(--accent)">Disabled — hidden from new registrations</div>' : ''}
              </div>
            </div>
          </td>
          <td class="text-right num text-mute">${usage}</td>
          <td>
            <span class="badge ${isEnabled ? 'active' : ''}" style="${!isEnabled ? 'background:var(--surface-2);color:var(--text-mute)' : ''}">${isEnabled ? '✓ Enabled' : '✗ Disabled'}</span>
          </td>
          <td class="text-right" style="white-space:nowrap">
            <button class="btn ghost sm" onclick="moveSport('${escapeHtml(s.name)}', -1)" title="Move up" ${idx === 0 ? 'disabled' : ''}>↑</button>
            <button class="btn ghost sm" onclick="moveSport('${escapeHtml(s.name)}', 1)" title="Move down" ${idx === sports.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="btn ghost sm" onclick="editSport('${escapeHtml(s.name)}')" title="Rename">✏️</button>
            <button class="btn ghost sm" onclick="toggleSport('${escapeHtml(s.name)}')" title="${isEnabled ? 'Disable (hide from new registrations)' : 'Re-enable'}">${isEnabled ? '🚫' : '✅'}</button>
            ${usage === 0 ? `<button class="btn ghost sm" onclick="deleteSport('${escapeHtml(s.name)}')" title="Delete (only allowed when no one is registered)" style="color:var(--red)">🗑</button>` : `<button class="btn ghost sm" disabled title="Cannot delete — ${usage} enrollments use this sport" style="opacity:.4">🔒</button>`}
          </td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="4" class="empty">No sports defined. Click "+ Add Sport" to start.</td></tr>`;
    $('#sports-count').textContent = `${sports.length} sport${sports.length === 1 ? '' : 's'} · ${sports.filter(s => s.enabled !== false).length} enabled`;
  }

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Sports</h1>
        <div class="subtitle"><span id="sports-count">Loading...</span></div>
      </div>
      <div class="topbar-actions">
        <button class="btn primary" onclick="addSport()">+ Add Sport</button>
      </div>
    </div>
    <div style="background:rgba(91,141,239,.06);border:1px solid rgba(91,141,239,.2);border-radius:8px;padding:12px;margin-bottom:14px;display:flex;gap:10px;align-items:flex-start">
      <div style="font-size:20px">💡</div>
      <div style="font-size:12px;color:var(--text-dim);line-height:1.5">
        Add or rename sports here. <b>Disabled sports</b> stay in historical records (past attendance, old invoices) but won't appear in new member registration. <b>Delete</b> is only allowed when no one is registered for that sport. Renaming a sport updates every historical reference too.
      </div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Sport</th>
            <th class="text-right">Enrollments</th>
            <th>Status</th>
            <th></th>
          </tr></thead>
          <tbody id="sports-tbody"></tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="card-header">
        <div>
          <div class="card-title">🌞 Summer Camp Pricing</div>
          <div class="card-subtitle">Default prices per duration. Editable per registration. Changes here only affect future enrollments.</div>
        </div>
      </div>
      <div id="camp-prices-body" style="padding:14px"></div>
    </div>
  `;
  refresh();
  refreshCampPrices();

  function refreshCampPrices() {
    const body = $('#camp-prices-body');
    if (!body) return;
    const prices = state.settings.summerCampPrices || [];
    body.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;font-size:10px;color:var(--text-mute);text-transform:uppercase;letter-spacing:.5px;font-weight:600">
        <div>Duration label</div>
        <div>Days</div>
        <div>Price (QAR)</div>
      </div>
      ${prices.map((p, i) => `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:8px">
          <div class="field" style="margin:0"><input type="text" data-camp-i="${i}" data-camp-k="label" value="${escapeHtml(p.label)}" /></div>
          <div class="field" style="margin:0"><input type="number" min="1" step="1" data-camp-i="${i}" data-camp-k="days" value="${p.days}" /></div>
          <div class="field" style="margin:0"><input type="number" min="0" step="0.01" data-camp-i="${i}" data-camp-k="price" value="${p.price}" /></div>
        </div>
      `).join('')}
      <div style="display:flex;gap:8px;margin-top:10px">
        <button type="button" class="btn ghost sm" id="camp-add-row">+ Add tier</button>
        <button type="button" class="btn primary sm" id="camp-save">Save prices</button>
        <button type="button" class="btn ghost sm" id="camp-reset" style="color:var(--text-mute);margin-left:auto">Reset to defaults</button>
      </div>
    `;
    body.querySelectorAll('[data-camp-i]').forEach(inp => {
      inp.addEventListener('input', e => {
        const i = parseInt(e.target.dataset.campI);
        const k = e.target.dataset.campK;
        const v = e.target.value;
        if (!state.settings.summerCampPrices[i]) return;
        state.settings.summerCampPrices[i][k] = (k === 'label') ? v : (parseFloat(v) || 0);
      });
    });
    $('#camp-add-row').addEventListener('click', () => {
      state.settings.summerCampPrices.push({ label: '', days: 0, price: 0 });
      refreshCampPrices();
    });
    $('#camp-save').addEventListener('click', () => {
      // Clean: drop rows with empty label or 0 days
      state.settings.summerCampPrices = state.settings.summerCampPrices.filter(p =>
        p.label && p.label.trim() && p.days > 0
      );
      save();
      toast(`Saved ${state.settings.summerCampPrices.length} Summer Camp tiers`);
      refreshCampPrices();
    });
    $('#camp-reset').addEventListener('click', () => {
      if (!confirm('Reset Summer Camp prices to the original defaults (1d=175, 1w=650, 1m=1750, 2m=3000)?')) return;
      state.settings.summerCampPrices = [
        { label: '1 day',    days: 1,  price: 175  },
        { label: '1 week',   days: 7,  price: 650  },
        { label: '1 month',  days: 30, price: 1750 },
        { label: '2 months', days: 60, price: 3000 },
      ];
      save();
      refreshCampPrices();
      toast('Summer Camp prices reset to defaults');
    });
  }
};

window.addSport = function() {
  showModal({
    title: 'Add New Sport',
    body: `
      <div class="field">
        <label>Sport name</label>
        <input id="new-sport-name" placeholder="e.g. Jiu-Jitsu" autofocus />
      </div>
      <div class="text-mute" style="font-size:11px;margin-top:6px">
        💡 Will appear in all new-member dropdowns. Don't include emojis or special characters.
      </div>
    `,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: 'Add', class: 'btn primary', onclick: () => {
        const name = $('#new-sport-name').value.trim();
        if (!name) { toast('Sport name required', 'error'); return; }
        if (state.settings.sports.some(s => s.name.toLowerCase() === name.toLowerCase())) {
          toast(`"${name}" already exists`, 'error');
          return;
        }
        const maxOrder = Math.max(0, ...state.settings.sports.map(s => s.order ?? 0));
        state.settings.sports.push({ name, enabled: true, order: maxOrder + 1 });
        save(); closeModal(); render();
        toast(`Sport added: ${name}`);
      }},
    ],
  });
};

window.editSport = function(oldName) {
  const s = state.settings.sports.find(x => x.name === oldName);
  if (!s) return;
  showModal({
    title: `Rename Sport`,
    body: `
      <div class="field">
        <label>Current name</label>
        <input value="${escapeHtml(oldName)}" disabled style="opacity:.5" />
      </div>
      <div class="field">
        <label>New name</label>
        <input id="edit-sport-name" value="${escapeHtml(oldName)}" autofocus />
      </div>
      <div class="text-mute" style="font-size:11px;margin-top:6px">
        ⚠️ Renaming updates this sport in <b>every</b> historical record (enrollments, attendance, invoices, schedule). This is destructive — make sure you want to do this.
      </div>
    `,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: 'Rename', class: 'btn primary', onclick: () => {
        const newName = $('#edit-sport-name').value.trim();
        if (!newName) { toast('Name required', 'error'); return; }
        if (newName === oldName) { closeModal(); return; }
        if (state.settings.sports.some(x => x.name === newName && x !== s)) {
          toast(`"${newName}" already exists`, 'error');
          return;
        }
        // Cascade rename
        s.name = newName;
        let changedCount = 0;
        for (const m of (state.members || [])) {
          if (m.sport === oldName) { m.sport = newName; changedCount++; }
          for (const e of (m.enrollments || [])) {
            if (e.sport === oldName) { e.sport = newName; changedCount++; }
          }
          for (const sub of (m.subscriptions || [])) {
            if (sub.activity === oldName) { sub.activity = newName; changedCount++; }
          }
          // Rename within attendance keys
          if (m.dailyAttendance) {
            for (const mk of Object.keys(m.dailyAttendance)) {
              const mo = m.dailyAttendance[mk];
              if (mo && typeof mo === 'object' && mo[oldName]) {
                mo[newName] = mo[oldName];
                delete mo[oldName];
                changedCount++;
              }
            }
          }
          // Rename in sport switches
          for (const sw of (m.sportSwitches || [])) {
            if (sw.fromSport === oldName) sw.fromSport = newName;
            if (sw.toSport === oldName) sw.toSport = newName;
          }
        }
        for (const c of (state.coaches || [])) {
          if (Array.isArray(c.sports)) {
            c.sports = c.sports.map(s => s === oldName ? newName : s);
          }
        }
        for (const inv of (state.invoices || [])) {
          if (inv.sport === oldName) inv.sport = newName;
          for (const li of (inv.lineItems || [])) {
            if (li.sport === oldName) li.sport = newName;
          }
        }
        for (const sc of (state.schedule || [])) {
          if (sc.sport === oldName) sc.sport = newName;
        }
        save(); closeModal(); render();
        toast(`Renamed → "${newName}" (${changedCount} record${changedCount === 1 ? '' : 's'} updated)`);
      }},
    ],
  });
};

window.toggleSport = function(name) {
  const s = state.settings.sports.find(x => x.name === name);
  if (!s) return;
  s.enabled = !(s.enabled !== false); // flip
  save(); render();
  toast(`${name} ${s.enabled ? 'enabled' : 'disabled'}`);
};

window.deleteSport = function(name) {
  if (!confirm(`Delete sport "${name}"? This is only allowed because no member is currently enrolled in it. This cannot be undone.`)) return;
  state.settings.sports = state.settings.sports.filter(s => s.name !== name);
  save(); render();
  toast(`Deleted: ${name}`);
};

window.moveSport = function(name, delta) {
  const sports = state.settings.sports;
  sports.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const idx = sports.findIndex(s => s.name === name);
  if (idx < 0) return;
  const newIdx = idx + delta;
  if (newIdx < 0 || newIdx >= sports.length) return;
  // Swap
  [sports[idx], sports[newIdx]] = [sports[newIdx], sports[idx]];
  // Re-number
  sports.forEach((s, i) => s.order = i);
  save(); render();
};

// ─── SETTINGS ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════
// AUDIT LOG PAGE — view who changed what, when.
// Read-only. Records hooked from key actions in app.js audit() helper.
// ═══════════════════════════════════════════════════════════════════
PAGES.audit = (main) => {
  let filter = { search: '', action: 'all', days: '30' };
  const pg = makePager(50);

  function refresh() {
    const log = Array.isArray(state.auditLog) ? state.auditLog : [];
    // Newest first
    const sorted = [...log].sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
    const cutoff = filter.days === 'all' ? null
      : new Date(Date.now() - parseInt(filter.days) * 86400000).toISOString();
    const all = sorted.filter(e => {
      if (cutoff && e.ts < cutoff) return false;
      if (filter.action !== 'all' && !e.action.startsWith(filter.action)) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase();
        const hay = [e.action, e.target, e.summary, e.user].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const rows = paginate(all, pg);

    $('#audit-count').textContent = `${all.length} entries${cutoff ? ' · last ' + filter.days + ' days' : ''}`;
    $('#audit-tbody').innerHTML = rows.length ? rows.map(e => {
      const ts = new Date(e.ts);
      const dateStr = isNaN(ts) ? '—' : ts.toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:false });
      const actionColor = e.action.includes('archive') ? 'var(--red)'
                       : e.action.includes('restore') ? 'var(--green)'
                       : e.action.includes('withdraw') ? 'var(--accent-2)'
                       : 'var(--blue)';
      return `
        <tr>
          <td class="text-mute" style="white-space:nowrap;font-size:11px">${dateStr}</td>
          <td><span class="badge" style="font-family:'JetBrains Mono',monospace;font-size:10px;color:${actionColor}">${escapeHtml(e.action)}</span></td>
          <td style="font-weight:500">${escapeHtml(e.summary || '—')}</td>
          <td class="text-mute" style="font-size:11px">${escapeHtml(e.user || 'unknown')}</td>
          <td class="text-mute" style="font-family:'JetBrains Mono',monospace;font-size:10px">${escapeHtml(e.target || '')}</td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="5" class="empty"><div class="empty-icon">📋</div>No audit entries match these filters</td></tr>`;

    $('#audit-pagination').innerHTML = paginationBar(pg, all.length, 'audit');
    bindPagination('audit', pg, all.length, refresh);
  }

  // Build list of action prefixes present
  const log = Array.isArray(state.auditLog) ? state.auditLog : [];
  const prefixes = [...new Set(log.map(e => (e.action || '').split('.')[0]))].filter(Boolean).sort();

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Audit Log</h1>
        <div class="subtitle"><span id="audit-count">Loading…</span> · last 1000 actions retained</div>
      </div>
      <div class="topbar-actions">
        <button class="btn ghost" id="audit-export">📥 Export CSV</button>
        <button class="btn ghost" id="audit-clear" title="Permanently clear the audit log">🗑 Clear</button>
      </div>
    </div>
    <div class="card">
      <div class="filter-bar">
        <div class="search"><input id="audit-search" type="text" placeholder="Search action, summary, user…" /></div>
        <select id="audit-action" class="btn ghost">
          <option value="all">All actions</option>
          ${prefixes.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}
        </select>
        <select id="audit-days" class="btn ghost">
          <option value="7">Last 7 days</option>
          <option value="30" selected>Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th style="width:140px">When</th>
            <th style="width:140px">Action</th>
            <th>What happened</th>
            <th style="width:100px">By</th>
            <th style="width:120px">Target</th>
          </tr></thead>
          <tbody id="audit-tbody"></tbody>
        </table>
      </div>
      <div id="audit-pagination"></div>
    </div>
  `;
  $('#audit-search').addEventListener('input', e => { filter.search = e.target.value; pg.page = 1; refresh(); });
  $('#audit-action').addEventListener('change', e => { filter.action = e.target.value; pg.page = 1; refresh(); });
  $('#audit-days').addEventListener('change', e => { filter.days = e.target.value; pg.page = 1; refresh(); });
  $('#audit-export').addEventListener('click', () => {
    const log = state.auditLog || [];
    if (!log.length) { toast('Nothing to export', 'error'); return; }
    const csv = [
      ['Timestamp','User','Action','Target','Summary'],
      ...log.map(e => [e.ts, e.user, e.action, e.target, e.summary]),
    ].map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadFile(`audit-log-${TODAY}.csv`, csv, 'text/csv');
    toast(`Exported ${log.length} entries`);
  });
  $('#audit-clear').addEventListener('click', () => {
    if (!confirm('Clear the entire audit log? This cannot be undone.\n\n(Tip: Export to CSV first if you need a copy.)')) return;
    state.auditLog = [];
    save();
    render();
    toast('Audit log cleared');
  });
  refresh();
};

PAGES.settings = (main) => {
  // Ensure settings exists
  if (!state.settings) state.settings = {};
  const cur = state.settings;

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Settings</h1>
        <div class="subtitle">Application configuration</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div><div class="card-title">Appearance</div><div class="card-subtitle">Choose how the app looks — your selection is saved per browser</div></div></div>
      <div id="theme-picker" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:6px">
        <div class="theme-card" data-theme-value="dark" style="cursor:pointer;border:2px solid ${getTheme()==='dark'?'var(--accent)':'var(--border)'};border-radius:10px;padding:14px;background:#0a0e1a;color:#e8eaf0">
          <div style="display:flex;gap:6px;margin-bottom:10px">
            <span style="width:18px;height:18px;border-radius:50%;background:#f26060"></span>
            <span style="width:18px;height:18px;border-radius:50%;background:#f2a33c"></span>
            <span style="width:18px;height:18px;border-radius:50%;background:#5b8def"></span>
            <span style="width:18px;height:18px;border-radius:50%;background:#10b981"></span>
          </div>
          <div style="font-weight:700;font-size:14px">🌙 Dark</div>
          <div style="font-size:11px;opacity:.7;margin-top:2px">Default · easy at night</div>
          ${getTheme()==='dark'?'<div style="margin-top:8px;font-size:11px;color:#f26060;font-weight:600">✓ Active</div>':''}
        </div>
        <div class="theme-card" data-theme-value="light" style="cursor:pointer;border:2px solid ${getTheme()==='light'?'var(--accent)':'var(--border)'};border-radius:10px;padding:14px;background:#f5f6fa;color:#1a1d2b">
          <div style="display:flex;gap:6px;margin-bottom:10px">
            <span style="width:18px;height:18px;border-radius:50%;background:#e54d4d"></span>
            <span style="width:18px;height:18px;border-radius:50%;background:#e89331"></span>
            <span style="width:18px;height:18px;border-radius:50%;background:#3a6fd6"></span>
            <span style="width:18px;height:18px;border-radius:50%;background:#0d8f63"></span>
          </div>
          <div style="font-weight:700;font-size:14px">☀️ Light</div>
          <div style="font-size:11px;opacity:.7;margin-top:2px">Bright · daytime work</div>
          ${getTheme()==='light'?'<div style="margin-top:8px;font-size:11px;color:#e54d4d;font-weight:600">✓ Active</div>':''}
        </div>
        <div class="theme-card" data-theme-value="cream" style="cursor:pointer;border:2px solid ${getTheme()==='cream'?'var(--accent)':'var(--border)'};border-radius:10px;padding:14px;background:#f7f2e8;color:#2d2a1f">
          <div style="display:flex;gap:6px;margin-bottom:10px">
            <span style="width:18px;height:18px;border-radius:50%;background:#4a7c3a"></span>
            <span style="width:18px;height:18px;border-radius:50%;background:#c97a2a"></span>
            <span style="width:18px;height:18px;border-radius:50%;background:#2f6d8f"></span>
            <span style="width:18px;height:18px;border-radius:50%;background:#a8842a"></span>
          </div>
          <div style="font-weight:700;font-size:14px">📜 Soft Cream</div>
          <div style="font-size:11px;opacity:.7;margin-top:2px">Paper-like · easy reading</div>
          ${getTheme()==='cream'?'<div style="margin-top:8px;font-size:11px;color:#4a7c3a;font-weight:600">✓ Active</div>':''}
        </div>
        <div class="theme-card" data-theme-value="colorful" style="cursor:pointer;border:2px solid ${getTheme()==='colorful'?'var(--accent)':'var(--border)'};border-radius:10px;padding:14px;background:linear-gradient(135deg,#1a0f2e,#2f1d44);color:#f5e9ff">
          <div style="display:flex;gap:6px;margin-bottom:10px">
            <span style="width:18px;height:18px;border-radius:50%;background:#ff4d8d"></span>
            <span style="width:18px;height:18px;border-radius:50%;background:#ffb340"></span>
            <span style="width:18px;height:18px;border-radius:50%;background:#5cd6ff"></span>
            <span style="width:18px;height:18px;border-radius:50%;background:#c77dff"></span>
          </div>
          <div style="font-weight:700;font-size:14px">🎨 Colorful</div>
          <div style="font-size:11px;opacity:.7;margin-top:2px">Vibrant · energetic</div>
          ${getTheme()==='colorful'?'<div style="margin-top:8px;font-size:11px;color:#ff4d8d;font-weight:600">✓ Active</div>':''}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div><div class="card-title">Preferences</div><div class="card-subtitle">Customize alerts and thresholds</div></div></div>
      <div class="form-row">
        <div class="field">
          <label>Expiring-soon alert (days before expiry)</label>
          <input id="pref-expdays" type="number" min="1" max="60" value="${cur.expiringSoonDays || 3}" />
          <div class="text-mute" style="font-size:11px;margin-top:4px">Members are flagged as "expiring soon" this many days before their expiry date.</div>
        </div>
        <div class="field">
          <label>Recently-expired window (days)</label>
          <input id="pref-recentexp" type="number" min="1" max="90" value="${cur.recentlyExpiredDays || 15}" />
          <div class="text-mute" style="font-size:11px;margin-top:4px">The Expiring page's "Recently expired" button shows members who expired within this many days (win-back window).</div>
        </div>
        <div class="field">
          <label>Low stock threshold (units)</label>
          <input id="pref-lowstock" type="number" min="0" max="100" value="${cur.lowStockThreshold ?? 3}" />
          <div class="text-mute" style="font-size:11px;margin-top:4px">Inventory items at or below this count are flagged LOW.</div>
        </div>
      </div>
      <div class="form-row">
        <div class="field">
          <label>Duplicate QID handling</label>
          <select id="pref-qidmode">
            <option value="block" ${(cur.qidDuplicateMode || 'block') === 'block' ? 'selected' : ''}>Block &amp; open the existing member (recommended)</option>
            <option value="warn" ${cur.qidDuplicateMode === 'warn' ? 'selected' : ''}>Warn only — allow saving after confirmation</option>
          </select>
          <div class="text-mute" style="font-size:11px;margin-top:4px">A national ID belongs to one person. "Block" reopens the existing record; "Warn" lets you save anyway after a confirmation. (Mobile + Name duplicates are always blocked.)</div>
        </div>
      </div>
      <div class="form-row">
        <div class="field">
          <label>Refund grace period (days)</label>
          <input id="pref-refundgrace" type="number" min="0" max="90" value="${cur.refundGraceDays ?? 7}" />
          <div class="text-mute" style="font-size:11px;margin-top:4px">Within this many days of a sport's start, a withdrawal refunds the full unused amount (no admin fee).</div>
        </div>
        <div class="field">
          <label>Admin fee after grace (%)</label>
          <input id="pref-refundfee" type="number" min="0" max="100" value="${cur.refundFeePct ?? 20}" />
          <div class="text-mute" style="font-size:11px;margin-top:4px">After the grace period, this % of the unused amount is kept as an admin fee on withdrawals. (You can still override the refund per withdrawal.)</div>
        </div>
      </div>
      <div style="margin-top:12px"><button class="btn primary" id="save-prefs">💾 Save preferences</button></div>
    </div>

    <div class="card">
      <div class="card-header"><div><div class="card-title">Coach Commission Rates</div><div class="card-subtitle">Commission is calculated as this % of each coach's total paid amount (subscription value)</div></div></div>
      <div style="background:var(--surface-2);border-radius:8px;padding:12px;margin-bottom:14px">
        <label style="font-weight:600;font-size:13px;display:block;margin-bottom:6px">Commission basis</label>
        <select id="pref-commbasis" style="min-width:300px">
          <option value="payment" ${(cur.commissionBasis || 'payment') === 'payment' ? 'selected' : ''}>By payment — full fee counts in the month paid (current)</option>
          <option value="attendance" ${cur.commissionBasis === 'attendance' ? 'selected' : ''}>By attendance — per class attended; the rest shows as pending</option>
        </select>
        <div class="text-mute" style="font-size:11px;margin-top:6px;line-height:1.5">
          <b>By payment</b> is the original behaviour. <b>By attendance</b> pays each coach per class the member actually attends, in the month attended; paid-but-unattended classes appear as <b>pending</b> and pay out as they're attended or when the membership ends. Memberships with no class count and sport-switch credits stay on the payment basis. This changes how payroll is calculated from now on — it does <b>not</b> rewrite past payments. <b>Requires attendance to be marked each month.</b>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Coach</th><th>Status</th><th style="width:160px">Commission rate (%)</th></tr></thead>
          <tbody>
            ${state.coaches.map(c => `
              <tr style="${isCoachActive(c) ? '' : 'opacity:.55'}">
                <td>
                  <div style="display:flex;align-items:center;gap:10px">
                    <div class="avatar" style="width:28px;height:28px;font-size:10px;background:linear-gradient(135deg,var(--blue),var(--purple))">${initials(c.name)}</div>
                    <span class="font-bold">${escapeHtml(c.name)}</span>
                  </div>
                </td>
                <td><span class="badge ${isCoachActive(c) ? 'active' : 'expired'}" style="font-size:9px">${isCoachActive(c) ? 'Active' : 'Inactive'}</span></td>
                <td><input class="comm-rate" data-coach="${c.id}" type="number" min="0" max="100" step="0.5" value="${c.rate}" style="width:120px" /></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:12px"><button class="btn primary" id="save-commissions">💾 Save commission rates</button></div>
    </div>

    <div class="card">
      <div class="card-header"><div><div class="card-title">💸 Expense Categories</div><div class="card-subtitle">Customize the categories shown in the New Expense form. "Others" is always available and cannot be removed.</div></div></div>
      <div id="cat-rows" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
        ${EXP_CATS.map((c, i) => {
          const usage = (state.expenses || []).filter(e => e.category === c).length;
          const isReserved = RESERVED_EXPENSE_CATEGORIES.includes(c);
          const canDelete = !isReserved && usage === 0;
          return `
            <div class="cat-row" data-cat="${escapeHtml(c)}" style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--surface-2);border-radius:8px;border:1px solid var(--border)">
              <span style="font-size:14px;font-weight:600;flex:1">${escapeHtml(c)}${isReserved ? ' <span class="badge" style="font-size:9px;padding:1px 6px;margin-left:6px">RESERVED</span>' : ''}</span>
              <span class="text-mute" style="font-size:11px">${usage} use${usage === 1 ? '' : 's'}</span>
              ${canDelete
                ? `<button class="btn ghost sm" data-cat-delete="${escapeHtml(c)}" style="color:var(--red)" title="Delete this category">🗑</button>`
                : `<button class="btn ghost sm" disabled style="opacity:.4" title="${isReserved ? 'Reserved — cannot be deleted' : usage + ' expense' + (usage === 1 ? '' : 's') + ' use this category — cannot be deleted'}">🔒</button>`}
            </div>
          `;
        }).join('')}
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
        <input id="cat-new" type="text" placeholder="New category name..." style="flex:1;padding:9px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)" />
        <button class="btn primary" id="cat-add">+ Add category</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div><div class="card-title">💬 WhatsApp Reminder Templates</div><div class="card-subtitle">Bilingual messages auto-sent from the Expiring page. Tokens: <code style="background:var(--surface-2);padding:1px 5px;border-radius:3px;font-size:11px">{name}</code> <code style="background:var(--surface-2);padding:1px 5px;border-radius:3px;font-size:11px">{nameArabic}</code> <code style="background:var(--surface-2);padding:1px 5px;border-radius:3px;font-size:11px">{sport}</code> <code style="background:var(--surface-2);padding:1px 5px;border-radius:3px;font-size:11px">{coach}</code> <code style="background:var(--surface-2);padding:1px 5px;border-radius:3px;font-size:11px">{expiry}</code> <code style="background:var(--surface-2);padding:1px 5px;border-radius:3px;font-size:11px">{daysAgo}</code> <code style="background:var(--surface-2);padding:1px 5px;border-radius:3px;font-size:11px">{daysLeft}</code></div></div></div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
        <div class="field" style="margin:0">
          <label style="display:flex;align-items:center;gap:6px"><span style="background:rgba(239,68,68,.15);color:var(--red);padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">EXPIRED</span> English</label>
          <textarea id="tpl-expired-en" rows="8" style="width:100%;padding:10px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;font-size:12px;line-height:1.5;resize:vertical">${escapeHtml(reminderTemplate('expired_en'))}</textarea>
        </div>
        <div class="field" style="margin:0">
          <label style="display:flex;align-items:center;gap:6px"><span style="background:rgba(239,68,68,.15);color:var(--red);padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">EXPIRED</span> العربية</label>
          <textarea id="tpl-expired-ar" rows="8" dir="rtl" style="width:100%;padding:10px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;font-size:12px;line-height:1.5;resize:vertical">${escapeHtml(reminderTemplate('expired_ar'))}</textarea>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
        <div class="field" style="margin:0">
          <label style="display:flex;align-items:center;gap:6px"><span style="background:rgba(245,158,11,.15);color:var(--accent-2);padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">EXPIRING SOON</span> English</label>
          <textarea id="tpl-expiring-en" rows="8" style="width:100%;padding:10px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;font-size:12px;line-height:1.5;resize:vertical">${escapeHtml(reminderTemplate('expiring_en'))}</textarea>
        </div>
        <div class="field" style="margin:0">
          <label style="display:flex;align-items:center;gap:6px"><span style="background:rgba(245,158,11,.15);color:var(--accent-2);padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">EXPIRING SOON</span> العربية</label>
          <textarea id="tpl-expiring-ar" rows="8" dir="rtl" style="width:100%;padding:10px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;font-size:12px;line-height:1.5;resize:vertical">${escapeHtml(reminderTemplate('expiring_ar'))}</textarea>
        </div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn primary" id="save-tpls">💾 Save templates</button>
        <button class="btn ghost" id="reset-tpls" title="Restore the default English + Arabic messages">↻ Restore defaults</button>
        <button class="btn ghost" id="preview-tpl" title="Open WhatsApp with a sample message using the first member">👁 Preview</button>
        <span class="text-mute" style="font-size:11px;margin-left:auto">If a member has no Arabic name, only the English section is sent.</span>
      </div>
    </div>

    <div class="card" style="border:1px solid var(--accent);background:var(--surface)">
      <div class="card-header"><div><div class="card-title" style="color:var(--accent)">🔍 Diagnostic</div><div class="card-subtitle">If the data looks wrong (old coaches showing, stale numbers), use Hard Reset below</div></div></div>
      <table style="width:100%">
        <tbody>
          <tr><td style="padding:4px 0">App version (code)</td><td class="text-right" style="font-family:monospace;font-size:12px">${SEED_VERSION}</td></tr>
          <tr><td style="padding:4px 0">Storage backend</td><td class="text-right font-bold" style="font-size:12px">${isCloudStorage() ? '☁️ Firebase (cloud, syncs across devices)' : '💾 This browser (localStorage)'}</td></tr>
          <tr><td style="padding:4px 0">Data version (${isCloudStorage() ? 'local cache' : 'localStorage'})</td><td class="text-right" style="font-family:monospace;font-size:12px;color:${localStorage.getItem(LS_VERSION_KEY)===SEED_VERSION?'var(--green)':'var(--accent-2)'}">${localStorage.getItem(LS_VERSION_KEY) || '(none — using seed)'}</td></tr>
          <tr><td style="padding:4px 0">Coaches loaded</td><td class="text-right font-bold">${state.coaches.length} ${state.coaches.length===7?'✓':'⚠️ expected 7'}</td></tr>
          <tr><td style="padding:4px 0">Members loaded</td><td class="text-right font-bold">${state.members.length}</td></tr>
        </tbody>
      </table>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn danger" id="hard-reset-btn">🔥 Hard Reset (wipe localStorage + reload)</button>
      </div>
      <div class="text-mute" style="font-size:11px;margin-top:8px">
        Last-resort recovery. Clears this browser's local cache and reloads with an empty database. Use only if the app is misbehaving badly. <b>Make a backup first!</b>${isCloudStorage() ? ' <b>Note:</b> because cloud storage is active, this only clears the local cache — your cloud data will sync back on reload. To truly empty the database, use “🗑 Clear all data” above (which also clears the cloud copy).' : ''}
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div><div class="card-title">👥 Roles — preview</div><div class="card-subtitle">See the app the way each role would. This previews which screens each role gets.</div></div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <label style="font-weight:600;font-size:13px;margin-right:4px">View as</label>
        <button class="btn ${currentRole() === 'admin' ? 'primary' : 'ghost'}" onclick="setPreviewRole('admin')">🛡 Admin (full)</button>
        <button class="btn ${currentRole() === 'coach' ? 'primary' : 'ghost'}" onclick="setPreviewRole('coach')">🥋 Coach</button>
        <button class="btn ${currentRole() === 'student' ? 'primary' : 'ghost'}" onclick="setPreviewRole('student')">🎓 Student</button>
      </div>
      <div class="text-mute mt-3" style="font-size:12px;line-height:1.6">
        <b>Admin</b> sees everything · <b>Coach</b> sees Schedule, Summer Camp, Attendance, Trials · <b>Student</b> sees Schedule &amp; Summer Camp only. While previewing, an <b>Exit</b> button (top-left) returns you to Admin.<br>
        ℹ️ This is a quick <b>view preview</b> for admins. Real per-account access is set in <b>Users &amp; Roles</b> below and enforced at sign-in.
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div><div class="card-title">🔐 Users &amp; Roles</div><div class="card-subtitle">Map each login email to a role. Enforced when that account signs in (cloud).</div></div></div>
      <div id="user-roles-list">${userRolesListHtml()}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center">
        <button class="btn primary sm" onclick="editUserRole()">＋ Add user mapping</button>
        <label style="font-size:12px;margin-left:8px">Unmapped accounts default to:</label>
        <select id="unmapped-role" onchange="setUnmappedRole(this.value)" style="padding:4px 8px">
          <option value="admin" ${(state.settings?.unmappedRole || 'admin') === 'admin' ? 'selected' : ''}>Admin (safe default — no lock-out)</option>
          <option value="student" ${(state.settings?.unmappedRole) === 'student' ? 'selected' : ''}>Student (least privilege)</option>
        </select>
      </div>
      <div class="text-mute mt-3" style="font-size:12px;line-height:1.6">
        ☁️ You create the actual accounts &amp; passwords in <b>Firebase Console → Authentication → Add user</b>. Here you only set what role each email gets. A <b>Coach</b> mapping is linked to a coach record; a <b>Student</b> mapping to a member record. Keep at least one <b>Admin</b> mapped (e.g. your own email) before switching unmapped accounts to Student.
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div><div class="card-title">Data Management</div><div class="card-subtitle">Full backup &amp; restore · daily backups</div></div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn primary" id="backup-btn">💾 Backup all data (1 JSON file)</button>
        <button class="btn ghost" id="restore-btn">📂 Restore from backup</button>
        <button class="btn danger" id="reset-btn">🗑 Clear all data (start empty)</button>
        <button class="btn ghost" id="demo-btn" title="Replace your current data with the bundled demo data (207 sample members). For exploring features.">🧪 Load demo data</button>
        <button class="btn ghost" id="fixnames-btn" title="Correct member English names to Title Case (anas madni → Anas Madni)">Aa Fix name capitalisation</button>
        <input type="file" id="restore-file" accept=".json" style="display:none" />
      </div>
      <div class="text-mute mt-3" style="font-size:12px">
        ${isCloudStorage()
          ? `<b>☁️ Cloud storage is active.</b> Your data is stored in Firebase and syncs across every device you sign in on — it is <b>not</b> tied to this browser. <b>Backup all data</b> still lets you save a single <code>blackstars-backup-${TODAY}.json</code> file as an independent offline copy (handy if the cloud copy is ever changed by mistake). <b>Restore from backup</b> loads such a file back in and replaces the current data (it auto-saves a safety copy first).`
          : `<b>Backup all data</b> saves your <b>entire</b> database — every member, invoice, payment, attendance record, product, expense, salary and setting — into a single <code>blackstars-backup-${TODAY}.json</code> file. Do this <b>daily</b> and keep the file safe; if the app ever crashes or data is lost, use <b>Restore from backup</b> to load that file and you're back exactly where you were. Restore replaces all current data, but it auto-downloads a safety copy of what's there first, so it's reversible.`}
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div><div class="card-title">Storage Stats</div></div></div>
      <table>
        <tbody>
          <tr><td>Members</td><td class="text-right font-bold num">${state.members.length}</td></tr>
          <tr><td>Coaches</td><td class="text-right font-bold num">${state.coaches.length}</td></tr>
          <tr><td>Trials</td><td class="text-right font-bold num">${(state.trials || []).length}</td></tr>
          <tr><td>Invoices</td><td class="text-right font-bold num">${state.invoices.length}</td></tr>
          <tr><td>Expenses</td><td class="text-right font-bold num">${state.expenses.length}</td></tr>
          <tr><td>Salaries</td><td class="text-right font-bold num">${state.salaries.length}</td></tr>
          <tr><td>Sales items</td><td class="text-right font-bold num">${state.sales.length}</td></tr>
          <tr><td>localStorage size</td><td class="text-right font-bold num">${fmt((localStorage.getItem(LS_KEY) || '').length / 1024)} KB</td></tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <div class="card-header"><div><div class="card-title">About</div></div></div>
      <table>
        <tbody>
          <tr><td>Application</td><td class="text-right">Black Stars CRM</td></tr>
          <tr><td>Version</td><td class="text-right">1.0.0</td></tr>
          <tr><td>Data period</td><td class="text-right">${(() => {
            const months = [...new Set(state.invoices.map(i => i.month).filter(Boolean))].sort();
            if (!months.length) return '—';
            if (months.length === 1) return fmtMonth(months[0]);
            return fmtMonth(months[0]) + ' – ' + fmtMonth(months[months.length-1]);
          })()}</td></tr>
          <tr><td>Today</td><td class="text-right">${fmtDate(TODAY)}</td></tr>
        </tbody>
      </table>
    </div>
  `;

  $('#save-prefs').addEventListener('click', () => {
    const days = parseInt($('#pref-expdays').value);
    const lowStock = parseInt($('#pref-lowstock').value);
    if (isNaN(days) || days < 1) { toast('Days must be ≥ 1', 'error'); return; }
    state.settings.expiringSoonDays = days;
    const recentExp = parseInt($('#pref-recentexp')?.value);
    if (!isNaN(recentExp) && recentExp >= 1) state.settings.recentlyExpiredDays = recentExp;
    state.settings.lowStockThreshold = isNaN(lowStock) ? 3 : lowStock;
    const qidMode = $('#pref-qidmode')?.value;
    if (qidMode === 'block' || qidMode === 'warn') state.settings.qidDuplicateMode = qidMode;
    const grace = parseInt($('#pref-refundgrace')?.value);
    const fee = parseFloat($('#pref-refundfee')?.value);
    if (!isNaN(grace) && grace >= 0) state.settings.refundGraceDays = grace;
    if (!isNaN(fee) && fee >= 0 && fee <= 100) state.settings.refundFeePct = fee;
    save();
    toast(`Preferences saved (alert ${days} days before expiry)`);
  });

  // Theme picker
  $$('.theme-card').forEach(card => {
    card.addEventListener('click', () => {
      const name = card.dataset.themeValue;
      setTheme(name);
      render();   // re-render so the "Active" badges and borders update
      toast(`Theme: ${name.charAt(0).toUpperCase() + name.slice(1)}`);
    });
  });

  $('#save-commissions').addEventListener('click', () => {
    let changed = 0;
    $$('.comm-rate').forEach(inp => {
      const id = parseInt(inp.dataset.coach);
      const rate = parseFloat(inp.value);
      if (isNaN(rate) || rate < 0 || rate > 100) return;
      const c = state.coaches.find(x => x.id === id);
      if (c && c.rate !== rate) { c.rate = rate; changed++; }
    });
    if (!state.settings) state.settings = {};
    const basisSel = $('#pref-commbasis');
    const newBasis = basisSel && basisSel.value === 'attendance' ? 'attendance' : 'payment';
    const basisChanged = state.settings.commissionBasis !== newBasis;
    state.settings.commissionBasis = newBasis;
    save();
    render();
    toast(changed || basisChanged ? `Saved${changed ? ` · ${changed} rate${changed !== 1 ? 's' : ''}` : ''}${basisChanged ? ` · basis: ${newBasis}` : ''}` : 'No changes to save');
  });

  // ── Expense categories management ─────────────────────────────
  // Lazy-init from defaults on first edit if not yet set
  function ensureCategories() {
    if (!state.settings) state.settings = {};
    if (!Array.isArray(state.settings.expenseCategories) || !state.settings.expenseCategories.length) {
      state.settings.expenseCategories = [...DEFAULT_EXPENSE_CATEGORIES];
    }
  }
  $('#cat-add')?.addEventListener('click', () => {
    const inp = $('#cat-new');
    const name = (inp?.value || '').trim();
    if (!name) { toast('Enter a category name', 'error'); inp?.focus(); return; }
    if (name.length > 40) { toast('Category name is too long (max 40 chars)', 'error'); return; }
    ensureCategories();
    // Case-insensitive duplicate check
    if (state.settings.expenseCategories.some(c => c.toLowerCase() === name.toLowerCase())) {
      toast(`"${name}" already exists`, 'error');
      return;
    }
    state.settings.expenseCategories.push(name);
    save();
    render();
    toast(`Added category: ${name}`);
  });
  document.querySelectorAll('[data-cat-delete]').forEach(btn => {
    btn.addEventListener('click', e => {
      const name = e.currentTarget.dataset.catDelete;
      if (RESERVED_EXPENSE_CATEGORIES.includes(name)) {
        toast(`"${name}" is reserved and cannot be deleted`, 'error');
        return;
      }
      const usage = (state.expenses || []).filter(x => x.category === name).length;
      if (usage > 0) {
        toast(`"${name}" is used by ${usage} expense${usage === 1 ? '' : 's'} — cannot delete`, 'error');
        return;
      }
      if (!confirm(`Delete category "${name}"?\n\nThis only removes it from the dropdown. No expense data is affected.`)) return;
      ensureCategories();
      state.settings.expenseCategories = state.settings.expenseCategories.filter(c => c !== name);
      save();
      render();
      toast(`Deleted: ${name}`);
    });
  });
  // Allow Enter key in the new-category input to trigger Add
  $('#cat-new')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); $('#cat-add')?.click(); }
  });

  // ── Reminder templates ─────────────────────────────────────────
  $('#save-tpls')?.addEventListener('click', () => {
    if (!state.settings) state.settings = {};
    state.settings.reminderTemplates = {
      expired_en:  $('#tpl-expired-en').value,
      expired_ar:  $('#tpl-expired-ar').value,
      expiring_en: $('#tpl-expiring-en').value,
      expiring_ar: $('#tpl-expiring-ar').value,
    };
    save();
    toast('💬 Reminder templates saved');
  });
  $('#reset-tpls')?.addEventListener('click', () => {
    if (!confirm('Restore default reminder templates?\n\nYour current customizations will be replaced with the bundled English + Arabic defaults.')) return;
    if (state.settings) delete state.settings.reminderTemplates;
    save();
    render();
    toast('Templates restored to defaults');
  });
  $('#preview-tpl')?.addEventListener('click', () => {
    // Pick the first non-archived member with an expiry to demo with
    const sample = activeMembers().find(m => m.expiryDate) || activeMembers()[0];
    if (!sample) { toast('No members to preview with', 'error'); return; }
    const days = sample.expiryDate ? (daysUntil(sample.expiryDate) ?? 0) : -3;
    const kind = days < 0 ? 'expired' : 'expiring';
    // Use the LIVE textarea values, not the saved settings (so preview reflects edits)
    const liveTemplates = {
      expired_en:  $('#tpl-expired-en').value,
      expired_ar:  $('#tpl-expired-ar').value,
      expiring_en: $('#tpl-expiring-en').value,
      expiring_ar: $('#tpl-expiring-ar').value,
    };
    // Temporarily inject live values
    const prevSaved = state.settings?.reminderTemplates;
    if (!state.settings) state.settings = {};
    state.settings.reminderTemplates = liveTemplates;
    const msg = buildReminderMessage(sample, kind, days);
    state.settings.reminderTemplates = prevSaved;  // restore — don't persist
    // Show in a modal so admin can read before sending
    showModal({
      title: `💬 Preview · ${sample.name} (${kind === 'expired' ? 'Expired' : 'Expiring'})`,
      wide: true,
      body: `
        <div class="text-mute" style="font-size:12px;margin-bottom:10px">This is what the WhatsApp message will look like for <b>${escapeHtml(sample.name)}</b>. Tokens have been filled in with this member's actual data.</div>
        <pre style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:14px;white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.6;max-height:400px;overflow-y:auto">${escapeHtml(msg)}</pre>
      `,
      actions: [
        { label: 'Close', class: 'btn ghost', onclick: closeModal },
        ...(sample.phone && !sample.phone.startsWith('+9747000') ? [{
          label: '💬 Open in WhatsApp', class: 'btn primary', onclick: () => {
            const ph = sample.phone.replace(/[^\d]/g, '');
            window.open(`https://wa.me/${ph}?text=${encodeURIComponent(msg)}`, '_blank');
            closeModal();
          }
        }] : []),
      ],
    });
  });

window.downloadBackup = function() {
  const data = JSON.stringify({
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exported: new Date().toISOString(),
    ...state,
    user: undefined,
    route: undefined,
  }, null, 2);
  downloadFile(`blackstars-backup-${TODAY}.json`, data, 'application/json');
  try { localStorage.setItem('bs-last-backup', String(Date.now())); } catch (_) {}
  if (window.__hideBackupReminder) window.__hideBackupReminder();
  toast(`✓ Backup saved · ${state.members.length} members · ${state.invoices.length} invoices`);
};

  $('#backup-btn').addEventListener('click', () => window.downloadBackup());
  $('#fixnames-btn')?.addEventListener('click', () => window.fixNameCapitalization());

  $('#restore-btn').addEventListener('click', () => $('#restore-file').click());
  $('#restore-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.members) || !Array.isArray(data.invoices)) throw new Error('This file is not a Black Stars backup');
      const exportedOn = data.exported ? new Date(data.exported).toLocaleString() : 'unknown date';
      const summary = `${(data.members || []).length} members · ${(data.invoices || []).length} invoices · ${(data.coaches || []).length} coaches · ${(data.products || []).length} products`;
      const cur = `${state.members.length} members · ${state.invoices.length} invoices`;
      showModal({
        title: '📂 Restore from backup?',
        body: `<div style="font-size:13px;line-height:1.7">
            <p>This will <b style="color:var(--red)">replace ALL current data</b> with the contents of this backup file. This cannot be undone.</p>
            <div style="margin:10px 0;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-soft)">
              <div><b>Backup file:</b> ${escapeHtml(file.name)}</div>
              <div><b>Created:</b> ${escapeHtml(exportedOn)}${data.appVersion ? ` · app v${escapeHtml(String(data.appVersion))}` : ''}</div>
              <div><b>Contains:</b> ${summary}</div>
            </div>
            <p class="text-mute">Current data right now: ${cur}.</p>
            <p style="color:var(--green)">✓ A safety copy of your <b>current</b> data will be downloaded first, so you can undo this if needed.</p>
          </div>`,
        actions: [
          { label: 'Cancel', class: 'btn ghost', onclick: () => { closeModal(); e.target.value = ''; } },
          { label: 'Download safety copy & restore', class: 'btn primary', onclick: () => {
              closeModal();
              // 1) safety copy of CURRENT data, clearly named, before we overwrite.
              try {
                const safety = JSON.stringify({ appVersion: APP_VERSION, schemaVersion: SCHEMA_VERSION, exported: new Date().toISOString(), ...state, user: undefined, route: undefined }, null, 2);
                downloadFile(`blackstars-PRE-RESTORE-${TODAY}.json`, safety, 'application/json');
              } catch (_) {}
              // 2) clean replace — drop backup meta keys, keep the live session/route.
              const incoming = { ...data };
              delete incoming.appVersion; delete incoming.schemaVersion; delete incoming.exported;
              delete incoming.user; delete incoming.route;
              Object.assign(state, incoming);
              if (typeof audit === 'function') audit('data.restore', 'backup', `Restored backup (${summary})`, { file: file.name, exported: data.exported });
              window.__allowEmptySave = true;   // explicit restore — honor even if the backup is small
              save();
              window.__allowEmptySave = false;
              render();
              toast(`✓ Restored · ${state.members.length} members · ${state.invoices.length} invoices`);
              e.target.value = '';
            } },
        ],
      });
    } catch (err) {
      toast('Restore failed: ' + err.message, 'error');
      e.target.value = '';
    }
  });

  $('#reset-btn').addEventListener('click', resetData);
  const demoBtn = $('#demo-btn');
  if (demoBtn) demoBtn.addEventListener('click', () => {
    const cur = state.members.length;
    const msg = cur > 0
      ? `Replace your ${cur} member${cur===1?'':'s'} (+ all invoices/attendance/etc.) with demo data?\n\n` +
        `This is for exploring features. It OVERWRITES your real data.\n\n` +
        `Tip: Backup first (💾 Backup all data) if you might want to come back.`
      : 'Load demo data (207 sample members, sample coaches, schedule, etc.) so you can explore the app?';
    if (!confirm(msg)) return;
    loadDemoData();
    render();
    toast(`Demo data loaded · ${state.members.length} members`);
  });
  $('#hard-reset-btn').addEventListener('click', () => {
    if (!confirm('HARD RESET: this will wipe ALL your browser-saved data for Black Stars CRM and start with an empty app. Continue?')) return;
    if (!confirm('Last chance. You will lose everything. Continue?')) return;
    // Nuke every key this app uses
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('blackstars-crm')) localStorage.removeItem(k);
    });
    location.reload();
  });
};

// ─── Modal helpers ──────────────────────────────────────────
function showModal({ title, body, actions = [] }) {
  closeModal();
  const backdrop = el('div', { className: 'modal-backdrop', id: 'modal-backdrop' });
  const modal = el('div', { className: 'modal' });
  modal.innerHTML = `
    <div class="modal-header">
      <div class="modal-title">${title}</div>
      <button class="close-x" id="modal-close">✕</button>
    </div>
    <div class="modal-body">${body}</div>
    <div class="modal-footer"></div>
  `;
  const footer = modal.querySelector('.modal-footer');
  for (const a of actions) {
    // Action-button clicks bypass the dirty-check (they're intentional close paths)
    const handler = a.onclick ? (e) => { window._modalBypassDirty = true; try { a.onclick(e); } finally { window._modalBypassDirty = false; } } : null;
    const btn = el('button', { className: a.class || 'btn', onclick: handler }, a.label);
    if (a.id) btn.id = a.id;
    footer.append(btn);
  }
  backdrop.append(modal);
  document.body.append(backdrop);
  modal.querySelector('#modal-close').addEventListener('click', () => tryCloseModal());
  backdrop.addEventListener('click', e => { if (e.target === backdrop) tryCloseModal(); });
  document.addEventListener('keydown', escClose);
  document.body.style.overflow = 'hidden';
  // Snapshot initial form values for dirty-check
  setTimeout(() => { window._modalInitialState = snapshotModalState(modal); }, 0);
}

// Capture all input/select/textarea values inside the modal so we can detect
// whether the user actually changed anything before warning about discard.
function snapshotModalState(modal) {
  const snap = {};
  modal.querySelectorAll('input, select, textarea').forEach((el, i) => {
    const key = (el.id || el.name || `_${i}`);
    if (el.type === 'checkbox' || el.type === 'radio') snap[key] = el.checked;
    else snap[key] = el.value;
  });
  return snap;
}

function isModalDirty() {
  const modal = document.querySelector('.modal');
  if (!modal || !window._modalInitialState) return false;
  const current = snapshotModalState(modal);
  const initial = window._modalInitialState;
  // Different number of fields (e.g. enroll rows added/removed) counts as dirty
  if (Object.keys(current).length !== Object.keys(initial).length) return true;
  for (const k of Object.keys(current)) {
    if (current[k] !== initial[k]) return true;
  }
  return false;
}

// Wrapped close: warns the user if the form has unsaved changes
function tryCloseModal() {
  if (window._modalBypassDirty) { closeModal(); return; }
  if (isModalDirty()) {
    if (!confirm('Discard changes? Your edits will be lost.')) return;
  }
  closeModal();
}

function closeModal() {
  const b = $('#modal-backdrop');
  if (b) b.remove();
  document.removeEventListener('keydown', escClose);
  document.body.style.overflow = '';
  window._modalInitialState = null;
}

function escClose(e) { if (e.key === 'Escape') tryCloseModal(); }

// ─── ATTENDANCE ──────────────────────────────────────────────────
PAGES.attendance = (main) => {
  // Defaults: pick today's month if we have data for it (else latest month with
  // data), and pre-select today's day so marking is one-click for the common
  // "open the page, mark attendance for now" workflow.
  const _now = new Date();
  const _todayMonth = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}`;
  const _availMonths = availableMonths({ includeFuture: true });
  const _defaultMonth = _availMonths.includes(_todayMonth) ? _todayMonth : latestDataMonth();
  // filter.days is an array of day-numbers; empty = all days
  const _defaultDays = _defaultMonth === _todayMonth ? [_now.getDate()] : [];
  let filter = { month: _defaultMonth, coach: 'all', search: '', sports: [], memberId: null, days: _defaultDays, att: 'all' };

  // Collect all sports a member is enrolled in (primary + enrollments + subs)
  function memberSports(m) {
    const set = new Set();
    if (m.sport) set.add(m.sport);
    (m.enrollments || []).forEach(e => { if (e.sport) set.add(e.sport); });
    (m.subscriptions || []).forEach(s => { if (s.activity) set.add(s.activity); });
    return [...set];
  }

  function getRows() {
    // Show every member who has ANY enrollment (active OR expired).
    // The grid is for marking attendance; admin needs to see expired members
    // too so they can be counted after a late renewal.
    // The legacy m.months filter is removed — m.months was an import-time
    // legacy field that didn't track real enrollment.
    const rows = [];
    for (const m of state.members) {
      if (m.deleted) continue;  // archived members are out of the active roster
      if (filter.coach !== 'all' && m.coachId !== parseInt(filter.coach)) continue;
      if (filter.memberId != null && m.id !== filter.memberId) continue;
      const sports = memberSports(m);
      if (!sports.length) sports.push(m.sport || '—');
      const wanted = filter.sports.length ? sports.filter(s => filter.sports.includes(s)) : sports;
      if (!wanted.length) continue;
      if (filter.search) {
        const raw = filter.search.trim();
        const q = raw.toLowerCase();
        const hay = [m.name, m.nameArabic, m.phone, m.phone2, m.qid].filter(Boolean).join(' ').toLowerCase();
        let hit = hay.includes(q);
        if (!hit) {
          const qDigits = raw.replace(/\D/g, '');   // match phone ignoring spaces / +974
          if (qDigits.length >= 4) hit = phoneSearchMatches(m.phone, qDigits) || phoneSearchMatches(m.phone2, qDigits);
        }
        if (!hit && q.length >= 3 && !/\d/.test(q)) hit = fuzzyMatch(m.name, q) || fuzzyMatch(m.nameArabic, q);
        if (!hit) continue;
      }
      for (const sp of wanted) {
        // Attended / Not-attended filter — evaluated over the selected day(s),
        // or the whole grid month when no specific day is picked.
        if (filter.att && filter.att !== 'all') {
          const att = rowAttended(m, sp);
          if (filter.att === 'attended' && !att) continue;
          if (filter.att === 'notattended' && att) continue;
        }
        const enr = (m.enrollments || []).find(e => e.sport === sp);
        rows.push({ m, sport: sp, coachId: enr?.coachId ?? m.coachId });
      }
    }
    // Sort: active members first, then expired ones (so admin's attention
    // lands on the active ones, but expired stays accessible)
    rows.sort((a, b) => {
      const aExp = memberStatus(a.m) === 'Expired';
      const bExp = memberStatus(b.m) === 'Expired';
      if (aExp !== bExp) return aExp ? 1 : -1;
      return (a.m.name || '').localeCompare(b.m.name || '');
    });
    return rows;
  }

  // Resolve the month used for the day-grid + marking. "all" widens the row
  // filter (getRows) to every month, but the grid itself shows one concrete
  // month (default May) since day columns are per-month.
  function gridMonth() {
    return filter.month === 'all' ? latestDataMonth() : filter.month;
  }

  // True if the member has at least one "present" (Y) mark for this sport within
  // the current scope: the selected day(s) if any, otherwise the whole month.
  // In "All months" mode, looks across every month.
  function rowAttended(m, sport) {
    if (filter.month === 'all') {
      const da = m.dailyAttendance || {};
      return Object.keys(da).some(mo => Object.values(da[mo]?.[sport] || {}).some(v => v === 'Y'));
    }
    const mo = gridMonth();
    const data = m.dailyAttendance?.[mo]?.[sport] || {};
    const total = daysInMonth(mo);
    const days = (filter.days && filter.days.length)
      ? filter.days.filter(d => d >= 1 && d <= total)
      : Array.from({ length: total }, (_, i) => i + 1);
    return days.some(d => data[String(d)] === 'Y');
  }

  // Months that actually have any attendance marks (for the "All months" summary).
  function monthsWithData() {
    const set = new Set();
    for (const m of state.members) {
      if (m.deleted) continue;
      for (const mo of Object.keys(m.dailyAttendance || {})) {
        const sp = m.dailyAttendance[mo];
        if (sp && Object.values(sp).some(d => d && Object.keys(d).length)) set.add(mo);
      }
    }
    return [...set].sort();
  }

  // Narrow day columns to attended / not-attended days when that filter is set
  // (so "Attended" shows only the days people actually attended).
  function visibleDays(rows, baseDays, mo) {
    if (filter.att === 'attended')
      return baseDays.filter(d => rows.some(r => (r.m.dailyAttendance?.[mo]?.[r.sport] || {})[String(d)] === 'Y'));
    if (filter.att === 'notattended')
      return baseDays.filter(d => rows.some(r => (r.m.dailyAttendance?.[mo]?.[r.sport] || {})[String(d)] === 'N'));
    return baseDays;
  }

  function applyMark(memberId, sport, day, next) {
    const mo = gridMonth();
    const m = state.members.find(x => x.id === memberId);
    if (!m) return;
    if (!m.dailyAttendance) m.dailyAttendance = {};
    if (!m.dailyAttendance[mo]) m.dailyAttendance[mo] = {};
    if (!m.dailyAttendance[mo][sport]) m.dailyAttendance[mo][sport] = {};
    if (next === null) delete m.dailyAttendance[mo][sport][String(day)];
    else m.dailyAttendance[mo][sport][String(day)] = next;
    save();
    refresh();
  }
  function markCell(memberId, sport, day, current) {
    const next = current === 'Y' ? 'N' : current === 'N' ? null : 'Y';
    // First mark (empty → present) stays one-click for fast roll-call.
    // Changing an EXISTING mark (Y→N, or clearing) asks to confirm, so a stray
    // tap can't silently flip someone's record.
    if (current === 'Y' || current === 'N') {
      const m = state.members.find(x => x.id === memberId);
      const name = m ? m.name : 'this member';
      const fromLabel = current === 'Y' ? 'Present (Y)' : 'Absent (N)';
      const toLabel = next === 'Y' ? 'Present (Y)' : next === 'N' ? 'Absent (N)' : 'cleared (blank)';
      const badge = (txt, kind) => `<span class="badge" style="background:${kind==='Y'?'rgba(16,185,129,.15)':kind==='N'?'rgba(242,96,96,.15)':'rgba(120,120,140,.15)'};color:${kind==='Y'?'var(--green)':kind==='N'?'var(--red)':'var(--text-mute)'}">${txt}</span>`;
      showModal({
        title: 'Change attendance?',
        body: `<div style="font-size:13px;line-height:1.7">
            <p>Change <b>${escapeHtml(name)}</b> · ${escapeHtml(sport)} on <b>day ${day}</b> of ${fmtMonth(gridMonth())}?</p>
            <p style="margin-top:8px">${badge(fromLabel, current)} <span style="opacity:.6">→</span> ${badge(toLabel, next)}</p>
          </div>`,
        actions: [
          { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
          { label: 'Change it', class: 'btn primary', onclick: () => { closeModal(); applyMark(memberId, sport, day, next); } },
        ],
      });
      return;
    }
    applyMark(memberId, sport, day, next);
  }
  window._attMark = markCell;

  function cellRender(memberId, sport, day, mark) {
    const cls = mark === 'Y' ? 'att-y' : mark === 'N' ? 'att-n' : 'att-empty';
    const txt = mark || '·';
    const sportEsc = sport.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    return `<td class="att-cell ${cls}" onclick="window._attMark(${memberId}, '${sportEsc}', ${day}, ${mark ? `'${mark}'` : 'null'})">${txt}</td>`;
  }

  function refresh() {
    const gMonth = gridMonth();
    window._attCurrentMonth = gMonth;
    const rows = getRows();

    // ── "All months" summary: one column per month, Y counts + year total ──
    if (filter.month === 'all') {
      const months = monthsWithData();
      const monthHeaders = months.map(mo => `<th class="att-day-h" style="min-width:62px;width:62px">${fmtMonth(mo)}</th>`).join('');
      const body = rows.map(({ m, sport, coachId }) => {
        let grandY = 0;
        const cells = months.map(mo => {
          const dd = m.dailyAttendance?.[mo]?.[sport] || {};
          let y = 0; for (const k in dd) if (dd[k] === 'Y') y++;
          grandY += y;
          return `<td class="att-total" style="text-align:center">${y ? `<span style="color:var(--green);font-weight:600">${y}</span>` : '<span class="text-mute">·</span>'}</td>`;
        }).join('');
        const status = memberStatus(m);
        const isExpired = status === 'Expired';
        const statusBadge = isExpired ? '<span class="badge" style="font-size:9px;padding:1px 6px;background:rgba(242,96,96,.15);color:var(--red);margin-left:4px">EXPIRED</span>' : '';
        const sportEsc = sport.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        return `<tr style="${isExpired ? 'background:rgba(120,120,140,.06)' : ''}">
            <td class="att-name-cell" title="${escapeHtml(m.name)} · ${escapeHtml(sport)}">
              <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${isExpired ? 'color:var(--text-mute)' : ''}">${escapeHtml(m.name)}${statusBadge}</div>
              <div class="text-mute" style="font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(sport)}${sport !== SUMMER_CAMP ? ' · ' + escapeHtml(coachName(coachId)) : ''}</div>
            </td>
            ${cells}
            <td class="att-total"><span style="color:var(--green);font-weight:700">${grandY}</span></td>
            <td class="att-export-cell" style="text-align:center"><button class="btn ghost sm" onclick="window._attPdf(${m.id}, null, '${sportEsc}')" title="Export ${escapeHtml(m.name)} attendance">⬇ PDF</button></td>
          </tr>`;
      }).join('');
      $('#att-table-wrap').innerHTML = `
        <table class="att-table">
          <thead><tr><th class="att-name-h">Student</th>${monthHeaders}<th class="att-total-h">Total Y</th><th class="text-right">Export</th></tr></thead>
          <tbody>${body || `<tr><td colspan="${months.length + 3}" class="empty">No attendance recorded yet.</td></tr>`}</tbody>
        </table>`;
      const distinctMembers = new Set(rows.map(r => r.m.id)).size;
      $('#att-count').textContent = `${rows.length} attendance row${rows.length === 1 ? '' : 's'} · ${distinctMembers} student${distinctMembers === 1 ? '' : 's'} · all months (${months.length}) — present (Y) per month`;
      return;
    }

    const totalDays = daysInMonth(gMonth);
    // Day filter: when specific days are chosen (filter.days non-empty), show
    // only those columns (highlighted). Empty array = all days.
    const selectedDays = (filter.days || []).filter(d => d >= 1 && d <= totalDays);
    const isFiltered = selectedDays.length > 0;
    const baseDays = isFiltered ? [...selectedDays].sort((a, b) => a - b) : Array.from({length: totalDays}, (_, i) => i + 1);
    // Attended/Not-attended filter narrows the visible day columns too.
    const dayList = visibleDays(rows, baseDays, gMonth);
    const attNarrowed = dayList.length !== baseDays.length;
    const dayHeaders = dayList.map(d => `<th class="att-day-h${isFiltered ? ' att-day-active' : ''}">${d}</th>`).join('');

    // One row per (member, sport) — multi-sport members get multiple rows
    const body = rows.map(({ m, sport, coachId }) => {
      const dayData = m.dailyAttendance?.[gMonth]?.[sport] || {};
      let y = 0, n = 0;
      // Totals reflect the full selected scope (baseDays), not just shown columns.
      baseDays.forEach(d => { const mk = dayData[String(d)]; if (mk === 'Y') y++; if (mk === 'N') n++; });
      const cells = dayList.map(d => cellRender(m.id, sport, d, dayData[String(d)])).join('');
      const total = y + n;
      const rate = total ? Math.round(y/total*100) : 0;
      const sportEsc = sport.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const status = memberStatus(m);
      const isExpired = status === 'Expired';
      const rowStyle = isExpired ? 'background:rgba(120,120,140,.06)' : '';
      const statusBadge = isExpired
        ? '<span class="badge" style="font-size:9px;padding:1px 6px;background:rgba(242,96,96,.15);color:var(--red);margin-left:4px">EXPIRED</span>'
        : (status === 'Frozen'
          ? '<span class="badge" style="font-size:9px;padding:1px 6px;background:rgba(96,165,250,.15);color:var(--blue);margin-left:4px">FROZEN</span>'
          : '');
      return `
        <tr style="${rowStyle}">
          <td class="att-name-cell" title="${escapeHtml(m.name)} · ${escapeHtml(sport)}${sport !== SUMMER_CAMP ? ' · ' + escapeHtml(coachName(coachId)) : ''}${isExpired ? ' · expired ' + fmtDate(m.expiryDate) : ''}">
            <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${isExpired ? 'color:var(--text-mute)' : ''}">${escapeHtml(m.name)}${statusBadge}</div>
            <div class="text-mute" style="font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(sport)}${sport !== SUMMER_CAMP ? ' · ' + escapeHtml(coachName(coachId)) : ''}</div>
          </td>
          ${cells}
          <td class="att-total"><span style="color:var(--green);font-weight:600">${y}</span><span class="text-mute"> / ${total || '—'}</span></td>
          <td class="text-right" style="color:${rate >= 75 ? 'var(--green)' : rate >= 40 ? 'var(--accent-2)' : rate > 0 ? 'var(--red)' : 'var(--text-mute)'};font-weight:600">${total ? rate + '%' : '—'}</td>
          <td class="att-export-cell" style="text-align:center"><button class="btn ghost sm" onclick="window._attPdf(${m.id}, null, '${sportEsc}')" title="Export ${escapeHtml(m.name)} · ${escapeHtml(sport)} attendance">⬇ PDF</button></td>
        </tr>`;
    }).join('');

    $('#att-table-wrap').innerHTML = `
      <table class="att-table">
        <thead>
          <tr>
            <th class="att-name-h">Student</th>
            ${dayHeaders}
            <th class="att-total-h">Total</th>
            <th class="text-right">Rate</th>
            <th class="text-right">Export</th>
          </tr>
        </thead>
        <tbody>${body || `<tr><td colspan="${dayList.length+4}" class="empty">No members match the current filters.</td></tr>`}</tbody>
      </table>
    `;
    let dayNote;
    if (attNarrowed) {
      dayNote = `${filter.att === 'attended' ? 'attended' : 'absent'} days only · ${dayList.length} day${dayList.length === 1 ? '' : 's'} of ${fmtMonth(gMonth)}`;
    } else if (isFiltered) {
      if (selectedDays.length === 1) dayNote = `showing day ${selectedDays[0]} of ${fmtMonth(gMonth)} only`;
      else dayNote = `showing ${selectedDays.length} days of ${fmtMonth(gMonth)} (${selectedDays.slice(0,5).join(', ')}${selectedDays.length>5?'…':''})`;
    } else {
      dayNote = 'click any cell to toggle Y → N → empty';
    }
    const distinctMembers = new Set(rows.map(r => r.m.id)).size;
    const rowText = `${rows.length} attendance row${rows.length === 1 ? '' : 's'} · ${distinctMembers} student${distinctMembers === 1 ? '' : 's'}`;
    $('#att-count').textContent = `${rowText} · ${dayNote}`;
  }

  main.innerHTML = `
    <style>
      .att-table {
        font-size: 12px;
        border-collapse: separate;
        border-spacing: 0;
        width: auto;
      }
      .att-table th, .att-table td {
        white-space: nowrap;
        padding: 6px 4px;
        border-bottom: 1px solid var(--border);
      }
      .att-name-h, .att-name-cell {
        position: sticky;
        left: 0;
        background: var(--surface);
        text-align: left;
        padding: 6px 12px;
        width: 220px;
        min-width: 200px;
        max-width: 240px;
        z-index: 2;
        border-right: 1px solid var(--border);
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .att-name-h { background: var(--surface-2); z-index: 3; }
      .att-day-h {
        text-align: center;
        font-size: 10px;
        font-weight: 600;
        color: var(--text-mute);
        background: var(--surface-2);
        width: 28px;
        min-width: 28px;
      }
      .att-day-active {
        color: var(--accent);
        background: rgba(242,96,96,.12);
        font-size: 13px;
        width: 60px;
        min-width: 60px;
      }
      .att-total-h {
        position: sticky;
        right: 0;
        background: var(--surface-2);
        text-align: center;
        font-size: 11px;
        color: var(--text-mute);
        z-index: 3;
        width: 80px;
        min-width: 80px;
      }
      .att-table th.text-right { width: 90px; min-width: 80px; }
      .att-cell {
        text-align: center;
        cursor: pointer;
        font-weight: 600;
        font-size: 12px;
        user-select: none;
        transition: all .1s;
        width: 28px;
        height: 28px;
      }
      .att-cell:hover {
        outline: 1px solid var(--accent);
        outline-offset: -1px;
      }
      .att-empty { color: var(--text-mute); opacity: .4; }
      .att-y { background: rgba(16,185,129,.15); color: var(--green); }
      .att-n { background: rgba(239,68,68,.15); color: var(--red); }
      .att-total {
        position: sticky;
        right: 0;
        background: var(--surface);
        text-align: center;
        font-size: 12px;
        z-index: 2;
        border-left: 1px solid var(--border);
      }
      tbody tr:hover .att-name-cell,
      tbody tr:hover .att-total { background: var(--surface-2); }
    </style>

    <div class="topbar">
      <div>
        <h1>Attendance</h1>
        <div class="subtitle"><span id="att-count">Loading...</span></div>
      </div>
      <div class="topbar-actions">
        <button class="btn ghost" id="att-today">📍 Today</button>
        <button class="btn ghost" id="att-import">📂 Import CSV</button>
        <button class="btn ghost" id="att-export">📥 Export CSV</button>
        <button class="btn ghost" id="att-export-pdf">📄 Export PDF</button>
      </div>
    </div>

    <div class="card">
      <div class="filter-bar att-filter-bar" style="flex-wrap:wrap;align-items:stretch">
        <select id="att-month" class="btn ghost">
          <option value="all">All months</option>
          ${availableMonths({includeFuture:true}).map(m=>`<option value="${m}" ${filter.month===m?'selected':''}>${fmtMonth(m)}</option>`).join('')}
        </select>
        <div style="position:relative">
          <button type="button" id="att-day-btn" class="btn ghost" style="min-width:130px;text-align:left;display:inline-flex;align-items:center;justify-content:space-between;gap:8px" title="Pick one or more days">All days <span style="opacity:.6">▾</span></button>
          <div id="att-day-menu" style="display:none;position:absolute;left:0;top:100%;z-index:50;background:var(--surface);border:1px solid var(--border);border-radius:8px;margin-top:4px;padding:8px;min-width:240px;max-height:340px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,.4)">
            <div style="display:flex;gap:6px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border)">
              <button type="button" class="btn ghost sm" id="att-day-all">All</button>
              <button type="button" class="btn ghost sm" id="att-day-none">Clear</button>
              <button type="button" class="btn ghost sm" id="att-day-today">Today</button>
            </div>
            <div id="att-day-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px"></div>
          </div>
        </div>
        <select id="att-week" class="btn ghost" title="Quick-pick a week (selects all 7 days)">
          <option value="all">All weeks</option>
          <option value="1">Week 1 (1–7)</option>
          <option value="2">Week 2 (8–14)</option>
          <option value="3">Week 3 (15–21)</option>
          <option value="4">Week 4 (22–28)</option>
          <option value="5">Week 5 (29–end)</option>
        </select>
        <select id="att-coach" class="btn ghost">
          <option value="all">All coaches</option>
          ${state.coaches.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
        </select>
        <select id="att-status" class="btn ghost" title="Show only students who attended (have a present mark) or did not, within the selected day(s) / month">
          <option value="all">All attendance</option>
          <option value="attended">✓ Attended</option>
          <option value="notattended">✗ Not attended</option>
        </select>
        <div style="position:relative">
          <button type="button" id="att-sports-btn" style="min-width:150px;text-align:left;display:inline-flex;align-items:center;justify-content:space-between;gap:8px">All sports <span style="opacity:.6">▾</span></button>
          <div id="att-sports-menu" style="display:none;position:absolute;left:0;top:100%;z-index:50;background:var(--surface);border:1px solid var(--border);border-radius:8px;margin-top:4px;padding:8px;min-width:180px;box-shadow:0 8px 24px rgba(0,0,0,.4)">
            ${SPORTS.map(s => `<label style="display:flex;align-items:center;gap:8px;padding:5px 6px;cursor:pointer;font-size:13px"><input type="checkbox" class="att-sport-cb" value="${s}" /> ${s}</label>`).join('')}
          </div>
        </div>
        <div style="min-width:260px;flex:1;max-width:340px">${memberPickerHtml('att-student', { placeholder: 'All students (type to search)' })}</div>
        <div class="text-mute" style="margin-left:auto;font-size:11px;align-self:center">
          <span class="att-cell att-y" style="display:inline-block;padding:2px 6px;border-radius:3px">Y</span> present ·
          <span class="att-cell att-n" style="display:inline-block;padding:2px 6px;border-radius:3px">N</span> absent ·
          <span class="text-mute">·</span> not marked
        </div>
      </div>
      <div style="overflow-x:auto;max-height:70vh;overflow-y:auto" id="att-table-wrap"></div>
    </div>
  `;

  // Day-grid helper: build the checkbox grid based on the active month
  function buildDayGrid() {
    const dm = filter.month === 'all' ? 31 : daysInMonth(filter.month);
    const grid = $('#att-day-grid');
    if (!grid) return;
    grid.innerHTML = Array.from({length: dm}, (_, i) => {
      const d = i + 1;
      const checked = (filter.days || []).includes(d) ? 'checked' : '';
      return `<label style="display:flex;flex-direction:column;align-items:center;padding:5px 0;cursor:pointer;font-size:11px;border-radius:4px" class="att-day-cell">
        <input type="checkbox" class="att-day-cb" value="${d}" ${checked} style="margin-bottom:2px"/>
        <span>${d}</span>
      </label>`;
    }).join('');
    grid.querySelectorAll('.att-day-cb').forEach(cb => cb.addEventListener('change', applyDays));
  }
  function applyDays() {
    filter.days = $$('.att-day-cb').filter(cb => cb.checked).map(cb => parseInt(cb.value));
    const btn = $('#att-day-btn');
    if (btn) btn.innerHTML = (filter.days.length ? (filter.days.length === 1 ? `Day ${filter.days[0]}` : `${filter.days.length} days`) : 'All days') + ' <span style="opacity:.6">▾</span>';
    refresh();
  }

  $('#att-month').addEventListener('change', e => {
    filter.month = e.target.value;
    const dm = filter.month === 'all' ? 31 : daysInMonth(filter.month);
    // Drop days outside the new month's range
    filter.days = (filter.days || []).filter(d => d >= 1 && d <= dm);
    buildDayGrid();
    applyDays();
  });
  $('#att-coach').addEventListener('change', e => { filter.coach = e.target.value; refresh(); });
  $('#att-status').addEventListener('change', e => { filter.att = e.target.value; refresh(); });

  // Day multi-select dropdown
  const dayBtn = $('#att-day-btn');
  const dayMenu = $('#att-day-menu');
  if (dayBtn) {
    dayBtn.addEventListener('click', () => {
      dayMenu.style.display = dayMenu.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', e => {
      if (!dayBtn.contains(e.target) && !dayMenu.contains(e.target)) dayMenu.style.display = 'none';
    });
    $('#att-day-all').addEventListener('click', () => {
      const dm = filter.month === 'all' ? 31 : daysInMonth(filter.month);
      filter.days = Array.from({length: dm}, (_, i) => i + 1);
      buildDayGrid(); applyDays();
    });
    $('#att-day-none').addEventListener('click', () => { filter.days = []; buildDayGrid(); applyDays(); });
    $('#att-day-today').addEventListener('click', () => {
      const n = new Date();
      const tm = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
      if (tm === filter.month) { filter.days = [n.getDate()]; buildDayGrid(); applyDays(); }
      else toast('Today is not in the selected month');
    });
  }
  buildDayGrid();
  // Initialize button label
  const dbtn = $('#att-day-btn');
  if (dbtn) dbtn.innerHTML = (filter.days.length ? (filter.days.length === 1 ? `Day ${filter.days[0]}` : `${filter.days.length} days`) : 'All days') + ' <span style="opacity:.6">▾</span>';

  // Week quick-pick: selecting a week picks all 7 days of that week
  $('#att-week').addEventListener('change', e => {
    const v = e.target.value;
    if (v === 'all') { filter.days = []; }
    else {
      const w = parseInt(v);
      const start = (w - 1) * 7 + 1;
      const dm = filter.month === 'all' ? 31 : daysInMonth(filter.month);
      const end = Math.min(start + 6, dm);
      filter.days = Array.from({length: end - start + 1}, (_, i) => start + i);
    }
    buildDayGrid(); applyDays();
  });

  // Searchable student dropdown (member picker) — selecting one filters to that student
  bindMemberPicker('att-student', { placeholder: 'All students (type to search)' });
  const attStudentHidden = $('#att-student');
  const attStudentSearch = $('#att-student-search');
  if (attStudentHidden) {
    // Watch the hidden input for a chosen id; also let free typing filter the list
    const applyStudent = () => {
      const v = attStudentHidden.value;
      filter.memberId = v ? parseInt(v) : null;
      // if nothing explicitly chosen, use the typed text as a free search
      filter.search = (!v && attStudentSearch) ? attStudentSearch.value.trim() : '';
      refresh();
    };
    attStudentHidden.addEventListener('change', applyStudent);
    // mousedown selection updates hidden value without firing 'change', so poll on blur/input
    attStudentSearch.addEventListener('input', () => { filter.memberId = null; filter.search = attStudentSearch.value.trim(); refresh(); });
    attStudentSearch.addEventListener('blur', () => setTimeout(applyStudent, 200));
  }

  // Multi-select sports dropdown
  const sportsBtn = $('#att-sports-btn');
  const sportsMenu = $('#att-sports-menu');
  if (sportsBtn) {
    sportsBtn.addEventListener('click', () => {
      sportsMenu.style.display = sportsMenu.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', e => {
      if (!sportsBtn.contains(e.target) && !sportsMenu.contains(e.target)) sportsMenu.style.display = 'none';
    });
    $$('.att-sport-cb').forEach(cb => cb.addEventListener('change', () => {
      filter.sports = $$('.att-sport-cb').filter(x => x.checked).map(x => x.value);
      sportsBtn.innerHTML = (filter.sports.length ? `${filter.sports.length} sport${filter.sports.length > 1 ? 's' : ''}` : 'All sports') + ' <span style="opacity:.6">▾</span>';
      refresh();
    }));
  }

  // All-months summary PDF: one column per month with present (Y) counts + year total.
  function exportAttendanceMonthsPdf(rows) {
    const months = monthsWithData();
    if (!months.length) { toast('No attendance recorded yet', 'error'); return; }
    const monthHeads = months.map(mo => `<th style="border:1px solid #e5e5ea;padding:4px 2px;font-size:8.5px;color:#777">${fmtMonth(mo)}</th>`).join('');
    let grandY = 0;
    const bodyRows = rows.map(({ m, sport, coachId }) => {
      let rowY = 0;
      const cells = months.map(mo => {
        const dd = m.dailyAttendance?.[mo]?.[sport] || {};
        let y = 0; for (const k in dd) if (dd[k] === 'Y') y++;
        rowY += y;
        return `<td style="border:1px solid #eee;text-align:center;font-size:9px;background:${y ? '#d1fae5' : '#fff'};color:${y ? '#065f46' : '#ccc'};font-weight:600">${y || '·'}</td>`;
      }).join('');
      grandY += rowY;
      return `<tr>
        <td style="border:1px solid #e5e5ea;padding:4px 6px;font-size:9px;font-weight:600"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(m.name)}</div><div style="font-size:7.5px;color:#999;font-weight:400">${escapeHtml(sport)}${sport !== SUMMER_CAMP ? ' · ' + escapeHtml(coachName(coachId)) : ''}</div></td>
        ${cells}
        <td style="border:1px solid #e5e5ea;text-align:center;font-size:9px;font-weight:700;color:#059669">${rowY}</td>
      </tr>`;
    }).join('');
    const coachLabel = filter.coach !== 'all' ? coachName(parseInt(filter.coach)) : 'All coaches';
    const sportLabel = filter.sports.length ? filter.sports.join(', ') : 'All sports';
    const distinctMembers = new Set(rows.map(r => r.m.id)).size;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>attendance_all_months</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      @page{size:A4 landscape;margin:8mm}
      body{font-family:-apple-system,'Segoe UI',Arial,sans-serif;color:#1a1a1a;padding:14px}
      .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f26060;padding-bottom:10px;margin-bottom:12px}
      .brand{font-size:18px;font-weight:800}.brand span{color:#f26060}
      .sub{color:#777;font-size:11px;margin-top:2px}
      .meta{font-size:11px;color:#555;margin-bottom:10px}.meta b{color:#1a1a1a}
      table{border-collapse:collapse;width:100%}
      thead th{background:#fafafa;text-align:center}
      .foot{margin-top:14px;font-size:9px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:6px}
    </style></head><body>
      <div class="head">
        <div><div class="brand">Black <span>Stars</span> Sports Club</div><div class="sub">Waab, Doha · Attendance Report — all months</div></div>
        <div style="text-align:right;font-size:11px;color:#777">Generated<br><b>${fmtDate(TODAY)}</b></div>
      </div>
      <div class="meta">All months (${months.length}) · ${escapeHtml(coachLabel)} · ${escapeHtml(sportLabel)} · <b>${distinctMembers}</b> student${distinctMembers===1?'':'s'} · <b>${rows.length}</b> row${rows.length===1?'':'s'} · <b>${grandY}</b> present total</div>
      <table>
        <thead><tr><th style="border:1px solid #e5e5ea;padding:4px 6px;font-size:9px;color:#777;text-align:left">Student · Sport</th>${monthHeads}<th style="border:1px solid #e5e5ea;font-size:9px;color:#777">Total Y</th></tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <div class="foot">Black Stars CRM · cell = present (Y) days that month</div>
      <script>window.onload=()=>window.print();<\/script>
    </body></html>`);
    win.document.close();
    toast(`PDF · all months · ${rows.length} rows`);
  }

  $('#att-export-pdf').addEventListener('click', () => {
    const rows = getRows();
    if (!rows.length) { toast('No students to export', 'error'); return; }
    if (filter.month === 'all') { exportAttendanceMonthsPdf(rows); return; }
    const gM = gridMonth();
    const totalDays = daysInMonth(gM);
    const selDays = (filter.days || []).filter(d => d >= 1 && d <= totalDays);
    const baseDays = selDays.length ? selDays.slice().sort((a, b) => a - b) : Array.from({length: totalDays}, (_, i) => i + 1);
    const dayCols = visibleDays(rows, baseDays, gM);   // attended/absent narrowing
    const days = dayCols.length;

    const dayHeads = dayCols.map(d => `<th style="border:1px solid #e5e5ea;padding:3px 1px;font-size:8px;color:#777">${d}</th>`).join('');
    let grandY = 0, grandSlots = 0;
    const bodyRows = rows.map(({ m, sport, coachId }) => {
      const dd = m.dailyAttendance?.[gM]?.[sport] || {};
      let y = 0, n = 0;
      baseDays.forEach(d => { const v = dd[String(d)]; if (v === 'Y') y++; if (v === 'N') n++; });   // totals over full scope
      const cells = dayCols.map(d => {
        const v = dd[String(d)];
        const bg = v==='Y'?'#d1fae5':v==='N'?'#fee2e2':'#fff';
        const col = v==='Y'?'#065f46':v==='N'?'#991b1b':'#ccc';
        return `<td style="border:1px solid #eee;text-align:center;font-size:8px;background:${bg};color:${col};font-weight:600">${v||'·'}</td>`;
      }).join('');
      const tot = y+n; const rate = tot?Math.round(y/tot*100):0;
      grandY += y; grandSlots += tot;
      const rcol = rate>=75?'#059669':rate>=40?'#d97706':rate>0?'#dc2626':'#999';
      return `<tr>
        <td style="border:1px solid #e5e5ea;padding:4px 6px;font-size:9px;font-weight:600;overflow:hidden;text-overflow:ellipsis"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(m.name)}</div><div style="font-size:7.5px;color:#999;font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(sport)}${sport !== SUMMER_CAMP ? ' · ' + escapeHtml(coachName(coachId)) : ''}</div></td>
        ${cells}
        <td style="border:1px solid #e5e5ea;text-align:center;font-size:9px;font-weight:700">${y}/${tot||'—'}</td>
        <td style="border:1px solid #e5e5ea;text-align:center;font-size:9px;font-weight:700;color:${rcol}">${tot?rate+'%':'—'}</td>
      </tr>`;
    }).join('');

    const coachLabel = filter.coach !== 'all' ? coachName(parseInt(filter.coach)) : 'All coaches';
    const sportLabel = filter.sports.length ? filter.sports.join(', ') : 'All sports';
    const attLabel = filter.att === 'attended' ? ' · attended days only' : filter.att === 'notattended' ? ' · absent days only' : '';
    const overallRate = grandSlots ? Math.round(grandY/grandSlots*100) : 0;
    const distinctMembers = new Set(rows.map(r => r.m.id)).size;

    // Build a <colgroup> so the table respects column widths instead of letting
    // the Student column stretch wide. `table-layout: fixed` + colgroup is the
    // canonical way to lock layout for print.
    const dayColWidth = `calc((100% - 200px) / ${days})`;  // 200px = student(140) + Y/Tot(34) + Rate(26)
    const colgroup = `<colgroup>
      <col style="width:140px">
      ${Array.from({length:days},() => `<col style="width:${dayColWidth}">`).join('')}
      <col style="width:34px">
      <col style="width:26px">
    </colgroup>`;

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>attendance_${gM}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      @page{size:A4 landscape;margin:8mm}
      body{font-family:-apple-system,'Segoe UI',Arial,sans-serif;color:#1a1a1a;padding:14px}
      .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f26060;padding-bottom:10px;margin-bottom:12px}
      .brand{font-size:18px;font-weight:800}.brand span{color:#f26060}
      .sub{color:#777;font-size:11px;margin-top:2px}
      .meta{font-size:11px;color:#555;margin-bottom:10px}
      .meta b{color:#1a1a1a}
      table{border-collapse:collapse;width:100%;table-layout:fixed}
      thead th{background:#fafafa;text-align:center}
      td{overflow:hidden}
      .foot{margin-top:14px;font-size:9px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:6px}
    </style></head><body>
      <div class="head">
        <div><div class="brand">Black <span>Stars</span> Sports Club</div><div class="sub">Waab, Doha · Attendance Report</div></div>
        <div style="text-align:right;font-size:11px;color:#777">Generated<br><b>${fmtDate(TODAY)}</b></div>
      </div>
      <div class="meta"><b>${fmtMonth(gM)}</b>${attLabel} · ${escapeHtml(coachLabel)} · ${escapeHtml(sportLabel)} · <b>${distinctMembers}</b> student${distinctMembers===1?'':'s'} · <b>${rows.length}</b> row${rows.length===1?'':'s'} · overall <b>${overallRate}%</b></div>
      <table>
        ${colgroup}
        <thead><tr><th style="border:1px solid #e5e5ea;padding:4px 6px;font-size:9px;color:#777;text-align:left">Student · Sport</th>${dayHeads}<th style="border:1px solid #e5e5ea;font-size:9px;color:#777">Y/Tot</th><th style="border:1px solid #e5e5ea;font-size:9px;color:#777">Rate</th></tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <div class="foot">Black Stars CRM · Y = present · N = absent · · = not marked</div>
      <script>window.onload=()=>window.print();<\/script>
    </body></html>`);
    win.document.close();
    toast(`PDF report · ${rows.length} rows`);
  });

  $('#att-export').addEventListener('click', () => {
    const rows = getRows();
    if (filter.month === 'all') {
      // All-months summary: one column per month (present Y count) + year total.
      const months = monthsWithData();
      const csvRows = [['Student','Sport','Coach',...months.map(fmtMonth),'Total Y']];
      for (const { m, sport, coachId } of rows) {
        let grand = 0;
        const cells = months.map(mo => {
          const dd = m.dailyAttendance?.[mo]?.[sport] || {};
          let y = 0; for (const k in dd) if (dd[k] === 'Y') y++;
          grand += y; return y;
        });
        csvRows.push([m.name, sport, sport === SUMMER_CAMP ? '' : coachName(coachId), ...cells, grand]);
      }
      const csv = csvRows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
      downloadFile('attendance-all-months.csv', csv, 'text/csv');
      toast('Attendance CSV exported · all months');
      return;
    }
    const gM = gridMonth();
    const totalDays = daysInMonth(gM);
    const selDays = (filter.days || []).filter(d => d >= 1 && d <= totalDays);
    const baseDays = selDays.length ? selDays.slice().sort((a, b) => a - b) : Array.from({length: totalDays}, (_, i) => i + 1);
    const dayCols = visibleDays(rows, baseDays, gM);
    const csvRows = [['Student','Sport','Coach',...dayCols.map(String),'Total Y','Total N','Rate']];
    for (const { m, sport, coachId } of rows) {
      const dd = m.dailyAttendance?.[gM]?.[sport] || {};
      let y = 0, n = 0;
      baseDays.forEach(d => { const v = dd[String(d)]; if (v === 'Y') y++; if (v === 'N') n++; });
      const cells = dayCols.map(d => dd[String(d)] || '');
      csvRows.push([m.name, sport, sport === SUMMER_CAMP ? '' : coachName(coachId), ...cells, y, n, y+n ? Math.round(y/(y+n)*100)+'%' : '']);
    }
    const csv = csvRows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    downloadFile(`attendance-${gM}.csv`, csv, 'text/csv');
    toast('Attendance CSV exported');
  });

  $('#att-today').addEventListener('click', () => {
    const now = new Date();
    const ymonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const dayNum = now.getDate();
    const monthsAvail = availableMonths();
    const target = monthsAvail.includes(ymonth) ? ymonth : (monthsAvail.length ? monthsAvail[monthsAvail.length-1] : ymonth);
    filter.month = target;
    const monthSel = $('#att-month'); if (monthSel) monthSel.value = target;
    const dm = daysInMonth(target);
    const useDay = dayNum <= dm ? dayNum : 1;
    filter.days = [useDay];
    buildDayGrid();
    applyDays();
    toast(`Jumped to day ${useDay} · tap names to mark present`);
  });

  $('#att-import').addEventListener('click', () => {
    toast('Import: drop a CSV in the same format as Export', 'success');
  });

  refresh();
};

// ─── Per-student attendance PDF report ──────────────────────────────
window._attPdf = function(memberId, month, sport) {
  const m = state.members.find(x => x.id === memberId);
  if (!m) return;
  const mo = month || (window._attCurrentMonth) || latestDataMonth();
  const days = daysInMonth(mo);
  const sportsMap = m.dailyAttendance?.[mo] || {};
  // If a sport was passed, show just that sport. Otherwise show all sports the
  // member has attendance for, in this month.
  const sportsShown = sport ? [sport] : Object.keys(sportsMap);
  if (!sportsShown.length && sport) sportsShown.push(sport);
  if (!sportsShown.length) sportsShown.push(m.sport || '—');

  let totalY = 0, totalN = 0;
  const sportSections = sportsShown.map(sp => {
    const dd = sportsMap[sp] || {};
    let y = 0, n = 0;
    const cells = [];
    for (let d = 1; d <= days; d++) {
      const v = dd[String(d)];
      if (v === 'Y') y++; if (v === 'N') n++;
      cells.push({ d, v });
    }
    totalY += y; totalN += n;
    const sTot = y + n;
    const sRate = sTot ? Math.round(y / sTot * 100) : 0;
    const dayCells = cells.map(c => {
      const bg = c.v === 'Y' ? '#d1fae5' : c.v === 'N' ? '#fee2e2' : '#f7f7f8';
      const col = c.v === 'Y' ? '#065f46' : c.v === 'N' ? '#991b1b' : '#bbb';
      return `<td style="text-align:center;border:1px solid #e5e5ea;padding:4px 2px;background:${bg};color:${col};font-weight:600;font-size:11px">${c.v || '·'}</td>`;
    }).join('');
    const dayHeads = cells.map(c => `<th style="text-align:center;border:1px solid #e5e5ea;padding:3px 2px;font-size:9px;color:#777">${c.d}</th>`).join('');
    const enr = (m.enrollments || []).find(e => e.sport === sp);
    const cid = enr?.coachId ?? m.coachId;
    return `
      <div style="margin-bottom:20px">
        <div style="font-size:13px;font-weight:700;color:#f26060;margin-bottom:6px">${escapeHtml(sp)} · Coach ${escapeHtml(coachName(cid))} · <span style="color:#666;font-weight:500">${y}/${sTot} · ${sTot?sRate+'%':'—'}</span></div>
        <table style="width:100%"><thead><tr><th style="border:1px solid #e5e5ea;padding:4px;font-size:10px;color:#777;background:#fafafa">Day</th>${dayHeads}</tr></thead>
        <tbody><tr><td style="border:1px solid #e5e5ea;padding:4px 8px;font-size:11px;font-weight:600;background:#fafafa">Mark</td>${dayCells}</tr></tbody></table>
      </div>`;
  }).join('');

  const total = totalY + totalN;
  const rate = total ? Math.round(totalY / total * 100) : 0;
  const fileName = `${m.name.replace(/[^a-z0-9]+/gi, '_')}${sport?`_${sport.replace(/[^a-z0-9]+/gi,'_')}`:''}_attendance_${mo}`;

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${fileName}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    @page{size:A4 landscape;margin:12mm}
    body{font-family:-apple-system,'Segoe UI',Arial,sans-serif;color:#1a1a1a;padding:24px}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f26060;padding-bottom:14px;margin-bottom:18px}
    .brand{font-size:22px;font-weight:800}.brand span{color:#f26060}
    .sub{color:#777;font-size:12px;margin-top:2px}
    h1{font-size:17px;margin-bottom:2px}
    .meta{font-size:12px;color:#555;margin-bottom:16px}
    .meta b{color:#1a1a1a}
    table{border-collapse:collapse;margin-bottom:10px}
    .summary{display:flex;gap:14px;margin-bottom:18px}
    .kpi{flex:1;border:1px solid #e5e5ea;border-radius:8px;padding:10px 14px}
    .kpi .l{font-size:10px;text-transform:uppercase;color:#999;letter-spacing:.5px}
    .kpi .v{font-size:22px;font-weight:700;margin-top:2px}
    .foot{margin-top:24px;font-size:10px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:10px}
  </style></head><body>
    <div class="head">
      <div><div class="brand">Black <span>Stars</span> Sports Club</div><div class="sub">Waab, Doha · Attendance Report</div></div>
      <div style="text-align:right;font-size:11px;color:#777">Generated<br><b>${fmtDate(TODAY)}</b></div>
    </div>
    <h1>${escapeHtml(m.name)}${m.nameArabic ? ` <span style="color:#999;font-weight:400">(${escapeHtml(m.nameArabic)})</span>` : ''}</h1>
    <div class="meta">${sport ? '' : `<b>${sportsShown.length} sport${sportsShown.length===1?'':'s'}</b> · `}${fmtMonth(mo)} · Status: <b>${memberStatus(m)}</b></div>
    <div class="summary">
      <div class="kpi"><div class="l">Present (Y)</div><div class="v" style="color:#059669">${totalY}</div></div>
      <div class="kpi"><div class="l">Absent (N)</div><div class="v" style="color:#dc2626">${totalN}</div></div>
      <div class="kpi"><div class="l">Days marked</div><div class="v">${total}</div></div>
      <div class="kpi"><div class="l">Overall rate</div><div class="v" style="color:${rate>=75?'#059669':rate>=40?'#d97706':'#dc2626'}">${total?rate+'%':'—'}</div></div>
    </div>
    ${sportSections}
    <div class="foot">Black Stars CRM · Y = present · N = absent · · = not marked</div>
    <script>window.onload=()=>{window.print();}<\/script>
  </body></html>`);
  win.document.close();
};
// ═══════════════════════════════════════════════════════════════════


PAGES.history = (main) => {
  let state2 = { selectedId: null, search: '' };

  if (window._historyLastSelected) state2.selectedId = window._historyLastSelected;
  else if (state.members.length) state2.selectedId = state.members[0].id;

  function memberFilter(m) {
    if (!state2.search) return true;
    const q = state2.search.toLowerCase();
    return [m.name, m.nameArabic, m.phone, m.phone2, m.qid, m.email].filter(Boolean).join(' ').toLowerCase().includes(q);
  }

  // ─ Build subscription history rows (chronological) ─
  function buildSubs(m) {
    const subs = (m.subscriptions || []).map(s => ({ ...s }));
    // Add legacy standalone renewals (where the renewal entry doesn't have a
    // matching subscription row by _rid). New renewals are pushed to both
    // subscriptions[] and renewals[] at save time — we dedupe here so they
    // don't show twice.
    const subRids = new Set(subs.map(s => s._rid).filter(Boolean));
    for (const r of (m.renewals || [])) {
      if (r._rid && subRids.has(r._rid)) continue;
      subs.push({ ...r, manual: true });
    }
    // Sort by start date desc (most recent first)
    return subs.sort((a, b) => (b.start || '').localeCompare(a.start || ''));
  }

  function renderTimeline() {
    const m = state.members.find(x => x.id === state2.selectedId);
    const right = $('#hist-right');
    if (!m) {
      right.innerHTML = `<div class="empty" style="padding:60px"><div class="empty-icon">📜</div>Select a member to view their history</div>`;
      return;
    }
    window._historyLastSelected = m.id;

    const subs = buildSubs(m);

    // Aggregate stats
    const totalSubs = subs.length;
    const totalPaid = subs.reduce((s, x) => s + (x.amountPaid || 0), 0);
    const activeSubs = subs.filter(s => (s.status || '').toLowerCase() === 'active').length;
    const expiredSubs = subs.filter(s => (s.status || '').toLowerCase() === 'expired').length;

    right.innerHTML = `
      <div class="card">
        <div style="display:flex;gap:16px;align-items:center;margin-bottom:16px">
          <div class="avatar" style="width:64px;height:64px;font-size:22px;background:linear-gradient(135deg,var(--blue),var(--purple))">${initials(m.name)}</div>
          <div style="flex:1">
            <div style="font-size:20px;font-weight:700">${escapeHtml(m.name)}${m.nameArabic ? ` · <span style="color:var(--text-dim);font-weight:500" dir="rtl">${escapeHtml(m.nameArabic)}</span>` : ''}</div>
            <div class="text-dim" style="font-size:13px">${escapeHtml(m.sport)} · ${escapeHtml(coachName(m.coachId))}${m.level ? ' · '+escapeHtml(m.level) : ''}</div>
            <div class="mt-1">
              <span class="badge ${memberStatus(m).toLowerCase()}">${memberStatus(m)}</span>
              ${isRealPhone(m.phone) ? `<span class="text-mute" style="margin-left:8px;font-size:11px">📱 ${phoneCell(m.phone, { stop: false })}</span>` : ''}
              ${m.qid ? `<span class="text-mute" style="margin-left:8px;font-size:11px">🆔 ${escapeHtml(m.qid)}</span>` : ''}
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn ghost sm" onclick="editMember(${m.id})" title="Edit member">✏️ Edit</button>
            <button class="btn ghost sm" onclick="duplicateMember(${m.id})" title="Create a new member copying this one's contact info (for siblings)">⧉ Duplicate</button>
            <button class="btn ghost sm" onclick="freezeMember(${m.id})" title="Freeze membership (pause and shift expiry)">❄️ Freeze</button>
            <button class="btn ghost sm" onclick="switchSport(${m.id})" title="Switch this member to a different sport/coach">🔄 Switch Sport</button>
            <button class="btn ghost sm" onclick="printIdCard(${m.id})" title="Print membership ID card">🪪 ID Card</button>
            <button class="btn primary sm" onclick="addRenewal(${m.id})" title="Record a new subscription / renewal">+ Add Renewal</button>
          </div>
        </div>

        ${(() => {
          const isFrozen = m.currentFreezeUntil && TODAY <= m.currentFreezeUntil;
          if (!isFrozen) return '';
          const remaining = Math.max(0, Math.ceil((new Date(m.currentFreezeUntil) - new Date(TODAY)) / 86400000));
          const f = (m.freezes || []).slice(-1)[0];
          return `<div style="background:rgba(96,165,250,.12);border:1px solid rgba(96,165,250,.4);border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:12px">
            <div style="font-size:24px">❄️</div>
            <div style="flex:1">
              <div style="font-weight:700;color:var(--blue)">Frozen until ${fmtDate(m.currentFreezeUntil)}</div>
              <div class="text-mute" style="font-size:12px">${remaining} day${remaining === 1 ? '' : 's'} remaining${f && f.reason ? ` · "${escapeHtml(f.reason)}"` : ''}</div>
            </div>
            <button class="btn ghost sm" onclick="unfreezeMember(${m.id})" title="End the freeze early">⏯ Unfreeze</button>
          </div>`;
        })()}

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px">
          <div class="kpi" style="padding:10px 12px"><div class="kpi-label" style="font-size:10px">Total Subscriptions</div><div class="kpi-value" style="font-size:18px">${totalSubs}</div></div>
          <div class="kpi green" style="padding:10px 12px"><div class="kpi-label" style="font-size:10px">Active</div><div class="kpi-value" style="font-size:18px">${activeSubs}</div></div>
          <div class="kpi orange" style="padding:10px 12px"><div class="kpi-label" style="font-size:10px">Expired</div><div class="kpi-value" style="font-size:18px">${expiredSubs}</div></div>
          <div class="kpi blue" style="padding:10px 12px"><div class="kpi-label" style="font-size:10px">Total Paid</div><div class="kpi-value" style="font-size:18px">${fmt(totalPaid)}</div></div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <h3 style="font-size:14px;font-weight:600">Subscription &amp; Renewal History</h3>
          <button class="btn ghost sm" onclick="exportMemberHistoryCSV(${m.id})" style="font-size:11px">📥 Export CSV</button>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Activity</th>
                <th>Coach</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th class="text-right">Amount Paid</th>
                <th>Status</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${subs.length ? subs.map((s, i) => {
                const statusBadge = s.status
                  ? `<span class="badge ${(s.status||'').toLowerCase() === 'expired' ? 'expired' : 'active'}">${s.status}</span>`
                  : '<span class="text-mute">—</span>';
                const coachName = s.coach || (s.coachId ? state.coaches.find(c => c.id === s.coachId)?.name : '—');
                return `
                  <tr>
                    <td>${escapeHtml(s.activity || '—')}${s.manual ? ' <span class="badge" style="font-size:9px;padding:1px 5px">Manual</span>' : ''}</td>
                    <td>${escapeHtml(coachName || '—')}</td>
                    <td>${s.start ? fmtDate(s.start) : '—'}</td>
                    <td>${s.end ? fmtDate(s.end) : '—'}</td>
                    <td class="text-right num font-bold">${s.amountPaid ? fmt(s.amountPaid) : '—'}</td>
                    <td>${statusBadge}</td>
                    <td class="text-right">
                      ${s.manual ? `<button class="btn ghost sm" onclick="deleteRenewal(${m.id}, '${s._rid}')" title="Delete">🗑</button>` : '<span class="text-mute" style="font-size:10px">from sheet</span>'}
                    </td>
                  </tr>
                `;
              }).join('') : `<tr><td colspan="7" class="empty">No subscription history yet. Click "+ Add Renewal" to record one.</td></tr>`}
            </tbody>
          </table>
        </div>

        ${(m.freezes && m.freezes.length) ? `
        <div style="display:flex;align-items:center;justify-content:space-between;margin:18px 0 10px">
          <h3 style="font-size:14px;font-weight:600">❄️ Freeze History</h3>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Start</th>
                <th>End</th>
                <th class="text-right">Days</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${m.freezes.slice().reverse().map(f => {
                const active = m.currentFreezeUntil === f.end && TODAY <= f.end;
                return `<tr>
                  <td>${fmtDate(f.start)}</td>
                  <td>${fmtDate(f.end)}</td>
                  <td class="text-right num font-bold">${f.days}</td>
                  <td class="text-mute" style="font-size:12px">${escapeHtml(f.reason || '—')}</td>
                  <td>${active ? '<span class="badge" style="background:rgba(96,165,250,.18);color:var(--blue)">Active</span>' : '<span class="badge" style="background:var(--surface-2);color:var(--text-mute)">Past</span>'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${(m.sportSwitches && m.sportSwitches.length) ? `
        <div style="display:flex;align-items:center;justify-content:space-between;margin:18px 0 10px">
          <h3 style="font-size:14px;font-weight:600">🔄 Sport Switch History</h3>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>From</th>
                <th>To</th>
                <th>Commission split</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              ${m.sportSwitches.slice().reverse().map(sw => {
                const sn = sw.snapshot;
                let splitCell = '<span class="text-mute" style="font-size:11px">—</span>';
                if (sn) {
                  if (sn.attendedByOld === 0) {
                    splitCell = `<span class="badge" style="background:rgba(245,158,11,.15);color:var(--accent-2);font-size:10px">No attendance · no commission</span>`;
                  } else {
                    splitCell = `
                      <div style="font-size:11px">
                        <span style="color:var(--blue)">${fmt(sn.aShare)}</span>
                        <span class="text-mute"> / </span>
                        <span style="color:var(--green)">${fmt(sn.bShare)}</span>
                      </div>
                      <div class="text-mute" style="font-size:10px">${sn.attendedByOld}/${sn.totalClasses} classes attended</div>
                    `;
                  }
                }
                return `
                <tr>
                  <td>${fmtDate(sw.date)}</td>
                  <td><span class="badge">${escapeHtml(sw.fromSport)}</span> <span class="text-mute" style="font-size:11px">· ${escapeHtml(sw.fromCoach || coachName(sw.fromCoachId))}</span></td>
                  <td><span class="badge blue">${escapeHtml(sw.toSport)}</span> <span class="text-mute" style="font-size:11px">· ${escapeHtml(sw.toCoach || coachName(sw.toCoachId))}</span></td>
                  <td>${splitCell}</td>
                  <td class="text-mute" style="font-size:12px">${escapeHtml(sw.reason || '—')}</td>
                </tr>
              `;}).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${(m.withdrawals && m.withdrawals.length) ? `
        <div style="display:flex;align-items:center;justify-content:space-between;margin:18px 0 10px">
          <h3 style="font-size:14px;font-weight:600">↩ Withdrawal History</h3>
          <span class="text-mute" style="font-size:11px">${m.withdrawals.length} withdrawal${m.withdrawals.length === 1 ? '' : 's'} · ${fmt(m.withdrawals.reduce((s,w) => s + (w.refundAmount || 0), 0))} QAR refunded</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Sport</th>
                <th>Coach</th>
                <th class="text-right">Paid</th>
                <th class="text-right">Attended</th>
                <th class="text-right">Used</th>
                <th class="text-right">Refunded</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              ${m.withdrawals.slice().reverse().map(w => `
                <tr>
                  <td>${fmtDate(w.date)}</td>
                  <td><span class="badge">${escapeHtml(w.sport)}</span></td>
                  <td class="text-mute" style="font-size:12px">${w.sport === SUMMER_CAMP ? '<span style="font-style:italic">no coach</span>' : escapeHtml(w.coachName || coachName(w.coachId) || '—')}</td>
                  <td class="text-right num">${fmt(w.originalPrice)}</td>
                  <td class="text-right num">${w.attendedClasses}/${w.totalClasses}</td>
                  <td class="text-right num" style="color:var(--green)">${fmt(w.usedAmount)}</td>
                  <td class="text-right num" style="color:var(--accent-2);font-weight:700">${fmt(w.refundAmount)}</td>
                  <td class="text-mute" style="font-size:12px">${escapeHtml(w.reason || '—')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${(() => {
          // Other transactions: rentals (matched by phone/QID) + product sales (matched by customerId)
          const memberSales = (state.sales || []).filter(s => s.customerId === m.id);
          // Rentals don't carry customerId (walk-in shape), but phone/QID may match
          const memberRentals = (state.rentals || []).filter(r => {
            if (m.phone && r.customerPhone === m.phone) return true;
            if (m.qid && r.customerQid && r.customerQid === m.qid) return true;
            return false;
          });
          if (!memberSales.length && !memberRentals.length) return '';
          const salesTotal = memberSales.reduce((a, s) => a + (s.total || 0), 0);
          const rentTotal = memberRentals.reduce((a, r) => a + (r.amount || 0), 0);
          return `
          <div style="display:flex;align-items:center;justify-content:space-between;margin:18px 0 10px">
            <h3 style="font-size:14px;font-weight:600">🧾 Other transactions</h3>
            <span class="text-mute" style="font-size:11px">${memberSales.length} sale${memberSales.length===1?'':'s'} · ${memberRentals.length} rental${memberRentals.length===1?'':'s'} · ${fmt(salesTotal + rentTotal)} QAR</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Type</th><th>Details</th><th class="text-right">Amount</th><th>Method</th><th></th></tr>
              </thead>
              <tbody>
                ${[...memberSales.map(s => ({ kind: 'sale', date: s.date, items: s.items, amount: s.total, method: s.method, invId: s.invoiceId })),
                   ...memberRentals.map(r => ({ kind: 'rental', date: r.date, facility: r.facility, hours: r.hours, amount: r.amount, method: r.method, invId: r.invoiceId }))]
                  .sort((a,b) => (b.date||'').localeCompare(a.date||''))
                  .map(t => {
                    if (t.kind === 'sale') {
                      const desc = (t.items || []).map(it => `${it.qty}× ${escapeHtml(it.name)}`).join(', ');
                      return `<tr>
                        <td class="text-dim" style="white-space:nowrap;font-size:11px">${fmtDate(t.date)}</td>
                        <td><span class="badge purple">🛒 Sale</span></td>
                        <td class="text-mute" style="font-size:12px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${desc}</td>
                        <td class="text-right num font-bold">${fmt(t.amount || 0)}</td>
                        <td><span class="badge ${t.method === 'card' ? 'blue' : ''}">${t.method || 'cash'}</span></td>
                        <td class="text-right">${t.invId ? `<button class="btn ghost sm" onclick="closeModal();printInvoicePDF(${t.invId})">📄</button>` : ''}</td>
                      </tr>`;
                    }
                    const icon = t.facility === 'Football Court' ? '⚽' : t.facility === 'Boxing Room' ? '🥊' : '🏊';
                    return `<tr>
                      <td class="text-dim" style="white-space:nowrap;font-size:11px">${fmtDate(t.date)}</td>
                      <td><span class="badge pending">🏟 Rental</span></td>
                      <td style="font-size:12px">${icon} ${escapeHtml(t.facility)} · ${t.hours}h</td>
                      <td class="text-right num font-bold">${fmt(t.amount || 0)}</td>
                      <td><span class="badge ${t.method === 'card' ? 'blue' : ''}">${t.method || 'cash'}</span></td>
                      <td class="text-right">${t.invId ? `<button class="btn ghost sm" onclick="closeModal();printInvoicePDF(${t.invId})">📄</button>` : ''}</td>
                    </tr>`;
                  }).join('')}
              </tbody>
            </table>
          </div>
          `;
        })()}
      </div>
    `;
  }

  function renderMembers() {
    const filtered = state.members.filter(memberFilter);
    $('#hist-list').innerHTML = filtered.length ? filtered.map(m => {
      const subCount = (m.subscriptions || []).length + (m.renewals || []).length;
      const isSel = m.id === state2.selectedId;
      return `
        <div class="hist-mem-row" data-id="${m.id}" style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);${isSel ? 'background:rgba(242,96,96,.12);border-left:3px solid var(--accent);padding-left:9px' : ''}">
          <div class="avatar" style="width:30px;height:30px;font-size:10px;background:linear-gradient(135deg,var(--blue),var(--purple));flex-shrink:0">${initials(m.name)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(m.name)}</div>
            <div class="text-mute" style="font-size:10px">${escapeHtml(m.sport)} · ${escapeHtml(coachName(m.coachId))}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">
            <span class="badge ${memberStatus(m).toLowerCase()}" style="font-size:9px;padding:2px 5px">${memberStatus(m)}</span>
            ${subCount ? `<span class="text-mute" style="font-size:10px">${subCount} sub${subCount===1?'':'s'}</span>` : ''}
          </div>
        </div>
      `;
    }).join('') : `<div class="empty" style="padding:20px">No members match</div>`;

    $('#hist-mem-count').textContent = `${filtered.length} of ${state.members.length}`;

    $$('.hist-mem-row[data-id]').forEach(row => {
      row.addEventListener('click', () => {
        state2.selectedId = parseInt(row.dataset.id);
        renderMembers();
        renderTimeline();
      });
    });
  }

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Member History</h1>
        <div class="subtitle">Subscription &amp; renewal records · activity · amount paid · start / end · coach</div>
      </div>
    </div>

    <div class="card" style="display:grid;grid-template-columns:300px 1fr;gap:0;padding:0;overflow:hidden">
      <div style="border-right:1px solid var(--border);display:flex;flex-direction:column;max-height:80vh">
        <div style="padding:12px;border-bottom:1px solid var(--border);background:var(--surface-2)">
          <div class="search" style="margin-bottom:6px"><input id="hist-search" type="text" placeholder="Search name, phone, QID..." /></div>
          <div class="text-mute" style="font-size:11px"><span id="hist-mem-count"></span></div>
        </div>
        <div id="hist-list" style="flex:1;overflow-y:auto;min-height:0"></div>
      </div>
      <div id="hist-right" style="padding:16px;overflow-y:auto;max-height:80vh"></div>
    </div>
  `;

  $('#hist-search').addEventListener('input', e => { state2.search = e.target.value; renderMembers(); });

  renderMembers();
  renderTimeline();
};

// ─── Switch a member's sport mid-cycle ────────────────────────────
// THE RULE (locked in v95):
//   1. Read the OLD enrollment's CURRENT attended count (Y marks for old sport,
//      across all months, on or before switch date).
//   2. attended / totalClasses × price = OLD coach's locked share (A_share)
//   3. price − A_share = NEW coach's share (B_share)
//   4. If attended == 0 → A_share = 0 AND B_share = 0 (nobody earns)
//   5. The original invoice line gets REPLACED:
//        - The old line is rewritten with price = A_share
//        - A new line is appended to the SWITCH MONTH's invoice (or a new
//          adjustment invoice) with price = B_share, coach = B, sport = NEW
//      That way Coach A's commission shows on the original invoice month,
//      and Coach B's commission shows on the switch month going forward.
//   6. A switchSwitches[] record stores the snapshot so admin can audit later.
//
// History preservation: the OLD sport attendance and subscription rows STAY
// in place. The enrollment row is updated to the new sport+coach. Future
// commission ONLY comes from the new enrollment.
// ─── Withdraw / Refund flow ─────────────────────────────────────────
// When a paying member wants to leave a sport mid-cycle, we calculate the
// refund based on classes attended vs total purchased, then create a
// "withdraw-credit" invoice that:
//   1. Reduces revenue by the refund amount (negative invoice amount)
//   2. Reduces coach commission base by the unused portion (negative line item)
//   3. Removes the enrollment from the member
//
// The original payment invoice stays UNTOUCHED — audit trail. The withdraw
// invoice nets the difference, and shows up in the withdraw month's payroll.
//
// Math (matches Switch Sport reconciliation, simplified to one-side):
//   attendedRatio = attendedClasses / totalClasses
//   usedAmount    = price × attendedRatio    (member's value received)
//   refundAmount  = price − usedAmount       (what we return)
//   commissionAdj = −refundAmount            (coach loses commission on unused portion)
window.withdrawSport = function(memberId, sport) {
  const m = state.members.find(x => x.id === memberId);
  if (!m) { toast('Member not found', 'error'); return; }

  // Find the enrollment row
  const enrollment = (m.enrollments || []).find(e => e.sport === sport);
  if (!enrollment) { toast(`No enrollment for ${sport}`, 'error'); return; }

  const totalClasses = parseInt(enrollment.classes) || 0;
  const price = parseFloat(enrollment.price) || 0;
  if (price <= 0) {
    toast('Cannot withdraw a free enrollment — just delete the row instead', 'error');
    return;
  }

  // Count attended classes for this sport (Y marks in dailyAttendance)
  let attended = 0;
  const ymKeys = Object.keys(m.dailyAttendance || {});
  for (const ym of ymKeys) {
    const sportData = m.dailyAttendance[ym]?.[sport] || {};
    for (const mark of Object.values(sportData)) {
      if (mark === 'Y') attended++;
    }
  }

  const isCamp = sport === SUMMER_CAMP;
  // This sport's start date (from its latest subscription, else member start).
  let sportStart = null;
  for (const s of (m.subscriptions || [])) if (s.activity === sport && s.start) sportStart = s.start;
  sportStart = sportStart || enrollment.start || m.startDate || null;

  const graceDefault = (state.settings && state.settings.refundGraceDays != null) ? state.settings.refundGraceDays : 7;
  const feeDefault = (state.settings && state.settings.refundFeePct != null) ? state.settings.refundFeePct : 20;
  const calc = computeWithdrawRefund({ price, totalClasses, attended, startDate: sportStart, refundDate: TODAY, graceDays: graceDefault, feePct: feeDefault });
  const usedAmount = calc.used;
  const refundAmount = calc.refund;
  const graceLine = (d, withinGrace) => d == null
    ? '<span class="text-mute">start date unknown — treated as within grace</span>'
    : `${d} day${d === 1 ? '' : 's'} since start · ${withinGrace ? '<b style="color:var(--green)">within grace</b>' : '<b style="color:var(--accent-2)">after grace</b>'}`;

  // Live recompute when grace days / fee % / refund date change.
  window._recalcWithdraw = function() {
    const g = document.getElementById('wd-grace');
    const f = document.getElementById('wd-fee');
    const dt = document.getElementById('wd-date');
    const c = computeWithdrawRefund({ price, totalClasses, attended, startDate: sportStart, refundDate: (dt && dt.value) || TODAY, graceDays: g ? g.value : graceDefault, feePct: f ? f.value : feeDefault });
    const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    set('wd-since', graceLine(c.daysSinceStart, c.withinGrace));
    set('wd-used', `${fmt(c.used)} QAR`);
    set('wd-unused', `${fmt(c.unused)} QAR`);
    set('wd-fee-line', c.withinGrace ? 'No admin fee (within grace period)' : `Admin fee (${c.feePct}% of unused): −${fmt(c.fee)} QAR`);
    const rf = document.getElementById('wd-refund');
    if (rf && !rf.dataset.touched) rf.value = c.refund;
  };

  // Show the withdrawal confirmation modal
  showModal({
    title: `↩ Withdraw ${m.name} from ${sport}`,
    body: `
      <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:8px;padding:12px;margin-bottom:14px;font-size:12px">
        <div style="font-weight:700;margin-bottom:6px;color:var(--accent-2)">⚠ This will:</div>
        <ul style="margin:0;padding-left:18px;line-height:1.7">
          <li>Issue the refund below to the member</li>
          <li>Remove ${sport} from their enrollments${(m.enrollments || []).length <= 1 ? ' and mark the member <b>Withdrawn</b>' : ''}</li>
          ${!isCamp && enrollment.coachId
            ? `<li>Deduct the refunded amount from <b>${escapeHtml(coachName(enrollment.coachId))}</b>'s commission base in ${fmtMonth(currentMonth())}</li>`
            : isCamp
              ? `<li>No coach commission impact (Summer Camp revenue belongs to club)</li>`
              : `<li>No coach assigned — no commission impact</li>`}
          <li>The original payment invoice stays untouched (audit trail)</li>
        </ul>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
        <div class="field" style="margin:0">
          <label>Original payment</label>
          <div style="padding:10px;background:var(--surface-2);border-radius:8px;font-weight:700">${fmt(price)} QAR</div>
        </div>
        <div class="field" style="margin:0">
          <label>Classes attended</label>
          <div style="padding:10px;background:var(--surface-2);border-radius:8px">
            <b>${attended} / ${totalClasses}</b>
            <span class="text-mute" style="font-size:11px"> · ${calc.total > 0 ? Math.round(calc.attended / calc.total * 100) : 0}% used</span>
          </div>
        </div>
      </div>

      <div style="background:var(--surface-2);border-radius:8px;padding:12px;margin-bottom:14px;font-size:12px;line-height:1.8">
        <div>📅 <span id="wd-since">${graceLine(calc.daysSinceStart, calc.withinGrace)}</span></div>
        <div>Used (kept by club): <b id="wd-used">${fmt(calc.used)} QAR</b></div>
        <div>Unused (refundable): <b id="wd-unused">${fmt(calc.unused)} QAR</b></div>
        <div id="wd-fee-line" style="color:var(--text-mute)">${calc.withinGrace ? 'No admin fee (within grace period)' : `Admin fee (${calc.feePct}% of unused): −${fmt(calc.fee)} QAR`}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
        <div class="field" style="margin:0">
          <label>Grace period (days)</label>
          <input id="wd-grace" type="number" min="0" step="1" value="${graceDefault}" oninput="window._recalcWithdraw()" />
        </div>
        <div class="field" style="margin:0">
          <label>Admin fee after grace (%)</label>
          <input id="wd-fee" type="number" min="0" max="100" step="1" value="${feeDefault}" oninput="window._recalcWithdraw()" />
        </div>
      </div>

      <div class="field">
        <label>Refund to member <span style="color:var(--accent)">*</span></label>
        <input id="wd-refund" type="number" min="0" max="${price}" step="0.01" value="${refundAmount}" oninput="this.dataset.touched=1" style="font-size:18px;font-weight:700;color:var(--accent-2)" />
        <div class="text-mute" style="font-size:10px;margin-top:3px">Auto-calculated from grace + attendance; adjust if needed</div>
      </div>

      <div class="field">
        <label>Refund date</label>
        <input id="wd-date" type="date" value="${TODAY}" oninput="window._recalcWithdraw()" />
      </div>

      <div class="field">
        <label>Refund method</label>
        <select id="wd-method">
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="transfer">Bank transfer</option>
        </select>
      </div>

      <div class="field">
        <label>Reason (recorded in audit trail)</label>
        <input id="wd-reason" placeholder="e.g. moved to another club, schedule conflict" />
      </div>
    `,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: '↩ Confirm Withdrawal', class: 'btn danger', onclick: () => {
        const refund = Math.max(0, parseFloat(document.getElementById('wd-refund').value) || 0);
        const refundDate = document.getElementById('wd-date').value || TODAY;
        const method = document.getElementById('wd-method').value || 'cash';
        const reason = document.getElementById('wd-reason').value.trim() || null;

        if (refund > price) { toast(`Refund cannot exceed paid amount (${fmt(price)} QAR)`, 'error'); return; }

        const refundMonth = refundDate.slice(0, 7);
        const withdrawRef = `WD-${Date.now().toString().slice(-6)}`;

        // Create the withdraw-credit invoice. NEGATIVE amount + negative line
        // item so coach commission base goes down by `refund` in this month.
        // Summer Camp has no commission anyway (Summer Camp filter handles it).
        const lineItems = [{
          sport,
          coach: enrollment.coachId ? coachName(enrollment.coachId) : null,
          coachId: enrollment.coachId || null,
          classes: -(totalClasses - attended),  // negative visual cue
          price: -refund,                       // negative price → negative commission base
        }];
        state.invoices.push({
          id: nextId(state.invoices),
          date: refundDate,
          description: `${m.name} — withdrawal refund: ${sport}` + (reason ? ` (${reason})` : ''),
          amount: -refund,           // negative → reduces revenue
          method,
          month: refundMonth,
          ref: withdrawRef,
          sport,
          coach: enrollment.coachId ? coachName(enrollment.coachId) : null,
          coachId: enrollment.coachId || null,
          customerId: m.id,
          customerName: m.name,
          category: 'Membership',
          activityType: 'withdraw-credit',
          withdrawCredit: true,
          reason,
          lineItems,
        });

        // Record on member: withdrawal audit + remove enrollment
        if (!Array.isArray(m.withdrawals)) m.withdrawals = [];
        m.withdrawals.push({
          id: 'wd_' + Date.now(),
          date: refundDate,
          sport,
          coachId: enrollment.coachId || null,
          coachName: enrollment.coachId ? coachName(enrollment.coachId) : null,
          originalPrice: price,
          totalClasses,
          attendedClasses: attended,
          usedAmount,
          refundAmount: refund,
          method,
          reason,
          invoiceRef: withdrawRef,
          createdAt: new Date().toISOString(),
        });
        // Remove from enrollments
        m.enrollments = (m.enrollments || []).filter(e => e.sport !== sport);
        // Recalculate expiry: latest end across remaining enrollments via subs
        const remainingEnds = (m.subscriptions || [])
          .filter(s => s.activity !== sport && s.end)
          .map(s => s.end);
        m.expiryDate = remainingEnds.length ? remainingEnds.sort().pop() : null;
        // No sports left → member has fully withdrawn: mark Withdrawn + clear expiry.
        if (!(m.enrollments || []).length) { m.status = 'Withdrawn'; m.expiryDate = null; }
        // If this was the legacy primary sport, switch to any remaining one
        if (m.sport === sport) {
          const nextEnr = (m.enrollments || [])[0];
          if (nextEnr) {
            m.sport = nextEnr.sport;
            m.coachId = nextEnr.coachId;
          } else {
            // Last sport withdrawn — clear the legacy primary fields so the
            // member no longer appears on the Enrolled report via the m.sport
            // fallback (this was the "ghost enrollment" bug).
            m.sport = null;
            m.coachId = null;
          }
        }

        save();
        closeModal();
        audit('sport.withdraw', `member:${m.id}`,
          `Withdrew ${m.name} from ${sport} — refunded ${fmt(refund)} QAR`,
          { memberId: m.id, sport, originalPrice: price, usedAmount, refundAmount: refund, attended, totalClasses, invoiceRef: withdrawRef });
        render();
        toast(`✓ Refund issued: ${fmt(refund)} QAR · ${sport} removed from ${m.name}`);
        setTimeout(() => viewMember(m.id), 200);
      }},
    ],
  });
};

window.switchSport = function(memberId) {
  const m = state.members.find(x => x.id === memberId);
  if (!m) return;

  // Build the list of CURRENT enrollments (the ones eligible to be switched).
  // Fall back to subscriptions if enrollments[] isn't populated.
  const enrolled = (m.enrollments && m.enrollments.length) ? m.enrollments
    : (m.subscriptions || []).reduce((acc, s) => {
        if (!s.activity) return acc;
        if (!acc.find(x => x.sport === s.activity)) {
          acc.push({ sport: s.activity, coachId: s.coachId, classes: s.totalClasses || 0, price: s.amountPaid || 0 });
        }
        return acc;
      }, []);
  if (!enrolled.length) {
    toast('No active enrollments to switch from', 'error');
    return;
  }

  const sportsList = SPORTS.slice();
  const selCoaches = activeCoaches();
  const coachOpts = (cid) => selCoaches.map(co => `<option value="${co.id}" ${co.id === cid ? 'selected' : ''}>${escapeHtml(co.name)}</option>`).join('');

  // Default to the first enrollment as the "from"
  const defaultFrom = enrolled[0];
  const enrolledSports = new Set(enrolled.map(e => e.sport));
  const defaultToSport = sportsList.find(s => s !== defaultFrom.sport && !enrolledSports.has(s)) ||
                         sportsList.find(s => s !== defaultFrom.sport) || sportsList[0];

  // Helper: count attended Y marks for a sport up to (inclusive) a given date.
  // Reads m.dailyAttendance[YYYY-MM][sportName] = {day: 'Y'|'N'} structure.
  function countAttendedUpTo(sport, untilDateStr) {
    if (!m.dailyAttendance) return 0;
    let total = 0;
    for (const monthKey of Object.keys(m.dailyAttendance)) {
      const mo = m.dailyAttendance[monthKey];
      const sportMap = mo && typeof mo === 'object' ? mo[sport] : null;
      if (!sportMap) continue;
      for (const day of Object.keys(sportMap)) {
        if (sportMap[day] !== 'Y') continue;
        const dateStr = `${monthKey}-${String(day).padStart(2, '0')}`;
        if (dateStr <= untilDateStr) total++;
      }
    }
    return total;
  }

  showModal({
    title: `🔄 Switch Sport · ${m.name}`,
    body: `
      <div style="background:rgba(91,141,239,.06);border:1px solid rgba(91,141,239,.2);border-radius:8px;padding:10px;margin-bottom:14px;display:flex;gap:10px;align-items:flex-start">
        <div style="font-size:18px">💡</div>
        <div style="font-size:12px;color:var(--text-dim);line-height:1.5">
          The enrollment row is updated to the new sport/coach. Past attendance under the old sport stays as history. <b>Commission is split based on attended classes:</b> old coach gets <code>(attended / planned) × price</code>, new coach gets the remainder. If no classes were attended, nobody earns commission from this enrollment.
        </div>
      </div>

      <div class="form-row">
        <div class="field"><label>Switch FROM</label>
          <select id="sw-from">
            ${enrolled.map((e, i) => `<option value="${i}">${escapeHtml(e.sport)} · with ${escapeHtml(coachName(e.coachId))} · ${e.classes || 0} planned · ${fmt(e.price || 0)} QAR</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Switch date</label><input id="sw-date" type="date" value="${TODAY}" /></div>
      </div>

      <div style="margin:14px 0 6px;font-size:11px;color:var(--blue);text-transform:uppercase;letter-spacing:.6px;font-weight:600">Switch TO</div>
      <div class="form-row">
        <div class="field"><label>New sport</label>
          <select id="sw-sport">
            ${sportsList.map(s => `<option ${s === defaultToSport ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>New coach</label>
          <select id="sw-coach">${coachOpts(defaultFrom.coachId)}</select>
        </div>
      </div>

      <div class="field"><label>Reason (optional)</label><input id="sw-reason" placeholder="e.g. Wants to focus on Boxing" /></div>

      <div id="sw-preview" style="margin-top:10px;padding:12px;background:var(--surface-2);border-radius:6px;font-size:12px;line-height:1.6"></div>
    `,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: '🔄 Confirm Switch', class: 'btn primary', onclick: () => {
        const fromIdx = parseInt($('#sw-from').value);
        const from = enrolled[fromIdx];
        const toSport = $('#sw-sport').value;
        const toCoachId = parseInt($('#sw-coach').value);
        const switchDate = $('#sw-date').value || TODAY;
        const reason = $('#sw-reason').value.trim() || null;

        if (!from) { toast('Pick the sport to switch from', 'error'); return; }
        if (!toSport) { toast('Pick the new sport', 'error'); return; }
        if (toSport !== SUMMER_CAMP && !toCoachId) { toast('Pick the new coach', 'error'); return; }
        if (from.sport === toSport && from.coachId === toCoachId) {
          toast('No change — same sport and coach', 'error');
          return;
        }

        // ─── COMPUTE THE SPLIT ─────────────────────────────────────
        // Summer Camp has no coach commission — if EITHER side is Summer Camp,
        // skip the reconciliation entirely. Just update the enrollment record.
        const fromIsCamp = from.sport === SUMMER_CAMP;
        const toIsCamp = toSport === SUMMER_CAMP;
        const skipReconciliation = fromIsCamp || toIsCamp;

        const attendedA = countAttendedUpTo(from.sport, switchDate);
        const totalClasses = parseInt(from.classes) || 0;
        // Base the reconciliation on what coach A was ACTUALLY credited for this
        // sport (the amount shown in the revenue report), NOT the nominal
        // enrollment price — so a switch never claws back more than was paid.
        const creditedBase = coachBaseForSport(m, from.sport, from.coachId);
        const price = creditedBase > 0 ? creditedBase : (parseFloat(from.price) || 0);
        let aShare = 0, bShare = 0;
        if (skipReconciliation) {
          // No commission to split when Summer Camp is on either side
          aShare = 0; bShare = 0;
        } else {
          const split = computeSwitchSplit(price, attendedA, totalClasses);
          aShare = split.aShare; bShare = split.bShare;
        }
        const switchMonth = switchDate.slice(0, 7);

        // ─── CREATE SWITCH-CREDIT INVOICE IN THE SWITCH MONTH ──────
        // The original invoice is LEFT ALONE — Coach A keeps the historical
        // record of what was paid to him for that month. Instead, we create
        // an internal reconciliation invoice in the switch month with TWO
        // lineItems that net to zero:
        //   1. A's negative adjustment: -(price - aShare)
        //      This deducts A's overpayment from his switch-month commission
        //   2. B's positive earning: +bShare
        //      This credits B for the new coach's share
        // Net amount = 0 (it's pure accounting, not revenue).
        // SKIP entirely for Summer Camp (no commission to split).
        const deductionA = skipReconciliation ? 0 : -(price - aShare);
        if (!skipReconciliation && (bShare > 0 || deductionA < 0)) {
          const switchRef = `SW-${Date.now().toString().slice(-6)}`;
          const lineItems = [];
          if (deductionA < 0) {
            lineItems.push({
              sport: from.sport,
              coach: coachName(from.coachId),
              coachId: from.coachId,
              classes: -(totalClasses - attendedA),  // negative class count for visual cue
              price: deductionA,                     // NEGATIVE — deducts from A
            });
          }
          if (bShare > 0) {
            lineItems.push({
              sport: toSport,
              coach: coachName(toCoachId),
              coachId: toCoachId,
              classes: Math.max(0, totalClasses - attendedA),
              price: bShare,
            });
          }
          state.invoices.push({
            id: nextId(state.invoices),
            date: switchDate,
            description: `${m.name} — sport switch reconciliation: ${from.sport} → ${toSport}`,
            amount: 0,           // lineItems net to zero — no revenue impact
            method: 'transfer',  // internal accounting only
            month: switchMonth,
            ref: switchRef,
            sport: `${from.sport} → ${toSport}`,
            coach: `${coachName(from.coachId)} → ${coachName(toCoachId)}`,
            coachId: null,       // mixed coaches — read from lineItems
            customerId: m.id,
            customerName: m.name,
            category: 'Membership',
            activityType: 'switch-credit',
            switchCredit: true,  // flag for revenue report filtering
            lineItems,
          });
        }

        // ─── RECORD THE SWITCH ─────────────────────────────────────
        if (!Array.isArray(m.sportSwitches)) m.sportSwitches = [];
        m.sportSwitches.push({
          id: 'sw_' + Date.now(),
          date: switchDate,
          fromSport: from.sport,
          fromCoachId: from.coachId,
          fromCoach: coachName(from.coachId),
          toSport,
          toCoachId,
          toCoach: coachName(toCoachId),
          reason,
          // Locked snapshot — never recalculates
          snapshot: {
            attendedByOld: attendedA,
            totalClasses,
            originalPrice: price,
            aShare,
            bShare,
            switchMonth,
          },
          createdAt: new Date().toISOString(),
        });

        // ─── UPDATE THE ENROLLMENT ROW IN PLACE ────────────────────
        if (!Array.isArray(m.enrollments)) m.enrollments = [];
        if (m.enrollments.length === 0 && enrolled.length) {
          m.enrollments = enrolled.map(e => ({ ...e }));
        }
        // Summer Camp has no coach — force null when switching TO camp
        const finalToCoachId = toIsCamp ? null : toCoachId;
        const targetIdx = m.enrollments.findIndex(e => e.sport === from.sport && e.coachId === from.coachId);
        if (targetIdx >= 0) {
          m.enrollments[targetIdx].sport = toSport;
          m.enrollments[targetIdx].coachId = finalToCoachId;
          // Don't touch classes/price on the enrollment row — those reflect
          // the original deal; commission credits live in the invoice lineItems.
        } else {
          m.enrollments.push({ sport: toSport, coachId: finalToCoachId, classes: from.classes || 0, price: from.price || 0 });
        }

        // If the old sport was the member's PRIMARY sport (legacy fields), update those too
        if (m.sport === from.sport && m.coachId === from.coachId) {
          m.sport = toSport;
          m.coachId = finalToCoachId;
        }

        audit('sport.switch', `member:${m.id}`,
          `Switched ${from.sport} → ${toSport} for ${m.name || m.nameArabic}`,
          { memberId: m.id, name: m.name, fromSport: from.sport, toSport, fromCoachId: from.coachId, toCoachId });

        save();
        closeModal();
        render();
        let msg;
        if (skipReconciliation) {
          msg = `Switched · ${from.sport} → ${toSport} · no commission (Summer Camp involved)`;
        } else if (attendedA === 0) {
          msg = `Switched · no commission earned (no attendance under ${from.sport})`;
        } else {
          msg = `Switched · ${coachName(from.coachId)} keeps ${fmt(aShare)} · ${coachName(toCoachId)} gets ${fmt(bShare)}`;
        }
        toast(msg);
      }},
    ],
  });

  // Wire live preview of commission split — recalculates as user picks options
  function updatePreview() {
    const fromIdx = parseInt($('#sw-from')?.value || 0);
    const from = enrolled[fromIdx];
    if (!from) return;
    const switchDate = $('#sw-date')?.value || TODAY;
    const newCoachId = parseInt($('#sw-coach')?.value || from.coachId);
    const attended = countAttendedUpTo(from.sport, switchDate);
    const totalClasses = parseInt(from.classes) || 0;
    const price = parseFloat(from.price) || 0;
    const oldCoachName = coachName(from.coachId);
    const newCoachName = coachName(newCoachId);
    let aShare = 0, bShare = 0;
    if (attended === 0) {
      aShare = 0; bShare = 0;
    } else if (totalClasses > 0) {
      aShare = (attended / totalClasses) * price;
      bShare = price - aShare;
    }
    const switchMonth = switchDate.slice(0, 7);
    const monthLabel = fmtMonth(switchMonth);

    let body;
    const toSport = $('#sw-sport')?.value || '';
    const fromIsCamp = from.sport === SUMMER_CAMP;
    const toIsCamp = toSport === SUMMER_CAMP;
    if (fromIsCamp || toIsCamp) {
      body = `
        <div style="font-weight:700;color:var(--accent-2);margin-bottom:6px">🌞 Summer Camp · no commission reconciliation</div>
        <div style="color:var(--text-dim)">${fromIsCamp ? 'Switching FROM Summer Camp — no commission was earned to split.' : 'Switching TO Summer Camp — new sport generates no commission.'}</div>
        <div style="margin-top:4px;color:var(--text-mute);font-size:11px">The enrollment record will be updated. Past Summer Camp revenue stays as club income.</div>
      `;
    } else if (attended === 0) {
      body = `
        <div style="font-weight:700;color:var(--accent);margin-bottom:6px">⚠️ No commission earned</div>
        <div>${escapeHtml(oldCoachName)} has 0 attended classes for ${from.sport} as of ${fmtDate(switchDate)}.</div>
        <div style="margin-top:4px;color:var(--text-mute)">Neither coach earns commission from this enrollment. Future enrollments / renewals will count for the new coach.</div>
      `;
    } else {
      const rate = parseFloat(state.coaches.find(c => c.id === from.coachId)?.rate) || 0;
      const newRate = parseFloat(state.coaches.find(c => c.id === newCoachId)?.rate) || 0;
      const aCommissionOriginal = price * rate / 100;
      const aCommissionAdjusted = aShare * rate / 100;
      const aDeduction = aCommissionOriginal - aCommissionAdjusted;
      const bCommission = bShare * newRate / 100;
      body = `
        <div style="font-weight:700;margin-bottom:6px">📊 Commission reconciliation (${escapeHtml(monthLabel)})</div>
        <div style="font-size:11px;color:var(--text-dim);margin-bottom:8px">${escapeHtml(oldCoachName)} attended ${attended} of ${totalClasses} classes (${totalClasses ? Math.round(attended/totalClasses*100) : 0}%) — he keeps ${fmt(aShare)} QAR base, ${escapeHtml(newCoachName)} gets ${fmt(bShare)} QAR.</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div style="padding:8px;background:rgba(242,96,96,.06);border:1px solid rgba(242,96,96,.2);border-radius:6px">
            <div style="font-size:10px;color:var(--red);text-transform:uppercase;font-weight:600">${escapeHtml(oldCoachName)} · deduction</div>
            <div style="font-size:16px;font-weight:700;margin-top:2px;color:var(--red)">−${fmt(aDeduction)} QAR</div>
            <div style="font-size:10px;color:var(--text-mute);margin-top:2px">in ${escapeHtml(monthLabel)}'s payroll</div>
            <div style="font-size:10px;color:var(--text-mute)">(was paid for ${fmt(price)}, should have been ${fmt(aShare)})</div>
          </div>
          <div style="padding:8px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);border-radius:6px">
            <div style="font-size:10px;color:var(--green);text-transform:uppercase;font-weight:600">${escapeHtml(newCoachName)} · earning</div>
            <div style="font-size:16px;font-weight:700;margin-top:2px;color:var(--green)">+${fmt(bCommission)} QAR</div>
            <div style="font-size:10px;color:var(--text-mute);margin-top:2px">in ${escapeHtml(monthLabel)}'s payroll</div>
            <div style="font-size:10px;color:var(--text-mute)">(commission on ${fmt(bShare)} base @ ${newRate}%)</div>
          </div>
        </div>
        <div style="margin-top:8px;padding:6px 8px;background:var(--surface);border-radius:4px;font-size:10px;color:var(--text-mute)">
          💡 The original ${fmtMonth(((state.invoices.find(i => i.customerId === m.id && (i.lineItems||[]).some(li => li.sport === from.sport && li.coachId === from.coachId))?.month) || switchMonth))} invoice stays unchanged. An internal reconciliation invoice is created in ${escapeHtml(monthLabel)} to net the two coaches correctly. Snapshot locks at confirm — won't recalculate later.
        </div>
      `;
    }
    const elPrev = $('#sw-preview');
    if (elPrev) elPrev.innerHTML = body;
  }
  function rebuildSwCoaches() {
    const sportSel = $('#sw-sport'), coachSel = $('#sw-coach');
    if (!sportSel || !coachSel) return;
    const sport = sportSel.value;
    if (sport === SUMMER_CAMP) { coachSel.innerHTML = '<option value="">— none (camp) —</option>'; return; }
    const prev = parseInt(coachSel.value) || null;
    const list = coachesForSport(sport, prev);
    coachSel.innerHTML = list.length
      ? list.map(co => `<option value="${co.id}" ${co.id === prev ? 'selected' : ''}>${coachOptionLabel(co, sport)}</option>`).join('')
      : '<option value="">— no active coach teaches this sport —</option>';
  }
  setTimeout(() => {
    const sp = $('#sw-sport');
    if (sp) sp.addEventListener('change', () => { rebuildSwCoaches(); updatePreview(); });
    ['#sw-from','#sw-coach','#sw-date'].forEach(id => {
      const elx = $(id);
      if (elx) elx.addEventListener('change', updatePreview);
    });
    rebuildSwCoaches();   // filter coaches to the default new sport on open
    updatePreview();
  }, 50);
};

// ─── Add a renewal / new subscription record ──────────────────────
// For multi-sport members, the member's enrolled sports are offered as quick
// picks so a specific sport can be renewed — even if its classes aren't finished.
window.addRenewal = function(memberId) {
  const m = state.members.find(x => x.id === memberId);
  if (!m) return;
  const sports = ['MMA','Boxing','Kick Boxing','Karate','Taekwondo','Gymnastic','Football','Swimming','Zumba'];

  // Active coaches (registration rule), keeping current coach selectable if inactive
  const selCoaches = activeCoaches();
  if (m.coachId && !selCoaches.some(c => c.id === m.coachId)) {
    const cur = state.coaches.find(c => c.id === m.coachId); if (cur) selCoaches.push(cur);
  }
  const coachOpts = c => selCoaches.map(co => `<option value="${co.id}" ${co.id===c?'selected':''}>${escapeHtml(co.name)}${isCoachActive(co)?'':' (inactive)'}</option>`).join('');

  // The member's current enrolled sports (each with coach + class progress)
  const enrolled = (m.enrollments && m.enrollments.length) ? m.enrollments
    : (m.subscriptions || []).map(s => ({ sport: s.activity, coachId: s.coachId, classes: s.totalClasses || 0, price: s.amountPaid || 0 }));
  // De-dupe by sport+coach
  const seen = new Set();
  const enrolledUnique = enrolled.filter(e => { const k = e.sport + '|' + e.coachId; if (seen.has(k)) return false; seen.add(k); return true; });

  // Build a quick-pick list showing class progress so you can renew before finishing
  function progressFor(sport, coachId) {
    const subs = (m.subscriptions || []).filter(s => s.activity === sport && (coachId == null || s.coachId === coachId));
    let att = 0, tot = 0;
    subs.forEach(s => { att += s.attendedClasses || 0; tot += s.totalClasses || 0; });
    return tot ? `${att}/${tot} classes${att < tot ? ' · not finished' : ' · finished'}` : '';
  }

  const multiSport = enrolledUnique.length > 1;
  const quickPicks = enrolledUnique.map((e, i) => {
    const prog = progressFor(e.sport, e.coachId);
    return `
      <label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer" data-renew-pick="${i}">
        <input type="radio" name="renew-sport" value="${i}" ${i===0?'checked':''} />
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px">${escapeHtml(e.sport)} <span class="text-mute" style="font-weight:400">· ${escapeHtml(coachName(e.coachId))}</span></div>
          ${prog ? `<div class="text-dim" style="font-size:11px">${prog}</div>` : ''}
        </div>
        <div class="text-dim" style="font-size:11px">${e.classes ? e.classes + ' cls' : ''}${e.price ? ' · ' + fmt(e.price) + ' QAR' : ''}</div>
      </label>`;
  }).join('');

  showModal({
    title: `Renew Subscription — ${escapeHtml(m.name)}`,
    body: `
      ${multiSport ? `
      <div style="margin-bottom:12px">
        <div style="font-size:11px;color:var(--blue);text-transform:uppercase;letter-spacing:.6px;font-weight:600;margin-bottom:8px">Which sport to renew?</div>
        ${quickPicks}
        <div class="text-mute" style="font-size:10px">This member is enrolled in ${enrolledUnique.length} sports. Pick one to renew — you can renew it even if the classes aren't finished yet.</div>
      </div>` : ''}
      <div class="form-row">
        <div class="field"><label>Activity</label><select id="rn-act">${sports.map(s => `<option ${s===(enrolledUnique[0]?.sport||m.sport)?'selected':''}>${s}</option>`).join('')}</select></div>
        <div class="field"><label>Coach</label><select id="rn-coach">${coachOpts(enrolledUnique[0]?.coachId || m.coachId)}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Classes</label><input id="rn-classes" type="number" min="0" step="1" value="${enrolledUnique[0]?.classes || ''}" /></div>
        <div class="field"><label>Validity</label><select id="rn-validity">${VALIDITY_OPTIONS.map(v => `<option value="${v}" ${v===DEFAULT_VALIDITY?'selected':''}>${v} days</option>`).join('')}</select></div>
        <div class="field"><label>Amount paid (QAR)</label><input id="rn-amount" type="number" step="0.01" min="0" value="${enrolledUnique[0]?.price || ''}" /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Start / renewal date</label><input id="rn-start" type="date" value="${TODAY}" /></div>
        <div class="field"><label>Expiry date <span class="text-mute" style="font-size:10px;font-weight:400">(auto · override allowed)</span></label><input id="rn-end" type="date" /><div id="rn-end-hint" class="text-mute" style="font-size:10px;margin-top:3px"></div></div>
      </div>
      <div id="rn-deduct-banner" style="display:none"></div>
      <div class="field"><label>Status</label><select id="rn-status"><option value="active">Active</option><option value="expired">Expired</option></select></div>
    `,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: 'Save Renewal', class: 'btn primary', onclick: () => {
        const start = $('#rn-start').value;
        const end = $('#rn-end').value;
        const amount = parseFloat($('#rn-amount').value) || 0;
        const classesRaw = parseInt($('#rn-classes').value) || 0;
        const validity = parseInt($('#rn-validity').value) || DEFAULT_VALIDITY;
        const coachId = parseInt($('#rn-coach').value);
        if (!start) { toast('Start date required', 'error'); return; }
        if (!m.renewals) m.renewals = [];
        const _rid = 'r' + Date.now();
        const renewedSport = $('#rn-act').value;

        // ── Post-expiry attendance deduction ──
        // If admin confirmed the deduction (checkbox), reduce totalClasses by
        // the count of Y marks attended after the previous expiry.
        let classes = classesRaw;
        let deductedCount = 0;
        const applyDeduction = document.getElementById('rn-apply-deduction')?.checked;
        const pending = window._rnPendingDeduction || 0;
        if (applyDeduction && pending > 0 && classesRaw > 0) {
          deductedCount = Math.min(pending, classesRaw);
          classes = classesRaw - deductedCount;
        }

        // 1) Record in renewals[] (audit trail of manual entries)
        m.renewals.push({
          _rid,
          activity: renewedSport,
          coach: coachName(coachId),
          coachId,
          start, end: end || null,
          validity,
          totalClasses: classes || null,
          amountPaid: amount,
          status: $('#rn-status').value,
          manual: true,
          createdAt: new Date().toISOString(),
        });

        // 2) Also push to subscriptions[] so it shows up in Subscription History,
        //    counts toward classes, and links to the invoice.
        const ref = nextInvoiceRef();
        if (!m.subscriptions) m.subscriptions = [];
        m.subscriptions.push({
          _sid: 's' + Date.now(),
          _rid,                                    // back-ref to the renewal entry
          month: ymToShort(start.slice(0,7)) || start.slice(0,7),
          activity: renewedSport,
          coach: coachName(coachId),
          coachId,
          firstRegistration: m.firstRegistration || null,
          start, end: end || null,
          validity,
          status: $('#rn-status').value,
          totalClasses: classes || null,
          attendedClasses: 0,
          priceCompleted: null,
          amountPaid: amount,
          invoiceNumber: ref,
          manual: true,                            // distinguishes from initial registration
        });

        // 3) Create the corresponding invoice so it appears in revenue
        if (amount > 0) {
          state.invoices.push({
            id: nextId(state.invoices),
            date: start,
            description: `${renewedSport} renewal — ${m.name}${classes ? ` · ${classes} classes` : ''}`,
            amount,
            method: 'cash',
            month: start.slice(0, 7),
            ref,
            sport: renewedSport,
            coach: coachName(coachId),
            coachId,
            customerId: m.id,
            customerName: m.name,
            category: 'Membership',
            activityType: 'subscription',
            lineItems: [{
              sport: renewedSport,
              coach: coachName(coachId),
              coachId,
              classes,
              price: amount,
            }],
          });
        }

        // 4) Bump counters + member-level state
        m.renewalCount = (m.renewalCount || 0) + 1;
        if (!m.renewalsBySport) m.renewalsBySport = {};
        m.renewalsBySport[renewedSport] = (m.renewalsBySport[renewedSport] || 0) + 1;
        m.startDate = start;
        if (end && (!m.expiryDate || end > m.expiryDate)) m.expiryDate = end;
        if ($('#rn-status').value === 'active') m.status = 'Active';
        // Renewing re-activates a withdrawn member (Withdrawn is terminal otherwise).
        if (m.status === 'Withdrawn') m.status = ($('#rn-status').value === 'active' ? 'Active' : 'Expired');

        audit('subscription.renew', `member:${m.id}`,
          `Renewed ${renewedSport} for ${m.name || m.nameArabic}`,
          { memberId: m.id, name: m.name, sport: renewedSport, amount, start, end, invoiceRef: ref });

        save();
        closeModal();
        // Clear modal-scoped state so a later renewal doesn't carry over
        window._rnPendingDeduction = 0;
        render();
        toast(`Renewal recorded — ${renewedSport} (#${m.renewalsBySport[renewedSport]} for this sport) · invoice ${ref}${amount > 0 ? ' · ' + fmt(amount) + ' QAR' : ''}${deductedCount > 0 ? ' · −' + deductedCount + ' post-expiry class' + (deductedCount === 1 ? '' : 'es') : ''}`);
      }},
    ],
  });

  // Wire quick-pick radios to fill the form fields
  if (multiSport) {
    document.querySelectorAll('[name="renew-sport"]').forEach(radio => {
      radio.addEventListener('change', e => {
        const e2 = enrolledUnique[parseInt(e.target.value)];
        if (!e2) return;
        const actSel = document.getElementById('rn-act');
        const coachSel = document.getElementById('rn-coach');
        if (actSel) actSel.value = e2.sport;
        if (coachSel) coachSel.value = e2.coachId;
        const cl = document.getElementById('rn-classes'); if (cl) cl.value = e2.classes || '';
        const am = document.getElementById('rn-amount'); if (am) am.value = e2.price || '';
        if (e2.validity) {
          const vSel = document.getElementById('rn-validity');
          if (vSel) vSel.value = e2.validity;
        }
        recalcRnExpiry();
      });
    });
  }

  // Auto-calc renewal expiry: start + validity. User may override.
  let _rnAutoSet = true;
  function recalcRnExpiry() {
    const startEl = document.getElementById('rn-start');
    const vEl = document.getElementById('rn-validity');
    const endEl = document.getElementById('rn-end');
    const hintEl = document.getElementById('rn-end-hint');
    if (!startEl || !vEl || !endEl) return;
    const v = parseInt(vEl.value) || DEFAULT_VALIDITY;
    const auto = addDays(startEl.value, v);
    if (!endEl.value || _rnAutoSet) {
      endEl.value = auto;
      _rnAutoSet = true;
    }
    if (hintEl) {
      const same = endEl.value === auto;
      hintEl.textContent = same
        ? `Auto: ${fmtDate(startEl.value)} + ${v} days`
        : `Manual override · auto would be ${fmtDate(auto)}`;
    }
  }
  document.getElementById('rn-start')?.addEventListener('change', recalcRnExpiry);
  document.getElementById('rn-validity')?.addEventListener('change', recalcRnExpiry);
  document.getElementById('rn-end')?.addEventListener('input', () => { _rnAutoSet = false; recalcRnExpiry(); });
  recalcRnExpiry();

  // Post-expiry attendance deduction:
  // If the member is expired (or this sport's previous subscription ended in
  // the past) AND has Y attendance marks AFTER that expiry, the new package's
  // Classes should be reduced by that count. The banner shows the count and
  // a checkbox to confirm the deduction.
  function getLastSportExpiry(sport) {
    // Find the most recent end-date among this member's subscriptions for this sport
    const subs = (m.subscriptions || []).filter(s => s.activity === sport && s.end);
    if (!subs.length) return null;
    return subs.map(s => s.end).sort().pop();
  }
  function countAttendedAfter(sport, afterDateStr) {
    // Count Y marks for this sport that are dated strictly AFTER afterDateStr.
    if (!m.dailyAttendance || !afterDateStr) return 0;
    let total = 0;
    for (const monthKey of Object.keys(m.dailyAttendance)) {
      const mo = m.dailyAttendance[monthKey];
      const sportMap = mo && typeof mo === 'object' ? mo[sport] : null;
      if (!sportMap) continue;
      for (const day of Object.keys(sportMap)) {
        if (sportMap[day] !== 'Y') continue;
        const dateStr = `${monthKey}-${String(day).padStart(2, '0')}`;
        if (dateStr > afterDateStr) total++;
      }
    }
    return total;
  }
  function recalcRnDeduction() {
    // Reset stale state first — runs every time on every modal open.
    // Avoids cross-modal leakage if the DOM lookup below fails.
    window._rnPendingDeduction = 0;
    const actEl = document.getElementById('rn-act');
    const banner = document.getElementById('rn-deduct-banner');
    if (!actEl || !banner) return;
    const sport = actEl.value;
    const lastEnd = getLastSportExpiry(sport);
    const count = lastEnd ? countAttendedAfter(sport, lastEnd) : 0;
    if (!lastEnd || count === 0) {
      banner.style.display = 'none';
      banner.innerHTML = '';
      return;
    }
    window._rnPendingDeduction = count;
    banner.style.display = 'block';
    banner.innerHTML = `
      <div style="margin:4px 0 10px;padding:10px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);border-radius:8px">
        <div style="display:flex;align-items:flex-start;gap:8px">
          <div style="font-size:18px">⚠️</div>
          <div style="flex:1;font-size:12px;line-height:1.5">
            <b>Post-expiry attendance detected.</b><br>
            Member attended <b style="color:var(--accent-2)">${count} class${count===1?'':'es'}</b> of ${escapeHtml(sport)} after the last expiry (${fmtDate(lastEnd)}).
            <label style="display:flex;align-items:center;gap:6px;margin-top:6px;cursor:pointer">
              <input type="checkbox" id="rn-apply-deduction" checked />
              <span>Deduct ${count} class${count===1?'':'es'} from the new package</span>
            </label>
          </div>
        </div>
      </div>
    `;
  }
  document.getElementById('rn-act')?.addEventListener('change', recalcRnDeduction);
  recalcRnDeduction();
};

window.deleteRenewal = function(memberId, rid) {
  const m = state.members.find(x => x.id === memberId);
  if (!m || !m.renewals) return;
  if (!confirm('Delete this renewal record?')) return;
  m.renewals = m.renewals.filter(r => r._rid !== rid);
  save();
  render();
  toast('Renewal deleted');
};

window.openMemberHistory = function(memberId) {
  window._historyLastSelected = memberId;
  navigate('history');
};

// ─── Export this member's history as CSV ──────────────────────────
window.exportMemberHistoryCSV = function(memberId) {
  const m = state.members.find(x => x.id === memberId);
  if (!m) return;
  const rows = [['Activity','Coach','Start Date','End Date','Amount Paid','Status','Source']];
  // Dedupe: skip renewals[] entries that already have a matching subscription
  // (those would otherwise show twice).
  const subRids = new Set((m.subscriptions || []).map(s => s._rid).filter(Boolean));
  const all = [
    ...(m.subscriptions || []).map(s => ({ ...s, _source: s.manual ? 'Renewal' : 'Initial enrollment' })),
    ...(m.renewals || [])
      .filter(r => !r._rid || !subRids.has(r._rid))
      .map(s => ({ ...s, _source: 'Manual entry (legacy)' })),
  ].sort((a, b) => (b.start || '').localeCompare(a.start || ''));
  for (const s of all) {
    rows.push([
      s.activity || '',
      s.coach || (s.coachId ? (state.coaches.find(c => c.id === s.coachId)?.name || '') : ''),
      s.start || '',
      s.end || '',
      s.amountPaid || 0,
      s.status || '',
      s._source,
    ]);
  }
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadFile(`${m.name.replace(/[^a-zA-Z0-9]/g,'_')}_history.csv`, csv, 'text/csv');
  toast('History exported');
};

// ═══════════════════════════════════════════════════════════════════
// EXPIRING SOON — members whose membership ends within N days
// ═══════════════════════════════════════════════════════════════════

PAGES.expiring = (main) => {
  const threshold = state.settings?.expiringSoonDays || 3;
  let filter = { sport: 'all', coach: 'all', search: '', bucket: 'all' };
  // Which sections are collapsed (default: all open)
  const collapsed = { soon: false, expired: false, upcoming: false };
  // Bulk-selected member IDs (across all sections)
  const selectedIds = new Set();

  // Bucket members (compute once — only filter the visible lists)
  const expired = [];
  const expiringSoon = [];
  const upcoming = [];

  for (const m of state.members) {
    if (m.deleted) continue;  // archived members don't appear in expiring
    if (!m.expiryDate) continue;
    // Skip frozen members — their expiry was shifted, they aren't really expiring
    if (memberStatus(m) === 'Frozen') continue;
    if (memberStatus(m) === 'Withdrawn') continue;  // withdrawn members aren't renewing
    const d = daysUntil(m.expiryDate);
    if (d == null) continue;
    if (d < 0) expired.push({ m, days: d });
    else if (d <= threshold) expiringSoon.push({ m, days: d });
    else if (d <= 30) upcoming.push({ m, days: d });
  }

  expired.sort((a, b) => b.days - a.days);
  expiringSoon.sort((a, b) => a.days - b.days);
  upcoming.sort((a, b) => a.days - b.days);

  // "Recently expired" = expired within the last N days (win-back window), N configurable.
  const recentDays = state.settings?.recentlyExpiredDays || 15;
  const recentCount = expired.filter(x => x.days >= -recentDays).length;

  // Sports + coaches present in the expiring lists, for the dropdowns
  const allEntries = [...expired, ...expiringSoon, ...upcoming];
  const sportsInList = [...new Set(allEntries.flatMap(({m}) =>
    [m.sport, ...((m.enrollments||[]).map(e=>e.sport)), ...((m.subscriptions||[]).map(s=>s.activity))].filter(Boolean)
  ))].sort();
  const coachesInList = [...new Set(allEntries.map(({m}) => m.coachId).filter(Boolean))];

  function matchFilter({ m, days }) {
    // "Recently expired" bucket: only expired within the last N days.
    if (filter.bucket === 'recent' && !(days < 0 && days >= -recentDays)) return false;
    if (filter.sport !== 'all') {
      const ms = new Set([m.sport, ...((m.enrollments||[]).map(e=>e.sport)), ...((m.subscriptions||[]).map(s=>s.activity))].filter(Boolean));
      if (!ms.has(filter.sport)) return false;
    }
    if (filter.coach !== 'all' && m.coachId !== parseInt(filter.coach)) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      const hay = [m.name, m.nameArabic, m.phone, m.phone2, m.qid].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function rowHtml({ m, days }, bucket) {
    const color = bucket === 'expired' ? 'var(--red)' : bucket === 'soon' ? 'var(--accent-2)' : 'var(--text-dim)';
    const label = bucket === 'expired' ? `${Math.abs(days)}d ago` : bucket === 'soon' ? `in ${days}d` : `in ${days}d`;
    const phone = m.phone && !m.phone.startsWith('+9747000') ? m.phone : null;
    const lastR = lastRenewalDate(m);
    const isChecked = selectedIds.has(m.id);
    // Pre-build the WhatsApp reminder link (bilingual template, EN + AR)
    let reminderHref = '';
    if (phone) {
      const kind = bucket === 'expired' ? 'expired' : 'expiring';
      const msg = buildReminderMessage(m, kind, days);
      const cleanPhone = String(phone).replace(/[^\d]/g, '');
      reminderHref = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    }
    return `
      <tr style="cursor:pointer" data-id="${m.id}">
        <td style="width:32px;text-align:center" onclick="event.stopPropagation()">
          <input type="checkbox" class="exp-row-cb" data-id="${m.id}" ${isChecked ? 'checked' : ''} ${phone ? '' : 'disabled title="No phone — cannot include in WhatsApp/SMS"'} style="cursor:${phone ? 'pointer' : 'not-allowed'}" />
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="avatar" style="width:32px;height:32px;font-size:11px;background:linear-gradient(135deg,var(--blue),var(--purple))">${initials(m.name)}</div>
            <div>
              <div style="font-weight:600">${escapeHtml(m.name)}${m.nameArabic ? ` · <span class="text-dim" style="font-weight:normal" dir="rtl">${escapeHtml(m.nameArabic)}</span>` : ''}</div>
              <div class="text-mute" style="font-size:11px">${escapeHtml(m.sport)} · ${escapeHtml(coachName(m.coachId))}</div>
            </div>
          </div>
        </td>
        <td>${phoneCell(phone)}</td>
        <td>${lastR ? fmtDate(lastR) : '<span class="text-mute">—</span>'}</td>
        <td><span style="color:${color};font-weight:600">${fmtDate(m.expiryDate)}</span></td>
        <td><span style="color:${color};font-weight:700">${label}</span></td>
        <td class="text-right" style="white-space:nowrap">
          ${phone
            ? `<a class="btn primary sm" href="${reminderHref}" target="_blank" onclick="event.stopPropagation();markReminded(${m.id})" title="Send bilingual reminder via WhatsApp">💬 Remind</a>`
            : `<span class="text-mute" style="font-size:11px">No phone</span>`}
          <button class="btn ghost sm" onclick="event.stopPropagation();addRenewal(${m.id})" title="Record renewal">🔄 Renew</button>
          <div id="rem-label-${m.id}" class="text-mute" style="font-size:10px;margin-top:4px;${m.lastRemindedAt ? '' : 'display:none'}">${m.lastRemindedAt ? '✓ Reminded ' + escapeHtml(fmtDateTime(m.lastRemindedAt)) : ''}</div>
        </td>
      </tr>
    `;
  }

  function section(title, color, icon, list, bucket) {
    const isCollapsed = collapsed[bucket];
    // How many in this section are currently selected?
    const sectionIds = list.map(x => x.m.id);
    const selectedInSection = sectionIds.filter(id => selectedIds.has(id)).length;
    const phoneIds = list.filter(x => x.m.phone && !x.m.phone.startsWith('+9747000')).map(x => x.m.id);
    const allPhonesSelected = phoneIds.length > 0 && phoneIds.every(id => selectedIds.has(id));
    return `
      <div class="card" data-bucket="${bucket}">
        <div class="card-header exp-section-header" data-bucket="${bucket}" style="cursor:pointer;user-select:none">
          <div style="display:flex;align-items:center;gap:10px;flex:1">
            <span class="exp-chevron" style="display:inline-block;transition:transform .15s;transform:rotate(${isCollapsed ? '-90' : '0'}deg);color:${color};font-size:13px">▾</span>
            <div>
              <div class="card-title" style="color:${color}">${icon} ${title}</div>
              <div class="card-subtitle">${list.length} member${list.length === 1 ? '' : 's'}${selectedInSection ? ` · <b style="color:var(--blue)">${selectedInSection} selected</b>` : ''}${isCollapsed ? ' · collapsed (click to expand)' : ''}</div>
            </div>
          </div>
        </div>
        <div class="exp-section-body" style="display:${isCollapsed ? 'none' : 'block'}">
          ${list.length ? `
            <div class="table-wrap">
              <table>
                <thead><tr>
                  <th style="width:32px;text-align:center" onclick="event.stopPropagation()">
                    <input type="checkbox" class="exp-select-all" data-bucket="${bucket}" ${allPhonesSelected ? 'checked' : ''} ${phoneIds.length === 0 ? 'disabled' : ''} title="Select all in this section (with phone)" />
                  </th>
                  <th>Member</th><th>Mobile</th><th>Last Renewal</th><th>Expiry</th><th>When</th><th class="text-right">Actions</th>
                </tr></thead>
                <tbody>${list.map(x => rowHtml(x, bucket)).join('')}</tbody>
              </table>
            </div>
          ` : `<div class="empty" style="padding:24px;font-size:13px">No members in this group 🎉</div>`}
        </div>
      </div>
    `;
  }

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Expiring Soon</h1>
        <div class="subtitle">Members needing renewal · alert window: ${threshold} days <a href="#" onclick="event.preventDefault();navigate('settings')" style="color:var(--blue)">(change)</a></div>
      </div>
      <div class="topbar-actions">
        <button class="btn ghost" title="Show members who expired within the last ${recentDays} days (set in Settings)" onclick="document.getElementById('exp-bucket').value='recent';document.getElementById('exp-bucket').dispatchEvent(new Event('change'))">🔴 Recently expired (≤${recentDays}d) · ${recentCount}</button>
        <button class="btn ghost" id="export-expiring">📥 Export CSV</button>
      </div>
    </div>

    <div class="kpi-grid mb-3">
      <div class="kpi red" style="cursor:pointer" onclick="document.getElementById('exp-bucket').value='expired';document.getElementById('exp-bucket').dispatchEvent(new Event('change'))">
        <div class="kpi-icon">⛔</div>
        <div class="kpi-label">Already Expired</div>
        <div class="kpi-value num">${expired.length}</div>
        <div class="kpi-delta flat">Lost members · click to filter</div>
      </div>
      <div class="kpi orange" style="cursor:pointer" onclick="document.getElementById('exp-bucket').value='soon';document.getElementById('exp-bucket').dispatchEvent(new Event('change'))">
        <div class="kpi-icon">⏰</div>
        <div class="kpi-label">Expiring in ≤ ${threshold} days</div>
        <div class="kpi-value num">${expiringSoon.length}</div>
        <div class="kpi-delta flat">Call them now · click to filter</div>
      </div>
      <div class="kpi blue" style="cursor:pointer" onclick="document.getElementById('exp-bucket').value='upcoming';document.getElementById('exp-bucket').dispatchEvent(new Event('change'))">
        <div class="kpi-icon">📅</div>
        <div class="kpi-label">Expiring in ≤ 30 days</div>
        <div class="kpi-value num">${upcoming.length}</div>
        <div class="kpi-delta flat">On the horizon · click to filter</div>
      </div>
      <div class="kpi green">
        <div class="kpi-icon">💰</div>
        <div class="kpi-label">Potential Revenue</div>
        <div class="kpi-value num">${fmt((expired.length + expiringSoon.length) * 350)} <span style="font-size:12px;color:var(--text-dim)">QAR</span></div>
        <div class="kpi-delta flat">@ 350 QAR avg/renewal</div>
      </div>
    </div>

    <div class="card" style="padding:14px 16px;margin-bottom:14px">
      <div class="filter-bar" style="flex-wrap:wrap">
        <select id="exp-bucket" class="btn ghost">
          <option value="all">All statuses</option>
          <option value="soon">⏰ Expiring in ≤ ${threshold} days</option>
          <option value="recent">🔴 Recently expired (≤ ${recentDays} days)</option>
          <option value="expired">⛔ Already expired</option>
          <option value="upcoming">📅 Expiring in ≤ 30 days</option>
        </select>
        <select id="exp-sport" class="btn ghost">
          <option value="all">All sports</option>
          ${sportsInList.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
        </select>
        <select id="exp-coach" class="btn ghost">
          <option value="all">All coaches</option>
          ${coachesInList.map(cid => `<option value="${cid}">${escapeHtml(coachName(cid))}</option>`).join('')}
        </select>
        <div class="search" style="flex:1;min-width:220px"><input id="exp-search" type="text" placeholder="Search by name, mobile, QID..." /></div>
        <button class="btn ghost sm" id="exp-collapse-all" title="Collapse all sections">⊟ Collapse all</button>
        <button class="btn ghost sm" id="exp-expand-all" title="Expand all sections">⊞ Expand all</button>
      </div>
    </div>

    <div id="exp-sections"></div>

    <!-- Floating bulk action bar (only visible when 1+ members are selected) -->
    <div id="exp-bulk-bar" style="display:none;position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:1000;background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:12px 18px;box-shadow:0 10px 40px rgba(0,0,0,.4);align-items:center;gap:12px;font-size:13px">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="background:var(--blue);color:white;border-radius:999px;padding:2px 10px;font-weight:700;font-size:11px"><span id="exp-bulk-count">0</span> selected</span>
      </div>
      <button class="btn ghost sm" id="exp-bulk-copy" title="Copy phone numbers (comma-separated) to clipboard">📋 Copy phones</button>
      <button class="btn ghost sm" id="exp-bulk-message" title="Copy a renewal reminder message">📝 Copy message</button>
      <button class="btn primary sm" id="exp-bulk-whatsapp" title="Open WhatsApp for each selected member with a bilingual reminder pre-filled">💬 Send Reminders</button>
      <button class="btn ghost sm" id="exp-bulk-clear" style="color:var(--text-mute)" title="Clear selection">✕</button>
    </div>
  `;

  function renderSections() {
    const sFiltered = expiringSoon.filter(matchFilter);
    const eFiltered = expired.filter(matchFilter);
    const uFiltered = upcoming.filter(matchFilter);
    const parts = [];
    if (filter.bucket === 'recent') {
      parts.push(section(`Recently expired — within ${recentDays} days`, 'var(--red)', '🔴', eFiltered, 'expired'));
    }
    if (filter.bucket === 'all' || filter.bucket === 'soon')
      parts.push(section('Expiring within ' + threshold + ' days — call ASAP', 'var(--accent-2)', '⏰', sFiltered, 'soon'));
    if (filter.bucket === 'all' || filter.bucket === 'expired')
      parts.push(section('Already expired', 'var(--red)', '⛔', eFiltered, 'expired'));
    if (filter.bucket === 'all' || filter.bucket === 'upcoming')
      parts.push(section('Expiring within 30 days', 'var(--blue)', '📅', uFiltered, 'upcoming'));
    $('#exp-sections').innerHTML = parts.join('');
    // Wire row clicks (open member detail)
    $$('tbody tr[data-id]').forEach(tr => {
      tr.addEventListener('click', () => viewMember(parseInt(tr.dataset.id)));
    });
    // Wire collapse/expand on each section header
    $$('.exp-section-header').forEach(h => {
      h.addEventListener('click', () => {
        const b = h.dataset.bucket;
        collapsed[b] = !collapsed[b];
        renderSections();
      });
    });
    // Wire per-row checkbox toggles
    $$('.exp-row-cb').forEach(cb => {
      cb.addEventListener('click', e => e.stopPropagation());
      cb.addEventListener('change', e => {
        const id = parseInt(e.target.dataset.id);
        if (e.target.checked) selectedIds.add(id);
        else selectedIds.delete(id);
        updateBulkBar();
        // Update section subtitle counts
        renderSectionHeadersOnly();
      });
    });
    // Wire select-all-in-section checkbox
    $$('.exp-select-all').forEach(cb => {
      cb.addEventListener('click', e => e.stopPropagation());
      cb.addEventListener('change', e => {
        const bucket = e.target.dataset.bucket;
        const list = bucket === 'soon' ? expiringSoon.filter(matchFilter)
                   : bucket === 'expired' ? expired.filter(matchFilter)
                   : upcoming.filter(matchFilter);
        const phoneIds = list.filter(x => x.m.phone && !x.m.phone.startsWith('+9747000')).map(x => x.m.id);
        if (e.target.checked) phoneIds.forEach(id => selectedIds.add(id));
        else phoneIds.forEach(id => selectedIds.delete(id));
        renderSections();  // re-render to update all row checkboxes
        updateBulkBar();
      });
    });
    updateBulkBar();
  }

  // Lightweight update for section subtitles only — avoids full re-render
  // when toggling a single row (so DOM focus / scroll position isn't lost).
  function renderSectionHeadersOnly() {
    $$('.exp-section-header').forEach(h => {
      const b = h.dataset.bucket;
      const list = b === 'soon' ? expiringSoon.filter(matchFilter)
                  : b === 'expired' ? expired.filter(matchFilter)
                  : upcoming.filter(matchFilter);
      const sel = list.filter(x => selectedIds.has(x.m.id)).length;
      const sub = h.querySelector('.card-subtitle');
      if (sub) {
        sub.innerHTML = `${list.length} member${list.length === 1 ? '' : 's'}${sel ? ` · <b style="color:var(--blue)">${sel} selected</b>` : ''}${collapsed[b] ? ' · collapsed (click to expand)' : ''}`;
      }
    });
  }

  // Show/hide the floating bulk action bar based on selection count
  function updateBulkBar() {
    const bar = $('#exp-bulk-bar');
    const countEl = $('#exp-bulk-count');
    if (!bar || !countEl) return;
    const count = selectedIds.size;
    countEl.textContent = count;
    bar.style.display = count > 0 ? 'flex' : 'none';
  }

  // Pull phone numbers + names for current selection (de-duped)
  function selectedMembersWithPhone() {
    return [...selectedIds]
      .map(id => state.members.find(m => m.id === id))
      .filter(m => m && m.phone && !m.phone.startsWith('+9747000'));
  }

  renderSections();

  $('#exp-bucket').addEventListener('change', e => { filter.bucket = e.target.value; renderSections(); });
  $('#exp-sport').addEventListener('change', e => { filter.sport = e.target.value; renderSections(); });
  $('#exp-coach').addEventListener('change', e => { filter.coach = e.target.value; renderSections(); });
  $('#exp-search').addEventListener('input', e => { filter.search = e.target.value; renderSections(); });
  $('#exp-collapse-all').addEventListener('click', () => {
    collapsed.soon = collapsed.expired = collapsed.upcoming = true;
    renderSections();
  });
  $('#exp-expand-all').addEventListener('click', () => {
    collapsed.soon = collapsed.expired = collapsed.upcoming = false;
    renderSections();
  });

  // ─── Bulk action bar wiring ──────────────────────────────────────
  $('#exp-bulk-clear').addEventListener('click', () => {
    selectedIds.clear();
    renderSections();
  });
  $('#exp-bulk-copy').addEventListener('click', async () => {
    const members = selectedMembersWithPhone();
    if (!members.length) { toast('No selected members have phone numbers', 'error'); return; }
    // Strip non-digits from each phone for cleanest copy. Comma-separated.
    const phones = members.map(m => m.phone.replace(/[^\d+]/g, '')).join(', ');
    try {
      await navigator.clipboard.writeText(phones);
      toast(`📋 Copied ${members.length} phone number${members.length === 1 ? '' : 's'} to clipboard`);
    } catch {
      // Fallback: show in a modal so admin can manually copy
      showModal({
        title: 'Copy phone numbers',
        body: `<p>Clipboard access blocked — copy manually below:</p>
          <textarea readonly style="width:100%;height:120px;padding:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:monospace">${phones}</textarea>`,
        actions: [{ label: 'Close', class: 'btn primary', onclick: closeModal }],
      });
    }
  });
  $('#exp-bulk-message').addEventListener('click', async () => {
    const members = selectedMembersWithPhone();
    if (!members.length) { toast('No selected members have phone numbers', 'error'); return; }
    // Generic reminder template — admin can adjust before sending
    const tpl = `Dear member,

This is a reminder from Black Stars Sports Club: your membership is expiring soon. Please contact us to renew and continue training.

Black Stars Sports Club
Waab, Doha`;
    try {
      await navigator.clipboard.writeText(tpl);
      toast('📝 Reminder template copied · paste into WhatsApp');
    } catch {
      showModal({
        title: 'Reminder message',
        body: `<p>Copy this message and paste into WhatsApp:</p>
          <textarea readonly style="width:100%;height:160px;padding:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:monospace">${tpl}</textarea>`,
        actions: [{ label: 'Close', class: 'btn primary', onclick: closeModal }],
      });
    }
  });
  $('#exp-bulk-whatsapp').addEventListener('click', () => {
    const members = selectedMembersWithPhone();
    if (!members.length) { toast('No selected members have phone numbers', 'error'); return; }
    // Browsers block opening >1 popup without user gesture — warn for 5+ tabs
    if (members.length > 5 && !confirm(`This will open ${members.length} WhatsApp tabs, each with a personalized bilingual reminder.\n\nMany browsers block multiple tabs without explicit permission. Continue?`)) return;
    // Build a lookup of memberId → bucket + days. We already computed these
    // when rendering the page, so reuse them rather than recomputing.
    const bucketOf = new Map();
    expired.forEach(x => bucketOf.set(x.m.id, { kind: 'expired',  days: x.days }));
    expiringSoon.forEach(x => bucketOf.set(x.m.id, { kind: 'expiring', days: x.days }));
    upcoming.forEach(x => bucketOf.set(x.m.id, { kind: 'expiring', days: x.days }));

    let opened = 0, blocked = 0;
    const nowIso = new Date().toISOString();
    for (const m of members) {
      const info = bucketOf.get(m.id) || { kind: 'expiring', days: 0 };
      const msg = buildReminderMessage(m, info.kind, info.days);
      const ph = m.phone.replace(/[^\d]/g, '');
      const url = `https://wa.me/${ph}?text=${encodeURIComponent(msg)}`;
      const w = window.open(url, '_blank');
      if (w) { opened++; m.lastRemindedAt = nowIso; } else blocked++;
    }
    if (opened) save();
    if (blocked) {
      toast(`Opened ${opened} · ${blocked} blocked by browser. Allow popups to open the rest.`, 'error');
    } else {
      toast(`💬 Opened ${opened} reminder${opened === 1 ? '' : 's'} (bilingual)`);
    }
  });

  $('#export-expiring').addEventListener('click', () => {
    const all = [...expiringSoon.filter(matchFilter).map(x => ({ ...x, bucket: 'Expiring soon' })),
                 ...expired.filter(matchFilter).map(x => ({ ...x, bucket: 'Expired' })),
                 ...upcoming.filter(matchFilter).map(x => ({ ...x, bucket: 'Upcoming' }))];
    const rows = [['Name','Name Arabic','Mobile','QID','Sport','Coach','Last Renewal','Expiry','Days','Bucket']];
    for (const { m, days, bucket } of all) {
      rows.push([m.name, m.nameArabic || '', m.phone || '', m.qid || '', m.sport, coachName(m.coachId),
                 lastRenewalDate(m) || '', m.expiryDate || '', days, bucket]);
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    downloadFile('expiring-members.csv', csv, 'text/csv');
    toast(`Exported ${all.length} member${all.length===1?'':'s'}`);
  });
};

// ═══════════════════════════════════════════════════════════════════
// TRIALS — people who came for a free trial, follow-up reminders
// ═══════════════════════════════════════════════════════════════════

PAGES.trials = (main) => {
  let filter = { status: 'all', search: '', sport: 'all' };
  const pg = makePager(10);

  function applyFilter() {
    return (state.trials || []).filter(t => {
      if (filter.status !== 'all' && t.status !== filter.status) return false;
      if (filter.sport !== 'all' && t.sport !== filter.sport) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase();
        const hay = [t.name, t.nameArabic, t.phone, t.email, t.notes].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function refresh() {
    const allTrials = applyFilter().sort((a, b) => (b.trialDate || '').localeCompare(a.trialDate || ''));
    const trials = paginate(allTrials, pg);

    $('#trial-tbody').innerHTML = trials.length ? trials.map(t => {
      const phone = t.phone || '';
      const daysSince = t.trialDate ? Math.abs(daysUntil(t.trialDate) || 0) : null;
      const statusColor = t.status === 'converted' ? 'var(--green)' : t.status === 'declined' ? 'var(--red)' : t.status === 'follow-up' ? 'var(--accent-2)' : 'var(--blue)';
      return `
        <tr data-id="${t.id}">
          <td>
            <div style="display:flex;align-items:center;gap:10px">
              <div class="avatar" style="width:32px;height:32px;font-size:11px;background:linear-gradient(135deg,var(--accent),var(--accent-2))">${initials(t.name)}</div>
              <div>
                <div style="font-weight:600">${escapeHtml(t.name)}${t.nameArabic ? ` · <span class="text-dim" style="font-weight:normal" dir="rtl">${escapeHtml(t.nameArabic)}</span>` : ''}</div>
                <div class="text-mute" style="font-size:11px">${escapeHtml(t.email || phone || '')}</div>
              </div>
            </div>
          </td>
          <td>${phoneCell(phone)}</td>
          <td>${escapeHtml(t.sport || '—')}</td>
          <td>${t.coachId ? escapeHtml(coachName(t.coachId)) : '<span class="text-mute">—</span>'}</td>
          <td>${t.trialDate ? fmtDate(t.trialDate) : '<span class="text-mute">—</span>'}${daysSince != null ? `<div class="text-mute" style="font-size:10px">${daysSince}d ago</div>` : ''}</td>
          <td>${t.followUpDate ? fmtDate(t.followUpDate) : '<span class="text-mute">—</span>'}</td>
          <td><span style="color:${statusColor};font-weight:600;text-transform:capitalize">${t.status || 'new'}</span></td>
          <td class="text-right" style="white-space:nowrap">
            ${phone ? `<a class="btn ghost sm" href="https://wa.me/${phone.replace(/[^\d]/g, '')}" target="_blank" title="WhatsApp">💬</a>` : ''}
            <button class="btn ghost sm" onclick="editTrial(${t.id})" title="Edit">✏️</button>
            <button class="btn primary sm" onclick="convertTrialToMember(${t.id})" title="Convert to member">→ Convert</button>
            <button class="btn ghost sm" onclick="deleteTrial(${t.id})" title="Delete">🗑</button>
          </td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="8" class="empty"><div class="empty-icon">🎁</div>No trial entries yet. Click + Add Trial to record someone.</td></tr>`;

    $('#trial-count').textContent = `${allTrials.length} of ${(state.trials || []).length}`;
    $('#trial-pagination').innerHTML = paginationBar(pg, allTrials.length, 'trial');
    bindPagination('trial', pg, allTrials.length, refresh);
  }

  // Compute KPIs
  const all = state.trials || [];
  const newCount = all.filter(t => !t.status || t.status === 'new').length;
  const followCount = all.filter(t => t.status === 'follow-up').length;
  const convertedCount = all.filter(t => t.status === 'converted').length;
  const conversionRate = all.length ? Math.round(convertedCount / all.length * 100) : 0;

  // Unique sports for filter dropdown
  const uniqSports = [...new Set(all.map(t => t.sport).filter(Boolean))].sort();

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Trials</h1>
        <div class="subtitle">Prospective members who came for a free class — log them and follow up</div>
      </div>
      <div class="topbar-actions">
        <button class="btn ghost" id="export-trials">📥 Export CSV</button>
        <button class="btn primary" id="add-trial">+ Add Trial</button>
      </div>
    </div>

    <div class="kpi-grid mb-3">
      <div class="kpi">
        <div class="kpi-icon">🎁</div>
        <div class="kpi-label">Total Trials</div>
        <div class="kpi-value num">${all.length}</div>
      </div>
      <div class="kpi blue">
        <div class="kpi-icon">🆕</div>
        <div class="kpi-label">New (no follow-up yet)</div>
        <div class="kpi-value num">${newCount}</div>
      </div>
      <div class="kpi orange">
        <div class="kpi-icon">📞</div>
        <div class="kpi-label">In Follow-up</div>
        <div class="kpi-value num">${followCount}</div>
      </div>
      <div class="kpi green">
        <div class="kpi-icon">✓</div>
        <div class="kpi-label">Conversion Rate</div>
        <div class="kpi-value num">${conversionRate}<span style="font-size:14px">%</span></div>
        <div class="kpi-delta flat">${convertedCount} converted</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Trial Log</div>
          <div class="card-subtitle"><span id="trial-count">0 of 0</span></div>
        </div>
      </div>
      <div class="filter-bar">
        <div class="search"><input id="trial-search" type="text" placeholder="Search name, phone, notes..." /></div>
        <select id="trial-status" class="btn ghost">
          <option value="all">All statuses</option>
          <option value="new">New</option>
          <option value="follow-up">In follow-up</option>
          <option value="converted">Converted</option>
          <option value="declined">Declined</option>
        </select>
        <select id="trial-sport" class="btn ghost">
          <option value="all">All sports</option>
          ${SPORTS.map(s => `<option>${s}</option>`).join('')}
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Mobile</th>
              <th>Sport</th>
              <th>Coach</th>
              <th>Trial Date</th>
              <th>Follow-up</th>
              <th>Status</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody id="trial-tbody"></tbody>
        </table>
      </div>
      <div id="trial-pagination"></div>
    </div>
  `;

  $('#trial-search').addEventListener('input', e => { filter.search = e.target.value; pg.page = 1; refresh(); });
  $('#trial-status').addEventListener('change', e => { filter.status = e.target.value; pg.page = 1; refresh(); });
  $('#trial-sport').addEventListener('change', e => { filter.sport = e.target.value; pg.page = 1; refresh(); });
  $('#add-trial').addEventListener('click', () => addTrial());
  $('#export-trials').addEventListener('click', () => {
    const rows = [['Name','Name Arabic','Mobile','Email','Sport','Coach','Trial Date','Follow-up Date','Status','Source','Notes']];
    for (const t of (state.trials || [])) {
      rows.push([t.name, t.nameArabic || '', t.phone || '', t.email || '', t.sport || '',
                 t.coachId ? coachName(t.coachId) : '', t.trialDate || '', t.followUpDate || '',
                 t.status || 'new', t.source || '', t.notes || '']);
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    downloadFile('trials.csv', csv, 'text/csv');
    toast('Trials exported');
  });

  refresh();
};

// ─── Trial CRUD ───────────────────────────────────────────────────
function addTrial() {
  showTrialForm({
    id: nextId(state.trials || []),
    name: '', phone: '', email: '',
    sport: 'MMA', coachId: 1,
    trialDate: TODAY, followUpDate: '',
    status: 'new', source: '', notes: '',
  });
}

window.editTrial = function(id) {
  const t = (state.trials || []).find(x => x.id === id);
  if (!t) return;
  showTrialForm(t);
};

function showTrialForm(t) {
  const isNew = !(state.trials || []).find(x => x.id === t.id);
  showModal({
    title: isNew ? 'Add Trial' : 'Edit Trial',
    body: `
      <div class="form-row">
        <div class="field"><label>Name (English) <span style="color:var(--accent)">*</span></label><input id="t-name" value="${escapeHtml(t.name || '')}" placeholder="First and last name" /></div>
        <div class="field"><label>Name (Arabic)</label><input id="t-name-ar" dir="rtl" value="${escapeHtml(t.nameArabic || '')}" /></div>
      </div>
      <div class="form-row">
        ${phoneInputHtml('t-phone', t.phone, { label: 'Mobile *' })}
        <div class="field"><label>Email (optional)</label><input id="t-email" type="email" value="${escapeHtml(t.email || '')}" /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Sport tried <span style="color:var(--accent)">*</span></label><select id="t-sport"><option value="" ${!t.sport ? 'selected' : ''}>— pick a sport —</option>${SPORTS.map(s => `<option ${s===t.sport?'selected':''}>${s}</option>`).join('')}</select></div>
        <div class="field"><label>With Coach <span style="color:var(--accent)">*</span></label><select id="t-coach"><option value="" ${!t.coachId ? 'selected' : ''}>— pick a coach —</option>${activeCoaches().map(c => `<option value="${c.id}" ${c.id===t.coachId?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Trial date</label><input id="t-date" type="date" value="${t.trialDate || TODAY}" /></div>
        <div class="field"><label>Follow-up date</label><input id="t-fu" type="date" value="${t.followUpDate || ''}" /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Status</label><select id="t-status">
          <option value="new" ${t.status==='new'?'selected':''}>New (no follow-up yet)</option>
          <option value="follow-up" ${t.status==='follow-up'?'selected':''}>In follow-up</option>
          <option value="converted" ${t.status==='converted'?'selected':''}>Converted (became member)</option>
          <option value="declined" ${t.status==='declined'?'selected':''}>Declined</option>
        </select></div>
        <div class="field"><label>Source</label><select id="t-source">
          <option value="" ${!t.source?'selected':''}>— select —</option>
          <option ${t.source==='Walk-in'?'selected':''}>Walk-in</option>
          <option ${t.source==='Instagram'?'selected':''}>Instagram</option>
          <option ${t.source==='Friend referral'?'selected':''}>Friend referral</option>
          <option ${t.source==='Google'?'selected':''}>Google</option>
          <option ${t.source==='Flyer'?'selected':''}>Flyer</option>
          <option ${t.source==='Other'?'selected':''}>Other</option>
        </select></div>
      </div>
      <div class="field"><label>Notes</label><textarea id="t-notes" rows="3" placeholder="What did they say? Any feedback?">${escapeHtml(t.notes || '')}</textarea></div>
    `,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: isNew ? 'Add' : 'Save', class: 'btn primary', onclick: () => {
        // ── Validation: name, mobile (8+ digits), sport, coach ──
        const name = $('#t-name').value.trim();
        const nameAr = $('#t-name-ar').value.trim();
        if (!name && !nameAr) {
          toast('Name required (English or Arabic)', 'error');
          $('#t-name')?.focus();
          return;
        }
        if (!hasFirstAndLast(name) && !hasFirstAndLast(nameAr)) {
          toast('Please enter at least a first and last name', 'error');
          $('#t-name')?.focus();
          return;
        }
        const phoneInput = readPhoneInput('t-phone');
        if (!phoneInput.valid) {
          toast(phoneInput.error || 'Mobile number is invalid', 'error');
          document.getElementById('t-phone-digits')?.focus();
          return;
        }
        const sport = $('#t-sport').value;
        const coachId = parseInt($('#t-coach').value);
        if (!sport) { toast('Sport is required', 'error'); $('#t-sport')?.focus(); return; }
        if (!coachId) { toast('Coach is required (so admin knows who delivered the trial)', 'error'); $('#t-coach')?.focus(); return; }
        const email = $('#t-email').value.trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
          toast('Email format is invalid', 'error');
          $('#t-email')?.focus();
          return;
        }

        const data = {
          id: t.id,
          name: name || nameAr,
          nameArabic: nameAr || null,
          phone: phoneInput.phone,
          email: email || null,
          sport,
          coachId,
          trialDate: $('#t-date').value || TODAY,
          followUpDate: $('#t-fu').value || null,
          status: $('#t-status').value,
          source: $('#t-source').value || null,
          notes: $('#t-notes').value.trim() || null,
          createdAt: t.createdAt || new Date().toISOString(),
        };
        if (!state.trials) state.trials = [];
        if (isNew) state.trials.push(data);
        else {
          const idx = state.trials.findIndex(x => x.id === t.id);
          state.trials[idx] = data;
        }
        save();
        closeModal();
        render();
        toast(isNew ? 'Trial added' : 'Trial updated');
      }},
    ],
  });
}

window.deleteTrial = function(id) {
  if (!confirm('Delete this trial record?')) return;
  state.trials = (state.trials || []).filter(t => t.id !== id);
  save();
  render();
  toast('Trial deleted');
};

// Switch the role-preview. Pure view layer (no security) until online sign-in exists.
// ─── My Membership (member self-service, read-only, own data only) ──
PAGES.mymembership = (main) => {
  const meId = state.user && state.user.memberId;
  const m = (state.members || []).find(x => x.id === meId);
  if (!m) {
    main.innerHTML = `<div class="topbar"><div><h1>My Membership</h1></div></div>
      <div class="card"><p style="font-size:14px">We couldn't find a membership linked to this login. Please contact the club so they can link your account.</p></div>`;
    return;
  }
  const status = memberStatus(m);
  const statusColor = status === 'Active' ? 'var(--green)' : status === 'Frozen' ? 'var(--blue)' : status === 'Withdrawn' ? 'var(--text-mute)' : 'var(--red)';
  const dLeft = m.expiryDate ? daysUntil(m.expiryDate) : null;
  const enrolled = (m.enrollments && m.enrollments.length) ? m.enrollments
    : (m.subscriptions || []).map(s => ({ sport: s.activity, coachId: s.coachId, classes: s.totalClasses || 0, price: s.amountPaid || 0 }));
  const outstanding = (typeof memberOutstanding === 'function') ? memberOutstanding(m.id) : 0;
  const mo = TODAY.slice(0, 7);
  const sportsHtml = enrolled.length ? enrolled.map(e => {
    const dd = m.dailyAttendance?.[mo]?.[e.sport] || {};
    let y = 0; for (const k in dd) if (dd[k] === 'Y') y++;
    return `<tr style="border-top:1px solid var(--border)">
      <td style="padding:8px">${escapeHtml(e.sport)}</td>
      <td style="padding:8px">${e.sport === SUMMER_CAMP ? '—' : escapeHtml(coachName(e.coachId))}</td>
      <td style="padding:8px;text-align:center">${e.classes || 0}</td>
      <td style="padding:8px;text-align:center">${y} this month</td>
    </tr>`;
  }).join('') : `<tr><td colspan="4" style="padding:10px" class="text-mute">No active sports on record.</td></tr>`;

  main.innerHTML = `
    <div class="topbar"><div><h1>My Membership</h1><div class="subtitle">${escapeHtml(m.name)}${isRealPhone && isRealPhone(m.phone) ? ' · ' + escapeHtml(m.phone) : ''}</div></div>
      <div class="topbar-actions"><button class="btn ghost" onclick="promptPasswordChange(false)">🔐 Change password</button></div>
    </div>
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
      <div class="kpi"><div class="kpi-label">Status</div><div class="kpi-value" style="color:${statusColor}">${status}</div><div class="kpi-sub">${m.level || ''}</div></div>
      <div class="kpi"><div class="kpi-label">Membership expiry</div><div class="kpi-value" style="font-size:20px">${m.expiryDate ? fmtDate(m.expiryDate) : '—'}</div><div class="kpi-sub">${dLeft == null ? '' : dLeft < 0 ? `expired ${-dLeft}d ago` : `${dLeft} day${dLeft === 1 ? '' : 's'} left`}</div></div>
      <div class="kpi ${outstanding > 0 ? 'red' : 'green'}"><div class="kpi-label">Balance due</div><div class="kpi-value">${fmt(outstanding)}</div><div class="kpi-sub">${outstanding > 0 ? 'please settle at reception' : 'all paid'}</div></div>
    </div>
    <div class="card">
      <div class="card-header"><div><div class="card-title">My sports</div><div class="card-subtitle">Your enrolled activities and attendance this month</div></div></div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="text-align:left;color:var(--text-mute);font-size:11px"><th style="padding:6px 8px">Sport</th><th style="padding:6px 8px">Coach</th><th style="padding:6px 8px;text-align:center">Planned</th><th style="padding:6px 8px;text-align:center">Attended</th></tr></thead>
        <tbody>${sportsHtml}</tbody>
      </table>
      <div class="text-mute mt-3" style="font-size:11px">See the <b>Schedule</b> tab for class times. For changes to your plan, please contact the club.</div>
    </div>`;
};

// Change the signed-in account's password. Stored by Firebase Auth (never in our
// data). `force` = first-login default-password change (can't be skipped except by signing out).
window.promptPasswordChange = function(force) {
  const myMobile = (() => {
    const id = state.user && state.user.email;
    return isMemberEmail(id) ? id.split('@')[0].replace(/\D/g, '') : '';
  })();
  showModal({
    title: force ? '🔐 Set a new password' : '🔐 Change password',
    body: `<div style="font-size:13px;line-height:1.7">
        ${force ? `<p>For your security, please replace the default password (your mobile number) with one only you know.</p>` : ''}
        <div class="field"><label>New password</label><input id="pw-new" type="password" placeholder="at least 6 characters" /></div>
        <div class="field"><label>Confirm new password</label><input id="pw-confirm" type="password" /></div>
        <div class="text-mute" style="font-size:11px">Your password is stored securely by the sign-in system — not in the club database.</div>
      </div>`,
    actions: [
      { label: force ? 'Sign out instead' : 'Cancel', class: 'btn ghost', onclick: () => { closeModal(); if (force) logout(); } },
      { label: 'Save password', class: 'btn primary', onclick: async () => {
          const np = $('#pw-new').value, cf = $('#pw-confirm').value;
          if (!np || np.length < 6) { toast('Use at least 6 characters', 'error'); return; }
          if (np !== cf) { toast('Passwords don\u2019t match', 'error'); return; }
          if (myMobile && np.replace(/\D/g, '') === myMobile) { toast('Pick something other than your mobile number', 'error'); return; }
          try {
            await window.Storage.updatePassword(np);
            closeModal();
            toast('✓ Password updated');
          } catch (e) { toast(e.message || 'Could not update password', 'error'); }
        } },
    ],
  });
};

// ─── Users & Roles (admin) ─────────────────────────────────────────
function userRolesListHtml() {
  const map = (state.settings && state.settings.userRoles) || {};
  const emails = Object.keys(map);
  if (!emails.length) return `<div class="text-mute" style="font-size:12px;padding:8px 0">No mappings yet — every signed-in account is currently <b>Admin</b>. Add your admin email plus your coach/member logins below.</div>`;
  const rows = emails.sort().map(e => {
    const r = map[e] || {};
    let linked;
    if (r.role === 'coach') linked = escapeHtml(coachName(r.coachId) || '— pick a coach —');
    else if (r.role === 'student') { const m = state.members.find(x => x.id === r.memberId); linked = m ? escapeHtml(m.name) : '<span class="text-mute">— pick a member —</span>'; }
    else linked = '<span class="text-mute">full access</span>';
    return `<tr style="border-top:1px solid var(--border)">
      <td style="padding:6px 8px;font-family:monospace;font-size:12px">${escapeHtml(e)}</td>
      <td style="padding:6px 8px"><span class="badge">${ROLE_LABELS[r.role] || r.role}</span></td>
      <td style="padding:6px 8px;font-size:12px">${linked}</td>
      <td style="padding:6px 8px;text-align:right;white-space:nowrap">
        <button class="btn ghost sm" onclick="editUserRole('${escapeHtml(e)}')" title="Edit">✏️</button>
        <button class="btn ghost sm" onclick="removeUserRole('${escapeHtml(e)}')" title="Remove">🗑</button>
      </td></tr>`;
  }).join('');
  return `<table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;font-size:11px;color:var(--text-mute)"><th style="padding:4px 8px">Email</th><th style="padding:4px 8px">Role</th><th style="padding:4px 8px">Linked to</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}
window.renderUserRolesList = function() { const elx = document.getElementById('user-roles-list'); if (elx) elx.innerHTML = userRolesListHtml(); };
window.editUserRole = function(email) {
  const map = (state.settings && state.settings.userRoles) || {};
  const existing = email ? map[email] : null;
  const role0 = (existing && existing.role) || 'coach';
  const coachSel = id => (state.coaches || []).map(c => `<option value="${c.id}" ${id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}${isCoachActive(c) ? '' : ' (inactive)'}</option>`).join('');
  const memberSel = id => (state.members || []).filter(m => !m.deleted).slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(m => `<option value="${m.id}" ${id === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('');
  showModal({
    title: email ? 'Edit user mapping' : 'Add user mapping',
    body: `<div style="font-size:13px;line-height:1.6">
        <div class="field"><label>Login email (the one created in Firebase Authentication)</label>
          <input id="ur-email" type="email" value="${escapeHtml(email || '')}" ${email ? 'readonly' : ''} placeholder="coach@blackstars.qa" /></div>
        <div class="field"><label>Role</label>
          <select id="ur-role">
            <option value="admin" ${role0 === 'admin' ? 'selected' : ''}>Admin — full access</option>
            <option value="coach" ${role0 === 'coach' ? 'selected' : ''}>Coach</option>
            <option value="student" ${role0 === 'student' ? 'selected' : ''}>Student / member</option>
          </select></div>
        <div class="field" id="ur-coach-wrap" style="display:${role0 === 'coach' ? 'block' : 'none'}"><label>Which coach</label><select id="ur-coach">${coachSel(existing && existing.coachId)}</select></div>
        <div class="field" id="ur-member-wrap" style="display:${role0 === 'student' ? 'block' : 'none'}"><label>Which member</label><select id="ur-member">${memberSel(existing && existing.memberId)}</select></div>
      </div>`,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: 'Save', class: 'btn primary', onclick: () => {
          const e = ($('#ur-email').value || '').trim().toLowerCase();
          if (!/.+@.+\..+/.test(e)) { toast('Enter a valid email', 'error'); return; }
          const role = $('#ur-role').value;
          const entry = { role };
          if (role === 'coach') { entry.coachId = parseInt($('#ur-coach').value) || null; if (!entry.coachId) { toast('Pick which coach', 'error'); return; } }
          if (role === 'student') { entry.memberId = parseInt($('#ur-member').value) || null; if (!entry.memberId) { toast('Pick which member', 'error'); return; } }
          if (!state.settings) state.settings = {};
          if (!state.settings.userRoles) state.settings.userRoles = {};
          state.settings.userRoles[e] = entry;
          audit('user.role_map', e, `Mapped ${e} → ${role}`, entry);
          save(); closeModal(); renderUserRolesList(); toast(`${e} → ${ROLE_LABELS[role] || role}`);
        } },
    ],
  });
  setTimeout(() => {
    const rs = document.getElementById('ur-role');
    if (rs) rs.onchange = () => {
      document.getElementById('ur-coach-wrap').style.display = rs.value === 'coach' ? 'block' : 'none';
      document.getElementById('ur-member-wrap').style.display = rs.value === 'student' ? 'block' : 'none';
    };
  }, 0);
};
window.removeUserRole = function(email) {
  const map = (state.settings && state.settings.userRoles) || {};
  if (!map[email]) return;
  if (!confirm(`Remove the role mapping for ${email}? They'll fall back to the default for unmapped accounts.`)) return;
  delete state.settings.userRoles[email];
  audit('user.role_unmap', email, `Removed role mapping for ${email}`);
  save(); renderUserRolesList(); toast('Mapping removed');
};
window.setUnmappedRole = function(v) {
  if (!state.settings) state.settings = {};
  state.settings.unmappedRole = (v === 'student') ? 'student' : 'admin';
  save(); toast('Unmapped accounts → ' + (v === 'student' ? 'Student' : 'Admin'));
};

window.setPreviewRole = function(role) {
  if (accountRole() !== 'admin') { toast('Only an admin account can preview roles', 'error'); return; }
  const r = (role === 'coach' || role === 'student') ? role : 'admin';
  state.session = { role: r };
  save();
  navigate(roleHome(r));
  toast(r === 'admin' ? 'Admin — full access' : 'Previewing as ' + (ROLE_LABELS[r] || r));
};

// Stamp when a member was last reminded (on clicking 💬 Remind) and show it inline.
window.markReminded = function(id) {
  const m = state.members.find(x => x.id === id);
  if (!m) return;
  m.lastRemindedAt = new Date().toISOString();
  save();
  const lbl = document.getElementById('rem-label-' + id);
  if (lbl) { lbl.textContent = '✓ Reminded ' + fmtDateTime(m.lastRemindedAt); lbl.style.display = ''; }
};

window.convertTrialToMember = function(id) {
  const t = (state.trials || []).find(x => x.id === id);
  if (!t) return;
  // Open a single-step modal: capture classes + validity + price + payment method.
  // On submit, create the Member, create a subscription, create an invoice — all atomically.
  const coachOpts = activeCoaches().map(c => `<option value="${c.id}" ${c.id === t.coachId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
  const sportOpts = SPORTS.map(s => `<option ${s === t.sport ? 'selected' : ''}>${s}</option>`).join('');
  showModal({
    title: `→ Convert "${t.name}" to Member`,
    body: `
      <div style="background:rgba(91,141,239,.08);border:1px solid rgba(91,141,239,.2);border-radius:8px;padding:10px;margin-bottom:14px;font-size:12px;color:var(--text-dim)">
        💡 Creates a new Member record + their first subscription + an invoice — all in one step. Pre-filled from the trial; adjust as needed.
      </div>
      <div class="form-row">
        <div class="field"><label>Sport <span style="color:var(--accent)">*</span></label><select id="cv-sport">${sportOpts}</select></div>
        <div class="field"><label>Coach <span style="color:var(--accent)">*</span></label><select id="cv-coach">${coachOpts}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Classes <span style="color:var(--accent)">*</span></label><input id="cv-classes" type="number" min="1" step="1" value="8" /></div>
        <div class="field"><label>Validity</label><select id="cv-validity">${VALIDITY_OPTIONS.map(v => `<option value="${v}" ${v===DEFAULT_VALIDITY?'selected':''}>${v} days</option>`).join('')}</select></div>
        <div class="field"><label>Price (QAR) <span style="color:var(--accent)">*</span></label><input id="cv-price" type="number" min="0" step="0.01" value="" placeholder="350" /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Start date</label><input id="cv-start" type="date" value="${TODAY}" /></div>
        <div class="field"><label>Payment method</label><select id="cv-method">
          <option value="cash">Cash</option><option value="card">Card</option><option value="transfer">Transfer</option>
        </select></div>
      </div>
    `,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: '→ Create Member + Subscription', class: 'btn primary', onclick: () => {
        // Don't create a duplicate: same mobile + same name = an existing member.
        const existing = findDuplicateMember(t.phone, t.name, t.nameArabic, null);
        if (existing) {
          const note = existing.deleted ? ' (currently archived)' : '';
          if (confirm(`"${existing.name || existing.nameArabic}" already exists with mobile ${existing.phone}${note}.\n\nThis trial looks like the same person — converting again would duplicate them.\n\nOK = open their profile (add the new sport there)\nCancel = go back`)) {
            closeModal();
            if (typeof viewMember === 'function') viewMember(existing.id);
          }
          return;
        }
        const sport = $('#cv-sport').value;
        const coachId = parseInt($('#cv-coach').value);
        const classes = parseInt($('#cv-classes').value) || 0;
        const validity = parseInt($('#cv-validity').value) || DEFAULT_VALIDITY;
        const price = parseFloat($('#cv-price').value) || 0;
        const start = $('#cv-start').value || TODAY;
        const method = $('#cv-method').value || 'cash';

        if (!sport || !coachId) { toast('Sport and coach required', 'error'); return; }
        if (classes <= 0) { toast('Classes must be > 0', 'error'); return; }
        if (price <= 0) { toast('Price must be > 0', 'error'); return; }

        const end = addDays(start, validity);
        const monthKey = start.slice(0, 7);
        const ref = nextInvoiceRef();
        const _sid = 's' + Date.now();

        // 1. Create Member
        const newMember = {
          id: nextId(state.members),
          name: t.name,
          nameArabic: t.nameArabic || null,
          phone: t.phone || '',
          email: t.email || '',
          qid: null,
          birthdate: null,
          level: null,
          sport,
          coachId,
          firstRegistration: start,
          startDate: start,
          joinDate: start,
          expiryDate: end,
          status: 'Active',
          months: [],
          subscriptions: [{
            _sid, _rid: 'r' + Date.now(),
            month: ymToShort(monthKey) || monthKey,
            activity: sport,
            coach: coachName(coachId),
            coachId,
            firstRegistration: start,
            start, validity, end,
            status: 'active',
            totalClasses: classes,
            attendedClasses: 0,
            amountPaid: price,
            invoiceNumber: ref,
          }],
          enrollments: [{ sport, coachId, classes, price }],
          renewals: [],
          renewalsBySport: { [sport]: 1 },
          sportSwitches: [],
          convertedFromTrialId: t.id,
        };
        state.members.push(newMember);

        // 2. Create Invoice
        state.invoices.push({
          id: nextId(state.invoices),
          date: start,
          description: `${t.name} — converted from trial · ${sport}`,
          amount: price,
          method,
          month: monthKey,
          ref,
          sport,
          coach: coachName(coachId),
          coachId,
          customerId: newMember.id,
          customerName: t.name,
          category: 'Membership',
          activityType: 'subscription',
          lineItems: [{ sport, coach: coachName(coachId), coachId, classes, price }],
        });

        // 3. Mark trial converted
        t.status = 'converted';
        t.convertedMemberId = newMember.id;
        t.convertedAt = new Date().toISOString();

        save();
        closeModal();
        render();
        toast(`✓ ${t.name} is now a member · invoice ${ref} · ${fmt(price)} QAR`);
        // Show their profile so admin can verify
        setTimeout(() => viewMember(newMember.id), 200);
      }},
    ],
  });
};

// ═══════════════════════════════════════════════════════════════════
// ATTENDANCE REPORT — per-coach attendance statistics
// ═══════════════════════════════════════════════════════════════════

PAGES.attreport = (main) => {
  let view = { month: 'all', source: 'subscription' }; // source: subscription | daily

  // Compute per-coach attendance stats
  function computeCoachAttendance(monthFilter, source) {
    const stats = {};
    for (const c of state.coaches) {
      stats[c.id] = { coach: c, students: new Set(), attended: 0, total: 0, absent: 0, sessions: 0 };
    }

    for (const m of state.members) {
      if (source === 'subscription') {
        for (const s of (m.subscriptions || [])) {
          const cid = s.coachId;
          if (!cid || !stats[cid]) continue;
          // Compare against YYYY-MM key derived from s.start (more reliable than s.month short)
          const subMonth = (s.start || '').slice(0, 7);
          if (monthFilter !== 'all' && subMonth !== monthFilter) continue;
          if (s.totalClasses) {
            stats[cid].students.add(m.id);
            stats[cid].attended += s.attendedClasses || 0;
            stats[cid].total += s.totalClasses || 0;
            stats[cid].absent += (s.totalClasses || 0) - (s.attendedClasses || 0);
          }
        }
      } else {
        // daily grid
        const cid = m.coachId;
        if (!cid || !stats[cid]) continue;
        const daily = m.dailyAttendance || {};
        for (const [monthKey, perSport] of Object.entries(daily)) {
          if (monthFilter !== 'all' && monthKey !== monthFilter) continue;
          // perSport is either {day: 'Y'} legacy OR {sport: {day: 'Y'}} new shape
          const sample = Object.values(perSport)[0];
          const allMarks = (sample && typeof sample === 'object')
            ? Object.values(perSport).flatMap(byDay => Object.values(byDay || {}))
            : Object.values(perSport || {});
          const y = allMarks.filter(v => v === 'Y').length;
          const n = allMarks.filter(v => v === 'N').length;
          if (y + n > 0) {
            stats[cid].students.add(m.id);
            stats[cid].attended += y;
            stats[cid].absent += n;
            stats[cid].total += y + n;
            stats[cid].sessions += y + n;
          }
        }
      }
    }

    return Object.values(stats)
      .map(s => ({
        ...s,
        studentCount: s.students.size,
        rate: s.total ? (s.attended / s.total * 100) : 0,
      }))
      .filter(s => s.studentCount > 0)
      .sort((a, b) => b.attended - a.attended);
  }

  function refresh() {
    const data = computeCoachAttendance(view.month, view.source);

    // Totals
    const totStudents = new Set();
    let totAttended = 0, totAbsent = 0, totSessions = 0;
    for (const d of data) {
      d.students.forEach(id => totStudents.add(id));
      totAttended += d.attended;
      totAbsent += d.absent;
      totSessions += d.total;
    }
    const overallRate = totSessions ? Math.round(totAttended / totSessions * 100) : 0;

    // KPIs
    $('#ar-kpis').innerHTML = `
      <div class="kpi"><div class="kpi-icon">👥</div><div class="kpi-label">Students Tracked</div><div class="kpi-value num">${totStudents.size}</div></div>
      <div class="kpi green"><div class="kpi-icon">✓</div><div class="kpi-label">Total Present</div><div class="kpi-value num">${totAttended}</div></div>
      <div class="kpi red"><div class="kpi-icon">✗</div><div class="kpi-label">Total Absent</div><div class="kpi-value num">${totAbsent}</div></div>
      <div class="kpi blue"><div class="kpi-icon">📊</div><div class="kpi-label">Overall Attendance Rate</div><div class="kpi-value num">${overallRate}<span style="font-size:14px">%</span></div></div>
    `;

    // Bar chart — attended sessions per coach
    const maxAttended = Math.max(...data.map(d => d.attended), 1);
    $('#ar-chart').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;padding:8px 4px">
        ${data.map(d => `
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:120px;font-size:12px;font-weight:600;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(d.coach.name)}</div>
            <div style="flex:1;background:var(--surface-2);border-radius:6px;height:26px;position:relative;overflow:hidden">
              <div style="height:100%;width:${(d.attended/maxAttended*100).toFixed(1)}%;background:linear-gradient(90deg,var(--green),#0ea874);border-radius:6px;display:flex;align-items:center;justify-content:flex-end;padding-right:8px;min-width:40px">
                <span style="font-size:11px;font-weight:700;color:#fff">${d.attended}</span>
              </div>
            </div>
            <div style="width:90px;font-size:11px;color:var(--text-dim);text-align:right">${d.studentCount} students</div>
            <div style="width:50px;font-size:12px;font-weight:600;text-align:right;color:${d.rate>=50?'var(--green)':d.rate>=30?'var(--accent-2)':'var(--red)'}">${Math.round(d.rate)}%</div>
          </div>
        `).join('')}
      </div>
    `;

    // Detailed table
    $('#ar-tbody').innerHTML = data.map((d, i) => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:22px;height:22px;border-radius:50%;background:${i===0?'var(--accent-2)':'var(--surface-2)'};color:${i===0?'#fff':'var(--text-dim)'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">${i+1}</div>
            <div class="avatar" style="width:30px;height:30px;font-size:10px;background:linear-gradient(135deg,var(--blue),var(--purple))">${initials(d.coach.name)}</div>
            <div>
              <div class="font-bold">${escapeHtml(d.coach.name)}</div>
              <div class="text-mute" style="font-size:10px">${(d.coach.sports || []).slice(0,2).join(' · ')}</div>
            </div>
          </div>
        </td>
        <td class="text-right num font-bold">${d.studentCount}</td>
        <td class="text-right num">${d.total}</td>
        <td class="text-right num" style="color:var(--green)">${d.attended}</td>
        <td class="text-right num" style="color:var(--red)">${d.absent}</td>
        <td class="text-right">
          <div style="display:flex;align-items:center;gap:8px;justify-content:flex-end">
            <div style="width:60px;height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${d.rate}%;background:${d.rate>=50?'var(--green)':d.rate>=30?'var(--accent-2)':'var(--red)'};border-radius:3px"></div>
            </div>
            <span class="num font-bold" style="width:40px;color:${d.rate>=50?'var(--green)':d.rate>=30?'var(--accent-2)':'var(--red)'}">${Math.round(d.rate)}%</span>
          </div>
        </td>
        <td class="text-right num text-dim">${d.studentCount ? (d.attended / d.studentCount).toFixed(1) : 0}</td>
      </tr>
    `).join('') + `
      <tr style="font-weight:700;background:var(--surface-2)">
        <td>Total (${data.length} coaches)</td>
        <td class="text-right num">${totStudents.size}</td>
        <td class="text-right num">${totSessions}</td>
        <td class="text-right num" style="color:var(--green)">${totAttended}</td>
        <td class="text-right num" style="color:var(--red)">${totAbsent}</td>
        <td class="text-right num">${overallRate}%</td>
        <td class="text-right num">${totStudents.size ? (totAttended/totStudents.size).toFixed(1) : 0}</td>
      </tr>
    `;

    // Source note
    $('#ar-source-note').textContent = view.source === 'daily'
      ? 'Source: daily attendance grid (where filled in)'
      : 'Source: subscription records (classes attended / total)';
  }

  // Build a sorted, unique list of months actually present in the data
  const subMonths = new Set();
  for (const m of state.members) {
    for (const s of (m.subscriptions || [])) {
      const k = (s.start || '').slice(0, 7);
      if (k) subMonths.add(k);
    }
    for (const k of Object.keys(m.dailyAttendance || {})) subMonths.add(k);
  }
  const monthsAvail = [...subMonths].sort().reverse();

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Attendance Report</h1>
        <div class="subtitle">Per-coach attendance statistics · <span id="ar-source-note"></span></div>
      </div>
      <div class="topbar-actions">
        <button class="btn ghost" id="ar-export">📥 Export CSV</button>
      </div>
    </div>

    <div class="kpi-grid mb-3" id="ar-kpis"></div>

    <div class="card">
      <div class="card-header">
        <div><div class="card-title">Attendance by Coach</div><div class="card-subtitle">Sessions attended, ranked</div></div>
      </div>
      <div class="filter-bar">
        <select id="ar-month" class="btn ghost">
          <option value="all">All months</option>
          ${monthsAvail.map(m => `<option value="${m}">${fmtMonth(m)}</option>`).join('')}
        </select>
        <select id="ar-source" class="btn ghost">
          <option value="subscription">From subscriptions</option>
          <option value="daily">From daily grid</option>
        </select>
      </div>
      <div id="ar-chart"></div>
    </div>

    <div class="card">
      <div class="card-header">
        <div><div class="card-title">Detailed Statistics</div></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Coach</th>
              <th class="text-right">Students</th>
              <th class="text-right">Total Sessions</th>
              <th class="text-right">Present</th>
              <th class="text-right">Absent</th>
              <th class="text-right">Attendance Rate</th>
              <th class="text-right">Avg / Student</th>
            </tr>
          </thead>
          <tbody id="ar-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  $('#ar-month').addEventListener('change', e => { view.month = e.target.value; refresh(); });
  $('#ar-source').addEventListener('change', e => { view.source = e.target.value; refresh(); });
  $('#ar-export').addEventListener('click', () => {
    const data = computeCoachAttendance(view.month, view.source);
    const rows = [['Rank','Coach','Students','Total Sessions','Present','Absent','Attendance Rate','Avg per Student']];
    data.forEach((d, i) => rows.push([
      i+1, d.coach.name, d.studentCount, d.total, d.attended, d.absent,
      Math.round(d.rate) + '%', d.studentCount ? (d.attended/d.studentCount).toFixed(1) : 0,
    ]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    downloadFile(`attendance-report-${view.month}-${view.source}.csv`, csv, 'text/csv');
    toast('Attendance report exported');
  });

  refresh();
};

// ═══════════════════════════════════════════════════════════════════
// RENEWALS REPORT — global view of renewals by sport + per-member
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// ENROLLED MEMBERS REPORT — one row per (member, sport) showing what
// they paid, attended, and the period covered.
// ═══════════════════════════════════════════════════════════════════
PAGES.enrolled = (main) => {
  // Default to ALL members (not just active) so newly added ones show up
  // immediately. The status filter is opt-in for narrowing.
  let filter = loadFilter('enrolled', {
    search: '', sport: 'all', coach: 'all', status: 'all', month: 'all',
  });
  const pg = makePager(20);

  // Build one row per (member, sport). The data is assembled from each
  // member's enrollments[] (current state) PLUS subscriptions (history).
  // For "current" view, we take the LATEST subscription per (member, sport).
  function buildRows() {
    const rows = [];
    // When a specific month is selected, the report becomes a per-month view:
    // Paid/Attended are scoped to that month and only rows with activity show.
    const monthSel = (filter.month && filter.month !== 'all') ? filter.month : null;
    for (const m of state.members) {
      if (m.deleted) continue;
      // Group subscriptions by sport, keep most recent
      const subsBySport = new Map();
      for (const s of (m.subscriptions || [])) {
        if (!s.activity) continue;
        const prev = subsBySport.get(s.activity);
        // Prefer the one with the latest end-date; fall back to start
        if (!prev || (s.end || s.start || '') > (prev.end || prev.start || '')) {
          subsBySport.set(s.activity, s);
        }
      }
      // Use enrollments[] as the source of truth for active sports.
      // For each enrolled sport, find the matching latest subscription.
      const enrolledSports = new Set();
      (m.enrollments || []).forEach(e => { if (e.sport) enrolledSports.add(e.sport); });
      // Fall back to legacy m.sport if no enrollments[] yet — but NOT if that
      // sport was withdrawn (guards ghost rows from older data where m.sport
      // wasn't cleared on the last withdrawal).
      if (!enrolledSports.size && m.sport) {
        const wasWithdrawn = (m.withdrawals || []).some(w => w.sport === m.sport);
        if (!wasWithdrawn) enrolledSports.add(m.sport);
      }

      for (const sport of enrolledSports) {
        const enr = (m.enrollments || []).find(e => e.sport === sport);
        const sub = subsBySport.get(sport);
        const coachId = enr?.coachId ?? (sport === SUMMER_CAMP ? null : (sub?.coachId ?? m.coachId));

        // Total paid for this (member, sport): sum positive line items
        // across invoices (scoped to the selected month if one is chosen).
        // Withdrawals/refunds are negative line items so they net correctly.
        let paid = 0;
        for (const inv of (state.invoices || [])) {
          if (inv.customerId !== m.id) continue;
          if ((inv.category || 'Membership') !== 'Membership') continue;
          if (monthSel && inv.month !== monthSel) continue;
          for (const li of (inv.lineItems || [])) {
            if (li.sport === sport) paid += parseFloat(li.price) || 0;
          }
        }

        // Attended classes for this sport (scoped to the month if selected).
        let attended = 0;
        const ymKeys = monthSel ? [monthSel] : Object.keys(m.dailyAttendance || {});
        for (const ym of ymKeys) {
          const sportData = m.dailyAttendance?.[ym]?.[sport] || {};
          for (const v of Object.values(sportData)) if (v === 'Y') attended++;
        }

        const totalClasses = parseInt(enr?.classes ?? sub?.totalClasses) || 0;
        const startDate = sub?.start || m.startDate || m.firstRegistration || null;
        const endDate = sub?.end || m.expiryDate || null;

        // In month-scoped mode, only include rows that had activity that month.
        if (monthSel && paid <= 0 && attended <= 0) continue;

        rows.push({
          m, sport, coachId, paid, attended, totalClasses, startDate, endDate,
        });
      }
    }
    return rows;
  }

  function applyFilter(rows) {
    return rows.filter(r => {
      if (filter.search) {
        const q = filter.search.toLowerCase();
        const hay = [r.m.name, r.m.nameArabic, r.m.phone, r.m.phone2, r.m.qid].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter.sport !== 'all' && r.sport !== filter.sport) return false;
      if (filter.coach !== 'all' && String(r.coachId || '') !== filter.coach) return false;
      if (filter.status !== 'all') {
        const st = memberStatus(r.m);
        if (filter.status === 'active' && st !== 'Active') return false;
        if (filter.status === 'expired' && st !== 'Expired') return false;
        if (filter.status === 'frozen' && st !== 'Frozen') return false;
      }
      return true;
    });
  }

  function refresh() {
    const unfilteredRows = buildRows();
    const allRows = applyFilter(unfilteredRows).sort((a, b) => a.m.name.localeCompare(b.m.name));
    const hiddenByFilters = unfilteredRows.length - allRows.length;
    const anyFilterActive = filter.search || filter.sport !== 'all' || filter.coach !== 'all' || filter.status !== 'all' || filter.month !== 'all';

    // Aggregate KPIs
    const totalPaid = allRows.reduce((s, r) => s + r.paid, 0);
    const totalAttended = allRows.reduce((s, r) => s + r.attended, 0);
    const totalClasses = allRows.reduce((s, r) => s + r.totalClasses, 0);
    const uniqueMembers = new Set(allRows.map(r => r.m.id)).size;

    $('#enr-count').innerHTML = `<b>${allRows.length}</b> enrollment row${allRows.length === 1 ? '' : 's'} · <b>${uniqueMembers}</b> member${uniqueMembers === 1 ? '' : 's'} · <b>${fmt(totalPaid)} QAR</b> paid · <b>${totalAttended}</b>/${totalClasses} classes attended`;

    // "Filters hiding rows" banner — shows when filters reduce visible rows.
    // Helps admin spot the case where a new member doesn't appear because of
    // a stale filter from a previous session.
    const banner = $('#enr-filter-banner');
    if (anyFilterActive && hiddenByFilters > 0) {
      banner.style.display = 'flex';
      banner.innerHTML = `
        <span style="font-size:16px">⚠️</span>
        <div style="flex:1;font-size:12px">
          Filters are hiding <b>${hiddenByFilters}</b> row${hiddenByFilters === 1 ? '' : 's'}. If you don't see a recently-added member, clear filters.
        </div>
        <button class="btn ghost sm" id="enr-clear-filters" style="white-space:nowrap">↻ Clear filters</button>
      `;
      $('#enr-clear-filters')?.addEventListener('click', () => {
        filter = { search: '', sport: 'all', coach: 'all', status: 'all', month: 'all' };
        saveFilter('enrolled', filter);
        pg.page = 1;
        // Re-render the controls so dropdowns reset visually
        const searchEl = $('#enr-search'); if (searchEl) searchEl.value = '';
        const sportEl = $('#enr-sport'); if (sportEl) sportEl.value = 'all';
        const coachEl = $('#enr-coach'); if (coachEl) coachEl.value = 'all';
        const statusEl = $('#enr-status'); if (statusEl) statusEl.value = 'all';
        const monthEl = $('#enr-month'); if (monthEl) monthEl.value = 'all';
        refresh();
      });
    } else {
      banner.style.display = 'none';
      banner.innerHTML = '';
    }

    const page = paginate(allRows, pg);

    $('#enr-tbody').innerHTML = page.length ? page.map(r => {
      const st = memberStatus(r.m);
      const stClass = st.toLowerCase();
      const rate = r.totalClasses > 0 ? Math.round(r.attended / r.totalClasses * 100) : 0;
      const rateColor = rate >= 75 ? 'var(--green)' : rate >= 40 ? 'var(--accent-2)' : rate > 0 ? 'var(--red)' : 'var(--text-mute)';
      const period = r.startDate && r.endDate
        ? `${fmtDate(r.startDate)} → ${fmtDate(r.endDate)}`
        : r.startDate ? `from ${fmtDate(r.startDate)}` : '—';
      const isCamp = r.sport === SUMMER_CAMP;
      return `
        <tr style="cursor:pointer" onclick="viewMember(${r.m.id})">
          <td>
            <div style="display:flex;align-items:center;gap:10px">
              <div class="avatar" style="width:30px;height:30px;font-size:10px;background:linear-gradient(135deg,var(--blue),var(--purple))">${initials(r.m.name)}</div>
              <div>
                <div style="font-weight:600">${escapeHtml(r.m.name)}</div>
                <div class="text-mute" style="font-size:11px">${phoneCell(r.m.phone)}</div>
              </div>
            </div>
          </td>
          <td><span class="badge ${isCamp ? 'orange' : ''}">${escapeHtml(r.sport)}</span></td>
          <td class="text-mute" style="font-size:12px">${isCamp ? '<span style="font-style:italic">no coach</span>' : escapeHtml(coachName(r.coachId))}</td>
          <td class="text-right num font-bold">${fmt(r.paid)}</td>
          <td class="text-right num">
            <span style="font-weight:600">${r.attended}</span>
            <span class="text-mute" style="font-size:11px">/ ${r.totalClasses || '—'}</span>
            ${r.totalClasses > 0 ? `<div style="font-size:10px;color:${rateColor};font-weight:600">${rate}%</div>` : ''}
          </td>
          <td class="text-mute" style="font-size:12px">${period}</td>
          <td><span class="badge ${stClass}">${st}</span></td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="7" class="empty"><div class="empty-icon">🎓</div>No enrollments match your filters</td></tr>`;

    $('#enr-pagination').innerHTML = paginationBar(pg, allRows.length, 'enr');
    bindPagination('enr', pg, allRows.length, refresh);
  }

  // List of sports/coaches present in the data for filter dropdowns
  const sportsInData = [...new Set(state.members.flatMap(m => [m.sport, ...(m.enrollments || []).map(e => e.sport)]).filter(Boolean))].sort();
  const coachesInData = state.coaches.filter(c => isCoachActive(c));
  // Months present in the data (from invoices + attendance), newest first.
  const monthsInData = [...new Set([
    ...(state.invoices || []).map(i => i.month),
    ...state.members.flatMap(m => Object.keys(m.dailyAttendance || {})),
  ].filter(Boolean))].sort().reverse();

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Enrolled Members</h1>
        <div class="subtitle"><span id="enr-count">Loading…</span></div>
      </div>
      <div class="topbar-actions">
        <button class="btn ghost" id="enr-export">📥 Export CSV</button>
      </div>
    </div>

    <div class="card">
      <div id="enr-filter-banner" style="display:none;align-items:center;gap:10px;padding:10px 14px;margin-bottom:12px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);border-radius:8px"></div>
      <div class="filter-bar">
        <div class="search"><input id="enr-search" type="text" placeholder="Search name, phone, QID..." value="${escapeHtml(filter.search || '')}" /></div>
        <select id="enr-sport" class="btn ghost">
          <option value="all">All sports</option>
          ${sportsInData.map(s => `<option value="${escapeHtml(s)}" ${filter.sport === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
        </select>
        <select id="enr-coach" class="btn ghost">
          <option value="all">All coaches</option>
          ${coachesInData.map(c => `<option value="${c.id}" ${String(filter.coach) === String(c.id) ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
        <select id="enr-status" class="btn ghost">
          <option value="all"     ${filter.status === 'all' ? 'selected' : ''}>All members</option>
          <option value="active"  ${filter.status === 'active' ? 'selected' : ''}>Active only</option>
          <option value="expired" ${filter.status === 'expired' ? 'selected' : ''}>Expired only</option>
          <option value="frozen"  ${filter.status === 'frozen' ? 'selected' : ''}>❄️ Frozen only</option>
        </select>
        <select id="enr-month" class="btn ghost" title="Scope Paid & Attended to one month">
          <option value="all" ${filter.month === 'all' ? 'selected' : ''}>All months</option>
          ${monthsInData.map(mo => `<option value="${mo}" ${filter.month === mo ? 'selected' : ''}>${fmtMonth ? fmtMonth(mo) : mo}</option>`).join('')}
        </select>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Sport</th>
              <th>Coach</th>
              <th class="text-right">Paid (QAR)</th>
              <th class="text-right">Attended</th>
              <th>Period</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="enr-tbody"></tbody>
        </table>
      </div>
      <div id="enr-pagination"></div>
    </div>
  `;

  const saveAndRefresh = () => { saveFilter('enrolled', filter); pg.page = 1; refresh(); };
  $('#enr-search').addEventListener('input', e => { filter.search = e.target.value; saveAndRefresh(); });
  $('#enr-sport').addEventListener('change', e => { filter.sport = e.target.value; saveAndRefresh(); });
  $('#enr-coach').addEventListener('change', e => { filter.coach = e.target.value; saveAndRefresh(); });
  $('#enr-status').addEventListener('change', e => { filter.status = e.target.value; saveAndRefresh(); });
  $('#enr-month').addEventListener('change', e => { filter.month = e.target.value; saveAndRefresh(); });

  $('#enr-export').addEventListener('click', () => {
    const allRows = applyFilter(buildRows()).sort((a, b) => a.m.name.localeCompare(b.m.name));
    if (!allRows.length) { toast('No rows to export', 'error'); return; }
    const csvRows = [['Member','Mobile','QID','Sport','Coach','Paid (QAR)','Attended','Total Classes','Attendance %','Start','End','Status']];
    for (const r of allRows) {
      const rate = r.totalClasses > 0 ? Math.round(r.attended / r.totalClasses * 100) + '%' : '';
      csvRows.push([
        r.m.name,
        r.m.phone || '',
        r.m.qid || '',
        r.sport,
        r.sport === SUMMER_CAMP ? '' : coachName(r.coachId),
        r.paid,
        r.attended,
        r.totalClasses,
        rate,
        r.startDate || '',
        r.endDate || '',
        memberStatus(r.m),
      ]);
    }
    const csv = csvRows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadFile(`enrolled-members-${TODAY}.csv`, csv, 'text/csv');
    toast(`Exported ${allRows.length} row${allRows.length === 1 ? '' : 's'}`);
  });

  refresh();
};

PAGES.renewals = (main) => {
  // Aggregate renewals: from member.renewalsBySport (per-sport counters) and
  // from manual renewal records (m.renewals[]) as a fallback signal.
  function aggregate() {
    const bySport = {};        // sport -> total renewals
    const byCoach = {};        // coachId -> total renewals
    let totalRenewals = 0;
    const memberRows = [];     // members who renewed at least once

    for (const m of state.members) {
      const sportMap = m.renewalsBySport || {};
      let memberTotal = 0;
      // per-sport counters
      for (const [sport, count] of Object.entries(sportMap)) {
        bySport[sport] = (bySport[sport] || 0) + count;
        memberTotal += count;
      }
      // manual renewal records (count toward coach + total, infer sport if missing)
      for (const r of (m.renewals || [])) {
        if (r.coachId != null) byCoach[r.coachId] = (byCoach[r.coachId] || 0) + 1;
      }
      if (memberTotal > 0 || (m.renewalCount || 0) > 0) {
        const t = memberTotal || m.renewalCount || 0;
        totalRenewals += t;
        memberRows.push({ m, total: t, sports: sportMap });
      }
    }
    memberRows.sort((a, b) => b.total - a.total);
    return { bySport, byCoach, totalRenewals, memberRows };
  }

  const agg = aggregate();
  const sportEntries = Object.entries(agg.bySport).sort((a, b) => b[1] - a[1]);
  const maxSport = sportEntries[0]?.[1] || 1;
  const PALETTE = ['#f26060','#5b8def','#10b981','#f2a33c','#8b5cf6','#06b6d4','#ec4899','#d4af37'];

  const sportBars = sportEntries.length ? sportEntries.map(([sport, count], i) => `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
      <div style="width:110px;font-size:13px;font-weight:500">${escapeHtml(sport)}</div>
      <div style="flex:1;height:22px;background:var(--surface-2);border-radius:5px;overflow:hidden">
        <div style="height:100%;width:${(count/maxSport*100).toFixed(1)}%;background:linear-gradient(90deg,${PALETTE[i%8]},${PALETTE[(i+1)%8]});border-radius:5px;min-width:24px"></div>
      </div>
      <div style="width:40px;text-align:right;font-weight:700;font-size:14px">${count}</div>
    </div>`).join('') : '<div class="text-mute" style="padding:20px">No renewals recorded yet. Record renewals from the Members page (🔄 button).</div>';

  const memberTable = agg.memberRows.length ? agg.memberRows.map(r => `
    <tr style="cursor:pointer" onclick="viewMember(${r.m.id})">
      <td><div class="font-bold">${escapeHtml(r.m.name)}</div><div class="text-mute" style="font-size:10px">${escapeHtml(r.m.sport)} · ${escapeHtml(coachName(r.m.coachId))}</div></td>
      <td>${Object.entries(r.sports).map(([s,c]) => `<span class="badge" style="background:rgba(242,163,60,.15);color:var(--accent-2);margin:1px">${escapeHtml(s)}: ${c}</span>`).join('') || '<span class="text-mute">—</span>'}</td>
      <td class="text-right num font-bold">${r.total}</td>
    </tr>`).join('') : '<tr><td colspan="3" class="empty">No renewals yet</td></tr>';

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Renewals Report</h1>
        <div class="subtitle">${agg.totalRenewals} total renewals · ${agg.memberRows.length} members renewed · ${sportEntries.length} sports</div>
      </div>
      <div class="topbar-actions"><button class="btn ghost" id="ren-export">📥 Export CSV</button></div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi"><div class="kpi-icon">🔄</div><div class="kpi-label">Total renewals</div><div class="kpi-value">${agg.totalRenewals}</div></div>
      <div class="kpi blue"><div class="kpi-icon">👥</div><div class="kpi-label">Members renewed</div><div class="kpi-value">${agg.memberRows.length}</div></div>
      <div class="kpi green"><div class="kpi-icon">🥋</div><div class="kpi-label">Sports with renewals</div><div class="kpi-value">${sportEntries.length}</div></div>
    </div>

    <div class="card">
      <div class="card-header"><div><div class="card-title">Renewals by Sport</div><div class="card-subtitle">Total renewals recorded per activity</div></div></div>
      <div style="padding:8px 4px">${sportBars}</div>
    </div>

    <div class="card">
      <div class="card-header"><div><div class="card-title">Renewals by Member</div><div class="card-subtitle">Who renewed, and which sports</div></div></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Member</th><th>Per sport</th><th class="text-right">Total</th></tr></thead>
          <tbody>${memberTable}</tbody>
        </table>
      </div>
    </div>
  `;

  $('#ren-export').addEventListener('click', () => {
    const rows = [['Member','Coach','Sport','Renewals (this sport)','Member total']];
    for (const r of agg.memberRows) {
      const entries = Object.entries(r.sports);
      if (entries.length) entries.forEach(([s,c]) => rows.push([r.m.name, coachName(r.m.coachId), s, c, r.total]));
      else rows.push([r.m.name, coachName(r.m.coachId), '', '', r.total]);
    }
    downloadFile('renewals-report.csv', rows.map(x => x.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n'), 'text/csv');
    toast('Renewals report exported');
  });
};

// ═══════════════════════════════════════════════════════════════════
// COACH PERFORMANCE — visual dashboard (charts) for all coaches
// ═══════════════════════════════════════════════════════════════════
PAGES.coachperf = (main) => {
  // Months present in invoices (newest first)
  const monthsInData = [...new Set(state.invoices.map(i => i.month).filter(Boolean))].sort().reverse();
  let month = monthsInData[0] || currentMonth();   // default to latest

  function statsFor(coachId, mo) {
    let students = new Set(), attended = 0, total = 0;
    const monthKey = mo ? (mo.length === 7 ? mo : null) : null;
    // Students + attendance from subscriptions
    for (const m of state.members) {
      for (const s of (m.subscriptions || [])) {
        if (s.coachId !== coachId) continue;
        if (mo && (s.start || '').slice(0,7) !== mo) continue;
        students.add(m.id);
        const daily = monthKey ? attendanceFor(m, monthKey, s.activity || m.sport) : null;
        if (daily && Object.keys(daily).length) {
          const y = Object.values(daily).filter(v => v === 'Y').length;
          const n = Object.values(daily).filter(v => v === 'N').length;
          attended += y; total += (y + n) || (s.totalClasses || 0);
        } else { attended += s.attendedClasses || 0; total += s.totalClasses || 0; }
      }
    }
    // REVENUE comes from actual invoices linked to this coach (real cash collected).
    // Only count membership/subscription invoices — rentals and product sales
    // don't generate commission even if a coachId happens to be attached.
    let paid = 0, activeBase = 0;
    for (const inv of state.invoices) {
      if (inv.coachId !== coachId) continue;
      if (monthKey && inv.month !== monthKey) continue;
      // Filter to coaching revenue only
      const isCoaching = !inv.activityType || inv.activityType === 'subscription' || inv.category === 'Membership';
      if (!isCoaching) continue;
      const amt = inv.amount || 0;
      paid += amt;
      if (inv.customerId) {
        const mem = state.members.find(x => x.id === inv.customerId);
        if (mem && isActiveStatus(mem)) activeBase += amt;
      }
    }
    return { students: students.size, paid, commissionBase: activeBase, completed: paid, attended, total, rate: total ? attended/total*100 : 0 };
  }

  const PALETTE = ['#f26060','#5b8def','#10b981','#f2a33c','#8b5cf6','#06b6d4','#ec4899','#d4af37','#22c55e','#eab308','#f97316','#a855f7'];

  function refresh() {
    const data = state.coaches.map((c, i) => {
      const st = statsFor(c.id, month);
      return { ...c, ...st, commission: (st.commissionBase ?? st.paid) * (c.rate || 0) / 100, color: PALETTE[i % PALETTE.length] };
    }).filter(c => c.students > 0 || c.paid > 0);

    const byCommission = [...data].sort((a, b) => b.commission - a.commission);
    const byStudents = [...data].sort((a, b) => b.students - a.students);
    const maxComm = Math.max(1, ...data.map(c => c.commission));
    const maxStud = Math.max(1, ...data.map(c => c.students));
    const maxRev = Math.max(1, ...data.map(c => c.paid));

    // Horizontal bar: commission
    const commBars = byCommission.map(c => `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:9px">
        <div style="width:110px;font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(c.name)} <span class="text-mute" style="font-size:10px">${c.rate||0}%</span></div>
        <div style="flex:1;height:20px;background:var(--surface-2);border-radius:5px;overflow:hidden">
          <div style="height:100%;width:${(c.commission/maxComm*100).toFixed(1)}%;background:linear-gradient(90deg,${c.color},${c.color}aa);border-radius:5px;min-width:2px"></div>
        </div>
        <div style="width:64px;text-align:right;font-weight:700;font-size:13px">${fmt(c.commission)}</div>
      </div>`).join('');

    // Revenue bars (total paid)
    const revBars = byCommission.map(c => `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:9px">
        <div style="width:110px;font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(c.name)}</div>
        <div style="flex:1;height:20px;background:var(--surface-2);border-radius:5px;overflow:hidden">
          <div style="height:100%;width:${(c.paid/maxRev*100).toFixed(1)}%;background:linear-gradient(90deg,var(--green),#0ea874);border-radius:5px;min-width:2px"></div>
        </div>
        <div style="width:64px;text-align:right;font-weight:700;font-size:13px">${fmt(c.paid)}</div>
      </div>`).join('');

    // Students column chart (vertical bars)
    const colW = 100 / Math.max(byStudents.length, 1);
    const studentCols = `
      <div style="display:flex;align-items:flex-end;gap:6px;height:200px;padding:10px 4px 0">
        ${byStudents.map(c => `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">
            <div style="font-size:11px;font-weight:700;margin-bottom:4px">${c.students}</div>
            <div title="${escapeHtml(c.name)}: ${c.students} students" style="width:70%;height:${(c.students/maxStud*100).toFixed(1)}%;background:linear-gradient(180deg,${c.color},${c.color}99);border-radius:4px 4px 0 0;min-height:3px"></div>
            <div style="font-size:9px;color:var(--text-mute);margin-top:5px;text-align:center;white-space:nowrap;overflow:hidden;max-width:100%;text-overflow:ellipsis">${escapeHtml(c.name.split(' ')[0])}</div>
          </div>`).join('')}
      </div>`;

    // Attendance-rate donuts (simple horizontal with % color)
    const rateRows = [...data].sort((a,b)=>b.rate-a.rate).map(c => {
      const col = c.rate>=75?'var(--green)':c.rate>=40?'var(--accent-2)':'var(--red)';
      return `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:9px">
        <div style="width:110px;font-size:12px;font-weight:500">${escapeHtml(c.name)}</div>
        <div style="flex:1;height:18px;background:var(--surface-2);border-radius:5px;overflow:hidden">
          <div style="height:100%;width:${c.rate.toFixed(0)}%;background:${col};border-radius:5px;min-width:2px"></div>
        </div>
        <div style="width:48px;text-align:right;font-weight:700;font-size:13px;color:${col}">${c.total?Math.round(c.rate)+'%':'—'}</div>
      </div>`;}).join('');

    const totalComm = data.reduce((s,c)=>s+c.commission,0);
    const totalRev = data.reduce((s,c)=>s+c.paid,0);
    const totalStud = data.reduce((s,c)=>s+c.students,0);

    $('#cp-body').innerHTML = `
      <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="kpi"><div class="kpi-icon">🥋</div><div class="kpi-label">Active coaches</div><div class="kpi-value">${data.length}</div></div>
        <div class="kpi blue"><div class="kpi-icon">👥</div><div class="kpi-label">Total students</div><div class="kpi-value">${totalStud}</div></div>
        <div class="kpi green"><div class="kpi-icon">💵</div><div class="kpi-label">Revenue (${fmtMonth(month)})</div><div class="kpi-value" style="font-size:20px">${fmt(totalRev)}</div></div>
        <div class="kpi orange"><div class="kpi-icon">💰</div><div class="kpi-label">Total commission</div><div class="kpi-value" style="font-size:20px">${fmt(totalComm)}</div></div>
      </div>

      <div class="row row-2" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="card">
          <div class="card-header"><div><div class="card-title">Commission by Coach</div><div class="card-subtitle">Total paid × commission %</div></div></div>
          <div style="padding:8px 4px">${commBars || '<div class="text-mute" style="padding:20px">No data</div>'}</div>
        </div>
        <div class="card">
          <div class="card-header"><div><div class="card-title">Revenue by Coach</div><div class="card-subtitle">Total paid amount</div></div></div>
          <div style="padding:8px 4px">${revBars || '<div class="text-mute" style="padding:20px">No data</div>'}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div><div class="card-title">Students per Coach</div><div class="card-subtitle">Active student count</div></div></div>
        ${studentCols}
      </div>

      <div class="card">
        <div class="card-header"><div><div class="card-title">Attendance Rate by Coach</div><div class="card-subtitle">Classes attended ÷ scheduled</div></div></div>
        <div style="padding:8px 4px">${rateRows || '<div class="text-mute" style="padding:20px">No attendance data</div>'}</div>
      </div>
    `;
  }

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Coach Performance</h1>
        <div class="subtitle">Visual performance dashboard · revenue, commission, students, attendance</div>
      </div>
      <div class="topbar-actions">
        <select id="cp-month" class="btn ghost">
          ${monthsInData.map(m => `<option value="${m}" ${m === month ? 'selected' : ''}>${fmtMonth(m)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="cp-body"></div>
  `;
  $('#cp-month').addEventListener('change', e => { month = e.target.value; refresh(); });
  refresh();
};

// ─── REPORTS ──────────────────────────────────────────────────
// Period-aware: filter by month, year, or all-time. Compute everything
// (KPIs, revenue by category, sport revenue, expenses, top expenses) for
// whatever period the user picks.
PAGES.reports = (main) => {
  // period = { type: 'month'|'year'|'all', value: '2026-05' | '2026' | null }
  let period = { type: 'month', value: latestDataMonth() };

  // ── Discover all months/years that have data so the selector is dynamic ──
  function discoverPeriods() {
    const months = new Set();
    state.invoices.forEach(i => { if (i.month) months.add(i.month); });
    state.expenses.forEach(e => { if (e.date) months.add(e.date.slice(0, 7)); });
    state.salaries.forEach(x => { if (x.month) months.add(x.month); });
    return [...months].sort();
  }
  const allMonths = discoverPeriods();
  const allYears = [...new Set(allMonths.map(m => m.slice(0, 4)))].sort();

  // ── Test if a YYYY-MM month string falls inside the active period ──
  function inPeriod(monthStr) {
    if (!monthStr) return false;
    if (period.type === 'all') return true;
    if (period.type === 'year') return monthStr.startsWith(period.value);
    return monthStr === period.value;
  }
  function inPeriodDate(d) { return d ? inPeriod(d.slice(0, 7)) : false; }

  // ── Aggregate everything for the chosen period ──
  function compute() {
    // Filter source data
    // Revenue is cash-basis: include any invoice with a payment in the period,
    // and count only the cash received within it.
    const invs = state.invoices.filter(i => cashInPeriod(i, inPeriod) > 0 || inPeriod(i.month));
    const exps = state.expenses.filter(e => inPeriodDate(e.date) || inPeriod(e.month));
    const sals = state.salaries.filter(x => inPeriod(x.month));
    const newMembers = state.members.filter(m => inPeriodDate(m.firstRegistration)).length;

    const revenue = state.invoices.reduce((a, i) => a + cashInPeriod(i, inPeriod), 0);
    const expensesTotal = exps.reduce((a, e) => a + (e.amount || 0), 0);
    const salariesTotal = sals.reduce((a, x) => a + (x.salary || x.total || x.amount || 0), 0);
    const profit = revenue - expensesTotal - salariesTotal;
    const profitMargin = revenue ? (profit / revenue * 100) : 0;
    const avgInvoice = invs.length ? revenue / invs.length : 0;

    // Previous period (for delta arrow): one month back if monthly, one year back if yearly
    let prevRev = 0;
    if (period.type === 'month') {
      const idx = allMonths.indexOf(period.value);
      if (idx > 0) prevRev = state.invoices.reduce((a, i) => a + cashInMonth(i, allMonths[idx - 1]), 0);
    } else if (period.type === 'year') {
      const yIdx = allYears.indexOf(period.value);
      if (yIdx > 0) prevRev = state.invoices.reduce((a, i) => a + cashInPeriod(i, m => m && m.startsWith(allYears[yIdx - 1])), 0);
    }

    // Revenue by category (cash collected in period)
    const revByCat = {};
    state.invoices.forEach(i => { const c = i.category || 'Membership'; const v = cashInPeriod(i, inPeriod); if (v) revByCat[c] = (revByCat[c] || 0) + v; });

    // Sport revenue (cash collected in period, from invoices linked to a sport)
    const sportRev = {};
    state.invoices.forEach(i => { if (i.sport) { const v = cashInPeriod(i, inPeriod); if (v) sportRev[i.sport] = (sportRev[i.sport] || 0) + v; } });

    // Expense by category
    const expByCat = {};
    exps.forEach(e => { expByCat[e.category || 'Other'] = (expByCat[e.category || 'Other'] || 0) + e.amount; });

    // Top expenses for the period
    const topExp = [...exps].sort((a, b) => b.amount - a.amount).slice(0, 10);

    // Active members + churn (members with expiry inside or before this period).
    // Excludes archived (soft-deleted) members.
    const _activeList = activeMembers();
    const activeMembers_ = _activeList.filter(m => isActiveStatus(m)).length;
    const totalMembers = _activeList.length;
    const expiredInPeriod = _activeList.filter(m => inPeriodDate(m.expiryDate) && m.status === 'Expired').length;

    return { invs, exps, sals, revenue, expensesTotal, salariesTotal, profit, profitMargin,
             avgInvoice, prevRev, revByCat, sportRev, expByCat, topExp,
             activeMembers: activeMembers_, totalMembers, expiredInPeriod, newMembers, invCount: invs.length };
  }

  function periodLabel() {
    if (period.type === 'all') return 'All time';
    if (period.type === 'year') return period.value;
    return fmtMonth(period.value);
  }

  const REVCAT_COLORS = { 'Membership':'#10b981','Court Rental':'#f2a33c','Boxing Room':'#5b8def','Product':'#8b5cf6','Other':'#888' };

  function renderBody() {
    const d = compute();
    const allRevCats = Object.entries(d.revByCat).sort((a, b) => b[1] - a[1]);
    const revTotal = d.revenue || 1;
    const sortedSports = Object.entries(d.sportRev).sort((a, b) => b[1] - a[1]);
    const sortedExpCats = Object.entries(d.expByCat).sort((a, b) => b[1] - a[1]);
    const deltaPct = d.prevRev ? ((d.revenue - d.prevRev) / d.prevRev * 100) : null;

    $('#rep-body').innerHTML = `
      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-label">Revenue (${escapeHtml(periodLabel())})</div>
          <div class="kpi-value num">${fmt(d.revenue)} <span style="font-size:13px;color:var(--text-dim);font-weight:500">QAR</span></div>
          ${deltaPct != null ? `<div class="kpi-delta ${deltaPct>0?'up':deltaPct<0?'down':'flat'}">${deltaPct>0?'▲':deltaPct<0?'▼':'−'} ${Math.abs(deltaPct).toFixed(1)}% vs prev</div>` : ''}
        </div>
        <div class="kpi blue">
          <div class="kpi-label">Profit Margin</div>
          <div class="kpi-value num">${d.profitMargin.toFixed(1)}%</div>
          <div class="kpi-delta flat">Net: ${fmt(d.profit)} QAR</div>
        </div>
        <div class="kpi green">
          <div class="kpi-label">Avg Invoice</div>
          <div class="kpi-value num">${fmt(d.avgInvoice)} QAR</div>
          <div class="kpi-delta flat">${d.invCount} invoices</div>
        </div>
        <div class="kpi orange">
          <div class="kpi-label">New Members</div>
          <div class="kpi-value num">${d.newMembers}</div>
          <div class="kpi-delta flat">${d.activeMembers} active overall</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div><div class="card-title">Revenue by Category</div><div class="card-subtitle">Memberships · Court Rental · Boxing Room · Product · ${escapeHtml(periodLabel())}</div></div></div>
        <div style="padding:8px 4px">
          ${allRevCats.length ? allRevCats.map(([cat, v]) => {
            const col = REVCAT_COLORS[cat] || '#888';
            return `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:11px">
              <div style="width:120px;font-size:13px;font-weight:500">${escapeHtml(cat)}</div>
              <div style="flex:1;height:22px;background:var(--surface-2);border-radius:5px;overflow:hidden">
                <div style="height:100%;width:${(v/revTotal*100).toFixed(1)}%;background:${col};border-radius:5px;min-width:2px"></div>
              </div>
              <div style="width:80px;text-align:right;font-weight:700;font-size:14px">${fmt(v)}</div>
              <div style="width:60px;text-align:right;font-size:11px;color:var(--text-mute)">${Math.round(v/revTotal*100)}%</div>
            </div>`;
          }).join('') : '<div class="text-mute" style="padding:16px">No revenue in this period</div>'}
          <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:10px;margin-top:6px;font-weight:700">
            <span>Total revenue (${escapeHtml(periodLabel())})</span><span>${fmt(d.revenue)} QAR</span>
          </div>
        </div>
      </div>

      <div class="row row-2 mb-3" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="card">
          <div class="card-header"><div><div class="card-title">Revenue by Sport</div><div class="card-subtitle">From linked invoices · ${escapeHtml(periodLabel())}</div></div></div>
          ${sortedSports.length ? sortedSports.map(([sport, rev]) => `
            <div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
                <span>${escapeHtml(sport)}</span><span class="font-bold">${fmt(rev)} QAR</span>
              </div>
              <div style="height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden">
                <div style="height:100%;width:${(rev/sortedSports[0][1]*100).toFixed(1)}%;background:linear-gradient(90deg,var(--blue),var(--purple));border-radius:4px"></div>
              </div>
            </div>`).join('') : '<div class="text-mute" style="padding:16px">No sport revenue in this period</div>'}
        </div>
        <div class="card">
          <div class="card-header"><div><div class="card-title">Expenses by Category</div><div class="card-subtitle">${escapeHtml(periodLabel())} · Total ${fmt(d.expensesTotal)} QAR</div></div></div>
          ${sortedExpCats.length ? sortedExpCats.map(([cat, amt]) => `
            <div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
                <span>${escapeHtml(cat)}</span><span class="font-bold">${fmt(amt)} QAR</span>
              </div>
              <div style="height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden">
                <div style="height:100%;width:${(amt/sortedExpCats[0][1]*100).toFixed(1)}%;background:linear-gradient(90deg,var(--accent-2),var(--accent));border-radius:4px"></div>
              </div>
            </div>`).join('') : '<div class="text-mute" style="padding:16px">No expenses in this period</div>'}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div><div class="card-title">Top Expenses</div><div class="card-subtitle">Single highest-cost items · ${escapeHtml(periodLabel())}</div></div></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="text-right">Amount</th></tr></thead>
            <tbody>
              ${d.topExp.length ? d.topExp.map(e => `
                <tr><td>${fmtDate(e.date)}</td><td>${escapeHtml(e.description || '—')}</td><td><span class="badge">${escapeHtml(e.category || '—')}</span></td><td class="text-right num font-bold">${fmtMoney(e.amount)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">No expenses in this period</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ── Static shell ──
  const monthOptions = allMonths.map(m => `<option value="${m}" ${period.value === m && period.type === 'month' ? 'selected' : ''}>${fmtMonth(m)}</option>`).join('');
  const yearOptions = allYears.map(y => `<option value="${y}">${y}</option>`).join('');

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Reports & Insights</h1>
        <div class="subtitle" id="rep-subtitle">Showing: ${escapeHtml(periodLabel())}</div>
      </div>
      <div class="topbar-actions" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <div style="display:inline-flex;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:3px">
          <button class="btn ghost sm rep-tab" data-type="month" style="background:var(--accent);color:#fff">Month</button>
          <button class="btn ghost sm rep-tab" data-type="year">Year</button>
          <button class="btn ghost sm rep-tab" data-type="all">All time</button>
        </div>
        <select id="rep-month" class="btn ghost">${monthOptions}</select>
        <select id="rep-year" class="btn ghost" style="display:none">${yearOptions}</select>
        <button class="btn primary" id="print-summary">🖨 Print summary</button>
      </div>
    </div>
    <div id="rep-body"></div>
  `;

  // Wire period tabs
  document.querySelectorAll('.rep-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      period.type = type;
      // Active state
      document.querySelectorAll('.rep-tab').forEach(b => { b.style.background = ''; b.style.color = ''; });
      btn.style.background = 'var(--accent)'; btn.style.color = '#fff';
      // Show/hide the relevant selector
      $('#rep-month').style.display = type === 'month' ? '' : 'none';
      $('#rep-year').style.display = type === 'year' ? '' : 'none';
      // Set value
      if (type === 'month') period.value = $('#rep-month').value;
      else if (type === 'year') period.value = $('#rep-year').value;
      else period.value = null;
      $('#rep-subtitle').textContent = `Showing: ${periodLabel()}`;
      renderBody();
    });
  });
  $('#rep-month').addEventListener('change', e => {
    period.value = e.target.value;
    $('#rep-subtitle').textContent = `Showing: ${periodLabel()}`;
    renderBody();
  });
  $('#rep-year').addEventListener('change', e => {
    period.value = e.target.value;
    $('#rep-subtitle').textContent = `Showing: ${periodLabel()}`;
    renderBody();
  });

  // Print summary (uses currently-selected period)
  $('#print-summary').addEventListener('click', () => {
    const d = compute();
    const allRevCats = Object.entries(d.revByCat).sort((a, b) => b[1] - a[1]);
    const coachRows = state.coaches.map(c => {
      const rev = d.invs.reduce((a, i) => {
        const lis = (Array.isArray(i.lineItems) && i.lineItems.length) ? i.lineItems : [{ coachId: i.coachId, price: i.amount || 0 }];
        return a + lis.filter(li => li.coachId === c.id).reduce((s, li) => s + (li.price || 0), 0);
      }, 0);
      return { name: c.name, rev, comm: rev * (c.rate || 0) / 100, rate: c.rate || 0 };
    }).filter(c => c.rev > 0).sort((a, b) => b.rev - a.rev);

    const catRows = allRevCats.map(([c, v]) =>
      `<tr><td>${escapeHtml(c)}</td><td style="text-align:right">${fmt(v)} QAR</td><td style="text-align:right;color:#777">${Math.round(v/(d.revenue||1)*100)}%</td></tr>`).join('');
    const coachTable = coachRows.map(c =>
      `<tr><td>${escapeHtml(c.name)}</td><td style="text-align:right">${fmt(c.rev)}</td><td style="text-align:right">${c.rate}%</td><td style="text-align:right;font-weight:600">${fmt(c.comm)}</td></tr>`).join('');

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Summary ${periodLabel()}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      @page{size:A4 portrait;margin:14mm}
      body{font-family:-apple-system,'Segoe UI',Arial,sans-serif;color:#1a1a1a;padding:28px;font-size:13px}
      .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #f26060;padding-bottom:16px;margin-bottom:22px}
      .brand{font-size:24px;font-weight:800}.brand span{color:#f26060}
      .sub{color:#777;font-size:12px;margin-top:3px}
      h2{font-size:14px;margin:22px 0 10px;color:#f26060;border-bottom:1px solid #eee;padding-bottom:5px}
      .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:8px}
      .kpi{border:1px solid #e5e5ea;border-radius:8px;padding:12px}
      .kpi .l{font-size:10px;text-transform:uppercase;color:#999;letter-spacing:.4px}
      .kpi .v{font-size:20px;font-weight:700;margin-top:3px}
      table{border-collapse:collapse;width:100%;margin-bottom:8px}
      th,td{padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;text-align:left}
      th{background:#fafafa;color:#777;font-size:10px;text-transform:uppercase}
      .foot{margin-top:30px;font-size:10px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:12px}
    </style></head><body>
      <div class="head">
        <div><div class="brand">Black <span>Stars</span> Sports Club</div><div class="sub">Waab, Doha · Performance Summary</div></div>
        <div style="text-align:right;font-size:12px;color:#777">${escapeHtml(periodLabel())}<br><b style="color:#1a1a1a">Generated ${fmtDate(TODAY)}</b></div>
      </div>
      <div class="kpis">
        <div class="kpi"><div class="l">Revenue</div><div class="v" style="color:#059669">${fmt(d.revenue)}</div></div>
        <div class="kpi"><div class="l">Expenses + Payroll</div><div class="v" style="color:#dc2626">${fmt(d.expensesTotal + d.salariesTotal)}</div></div>
        <div class="kpi"><div class="l">Net Profit</div><div class="v" style="color:${d.profit>=0?'#059669':'#dc2626'}">${fmt(d.profit)}</div></div>
        <div class="kpi"><div class="l">Active Members</div><div class="v">${d.activeMembers}</div></div>
      </div>
      <h2>Revenue by Category</h2>
      <table><thead><tr><th>Category</th><th style="text-align:right">Amount</th><th style="text-align:right">Share</th></tr></thead><tbody>${catRows || '<tr><td colspan="3" style="color:#999;padding:10px">No data</td></tr>'}</tbody>
        <tfoot><tr><td style="font-weight:700">Total</td><td style="text-align:right;font-weight:700">${fmt(d.revenue)} QAR</td><td></td></tr></tfoot></table>
      <h2>Coach Performance & Commission</h2>
      <table><thead><tr><th>Coach</th><th style="text-align:right">Revenue</th><th style="text-align:right">Rate</th><th style="text-align:right">Commission</th></tr></thead><tbody>${coachTable || '<tr><td colspan="4" style="color:#999;padding:10px">No data</td></tr>'}</tbody></table>
      <h2>Membership</h2>
      <table><tbody>
        <tr><td>Active members</td><td style="text-align:right;font-weight:600">${d.activeMembers}</td></tr>
        <tr><td>New registrations (${escapeHtml(periodLabel())})</td><td style="text-align:right;font-weight:600">${d.newMembers}</td></tr>
        <tr><td>Total members on file</td><td style="text-align:right;font-weight:600">${state.members.length}</td></tr>
      </tbody></table>
      <div class="foot">Black Stars CRM · Confidential · Generated ${fmtDate(TODAY)}</div>
      <script>window.onload=()=>window.print();<\/script>
    </body></html>`);
    win.document.close();
    toast(`Summary ready: ${periodLabel()}`);
  });

  renderBody();
};

// ═════════════════════════════════════════════════════════════════════
// DATA IMPORT — upload Excel files and rebuild the database
// ═════════════════════════════════════════════════════════════════════
// Mirror of the Python build pipeline that's been used in earlier rebuilds.
// Each importer is pure: takes parsed sheets, returns the new data, doesn't
// touch state directly. The page wires them together so the user gets a
// preview, can adjust, and then commits with a single button.

// ─── Helpers shared by all importers ────────────────────────────────────
const IMP_COACH_ALIAS = {
  'abdel salam':'Abdel Salam','jennifer':'Jennifer','mostafa':'Mostafa',
  'saeed':'Saeed','saaed':'Saeed','said':'Saeed','sa\'id':'Saeed',
  'aya':'Aya','anis':'Anis','ayman':'Ayman','aymen':'Ayman',
  'leina':'Leina','leena':'Leina','fawzi':'Fawzi','fawazi':'Fawzi',
};
const IMP_DROP_COACHES = new Set(['majed','fethi tayeb','fethi']);
const IMP_SUMMARY_RX = /^\d+\s*(member|student|coash|class)/i;

function impParseDate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    // YYYY-MM-DD or with time
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    // DD/MM/YYYY
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) {
      const y = m[3].length === 2 ? '20' + m[3] : m[3];
      return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    }
  }
  return null;   // xlsx-mini already converts date-styled numbers
}

function impParseClasses(v) {
  if (v == null || v === '') return [0, 0];
  const s = String(v).trim();
  if (!s || s.toLowerCase() === 'nan') return [0, 0];
  if (s.includes('/')) {
    const parts = s.split('/').map(x => x.trim());
    const tot = parseInt((parts[0].match(/\d+/) || ['0'])[0]) || 0;
    const att = (parts[1] && (parts[1].match(/\d+/) || [''])[0]) ? parseInt((parts[1].match(/\d+/))[0]) : 0;
    return [tot, att];
  }
  const n = parseInt((s.match(/\d+/) || ['0'])[0]);
  return [isNaN(n) ? 0 : n, 0];
}

function impNormActivity(a) {
  if (a == null) return null;
  const s = String(a).trim().toLowerCase();
  if (s === 'mma') return 'MMA';
  if (s.includes('kick') && s.includes('box')) return 'Kick Boxing';
  if (s === 'boxing' || s === 'box') return 'Boxing';
  if (s.includes('taekwon')) return 'Taekwondo';
  if (s.includes('karate')) return 'Karate';
  if (s.includes('gymnas')) return 'Gymnastic';
  if (s.includes('swim')) return 'Swimming';
  if (s.includes('football') || s.includes('soccer')) return 'Football';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function impResolveCoachName(raw) {
  if (!raw) return null;
  const r = String(raw).trim().toLowerCase();
  if (IMP_DROP_COACHES.has(r)) return null;
  if (IMP_COACH_ALIAS[r]) return IMP_COACH_ALIAS[r];
  for (const k of Object.keys(IMP_COACH_ALIAS)) {
    if (r.includes(k)) return IMP_COACH_ALIAS[k];
  }
  return null;
}

// Build a header-keyed row map from a 2D sheet array. The header row is
// auto-detected: it's the first row that contains "Coach" or "name" etc.
function impHeaderIndex(rows) {
  if (!rows || !rows.length) return -1;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i] || [];
    for (const cell of row) {
      if (cell && String(cell).trim().toLowerCase() === 'coach') return i;
    }
  }
  return 0;
}

function impToRecords(rows) {
  const hi = impHeaderIndex(rows);
  if (hi < 0) return [];
  const headers = (rows[hi] || []).map(h => h == null ? '' : String(h).trim());
  const out = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const rec = {};
    for (let c = 0; c < headers.length; c++) {
      if (headers[c]) rec[headers[c]] = row[c] !== undefined ? row[c] : null;
    }
    out.push(rec);
  }
  return out;
}

// Pick a column by trying multiple header names
function pick(rec, ...names) {
  for (const n of names) {
    if (rec[n] != null && rec[n] !== '') return rec[n];
    // Case-insensitive fallback
    for (const k of Object.keys(rec)) {
      if (k.toLowerCase().trim() === n.toLowerCase().trim() && rec[k] != null && rec[k] !== '') return rec[k];
    }
  }
  return null;
}

// ─── Members importer ──────────────────────────────────────────────────
// Reads the multi-sheet members workbook. Returns { coaches, members, warnings }.
function importMembers(sheets) {
  const warnings = [];
  const allRows = [];
  let skSummary = 0, skJunk = 0, skDropped = 0, dupSportMerged = 0;
  const coachesSeen = new Set();

  for (const sheetName of Object.keys(sheets)) {
    const recs = impToRecords(sheets[sheetName]);
    for (const r of recs) {
      const nameRaw = pick(r, 'Name En', 'Member Name En', 'Name', 'Student Name');
      if (!nameRaw || !String(nameRaw).trim()) continue;
      const name = String(nameRaw).trim();
      if (IMP_SUMMARY_RX.test(name)) { skSummary++; continue; }
      const coachRaw = pick(r, 'Coach');
      const coachStr = coachRaw ? String(coachRaw).trim().toLowerCase() : '';
      if (!coachStr || coachStr === 'nan' || coachStr.includes('start') || /^\d+$/.test(coachStr) ||
          coachStr.includes('student') || coachStr.includes('coash')) { skJunk++; continue; }
      if (IMP_DROP_COACHES.has(coachStr)) { skDropped++; continue; }
      const coachName = impResolveCoachName(coachStr);
      if (!coachName) {
        warnings.push(`Unknown coach "${coachRaw}" for ${name} (sheet "${sheetName}")`);
        skJunk++; continue;
      }
      coachesSeen.add(coachName);
      const [tot, att] = impParseClasses(pick(r, 'Attended Classes', 'Classes'));
      const statusRaw = pick(r, 'Status') || '';
      const statusL = String(statusRaw).toLowerCase().trim();
      let status = 'Unknown';
      if (statusL === 'active') status = 'Active';
      else if (statusL === 'expired' || statusL === 'expire') status = 'Expired';
      else if (statusL && statusL !== 'nan') status = String(statusRaw).charAt(0).toUpperCase() + String(statusRaw).slice(1);

      let paid = parseFloat(pick(r, 'Paid Amount'));
      if (isNaN(paid)) paid = 0;

      const mobile = pick(r, 'Mobile');
      const mobileStr = mobile != null && mobile !== '' ?
        (typeof mobile === 'number' ? String(Math.trunc(mobile)) : String(mobile).trim()) : null;

      const qidV = pick(r, 'Student QID', 'QID');
      const qidStr = qidV != null && qidV !== '' ?
        (typeof qidV === 'number' ? String(Math.trunc(qidV)) : String(qidV).trim()) : null;

      allRows.push({
        name,
        name_ar: pick(r, 'Name Ar', 'Member Name Ar'),
        mobile: mobileStr, qid: qidStr,
        birthdate: impParseDate(pick(r, 'Birthdate')),
        level: pick(r, 'Level'),
        nationality: pick(r, 'Nationality') || null,
        firstReg: impParseDate(pick(r, 'First Registration Date')),
        coachName, status, paid,
        activity: impNormActivity(pick(r, 'Activity')),
        start: impParseDate(pick(r, 'Start Date')),
        expiry: impParseDate(pick(r, 'Expiry Date')),
        totalClasses: tot, attendedClasses: att,
      });
    }
  }

  // Build coaches list, preserving canonical order
  const CANON = ['Abdel Salam','Jennifer','Mostafa','Saeed','Aya','Anis','Ayman','Leina','Fawzi'];
  const SPORTS_BY_COACH = {
    'Abdel Salam':['MMA','Boxing'],'Jennifer':['Gymnastic'],'Mostafa':['Karate','Swimming'],
    'Saeed':['Boxing','MMA'],'Aya':['Kick Boxing'],'Anis':['Football'],
    'Ayman':['Taekwondo'],'Leina':['Swimming'],'Fawzi':['Football'],
  };
  const RATE_BY_COACH = { 'Jennifer': 35, 'Aya': 40 };
  const coaches = [];
  let cid = 1;
  for (const name of CANON) {
    if (coachesSeen.has(name)) {
      coaches.push({ id: cid++, name, rate: RATE_BY_COACH[name] || 30, sports: SPORTS_BY_COACH[name] || [], active: 'Y' });
    }
  }
  const coachIdByName = {};
  for (const c of coaches) coachIdByName[c.name.toLowerCase()] = c.id;

  // Group rows by the COMPOSITE key (name + mobile) → multi-sport enrollments.
  // Matches the app's uniqueness rule: same name + same phone = one person
  // (rows merge into multi-sport enrollments); same name + DIFFERENT phone =
  // distinct people (kept separate instead of being wrongly merged).
  const memberMap = new Map();
  for (const r of allRows) {
    const nameKey = (r.name || '').toLowerCase().trim();
    const phoneKey = r.mobile ? String(r.mobile).replace(/\D/g, '').slice(-8) : '';
    const key = nameKey + '|' + phoneKey;
    if (!memberMap.has(key)) memberMap.set(key, { name: r.name, rows: [] });
    memberMap.get(key).rows.push(r);
  }

  const members = [];
  let mid = 1;
  for (const { name, rows } of memberMap.values()) {
    const statuses = rows.map(r => r.status);
    let memberStatus;
    if (statuses.includes('Active')) memberStatus = 'Active';
    else if (statuses.every(s => s === 'Expired')) memberStatus = 'Expired';
    else memberStatus = statuses[0] || 'Unknown';
    const primary = rows.find(r => r.status === 'Active') || rows[0];
    const enrollments = [];
    const subs = [];
    const enrollBySport = new Map();   // one enrollment per sport (active / latest start wins)
    rows.forEach((r, i) => {
      const coachId = coachIdByName[r.coachName.toLowerCase()];
      if (r.activity && coachId) {
        const cand = {
          sport: r.activity, coachId, classes: r.totalClasses, price: r.paid,
          start: r.start || null,
          validity: (r.start && r.expiry) ? daysBetween(r.start, r.expiry) : DEFAULT_VALIDITY,
          _active: r.status === 'Active', _start: r.start || '',
        };
        const prev = enrollBySport.get(r.activity);
        if (!prev) {
          enrollBySport.set(r.activity, cand);
        } else {
          // Duplicate sport for this member — keep the Active one, else the later start.
          const better = (cand._active && !prev._active) ||
                         (cand._active === prev._active && cand._start > prev._start);
          if (better) enrollBySport.set(r.activity, cand);
          dupSportMerged++;
        }
      }
      subs.push({
        month: 'may', activity: r.activity, coach: r.coachName, coachId,
        start: r.start, end: r.expiry,
        totalClasses: r.totalClasses, attendedClasses: r.attendedClasses,
        amountPaid: r.paid,
        status: r.status === 'Unknown' ? 'unknown' : r.status.toLowerCase(),
        _sid: `s${mid}_${i}`,
      });
    });
    for (const en of enrollBySport.values()) { delete en._active; delete en._start; enrollments.push(en); }
    const starts = rows.map(r => r.start).filter(Boolean);
    const expirys = rows.map(r => r.expiry).filter(Boolean);
    members.push({
      id: mid, name,
      nameArabic: primary.name_ar, phone: primary.mobile, qid: primary.qid,
      birthdate: primary.birthdate, level: primary.level,
      nationality: primary.nationality || null,
      firstRegistration: primary.firstReg || (starts.length ? starts.sort()[0] : null),
      startDate: starts.length ? starts.sort()[0] : null,
      expiryDate: expirys.length ? expirys.sort().reverse()[0] : null,
      joinDate: primary.firstReg || (starts.length ? starts.sort()[0] : null),
      sport: primary.activity, coachId: coachIdByName[primary.coachName.toLowerCase()],
      status: memberStatus,
      subscriptions: subs, renewals: [], enrollments,
      months: ['may'], renewalsBySport: {}, dailyAttendance: {},
      email: `member${mid}@example.qa`,
    });
    mid++;
  }

  if (dupSportMerged > 0) warnings.push(`${dupSportMerged} duplicate sport row(s) merged — kept one enrollment per sport (active / latest start).`);
  return { coaches, members, warnings, summary: {
    rowsRead: allRows.length, skippedSummary: skSummary, skippedJunk: skJunk,
    skippedDropped: skDropped, uniqueMembers: members.length, duplicateSportsMerged: dupSportMerged,
    active: members.filter(m => m.status === 'Active').length,
    expired: members.filter(m => m.status === 'Expired').length,
  }};
}

// ─── Attendance importer ───────────────────────────────────────────────
// Day columns are positional (col index 6..36 → days 1..31). Returns marks
// to be merged into the given members[] (mutates dailyAttendance), plus list
// of unmatched rows.
function importAttendance(sheets, members, sheetColors) {
  // Find a sheet that looks like attendance. Two template formats supported:
  //  OLD: columns [Index, student, Coach, Activity, Start Date, MOBILE, day1..day31]
  //       Marks are 'Y' / 'N' text values.
  //  NEW: columns [Coach, Member Name En, Member Name Ar, Mobile, Activity, DAY 1..DAY 31]
  //       Marks are cell FILL COLOR — green = present (Y), red = absent (N).
  //       Cells may ALSO contain text 'Y'/'N' (legacy data); we honor both.
  //
  // Auto-detect month from sheet name (e.g. "June -2026", "May-2026", "Jun 2026").

  function detectMonthFromName(name) {
    if (!name) return null;
    const monthMap = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12',
      january:'01', february:'02', march:'03', april:'04', june:'06', july:'07', august:'08', september:'09', october:'10', november:'11', december:'12' };
    const lower = String(name).toLowerCase().replace(/\s+/g, ' ').trim();
    const yearMatch = lower.match(/\b(20\d{2})\b/);
    let mm = null;
    for (const key of Object.keys(monthMap)) {
      if (lower.includes(key)) { mm = monthMap[key]; break; }
    }
    if (!mm || !yearMatch) return null;
    return `${yearMatch[1]}-${mm}`;
  }

  // Discover usable sheet — prefer most recent month if there are multiple.
  // Priority: NEW format sheet > OLD format sheet > any sheet with student col.
  let rows = null, colors = null, sheetName = null, fmt = null;
  const candidates = [];
  for (const name of Object.keys(sheets)) {
    const r = sheets[name];
    const rc = (sheetColors && sheetColors[name]) || [];
    if (!r || r.length < 2) continue;
    const headerRow = (r[0] || []).map(h => h == null ? '' : String(h).toLowerCase().trim());
    const hasNew = headerRow.some(h => h === 'member name en' || h === 'member name ar' || h.startsWith('day '));
    const hasOld = headerRow.includes('student');
    if (hasNew) candidates.push({ name, rows: r, colors: rc, fmt: 'new' });
    else if (hasOld) candidates.push({ name, rows: r, colors: rc, fmt: 'old' });
  }
  if (!candidates.length) return { matched: 0, unmatched: [], totalMarks: 0, warnings: ['No attendance sheet found. Expected columns: "Member Name En" + "DAY 1"… (new format) or "student" + day numbers (legacy format).'] };

  // Pick the candidate whose detected month is most recent; fall back to first.
  candidates.sort((a, b) => {
    const ma = detectMonthFromName(a.name) || '';
    const mb = detectMonthFromName(b.name) || '';
    return mb.localeCompare(ma);
  });
  const chosen = candidates[0];
  rows = chosen.rows; colors = chosen.colors; sheetName = chosen.name; fmt = chosen.fmt;
  const monthKey = detectMonthFromName(sheetName) || (function defaultMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  })();

  // Column layout depends on format
  const header = (rows[0] || []).map(h => h == null ? '' : String(h).toLowerCase().trim());
  let studentCol, activityCol, mobileCol, dayStartCol, dayCount;
  if (fmt === 'new') {
    // NEW: A=Coach, B=Member Name En, C=Member Name Ar, D=Mobile, E=Activity, F+=days
    studentCol  = header.indexOf('member name en');
    if (studentCol < 0) studentCol = header.indexOf('student');
    activityCol = header.indexOf('activity');
    if (activityCol < 0) activityCol = header.findIndex(h => h.startsWith('activity') || h.startsWith('acitvity'));
    mobileCol   = header.indexOf('mobile');
    // Day columns: anything after Activity is a day column. Even if labelled
    // only "DAY 1" with the rest blank, that's just Google Sheets showing the
    // header label in the first cell of a merged group.
    dayStartCol = Math.max(activityCol + 1, 5);
    dayCount = (rows[0] || []).length - dayStartCol;
  } else {
    // OLD: positional — A=Index, B=student, C=Coach, D=Activity, E=Start, F=Mobile, G+=days
    studentCol  = header.indexOf('student');
    activityCol = header.findIndex(h => h.startsWith('acitvity') || h.startsWith('activity'));
    mobileCol   = header.findIndex(h => h.toLowerCase().includes('mobile'));
    dayStartCol = 6;
    dayCount = 31;
  }
  if (studentCol < 0 || activityCol < 0) {
    return { matched: 0, unmatched: [], totalMarks: 0, warnings: ['Required columns (student/member-name + activity) not found in sheet "' + sheetName + '"'] };
  }

  // Index members by various name forms (English name, Arabic name, first-name)
  const idx = new Map();
  for (const m of members) {
    const forms = new Set();
    forms.add(String(m.name || '').toLowerCase().trim());
    if (m.nameArabic) forms.add(String(m.nameArabic).trim());
    const base = String(m.name || '').toLowerCase().trim().replace(/\s+(new|jr|sr|2|ii|iii)\s*$/, '');
    forms.add(base);
    if (m.name && m.name.includes(' ')) forms.add(m.name.toLowerCase().split(/\s+/)[0]);
    for (const f of forms) if (f && !idx.has(f)) idx.set(f, m);
  }
  // Also build an Arabic-name lookup for the NEW template's separate Arabic column
  const arabicIdx = new Map();
  for (const m of members) {
    if (m.nameArabic) arabicIdx.set(String(m.nameArabic).trim(), m);
  }

  // Reset attendance for THIS month only (preserve other months)
  for (const m of members) {
    if (m.dailyAttendance && m.dailyAttendance[monthKey]) {
      delete m.dailyAttendance[monthKey];
    }
  }

  let matched = 0, totalMarks = 0;
  const unmatched = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const colorRow = (colors && colors[r]) || [];
    const nameEn = row[studentCol];
    const nameAr = (fmt === 'new') ? row[studentCol + 1] : null;   // Arabic name in next column for new format
    if (!nameEn && !nameAr) continue;
    const activity = impNormActivity(row[activityCol]);
    if (!activity) continue;

    // Try to match by English name first, then Arabic, then loose substring
    let m = null;
    if (nameEn) {
      const nameLow = String(nameEn).trim().toLowerCase();
      m = idx.get(nameLow);
      if (!m) {
        for (const [form, mem] of idx.entries()) {
          if (form === nameLow) continue;
          if (form.length >= 4 && (form.includes(nameLow) || nameLow.includes(form))) { m = mem; break; }
        }
      }
    }
    if (!m && nameAr) {
      m = arabicIdx.get(String(nameAr).trim());
    }
    if (!m) {
      unmatched.push({ name: nameEn || nameAr, activity });
      continue;
    }
    matched++;

    // Read day marks: from cell COLOR first, then text value
    const sportMarks = {};
    const maxCol = Math.min(row.length, colorRow.length || row.length, dayStartCol + dayCount);
    for (let c = dayStartCol; c < (dayStartCol + dayCount) && c < row.length; c++) {
      let mark = null;
      const color = colorRow[c];
      if (color === 'green') mark = 'Y';
      else if (color === 'red') mark = 'N';
      else {
        const v = row[c];
        if (v != null && v !== '') {
          const vs = String(v).trim().toUpperCase();
          if (vs === 'Y' || vs === 'N') mark = vs;
        }
      }
      if (mark) {
        const day = c - dayStartCol + 1;
        sportMarks[String(day)] = mark;
        totalMarks++;
      }
    }
    if (Object.keys(sportMarks).length) {
      if (!m.dailyAttendance) m.dailyAttendance = {};
      if (!m.dailyAttendance[monthKey]) m.dailyAttendance[monthKey] = {};
      m.dailyAttendance[monthKey][activity] = sportMarks;
    }
  }
  return { matched, unmatched, totalMarks, warnings: [], monthKey, sheetName, format: fmt };
}

// ─── Sales importer ────────────────────────────────────────────────────
function importSales(sheets) {
  let rows = null;
  for (const name of Object.keys(sheets)) {
    const r = sheets[name];
    if (r && r.length > 1) {
      const h = r[0] || [];
      if (h.some(c => c && String(c).toLowerCase().includes('sales'))) { rows = r; break; }
    }
  }
  if (!rows) return { sales: [], warnings: ['No sales sheet found'] };
  const header = rows[0].map(h => h == null ? '' : String(h).trim());
  const cols = {};
  header.forEach((h, i) => { cols[h.toLowerCase()] = i; });
  const out = [];
  let sid = 1;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const item = row[cols['club sales'] || 0];
    if (!item) continue;
    const itemStr = String(item).trim();
    if (!itemStr || itemStr.toLowerCase() === 'total') continue;
    const num = (k) => {
      const i = cols[k];
      if (i == null) return null;
      const v = row[i];
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    };
    out.push({
      id: sid++, date: '2026-05-15', month: '2026-05',
      item: itemStr,
      qty: num('qty') || 0,
      unitPrice: num('uprice') || 0,
      amount: num('total amount') || 0,
      paid: num('paid') || 0,
      invoiceRefs: row[cols['invoice number'] || -1] ? String(row[cols['invoice number']]).trim() : null,
    });
  }
  return { sales: out, warnings: [] };
}

// ─── Expenses importer ─────────────────────────────────────────────────
function importExpenses(sheets) {
  // Find the May sheet — preferred name 'May-2026' or 'may' or the first sheet that has 'Expenses Items'
  let rows = null;
  for (const name of Object.keys(sheets)) {
    const r = sheets[name];
    if (r && r.length > 1) {
      const h = r[0] || [];
      if (h.some(c => c && String(c).toLowerCase().includes('expense'))) {
        if (/may/i.test(name) || !rows) rows = r;
      }
    }
  }
  if (!rows) return { expenses: [], warnings: ['No expenses sheet found'] };
  const header = rows[0].map(h => h == null ? '' : String(h).trim());
  const idxItem = header.findIndex(h => /expense/i.test(h));
  const idxPrice = header.findIndex(h => /price/i.test(h));
  const idxPay = header.findIndex(h => /online.*cash|cash.*online/i.test(h));
  const idxMonthly = header.findIndex(h => /monthly/i.test(h));
  const idxEquip = header.findIndex(h => /equipment|equip|staff/i.test(h));
  const out = [];
  let eid = 1;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const desc = idxItem >= 0 ? row[idxItem] : null;
    if (!desc) continue;
    const descStr = String(desc).trim();
    if (!descStr || descStr.toLowerCase() === 'total') continue;
    const price = parseFloat(row[idxPrice]) || 0;
    if (price <= 0) continue;
    const pay = idxPay >= 0 ? String(row[idxPay] || '').toLowerCase() : '';
    const method = pay.includes('card') || pay.includes('online') ? 'card' : 'cash';
    // Date from description "2/5/26"
    let dateStr = '2026-05-15';
    const dm = descStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (dm) {
      const y = dm[3].length === 2 ? '20' + dm[3] : dm[3];
      dateStr = `${y}-${dm[2].padStart(2,'0')}-${dm[1].padStart(2,'0')}`;
    }
    let cat = (idxEquip >= 0 && row[idxEquip] != null && row[idxEquip] !== '' &&
               (idxMonthly < 0 || row[idxMonthly] == null || row[idxMonthly] === '')) ? 'Equipment' : 'Operations';
    if (/rent/i.test(descStr) && price >= 1000) cat = 'Rent';
    out.push({
      id: eid++, date: dateStr, month: '2026-05',
      description: descStr, category: cat, amount: price, method,
    });
  }
  return { expenses: out, warnings: [] };
}

// ─── Page: Data Import ─────────────────────────────────────────────────
PAGES.dataimport = (main) => {
  // What's been uploaded in this session (before commit)
  const staged = {
    members: null,    // { coaches, members, summary, warnings, sheets }
    attendance: null, // raw sheets (applied after members)
    expenses: null,   // { expenses, warnings }
    sales: null,      // { sales, warnings }
  };

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>📥 Data Import</h1>
        <div class="subtitle">Upload Excel files to reset the database. Any subset works — only files you upload get re-imported, the rest stays as-is.</div>
      </div>
    </div>

    <div class="card" style="border-left:4px solid var(--accent-2)">
      <div style="display:flex;gap:10px;align-items:start">
        <div style="font-size:24px">⚠️</div>
        <div style="flex:1">
          <div style="font-weight:700;margin-bottom:4px">Importing will REPLACE existing data</div>
          <div style="font-size:13px;color:var(--text-dim)">Make a backup first (Settings → Data Management → Backup) if you want to keep your current state. Only the data types you upload are replaced — everything else stays untouched.</div>
        </div>
      </div>
    </div>

    <div class="row" style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      ${slotCard('members', 'Members', 'Club-Members.xlsx', 'Multi-sheet workbook, one sheet per coach. Members + coaches will be rebuilt from this.')}
      ${slotCard('attendance', 'Attendance', 'Club-Attendance.xlsx', 'NEW format: green fill = present (Y), red fill = absent (N). Also reads legacy Y/N text values. Month auto-detected from sheet name (e.g. "June-2026"). Requires Members in DB.')}
      ${slotCard('expenses', 'Expenses', 'Club-Expenses.xlsx', 'Monthly expenses with date in description and price column.')}
      ${slotCard('sales', 'Sales', 'Club-Sales.xlsx', 'Product sales records: item, qty, unit price, total.')}
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-header">
        <div><div class="card-title">Step 2 — Review & Apply</div><div class="card-subtitle">Once you've uploaded one or more files above, review the preview here and click Apply to commit.</div></div>
      </div>
      <div id="import-preview" style="margin-top:10px"><div class="text-mute" style="padding:16px;text-align:center">No files uploaded yet. Drop one of the slots above to begin.</div></div>
      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn primary" id="apply-import" disabled style="opacity:.5">🔥 Apply & Reset</button>
        <button class="btn ghost" id="clear-staged">Clear uploads</button>
      </div>
    </div>
  `;

  function slotCard(key, title, hint, desc) {
    return `
      <div class="card" data-slot="${key}" style="border:2px dashed var(--border);transition:border-color .15s">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <div style="font-size:18px">📄</div>
          <div style="font-weight:700;font-size:14px">${title}</div>
          <span class="badge" style="font-size:10px">${hint}</span>
        </div>
        <div class="text-mute" style="font-size:11px;margin-bottom:10px">${desc}</div>
        <input type="file" id="file-${key}" accept=".xlsx" style="display:none" />
        <button class="btn ghost sm" onclick="document.getElementById('file-${key}').click()" style="width:100%">Choose file…</button>
        <div id="status-${key}" style="margin-top:10px;font-size:12px;display:none"></div>
      </div>`;
  }

  // Wire each file input
  ['members','attendance','expenses','sales'].forEach(key => {
    $('#file-' + key).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const status = $('#status-' + key);
      status.style.display = 'block';
      status.innerHTML = `<div style="color:var(--text-dim)">⏳ Reading ${file.name}…</div>`;
      try {
        const parsed = await window.XlsxMini.readFile(file);
        const result = await processUpload(key, parsed, file.name);
        renderStatus(key, result, file.name);
        staged[key] = result;
        renderPreview();
      } catch (err) {
        status.innerHTML = `<div style="color:var(--red)">❌ ${escapeHtml(err.message || String(err))}</div>`;
        console.error(err);
      }
    });
  });

  async function processUpload(key, parsed, filename) {
    if (key === 'members') {
      return importMembers(parsed.sheets);
    }
    if (key === 'attendance') {
      // Need members context — use staged if present, else live state
      const members = staged.members ? staged.members.members : state.members;
      if (!members || !members.length) {
        throw new Error('Upload Members file first, or have members in DB.');
      }
      // Clone members so we don't mutate staged/live until apply
      const cloned = JSON.parse(JSON.stringify(members));
      const r = importAttendance(parsed.sheets, cloned, parsed.sheetColors);
      return { ...r, members: cloned, sheets: parsed.sheets };
    }
    if (key === 'expenses') return importExpenses(parsed.sheets);
    if (key === 'sales') return importSales(parsed.sheets);
  }

  function renderStatus(key, result, filename) {
    const status = $('#status-' + key);
    const slot = document.querySelector(`[data-slot="${key}"]`);
    if (slot) slot.style.borderColor = 'var(--green)';
    let body = `<div style="color:var(--green);font-weight:600;margin-bottom:4px">✓ ${escapeHtml(filename)}</div>`;
    if (key === 'members') {
      body += `<div>${result.members.length} members · ${result.coaches.length} coaches · ${result.summary.active} active / ${result.summary.expired} expired</div>`;
      if (result.warnings.length) body += `<div style="color:var(--accent-2);font-size:11px;margin-top:4px">${result.warnings.length} warnings (see preview)</div>`;
    } else if (key === 'attendance') {
      const monthLabel = result.monthKey ? fmtMonth(result.monthKey) : 'detected month';
      const fmtBadge = result.format === 'new' ? '<span style="font-size:10px;padding:1px 6px;background:rgba(16,185,129,.15);color:var(--green);border-radius:4px">color-coded</span>' : '<span style="font-size:10px;padding:1px 6px;background:rgba(91,141,239,.15);color:var(--blue);border-radius:4px">legacy Y/N</span>';
      body += `<div>${result.matched} student-rows matched · ${result.totalMarks} marks · ${result.unmatched.length} unmatched</div>`;
      body += `<div style="font-size:11px;color:var(--text-mute);margin-top:2px">Month: <b>${escapeHtml(monthLabel)}</b> · Sheet: <b>${escapeHtml(result.sheetName || '?')}</b> · Format: ${fmtBadge}</div>`;
    } else if (key === 'expenses') {
      body += `<div>${result.expenses.length} expenses · ${fmt(result.expenses.reduce((s,e)=>s+e.amount,0))} QAR total</div>`;
    } else if (key === 'sales') {
      body += `<div>${result.sales.length} sales records · ${fmt(result.sales.reduce((s,e)=>s+e.amount,0))} QAR total</div>`;
    }
    status.innerHTML = body;
  }

  function renderPreview() {
    const wrap = $('#import-preview');
    const stagedKeys = Object.keys(staged).filter(k => staged[k]);
    if (!stagedKeys.length) {
      wrap.innerHTML = `<div class="text-mute" style="padding:16px;text-align:center">No files uploaded yet. Drop one of the slots above to begin.</div>`;
      $('#apply-import').disabled = true;
      $('#apply-import').style.opacity = '.5';
      return;
    }
    let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">';
    if (staged.members) {
      const m = staged.members;
      html += `<div class="card" style="background:var(--surface-2)">
        <div class="card-title" style="font-size:13px">👥 Members + Coaches</div>
        <div style="font-size:12px;margin-top:6px">
          <div>${m.members.length} unique members</div>
          <div>${m.coaches.length} coaches: ${m.coaches.map(c => escapeHtml(c.name)).join(', ')}</div>
          <div>Active: <b>${m.summary.active}</b> · Expired: <b>${m.summary.expired}</b></div>
          <div style="color:var(--text-mute)">Skipped: ${m.summary.skippedSummary} summary, ${m.summary.skippedJunk} junk, ${m.summary.skippedDropped} dropped (Majed/Fethi)</div>
          ${m.warnings.length ? `<details style="margin-top:6px"><summary style="color:var(--accent-2);cursor:pointer">${m.warnings.length} warnings</summary><div style="font-size:11px;max-height:120px;overflow:auto;background:var(--bg);padding:6px;border-radius:4px;margin-top:4px">${m.warnings.map(w => escapeHtml(w)).join('<br>')}</div></details>` : ''}
        </div>
      </div>`;
    }
    if (staged.attendance) {
      const a = staged.attendance;
      html += `<div class="card" style="background:var(--surface-2)">
        <div class="card-title" style="font-size:13px">✓ Attendance</div>
        <div style="font-size:12px;margin-top:6px">
          <div>${a.matched} student-rows matched · ${a.totalMarks} Y/N marks placed</div>
          ${a.unmatched.length ? `<details style="margin-top:6px"><summary style="color:var(--accent-2);cursor:pointer">${a.unmatched.length} unmatched (not in members file)</summary><div style="font-size:11px;max-height:120px;overflow:auto;background:var(--bg);padding:6px;border-radius:4px;margin-top:4px">${a.unmatched.map(u => `${escapeHtml(u.name)} (${escapeHtml(u.activity)})`).join('<br>')}</div></details>` : ''}
        </div>
      </div>`;
    }
    if (staged.expenses) {
      const e = staged.expenses;
      const total = e.expenses.reduce((s,x)=>s+x.amount,0);
      html += `<div class="card" style="background:var(--surface-2)">
        <div class="card-title" style="font-size:13px">💸 Expenses</div>
        <div style="font-size:12px;margin-top:6px">
          <div>${e.expenses.length} records · <b>${fmt(total)} QAR</b> total</div>
        </div>
      </div>`;
    }
    if (staged.sales) {
      const s = staged.sales;
      const total = s.sales.reduce((sm,x)=>sm+x.amount,0);
      html += `<div class="card" style="background:var(--surface-2)">
        <div class="card-title" style="font-size:13px">🛒 Sales</div>
        <div style="font-size:12px;margin-top:6px">
          <div>${s.sales.length} records · <b>${fmt(total)} QAR</b> total</div>
        </div>
      </div>`;
    }
    html += '</div>';
    wrap.innerHTML = html;
    $('#apply-import').disabled = false;
    $('#apply-import').style.opacity = '1';
  }

  $('#apply-import').addEventListener('click', () => {
    const parts = [];
    if (staged.members) parts.push(`${staged.members.members.length} members + ${staged.members.coaches.length} coaches`);
    if (staged.attendance) parts.push(`${staged.attendance.totalMarks} attendance marks`);
    if (staged.expenses) parts.push(`${staged.expenses.expenses.length} expenses`);
    if (staged.sales) parts.push(`${staged.sales.sales.length} sales`);
    if (!confirm(`Apply import? This will REPLACE:\n\n${parts.map(p => '• ' + p).join('\n')}\n\nOther data (invoices, salaries) stays as-is. Continue?`)) return;

    if (staged.members) {
      state.coaches = staged.members.coaches;
      state.members = staged.members.members;
    }
    if (staged.attendance) {
      // attendance was applied to a cloned members[]; commit
      state.members = staged.attendance.members;
    }
    if (staged.expenses) state.expenses = staged.expenses.expenses;
    if (staged.sales) state.sales = staged.sales.sales;

    // Re-link invoices to new member IDs by customerName
    if (staged.members) {
      const nameToId = {};
      for (const m of state.members) nameToId[m.name.toLowerCase().trim()] = m.id;
      const coachIds = new Set(state.coaches.map(c => c.id));
      let relinked = 0;
      for (const inv of state.invoices || []) {
        const cn = (inv.customerName || '').toLowerCase().trim();
        if (cn && nameToId[cn]) { inv.customerId = nameToId[cn]; relinked++; }
        else if (inv.customerId) { inv.customerId = null; }
        // Clear orphan coachId
        if (inv.coachId && !coachIds.has(inv.coachId)) inv.coachId = null;
      }
      for (const sal of state.salaries || []) {
        if (sal.coachId && !coachIds.has(sal.coachId)) sal.coachId = null;
      }
      toast(`Imported. ${relinked} invoices re-linked to new member IDs.`, 'success');
    } else {
      toast('Imported successfully.', 'success');
    }

    save();
    // Reset staged
    Object.keys(staged).forEach(k => staged[k] = null);
    navigate('dashboard');
  });

  $('#clear-staged').addEventListener('click', () => {
    Object.keys(staged).forEach(k => staged[k] = null);
    ['members','attendance','expenses','sales'].forEach(k => {
      $('#status-' + k).style.display = 'none';
      $('#file-' + k).value = '';
      const slot = document.querySelector(`[data-slot="${k}"]`);
      if (slot) slot.style.borderColor = 'var(--border)';
    });
    renderPreview();
  });
};

// ═════════════════════════════════════════════════════════════════════
// DATA EXPORT — generate the 4 source-format Excel files from current DB
// ═════════════════════════════════════════════════════════════════════
// These exporters match the import format so the round-trip works:
// import → edit in app → export → re-import should produce identical state.

function buildMembersWorkbook() {
  // Multi-sheet, one per coach. Each sheet uses the same column order as the
  // source Club-Members.xlsx so re-importing works without re-mapping.
  const cols = ['Coach', 'Member Name En', 'Member Name Ar', 'Mobile', 'Status', 'Activity',
                'Start Date', 'Expiry Date', 'Attended Classes', 'Coach Revenue',
                'Marketing Commision', 'Paid Amount', 'Student QID', 'Birthdate', 'Level',
                'First Registration Date', 'Nationality', 'Invoice Number'];
  const sheets = [];
  for (const c of state.coaches) {
    const rows = [cols.slice()];
    // For each member enrolled with this coach, emit one row per subscription with this coach
    for (const m of state.members) {
      const subs = (m.subscriptions || []).filter(s => s.coachId === c.id);
      if (!subs.length) continue;
      for (const s of subs) {
        // Use live attendance count if available; otherwise the static field
        const liveSp = liveAttendanceCount(m, s.activity);
        const attended = liveSp.total > 0 ? liveSp.y : (s.attendedClasses || 0);
        const total = s.totalClasses || 0;
        const classesCell = total ? `${total} / ${attended}` : '';
        rows.push([
          c.name.toLowerCase(),
          m.name,
          m.nameArabic || null,
          m.phone || null,
          memberStatus(m),
          s.activity || m.sport,
          s.start || null,
          s.end || null,
          classesCell,
          attended * (s.amountPaid && total ? s.amountPaid / total : 0) || 0,
          null,    // Marketing Commision — currently unused
          s.amountPaid || null,
          m.qid || null,
          m.birthdate || null,
          m.level || null,
          m.firstRegistration || null,
          m.nationality || null,
          null,   // Invoice Number per-row (we link via customerId, not here)
        ]);
      }
    }
    // Sheet name same as import — coach name (Abdel-Salaam, Aymen, etc.)
    // Use the coach name as-is; sanitize for sheet-name rules (no /\?*[]:)
    const sheetName = c.name.replace(/[/\\?*\[\]:]/g, '-').slice(0, 31);
    sheets.push({ name: sheetName, rows });
  }
  return { sheets };
}

function buildAttendanceSheetForMonth(curMonth) {
  // One sheet for a month, in the color-coded format:
  //   A=Coach, B=Member Name En, C=Member Name Ar, D=Mobile, E=Activity, F..=DAY 1..N
  const dayCount = daysInMonth(curMonth);
  const header = [
    { v: 'Coach',          s: 'yellow' },
    { v: 'Member Name En', s: 'yellow' },
    { v: 'Member Name Ar', s: 'yellow' },
    { v: 'Mobile',         s: 'yellow' },
    { v: 'Activity',       s: 'yellow' },
  ];
  for (let d = 1; d <= dayCount; d++) header.push({ v: d === 1 ? 'DAY 1' : d, s: 'yellow' });
  const rows = [header];

  for (const m of state.members) {
    const monthData = m.dailyAttendance?.[curMonth] || {};
    const sportsWithMarks = new Set(Object.keys(monthData));
    const allSports = new Set([...sportsWithMarks, ...(m.enrollments || []).map(e => e.sport)].filter(Boolean));
    if (!allSports.size && m.sport) allSports.add(m.sport);
    for (const sport of allSports) {
      // Only emit a row in this month's sheet if there are marks for the sport
      // this month (keeps each month's tab to who actually attended that month).
      if (!sportsWithMarks.has(sport)) continue;
      const enrollment = (m.enrollments || []).find(e => e.sport === sport);
      const sub = (m.subscriptions || []).find(s => s.activity === sport);
      const coach = state.coaches.find(c => c.id === (enrollment?.coachId || sub?.coachId || m.coachId));
      const marks = monthData[sport] || {};
      const row = [
        coach ? coach.name.toLowerCase() : '',
        m.name || '',
        m.nameArabic || '',
        m.phone || null,
        (sport || '').toLowerCase(),
      ];
      for (let d = 1; d <= dayCount; d++) {
        const mark = marks[String(d)];
        if (mark === 'Y') row.push({ v: null, s: 'green' });
        else if (mark === 'N') row.push({ v: null, s: 'red' });
        else row.push(null);
      }
      rows.push(row);
    }
  }
  const [yy, mm] = curMonth.split('-');
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return { name: `${monthNames[parseInt(mm)-1]}-${yy}`, rows };
}

// Every month that has attendance marks, sorted oldest→newest (one tab each).
function attendanceMonthsWithData() {
  const months = new Set();
  for (const m of state.members) {
    for (const mk of Object.keys(m.dailyAttendance || {})) {
      const mo = m.dailyAttendance[mk];
      // count the month only if at least one sport has at least one mark
      if (mo && typeof mo === 'object' && Object.values(mo).some(sp => sp && Object.keys(sp).length)) months.add(mk);
    }
  }
  return [...months].sort();
}

function buildAttendanceWorkbook() {
  const months = attendanceMonthsWithData();
  if (!months.length) return { sheets: [buildAttendanceSheetForMonth(currentMonth())] };
  return { sheets: months.map(buildAttendanceSheetForMonth) };
}

function buildExpensesWorkbook() {
  // Single sheet for the current month. Columns: Expenses Items, price, Online/Cash, Monthly Expenses, Buying Staff/Equiments
  const curMonth = currentMonth();
  const header = ['Expenses Items', 'price', 'Online/Cash', 'Monthly Expenses', 'Buying Staff/Equiments'];
  const rows = [header];
  let monthlyTotal = 0, equipTotal = 0;
  for (const e of (state.expenses || []).filter(x => x.month === curMonth)) {
    const isEquip = e.category === 'Equipment';
    rows.push([
      e.description,
      e.amount,
      e.method === 'card' ? 'Online' : 'Cash',
      isEquip ? null : e.amount,
      isEquip ? e.amount : null,
    ]);
    if (isEquip) equipTotal += e.amount; else monthlyTotal += e.amount;
  }
  rows.push(['total', monthlyTotal + equipTotal, null, monthlyTotal, equipTotal]);
  const [yy, mm] = curMonth.split('-');
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return { sheets: [{ name: `${monthNames[parseInt(mm)-1]}-${yy}`, rows }] };
}

function buildSalesWorkbook() {
  // Single sheet for current month, matching Club_Sales.xlsx format.
  // Each transaction is flattened: one row per (sale × line item)
  const curMonth = currentMonth();
  const header = ['club sales ', 'QTY', 'Uprice', 'SALLING', 'paid', 'balance', 'AMOUNT', 'TOTAL AMOUNT', 'Invoice Number'];
  const rows = [header];
  let totalSelling = 0, totalAmount = 0;
  for (const s of (state.sales || []).filter(x => !x.month || x.month === curMonth)) {
    const inv = s.invoiceId ? state.invoices.find(i => i.id === s.invoiceId) : null;
    const ref = inv?.ref || null;
    // Multi-item: one row per line item
    for (const it of (s.items || [])) {
      rows.push([
        it.name, it.qty || null, it.unitPrice || null, null,
        null, null, null,
        it.lineTotal || null, ref,
      ]);
    }
    totalSelling += (s.paid || 0);
    totalAmount += (s.total || 0);
  }
  rows.push(['total', null, null, totalSelling || null, null, null, null, totalAmount || null, null]);
  const [yy, mm] = curMonth.split('-');
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return { sheets: [{ name: `${monthNames[parseInt(mm)-1]}-${yy}`, rows }] };
}

PAGES.dataexport = (main) => {
  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>📤 Data Export</h1>
        <div class="subtitle">Download the current database as Excel files. Format matches the import — you can re-import after editing in Excel.</div>
      </div>
    </div>

    <div class="card" style="border-left:4px solid var(--green)">
      <div style="display:flex;gap:10px;align-items:start">
        <div style="font-size:24px">💡</div>
        <div style="flex:1">
          <div style="font-weight:700;margin-bottom:4px">Round-trip safe</div>
          <div style="font-size:13px;color:var(--text-dim)">
            Each file uses the same column structure as the import. Edit it in Excel, then drop it back into Data Import — the app rebuilds from your changes. Some computed fields (member ID, status) get regenerated on import, so you don't need to manage those manually.
          </div>
        </div>
      </div>
    </div>

    <div class="row" style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      ${exportCard('members', '👥 Members', 'Multi-sheet, one tab per coach. ' + state.members.length + ' members, ' + state.coaches.length + ' coaches.')}
      ${exportCard('attendance', '✓ Attendance', 'All months · one tab each · day-by-day Y/N grid. ' + (attendanceMonthsWithData().length || 1) + ' month tab(s), ' + state.members.filter(m => m.dailyAttendance && Object.keys(m.dailyAttendance).length).length + ' members with marks.')}
      ${exportCard('expenses', '💸 Expenses', fmtMonth(currentMonth()) + ' expense ledger. ' + (state.expenses || []).filter(e => e.month === currentMonth()).length + ' items.')}
      ${exportCard('sales', '🛒 Sales', fmtMonth(currentMonth()) + ' product sales. ' + (state.sales || []).filter(s => !s.month || s.month === currentMonth()).length + ' records.')}
    </div>

    <div class="card" style="margin-top:16px;background:linear-gradient(135deg,rgba(91,141,239,.08),rgba(139,92,246,.08));border:1px solid rgba(91,141,239,.3)">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:14px">
        <div>
          <div class="card-title" style="margin-bottom:4px">📦 Export all (zip)</div>
          <div class="card-subtitle">Download all 4 files in one click as a zip archive.</div>
        </div>
        <button class="btn primary" id="export-all-btn">📦 Download All</button>
      </div>
    </div>
  `;

  function exportCard(key, title, hint) {
    return `
      <div class="card">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <div style="font-weight:700;font-size:14px">${title}</div>
        </div>
        <div class="text-mute" style="font-size:12px;margin-bottom:12px">${hint}</div>
        <button class="btn primary sm" data-export="${key}" style="width:100%">⬇ Download .xlsx</button>
      </div>`;
  }

  async function buildAndDownload(key) {
    const btn = document.querySelector(`[data-export="${key}"]`);
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = '⏳ Building…';
    try {
      let wb, filename;
      if (key === 'members')    { wb = buildMembersWorkbook();    filename = 'Club-Members.xlsx'; }
      if (key === 'attendance') { wb = buildAttendanceWorkbook(); filename = 'Club-Attendance.xlsx'; }
      if (key === 'expenses')   { wb = buildExpensesWorkbook();   filename = 'Club-Expenses.xlsx'; }
      if (key === 'sales')      { wb = buildSalesWorkbook();      filename = 'Club-Sales.xlsx'; }
      await window.XlsxMini.downloadFile(filename, wb);
      btn.textContent = '✓ Downloaded';
      setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1500);
    } catch (err) {
      console.error(err);
      btn.textContent = '❌ Error';
      toast('Export failed: ' + err.message, 'error');
      setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000);
    }
  }

  document.querySelectorAll('[data-export]').forEach(b => {
    b.addEventListener('click', () => buildAndDownload(b.dataset.export));
  });

  $('#export-all-btn').addEventListener('click', async () => {
    const btn = $('#export-all-btn');
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = '⏳ Building all…';
    try {
      const files = [];
      for (const [key, fname, build] of [
        ['members', 'Club-Members.xlsx', buildMembersWorkbook],
        ['attendance', 'Club-Attendance.xlsx', buildAttendanceWorkbook],
        ['expenses', 'Club-Expenses.xlsx', buildExpensesWorkbook],
        ['sales', 'Club-Sales.xlsx', buildSalesWorkbook],
      ]) {
        const blob = await window.XlsxMini.writeFile(build());
        files.push({ name: fname, blob });
      }
      const stamp = new Date().toISOString().slice(0, 10);
      await window.XlsxMini.downloadZip(`blackstars-export-${stamp}.zip`, files);
      btn.textContent = '✓ Downloaded';
      setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1500);
    } catch (err) {
      console.error(err);
      btn.textContent = '❌ Error';
      toast('Export failed: ' + err.message, 'error');
      setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000);
    }
  });
};

// ═════════════════════════════════════════════════════════════════════
// RENTALS — facility bookings (Football Court / Boxing Room / Swimming Pool)
// ═════════════════════════════════════════════════════════════════════
// Each rental: { id, facility, date, hours, hourlyRate, amount, method,
//                customerName, customerPhone, customerId?, customerQid?,
//                notes, invoiceId? (created automatically), createdAt }

PAGES.rentals = (main) => {
  let filter = { search: '', facility: 'all', month: 'all' };
  const pg = makePager(10);

  function applyFilter() {
    return (state.rentals || []).filter(r => {
      if (filter.search) {
        const q = filter.search.toLowerCase();
        const hay = [r.facility, r.customerName, r.customerPhone, r.customerQid, r.notes].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter.facility !== 'all' && r.facility !== filter.facility) return false;
      if (filter.month !== 'all' && (r.date || '').slice(0,7) !== filter.month) return false;
      return true;
    });
  }

  function refresh() {
    const all = applyFilter().sort((a,b) => (b.date || '').localeCompare(a.date || ''));
    const totalAmt = all.reduce((s,r) => s + (r.amount || 0), 0);
    const totalHrs = all.reduce((s,r) => s + (r.hours || 0), 0);
    const rows = paginate(all, pg);
    $('#rent-tbody').innerHTML = rows.length ? rows.map(r => `
      <tr>
        <td class="text-dim" style="white-space:nowrap">${r.date ? fmtDate(r.date) : '—'}${r.startTime ? `<div class="text-mute" style="font-size:10px">${escapeHtml(r.startTime)}</div>` : ''}</td>
        <td><span class="badge ${r.facility==='Football Court'?'green':r.facility==='Swimming Pool'?'cyan':''}">${r.facility === 'Football Court' ? '⚽' : r.facility === 'Boxing Room' ? '🥊' : '🏊'} ${escapeHtml(r.facility)}</span></td>
        <td>
          <div class="font-bold">${escapeHtml(r.customerName || '—')}</div>
          ${r.customerPhone ? `<div class="text-mute" style="font-size:11px">${phoneCell(r.customerPhone)}</div>` : ''}
        </td>
        <td class="text-right num">${r.hours || 0}h</td>
        <td class="text-right num text-dim">${fmt(r.hourlyRate || 0)}/hr</td>
        <td class="text-right num font-bold">${fmt(r.amount || 0)}</td>
        <td><span class="badge ${r.method === 'card' ? 'blue' : ''}">${r.method || 'cash'}</span></td>
        <td class="text-mute" style="font-size:11px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(r.notes || '')}</td>
        <td class="text-right" style="white-space:nowrap">
          ${r.invoiceId ? `<button class="btn ghost sm" onclick="printInvoicePDF(${r.invoiceId})" title="Linked invoice PDF">📄</button>` : ''}
          ${r.customerRentalId ? `<button class="btn ghost sm" onclick="viewRentalCustomerHistory(${r.customerRentalId})" title="See all bookings for this customer">📜</button>` : ''}
          <button class="btn ghost sm" onclick="editRental(${r.id})" title="Edit">✏️</button>
          <button class="btn ghost sm" onclick="deleteRental(${r.id})" title="Delete">🗑</button>
        </td>
      </tr>`).join('') : `<tr><td colspan="9" class="empty"><div class="empty-icon">🏟</div>No rentals match the filter</td></tr>`;
    $('#rent-count').textContent = `${all.length} booking${all.length===1?'':'s'} · ${totalHrs}h · ${fmt(totalAmt)} QAR`;
    renderPagination('rent-pagination', pg, all.length, () => refresh());
  }

  // Months present in rentals (for month filter)
  const monthsInRentals = [...new Set((state.rentals || []).map(r => (r.date || '').slice(0,7)).filter(Boolean))].sort().reverse();

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>🏟 Rentals</h1>
        <div class="subtitle"><span id="rent-count">Loading...</span></div>
      </div>
      <div class="topbar-actions">
        <button class="btn ghost" id="rentals-customers" title="View all rental customers with booking history">👥 Customers (${(state.rentalCustomers || []).length})</button>
        <button class="btn ghost" id="rentals-rates" title="Edit default hourly rates per facility">⚙ Rates</button>
        <button class="btn ghost" id="rentals-export" title="Export filtered rentals to CSV">📥 Export</button>
        <button class="btn primary" id="rentals-add">+ New Booking</button>
      </div>
    </div>

    <!-- Quick stats by facility this month -->
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
      ${FACILITIES.map(f => {
        const curMonth = currentMonth();
        const thisMonth = (state.rentals || []).filter(r => r.facility === f && (r.date || '').slice(0,7) === curMonth);
        const amt = thisMonth.reduce((s,r) => s+(r.amount||0), 0);
        const hrs = thisMonth.reduce((s,r) => s+(r.hours||0), 0);
        const icon = f === 'Football Court' ? '⚽' : f === 'Boxing Room' ? '🥊' : '🏊';
        const color = f === 'Football Court' ? 'green' : f === 'Boxing Room' ? 'orange' : 'cyan';
        const monthShort = new Date(curMonth + '-01T00:00:00').toLocaleString('en', { month: 'short' });
        return `<div class="kpi ${color}">
          <div class="kpi-label">${icon} ${escapeHtml(f)} — ${monthShort}</div>
          <div class="kpi-value">${fmt(amt)}</div>
          <div class="kpi-sub">${thisMonth.length} booking${thisMonth.length===1?'':'s'} · ${hrs}h · ${fmt(state.settings.facilityRates[f] || 0)}/hr</div>
        </div>`;
      }).join('')}
    </div>

    <div class="card">
      <div class="filter-bar">
        <div class="search"><input id="rent-search" type="text" placeholder="Search customer name, mobile, notes..." /></div>
        <select id="rent-facility" class="btn ghost">
          <option value="all">All facilities</option>
          ${FACILITIES.map(f => `<option>${escapeHtml(f)}</option>`).join('')}
        </select>
        <select id="rent-month" class="btn ghost">
          <option value="all">All months</option>
          ${monthsInRentals.map(m => `<option value="${m}">${fmtMonth(m)}</option>`).join('')}
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date / Time</th>
              <th>Facility</th>
              <th>Customer</th>
              <th class="text-right">Hours</th>
              <th class="text-right">Rate</th>
              <th class="text-right">Amount</th>
              <th>Method</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="rent-tbody"></tbody>
        </table>
      </div>
      <div id="rent-pagination"></div>
    </div>
  `;

  $('#rent-search').addEventListener('input', e => { filter.search = e.target.value; pg.page = 1; refresh(); });
  $('#rent-facility').addEventListener('change', e => { filter.facility = e.target.value; pg.page = 1; refresh(); });
  $('#rent-month').addEventListener('change', e => { filter.month = e.target.value; pg.page = 1; refresh(); });
  $('#rentals-add').addEventListener('click', () => addRental(refresh));
  $('#rentals-rates').addEventListener('click', editFacilityRates);
  $('#rentals-customers').addEventListener('click', () => showRentalCustomersList());
  $('#rentals-export').addEventListener('click', () => {
    // Export the CURRENT filtered set (not the whole table)
    const all = applyFilter().sort((a,b) => (b.date || '').localeCompare(a.date || ''));
    if (!all.length) { toast('No rentals to export', 'error'); return; }
    const rows = [['Date','Time','Facility','Customer','Mobile','QID','Hours','Rate/hr','Amount','Method','Notes','Invoice Ref']];
    for (const r of all) {
      const inv = r.invoiceId ? (state.invoices || []).find(i => i.id === r.invoiceId) : null;
      rows.push([
        r.date || '',
        r.startTime || '',
        r.facility || '',
        r.customerName || '',
        r.customerPhone || '',
        r.customerQid || '',
        r.hours || 0,
        r.hourlyRate || 0,
        r.amount || 0,
        r.method || '',
        r.notes || '',
        inv ? (inv.ref || `INV${inv.id}`) : '',
      ]);
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    downloadFile(`rentals-${TODAY}.csv`, csv, 'text/csv');
    toast(`Exported ${all.length} rental${all.length === 1 ? '' : 's'}`);
  });

  refresh();
};

// ─── Add/Edit Rental modal ────────────────────────────────────────────
function rentalFormHtml(r) {
  const facOpts = FACILITIES.map(f => `<option ${r.facility === f ? 'selected' : ''}>${escapeHtml(f)}</option>`).join('');
  return `
    <div class="form-row">
      <div class="field"><label>Facility</label><select id="r-facility">${facOpts}</select></div>
      <div class="field"><label>Date <span style="color:var(--accent)">*</span></label><input type="date" id="r-date" value="${r.date || TODAY}" min="${r.date && r.date < TODAY ? r.date : TODAY}" /></div>
      <div class="field"><label>Start time <span style="color:var(--accent)">*</span></label><input type="time" id="r-time" value="${r.startTime || ''}" /></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Hours</label><input type="number" min="0.5" step="0.5" id="r-hours" value="${r.hours ?? 1}" /></div>
      <div class="field"><label>Hourly rate (QAR)</label><input type="number" min="0" step="1" id="r-rate" value="${r.hourlyRate ?? ''}" placeholder="auto from facility default" /></div>
      <div class="field"><label>Total amount</label><input type="number" id="r-amount" value="${r.amount ?? ''}" readonly style="background:var(--surface-2);font-weight:700" /></div>
    </div>
    <div style="margin-top:6px;padding:12px;background:rgba(91,141,239,.06);border:1px solid rgba(91,141,239,.22);border-radius:8px">
      <div style="font-size:11px;color:var(--blue);text-transform:uppercase;letter-spacing:.6px;font-weight:600;margin-bottom:8px">👤 Customer</div>
      <div class="form-row">
        <div class="field" style="position:relative">
          <label>Search existing or type new <span class="text-mute" style="font-size:10px">(name or mobile)</span></label>
          <input type="text" id="r-cust-search" autocomplete="off" placeholder="Start typing name or mobile…" value="${r.customerName ? escapeHtml(r.customerName) : ''}" />
          <div id="r-cust-results" style="display:none;position:absolute;left:0;right:0;top:100%;z-index:50;max-height:200px;overflow:auto;background:var(--surface,#1b2130);border:1px solid var(--border,#2a3142);border-radius:8px;margin-top:2px;box-shadow:0 8px 24px rgba(0,0,0,.4)"></div>
          <input type="hidden" id="r-cust-id" value="${r.customerRentalId || ''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="field"><label>Customer name *</label><input type="text" id="r-name" value="${escapeHtml(r.customerName || '')}" placeholder="Required" /></div>
        ${phoneInputHtml('r-phone', r.customerPhone, { label: 'Mobile' })}
      </div>
      <div class="form-row">
        <div class="field"><label>QID (optional)</label><input type="text" id="r-qid" value="${escapeHtml(r.customerQid || '')}" /></div>
        <div class="field"><label>&nbsp;</label><div id="r-cust-hint" class="text-mute" style="font-size:11px;padding-top:8px">${(state.members || []).length + (state.rentalCustomers || []).length} known people (members + rental customers). Type name, mobile, or QID.</div></div>
      </div>
    </div>

    <div class="form-row">
      <div class="field"><label>Method</label><select id="r-method"><option value="cash" ${r.method==='cash'?'selected':''}>Cash</option><option value="card" ${r.method==='card'?'selected':''}>Card</option></select></div>
      <div class="field" style="flex:2"><label>Notes</label><input type="text" id="r-notes" value="${escapeHtml(r.notes || '')}" placeholder="e.g. Birthday party, weekly booking, etc." /></div>
    </div>
    <div style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:8px;padding:10px;margin-top:8px;font-size:12px">
      💡 An invoice will be created automatically when this booking is saved.
    </div>
  `;
}

function wireRentalForm() {
  // Auto-fill rate from facility default
  const facSel = $('#r-facility');
  const rateInp = $('#r-rate');
  const hoursInp = $('#r-hours');
  const amtInp = $('#r-amount');

  function autoFillRate() {
    if (!rateInp.value || rateInp.dataset.auto !== 'manual') {
      rateInp.value = state.settings.facilityRates[facSel.value] || 0;
      rateInp.dataset.auto = 'default';
    }
    recalc();
  }
  function recalc() {
    const hrs = parseFloat(hoursInp.value) || 0;
    const rate = parseFloat(rateInp.value) || 0;
    amtInp.value = (hrs * rate).toFixed(2).replace(/\.00$/, '');
  }

  facSel.addEventListener('change', autoFillRate);
  hoursInp.addEventListener('input', recalc);
  rateInp.addEventListener('input', () => { rateInp.dataset.auto = 'manual'; recalc(); });

  // ─── Rental-customer searchable picker ─────────────────────────────
  // Searches by name OR mobile (case-insensitive substring). Click a result
  // to autofill name/mobile/QID. Free typing is allowed — the booking will
  // create a new customer when saved.
  const searchInp = $('#r-cust-search');
  const resultsBox = $('#r-cust-results');
  const nameInp = $('#r-name');
  // The phone is now a two-field input (code + digits) — see phoneInputHtml.
  // Use a small helper to set/clear it from existing customer picker.
  function setPhone(phone) {
    const { code, digits } = parseStoredPhone(phone || '');
    const codeEl = document.getElementById('r-phone-code');
    const digitsEl = document.getElementById('r-phone-digits');
    if (codeEl) codeEl.value = code;
    if (digitsEl) digitsEl.value = digits;
  }
  function clearPhone() { setPhone(''); }
  const qidInp = $('#r-qid');
  const hiddenId = $('#r-cust-id');
  const hintEl = $('#r-cust-hint');

  function renderResults(q) {
    const ql = (q || '').toLowerCase().trim();
    // Build a unified list: members (tagged 'M:id') + rental customers (tagged 'R:id')
    const rentalCusts = (state.rentalCustomers || []).map(c => ({
      kind: 'R', id: c.id, name: c.name || '', phone: c.phone || '', qid: c.qid || '',
      ref: c,
    }));
    const memberCusts = (state.members || []).map(m => ({
      kind: 'M', id: m.id, name: m.name || '', phone: m.phone || '', qid: m.qid || '',
      ref: m,
    }));
    const all = [...memberCusts, ...rentalCusts];

    let filtered = ql
      ? all.filter(c =>
          c.name.toLowerCase().includes(ql) ||
          c.phone.toLowerCase().includes(ql) ||
          (c.qid || '').toLowerCase().includes(ql))
      : all.slice(0, 20); // show first 20 if no query

    // De-dupe: if a rental customer shares the SAME mobile as a member, drop the rental row (member wins)
    const memberPhones = new Set(memberCusts.map(m => m.phone).filter(Boolean));
    filtered = filtered.filter(c => !(c.kind === 'R' && c.phone && memberPhones.has(c.phone)));

    // Sort: members first, then rental customers, alphabetically by name within each
    filtered.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'M' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    // Count bookings (for the right-side badge on rental customers)
    const bookingCounts = {};
    for (const r of (state.rentals || [])) {
      const k = r.customerRentalId || (r.customerPhone || '') + '|' + (r.customerName || '');
      bookingCounts[k] = (bookingCounts[k] || 0) + 1;
    }
    // For members, also count rentals matched by phone/QID
    const memberRentalCounts = {};
    for (const r of (state.rentals || [])) {
      for (const m of (state.members || [])) {
        if ((m.phone && r.customerPhone === m.phone) || (m.qid && r.customerQid === m.qid)) {
          memberRentalCounts[m.id] = (memberRentalCounts[m.id] || 0) + 1;
        }
      }
    }

    filtered = filtered.slice(0, 15);
    if (!filtered.length) {
      resultsBox.innerHTML = `<div style="padding:10px;font-size:12px;color:var(--text-mute)">No match — fill the fields below to add as new.</div>`;
      resultsBox.style.display = 'block';
      return;
    }
    resultsBox.innerHTML = filtered.map(c => {
      const isMember = c.kind === 'M';
      const n = isMember ? (memberRentalCounts[c.id] || 0) : (bookingCounts[c.id] || 0);
      const badge = isMember
        ? '<span class="badge active" style="font-size:9px;padding:1px 6px">🥋 MEMBER</span>'
        : '<span class="badge" style="font-size:9px;padding:1px 6px;background:var(--surface-2);color:var(--text-mute)">RENTAL</span>';
      return `<div class="rcust-item" data-rckind="${c.kind}" data-rcid="${c.id}" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:8px;align-items:center">
        <div style="flex:1;min-width:0">
          <div style="display:flex;gap:6px;align-items:center"><span class="font-bold" style="font-size:13px">${escapeHtml(c.name)}</span> ${badge}</div>
          <div class="text-mute" style="font-size:11px">${c.phone ? phoneCell(c.phone, { stop: false }) : '<span class="text-mute">—</span>'}${c.qid ? ' · QID: ' + escapeHtml(c.qid) : ''}</div>
        </div>
        <div class="text-mute" style="font-size:10px;white-space:nowrap">${n} booking${n===1?'':'s'}</div>
      </div>`;
    }).join('');
    resultsBox.style.display = 'block';
    resultsBox.querySelectorAll('.rcust-item').forEach(el => {
      el.addEventListener('mousedown', (e) => {        // mousedown so it fires before search input loses focus
        e.preventDefault();
        const kind = el.dataset.rckind;
        const id = parseInt(el.dataset.rcid);
        let name, phone, qid, recordId, n;
        if (kind === 'M') {
          const m = state.members.find(x => x.id === id);
          if (!m) return;
          name = m.name; phone = m.phone || ''; qid = m.qid || '';
          recordId = ''; // members aren't stored in rentalCustomers; we link by phone
          n = memberRentalCounts[m.id] || 0;
        } else {
          const c = state.rentalCustomers.find(x => x.id === id);
          if (!c) return;
          name = c.name; phone = c.phone || ''; qid = c.qid || '';
          recordId = c.id;
          n = bookingCounts[c.id] || 0;
        }
        hiddenId.value = recordId;
        nameInp.value = name;
        setPhone(phone);
        qidInp.value = qid;
        searchInp.value = name + (phone ? ' · ' + phone : '');
        resultsBox.style.display = 'none';
        if (hintEl) {
          const tag = kind === 'M' ? '🥋 Member' : 'Existing rental customer';
          hintEl.innerHTML = `✓ Using ${tag}${kind === 'R' ? ` · <a href="javascript:void(0)" id="r-cust-history" style="color:var(--blue)">view ${n} booking${n===1?'':'s'}</a>` : ''} · <a href="javascript:void(0)" id="r-cust-clear" style="color:var(--blue)">change</a>`;
          const clearLink = document.getElementById('r-cust-clear');
          if (clearLink) clearLink.addEventListener('click', () => {
            hiddenId.value = ''; nameInp.value = ''; clearPhone(); qidInp.value = '';
            searchInp.value = ''; searchInp.focus();
            const total = (state.members || []).length + (state.rentalCustomers || []).length;
            hintEl.textContent = `${total} known people (members + rental customers). Type to filter, or fill in a new one below.`;
          });
          const histLink = document.getElementById('r-cust-history');
          if (histLink) histLink.addEventListener('click', () => viewRentalCustomerHistory(id));
        }
      });
    });
  }

  searchInp.addEventListener('focus', () => renderResults(searchInp.value));
  searchInp.addEventListener('input', () => {
    hiddenId.value = '';   // typing clears any previous selection
    renderResults(searchInp.value);
  });
  searchInp.addEventListener('blur', () => {
    // Delay so click-on-result fires first
    setTimeout(() => { resultsBox.style.display = 'none'; }, 150);
  });

  // Initial fill if rate is blank
  if (!rateInp.value) autoFillRate();
  recalc();
}

function addRental(onDone) {
  showModal({
    title: '🏟 New Rental Booking',
    body: rentalFormHtml({ date: TODAY, hours: 1, method: 'cash' }),
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: '💾 Save & Create Invoice', class: 'btn primary', onclick: () => saveRental(null, onDone) },
    ],
  });
  setTimeout(wireRentalForm, 50);
}

window.editRental = function(id) {
  const r = (state.rentals || []).find(x => x.id === id);
  if (!r) return;
  showModal({
    title: '🏟 Edit Rental Booking',
    body: rentalFormHtml(r),
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: '💾 Save', class: 'btn primary', onclick: () => saveRental(id) },
    ],
  });
  setTimeout(wireRentalForm, 50);
};

function showRentalCustomersList() {
  const customers = (state.rentalCustomers || []).slice();
  // Compute stats per customer
  const stats = {};
  for (const r of (state.rentals || [])) {
    const id = r.customerRentalId;
    if (!id) continue;
    if (!stats[id]) stats[id] = { bookings: 0, hours: 0, amount: 0, lastDate: null };
    stats[id].bookings++;
    stats[id].hours += r.hours || 0;
    stats[id].amount += r.amount || 0;
    if (!stats[id].lastDate || (r.date || '') > stats[id].lastDate) stats[id].lastDate = r.date;
  }
  // Sort by total revenue (most-valued first), then by last activity
  customers.sort((a, b) => {
    const sa = stats[a.id] || { amount: 0, lastDate: '' };
    const sb = stats[b.id] || { amount: 0, lastDate: '' };
    if (sb.amount !== sa.amount) return sb.amount - sa.amount;
    return (sb.lastDate || '').localeCompare(sa.lastDate || '');
  });
  const totalRev = customers.reduce((s, c) => s + ((stats[c.id]?.amount) || 0), 0);

  showModal({
    title: `👥 Rental Customers (${customers.length})`,
    body: `
      <div style="margin-bottom:12px">
        <input id="rcust-search" type="text" placeholder="Filter by name or mobile..." style="width:100%" />
      </div>
      <div class="text-mute" style="font-size:12px;margin-bottom:8px">
        ${customers.length} customer${customers.length===1?'':'s'} · ${fmt(totalRev)} QAR total revenue
      </div>
      ${customers.length ? `
      <div class="table-wrap" style="max-height:400px;overflow-y:auto">
        <table>
          <thead><tr><th>Customer</th><th>Mobile</th><th class="text-right">Bookings</th><th class="text-right">Hours</th><th class="text-right">Total Paid</th><th>Last Visit</th><th></th></tr></thead>
          <tbody id="rcust-tbody">
            ${customers.map(c => {
              const s = stats[c.id] || { bookings: 0, hours: 0, amount: 0, lastDate: null };
              return `<tr data-name="${escapeHtml(c.name.toLowerCase())}" data-phone="${escapeHtml((c.phone||'').toLowerCase())}">
                <td>
                  <div class="font-bold" style="font-size:13px">${escapeHtml(c.name)}</div>
                  ${c.qid ? `<div class="text-mute" style="font-size:10px">QID: ${escapeHtml(c.qid)}</div>` : ''}
                </td>
                <td style="font-size:12px">${escapeHtml(c.phone || '—')}</td>
                <td class="text-right num">${s.bookings}</td>
                <td class="text-right num">${s.hours}h</td>
                <td class="text-right num font-bold">${fmt(s.amount)}</td>
                <td class="text-dim" style="font-size:11px;white-space:nowrap">${s.lastDate ? fmtDate(s.lastDate) : '—'}</td>
                <td class="text-right">
                  <button class="btn ghost sm" onclick="viewRentalCustomerHistory(${c.id})" title="View history">📜</button>
                  <button class="btn ghost sm" onclick="editRentalCustomer(${c.id})" title="Edit">✏️</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      ` : `<div class="empty" style="padding:30px"><div class="empty-icon">👥</div>No rental customers yet. Add your first booking to start tracking.</div>`}
    `,
    actions: [{ label: 'Close', class: 'btn primary', onclick: closeModal }],
  });
  // Wire search
  setTimeout(() => {
    const inp = document.getElementById('rcust-search');
    if (inp) {
      inp.addEventListener('input', () => {
        const q = inp.value.toLowerCase().trim();
        document.querySelectorAll('#rcust-tbody tr').forEach(tr => {
          const match = !q || tr.dataset.name.includes(q) || tr.dataset.phone.includes(q);
          tr.style.display = match ? '' : 'none';
        });
      });
      inp.focus();
    }
  }, 50);
}

window.editRentalCustomer = function(rcustId) {
  const c = (state.rentalCustomers || []).find(x => x.id === rcustId);
  if (!c) return;
  showModal({
    title: `✏️ Edit Customer — ${escapeHtml(c.name)}`,
    body: `
      <div class="form-row">
        <div class="field"><label>Name *</label><input type="text" id="ec-name" value="${escapeHtml(c.name)}" /></div>
        ${phoneInputHtml('ec-phone', c.phone, { label: 'Mobile' })}
      </div>
      <div class="form-row">
        <div class="field"><label>QID (optional)</label><input type="text" id="ec-qid" value="${escapeHtml(c.qid || '')}" /></div>
        <div class="field"><label>Notes</label><input type="text" id="ec-notes" value="${escapeHtml(c.notes || '')}" /></div>
      </div>
      <div style="background:rgba(91,141,239,.08);border:1px solid rgba(91,141,239,.25);border-radius:8px;padding:10px;margin-top:10px;font-size:12px">
        💡 Name/mobile changes will propagate to all linked rentals via live lookup.
      </div>
    `,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: '💾 Save', class: 'btn primary', onclick: () => {
        const name = $('#ec-name').value.trim();
        const phoneInput = readPhoneInput('ec-phone');
        if (!name) { toast('Name required', 'error'); return; }
        if (!phoneInput.valid) { toast(phoneInput.error || 'Mobile invalid', 'error'); return; }
        c.name = name;
        c.phone = phoneInput.phone;
        c.qid = $('#ec-qid').value.trim() || null;
        c.notes = $('#ec-notes').value.trim() || null;
        // Propagate to existing rentals (so search/display reflects the change)
        for (const r of (state.rentals || [])) {
          if (r.customerRentalId === c.id) {
            r.customerName = c.name;
            r.customerPhone = c.phone;
            if (c.qid) r.customerQid = c.qid;
          }
        }
        save();
        closeModal();
        render();
        toast('Customer updated');
      }},
    ],
  });
};

window.viewRentalCustomerHistory = function(rcustId) {
  const c = (state.rentalCustomers || []).find(x => x.id === rcustId);
  if (!c) return;
  const bookings = (state.rentals || [])
    .filter(r => r.customerRentalId === rcustId
              || (c.phone && r.customerPhone === c.phone)
              || (c.qid && r.customerQid === c.qid))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const totalHrs = bookings.reduce((s, r) => s + (r.hours || 0), 0);
  const totalAmt = bookings.reduce((s, r) => s + (r.amount || 0), 0);
  const byFacility = {};
  for (const r of bookings) byFacility[r.facility] = (byFacility[r.facility] || 0) + 1;

  showModal({
    title: `Rental History — ${escapeHtml(c.name)}`,
    body: `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
        <div class="avatar" style="width:44px;height:44px;background:linear-gradient(135deg,var(--green),var(--cyan))">${initials(c.name)}</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:15px">${escapeHtml(c.name)}</div>
          <div class="text-dim" style="font-size:12px">📱 ${escapeHtml(c.phone || '—')}${c.qid ? ' · QID: ' + escapeHtml(c.qid) : ''}</div>
        </div>
        <div class="text-right">
          <div class="text-mute" style="font-size:11px">Total billed</div>
          <div class="font-bold" style="font-size:18px">${fmt(totalAmt)} QAR</div>
        </div>
      </div>

      <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
        <div class="kpi" style="padding:10px"><div class="kpi-label" style="font-size:10px">Bookings</div><div class="kpi-value" style="font-size:18px">${bookings.length}</div></div>
        <div class="kpi blue" style="padding:10px"><div class="kpi-label" style="font-size:10px">Total hours</div><div class="kpi-value" style="font-size:18px">${totalHrs}h</div></div>
        <div class="kpi green" style="padding:10px"><div class="kpi-label" style="font-size:10px">Avg / booking</div><div class="kpi-value" style="font-size:18px">${bookings.length ? fmt(totalAmt / bookings.length) : 0}</div></div>
      </div>

      ${Object.keys(byFacility).length ? `
      <div style="margin-bottom:10px">
        <div class="text-mute" style="font-size:11px;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">Facilities used</div>
        ${Object.entries(byFacility).map(([f, n]) => {
          const icon = f === 'Football Court' ? '⚽' : f === 'Boxing Room' ? '🥊' : '🏊';
          return `<span class="badge" style="margin-right:6px">${icon} ${escapeHtml(f)} × ${n}</span>`;
        }).join('')}
      </div>
      ` : ''}

      ${bookings.length ? `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Facility</th><th class="text-right">Hours</th><th class="text-right">Amount</th><th>Method</th><th>Notes</th><th></th></tr></thead>
          <tbody>
            ${bookings.map(r => {
              const icon = r.facility === 'Football Court' ? '⚽' : r.facility === 'Boxing Room' ? '🥊' : '🏊';
              return `<tr>
                <td class="text-dim" style="white-space:nowrap;font-size:11px">${fmtDate(r.date)}${r.startTime ? '<div class="text-mute" style="font-size:10px">' + escapeHtml(r.startTime) + '</div>' : ''}</td>
                <td>${icon} ${escapeHtml(r.facility)}</td>
                <td class="text-right num">${r.hours || 0}h</td>
                <td class="text-right num font-bold">${fmt(r.amount || 0)}</td>
                <td><span class="badge ${r.method === 'card' ? 'blue' : ''}">${r.method || 'cash'}</span></td>
                <td class="text-mute" style="font-size:11px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(r.notes || '')}</td>
                <td class="text-right">${r.invoiceId ? `<button class="btn ghost sm" onclick="closeModal();printInvoicePDF(${r.invoiceId})" title="Invoice PDF">📄</button>` : ''}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      ` : `<div class="empty" style="padding:30px"><div class="empty-icon">🏟</div>No bookings yet for this customer.</div>`}
    `,
    actions: [{ label: 'Close', class: 'btn primary', onclick: closeModal }],
  });
};

window.deleteRental = function(id) {
  const r = (state.rentals || []).find(x => x.id === id);
  if (!r) return;
  if (!confirm(`Delete the ${r.facility} booking for ${r.customerName} on ${fmtDate(r.date)}?\n\nThe linked invoice (if any) will also be deleted.`)) return;
  // Drop linked invoice
  if (r.invoiceId) state.invoices = state.invoices.filter(i => i.id !== r.invoiceId);
  state.rentals = state.rentals.filter(x => x.id !== id);
  save();
  render();
  toast('Booking deleted');
};

function saveRental(existingId, onDone) {
  const name = $('#r-name').value.trim();
  const phoneInput = readPhoneInput('r-phone');
  const phone = phoneInput.phone;
  if (!name) { toast('Customer name required', 'error'); $('#r-name')?.focus(); return; }
  if (!phoneInput.valid) {
    toast(phoneInput.error || 'Mobile number is invalid', 'error');
    document.getElementById('r-phone-digits')?.focus();
    return;
  }
  const facility = $('#r-facility').value;
  const date = $('#r-date').value || TODAY;
  const startTime = $('#r-time').value || null;
  const hours = parseFloat($('#r-hours').value) || 0;
  const hourlyRate = parseFloat($('#r-rate').value) || 0;
  const amount = parseFloat($('#r-amount').value) || (hours * hourlyRate);
  if (hours <= 0 || hourlyRate <= 0) { toast('Hours and rate must be > 0', 'error'); return; }
  // Start time is mandatory — it's what lets us detect double-bookings.
  if (!startTime) { toast('Start time is required (it prevents double-booking the facility)', 'error'); $('#r-time')?.focus(); return; }
  // No booking a date in the past (new bookings).
  if (!existingId && date < TODAY) { toast('You can\u2019t book a date in the past', 'error'); $('#r-date')?.focus(); return; }
  // No overlapping booking of the same facility on the same date.
  const toMin = t => { const [h, mm] = String(t || '').split(':').map(Number); return (h || 0) * 60 + (mm || 0); };
  const startMin = toMin(startTime), endMin = startMin + Math.round(hours * 60);
  const clash = (state.rentals || []).find(x => x.id !== existingId && x.facility === facility && x.date === date && x.startTime && (() => {
    const s2 = toMin(x.startTime), e2 = s2 + Math.round((x.hours || 0) * 60);
    return startMin < e2 && s2 < endMin;
  })());
  if (clash) { toast(`${facility} is already booked at ${clash.startTime} on ${fmtDate(date)} — overlapping bookings aren\u2019t allowed.`, 'error'); return; }
  const qid = $('#r-qid').value.trim() || null;
  const method = $('#r-method').value || 'cash';
  const notes = $('#r-notes').value.trim() || null;

  // CHECK FIRST: does this phone match an existing MEMBER?
  // If yes, we don't create a duplicate rentalCustomers entry — we link the
  // rental's customerId to the member instead, so all their history is unified.
  const matchedMember = (state.members || []).find(m => m.phone && m.phone === phone);
  // Don't book facilities against an archived member.
  if (matchedMember && matchedMember.deleted) {
    toast('That mobile belongs to an archived member — reactivate them, or use a different customer.', 'error');
    return;
  }

  let rcust = null;
  if (!matchedMember) {
    // Track / update rental customer.
    // 1) If picker selected a known customer (hidden field), use that ID.
    // 2) Otherwise dedup by phone (preferred — names can be inconsistently spelled)
    //    falling back to name+phone for legacy entries.
    const pickedIdEl = document.getElementById('r-cust-id');
    const pickedId = pickedIdEl ? parseInt(pickedIdEl.value) : null;
    if (pickedId) {
      rcust = (state.rentalCustomers || []).find(c => c.id === pickedId);
    }
    if (!rcust) {
      // Match by phone first — most reliable identifier
      rcust = (state.rentalCustomers || []).find(c => (c.phone || '') === phone && phone);
    }
    if (!rcust) {
      // Match by name+phone for older records
      rcust = (state.rentalCustomers || []).find(c =>
        c.name.toLowerCase() === name.toLowerCase() && (c.phone || '') === phone);
    }
    if (!rcust) {
      // Create new
      rcust = { id: nextId(state.rentalCustomers || []), name, phone, qid: qid || null, notes: null };
      state.rentalCustomers.push(rcust);
    } else {
      // Update existing with anything new
      if (name && rcust.name !== name) rcust.name = name;
      if (phone && rcust.phone !== phone) rcust.phone = phone;
      if (qid && !rcust.qid) rcust.qid = qid;
    }
  }

  const facilityIcon = facility === 'Football Court' ? '🏟' : facility === 'Boxing Room' ? '🥊' : '🏊';
  const desc = `${facilityIcon} ${facility} rental — ${hours}h${startTime ? ' @ ' + startTime : ''} — ${name}`;
  const month = date.slice(0, 7);

  if (existingId) {
    // Update existing
    const idx = state.rentals.findIndex(x => x.id === existingId);
    const old = state.rentals[idx];
    state.rentals[idx] = {
      ...old, facility, date, startTime, hours, hourlyRate, amount,
      customerName: name, customerPhone: phone, customerQid: qid,
      customerRentalId: rcust ? rcust.id : null,
      memberId: matchedMember ? matchedMember.id : (old.memberId ?? null),
      method, notes,
    };
    // Update linked invoice
    if (old.invoiceId) {
      const inv = state.invoices.find(i => i.id === old.invoiceId);
      if (inv) {
        inv.date = date; inv.description = desc; inv.amount = amount;
        inv.method = method; inv.month = month; inv.sport = facility;
        inv.customerName = name;
        inv.customerId = matchedMember ? matchedMember.id : null;
        inv.category = facility === 'Boxing Room' ? 'Boxing Room' : 'Court Rental';
      }
    }
    save();
    closeModal();
    toast('Booking updated');
    if (onDone) onDone(); else render();
    return;
  }

  // Create rental + linked invoice
  const rentalId = nextId(state.rentals || []);
  const ref = nextInvoiceRef();
  const newInv = {
    id: nextId(state.invoices),
    date, description: desc, amount, method, month, ref,
    category: facility === 'Boxing Room' ? 'Boxing Room' : 'Court Rental',
    activityType: 'rental',
    sport: facility,
    coach: null, coachId: null,
    customerId: matchedMember ? matchedMember.id : null,  // link to member if same phone
    customerName: name,
    rentalId,                          // back-reference to the rental
  };
  state.invoices.push(newInv);

  state.rentals.push({
    id: rentalId,
    facility, date, startTime, hours, hourlyRate, amount,
    customerName: name, customerPhone: phone, customerQid: qid,
    customerRentalId: rcust ? rcust.id : null,
    memberId: matchedMember ? matchedMember.id : null,    // link to member if same phone
    method, notes,
    invoiceId: newInv.id,
    createdAt: new Date().toISOString(),
  });

  save();
  closeModal();
  const linkBadge = matchedMember ? ` · linked to member ${matchedMember.name}` : '';
  toast(`Booking saved · invoice ${ref} created${linkBadge}`, 'success');
  if (onDone) onDone(); else render();
}

// Edit default hourly rates per facility
function editFacilityRates() {
  showModal({
    title: '⚙ Facility Rates',
    body: `
      <div class="text-mute" style="font-size:12px;margin-bottom:12px">Default hourly rate auto-fills when creating a new booking. You can still override per booking.</div>
      ${FACILITIES.map(f => `
        <div class="form-row" style="margin-bottom:8px">
          <div class="field"><label>${f === 'Football Court' ? '⚽' : f === 'Boxing Room' ? '🥊' : '🏊'} ${escapeHtml(f)}</label>
            <input type="number" min="0" step="1" id="fr-${f.replace(/\s+/g,'-')}" value="${state.settings.facilityRates[f] || 0}" />
          </div>
        </div>
      `).join('')}
    `,
    actions: [
      { label: 'Cancel', class: 'btn ghost', onclick: closeModal },
      { label: '💾 Save', class: 'btn primary', onclick: () => {
        for (const f of FACILITIES) {
          const v = parseFloat(document.getElementById('fr-' + f.replace(/\s+/g,'-')).value) || 0;
          state.settings.facilityRates[f] = v;
        }
        save();
        closeModal();
        toast('Facility rates saved');
        render();
      }},
    ],
  });
}
