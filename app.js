/* ═══════════════════════════════════════════════════════════════════════
   Black Stars CRM — Self-contained vanilla JS app
   Runs entirely in the browser. No build step. No server. No internet.
   ═══════════════════════════════════════════════════════════════════════ */

// ─── State ──────────────────────────────────────────────────────────
const LS_KEY = 'blackstars-crm-v1';
const LS_VERSION_KEY = 'blackstars-crm-dataver';

// ─── Versioning (two-track) ─────────────────────────────────────────
// APP_VERSION  — display label for the running code. Bumps on every release.
//                CHANGING THIS DOES NOT TOUCH USER DATA.
// SCHEMA_VERSION — only bump when state.* shape actually changes (e.g. adding
//                a required field that needs back-filling on existing data).
//                A bump here triggers the runMigrations() pipeline which
//                MUTATES existing data in place rather than wiping it.
const APP_VERSION = '4.59.0';
const SCHEMA_VERSION = 8;       // v8: Summer Camp 2w/3w tiers added

// Legacy: kept for the version-bump UI toast, but no longer used to wipe data
const SEED_VERSION = '2026-06-02-v102-status-export-incomplete';
// TODAY is the actual current date. The data file is mostly Apr/May 2026, so
// for testing in a different real-time period it's fine — comparisons against
// expiry dates etc. use the actual today.
const TODAY = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
})();
// Default sports list — used to seed state.settings.sports on first install.
// At runtime, SPORTS is a getter that reads the live admin-managed list.
const DEFAULT_SPORTS = ['MMA','Boxing','Kick Boxing','Karate','Taekwondo','Gymnastic','Football','Swimming','Zumba','Summer Camp'];
// Summer Camp is a special sport: enrollment is by duration (1 day / 1 week /
// 1 month / 2 months) instead of by class count. The enrollment form swaps the
// Classes input for a Duration dropdown when this sport is picked.
const SUMMER_CAMP = 'Summer Camp';
const DEFAULT_SUMMER_CAMP_PRICES = [
  { label: '1 day',    days: 1,  price: 175  },
  { label: '1 week',   days: 7,  price: 650  },
  { label: '2 weeks',  days: 14, price: 1300 },
  { label: '3 weeks',  days: 21, price: 1500 },
  { label: '1 month',  days: 30, price: 1750 },
  { label: '2 months', days: 60, price: 3000 },
];
// SPORTS reflects the CURRENT enabled sports (admin can add/disable on the Sports page).
Object.defineProperty(globalThis, 'SPORTS', {
  configurable: true,
  get() {
    const list = state?.settings?.sports;
    if (Array.isArray(list) && list.length) {
      return list.filter(s => s && (s.enabled !== false)).map(s => typeof s === 'string' ? s : s.name);
    }
    return DEFAULT_SPORTS;
  },
});
// ALL_SPORTS (including disabled) — used for showing historical records.
Object.defineProperty(globalThis, 'ALL_SPORTS', {
  configurable: true,
  get() {
    const list = state?.settings?.sports;
    if (Array.isArray(list) && list.length) {
      return list.map(s => typeof s === 'string' ? s : s.name);
    }
    return DEFAULT_SPORTS;
  },
});
const EXP_CATS = ['Equipment','Cleaning','Utilities','Marketing','Subscriptions','Transport','Operations','Rent','Coach Pool','Coach Commission','Salary'];
const INVOICE_CATS = ['Membership','Court Rental','Boxing Room','Product','Other'];
// Validity periods in days for membership/enrollment transactions
const VALIDITY_OPTIONS = [30, 45, 60, 90, 180];
const DEFAULT_VALIDITY = 30;

// Nationality list — GCC + Arab world + common expat communities first, then
// the rest A–Z. Used as suggestions in a datalist (free text still allowed).
const NATIONALITIES = [
  // GCC
  'Qatari','Saudi','Emirati','Kuwaiti','Bahraini','Omani',
  // Arab world
  'Egyptian','Jordanian','Lebanese','Syrian','Palestinian','Iraqi','Yemeni',
  'Sudanese','Moroccan','Tunisian','Algerian','Libyan',
  // Common expat in Qatar
  'Indian','Pakistani','Bangladeshi','Filipino','Nepali','Sri Lankan',
  'Iranian','Turkish','Afghan',
  // Other major
  'American','British','Canadian','Australian',
  'French','German','Italian','Spanish','Portuguese','Dutch','Greek','Russian',
  'Chinese','Japanese','Korean','Indonesian','Malaysian','Thai','Vietnamese',
  'South African','Nigerian','Kenyan','Ethiopian','Ghanaian',
  'Brazilian','Argentine','Mexican','Colombian','Chilean',
  'Albanian','Armenian','Austrian','Azerbaijani','Belarusian','Belgian',
  'Bosnian','Bulgarian','Croatian','Czech','Danish','Estonian','Finnish',
  'Georgian','Hungarian','Icelandic','Irish','Israeli','Kazakh','Latvian',
  'Lithuanian','Luxembourgish','Macedonian','Maltese','Moldovan','Mongolian',
  'Montenegrin','Norwegian','Polish','Romanian','Serbian','Slovak','Slovenian',
  'Swedish','Swiss','Tajik','Turkmen','Ukrainian','Uzbek',
  'Burmese','Cambodian','Laotian','Singaporean','Taiwanese',
  'Algerian','Angolan','Beninese','Botswanan','Burkinabe','Burundian',
  'Cameroonian','Cape Verdean','Central African','Chadian','Comorian','Congolese',
  'Djiboutian','Equatorial Guinean','Eritrean','Eswatini','Gabonese','Gambian',
  'Guinean','Guinea-Bissauan','Ivorian','Lesothan','Liberian','Madagascan',
  'Malawian','Malian','Mauritanian','Mauritian','Mozambican','Namibian',
  'Nigerien','Rwandan','São Toméan','Senegalese','Seychellois','Sierra Leonean',
  'Somali','South Sudanese','Tanzanian','Togolese','Ugandan','Zambian','Zimbabwean',
  'Bolivian','Costa Rican','Cuban','Dominican','Ecuadorian','Salvadoran',
  'Guatemalan','Guyanese','Haitian','Honduran','Jamaican','Nicaraguan',
  'Panamanian','Paraguayan','Peruvian','Surinamese','Trinidadian','Uruguayan','Venezuelan',
  'Fijian','New Zealander','Papua New Guinean','Samoan','Tongan','Vanuatuan',
  'Bhutanese','Maldivian','Stateless','Other',
];

// Add `days` days to a YYYY-MM-DD date string, return YYYY-MM-DD.
function addDays(dateStr, days) {
  if (!dateStr || days == null) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return null;
  d.setDate(d.getDate() + parseInt(days));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

let state = {
  user: null,
  members: [],
  coaches: [],
  invoices: [],
  expenses: [],
  salaries: [],
  sales: [],
  trials: [],
  rentals: [],            // booking log: facility, customer, date, hours, amount
  rentalCustomers: [],    // {id, name, phone, qid, notes} — reusable rental contacts
  schedule: [],           // class schedule: {id, day, slot, sport, coachId}
  settings: {
    expiringSoonDays: 3,
    lowStockThreshold: 3,
    facilityRates: {      // default hourly rates per facility, editable in Settings
      'Football Court': 150,
      'Boxing Room': 100,
      'Swimming Pool': 200,
    },
    sports: [             // populated by load()/migrations on first run from DEFAULT_SPORTS
    ],
  },
  route: 'dashboard',
};

// Facility list — used in rental forms + dropdowns
const FACILITIES = ['Football Court', 'Boxing Room', 'Swimming Pool'];

// ─── Persistence ──────────────────────────────────────────────────────────
// save()/load() now delegate to the Storage abstraction (storage.js), which
// chooses between localStorage and Firebase based on firebase-config.js.
// We tag the state with the current schema version on every save.

function save() {
  try {
    const stateToSave = { ...state, __schema: SCHEMA_VERSION };
    window.Storage.save(stateToSave);
    localStorage.setItem(LS_VERSION_KEY, SEED_VERSION);
  } catch (e) {
    console.warn('Save failed:', e);
  }
}

async function load() {
  try {
    const parsed = await window.Storage.load();
    if (!parsed) return false;

    // Migrate from older schemas. NEVER wipe user data — only adapt its shape.
    const savedSchema = parsed.__schema || 1;
    if (savedSchema < SCHEMA_VERSION) {
      runMigrations(parsed, savedSchema);
      parsed.__schema = SCHEMA_VERSION;
      window._schemaMigrated = { from: savedSchema, to: SCHEMA_VERSION };
    }

    // Apply parsed onto live state (preserve user/route which are session-only)
    const savedUser = state.user, savedRoute = state.route;
    Object.assign(state, parsed);
    state.user = savedUser; state.route = savedRoute;

    // Ensure all expected fields exist (safe no-ops if already present).
    if (!Array.isArray(state.trials))          state.trials = [];
    if (!Array.isArray(state.rentals))         state.rentals = [];
    if (!Array.isArray(state.rentalCustomers)) state.rentalCustomers = [];
    if (!Array.isArray(state.schedule))        state.schedule = [];
    if (!Array.isArray(state.products))        state.products = [];
    if (!Array.isArray(state.sales))           state.sales = [];
    if (!state.settings) state.settings = {};
    if (state.settings.expiringSoonDays == null) state.settings.expiringSoonDays = 3;
    if (state.settings.lowStockThreshold == null) state.settings.lowStockThreshold = 3;
    if (!state.settings.facilityRates) {
      state.settings.facilityRates = { 'Football Court': 150, 'Boxing Room': 100, 'Swimming Pool': 200 };
    }
    if (!Array.isArray(state.settings.sports) || state.settings.sports.length === 0) {
      state.settings.sports = DEFAULT_SPORTS.map((name, i) => ({ name, enabled: true, order: i }));
    }
    if (!Array.isArray(state.settings.summerCampPrices) || state.settings.summerCampPrices.length === 0) {
      state.settings.summerCampPrices = DEFAULT_SUMMER_CAMP_PRICES.map(p => ({ ...p }));
    }
    (state.coaches || []).forEach(c => { if (!c.active) c.active = 'Y'; });
    (state.members || []).forEach(m => { if (!Array.isArray(m.sportSwitches)) m.sportSwitches = []; });
    (state.invoices || []).forEach(inv => { if (!Array.isArray(inv.lineItems)) inv.lineItems = []; });

    // Auto-sync stale m.status with derived memberStatus(). The UI always uses
    // memberStatus() (which derives from expiryDate), but the stored m.status
    // can drift after import or after time passes. This one-time sweep aligns
    // them so CSV exports + other consumers that read m.status see fresh values.
    let statusSyncs = 0;
    (state.members || []).forEach(m => {
      const live = memberStatus(m);
      // Don't override Completed (it's tied to attendance, not just dates)
      if (live === 'Completed') return;
      // Don't sync if frozen — keep stored status as set
      if (live === 'Frozen') return;
      if (m.status !== live) {
        m.status = live;
        statusSyncs++;
      }
    });
    if (statusSyncs > 0) {
      // Defer the toast until after the UI is ready
      window.__pendingStatusSync = statusSyncs;
    }

    localStorage.setItem(LS_VERSION_KEY, SEED_VERSION);
    return true;
  } catch (e) {
    console.warn('Load failed:', e);
  }
  return false;
}

// ─── Schema migrations ───────────────────────────────────────────────
// Each numbered step transforms data from version N to N+1 IN PLACE.
// Add a new step here when you bump SCHEMA_VERSION above. NEVER delete
// existing migrations — older installs need them to catch up.
function runMigrations(data, fromVersion) {
  // 1 → 2: add rentalCustomers if missing
  if (fromVersion < 2) {
    if (!Array.isArray(data.rentalCustomers)) data.rentalCustomers = [];
  }
  // 2 → 3: add schedule array if missing
  if (fromVersion < 3) {
    if (!Array.isArray(data.schedule)) data.schedule = [];
  }
  // 3 → 4: salaries reshape from manual records to computed model.
  //   Old records: { name, rate, salary, advance, balance, paidDate, status, month }
  //   New records: { coachId, month, kind: 'advance'|'paid', amount?, paidDate?, note? }
  //   We convert old records into 'paid' rows linked to a coach by name match.
  //   Also: coaches gain fixedSalary + role fields.
  if (fromVersion < 4) {
    (data.coaches || []).forEach(c => {
      if (c.fixedSalary == null) c.fixedSalary = 0;
      if (!c.role) c.role = 'coach';
    });
    if (Array.isArray(data.salaries)) {
      const migrated = [];
      for (const s of data.salaries) {
        // Already new-shape? leave alone
        if (s.kind === 'advance' || s.kind === 'paid') { migrated.push(s); continue; }
        // Find matching coach by name
        const c = (data.coaches || []).find(x => x.name && s.name &&
          x.name.toLowerCase().trim() === s.name.toLowerCase().trim());
        if (!c) continue; // orphan record, drop
        if (s.advance && s.advance > 0) {
          migrated.push({
            id: s.id ? s.id * 100 + 1 : Date.now(),
            coachId: c.id, month: s.month, kind: 'advance',
            amount: s.advance, paidDate: s.advanceDate || s.paidDate, note: 'Migrated from v3 record',
          });
        }
        if (s.status === 'paid' && s.salary > 0) {
          migrated.push({
            id: s.id || Date.now(),
            coachId: c.id, month: s.month, kind: 'paid',
            paidDate: s.paidDate,
            snapshotGross: s.salary, snapshotNet: s.balance ?? (s.salary - (s.advance || 0)),
            snapshotFixed: s.rate ? 0 : s.salary,
            snapshotCommission: s.rate ? s.salary : 0,
            snapshotCommissionBase: null,
          });
        }
      }
      data.salaries = migrated;
    }
  }
  // 4 → 5: Each invoice gets a lineItems[] array so commission can be split
  // per-sport when a member registers for multiple sports. Existing single-sport
  // invoices get wrapped in a single-item array. Each line carries its own
  // coachId so the payroll calc can attribute to the right coach.
  // Also: members gain sportSwitches[] for tracking mid-month sport changes.
  if (fromVersion < 5) {
    (data.invoices || []).forEach(inv => {
      if (Array.isArray(inv.lineItems) && inv.lineItems.length > 0) {
        // Already has line items — but they might lack coachId. Patch by name lookup.
        inv.lineItems.forEach(li => {
          if (li.coachId == null && li.coach) {
            const c = (data.coaches || []).find(co => co.name === li.coach);
            if (c) li.coachId = c.id;
          }
        });
        return;
      }
      // Wrap single-sport invoice in a one-item lineItems array.
      // Only do this for Membership invoices (Product/Rental don't need splitting).
      const cat = inv.category || 'Membership';
      if (cat === 'Membership' || cat === 'Other' || !inv.category) {
        inv.lineItems = [{
          sport: inv.sport || null,
          coach: inv.coach || null,
          coachId: inv.coachId || null,
          classes: null,
          price: inv.amount || 0,
        }];
      } else {
        inv.lineItems = [];
      }
    });
    (data.members || []).forEach(m => {
      if (!Array.isArray(m.sportSwitches)) m.sportSwitches = [];
    });
  }
  // 5 → 6: Sports become dynamic. Seed state.settings.sports[] with the default list.
  // Coaches gain optional profile fields (phone, qid, birthdate, email).
  if (fromVersion < 6) {
    if (!data.settings) data.settings = {};
    if (!Array.isArray(data.settings.sports)) {
      data.settings.sports = DEFAULT_SPORTS.map((name, i) => ({
        name, enabled: true, order: i,
      }));
    }
    (data.coaches || []).forEach(c => {
      if (c.phone === undefined) c.phone = null;
      if (c.qid === undefined) c.qid = null;
      if (c.birthdate === undefined) c.birthdate = null;
      if (c.email === undefined) c.email = null;
    });
  }
  // 6 → 7: Summer Camp introduced. Add it to state.settings.sports if missing.
  // Seed state.settings.summerCampPrices with the default price table.
  if (fromVersion < 7) {
    if (!data.settings) data.settings = {};
    if (!Array.isArray(data.settings.sports)) data.settings.sports = [];
    const hasSummerCamp = data.settings.sports.some(s => (s.name || s) === SUMMER_CAMP);
    if (!hasSummerCamp) {
      const maxOrder = Math.max(0, ...data.settings.sports.map(s => s.order ?? 0));
      data.settings.sports.push({ name: SUMMER_CAMP, enabled: true, order: maxOrder + 1 });
    }
    if (!Array.isArray(data.settings.summerCampPrices)) {
      data.settings.summerCampPrices = DEFAULT_SUMMER_CAMP_PRICES.map(p => ({ ...p }));
    }
  }
  // 7 → 8: Add intermediate Summer Camp tiers (2 weeks, 3 weeks).
  // Inserts each missing tier in the correct position by `days` count.
  // Idempotent: doesn't touch existing tiers, including any custom ones admin
  // has already saved. Only ADDS the missing 2w/3w slots if neither exists.
  if (fromVersion < 8) {
    if (!data.settings) data.settings = {};
    if (!Array.isArray(data.settings.summerCampPrices) || data.settings.summerCampPrices.length === 0) {
      data.settings.summerCampPrices = DEFAULT_SUMMER_CAMP_PRICES.map(p => ({ ...p }));
    } else {
      const want = [
        { label: '2 weeks', days: 14, price: 1300 },
        { label: '3 weeks', days: 21, price: 1500 },
      ];
      for (const tier of want) {
        // Skip if admin already has a tier with this exact day count
        if (data.settings.summerCampPrices.some(p => p.days === tier.days)) continue;
        data.settings.summerCampPrices.push({ ...tier });
      }
      // Re-sort by days so the dropdown reads naturally (1d, 1w, 2w, 3w, 1m, 2m)
      data.settings.summerCampPrices.sort((a, b) => (a.days || 0) - (b.days || 0));
    }
  }
  // Future migrations go here as more `if (fromVersion < N)` blocks.
}

function resetData() {
  if (!confirm('Clear ALL data and start with an empty database? You will need to re-import your Excel sheets. This cannot be undone.')) return;
  localStorage.removeItem(LS_KEY);
  // Reset state to empty defaults
  state.members = []; state.coaches = []; state.invoices = [];
  state.expenses = []; state.salaries = []; state.sales = [];
  state.trials = []; state.rentals = []; state.rentalCustomers = [];
  state.schedule = []; state.products = [];
  state.settings = { expiringSoonDays: 3, lowStockThreshold: 3,
    facilityRates: { 'Football Court': 150, 'Boxing Room': 100, 'Swimming Pool': 200 },
    sports: DEFAULT_SPORTS.map((name, i) => ({ name, enabled: true, order: i })),
    summerCampPrices: DEFAULT_SUMMER_CAMP_PRICES.map(p => ({ ...p })) };
  state.__schema = SCHEMA_VERSION;
  save();
  render();
  toast('Database cleared. Import your data from the Data Import page.');
}

// Loads the bundled demo data (the 207 sample members, etc.). This is now
// opt-in only — called only by the "Load demo data" button. Real installs
// should never see this content; the admin imports his own data manually.
function loadDemoData() {
  const seed = window.SEED_DATA;
  if (!seed) { toast('Demo data not available', 'error'); return; }
  state.members = (seed.members || []).map(m => ({...m}));
  state.coaches = (seed.coaches || []).map(c => ({...c}));
  state.invoices = (seed.invoices || []).map(i => ({...i}));
  state.expenses = (seed.expenses || []).map(e => ({...e}));
  state.salaries = (seed.salaries || []).map(s => ({...s}));
  state.sales = (seed.sales || []).map(s => ({...s}));
  state.trials = (seed.trials || []).map(t => ({...t}));
  state.rentals = (seed.rentals || []).map(r => ({...r}));
  state.rentalCustomers = (seed.rentalCustomers || []).map(c => ({...c}));
  state.schedule = (seed.schedule || []).map(c => ({...c}));
  state.products = (seed.products || []).map(p => ({...p}));
  state.settings = seed.settings || { expiringSoonDays: 3, lowStockThreshold: 3,
    facilityRates: { 'Football Court': 150, 'Boxing Room': 100, 'Swimming Pool': 200 } };
  state.__schema = SCHEMA_VERSION;
  save();
}

// Legacy alias for any code that still calls loadSeed() — does nothing now.
function loadSeed() { /* intentionally empty — see loadDemoData() */ }
// Expose loadDemoData for inline onclick handlers
window.loadDemoData = loadDemoData;

// ─── Helpers ──────────────────────────────────────────────────────────
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') e.className = v;
    else if (k === 'innerHTML') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v !== null && v !== undefined) e.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    if (Array.isArray(child)) child.forEach(c => c != null && e.append(c instanceof Node ? c : document.createTextNode(c)));
    else e.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return e;
}

function html(strings, ...values) {
  // Simple template tag — assembles HTML string
  let result = '';
  strings.forEach((s, i) => {
    result += s;
    if (i < values.length) {
      const v = values[i];
      if (v == null) result += '';
      else if (Array.isArray(v)) result += v.join('');
      else result += String(v);
    }
  });
  return result;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function fmt(n) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' QAR';
}

function fmtDate(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
}

function fmtMonth(m) {
  if (!m) return '—';
  const [y, mo] = m.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(mo)-1]} ${y.slice(-2)}`;
}

// Discover every YYYY-MM that appears anywhere in the data. Single source of
// truth — never hard-code a month list. Pass {includeFuture:true} to also add
// today's month and the next one (useful for selectors when entering new data).
function availableMonths(opts = {}) {
  const set = new Set();
  (state.invoices || []).forEach(i => { if (i.month) set.add(i.month); });
  (state.expenses || []).forEach(e => {
    if (e.month) set.add(e.month);
    if (e.date) set.add(String(e.date).slice(0, 7));
  });
  (state.salaries || []).forEach(x => { if (x.month) set.add(x.month); });
  (state.members || []).forEach(m => {
    if (m.firstRegistration) set.add(String(m.firstRegistration).slice(0, 7));
    if (m.startDate) set.add(String(m.startDate).slice(0, 7));
    (m.subscriptions || []).forEach(s => {
      if (s.month && /^\d{4}-\d{2}$/.test(s.month)) set.add(s.month);
    });
    if (m.dailyAttendance) Object.keys(m.dailyAttendance).forEach(k => set.add(k));
  });
  if (opts.includeFuture) {
    const now = new Date();
    const ym = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    set.add(ym(now));
    set.add(ym(new Date(now.getFullYear(), now.getMonth()+1, 1)));
  }
  return [...set].filter(Boolean).sort();
}

// Days in a YYYY-MM string (uses Date so it's always correct, no hard-coded map).
function daysInMonth(ym) {
  if (!ym) return 31;
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

// Today's month as YYYY-MM
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// Convert YYYY-MM to a 3-letter month short ('2026-05' → 'may'). Used by
// legacy fields like subscription.month / expense.month that store the short.
function ymToShort(ym) {
  if (!ym) return null;
  const m = String(ym).match(/^\d{4}-(\d{2})$/);
  if (!m) return ym;  // already short
  const shorts = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  return shorts[parseInt(m[1])-1] || null;
}

// Latest month that actually has data; falls back to today.
function latestDataMonth() {
  const a = availableMonths();
  return a.length ? a[a.length - 1] : currentMonth();
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length || !parts[0]) return '?';
  return ((parts[0][0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

function coachName(id) {
  if (id == null) return '—';
  const c = state.coaches.find(x => x.id === id);
  return c ? c.name : 'Unknown';
}

// Resolve current customer info for a record (invoice/sale/rental/etc).
// If the record has a customerId pointing to an existing member, the LIVE
// member fields win — so renaming a member instantly propagates to all their
// historical records. Falls back to the record's own snapshot fields for
// walk-ins or members that have been deleted.
//
// Returns { id, name, phone, nationality, isMember, isDeleted }.
function customerInfo(record) {
  if (!record) return { id: null, name: null, phone: null, nationality: null, isMember: false, isDeleted: false };
  const cid = record.customerId;
  if (cid) {
    const m = state.members.find(x => x.id === cid);
    if (m) {
      return {
        id: m.id,
        name: m.name,
        phone: m.phone || null,
        nationality: m.nationality || null,
        nameArabic: m.nameArabic || null,
        qid: m.qid || null,
        isMember: true,
        isDeleted: false,
      };
    }
    // customerId set but member missing → deleted; use snapshot
    return {
      id: cid,
      name: record.customerName || '(deleted member)',
      phone: record.customerPhone || null,
      nationality: null,
      isMember: false,
      isDeleted: true,
    };
  }
  // No link → walk-in
  return {
    id: null,
    name: record.customerName || null,
    phone: record.customerPhone || null,
    nationality: null,
    isMember: false,
    isDeleted: false,
  };
}

// Read a member's daily marks for a specific (month, sport). Handles both the
// new per-sport structure ({mo:{sport:{day:Y}}}) and legacy ({mo:{day:Y}}).
function attendanceFor(m, monthKey, sport) {
  const mo = m?.dailyAttendance?.[monthKey];
  if (!mo) return {};
  // Per-sport: values are objects keyed by day
  const sample = Object.values(mo)[0];
  if (sample && typeof sample === 'object') {
    return mo[sport] || {};
  }
  // Legacy flat: only return if it's the primary sport
  return sport === m.sport ? mo : {};
}

// Count Y/N marks for a member, optionally filtered by sport. Returns {y, n,
// total} computed from dailyAttendance across all months. This is the LIVE
// count — updated whenever the user marks a cell in the attendance grid.
function liveAttendanceCount(m, sport = null) {
  let y = 0, n = 0;
  const da = m?.dailyAttendance;
  if (!da) return { y, n, total: 0 };
  for (const monthKey of Object.keys(da)) {
    const mo = da[monthKey];
    if (!mo) continue;
    const sample = Object.values(mo)[0];
    if (sample && typeof sample === 'object') {
      // Per-sport shape
      for (const sp of Object.keys(mo)) {
        if (sport && sp !== sport) continue;
        const days = mo[sp] || {};
        for (const v of Object.values(days)) {
          if (v === 'Y') y++;
          else if (v === 'N') n++;
        }
      }
    } else {
      // Legacy flat (counts as primary sport)
      if (sport && sport !== m.sport) continue;
      for (const v of Object.values(mo)) {
        if (v === 'Y') y++;
        else if (v === 'N') n++;
      }
    }
  }
  return { y, n, total: y + n };
}

// Authoritative "attended classes" reading. If the member has ANY live
// attendance marks (Y or N), the live count wins. Otherwise we fall back to
// the static subscription field (imported from spreadsheet). Pass `sport` to
// restrict to one enrolled sport.
function attendedClassesFor(m, sport = null) {
  const live = liveAttendanceCount(m, sport);
  if (live.total > 0) return live.y;   // user has been marking attendance → trust the grid
  // Fallback: sum subscription rows
  let att = 0;
  for (const sub of (m?.subscriptions || [])) {
    if (sport && sub.activity !== sport) continue;
    att += sub.attendedClasses || 0;
  }
  return att;
}

// Same idea for total expected classes (denominator)
function totalClassesFor(m, sport = null) {
  let tot = 0;
  for (const sub of (m?.subscriptions || [])) {
    if (sport && sub.activity !== sport) continue;
    tot += sub.totalClasses || 0;
  }
  return tot;
}

// A coach counts as active unless explicitly flagged 'N'.
function isCoachActive(c) {
  return (c.active || 'Y') === 'Y';
}

// Coaches selectable for NEW enrollments / renewals / registrations.
// Inactive coaches are excluded here, but still appear in search/filter dropdowns
// and remain attached to their historical records.
function activeCoaches() {
  return state.coaches.filter(isCoachActive);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target)) return null;
  const today = new Date();
  today.setHours(0,0,0,0);
  target.setHours(0,0,0,0);
  return Math.round((target - today) / 86400000);
}

function lastRenewalDate(m) {
  if (!m) return null;
  const dates = [];
  for (const s of (m.subscriptions || [])) if (s.start) dates.push(s.start);
  for (const r of (m.renewals || [])) if (r.start) dates.push(r.start);
  if (!dates.length) return null;
  return dates.sort().slice(-1)[0];
}

// Did the member finish all classes in a package within < 1 month?
// Returns true if ANY subscription/renewal has attended === total (and >0)
// AND the start→end gap is under ~30 days.
function isCompleted(m) {
  if (!m) return false;
  const subs = [...(m.subscriptions || []), ...(m.renewals || [])];
  for (const s of subs) {
    const attended = s.attendedClasses;
    const total = s.totalClasses;
    if (total == null || attended == null) continue;
    if (total <= 0) continue;
    if (attended < total) continue;          // must have attended ALL classes
    // Check the duration was under one month
    if (s.start && s.end) {
      const start = new Date(s.start);
      const end = new Date(s.end);
      if (!isNaN(start) && !isNaN(end)) {
        const days = (end - start) / 86400000;
        if (days < 31) return true;
      }
    } else {
      // No dates to check duration — fall back to "all classes done" as completed
      return true;
    }
  }
  return false;
}

// Derived display status: 'Completed' | 'Active' | 'Expired'
// Completed members are still ACTIVE (current), just finished their package early.
function memberStatus(m) {
  if (!m) return 'Expired';
  // Frozen takes priority: freeze pauses the membership and shifts the expiry,
  // so a frozen member is never considered Expired even if their original
  // expiry slipped past today.
  if (m.currentFreezeUntil && TODAY <= m.currentFreezeUntil) return 'Frozen';
  // Derive Expired from data — don't trust the stored status field. This fixes
  // the case where status was set once (e.g. on import) and never updated as
  // the expiry date passed.
  if (m.expiryDate && m.expiryDate < TODAY) return 'Expired';
  // If the stored status explicitly says Expired and we have no expiryDate
  // to argue otherwise, respect it (legacy data).
  if (!m.expiryDate && m.status === 'Expired') return 'Expired';
  if (isCompleted(m)) return 'Completed';
  return 'Active';
}

// Is the member counted as active (Active, Completed, AND Frozen all count)?
// Frozen members are not Expired — they're paused but still paying customers.
function isActiveStatus(m) {
  return memberStatus(m) !== 'Expired';
}

// ─── Payroll: compute monthly pay for a coach/staff member ───────────
//
// MODEL (as of v92):
//   Each invoice has `lineItems[]`, one per sport. Each lineItem has its own
//   `coachId` and `price`. Commission for coach C in month M = sum over all
//   lineItems where the line is credited to C:
//
//     base × (coach.rate / 100)
//
//   Credit rule (sport-switch handling):
//     For each lineItem on a Membership invoice for an Active member in month M,
//     find any sport-switch the member made in month M for this sport.
//     - If the member switched out of this sport in M AND has at least one
//       attended class (Y) for this sport in M BEFORE the switch → credit goes
//       to the OLD coach (lineItem.coachId).
//     - If they switched and NO attendance was marked → credit goes to the
//       NEW coach (the one in the current enrollment).
//     - No switch in this month → credit goes to lineItem.coachId as-is.
//
//   Staff (non-coach) earn fixedSalary only; their commissionRate is usually 0.
//
// Returns: { fixed, commissionBase, commissionRate, commissionAmount, gross, advance, net, paidStatus, paidDate, hasRevenue }
function computeMonthlyPay(coachId, monthKey) {
  const c = state.coaches.find(x => x.id === coachId);
  if (!c) return null;
  const fixed = parseFloat(c.fixedSalary) || 0;
  const commissionRate = parseFloat(c.rate) || 0;
  let commissionBase = 0;

  for (const inv of state.invoices) {
    if (monthKey && inv.month !== monthKey) continue;
    // Only Membership invoices contribute to commission. This includes
    // "switch-credit" invoices created by the Switch Sport flow (activityType:
    // 'switch-credit'), since those carry the new coach's locked share.
    const cat = inv.category || 'Membership';
    if (cat !== 'Membership') continue;
    if (!inv.customerId) continue;
    const mem = state.members.find(x => x.id === inv.customerId);
    if (!mem || !isActiveStatus(mem)) continue;
    const lineItems = Array.isArray(inv.lineItems) && inv.lineItems.length
      ? inv.lineItems
      : [{ sport: inv.sport, coachId: inv.coachId, price: inv.amount || 0 }];

    for (const li of lineItems) {
      // Summer Camp generates NO coach commission — revenue goes to the club.
      // Coaches working camp get paid via their fixed salary instead.
      if (li.sport === SUMMER_CAMP) continue;
      // The lineItem's coachId IS the credited coach. Switches have already
      // rewritten the original lineItem's price (to A's share) and added a
      // separate lineItem in the switch month for B's share. So we just sum.
      if (li.coachId === coachId) {
        commissionBase += parseFloat(li.price) || 0;
      }
    }
  }

  const commissionAmount = commissionBase * commissionRate / 100;
  const gross = fixed + commissionAmount;
  const advance = (state.salaries || [])
    .filter(s => s.coachId === coachId && s.month === monthKey && s.kind === 'advance')
    .reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  const paidRecord = (state.salaries || [])
    .find(s => s.coachId === coachId && s.month === monthKey && s.kind === 'paid');

  return {
    coachId, month: monthKey,
    name: c.name,
    role: c.role || 'coach',
    fixed,
    commissionBase,
    commissionRate,
    commissionAmount,
    gross,
    advance,
    net: gross - advance,
    paidDate: paidRecord ? paidRecord.paidDate : null,
    paidStatus: paidRecord ? 'paid' : 'pending',
    hasRevenue: commissionBase > 0 || fixed > 0,
  };
}

// DEPRECATED (v95): formerly resolved switch-month credits at runtime.
// Now the switch action itself rewrites the lineItem prices and creates a
// new switch-credit invoice for the new coach's share. Kept as a no-op for
// any callers that might still reference it.
function resolveCreditedCoach(m, li, monthKey) {
  return li.coachId || null;
}

// Apply a freeze to a member. Shifts expiryDate forward by `days`, records the
// freeze in m.freezes[], and sets m.currentFreezeUntil so status reflects it.
function applyFreeze(m, days, reason) {
  if (!m || !days || days < 1) return;
  const startDate = TODAY;
  const endDate = addDays(startDate, parseInt(days));
  if (!m.freezes) m.freezes = [];
  m.freezes.push({
    id: 'fr_' + Date.now(),
    days: parseInt(days),
    start: startDate,
    end: endDate,
    reason: reason || '',
    appliedAt: new Date().toISOString(),
    previousExpiry: m.expiryDate,
  });
  m.currentFreezeUntil = endDate;
  // Shift expiry forward by the freeze duration
  if (m.expiryDate) m.expiryDate = addDays(m.expiryDate, parseInt(days));
  // Shift each subscription's end too so per-sport expiry stays in sync
  for (const sub of (m.subscriptions || [])) {
    if (sub.end) sub.end = addDays(sub.end, parseInt(days));
  }
}

function nextId(arr) {
  return Math.max(0, ...arr.map(x => x.id || 0)) + 1;
}

// Generate the next sequential invoice ref. Derives from the maximum existing
// numeric portion of any "INV####" ref in state.invoices, so we never collide
// with imported refs and never depend on a hardcoded starting counter.
// Falls back to INV0001 if nothing exists yet.
function nextInvoiceRef() {
  let maxN = 0;
  for (const inv of (state.invoices || [])) {
    if (!inv.ref) continue;
    const m = String(inv.ref).match(/(\d+)\s*$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxN) maxN = n;
    }
  }
  return `INV${String(maxN + 1).padStart(4, '0')}`;
}

// ─── Searchable member picker ──────────────────────────────────────
// Renders a text input that filters members as you type, backed by a hidden
// input (id=`${id}`) holding the selected member id — so existing code that
// reads $('#id').value keeps working unchanged.
function memberPickerHtml(id, { placeholder = '— none —', selectedId = null } = {}) {
  const sel = selectedId != null ? state.members.find(m => m.id === selectedId) : null;
  return `
    <div class="member-picker" data-picker="${id}" style="position:relative">
      <input type="hidden" id="${id}" value="${sel ? sel.id : ''}" />
      <input type="text" id="${id}-search" autocomplete="off" placeholder="${escapeHtml(placeholder)}"
        value="${sel ? escapeHtml(sel.name) : ''}" data-placeholder="${escapeHtml(placeholder)}" style="width:100%" />
      <div id="${id}-list" class="member-picker-list" style="display:none;position:absolute;left:0;right:0;top:100%;z-index:50;max-height:240px;overflow:auto;background:var(--surface,#1b2130);border:1px solid var(--border,#2a3142);border-radius:8px;margin-top:2px;box-shadow:0 8px 24px rgba(0,0,0,.4)"></div>
    </div>`;
}

// Wire a member picker after its DOM is in place.
function bindMemberPicker(id, { placeholder = '— none —', allowNone = true } = {}) {
  const hidden = document.getElementById(id);
  const search = document.getElementById(id + '-search');
  const list = document.getElementById(id + '-list');
  if (!hidden || !search || !list) return;

  function renderList(q) {
    const query = (q || '').trim().toLowerCase();
    let matches = state.members;
    if (query) {
      matches = state.members.filter(m => {
        const hay = [m.name, m.nameArabic, m.phone, m.qid].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(query);
      });
    }
    matches = matches.slice(0, 60);
    const allSportsOf = m => {
      const set = new Set([m.sport, ...((m.enrollments || []).map(e => e.sport)), ...((m.subscriptions || []).map(s => s.activity))].filter(Boolean));
      return Array.from(set);
    };
    const noneRow = allowNone ? `<div class="mp-opt" data-mid="" style="padding:8px 12px;cursor:pointer;color:var(--text-mute)">${escapeHtml(placeholder)}</div>` : '';
    list.innerHTML = noneRow + (matches.length
      ? matches.map(m => {
          const sports = allSportsOf(m);
          const sportLabel = sports.length > 1
            ? sports.map(s => `<span style="display:inline-block;background:var(--surface-2);border-radius:4px;padding:1px 6px;margin-left:4px;font-size:10px">${escapeHtml(s)}</span>`).join('')
            : `<span class="text-mute" style="font-size:10px">${escapeHtml(sports[0] || '')}</span>`;
          return `
          <div class="mp-opt" data-mid="${m.id}" style="padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:8px">
            <span style="font-weight:600">${escapeHtml(m.name)}</span>
            ${m.nameArabic ? `<span class="text-dim" dir="rtl" style="font-size:12px">${escapeHtml(m.nameArabic)}</span>` : ''}
            <span style="margin-left:auto;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:2px">${sportLabel}</span>
          </div>`;
        }).join('')
      : `<div style="padding:10px 12px;color:var(--text-mute);font-size:12px">No members match "${escapeHtml(q)}"</div>`);
    list.querySelectorAll('.mp-opt').forEach(o => {
      o.addEventListener('mouseenter', () => o.style.background = 'rgba(91,141,239,.15)');
      o.addEventListener('mouseleave', () => o.style.background = '');
      o.addEventListener('mousedown', e => {
        e.preventDefault();
        const mid = o.dataset.mid;
        hidden.value = mid;
        const m = mid ? state.members.find(x => x.id === parseInt(mid)) : null;
        search.value = m ? m.name : '';
        list.style.display = 'none';
      });
    });
  }

  search.addEventListener('focus', () => { renderList(''); list.style.display = 'block'; });
  search.addEventListener('input', () => { hidden.value = ''; renderList(search.value); list.style.display = 'block'; });
  search.addEventListener('blur', () => { setTimeout(() => { list.style.display = 'none'; }, 150); });
}

// ─── Pagination helper ──────────────────────────────────────────────
// Renders a control bar with "showing X–Y of Z" + page-size dropdown + prev/next.
// Call buildPagination(state, totalCount) → returns HTML string for the bar.
// The caller slices its rows with paginate(rows, pgState).
function makePager(initialSize = 10) {
  return { page: 1, size: initialSize };
}

function paginate(rows, pg) {
  if (pg.size === 'all') return rows;
  const start = (pg.page - 1) * pg.size;
  return rows.slice(start, start + pg.size);
}

function paginationBar(pg, totalCount, id) {
  const size = pg.size === 'all' ? totalCount : pg.size;
  const totalPages = pg.size === 'all' ? 1 : Math.max(1, Math.ceil(totalCount / pg.size));
  if (pg.page > totalPages) pg.page = totalPages;
  const start = totalCount === 0 ? 0 : (pg.size === 'all' ? 1 : (pg.page - 1) * pg.size + 1);
  const end = pg.size === 'all' ? totalCount : Math.min(pg.page * pg.size, totalCount);
  return `
    <div class="pagination-bar" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 4px 4px;flex-wrap:wrap">
      <div class="text-dim" style="font-size:12px">
        Showing <strong>${start}–${end}</strong> of <strong>${totalCount}</strong> records
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <div style="display:flex;align-items:center;gap:6px;font-size:12px" class="text-dim">
          <span>Rows per page</span>
          <select data-pager-size="${id}" class="btn ghost" style="padding:4px 8px">
            <option value="10" ${pg.size===10?'selected':''}>10</option>
            <option value="20" ${pg.size===20?'selected':''}>20</option>
            <option value="50" ${pg.size===50?'selected':''}>50</option>
            <option value="all" ${pg.size==='all'?'selected':''}>All</option>
          </select>
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          <button class="btn ghost sm" data-pager-prev="${id}" ${pg.page<=1?'disabled':''} style="${pg.page<=1?'opacity:.4;cursor:not-allowed':''}">‹ Prev</button>
          <span class="text-dim" style="font-size:12px;min-width:80px;text-align:center">Page ${pg.page} / ${totalPages}</span>
          <button class="btn ghost sm" data-pager-next="${id}" ${pg.page>=totalPages?'disabled':''} style="${pg.page>=totalPages?'opacity:.4;cursor:not-allowed':''}">Next ›</button>
        </div>
      </div>
    </div>
  `;
}

// Wire up the pager controls. onChange is called after page/size changes.
function bindPagination(id, pg, totalCount, onChange) {
  const sizeSel = document.querySelector(`[data-pager-size="${id}"]`);
  if (sizeSel) sizeSel.addEventListener('change', e => {
    pg.size = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
    pg.page = 1;
    onChange();
  });
  const prev = document.querySelector(`[data-pager-prev="${id}"]`);
  if (prev) prev.addEventListener('click', () => { if (pg.page > 1) { pg.page--; onChange(); } });
  const next = document.querySelector(`[data-pager-next="${id}"]`);
  if (next) next.addEventListener('click', () => {
    const totalPages = pg.size === 'all' ? 1 : Math.max(1, Math.ceil(totalCount / pg.size));
    if (pg.page < totalPages) { pg.page++; onChange(); }
  });
}

let toastTimer;
function toast(msg, type = 'success') {
  const existing = $('.toast');
  if (existing) existing.remove();
  clearTimeout(toastTimer);
  const t = el('div', { className: `toast ${type}` }, msg);
  document.body.append(t);
  toastTimer = setTimeout(() => t.remove(), 3000);
}

// ─── Login ──────────────────────────────────────────────────────────
function loginScreen() {
  document.body.innerHTML = '';
  const root = el('div', { className: 'login' });
  const card = el('div', { className: 'login-card' });
  const cloudBadge = window.Storage.isCloud()
    ? '<div style="margin-top:8px;padding:4px 10px;background:rgba(91,141,239,.15);color:var(--blue);border-radius:99px;font-size:11px;display:inline-block">☁️ Cloud sync enabled</div>'
    : '<div style="margin-top:8px;padding:4px 10px;background:var(--surface-2);color:var(--text-mute);border-radius:99px;font-size:11px;display:inline-block">💾 Offline mode</div>';
  const isCloud = window.Storage.isCloud();
  const userLabel = isCloud ? 'Email' : 'Username';
  const userPlaceholder = isCloud ? 'admin@blackstars.qa' : 'admin';
  const userDefault = isCloud ? '' : 'admin';
  const passDefault = isCloud ? '' : 'admin123';
  const hint = isCloud
    ? 'Use the email/password you created in Firebase Console → Authentication.'
    : 'Default: admin / admin123';
  card.innerHTML = `
    <div class="login-logo">★</div>
    <h1>Black Stars CRM</h1>
    <div class="subtitle">Sports Club · Waab, Doha</div>
    ${cloudBadge}
    <div class="field" style="margin-top:14px">
      <label>${userLabel}</label>
      <input id="login-user" type="text" value="${userDefault}" placeholder="${userPlaceholder}" autofocus />
    </div>
    <div class="field">
      <label>Password</label>
      <input id="login-pass" type="password" value="${passDefault}" />
    </div>
    <button class="btn primary full lg" id="login-btn">Sign in</button>
    <div class="text-mute mt-3" style="text-align:center;font-size:11px">
      ${hint}
    </div>
  `;
  root.append(card);
  document.body.append(root);

  const doLogin = async () => {
    const u = $('#login-user').value.trim();
    const p = $('#login-pass').value;
    const btn = $('#login-btn');
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    try {
      const user = await window.Storage.signIn(u, p);
      state.user = {
        username: user.email,
        name: 'Administrator',
        role: 'admin',
        email: user.email,
      };
      // After login on cloud backend, reload state from Firestore (in case
      // another device wrote data while we were signed out).
      if (window.Storage.isCloud()) await load();
      render();
    } catch (e) {
      toast(e.message || 'Invalid credentials', 'error');
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  };

  $('#login-btn').addEventListener('click', doLogin);
  ['#login-user','#login-pass'].forEach(s =>
    $(s).addEventListener('keypress', e => e.key === 'Enter' && doLogin())
  );
}

// ─── Logout ──────────────────────────────────────────────────────────
async function logout() {
  await window.Storage.signOut();
  state.user = null;
  loginScreen();
}

// ─── Routes ──────────────────────────────────────────────────────────
const ROUTES = {
  dashboard:  { label: 'Dashboard',  icon: '📊', section: 'Main' },
  members:    { label: 'Members',    icon: '👥', section: 'Main' },
  history:    { label: 'History',    icon: '📜', section: 'Main' },
  schedule:   { label: 'Schedule',   icon: '🗓', section: 'Main' },
  expiring:   { label: 'Expiring',   icon: '⏰', section: 'Main' },
  trials:     { label: 'Trials',     icon: '🎁', section: 'Main' },
  rentals:    { label: 'Rentals',    icon: '🏟', section: 'Main' },
  coaches:    { label: 'Team',       icon: '🥋', section: 'Main' },
  attendance: { label: 'Attendance', icon: '✓',  section: 'Main' },
  invoices:   { label: 'Invoices',   icon: '📄', section: 'Finance' },
  expenses:   { label: 'Expenses',   icon: '💸', section: 'Finance' },
  salaries:   { label: 'Salaries',   icon: '💰', section: 'Finance' },
  products:   { label: 'Products',   icon: '📦', section: 'Finance' },
  reports:    { label: 'Reports',    icon: '📈', section: 'Insights' },
  coachperf:  { label: 'Coach Performance', icon: '📊', section: 'Insights' },
  renewals:   { label: 'Renewals',   icon: '🔄', section: 'Insights' },
  attreport:  { label: 'Attendance Report', icon: '📋', section: 'Insights' },
  dataimport: { label: 'Data Import', icon: '📥', section: 'System' },
  dataexport: { label: 'Data Export', icon: '📤', section: 'System' },
  sports:     { label: 'Sports',     icon: '🥋', section: 'System' },
  settings:   { label: 'Settings',   icon: '⚙️', section: 'System' },
};

function navigate(route) {
  // Sales page was merged into Invoices in v89 — silently redirect old bookmarks.
  if (route === 'sales') route = 'invoices';
  state.route = route;
  render();
}

// ─── Render ──────────────────────────────────────────────────────────
function render() {
  if (!state.user) {
    loginScreen();
    return;
  }

  // If a toast is currently visible, preserve it across the body wipe.
  // (toast() calls before render() were getting silently erased — UX bug.)
  const liveToast = document.querySelector('.toast');
  const toastClone = liveToast ? liveToast.cloneNode(true) : null;

  document.body.innerHTML = '';
  const app = el('div', { id: 'app' });
  const sidebar = renderSidebar();
  const main = el('main', { className: 'main' });

  app.append(sidebar);
  app.append(main);
  document.body.append(app);

  // Re-append the surviving toast (already on its timer; will fade naturally)
  if (toastClone) document.body.append(toastClone);

  // NOW main is in the DOM — page handler can safely query elements
  const handler = PAGES[state.route] || PAGES.dashboard;
  handler(main);

  // Init any post-render hooks (charts etc.)
  if (window._postRender) {
    window._postRender();
    window._postRender = null;
  }
}

function renderSidebar() {
  const sb = el('aside', { className: 'sidebar' });

  // Brand
  const brand = el('div', { className: 'brand' });
  brand.innerHTML = `
    <div class="brand-logo">★</div>
    <div style="flex:1">
      <div class="brand-text">Black Stars</div>
      <div class="brand-sub">Sports Club</div>
    </div>
    <button id="quick-theme" title="Cycle theme (Dark → Light → Cream → Colorful)" style="background:var(--surface-2);border:1px solid var(--border);cursor:pointer;font-size:18px;padding:6px 10px;border-radius:8px;color:var(--text)">${(() => {
      const t = getTheme();
      if (t === 'light') return '☀️';
      if (t === 'cream') return '📜';
      if (t === 'colorful') return '🎨';
      return '🌙';
    })()}</button>
  `;
  sb.append(brand);
  const themeBtn = brand.querySelector('#quick-theme');
  if (themeBtn) themeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const idx = THEMES.indexOf(getTheme());
    const next = THEMES[(idx + 1) % THEMES.length];
    // Apply theme BEFORE re-render so colors flip immediately via CSS variables
    setTheme(next);
    // Re-render so theme-card borders / "✓ Active" badges on Settings page refresh.
    // (Re-rendering wipes the body, so toast must come AFTER render or it'll be erased.)
    render();
    // Show confirmation AFTER render (otherwise the body wipe erases the toast)
    toast(`Theme: ${next.charAt(0).toUpperCase() + next.slice(1)}`);
  });

  // Navigation
  const nav = el('nav', { className: 'nav' });
  const sections = ['Main','Finance','Insights','System'];
  for (const section of sections) {
    nav.append(el('div', { className: 'nav-section' }, section));
    for (const [key, route] of Object.entries(ROUTES)) {
      if (route.section !== section) continue;
      const item = el('button', {
        className: 'nav-item' + (state.route === key ? ' active' : ''),
        onclick: () => navigate(key),
      });
      item.innerHTML = `<span class="icon">${route.icon}</span><span>${route.label}</span>`;
      nav.append(item);
    }
  }
  sb.append(nav);

  // Footer (user info)
  const footer = el('div', { className: 'sidebar-footer' });
  footer.innerHTML = `
    <div class="user-pill">
      <div class="avatar">AD</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${state.user.name}</div>
        <div style="font-size:10px;color:var(--text-mute)">Administrator · v${APP_VERSION} · ${window.Storage?.isCloud() ? '☁️ cloud' : '💾 offline'}</div>
      </div>
    </div>
    <button class="btn ghost sm full" id="sidebar-backup" style="margin-bottom:6px" title="Download a full JSON backup of your data">💾 Quick backup</button>
    <a href="guide.html" target="_blank" class="btn ghost sm full" style="margin-bottom:6px;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px">📖 User Guide</a>
    <button class="btn ghost sm full" id="logout-btn">Sign out</button>
  `;
  sb.append(footer);
  footer.querySelector('#logout-btn').addEventListener('click', logout);
  footer.querySelector('#sidebar-backup').addEventListener('click', () => {
    if (typeof window.downloadBackup === 'function') window.downloadBackup();
    else toast('Backup function not loaded yet', 'error');
  });

  return sb;
}

// ─── Page registry (filled in pages.js) ──────────────────────────
const PAGES = {};

// ─── Init ──────────────────────────────────────────────────────────
// ─── Theme manager ──────────────────────────────────────────────────
const THEMES = ['dark', 'light', 'cream', 'colorful'];
const LS_THEME_KEY = 'blackstars-crm-theme';

function getTheme() {
  return localStorage.getItem(LS_THEME_KEY) || 'dark';
}
function setTheme(name) {
  if (!THEMES.includes(name)) name = 'dark';
  if (name === 'dark') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem(LS_THEME_KEY, name);
}
// Apply saved theme as early as possible (before render to avoid flash)
setTheme(getTheme());

async function init() {
  // Choose backend: Firebase if configured, otherwise localStorage.
  const backend = window.Storage.init();
  // Diagnostic: backend selection result is exposed via window.__storageBackend
  // for ops/debugging without polluting the console.
  window.__storageBackend = backend;

  // Try to load saved state (from cloud or local)
  const usedSaved = await load();
  if (!usedSaved) {
    // First launch (or empty cloud): start with the empty defaults already declared
    window._firstLaunch = true;
    state.__schema = SCHEMA_VERSION;
    // Don't save() here on cloud — wait until admin actually does something,
    // to avoid creating an empty document in Firestore on every visitor.
    if (!window.Storage.isCloud()) save();
  }

  // Subscribe to remote updates from other devices (cloud only)
  if (window.Storage.isCloud()) {
    window.Storage.onRemoteUpdate(remoteState => {
      if (!remoteState) return;
      // Apply remote state, preserve session-only fields
      const savedUser = state.user, savedRoute = state.route;
      Object.assign(state, remoteState);
      state.user = savedUser; state.route = savedRoute;
      // Re-render current view (silently — no toast spam if updates are frequent)
      render();
    });
  }

  // Set initial route from URL hash
  const hash = location.hash.slice(1);
  if (hash && ROUTES[hash]) state.route = hash;

  // Show login
  render();

  // One-time notice if we migrated from an older data schema
  if (window._schemaMigrated) {
    const { from, to } = window._schemaMigrated;
    window._schemaMigrated = null;
    setTimeout(() => toast(`Data structure upgraded (v${from} → v${to}). Your records are preserved.`, 'success'), 600);
  }

  // Status sync notice — informational, only if changes actually happened
  if (window.__pendingStatusSync) {
    const n = window.__pendingStatusSync;
    window.__pendingStatusSync = null;
    // Save to persist the synced statuses
    save();
    setTimeout(() => toast(`✓ Refreshed status on ${n} member${n === 1 ? '' : 's'} (date-based)`, 'success'), 1100);
  }

  // Banner: which backend
  if (window.Storage.isCloud()) {
    setTimeout(() => toast('☁️ Connected to cloud — data syncs across devices', 'success'), 400);
  }
}

window.addEventListener('DOMContentLoaded', init);
