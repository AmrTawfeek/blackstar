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
const APP_VERSION = '6.325.0';   // 6.318.0 REFRESH BUTTON MOVED — no longer disturbs the page header. v6.316 injected the 🔄 into every page's .topbar with margin-inline-start:auto, which pushed a stray boxed button into the top-right corner (collided with the page's own actions / topbar-actions). REMOVED that injection; the cloud-refresh action now lives as a proper SIDEBAR FOOTER button ('🔄 Refresh from cloud', #sidebar-refresh, next to Quick backup), styled identically to the other sidebar buttons (btn ghost sm full), shown for cloud users, all roles — always visible, integrated, disturbs NO page layout. Same window.refreshFromCloud (Storage.readCloud → mergeRemoteIntoState → _renderKeepScroll, spins the icon while loading). Verified: app.js syntax OK, 0 topbar-inject refs, sidebar button wired, 1216 logic. app.js only (+ version). 6.317.0 DASHBOARD "Total Expenses" TRANSPARENCY (no math change — the number was already correct). Audit of the owner's real 07-07 July data showed every dashboard number ties out: revenue billed 27,700 (from INVOICES), cash collected 23,710, ops expenses 960, salary PAID 3,380 (Expenses screen = 4,340 = ops+salaryPaid), payroll EARNED 25,571, Total Expenses 26,531 = ops+payrollEarned, net profit 1,169 = rev−that. The apparent "wrong number" was accrual-vs-cash confusion: the dashboard counts coach pay EARNED (accrual) while the Expenses screen counts cash PAID. The payroll is legitimately large because a real "Summer Camp" staff coach (id 19) carries a 19,800/month fixed salary (owner confirmed it's a real cost). FIX: the Total-Expenses KPI subtitle now shows the SPLIT — "Ops <x> · payroll earned <y>" — with a tooltip explaining it's the accrual view (coach pay earned incl. unpaid), which is why it differs from the Expenses screen's cash-paid. Revenue remains sourced from invoices everywhere (billedInMonth, v6.254). Verified: dashboard renders on 07-07 DB, 1216 logic. pages.js only (+ version). 6.316.0 TWO ENHANCEMENTS. (1) GLOBAL CLOUD-REFRESH BUTTON — a 🔄 button injected into EVERY screen's .topbar (top-right corner, same proven pattern as the global Back button). window.refreshFromCloud reads the authoritative cloud via Storage.readCloud(), element-merges it with mergeRemoteIntoState (keeps unsaved local edits, honours the confirmed sync base), and re-renders in place via _renderKeepScroll — NO full page reload, scroll preserved; spins while loading, toasts ✓/failure; no-op with an info toast when offline. (2) RENEWAL DATE GUARD — in the renewal form (rn-start / rn-end = start / expiry), moving the Expiry (end) BEFORE the Start now snaps the Start down to equal the End, so the period is never inverted. Verified: app.js/pages.js syntax OK, Members renders + invoice-health runs on the 07-07 DB, date-snap logic (end<start→start=end; normal untouched), 1216 logic + dup-pay 8/8 + stale-save 6/6. 6.315.0 ONE-CLICK DUPLICATE-PAYMENT CLEANUP (Settings → Data → 🩺 Data Health Check). New window._scanDuplicatePayments finds invoices PAID more than their total because a payment was recorded TWICE (same amount+date+method) and lists exactly which duplicate rows to drop so paid returns to the total — never a legit distinct payment. Data Health now REPORTS "Duplicate payments (over-collected)" and, when >0, shows a SEPARATE '🧾 Fix duplicate payments' button (money-affecting, kept distinct from the no-money 'Repair duplicates'). showFixDuplicatePaymentsUI = admin-only preview modal (per-invoice: total · paid now → paid after · removed) → confirm → _applyDuplicatePaymentFix: downloads a backup first, removes only the exact-duplicate rows, recomputes amountPaid, stamps + audits ('invoice.payment.dedupe'), saves via withCloudConfirm. Verified on the owner's REAL 07-07 DB (test-duppay 8/8): finds the 5 (=959 QAR), backup taken, 0 remain after, revenue then BALANCES (billed 154,227 = collected 122,852 + due 31,375), each fixed invoice paid==total, NO other invoice touched, collected drops exactly 959; + 1216 logic. Also this session's 07-06→07-07 data-loss regression: ZERO members/invoices/coaches/expenses/salaries/families vanished, attendance grew 1651→1685, camp-doubles/dup-subs/dup-lines all 0 — the deploy lost nothing. pages.js only (+ version). 6.314.0 INVOICE-HEALTH: false GREEN when the RENEWAL isn't invoiced. A member renewed (new subscription period) but the only invoice was the OLD expired one (e.g. Mohammed Abdullah Yasser: only invoice 30 May @500 valid 30 May→30 Jun, but renewed 4 Jul→3 Aug with NO July invoice) — yet 🧾 showed GREEN because the check only matched the current sport PRICE against the latest invoice, never that the invoice COVERS the current period. FIX: memberInvoiceHealth now also checks the CURRENT subscription period (latest by start, if start >= 1-Jun kick-off) is invoiced — an invoice dated within [periodStart-14d, periodEnd] or linked by ref; if none, adds reason "Current renewal not invoiced (start → end)" → RED. Matches what Invoice Integrity → Missing already flags. Verified on the owner's DB (test-invhealth-coverage 4/4): the reported member now RED, a member whose current period IS invoiced stays GREEN (no over-flag), distribution 131 green / 13 red sane; + inv-health-renewal 4/4 + 1216 logic. pages.js only (+ version). 6.313.0⚠ DATA-LOSS ROOT FIX — "I save, refresh, it's gone". The stale-version guard (save() blocked + returned false, persisting NOTHING, whenever ANY remote snapshot carried a newer __appVersion than this tab) SILENTLY THREW AWAY every save on a tab that was even slightly behind — which happens constantly during rapid deploys / when a second device or a not-hard-refreshed tab is on a newer build. FIX: the guard is now NON-DESTRUCTIVE — it still WARNS (banner) to refresh for the latest code, but no longer blocks: save() persists normally and returns true. This is SAFE because writes are field-level + element-level merged, so an older tab only writes the fields/records IT changed and cannot wipe newer data; never losing the user's work is the priority. Also tracks the highest cloud __appVersion (`_cloudAppVersion`) and stamps the HIGHER of it and APP_VERSION, so a stale tab's save never rolls the cloud version backward (which would wrongly un-flag other tabs). The rest of the durability stack already holds (write-through confirm + auto-retry + persistent error banner, flush-on-close, beforeunload block-if-unsaved, Firestore offline persistence, local backup ring). Verified test-stale-save 6/6 (stale tab PERSISTS not drops, returns true, stamps newer version, version tracking) + 1216 logic + enr-tombstone 7/7 + camp 6/6 + delete-sport 13/13. app.js only (+ version). ⚠ DEPLOY + HARD-REFRESH ALL devices/tabs so none is left on an older build. 6.312.0 MEMBERS DATE-RANGE FILTER + CREATED COLUMN. (1) New From–To date picker in the Members filter bar with a basis toggle: 📅 Enrolled (any sport start date) or 🗂 Created (DB record createdAt). filter.dateFrom/dateTo/dateBasis, persisted; ✕ clears; included in anyFilterActive + Clear-filters; helpers memberEnrollDates / memberCreatedDate. A member with no matching date (e.g. no createdAt when basis=Created) is excluded while a range is set. (2) New toggleable 'Created' column (def:false, enable via Columns) showing createdAt date + createdByName; blank for the ~230 legacy members with no timestamp. Verified on the owner's DB (test-date-filter 5/5): enrolled range subset-consistent, created-basis returns only the 127 members that HAVE a createdAt, no un-stamped member leaks in, screen renders; + 1216 logic. pages.js only (+ version). 6.311.0 MEMBERS EXPIRY FILTER — the "Any expiry" dropdown's single "Expiring ≤ 7 days" is now THREE windows: "To expire ≤ 3 days", "≤ 7 days", "≤ 30 days" (values d3/d7/d30; legacy 'soon' still maps to ≤7). Matches an ACTIVE membership whose expiryDate is 0..N days out, excluding Frozen (paused, not counting down). Verified on the owner's DB: ≤3d=7, ≤7d=8, ≤30d=113, monotonic 3⊆7⊆30, no expired/frozen leak, screen renders, 1216 logic. pages.js only (+ version). 6.310.0 CAMP INVOICE / PROFILE DOUBLING — ROOT FIX (found on the owner's real DB). A Summer-Camp invoice line was cloned (e.g. Hossam INV639107: two 'Summer Camp 1400' lines = 2800 while header=1400, so card TOTAL 3600 + balance 'amount+paid' 2200 + red 🧾). ROOT: the two lines were byte-identical EXCEPT coach:null vs coach:'—'. `_enrKey` (the content key used by BOTH the sync element-merge AND the dedupe guard) did NOT ignore `coach` — a DISPLAY string derived from coachId that flips null/'—'/name across creation paths (registration writes coach:coachName()→'—' for a coachless sport like camp; the edit/pricing path writes coach:null). So the two lines keyed DIFFERENTLY → the merge doubled them + the dedupe guard couldn't collapse them. FIX: `_enrKey` now ignores `coach` (coachId still distinguishes real coaches) → merge stops doubling AND `_dedupeSubsGuard` collapses the existing doubles on save + auto-heal-on-load; invoice.amount is NEVER touched so revenue only corrects DOWN to the true figure. Tested ON THE OWNER'S DB (test-camp-double 6/6): all 6 doubled camp invoices collapse, Hossam→single 1400 line, billed drops only the fake dup lines (154,577→145,727), ZERO header amounts changed, different-coachId lines still kept; + prior tombstone 6/6, enr-tombstone 7/7, delete-sport 13/13, inv-health 4/4, 1216 logic. DEPLOY as admin + hard-refresh → auto-heal cleans the 6 invoices in place (do NOT import). 6.309.0 INVOICE-HEALTH: compare CURRENT membership only (fix false red on a renewed/switched sport). memberInvoiceHealth flagged e.g. Hossam "Summer Camp: invoice 400 ≠ profile price 1800" because a renewal leaves the OLD period's enrollment behind (expired 1-week camp @400 next to the active 1-month @1400) and the check (a) SUMMED all enrollments per sport (400+1400=1800) and (b) checked the EARLIEST invoice (the old 400 one). FIX: take the LATEST enrollment per sport (by start date, NOT the sum) as the current profile price, and check the most RECENT membership invoice (a renewal supersedes the old one). Genuine price mismatches on the current membership still flag red. Read-only advisory, no data mutation. Verified test-invhealth-renewal 4/4 (renewed member now green; real 325-vs-300 mismatch still red; clean + two-distinct-sports green) + 1216 logic. pages.js only (+ version). 6.308.0 DELETED SPORT NO LONGER BOUNCES BACK (enrollment delete now sticks). ROOT CAUSE of "I delete one sport and it reappears": the delete-tombstone that makes a delete survive a stale/concurrent sync (v6.303) only covered UNIQUE-ID rows (id/rid/sid/pid). An ENROLLMENT has no stable id — it's keyed by CONTENT (s:…) — so it was NEVER tombstoned, and the element-merge re-added Raed's MMA from the still-in-cloud copy on the delete's own write (and a second open tab pushed it back too — the "updated on another device" banner). FIX: content-keyed rows can now be tombstoned with a PER-RECORD SCOPE ('members:270:enrollments|s:<key>') so a delete sticks without ever dropping an identical row on ANOTHER member. _mergeArrayById + _mergeRecord take a `scope`; the cloud WRITE (storage.js txnset) passes 'name:id:field', and the READ merge (_mergeCollection→_mergeRecord) passes 'collKey:id' — so the tombstone is honoured on BOTH the write and the read paths. deleteMemberSport now tombstones every enrollment + subscription it removes (scoped). Verified: test-enr-tombstone 7/7 (delete sticks vs stale cloud; identical MMA on another member NOT dropped; id-keyed sub tombstone still works; end-to-end deleteMemberSport→merge keeps MMA gone; read-side stale-tab push blocked), plus prior tombstone 6/6, delete-sport 13/13, attendance-carry 11/11, 1216 logic (same 4 pre-existing DATE fails). ⚠ DEPLOY TO EVERY DEVICE + HARD-REFRESH ALL TABS (a stale old tab keeps re-adding). 6.307.0 ATTENDANCE CARRY ACROSS RENEWAL + DELETE ANY SPORT. (1) ATTENDANCE GAP CARRY (forward-only, effective 2026-07-06 via CONTIGUOUS_ATTENDANCE_FROM): when a member renews AFTER a package expired, the new package's attendance window now starts the day AFTER the old package's END, so classes attended in the gap (after old expiry, before the new start) count toward the NEW membership instead of being lost. Cut = the OLD package's end date. GATED by date so ALL historical attribution + already-settled coach commission is unchanged. Date math done in UTC (setUTCDate) to avoid a local-timezone off-by-one. Carry-forward of unused classes stays MANUAL as today (cap 2). (2) DELETE ANY SPORT — an enrollment-only sport (no subscription, no invoice line — e.g. a leftover MMA after a MMA→Boxing switch) was UNDELETABLE: the 🗑 chip existed but deleteMemberSport bailed with "No history found" (it only checked subs+invoice-lines). FIX: deleteMemberSport now also treats an ENROLLMENT as removable history (hasEnrollment guard) so the delete proceeds (strips the enrollment + its 0 attendance); AND the "🧹 Manage sport history" panel now lists enrollment-only sports too. So every sport a member has is visible + deletable. Verified: test-attendance-carry 11/11 (gap absorbed into new package: new window 1 Jul, old stays 8/12; forward-only: pre-cutoff renewal unchanged; MMA listed + removed, Boxing payment 325 + attendance intact), pages.js/app.js syntax OK, 1216 logic pass (same 4 pre-existing off-by-one DATE tests unrelated). Builds on 6.306. 6.306.0 DELETE SPORT FROM HISTORY — full & safe. A sport a member was SWITCHED AWAY from (e.g. Raed MMA→Boxing) survives as an ENROLLMENT with no subscription, so it never shows in Subscription History (no 🗑) and drove the phantom "+1 sport" / red 🧾. It DOES appear in the member card's "🧹 Manage sport history" (admin) → Remove (deleteMemberSport, by sport name); that path had TWO defects, both fixed: (1) DATA-LOSS — it prorated the surviving sport's payments off the invoice's STALE header amount (Raed 325) instead of the true line-items gross (650), so removing MMA computed factor=0 and WOULD HAVE WIPED Boxing's 325 payment to zero; now proration is based on the line-items sum (and self-heals the stale header). (2) ATTENDANCE NEVER DELETED — the confirm dialog promised it removed the sport's attendance but the code didn't; now it calls _clearSportAttendanceWindow (all that sport's marks) + reports the count in the toast/audit + stampUpdate. Verified: test-deletesport 13/13 (real Raed: MMA gone, Boxing payment PRESERVED 325 not 0, invoice self-heals 325, Boxing attendance intact, no MMA attendance left; synthetic switched sport WITH attendance: attendance removed + surviving sport prorated right), pages.js/app.js syntax OK, 1216 logic pass (4 pre-existing off-by-one DATE tests unrelated). pages.js + this version string only; storage.js UNCHANGED. 6.305.0 INVOICE LIST: show by PAYMENT month too + EXPORT DETAILED. (1) The invoice-list month filter now shows an invoice under a month if a PAYMENT (installment) was recorded that month, in addition to its revenue month — e.g. a June camp paid off on 4 July now appears when filtering July. LIST-ONLY (extra OR in the PAGES.invoices filter): invoiceMonthShares / revenue is UNTOUCHED (the July payment adds 0 to July revenue — verified: July share = 0). (2) New '📄 Export Detailed' button beside Export on the Invoices screen — exports the SAME filtered invoices with FULL payment history (one row per payment: date, month, amount, method, entered-by). Read-only. Verified 5/5 on live data (INV639087: June revenue + July payment shows in both, revenue unchanged) + PAGES.invoices renders (proven vs the pre-edit build) + 1216 logic. Invoice Integrity module untouched. 6.304.0   // 6.304.0 MEMBER INVOICE-HEALTH LIGHT — new read-only 'Invoice' column on the Members screen (default-visible, toggleable). Per member (scoped to the 1-Jun-2026 kick-off; pre-June/legacy left alone = blank): 🧾✓ green = the membership invoice matches (all current sports on the invoice, each sport's line price == the profile/enrollment price, total == line-item sum), 🧾! red = a conflict, 🧾— amber = no invoice yet. Sortable (reds group at top) + searchable (type 'conflict'); click opens a popup listing exactly what's wrong + Open-member. window.memberInvoiceHealth / window.showMemberInvoiceHealth, both guarded (never throw → members table can't break). Calibrated on live data: 140 in-scope → 130 green / 8 red / 2 amber (real issues: Summer-Camp price mismatches, Almerri family sports not invoiced). Verified: PAGES.members renders without throwing, health counts match, 1216 logic + tombstone 6/6 + one-per-sport 7/7. READ-ONLY, no data mutation. 6.303.0   // 6.303.0 DELETE STICKS + confirmed success. A deleted list row (e.g. Kenan's phantom 2nd Football subscription he never paid for) bounced back because the sync merge saw the still-in-cloud copy as a fresh remote ADD and re-added it — so 'Deleted' was a lie. FIX: DELETE TOMBSTONES — _mergeArrayById remembers a removed UNIQUE-ID row (id/rid/sid/pid) for ~6min (window.__elTomb) and refuses to resurrect it from a stale sync; content-keyed rows are left alone (they'd collide across records + are kept unique by the dedupe guards). deleteSubscription now explicitly tombstones (window._tombstoneEl) AND uses write-through (withCloudConfirm) so 'Deleted' only shows after the CLOUD confirms — a success message = real success. Verified: tombstone 6/6 (delete sticks across a later stale sync; genuine remote adds still kept; concurrency preserved), one-per-sport 7/7, stick 6/6, concurrency 8/8, 100-writer soak 0 lost, 1216 logic. 6.302.0   // 6.302.0 ENROLLMENTS = ONE PER SPORT (fixes 'duplicate sport I deleted keeps coming back'). Content-dedup (6.299/6.301) missed near-identical same-sport enrollment rows that differ in a hidden field (e.g. Kenan's 2nd 'Summer Camp' with a durationLabel) — so the duplicate sport survived + a delete of it bounced back. _dedupeSubsGuard now collapses enrollments to ONE per sport (the app's own invariant per _enrollmentsMatchSubs), keeping the row whose coach matches the active subscription. Runs on save + after every mergeRemoteIntoState, so it holds across syncs. Health check now flags repeated-sport too. Verified: one-per-sport 7/7 (Kenan 3->2, re-inject collapses, coach-correct kept, real backup 428->424 with 0 dup-sport left, REVENUE 140452 UNCHANGED), stick 6/6, concurrency 8/8, 1216 logic. 6.301.0   // 6.301.0 MAKE CLEANUP STICK — _elKey (merge key for id-less rows) now uses the SAME canonical _enrKey as _dedupeSubsGuard (ignores transient _originalSport/_paid/_attended + sorts keys). Before, the cleaner removed a drift-dupe but the sync merge (keyed by raw _stableStr) RE-ADDED it → enrollments/line-items 'bounced back' after cleanup (subscriptions stuck because both used _sid). Now merge + cleaner agree, so the merge itself self-dedupes id-less rows AND a belt-and-suspenders _dedupeSubsGuard() runs after every mergeRemoteIntoState. Payments unaffected (no ignored fields). Verified: STICK 6/6 (deduped-local vs doubled-cloud stays 1), concurrency 8/8, dup-subs 9/9, revenue UNCHANGED, 1216 logic. 6.300.0   // 6.300.0 INVOICE LINE-ITEM DEDUPE (+ enrollments). ROOT of the whole saga = PERMISSION_DENIED Firestore rules blocked every write, so cleanups never persisted + the merge kept re-doubling id-less arrays. Rules now fixed (owner published corrected ruleset). Remaining: id-less arrays doubled by the sync/import merge — subscriptions (fixed via _sid 6.295), enrollments (6.299), and NOW invoice lineItems[]. `_dedupeSubsGuard` extended to also collapse EXACT-content duplicate invoice line-items via _enrKey — NEVER touches invoice.amount, so REVENUE cannot move (only the redundant line rows go, so line-sum returns to match the correct stored amount). CRITICAL: do NOT let the Invoice-Checker "Update all" run while doubled — it would set amount = doubled line-sum (≈2× revenue). 🩺 Data Health Check + _dataHealthCheck now report duplicate line-items too. VERIFIED on the owner's real live backup (2): enrollments dup 1678→0, line-items dup 208→0, invoices amount≠line-sum 172→1, ATTENDANCE 1602=1602, REVENUE 140,451.95 → 140,451.95 UNCHANGED. DEPLOY (do NOT import — importing an old snapshot into the live cloud is what doubled the line-items via merge); auto-heal-on-load cleans everything in place. 6.299.0 ENROLLMENT DUPLICATES FIX — the SECOND duplicated array. Besides subscriptions[], each member has enrollments[] (headline sport rows), which ALSO duplicated (real backup: 934 dup enrollment rows / 31 members — Moamen 220 Kick Boxing, Mayar 254). The 6.296 backstop only covered subscriptions, so enrollments stayed bloated even after cleanup (the "Keep one" duplicate-enrollments screen still showed them). FIX: _dedupeSubsGuard now ALSO collapses duplicate enrollments — no stable id, one-per-sport by design, so EXACT-content clones (via _enrKey sorted-key signature, ignoring volatile _originalSport/_paid/_attended) are always redundant; a genuinely different enrollment (diff coach/classes/dates) has a different signature → KEPT. Runs on every save + auto-heal-on-load. Verified on the real backup: enrollments 1358→428 (930 collapsed), Moamen 220→1, ATTENDANCE UNTOUCHED (1602=1602), 0 dupes left. The 🩺 Data Health Check + _dataHealthCheck now report BOTH subscription AND enrollment dupes; Repair (_applyDataRepair) backs up → runs the full guard → saves confirmed. Also DATA HEALTH CHECK — makes stability VERIFIABLE, not a matter of trust. Settings → Data → "🩺 Data Health Check" (pages.js showDataHealthUI/_dataHealthCheck): one-glance panel that scans the exact things that ever caused trouble — duplicate subscription rows (by _sid), records approaching Firestore's 1 MB limit (≥800 KB), and total data size vs the browser's ~5 MB local cache — shows 🟢 healthy / 🔴 needs-repair, and offers a one-click loss-free "🔧 Repair now" (reuses the _sid-safe dedupe + write-through save; attendance/money untouched, backup taken first). Same check + auto-repair already run on every save (backstop) and on load (auto-heal), so it STAYS green. Verified on the real bloated backup: reports 9,646 dup rows + 3 oversized + 72% cache → after repair 🟢 0 dup, 0 oversized, 12% cache (3.59 MB → 0.62 MB). Completes the permanent no-loss/no-dup stability stack (6.288 element-merge, 6.289/6.293 write-through+retry, 6.295 _sid merge key, 6.296 dedupe backstop, 6.297 auto-heal-on-load, 6.298 parent-doc hotspot removed + size guard). Verified: health 8/8, parent-write 5/5, retry 14/14, backstop 7/7, dup-subs 9/9, concurrency 8/8 (100-writer soak 0 loss), salary 13/13, 1216 logic. 6.298.0 STABILITY HARDENING (for 100 concurrent users + 1k members). (1) PARENT-DOC HOTSPOT REMOVED: every save used to also write the single shared clubs/blackstars doc (it stamped _updatedAt each time) — with many simultaneous writers that one doc exceeds Firestore's ~1 write/sec/document soft limit → contention + failed saves. Now storage.js compares meta WITHOUT _updatedAt and only writes the parent when a REAL settings/version field changes; routine saves (attendance, payments, members) never touch it. Stale-version guard still works (a version bump changes meta → parent written). Verified 5/5 (routine save = 0 parent writes; settings/version change = 1). (2) DOC-SIZE SAFETY NET: _flushWrite warns loudly (console + admin toast, throttled) the moment any record reaches ~900 KB, naming it, so a runaway field is caught and cleaned long before it hits the hard 1 MiB limit and starts failing every write (what the duplicate bloat did). Non-destructive. Builds on the already-shipped no-data-loss + no-duplication stack: _sid-aware _elKey (6.295), dedupe-on-save backstop + _sid cleanup tool (6.296), auto-heal-on-load (6.297), write-through confirm + auto-retry + persistent retry banner (6.289/6.293), two-strikes delete + confirmed-only sync base (6.258/6.290), element-level list merge (6.288), local IndexedDB backup ring. Verified: parent-write 5/5, retry 14/14, backstop 7/7, dup-subs 9/9, concurrency 8/8, salary 13/13, 1216 logic. REQUIRES Firebase Blaze plan for 100 users (free tier's 50k-read/20k-write daily caps would throttle). 6.297.0 SAVE-ERROR ROOT CAUSE = OVERSIZED DOCUMENTS. The "error while saving from different machines" is a CONSEQUENCE of the duplicate-subscription bloat: three member docs (the Shehata siblings, ~3,060–3,126 clone rows) reached 1,047,736 bytes = 99.9% of Firestore's HARD 1,048,576-byte (1 MiB) per-document limit. Any further write to them (one more clone, or an attendance mark growing dailyAttendance) exceeds 1 MiB → Firestore REJECTS the whole write with invalid-argument → every machine touching them errors, and the v6.293 auto-retry keeps retrying so the banner shows everywhere. FIX: the v6.296 backstop already shrinks these on the next save (3,126→1 = ~1 MB → a few KB); v6.297 adds AUTO-HEAL ON LOAD — an admin device, on load, runs _dedupeSubsGuard() and if it collapses anything, saves immediately (via saveConfirmed) to shrink the oversized docs without waiting for an edit; the shrunk records then propagate to every other machine via sync, clearing the errors fleet-wide. One-shot (only when dupes present), admin + cloud only (member/coach logins are read-scoped). The shrunk write succeeds because the payload carries the deduped 1-row array (Firestore merge replaces the array). Verified: backstop 7/7 on real data (10,107 subs → 461), dup-subs 9/9, concurrency 8/8, retry 14/14, 1216 logic; doc-size measured from the real backup. DEPLOY TO EVERY MACHINE + HARD-REFRESH — a lingering old tab keeps generating clones + oversized writes. 6.296.0 DUPLICATE-SUBSCRIPTIONS BACKSTOP (permanent). On the user's real data 30 members had duplicate subscription rows — worst 3,126 identical Kick Boxing clones, 9,647 total. All clones share ONE `_sid` (a UNIQUE per-row id), so they are provably the SAME subscription cloned, never a legit twin (which gets its own _sid). The v6.288 element-merge + v6.295 _elKey fix stop the sync engine from ever cloning; but the ORIGINAL creation path (a non-merge append, not pinned) could in theory still add copies in memory. BACKSTOP: `_dedupeSubsGuard()` runs inside save() on EVERY write and collapses same-`_sid` subscription rows to ONE (keeps the most-attended) — so duplicates can never PERSIST or regrow, whatever created them. Self-healing: the first save after deploy auto-cleans every bloated member (verified on the real backup: 10,107 subs → 461, Moayad 3,126 → 1, idempotent). SAFE: `_sid` is unique per row so genuine family/twin rows (distinct _sid) are preserved (the signature-based v6.295 tool WOULD have merged them — now the manual tool `_scanDuplicateSubs` also keys by _sid to match). Cheap: only rebuilds a member's list when a duplicate _sid is actually present. Attendance untouched (lives in dailyAttendance). Verified: backstop 7/7, dup-subs 9/9, concurrency 8/8, retry 14/14, 1216 logic. 6.295.0 DUPLICATE-SUBSCRIPTIONS FIX ("attendance redundant infinite" — same sport row cloned over and over on a member card). ROOT CAUSE: the v6.288 element-merge keys list items via _elKey, which knew id/_rid/pid but NOT `_sid` (subscriptions' stable id) — so a subscription fell back to being keyed by its whole CONTENT. The moment any field changed (an attendance tick bumps attendedClasses) a concurrent merge saw the edited row as a NEW element and kept BOTH copies → one clone per sync, unbounded (reproduced: 6 rounds → 7 rows). FIX (2 parts): (1) ROOT — _elKey now returns `sid:<_sid>` so an edited subscription stays the SAME element (proven: 6 concurrent edits → 1 row; genuinely distinct _sid rows like family/twins preserved). (2) CLEANUP — admin tool Settings → Data → "🧹 Fix duplicate subscriptions" (window.showFixDuplicateSubsUI/_scanDuplicateSubs/_applyFixDuplicateSubs): scans every member, previews who has duplicate rows + how many, and on confirm collapses each identical set (same sport+start+end+coach+classes+validity+price) to ONE. SAFE/loss-free — attendance lives in dailyAttendance (sport+day), not on the row; downloads a backup first; saves via write-through. Verified: dup-subs 9/9, concurrency 8/8, retry 14/14, 1216 logic tests. Run the cleanup ONCE on the main device after deploy. 6.294.0 NO-FLICKER LIVE SYNC — another user's change no longer yanks/jumps your screen while you work. Root cause: any remote snapshot called a full render() with NO scroll preservation, and the "don't interrupt" guard only covered an open modal / focused field — plain reading/scrolling/hovering was re-rendered under you; with 2+ active users this fired constantly ("pages keep refreshing"). FIX (app.js sync block): (1) activity tracker — passive pointerdown/keydown/wheel/touchstart/scroll/mousemove stamp window.__lastInteractAt; isBusyEditing() now also returns true if you interacted within ACTIVE_MS (3.5s), so while actively working NO redraw happens (data still merges silently in state + shows the subtle "Newer data — Refresh" note). (2) _renderKeepScroll() captures _getScroll() → render() → restores _setScroll(y) via rAF, so an idle redraw updates in place instead of snapping to top. (3) coalesce — a burst of remote snapshots collapses into ONE redraw after a 400ms quiet gap (re-checks busy first); the 1500ms idle sweep also uses _renderKeepScroll. Data path/merge/schema UNCHANGED (view-timing only). 1216 logic tests, syntax OK. 6.293.0 WRITE MONITOR — every cloud write is now centrally monitored so NO write can silently fail. (1) storage.js: real AUTO-RETRY engine — a failed write re-flushes the same delta with backoff (2s→5s→15s→30s→60s) until it lands; base is not advanced on failure so nothing is lost; `_clearRetry` on success, no over-retry. (2) new `Storage.retryNow()` (force an immediate attempt) + `Storage.hasUnsavedCloud()` (true while a change is on-device only). (3) app.js: the failure UI is now a PERSISTENT non-dismissable banner ("Your last change is NOT saved to the cloud — Retrying automatically…") with a working "↻ Retry now" button (calls Storage.retryNow, clears on success); torn down centrally the instant any write reaches the cloud (phase:'saved'). (4) beforeunload guard — if hasUnsavedCloud() is true, the browser's native "Leave site?" prompt blocks an accidental refresh/close that would drop the change. Covers ALL ~180 write sites at once (they all funnel through one flush) — the always-on Saving/Saved pill stays as the per-write confirmation. Verified: 14/14 retry-engine harness against the REAL storage.js (fail-twice→auto-recover, retryNow, no over-retry), salary review 13/13, 1216 logic tests. 6.292.0 CRITICAL — Firestore "invalid-argument" write failure (salary/records not saving). ROOT CAUSE of "paid, then gone after refresh": Firestore REJECTS any write containing an `undefined` field value ("invalid-argument"). The salary 'paid' record was built with `settledPending: pendingPaid || undefined` + `settledSubs: settledCount || undefined` (both undefined when there's no pending — e.g. a Summer-Camp fixed salary), and `_salSetTarget` set `rec.target = undefined` — so the write threw and the WHOLE save failed; the record showed paid locally but never reached the cloud → gone on refresh. (This was silent before 6.289's write-through, which now correctly SURFACES the failure — the error toast the owner saw was the guard working, not a new bug.) FIX (two layers): (1) storage.js — `db.settings({ ignoreUndefinedProperties: true })` at init, so a stray undefined field anywhere is OMITTED instead of failing the entire write (global; protects every record type). (2) pages.js — `_salEnsureRec` omits settledPending/settledSubs when 0 (conditional spread) and `_salSetTarget` does `delete rec.target` instead of `= undefined`, so salary records never carry undefined. Verified: created paid record has ZERO undefined-valued keys (Firestore-safe), salary review 13/13, 1216 logic tests, syntax OK. ⚠ Deploy + HARD-REFRESH every device. 6.291.0 SALARY REVIEW FIX — "Settle pending in full" underpaid the coach. The salary Pay modal's "Settle pending in full now" checkbox (attendance basis) was only READ in _salAddPay + rendered — nothing raised the payout when ticked. So ticking it settled the pending (marks each sub commissionSettled so it never pends/trues-up again) but only paid the NET (the sp-target/sp-add-amt inputs stayed at net), silently UNDER-paying the coach by the whole pending amount. FIX: the checkbox now has onchange="window._salToggleSettle(this.checked, pay.net, pay.commissionPending)" which sets the Agreed payout (#sp-target) AND the first payment amount (#sp-add-amt) to net+pending when ticked, and back to net when unticked (rounded whole QAR). Found during a full salaries-module review: 13/13 invariant+edge-case asserts (net formula, paid-total/status, no negative payments, bonus override, multi-payment, advance, carry conservation) + settle-pending 8/0 + frozen-commission 5/0 + 1216 logic tests all PASS; the delete/cleanup flows (_salDelPay, Clear-all, _salSetTarget, markPaid) verified to remove the linked salary auto-expense correctly. Verified live: tick → payout net+pending, untick → net. pages.js only, no Firestore rules change. 6.290.0 SALARY/RECORD LOSS FIX — "green message but gone after refresh". TWO root causes: (1) MERGE FALSE-DROP: _mergeCollection treated a record's absence from ANY single remote snapshot as a delete, so a freshly-saved record (paid salary) could be dropped by a stale/partial multi-listener snapshot → the next save then wrote a DELETE → gone on refresh. FIX = TWO-STRIKES delete confirmation: a confirmed record (in base, unchanged locally, now missing remotely) is only dropped after it's absent for TWO CONSECUTIVE syncs; module `_delStrikes` Map (key 'collection|id') carries the "was confirmed, now missing once" state across the base advancing (the strike itself, not just inB, drives the 2nd-absence drop), so genuine deletes still propagate while a single stale snapshot NEVER deletes; strike cleared the moment the record reappears in any remote; a never-confirmed fresh local add is never given a strike (always kept). _mergeCollection now takes a collKey; mergeRemoteIntoState passes the collection key. (2) BLOCKED-SAVE FALSE-CONFIRM: when a tab runs an OLDER version than the cloud, the stale-version guard blocks save() — but save() returned undefined and the 6.289 write-through reported {ok:true} (false green "saved"). FIX = save() returns false when blocked (stale-version); saveConfirmed() returns {ok:false,'refresh needed'} so withCloudConfirm WARNS instead of falsely confirming. Verified: scratchpad/repro-salary-loss.js (the drop case now survives, 3/3), the "DATA-LOSS FIX" + "merge: remote delete" tests in logic-tests updated to assert two-strikes (1 absence keeps, 2 drops) → 1216 pass, concurrency fix still 8/8, clean boot. ⚠ Deploy + HARD-REFRESH every device — a stale tab is the likely trigger. No Firestore rules change. 6.289.0 WRITE-THROUGH CONFIRMATION (persist to cloud before proceeding) for the backbone actions. New capability: storage.js public `saveAndConfirm()` flushes the queued state NOW and returns a Promise that resolves ONLY when Firestore acknowledges the write ({ok:true} incl. offline/local durable, else {ok:false,error}); firebase backend `saveConfirmed(state)` + `_confirmWaiters`/`_lastFlushResult` resolve waiters once the whole write chain drains (handles the in-flight/pendingAfterWrite queue + the nothing-to-write case). app.js `saveConfirmed()` (save()+await Storage.saveAndConfirm) + `withCloudConfirm({btn,onOk,onFail,okMsg})` — shows "⏳ Saving…", waits for the ack, proceeds on success or WARNS loudly + does NOT proceed on failure (data stays safe locally + auto-retries, but the user knows it isn't synced). WIRED: salary payment `_salAddPay` (await cloud ✓ before re-opening the manager), member EDIT save (await ✓ before closing; on failure keeps the form open + warns), invoice payment/pricing commit (`editMemberPricing` → confirm + warn), attendance `applyMark` (non-blocking confirm per mark + warn if it didn't reach cloud). Verified in-browser: all three fns live and resolve {ok:true} when durable; the FAILURE path returns false, skips onOk, fires onFail (never falsely reports saved) + 1214 logic tests + concurrency fix still 8/8 + clean boot. SCOPE: new-member registration + a few minor save sites still use plain save() + the global save-error guard; can extend on request. No Firestore rules change. Builds on 6.288.0's element-level list merge. 6.288.0 CONCURRENCY DATA-LOSS FIX — element-level LIST merge (multi-user safety). Root cause of "invoices/member data sometimes lost when two people work at once": Firestore merge:true REPLACES arrays wholesale, so two staff adding to the SAME record's list within ~1–2s (invoice payments/lineItems, member subscriptions/enrollments, salary payments) overwrote each other. FIX (end-to-end, no schema migration): (1) storage.js _flushWrite — a record whose delta changes ANY array field is now written inside a Firestore TRANSACTION (kind:'txnset') that re-reads the live cloud doc and merges each list BY ELEMENT id via window._mergeArrayById(base,local,cloud), so a concurrent add/edit on another device is preserved (auto-retries on contention); non-list fields stay field-level; falls back to the old path if the merge helper isn't loaded. (2) app.js — new _mergeArrayById (3-way list merge by _elKey = id/_rid/pid/content: adds from either side kept, edit conflict favours local, a removal honoured only if the other side didn't touch it) + _mergeRecord (element-merge arrays, deep-merge maps, scalar 3-way); _mergeCollection's conflict branch now uses _mergeRecord instead of "keep local wholesale" so every device's VIEW converges to the union too. Attendance (nested map) was already safe (Firestore deep-merges maps) and stays safe. Verified: 8/8 concurrency asserts on the REAL merge fns (invoice+member concurrent-add now keep ALL entries, removal honoured, same-element edit → one wins none lost, client merge unions lists + accepts remote scalar) + 16/0 multi-doc & attendance-concurrency test + 1214 logic tests (incl. the 6.258 data-loss adversarial test) + clean boot. No Firestore rules change. DEPLOY TO EVERY DEVICE. 6.287.0 MEMBERS — ENROLLMENT-MONTH FILTER (multi-select). New 📅 month dropdown in the Members filter bar (next to Sport, All/Clear + checkboxes) that keeps members who ENROLLED in any selected month, where "enrolled = membership/sport START date". Helper memberEnrollMonths(m) = the set of 'YYYY-MM' from every subscription.start (+ enrollment.start), falling back to m.startDate/joinDate when a member has no subscriptions — so a member with several sports/renewals matches several months. The dropdown lists only months members actually enrolled (distinct, newest first, derived from all non-deleted members). filter.enrollMonths (persisted via loadFilter/saveFilter), applied in the members predicate (any selected month intersects the member's enroll months), wired via wireMultiFilter, included in DEFAULT_F/anyFilterActive/Clear-filters. Verified live (4 members: Ali=Jun, Omar=May+Jun, Noor=Jul, Legacy=Jun via startDate → Jun shows Ali/Omar/Legacy, Jun+Jul shows all 4) + 6/6 logic asserts + 1214 logic tests. No Firestore rules change. 6.286.0 SALARY PAY FIX #2 — LEGACY over-advanced record (pay full amount but stays "partial/not paid"). Found on the real backup: legacy 'paid' records (paidDate + snapshotNet, no payments[]) whose snapshotNet is NEGATIVE (coach was over-advanced when the month was settled) — e.g. Aziz June snapshotNet −178, net since grown to +2220. The old code turned that −178 into a synthesized "payment", so paying the full net (2220) totalled −178+2220=2042 < 2220 → stuck "partial". FIX (3 consistent guards, a negative/stale snapshotNet is never a real cash payout): (1) salaryPayments — legacy synth amount clamped to Math.max(0, snapshotNet); (2) salaryTarget — ignores snapshotNet ≤ 0.005 and falls back to the LIVE net (so the agreed payout = what's actually owed now, 2220 not −178); (3) _salEnsureRec migration — seeds a prior payment only when snapshotNet > 0.005 (positive legacy payments preserved), else []. Verified on the real 2026-07-04 backup: Aziz re-pay 2220 → PAID (was partial 178 left); positive legacy records keep their payment; genuine partial 500/908 still partial; fractional 117.3 still paid; 1214 logic tests. A legacy month with net 0 still shows Pending harmlessly (nothing owed). No Firestore rules change. Complements 6.282.0 (fractional-rounding PAY_EPS). 6.285.0 COACH READ-ONLY SCREENS: My Salary + Attendance Report. Two new coach-only routes (coachsalary/coachattendance, both coachOnly + added to ROLE_ALLOWED.coach; hidden from admin's own menu, shown to coaches + admin-preview). (1) 💰 MY SALARY (PAGES.coachsalary, Main) — the coach's OWN earned pay, READ-ONLY: month picker + KPIs (Gross=fixed+commission, Pending commission, Net + paid/partial/pending badge), a Commission-by-member table (member·sport·classes·base·commission from computeMonthlyPay.attendanceLines), a Pending table (paid-but-unattended), a Monthly-history table, and a ⬇ Payslip PDF (their own via downloadRevenueDetailPDF). NO Pay/advance buttons — recording payment stays admin-only. window._csMonth persists the selected month. (2) 📋 ATTENDANCE REPORT (PAGES.coachattendance, Activities) — the coach's OWN students' attendance, READ-ONLY, scoped to coachStudents()+their sports: month picker (or All months) + KPIs (my students, classes attended, rate), a per-student table (student·sports·attended·marked·rate%·last attended, low-attendance ⚠). Marking still happens on the Attendance screen (coach-locked to today). Both self-scope via effectiveCoachId()/myCoach() and show the shared _coachUnlinkedHtml banner when the account isn't linked. Verified: live in-browser via preview-as-coach (menu shows both, salary renders commission-by-member+history with NO pay button, attendance renders per-student table, zero console errors) + 15/15 render-harness asserts (routes coach-scoped, student blocked, content, unlinked fallback) + 1214 logic tests. No Firestore rules change. 6.284.0 COACH DIGIT-EMAIL LOGIN FIX (⚠ RE-PUBLISH FIRESTORE RULES). A coach onboarded as <mobile>@blackstars.com has an ALL-DIGIT email — the MEMBER portal pattern — so both the client read-scoping (storage.js) AND the Firestore rules (isMember) treated the coach as a MEMBER: her browser never loaded the `coaches` collection, so the app couldn't link her to her coach profile → "Coach (unlinked)" dashboard, and attendance showed all days/sports (the today+sport lock only fires once she's a recognized coach). FIX: recognize staff by the Users & Roles map, not the email shape. A digit-email the admin MAPPED to coach/admin/receptionist is now STAFF (loads full data; UI stays scoped to that person). storage.js load() reads settings.userRoles first and only member-scopes an email NOT mapped to a staff role. firestore.rules + tools/firestore-rules-recommended.txt: isMember() now excludes mapped-staff via get() on the settings doc (lookup runs only for digit-emails; missing settings/map fall back safely; NON-ESCALATING — only grants staff access to admin-mapped emails, never gives a member more). MUST RE-PUBLISH firestore.rules in the Firebase Console for the server side to take effect. Verified: 8/8 client scope-decision asserts (mapped coach/admin→full, mapped student/unmapped digit→member, named staff→unchanged, case-insensitive) + 1214 logic tests + syntax. Rules logic mirrors the verified client logic (no emulator here; Firebase validates rule syntax at publish). 6.283.0 INVOICE INTEGRITY — RE-LINK ORPHAN TO A MEMBER. The Orphans tab "Needs review" rows (a MEMBERSHIP invoice whose linked member was archived / the link broke — e.g. a duplicate member was deleted) gained a "🔗 Link" button beside Open. It opens a member-search modal PRE-FILLED with the invoice's snapshot name (so the surviving duplicate surfaces at once), searches name/mobile/QID, and lists ONLY active members (archived excluded so you can't re-attach to another deleted record). Picking one + Link re-points inv.customerId and refreshes the name/phone/Arabic-name/QID snapshot from that member — all amounts, payments and sport lines are kept, only the owner changes; stamped + audited ('invoice.relink'). Walk-in orphan rows do NOT get the button (they legitimately have no member). New window._icRelink(invId) in pages.js; orphanRowsHtml gained a canLink flag (true for orphanReal, false for orphanWalkin). Verified: browser end-to-end (INV638862 → active member, Orphans 1→0, archived duplicate hidden from picker) + 5-assert node harness + 1214 logic tests. 6.282.0 SALARY PAY STATUS FIX (stuck "not paid" after paying). A coach's net is usually FRACTIONAL (commission is a %, e.g. 30%×391=117.3) but the payment box defaults the amount to a WHOLE number (Math.round → 117); paying that left target 117.3 vs paid 117 → status stuck at "🟠 Partial · 0.30 remaining", never Paid — while the salary auto-expense (money out) still posted. FIX: computeMonthlyPay now treats a sub-1-QAR gap as fully settled (PAY_EPS=0.5): paidTotal ≥ target−0.5 → Paid, and paidRemaining snaps to 0 within that; markPaid's modal "remaining" matches. A GENUINE partial (e.g. 500/908) still shows Partial (verified). Self-heals existing stuck records on next render (no data edit). Fixed-salary coaches (whole net) were never affected. Verified: node repro on the real computeMonthlyPay/_salEnsureRec + modal-rounding (117.3 paying 117 → paid; 500/908 → partial; 908 → paid) + 1214 logic tests. 6.281.0 COACH SCOPING + IDENTITY + AVATARS. (1) FIX "coach screen not working": a coach account whose Users&Roles mapping had a missing/stale coachId showed "Unknown / 0 students" and silently disabled ALL coach-scoping. New myCoach() + effectiveCoachId() now SELF-HEAL by matching the login email → coach.email; login also heals + names the account (or "Coach (unlinked)"). If still unlinkable, coachhome shows a clear red how-to banner (Settings→Users&Roles→pick the coach) instead of a silent empty screen. This one fix re-activates the attendance/schedule/coachhome scoping that was dead while effectiveCoachId returned null. (2) ATTENDANCE already scoped to the coach's own sport+students (coachSportsFor) — now works via the heal. (3) SPORT-BASED AVATARS: coaches gained a Gender field; new coachAvatarHtml() shows the PRIMARY sport's emoji (sportIcon, reuses campActivityIcon: 🏊⚽🥋🤸🥊…) on a gender-tinted tile (male=blue #3870d0, female=pink #d13d8a, unset=neutral). Used in the sidebar user chip, coach-home header, and the Staff coach card. (4) HOVER A CLASS → MOST ACTIVE MEMBER: each of the coach's "Today's classes" now has a hover title tooltip + inline "⭐ Most active: <name> · <N>" badge (reuses topActiveMembersForClass). (5) COACH DATA ISOLATION: schedule/attendance/coachhome/advice all scope via effectiveCoachId(); the heal makes them show only the coach's own sports/students/figures. Verified: 12/12 coach-helper asserts (email-heal, avatar emoji+tint, top attendee, coachStudents), coach-home render harness (avatar+top-active badge+tooltip+my-students+heal), 1214 logic tests, zero boot errors, gender field renders. 6.280.0 SALARY NEGATIVE-NET CARRY-FORWARD. When a coach's Net Pay for a month is NEGATIVE (they were advanced more than they earned), the row's action button becomes "↩ Carry <amount>" instead of Pay. One click (with a confirm modal) SETTLES that month at 0 and rolls the over-advance into the NEXT month as an opening advance — recovered from next month's earned commission. Stored as ONE reversible record { kind:'carry', coachId, fromMonth, month:<target>, amount }; computeMonthlyPay CREDITS the source month (carriedOut) and DEBITS the target month (carriedIn), so net = gross − advance + carriedOut − carriedIn. The real cash handed out still shows in the source month's Advance column (nothing hidden); the credit/debit cancel in the "settle up to a date" cumulative view so it stays exact. Source month shows a grey "↩ Carried fwd" badge + "↩ Undo carry" button (removes the carry record, restoring the negative net); target month shows "↩ N carried in". New window fns carrySalaryForward / undoSalaryCarry + helper nextMonthKey(ym); audit 'salary.carry' / 'salary.carry_undo'. Verified live (Abdel Salam 384 gross / 760 advance → −376: carry settles Jun to 0, Jul net 384→8, undo restores −376) + 14-assert harness (net formula, cash conservation, undo, Dec→Jan rollover). 6.279.0 EXPENSE "AFFECTS MONTH" (accounting month ≠ payment date). The expense form gained an "Affects month" month-picker (f-month) — defaults to the payment date's month and auto-follows it until the admin overrides it (data-touched lock), then save stores month=that choice while date=the real payout day. So you can pay on 4 Jul but book it as June. Every expense report/filter already reads e.month, so it lands in the right month everywhere. SALARIES: the salary auto-expense (_salAddPay) now books to the SALARY month (monthKey), not the payment date — paying June salaries on 4 Jul shows as a June expense automatically (date keeps the real payout day). Handler _expDateChanged keeps f-month synced to the date until touched. 6.278.0 INVOICES date filter — search by INVOICE DATE *or* ANY ACTIVITY START DATE. New helper invoiceActivityStartDates(inv) (app.js) returns the day-level start date of every sport line (same subscription-picking as lineSportStartMonth); walk-in/unlinked invoices return []. The Invoices single Date picker AND the From/To range now match against [invoice date, ...activity start dates] — so an invoice with several activities on different start dates is found on each of those days (and its own date), and a range matches if EITHER the invoice date or any activity date falls inside it. Walk-ins match on invoice date only. Also: a picked day/range now overrides the month scope (the range already did) so it can find invoices in any month, not just the ticked one. 6.277.0 INVOICE INTEGRITY — Orphans tab smarter: only a MEMBERSHIP invoice must link to a member; a rental / product with no member is a legitimate WALK-IN, not a problem. The Orphans tab now SPLITS into "⚠ Needs review" (Membership with no/archived member, RED) and "✅ Walk-in invoices — no action needed" (rentals/products, GREEN), each with a Category column. The KPI + tab badge now show the REAL count (membership orphans) with "+N walk-in ok" noted separately. A 🙈 Hide walk-in / 👁 Show walk-in toggle (window._iiHideWalkin) collapses the green section; the red needs-review section always stays visible. On the real data this turns "13 orphans" into ~3 real + ~10 walk-in. 6.276.0 CASH IN HAND — EDIT option: each Count-history row now has an admin-only ✏️ Edit button beside 🗑 Delete. openCashCountDialog(existingId) pre-fills amount/date/by/note and UPDATES that entry in place (stampUpdate + audit 'cash.count_edit') instead of creating a new one; new-record behavior unchanged. Verified: edit updates in place (no duplicate row), stamps the editor. 6.275.0 INVOICE INTEGRITY — Missing tab quick filter: All / 🆕 Enrolled / ↩ Carry-forward chips (window._iiMissFilter) so the backlog can be worked by group. Display-only (filters which rows show; no data writes, detection logic unchanged). 6.274.0 INVOICE INTEGRITY — one unified tool (folds Invoice Checker + Missing Invoices into a single admin screen). The `invoicechecker` route is now labelled "Invoice Integrity"; the old `missinginvoices` menu item is HIDDEN (folded in, still deep-linkable). One shared month multi-selector + a 4-KPI band (Missing · Corrupted/drift · Orphans · scanned) drive THREE tabs (window._iiTab, switched via render()): (1) 🧩 MISSING — active members with no/short invoice, enrolled-vs-carry-forward badges, deduped by member, ⚡ Generate; (2) 📇 CORRUPTED/DRIFT — invoices whose stored name/phone/QID/amount drifted from the member → 🔎 Review (preview→approve/reject via _icPreview) + Update-all; (3) ⚠ ORPHANS — invoices with no usable member link. All the existing helpers are reused (computeMissingInvoices, _icInvoiceIssues/_icAmountIssue/_icPreview/_icFix, _miGen). Tests: the "insights: … Invoice Integrity" asserts in logic-tests.js. 6.273.0 MISSING INVOICES — now a full ACTIVE-MEMBERSHIP audit. computeMissingInvoices(ym) is rewritten to be SUBSCRIPTION-based: for the selected month it confirms EVERY member with a membership ACTIVE in that month has a covering invoice — whether they ENROLLED that month (a sub started in ym) OR CARRY FORWARD an active period that started earlier (sub window start..end overlaps ym). A subscription is COVERED when a Membership invoice is linked by ref OR billed within the sub's active window; it judges the LATEST period per sport (a renewal supersedes the old overlapping one). Rows carry basis = 'enrolled' | 'carry' shown as a badge (🆕 Enrolled / ↩ Carry-forward) with the carry-forward start month in the reason; the scope KPI shows the enrolled vs carry split. Enrolled-this-month members are still amount-checked (billed ≠ expected). Members with no subscriptions fall back to the old startDate/expiryDate check. Verified on the real 2026-07-03 backup — correctly surfaces that ~200 pre-June members carried forward with NO invoice on record (the club only began proper invoicing in June: 166 of 201 invoices are June), while covered members and renewals are not falsely flagged. Tests: the "missing-inv:" block in logic-tests.js. 6.272.0 INVOICE CHECKER — PREVIEW → APPROVE/REJECT. The per-row action on the Invoice Checker is now "🔎 Review" (not an instant Update): it opens a modal (_icPreview) showing a field-by-field BEFORE→AFTER table (name / phone / Arabic name / QID) PLUS, when the stored total drifts from the line-item sum, the Invoice total old→new AND the Balance (due) old→new with a ⚠ "this RAISES the balance owed by X — approve only if that sport is genuinely owed" warning. Nothing is written until the admin clicks "✔ Approve & update" (which runs the existing _icFix + stampUpdate + audit); "✕ Reject" closes with zero changes; "📄 Open invoice" is also there. Verified: Reject leaves the invoice untouched, Approve applies all diffs + the total. (The bulk "Update all" remains as an opt-in shortcut with its own confirm.) 6.271.0 FINANCIAL REGRESSION + ACCURACY. Full reconciliation of every financial number against INVOICES (the single revenue source) on the real 2026-07-03 backup: billed = collected + due holds EXACTLY at both the invoice level (134,951.96 = 122,426.96 collected + 12,525 due) AND for all 7 months (0 identity failures); Σ billedInMonth = Σ invoiceTotal; payment methods sum exactly to collected. Two real accuracy bugs found + fixed: (1) PAYMENT-METHOD CASING — 19 Summer-Camp payments were stored as capital "Cash", so a by-method breakdown split cash into "cash" (41,682.96) + "Cash" (11,310) buckets. FIX: new global normalizeMethod(m) → cash|card|fawran|transfer; recordPayment normalizes on WRITE (the single choke point); the camp path now writes 'cash' not 'Cash'; and a Cleanup-Center card ("Non-standard payment methods" → normalizeAllMethodsUI) heals existing data (collapses to one cash bucket of 52,992.96, total UNCHANGED). (2) STALE invoice total — INV638862 stored amount 1750 while its line items (Summer Camp 1750 + Gymnastic 375) sum to 2125; the canonical helpers already use invoiceTotal so dues were correct (375 owed), and the existing Cleanup-Center "Invoice total ≠ sum of sports" card (fixInvoiceTotalUI) heals the raw amount. All test suites pass (logic 1210, prod-sanity 45, revenue-sport 14, cross-month 8, frozen 5, settle-pending 8). Tests: the "method:" block in logic-tests.js. 6.270.0 SALARY MULTI-PAYMENT + MEMBER-CARD DELETE. SALARIES: "Pay" is now a payment MANAGER — pay a coach over ONE OR MORE payments, each with its OWN date + method, toward an AGREED amount (defaults to the computed net; admin can OVERRIDE it for a bonus/deduction via the #sp-target field). Status is now 3-state: pending → PARTIAL (orange badge, shows paid/target + remaining) → paid. Each payment is logged as its OWN Salary expense (money out) carrying its date + method; removing a payment removes its linked expense. Model: a 'paid' salary record now holds `target` + `payments[]` (helpers salaryPayments/salaryPaidTotal/salaryTarget in app.js; back-compat with legacy single-payment records via paidDate/payMethod/snapshotNet). computeMonthlyPay exposes paidTotal/paidTarget/paidRemaining/paidStatus/payments/salaryRecord. New window fns _salAddPay/_salDelPay/_salSetTarget; "Clear all payments" removes the record + all its expenses. MEMBER CARD (viewMember Subscription History): (1) a COMPLETED sport (all classes attended) now shows its OWN colour — a purple "✓ completed" badge — distinct from active green; completed also wins over "expired" when the period has ended. (2) ADMIN-ONLY full delete (deleteSportFull) on an attended/completed sport removes the subscription period, its enrollment (only if no other period of that sport remains), the linked invoice line, AND the ATTENDANCE recorded during that period window (_clearSportAttendanceWindow) — always behind a confirmation dialog. Tests: the "salary:" and "attendance clear:" blocks in logic-tests.js. 6.269.0 EXPENSES "Clear filters": the Expenses screen gained a ✕ Clear filters button (#exp-clear) that resets search + month + category + method to show ALL expenses. It appears only while a filter is active (toggled in refresh() by the existing anyFilter flag) and on click resets the filter object, saveFilter()s it and re-renders the page so the month picker + category/method checkboxes reset visually. 6.268.0 ROLES + MENU + STAFF-INVOICE FIX. (1) CRITICAL FIX — front-desk saw 0 invoices: the member read-scoping (storage.js _isMemberEmail + firestore.rules/tools isMember()) classified ANY @blackstars.com email as a member, but STAFF receptionists are created on that domain (receptionist@…, test@…) → their browser fetched none of the club's data. Now a member/portal login is matched ONLY when the email LOCAL PART is all DIGITS (`^[0-9]+@(blackstars.com|members.blackstars.qa)$` — the <mobile>@blackstars.com pattern); named staff emails read everything. RULES MUST BE RE-PUBLISHED in Firebase Console. (2) ADMIN Insights menu flipped: now SHOWN — Monthly Report, Coach Performance, Transactions, Missing Invoices (multi-month filter), Renewals, Renewal Potential, Attendance Report; now HIDDEN — Owner Dashboard, Payments Analysis, Club Revenue Summary, Financial Overview, Member Commission. (Invoice Checker (6.266.0) + Citadel (6.267.0) stay shown for admin — they weren't visible in production only because prod was still on v6.264.0; deploy this build to see them.) (3) FRONT-DESK cash management (owner request): receptionist GAINED Cash in Hand (removed its adminOnly route flag + relaxed the PAGES.cashinhand guard to admin|receptionist) and Cash Collection (added both to ROLE_ALLOWED.receptionist). Front-desk Invoices already: shows rows, count-not-amount, export hidden, soft-delete only (hard delete admin-only) — the 0-rows was purely the scoping bug above. Tests: reception cash + insights-flip asserts in logic-tests.js. 6.267.0 CITADEL SCREEN — FACILITY COMPANY SHARE. New ADMIN-ONLY screen (🏛, Finance section, route `citadel`, multi-select month filter) for the revenue-share CONTRACT on the Football court + Swimming pool: those facilities aren't rented for a flat fee — the club pays the facility company (Citadel) a % (default 30%, admin-editable inline → state.settings.citadelRate) of ALL money the two activities generate = MEMBERSHIP fees (sport Football / Swimming) + facility RENT (Football Court / Swimming Pool). Pure `citadelCompute(selMonths)` (pages.js) splits each contributing invoice line into its group's membership/rent bucket (scaled so parts re-sum to the invoice amount, same basis as Club Revenue), excludes every other sport + deleted invoices; the page shows 4 KPIs (Football total, Swimming total, Total revenue, Company share), a per-activity summary table (membership | rent | total | share%) and a Contributing-invoices audit table. Verified on the real 2026-07-03 backup: All-months grand 10,115 → 30% = 3,034.5 (Football 5,435 = memb 2,475 + rent 2,960; Swimming 4,680 = memb 4,500 + rent 180). Tests: the "citadel" block in logic-tests.js. 6.266.0 INVOICE CHECKER + FILTERS + SALARY PDF. (1) NEW SCREEN "Invoice Checker" (🔎, Insights, ADMIN-ONLY, multi-month selector) — scans every non-deleted invoice and compares its stored SNAPSHOT (customerName / customerPhone / customerNameArabic / customerQid) against the linked member's CURRENT data, flagging any drift (e.g. a member renamed or changed mobile, so old invoices still carry the old value) plus a STALE stored amount (line-item sum ≠ inv.amount). Shows each difference old→new and a "🔄 Update" button (or "Update all") that syncs the invoice to the member (stampUpdate + audit 'invoice.sync'/'invoice.sync_bulk'). Invoices with no usable member link (walk-in/legacy or broken customerId) are listed separately for manual review (never auto-touched). Verified on the real 2026-07-03 backup: 14 real name/phone drifts + 1 stale amount found. (_icInvoiceIssues / _icAmountIssue / _icFix / _icFixAll in pages.js; route + AR label in app.js; tests in logic-tests.js.) (2) DUE PAYMENT month filter is now the MULTI-select widget (monthMultiHTML/bindMonthMulti, _dueFilter.months; [] = all; migrates the old single f.month). (3) SALARIES screen gained a per-coach ⬇️ PDF export button (calls downloadRevenueDetailPDF directly) and that report's PDF filename is now "Coach Name-Month-Year.pdf" (e.g. "Mostafa-June-2026") via the document <title>. FROZEN-COMMISSION note: re-verified against the real 2026-07-03 backup that the Almerri family's frozen members' ATTENDED June classes are correctly EARNED by the right coach (Mostafa: Swimming/Karate attended) with only the Kick Boxing portion pending under Abdel Salam — the flat 1175/1125 lump is expanded per-sport (commissionLineItems, v6.256.0). The user's screenshot showing —/null/353 was PRE-6.256.0 behavior (353 = 1175×30%); the fix is already in this build. 6.265.0 IDLE AUTO-LOGOUT — WARN-FIRST + CONFIGURABLE: instead of signing out silently, after N minutes of NO activity a MODAL asks "Are you still there? — Continue session / Log out" with a 60s grace countdown (idle-warn / idle-continue / idle-logout / idle-count); ignoring it auto-signs-out. Active use (clicks, typing, mouse movement — throttled 2s) never interrupts you: it only resets the PRE-warning timer, and once the dialog is up an _idleWarning flag blocks silent resets so an explicit Continue/Log-out choice is required. N = state.settings.idleLogoutMin via _idleMin() (default IDLE_DEFAULT_MIN=10, 0=never), editable ADMIN-ONLY in Settings → Preferences (pref-idlemin, 0–240); saving calls _idleReset() so the new value applies immediately. Pending cloud writes flushed (Storage.flushPending) before sign-out. Supersedes the 6.264.0 fixed-5-min silent logout. 6.264.0 IDLE AUTO-LOGOUT: signs the user out after 5 minutes of no activity (IDLE_LOGOUT_MS, one-line const). A 30s countdown banner warns first ("Signing out for inactivity — Stay") so nobody is logged out mid-task; ANY click/keypress/mousemove (throttled) resets it. Pending cloud writes are flushed (Storage.flushPending) before sign-out so no in-flight change is lost. Started after login + on init; inert on the login screen. 6.263.4 Summer Camp menu: the "Summer Camp" SCHEDULE page (campschedule route) is hidden from the side menu (hidden:true). NO camp data touched — Camp Members, Drivers, Driver Students and all state.campSchedule/camp records are untouched; only the schedule menu item is removed. 6.263.3 Finance menu: Bank Account + Reconciliation hidden from the side menu (hidden:true, admin-only). Menu declutter (routes still resolvable by direct hash). 6.263.2 Insights menu trimmed: only Owner Dashboard, Payments Analysis, Club Revenue Summary, Financial Overview and Member Commission remain in the Insights section. The rest (Monthly Report, Coach Performance, Transactions, Missing Invoices, Renewals, Renewal Potential, Attendance Report) are marked hidden:true so they no longer appear in the side menu (routes still resolvable by direct hash — this is a menu declutter, not a hard block). 6.263.1 Missing Invoices screen: the single-month dropdown is now the checkbox MULTI-month selector (monthMultiHTML/bindMonthMulti, window._miMonths). 0 ticked = ALL months; 1 = that month (as before); 2+ aggregates the per-month checks and adds a "Month" column so you see which month each missing/mismatch row belongs to. KPI shows the scope (month name / "N months" / "All months"). 6.263.0 ROLE REQUIREMENTS. RECEPTION: (1) Expenses screen hides Rent-category rows AND all total sums (subtitle + footer show only the count). (2) Reception can SOFT-delete (archive) members — archive button now shown; restore + permanent-delete stay admin-only. (3) Reception can SOFT-delete (archive) invoices; deleteInvoice now archives (recoverable) with an admin-only "Delete permanently"; new restoreInvoice/hardDeleteInvoice + a "🗑 Archived" toggle on the Invoices screen to view/restore/purge (admin). ADMIN: (4) Marking a coach salary paid now also records a "Salary" EXPENSE (money out — appears on Expenses + Reconciliation), flagged _salaryAutoExpense so computeMonthlyPay never double-counts it (manual salary expenses still reduce net); markPaid gained a Paid-via method; Mark-unpaid removes the linked expense. (5) "Mark fully paid incl. unfinished classes → fresh next month" was already the "Settle pending in full" option (settleCoachPendingCommission) — verified. 6.262.0 SECURITY — member read-scoping. Member portal logins (member-domain email) are now DENIED all financial/operational data at the Firestore-rules level: invoices/revenue, expenses, salaries, cashCounts, sales, coaches' pay, families, membershipTransfers, notes, rentals, trials, drivers, products, and the AUDIT LOG. A member may read only members/schedule/advices/posts/swimGroups (the portal set). storage.js load() is member-scoped to match (a member's browser never even fetches the denied collections, so the load doesn't fail on permission-denied). Staff are UNAFFECTED (only member-domain logins are scoped; there are currently 0 member logins). New rules in firestore.rules + tools/firestore-rules-recommended.txt — MUST be published in Firebase Console to take effect. RESIDUAL: a member can still read the `members` roster (portal needs it to find their own record); per-member isolation needs Auth custom claims (a later step). 6.261.0 CREATE-AUDIT for the revenue stream: every NEW invoice + expense now writes an immutable audit entry ('invoice.create' / 'expense.create') with ref/amount/customer/who/when. Done CENTRALLY in save() (_auditNewRecords + _seedKnownRecIds baseline on load) so NO creation site can be missed; records that arrived from another device via the sync merge are pre-marked "known" so they're never mis-attributed. Traceability: if an invoice/expense ever goes missing it still leaves a fingerprint in the (immutable) audit log for reconstruction. 6.260.0 CONCURRENCY SAFETY + SYNC CHECK. (a) COLLISION-SAFE IDs — nextId() is now a time-based unique number (ms×1000+rand, kept above the max) instead of max+1, so two receptionists CREATING a record at the same second can no longer pick the same id and fuse into one document (the last real concurrent data-loss vector). Editing different records/fields was already safe (per-record field-level merge). (b) SYNC CHECK — Settings → Data → "🔍 Verify against cloud" reads the authoritative cloud fresh (Storage.readCloud, no side effects) and reports per collection: ⚠ records only on this device (at risk → "Save to cloud now"), ☁ records only in the cloud (added elsewhere → Refresh), ≠ records that differ. Shows "✓ Fully in sync" when clean. 6.259.0 DATA-LOSS DEFENCE-IN-DEPTH (on top of the 6.258.0 root fix): (1) FLUSH-ON-CLOSE — on tab hide/close (visibilitychange/pagehide/beforeunload) any throttled-but-unsent cloud write is flushed immediately (Storage.flushPending) so an in-flight change is never lost. (2) LOCAL AUTO-BACKUP RING — storage.js keeps rolling full-state snapshots in IndexedDB (on load, throttled every ~12min while working, and on close), pruned to last 48h in full + 1/day for 21 days; independent of the cloud. (3) RESTORE UI — Settings → Data → "🛟 Auto-backups" lists snapshots (time, counts) and one-click restores any (downloads a safety copy of current data first). Now data loss is both prevented AND recoverable. 6.258.0 CRITICAL DATA-LOSS FIX (silent record loss on cloud sync). Root cause: the multi-device merge "sync base" was advanced from OPTIMISTIC local saves (save() → snapshotSyncBase(state)) and from the MERGED result, so a just-added record that the cloud had not echoed back yet sat in the base but not in the next remote snapshot — the 3-way merge then read that as "another device deleted it" and dropped it (e.g. add an expense, it vanishes minutes later when any unrelated sync arrives). Fix: the sync base now tracks CONFIRMED cloud data ONLY — set on load() and to the REMOTE snapshot after each merge (mergeRemoteIntoState → snapshotSyncBase(remoteState)); save() no longer touches it. Unsynced local adds/edits are preserved by the merge until the cloud confirms them; genuine remote deletes are still honored. Adversarial regression test in tests/logic-tests.js (reverting the fix makes it fail). 6.257.0 STAFF SCREEN: the side-menu "Team" item is renamed "Staff" (page header too, EN/AR), and the screen is explicitly ADMIN-ONLY (already gated by ROLE_ALLOWED; added a defence-in-depth guard in PAGES.coaches). Coach DELETE reworked: instead of blocking when the coach has students, it now asks the admin to either MOVE the students to another coach (reassigns member.coachId + enrolments + subscriptions + schedule + invoices/lineItems to the new coach) OR KEEP them without a coach (clears coachId to null) — then deletes. 6.256.0 FROZEN-MEMBER COMMISSION + RECEPTION EXPENSES. (a) A flat, sport-less invoice line that lumps several enrolled sports (under different coaches) into ONE line no longer dumps the whole fee on one coach and hides attendance. New commissionLineItems() expands such a line, per the member's ENROLLMENTS, into one line per sport (its own coach/price/classes, scaled to the invoice total) — so EVERY coach is credited and attendance is counted. Guarded: only when the flat line's coach matches an enrolment coach and the totals are in the same ballpark. Fixes frozen members (e.g. the Almerri family) who were mis-attributed and showed null/— in the Pending table; the report now labels them "❄️ Frozen" and never renders "null". (b) Reception can now access the Expenses screen (record + view) but the PDF/sheet EXPORT is hidden for them. 6.255.2 INVOICE PDF: the per-installment Payment History table (added earlier) is now HIDDEN by default — the printed/exported invoice is clean. A "🧾 Show installments" button in the invoice window reveals it on demand (and only what's on screen prints), so staff can hand a member the detailed breakdown if they ask. The admin's on-screen payment editor keeps its Entered By column. 6.255.1 UPGRADE-PRICE FIX: editing a member's sport/duration to a HIGHER price (e.g. Summer Camp 1 day @175 → 1 month @1750) no longer silently marks the new amount as fully paid. syncSubToEnrollment now only keeps an invoice "paid in full" on a price CORRECTION/downgrade; on an INCREASE the paid amount stays as-is so the unpaid difference shows as a real balance due (175 paid → 1575 due, status Partial). The member-save also toasts "⬆ <sport> upgraded to X · paid Y so far · Z now due" so the change is visible. 6.255.0 UX: (1) gender-aware member avatars — boys show 👦 (blue tile), girls 👧 (pink), unset keeps initials (memberAvatarHtml); applied to the members list, profile & grid. (2) MEMBERS GRID VIEW — a List/Grid toggle (persisted) renders members as responsive cards (avatar, name, status, sport badges, phone, balance) sharing the list's click/select/bulk wiring. (3) MULTI-SELECT month filter extended to Attendance (0 ticked = all-months summary, 1 = editable day-grid, 2+ = summary over just those months — filter.month stays derived so the grid logic is untouched) and Payments Analysis. 6.254.0 UNIFIED REVENUE SOURCE: every financial screen now derives an invoice's total from ONE canonical function — invoiceTotal(inv) = Σ line-item prices (or inv.amount if no lines), the same figure the Edit-pricing screen shows. Previously ~15 places computed "charged/billed/due" straight from the cache-able inv.amount, so a stale invoice (a sport added without recomputing amount) disagreed screen-to-screen. Now billedInMonth/billedInPeriod/invoiceBilledInMonth/invoiceLineShares/invoicePaidInMonth caps + the Invoices, Transactions, Bank Account, Reconciliation, Monthly Report, Club Revenue, Owner Dashboard, member profile/statement, invoice-history and the member's own view all use invoiceTotal → billed = collected + due holds on every screen and they all tie to the invoices "collected". Guardrail: the "Kenan" cross-screen consistency block in tests/logic-tests.js. 6.253.2 BANK ACCOUNT consistency: the table rows were built by raw payment DATE while the KPI cards + Total used the billing-month "collected" basis, so a partial / cross-month non-cash invoice made the rows disagree with the Total (rows summed to less than the Total, a card payment showed the wrong amount, and some card invoices were missing). Now the rows AND the card/transfer/fawran KPIs AND the Total are all derived from the SAME per-invoice figure the Invoices screen uses (month collected × how it was paid), so they always agree and tie back to the invoices "collected" number — matching Reconciliation exactly. 6.253.1 DATA-INTEGRITY FIXES: (a) invoiceBalance/invoiceStatus now use the LINE-ITEM SUM (invoiceTotal) instead of the cache-able inv.amount — a member who owes on a sport added after the invoice was created (stale inv.amount) now correctly appears in Due Payment & all balance views (matches the Edit-pricing screen); legacy invoices with no payment ledger stay "fully paid" (no phantom dues). (b) computeAttendanceCommission falls back to the member's ENROLLMENT (class count + coach) when a line has no linked subscription, so an added sport still shows in the coach's salary report (pending) instead of vanishing into the month-gated flat-fee path. 6.253.0 = REQUIREMENTS BATCH 3 (features): (#6) Portal Onboarding screen (admin+reception) — members list with mobile + account status; "Send WhatsApp" auto-creates the member login (<mobile>@blackstars.com / password=mobile, role Member via secondary Firebase app so the admin session is untouched), tracks created/invited/by/status, opens WhatsApp with the welcome message. (#4) invoice PDF now shows a chronological Payment History table (Date/Amount/Method/Entered By); payments carry who entered them; the payment-ledger editor shows Entered By. (#7) Transactions gained a Months + Years multi-select (cross-year, e.g. Jun+Jul 2025&2026) that composes with all existing filters. (#3) the Record-Payment screen was redesigned — big totals band, 28px amount, clearer method + split, fully responsive
// Club logo (uploaded marketing image, used in sidebar/login/favicon contexts)
const BRAND_LOGO = 'data:image/jpeg;base64,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';
const SCHEMA_VERSION = 9;       // v9: clean Summer Camp coachIds from legacy data

// ── Stale-version guard ──────────────────────────────────────────────────
// Each save stamps the running APP_VERSION into the shared document. On load /
// remote update we compare: if the cloud carries a NEWER version than this
// browser is running, this browser is STALE (running cached old code) and is
// blocked from saving — so it can't overwrite newer data with old. The user is
// shown a "please refresh" banner. Purely defensive: never reads/writes records.
function _verCmp(a, b) {
  // Compare dotted versions. Returns -1 if a<b, 0 if equal, 1 if a>b.
  const pa = String(a || '0').split('.').map(n => parseInt(n) || 0);
  const pb = String(b || '0').split('.').map(n => parseInt(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}
let _staleVersion = false;   // set true when the cloud is ahead of this browser
let _cloudAppVersion = '';   // highest __appVersion we've seen in the cloud (never downgrade the stamp)
function _checkVersionFromRemote(remoteState) {
  if (!remoteState) return;
  const remoteVer = remoteState.__appVersion;
  if (remoteVer && (!_cloudAppVersion || _verCmp(_cloudAppVersion, remoteVer) < 0)) _cloudAppVersion = remoteVer;
  // Only flag stale when the cloud is STRICTLY newer than what we run.
  if (remoteVer && _verCmp(APP_VERSION, remoteVer) < 0) {
    if (!_staleVersion) {
      _staleVersion = true;
      try { if (typeof showStaleVersionBanner === 'function') showStaleVersionBanner(remoteVer); } catch (_) {}
    }
  }
}


// Legacy: kept for the version-bump UI toast, but no longer used to wipe data
const SEED_VERSION = '2026-06-08-v285-invoice-suite'
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
  { label: '6 weeks',  days: 42, price: 2500 },
  { label: '2 months', days: 60, price: 3000 },
];
// Map a camp duration LABEL (e.g. "1 week") to its calendar-days value. Uses the
// admin-configured prices if present, else the defaults. Returns 0 if unknown.
function campDaysForLabel(label) {
  if (!label) return 0;
  const rows = (typeof state !== 'undefined' && state.settings && state.settings.summerCampPrices) || DEFAULT_SUMMER_CAMP_PRICES;
  const row = rows.find(p => p.label === label);
  return row ? (parseInt(row.days) || 0) : 0;
}

// The correct class-day LIMIT for a subscription. For Summer Camp this is the camp
// class-day count (e.g. "1 week" = 5), derived from the duration — NOT the stored
// totalClasses, which on older/auto rows may hold the calendar validity (e.g. 7).
// For other sports it's just the stored totalClasses.
function subClassLimit(sub) {
  if (!sub) return 0;
  if ((sub.activity || '') === SUMMER_CAMP) {
    if (sub.durationLabel) {
      const d = campDaysForLabel(sub.durationLabel);
      if (d) return campClassCount(d);
    }
    // No label: if the stored total matches a known validity (7/14/21/30/42/60),
    // convert it to the class-day count; otherwise trust the stored total.
    const stored = parseInt(sub.totalClasses) || 0;
    const validityToClasses = { 7: 5, 14: 10, 21: 15, 30: 22, 42: 30, 60: 44, 1: 1 };
    return validityToClasses[stored] || stored;
  }
  return parseInt(sub.totalClasses) || 0;
}

// The attendance window for a subscription that does NOT overlap the member's next
// period of the same activity. Returns { from, to } (to is exclusive of next start).
// v6.307 — from this date onward, a renewal's attendance window absorbs the "gap"
// between the previous package's end and this one's start (see subAttendanceWindow).
// Gated by date so ALL historical attribution + already-settled coach commission is
// left exactly as it was (forward-only). Effective 2026-07-06.
const CONTIGUOUS_ATTENDANCE_FROM = '2026-07-06';
function subAttendanceWindow(m, sub) {
  let from = sub.start || null;
  let to = sub.end || null;
  if (m && Array.isArray(m.subscriptions) && sub.start) {
    const sameAct = m.subscriptions
      .filter(s => (s.activity || '') === (sub.activity || '') && s.start && s.start > sub.start)
      .sort((a, b) => a.start.localeCompare(b.start));
    if (sameAct.length) {
      // End the window the day BEFORE the next period starts (no boundary overlap).
      const d = new Date(sameAct[0].start + 'T00:00:00'); d.setDate(d.getDate() - 1);
      const exclusive = d.toISOString().slice(0, 10);
      if (!to || exclusive < to) to = exclusive;
    }
    // CARRY ATTENDANCE ACROSS A RENEWAL GAP (forward-only). When this package is a
    // renewal that STARTS after a previous same-sport package ENDED, pull the window
    // back to the day AFTER that package's end, so classes attended in the gap (after
    // the old package expired, before this one started) count toward THIS (the new)
    // membership — not lost. Cut = the OLD package's end date. Only applies to packages
    // starting on/after CONTIGUOUS_ATTENDANCE_FROM, so nothing historical shifts.
    if (from && from >= CONTIGUOUS_ATTENDANCE_FROM) {
      const earlier = m.subscriptions
        .filter(s => (s.activity || '') === (sub.activity || '') && s.end && s.start && s.start < sub.start)
        .sort((a, b) => a.end.localeCompare(b.end));
      if (earlier.length) {
        const prevEnd = earlier[earlier.length - 1].end;   // the most recent prior package's end
        if (prevEnd && prevEnd < from) {                    // a real gap (or back-to-back)
          // Day AFTER prevEnd, computed in UTC so the local timezone never shifts the
          // date (new Date('...T00:00:00') is LOCAL; toISOString() is UTC — that combo
          // silently moves the day in a non-UTC zone like Qatar UTC+3).
          const d = new Date(prevEnd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1);
          const dayAfter = d.toISOString().slice(0, 10);
          if (dayAfter < from) from = dayAfter;             // absorb the gap into this new package
        }
      }
    }
  }
  return { from, to };
}
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
// "Private" sport variants share a base sport's icon/colour but are priced &
// scheduled separately. Convention: name ends with " (Private)".
function isPrivateSport(s) { return typeof s === 'string' && /\(private\)\s*$/i.test(s.trim()); }
function baseSportName(s) { return typeof s === 'string' ? s.replace(/\s*\(private\)\s*$/i, '').trim() : s; }
// Expense categories — admin-configurable from Settings page.
// DEFAULT_EXPENSE_CATEGORIES seeds new installs; once settings.expenseCategories
// is populated, the getter below reads from there. "Others" is always available
// as a safety-net fallback the admin can't accidentally delete (see settings UI).
const DEFAULT_EXPENSE_CATEGORIES = [
  'Bank Commission','Equipment','Cleaning','Utilities','Marketing','Subscriptions',
  'Transport','Operations','Rent','Maintenance','Salary',
  'Cash collected by owner','Others',
];
// Reserved categories that should always exist (used by other features or
// kept as common safety options). Admin cannot delete these from settings.
const RESERVED_EXPENSE_CATEGORIES = ['Cash collected by owner', 'Others'];

Object.defineProperty(globalThis, 'EXP_CATS', {
  get() {
    const cats = state?.settings?.expenseCategories;
    const base = (Array.isArray(cats) && cats.length) ? cats : DEFAULT_EXPENSE_CATEGORIES;
    // Always ensure reserved categories are available, even on old installs whose
    // settings.expenseCategories array predates them. Insert just before "Others".
    const out = base.slice();
    for (const reserved of RESERVED_EXPENSE_CATEGORIES) {
      if (!out.includes(reserved)) {
        const othersIdx = out.indexOf('Others');
        if (othersIdx >= 0) out.splice(othersIdx, 0, reserved);
        else out.push(reserved);
      }
    }
    return out;
  },
});

const INVOICE_CATS = ['Membership','Court Rental','Boxing Room','Product','Other'];
// Validity periods in days for membership/enrollment transactions
const VALIDITY_OPTIONS = [30, 45, 60, 90, 180];
const DEFAULT_VALIDITY = 30;
// Sanity bounds for the Classes field — stop fat-finger entries (e.g. typing a
// year "2026" into the classes box) from polluting attendance math and coach
// reports. Above SOFT we ask for confirmation; above HARD we reject outright.
const MAX_CLASSES_SOFT = 60;    // unusual but possible (e.g. long intensive plan)
const MAX_CLASSES_HARD = 365;   // nothing legitimate exceeds this

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

// Add N BUSINESS days (Sun–Thu) to a date, skipping Fridays (5) and Saturdays (6),
// which are the weekend in Qatar. Returns the date that is N business days after
// the start (the start day itself is not counted). Used for Summer Camp, where a
// "week" is five business days, Sunday through Thursday.
function addBusinessDays(dateStr, n) {
  if (!dateStr || n == null) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return null;
  let added = 0;
  const step = n >= 0 ? 1 : -1;
  let remaining = Math.abs(parseInt(n));
  while (remaining > 0) {
    d.setDate(d.getDate() + step);
    const wd = d.getDay();            // 0=Sun .. 6=Sat
    if (wd !== 5 && wd !== 6) remaining--;   // count only Sun–Thu
  }
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Camp durations are sold as "1 week", "2 weeks", etc. A camp WEEK is five
// business days (Sun–Thu), so convert week-based durations to business days for
// the expiry date. Day/month durations stay on the calendar. `days` is the value
// stored on the camp price row (7=1 week, 14=2 weeks, …, 30=1 month, 1=1 day).
const CAMP_BUSINESS_DAYS_PER_WEEK = 5;
// Number of camp CLASS days for a sold duration, counted in business days
// (Sun–Thu). A week = 5 class days, a month = 22, two months = 44. Day-based and
// other durations fall back to a sensible business-day count. `days` is the value
// on the camp price row (1, 7, 14, 21, 30, 42, 60).
function campClassCount(days) {
  const n = parseInt(days) || 0;
  const map = { 1: 1, 7: 5, 14: 10, 21: 15, 30: 22, 42: 30, 60: 44 };
  if (map[n] != null) return map[n];
  // Generic fallback: whole weeks → 5/week; months (multiples of 30) → ~22/month.
  if (n > 0 && n % 7 === 0) return (n / 7) * CAMP_BUSINESS_DAYS_PER_WEEK;
  if (n > 0 && n % 30 === 0) return (n / 30) * 22;
  return n;
}
// Map a stored class count back to its camp duration label. Class counts are now
// business-day based (1 week=5, 1 month=22, …); this also accepts legacy calendar
// counts (7, 30, …) so old records still resolve.
function campLabelForClasses(classCount) {
  const n = parseInt(classCount) || 0;
  if (!n) return '';
  // Prefer a business-day class-count match; only fall back to legacy calendar
  // day counts if nothing matches, so 30 classes → "6 weeks" not "1 month".
  for (const p of (DEFAULT_SUMMER_CAMP_PRICES || [])) {
    if (campClassCount(p.days) === n) return p.label;
  }
  for (const p of (DEFAULT_SUMMER_CAMP_PRICES || [])) {
    if (p.days === n) return p.label;
  }
  return '';
}
function campEndDate(startDate, days) {
  if (!startDate) return null;
  const n = parseInt(days) || 0;
  if (n <= 0) return startDate;
  // Camp VALIDITY window is always CALENDAR days (e.g. "1 month" = 30 calendar days),
  // never business days. The number of camp DAYS a member can attend is a separate
  // limit (see campClassCount). start + N calendar days.
  return addDays(startDate, n);
}

// THE authoritative "valid until" date for a subscription line — the same date the
// member modal shows. We trust the STORED end (what the admin set/edited); only
// when it is missing or clearly invalid do we derive it (camp: duration label, then
// the validity day-count). This stops the invoice from silently recomputing the
// camp end from a stale durationLabel and disagreeing with the member's real end.
// The issue date to print for ONE invoice line: an explicit per-line issueDate,
// else the sport's subscription start (when that sport was enrolled), else the
// invoice's own issue date. Keeps each sport's date independent so adding a new
// sport later never rewrites an earlier sport's printed issue date.
function lineIssueDate(li, subStart, invDate) {
  return (li && li.issueDate) || subStart || invDate || null;
}

function subscriptionValidEnd(sub) {
  if (!sub) return null;
  if (sub.start && sub.end && sub.end > sub.start) return sub.end;   // stored end wins
  if (!sub.start) return sub.end || null;
  const isCamp = (sub.activity || '') === SUMMER_CAMP;
  if (isCamp) {
    const labelDays = (typeof campDaysForLabel === 'function' && sub.durationLabel) ? campDaysForLabel(sub.durationLabel) : 0;
    if (labelDays > 0 && typeof addDays === 'function') return addDays(sub.start, labelDays);
  }
  if (sub.validity && typeof addDays === 'function') return addDays(sub.start, sub.validity);
  return sub.end || null;
}

// End date for a CUSTOM camp duration given the number of class days directly
// (business days, Sun–Thu). N class days span N-1 business days from the start.
function campEndDateFromClasses(startDate, classCount) {
  if (!startDate) return null;
  const n = parseInt(classCount) || 0;
  if (n <= 0) return startDate;
  return addBusinessDays(startDate, n - 1);
}

// Whole days from start→end (used to recover a subscription's validity from its
// dates when no explicit validity was stored, so legacy ends aren't mangled).
function daysBetween(startStr, endStr) {
  if (!startStr || !endStr) return null;
  const a = new Date(startStr + 'T00:00:00'), b = new Date(endStr + 'T00:00:00');
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

let state = {
  user: null,
  members: [],
  coaches: [],
  invoices: [],
  expenses: [],
  salaries: [],
  sales: [],
  advices: [],            // coach→student advice: {id, memberId, coachId, text, date}
  trials: [],
  rentals: [],            // booking log: facility, customer, date, hours, amount
  rentalCustomers: [],    // {id, name, phone, qid, notes} — reusable rental contacts
  schedule: [],           // class schedule: {id, day, slot, sport, coachId}
  swimGroups: [],         // swimming groups: {id, name, coachId, memberIds:[], order, createdAt}
  auditLog: [],           // {id, ts, user, action, target, summary, details}
  settings: {
    expiringSoonDays: 3,
    lowStockThreshold: 3,
    commissionBasis: 'attendance',   // 'payment' (fee counts in payment month) | 'attendance' (per class attended)
    commissionStartDate: '2026-06-01',  // commission only counts invoices/subs dated ON OR AFTER this; '' = no cutoff
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

// localStorage capacity monitoring. Browsers cap localStorage at ~5MB; once
// it's full, setItem throws QuotaExceededError and changes are silently lost.
// We warn the admin before that happens (gentle at 70%, urgent at 90%) and
// loudly if a save actually fails.
const LS_LIMIT_BYTES = 5 * 1024 * 1024;   // ~5 MB typical quota
let _lastStorageWarnLevel = 0;            // 0 / 70 / 90 — dedupe repeat warnings

// Storage-capacity warning that doubles as a one-click backup: clicking the
// toast triggers a JSON backup export so the admin can act immediately.
function storageToast(msg, type) {
  toast(msg, type);
  const el = document.querySelector('.toast');
  if (el) {
    el.style.cursor = 'pointer';
    el.title = 'Click to export a backup now';
    el.addEventListener('click', () => {
      if (typeof window.downloadBackup === 'function') window.downloadBackup();
    });
  }
}

function isCloudStorage() {
  try { return !!(window.Storage && typeof window.Storage.isCloud === 'function' && window.Storage.isCloud()); }
  catch (_) { return false; }
}

// ─── Multi-device safe merge ────────────────────────────────────────────────
// The cloud stores ONE document and saves overwrite it wholesale. To let two
// devices work at once without losing data, we 3-way MERGE at the record level
// instead of blindly replacing local state with the remote snapshot.
//
//   base   = the data as we last loaded/synced it (per-record reference point)
//   local  = what THIS device currently has (may include unsaved edits)
//   remote = what the OTHER device just saved
//
// Rule per record id (across every id-keyed collection):
//   • changed remotely only  → take remote
//   • changed locally only   → keep local
//   • changed on both        → keep local, and flag a conflict warning
//   • new on either side      → keep it
//   • a record present in base but missing on one side = a delete; honor a delete
//     ONLY if the other side did not also modify that record (otherwise keep it,
//     to avoid silently dropping someone's concurrent edit).
// Net effect: no record from either device is ever lost; only true same-record
// double-edits surface a warning.

const MERGE_COLLECTIONS = [
  'members', 'coaches', 'invoices', 'expenses', 'salaries', 'sales', 'advices',
  'trials', 'rentals', 'rentalCustomers', 'schedule', 'auditLog', 'products',
  'families', 'notes', 'cashCounts', 'swimGroups', 'posts', 'membershipTransfers', 'drivers',
];
let _syncBase = null;        // snapshot of data as last loaded/synced
// A confirmed record that goes missing from a remote snapshot is only treated as a
// genuine remote DELETE after it's absent for TWO consecutive syncs. A single stale /
// partial snapshot (multi-listener race) must NEVER delete a record — that caused a
// just-saved paid salary to vanish after refresh. Key = 'collection|id'.
const _delStrikes = new Map();
const _stableStr = v => { try { return JSON.stringify(v); } catch (_) { return String(v); } };
function _indexById(arr) {
  const m = new Map();
  for (const r of (Array.isArray(arr) ? arr : [])) {
    if (r && r.id != null) m.set(r.id, r);
  }
  return m;
}
// Capture the current data as the new merge base (deep copy so later edits to
// `state` don't mutate the base out from under us).
// ─── SINGLE-WRITER SESSION LOCK ─────────────────────────────────────────
// Bank-style: only ONE session can write at a time. Other sessions are
// read-only and can view everything but cannot save. An admin in a read-only
// session may "take over" (which puts the previous writer into read-only).
// The lock lives in a separate cloud doc with a heartbeat; if the holder goes
// idle/closes, the lock auto-releases so nobody is locked out for long.
const SessionLock = (() => {
  const HEARTBEAT_MS = 30 * 1000;    // refresh our hold every 30s
  const STALE_MS = 5 * 60 * 1000;    // a hold with no heartbeat for 5 min is dead
  const sessionId = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  let readOnly = false;              // is THIS session currently read-only?
  let holder = null;                 // current lock record from cloud
  let heartbeatTimer = null;
  let started = false;
  let lastBlockedToast = 0;

  function isCloud() {
    try { return !!(window.Storage && window.Storage.isCloud && window.Storage.isCloud()); } catch (_) { return false; }
  }
  function holderName() {
    // All staff share one admin login, so the username can't tell them apart.
    // Use a per-DEVICE label (set once, remembered in this browser) instead.
    try {
      const label = localStorage.getItem('bs-device-name');
      if (label) return label;
    } catch (_) {}
    try {
      const u = state.user;
      return (u && (u.name || u.email)) || 'A device';
    } catch (_) { return 'A device'; }
  }

  // Ask for (or update) this browser's device/staff label. Remembered locally.
  function promptDeviceName(force) {
    let current = '';
    try { current = localStorage.getItem('bs-device-name') || ''; } catch (_) {}
    if (current && !force) return current;
    const entered = prompt(
      (typeof t === 'function' ? t('Name this device (so others know who holds the editing session): e.g. Reception, Ahmed', 'سمِّ هذا الجهاز (ليعرف الآخرون من يملك جلسة التعديل): مثل الاستقبال، أحمد') : 'Name this device: e.g. Reception, Ahmed'),
      current || ''
    );
    const name = (entered || '').trim().slice(0, 30);
    if (name) { try { localStorage.setItem('bs-device-name', name); } catch (_) {} return name; }
    return current;
  }
  function myRole() {
    try { return (typeof accountRole === 'function') ? accountRole() : 'admin'; } catch (_) { return 'admin'; }
  }
  function isStale(lock) {
    return !lock || !lock.sessionId || (Date.now() - (lock.ts || 0) > STALE_MS);
  }
  function iHoldIt(lock) { return lock && lock.sessionId === sessionId; }
  // True when the lock is held under THIS device's name (same physical device/browser,
  // e.g. another tab or a stale hold from a previous load). A device must never lock
  // itself out, so we treat this as "ours" and re-claim rather than going read-only.
  function sameDevice(lock) {
    if (!lock || !lock.holderName) return false;
    try {
      const myLabel = localStorage.getItem('bs-device-name');
      if (!myLabel) return false;   // no explicit label → can't be sure it's us
      return String(lock.holderName).trim() === String(myLabel).trim();
    } catch (_) { return false; }
  }

  async function claim() {
    const lock = { sessionId, holderName: holderName(), role: myRole(), ts: Date.now() };
    const ok = await window.Storage.setLock(lock);
    if (ok) { holder = lock; setReadOnly(false); }
    return ok;
  }

  function startHeartbeat() {
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(async () => {
      if (readOnly) return;
      // Refresh our timestamp so others see we're alive.
      try { await window.Storage.setLock({ sessionId, holderName: holderName(), role: myRole(), ts: Date.now() }); } catch (_) {}
    }, HEARTBEAT_MS);
  }

  function setReadOnly(ro) {
    const changed = (ro !== readOnly);
    readOnly = ro;
    if (changed) renderBanner();
  }

  // The persistent banner at the top of the screen telling the user their mode.
  function renderBanner() {
    try {
      let bar = document.getElementById('session-lock-bar');
      if (!readOnly) { if (bar) bar.remove(); return; }
      const who = (holder && holder.holderName) ? holder.holderName : 'another user';
      const canTakeOver = myRole() === 'admin';
      const msg = `${t('🔒 Read-only —', '🔒 وضع القراءة فقط —')} ${t('the editing session is held by', 'جلسة التعديل بحوزة')} <b>${escapeHtml(who)}</b>. ${t('Your changes can’t be saved until you take over.', 'لا يمكن حفظ تغييراتك حتى تستلم الجلسة.')}`;
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'session-lock-bar';
        bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10000;background:#7c2d12;color:#fff;padding:8px 14px;display:flex;align-items:center;gap:12px;font-size:13px;box-shadow:0 2px 12px rgba(0,0,0,.3)';
        document.body.appendChild(bar);
      }
      bar.innerHTML = `<div style="flex:1">${msg}</div>
        <span style="opacity:.8;font-size:11px;white-space:nowrap">${t('This device:', 'هذا الجهاز:')} <b>${escapeHtml(holderName())}</b> <a href="#" id="session-rename" style="color:#fde68a">${t('(rename)', '(تغيير)')}</a></span>
        ${canTakeOver
          ? `<button id="session-takeover" style="background:#fff;color:#7c2d12;border:none;border-radius:8px;padding:7px 14px;font-weight:700;cursor:pointer;white-space:nowrap">${t('Take over session', 'استلام الجلسة')}</button>`
          : `<span style="opacity:.85;font-size:12px;white-space:nowrap">${t('Ask an admin, or wait', 'انتظر أو اطلب المشرف')}</span>`}`;
      const btn = document.getElementById('session-takeover');
      if (btn) btn.onclick = takeOver;
      const rn = document.getElementById('session-rename');
      if (rn) rn.onclick = (e) => { e.preventDefault(); promptDeviceName(true); renderBanner(); };
    } catch (e) { console.warn('[lock] banner error', e); }
  }

  async function takeOver() {
    if (myRole() !== 'admin') { toast(t('Only an admin can take over', 'المشرف فقط يمكنه الاستلام'), 'error'); return; }
    const who = (holder && holder.holderName) ? holder.holderName : 'the current user';
    if (!confirm(`${t('Take over the editing session?', 'استلام جلسة التعديل؟')}\n\n${t('This will put', 'سيتم تحويل')} ${who} ${t('into read-only mode. Make sure they are not mid-edit.', 'إلى وضع القراءة فقط. تأكّد أنه ليس في منتصف تعديل.')}`)) return;
    const ok = await claim();
    if (ok) { toast(t('✅ You now hold the editing session', '✅ أنت الآن تملك جلسة التعديل')); }
    else toast(t('Could not take over — try again', 'تعذّر الاستلام — حاول مجدداً'), 'error');
  }

  // React to lock changes pushed from the cloud.
  function onLock(lock) {
    holder = lock;
    if (iHoldIt(lock)) { setReadOnly(false); return; }
    // Same physical device (another tab / stale hold under our own name) → take it
    // back instead of locking ourselves out.
    if (sameDevice(lock)) { claim(); return; }
    // Someone else holds it (and it's fresh) → we're read-only.
    if (!isStale(lock)) { setReadOnly(true); return; }
    // Stale/empty lock → it's up for grabs. If WE were the writer, re-claim;
    // otherwise stay read-only until the user takes over (avoids two auto-claims
    // racing). The very first claim happens in start().
    if (!readOnly) claim();
  }

  async function start() {
    // DECOMMISSIONED in the multi-document multi-user model: there is no single-
    // writer lock anymore, so every session is always writable. The function (and
    // this module's read-only-safe getters) are kept so existing callers in
    // pages.js / app.js don't break, but it now does nothing except guarantee
    // writable mode for this session.
    if (started) return;
    started = true;
    setReadOnly(false);
  }

  function notifyBlockedSave() {
    const now = Date.now();
    // Throttle so a burst of blocked saves doesn't stack popups.
    if (now - lastBlockedToast < 600) return;
    lastBlockedToast = now;
    const who = (holder && holder.holderName) ? holder.holderName : t('another user', 'مستخدم آخر');
    renderBanner();
    // If a blocked-save popup is already open, don't open another.
    if (document.getElementById('blocked-save-modal')) return;
    const isAdmin = myRole() === 'admin';
    const overlay = document.createElement('div');
    overlay.id = 'blocked-save-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = `
      <div role="alertdialog" aria-modal="true" style="background:var(--surface,#fff);color:var(--text,#1a1a1a);max-width:420px;width:100%;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.35);overflow:hidden;border:1px solid var(--border,#e3e3e8)">
        <div style="padding:18px 20px;border-bottom:1px solid var(--border,#eee);display:flex;align-items:center;gap:10px">
          <span style="font-size:22px">🔒</span>
          <div style="font-size:16px;font-weight:800">${t('Action blocked', 'تم منع الإجراء')}</div>
        </div>
        <div style="padding:18px 20px;font-size:14px;line-height:1.6">
          ${t('Sorry, you can’t do this action right now because the editing session is held by', 'عذراً، لا يمكنك تنفيذ هذا الإجراء الآن لأن جلسة التعديل بحوزة')}
          <b>${escapeHtml(who)}</b>.
          <div style="margin-top:10px;color:var(--text-dim,#777);font-size:12.5px">
            ${isAdmin
              ? t('You can take over the session to edit — this will switch the other device to read-only.', 'يمكنك استلام الجلسة للتعديل — سيتحول الجهاز الآخر إلى وضع القراءة فقط.')
              : t('Please wait until they finish, or ask an admin to take over.', 'يرجى الانتظار حتى ينتهوا، أو اطلب من المشرف استلام الجلسة.')}
          </div>
        </div>
        <div style="padding:14px 20px;display:flex;gap:10px;justify-content:flex-end;border-top:1px solid var(--border,#eee)">
          ${isAdmin ? `<button id="blocked-takeover" style="background:var(--accent,#7a1f2b);color:#fff;border:none;border-radius:8px;padding:9px 16px;font-weight:700;cursor:pointer">${t('Take over session', 'استلام الجلسة')}</button>` : ''}
          <button id="blocked-dismiss" style="background:transparent;border:1px solid var(--border,#ccc);color:var(--text,#333);border-radius:8px;padding:9px 16px;font-weight:600;cursor:pointer">${t('OK', 'حسناً')}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => { overlay.remove(); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    const dismiss = document.getElementById('blocked-dismiss');
    if (dismiss) dismiss.addEventListener('click', close);
    const take = document.getElementById('blocked-takeover');
    if (take) take.addEventListener('click', () => { close(); try { takeOver(); } catch (_) {} });
  }

  return {
    start,
    isReadOnly: () => readOnly,
    notifyBlockedSave,
    takeOver,
    setDeviceName: () => { const n = promptDeviceName(true); renderBanner(); return n; },
    _sessionId: () => sessionId,
    // Who currently holds the editing session (the device that can edit).
    holderInfo: () => holder ? { name: holder.holderName || 'A device', role: holder.role || '', ts: holder.ts || 0, sessionId: holder.sessionId, isMe: iHoldIt(holder), stale: isStale(holder) } : null,
    iHoldSession: () => !readOnly,
    myDeviceName: () => holderName(),
  };
})();


function snapshotSyncBase(src) {
  const s = src || state;
  const base = {};
  for (const key of MERGE_COLLECTIONS) {
    try { base[key] = JSON.parse(JSON.stringify(s[key] || [])); }
    catch (_) { base[key] = []; }
  }
  try { base.settings = JSON.parse(JSON.stringify(s.settings || {})); } catch (_) { base.settings = {}; }
  _syncBase = base;
}

// ─── Element-level list merge (concurrency-safe lists) ──────────────────────
// Firestore replaces arrays wholesale, so two people adding to the SAME record's
// list (invoice payments, member subscriptions, salary payments…) could overwrite
// each other. These helpers 3-way-merge a list BY ELEMENT so every addition sticks
// and edits/removals are still honoured. Used by BOTH the client merge (below) and
// the cloud WRITE (storage.js, via window._mergeArrayById) so the fix is end-to-end.
function _isPlainObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function _elKey(e) {
  if (!_isPlainObj(e)) return 'v:' + _stableStr(e);
  if (e.id != null) return 'id:' + e.id;
  if (e._rid != null) return 'rid:' + e._rid;
  // `_sid` = subscription rows' stable id. MUST be recognized here: without it a
  // subscription is keyed by its whole CONTENT, so the moment any field changes
  // (e.g. an attendance tick bumps attendedClasses) a concurrent merge treats the
  // edited row as a NEW element and keeps BOTH copies — one clone per sync, growing
  // unbounded (the "infinite duplicate subscriptions" bug). Keying by _sid makes an
  // edit stay the SAME element. (v6.295.0)
  if (e._sid != null) return 'sid:' + e._sid;
  if (e.pid != null) return 'pid:' + e.pid;
  // id-less element (enrollment / invoice line-item / payment) → identity by CANONICAL
  // content. MUST use the SAME key as the dedupe guard (_enrKey): it ignores transient
  // UI-only fields (_originalSport/_paid/_attended) and sorts keys, so the merge collapses
  // exactly the rows the cleaner removes. If they disagree, the sync merge RE-ADDS a
  // duplicate the cleaner just deleted → the cleanup "bounces back" (v6.301.0). This also
  // makes the merge itself self-dedupe id-less rows everywhere. (Payments have none of the
  // ignored fields, so their keying is unchanged.)
  return 's:' + (typeof _enrKey === 'function' ? _enrKey(e) : _stableStr(e));
}
// ── DELETE TOMBSTONES (v6.303.0) ────────────────────────────────────────────
// When you delete a list row (a subscription, payment, invoice line…) the sync merge
// would otherwise treat the still-in-the-cloud copy as a fresh remote ADD and RE-ADD it
// — so the delete "bounces back" and a "Deleted ✓" is a lie. A tombstone remembers
// "this element was deleted" so no sync can resurrect it for a while. Only UNIQUE-ID
// keys (id:/rid:/sid:/pid:) are tombstoned — content keys (s:…) could collide across
// different records, and those rows are kept unique by the one-per-sport / dedupe guards.
const _elTomb = (typeof window !== 'undefined') ? (window.__elTomb = window.__elTomb || new Map()) : new Map();
const _EL_TOMB_MS = 6 * 60 * 1000;   // honour a delete against stale syncs for ~6 minutes
const _isIdKey = k => /^(id|rid|sid|pid):/.test(k);
// A content-keyed row (s:…, e.g. an ENROLLMENT or invoice line — no stable id) is only unique
// WITHIN one record's field, so its tombstone MUST be scoped (record:id:field|key), or deleting
// e.g. Raed's MMA could wrongly drop an identical MMA row on another member. Unique-id keys
// (id/rid/sid/pid) are globally unique, so they tombstone UNSCOPED (scope ignored). (v6.308.0)
function _tombKey(key, scope) { return (_isIdKey(key) || !scope) ? key : (scope + '|' + key); }
function _elTombstone(key) { _elTomb.set(key, Date.now() + _EL_TOMB_MS); }   // caller passes the final (scoped) key
function _elIsTombstoned(key) { const t = _elTomb.get(key); if (t == null) return false; if (Date.now() > t) { _elTomb.delete(key); return false; } return true; }
// Explicitly remember a deleted element so a stale/concurrent sync can't resurrect it. Pass
// `scope` (e.g. 'members:270:enrollments') for content-keyed rows so the tombstone is per-record.
if (typeof window !== 'undefined') { window._tombstoneEl = (e, scope) => { try { _elTombstone(_tombKey(_elKey(e), scope)); } catch (_) {} }; }

// 3-way merge of a list by element key: adds from either side kept, edits favour
// local on true conflict, a removal is honoured only if the other side didn't touch it.
function _mergeArrayById(baseArr, localArr, remoteArr, scope) {
  const L = Array.isArray(localArr) ? localArr : [];
  const R = Array.isArray(remoteArr) ? remoteArr : [];
  const B = Array.isArray(baseArr) ? baseArr : [];
  const bi = new Map(), li = new Map(), ri = new Map();
  for (const e of B) bi.set(_elKey(e), e);
  for (const e of L) li.set(_elKey(e), e);
  for (const e of R) ri.set(_elKey(e), e);
  // A UNIQUE-ID element that WAS in the base but is now gone from local = a delete →
  // remember it, so the same element arriving from a stale remote isn't re-added below.
  for (const k of bi.keys()) { if (!li.has(k) && _isIdKey(k)) _elTombstone(k); }
  const out = [], seen = new Set();
  const order = [...L.map(_elKey), ...R.map(_elKey)];   // local order first, then remote-only
  for (const k of order) {
    if (seen.has(k)) continue; seen.add(k);
    const b = bi.get(k), l = li.get(k), r = ri.get(k);
    const inL = li.has(k), inR = ri.has(k), inB = bi.has(k);
    if (inL && inR) {
      const lCh = !inB || _stableStr(l) !== _stableStr(b);
      const rCh = !inB || _stableStr(r) !== _stableStr(b);
      if (lCh && rCh && _stableStr(l) !== _stableStr(r)) out.push(l);   // conflicting edit → local
      else if (rCh && !lCh) out.push(r);                               // only remote edited
      else out.push(l);                                                // only local edited / identical
    } else if (inL && !inR) {
      const lCh = !inB || _stableStr(l) !== _stableStr(b);
      if (inB && !lCh) { /* removed remotely, untouched locally → drop */ } else out.push(l);
    } else if (inR && !inL) {
      const rCh = !inB || _stableStr(r) !== _stableStr(b);
      // Drop if: removed locally & remote unchanged (normal delete), OR this element was
      // explicitly tombstoned by a delete (honour it even if it isn't in the base). The
      // tombstone lookup uses the SCOPED key so a content-keyed enrollment delete sticks
      // per-record without touching an identical row on another member. (v6.308.0)
      if ((inB && !rCh) || _elIsTombstoned(_tombKey(k, scope))) { /* deleted → do not resurrect */ } else out.push(r);
    }
  }
  return out;
}
// 3-way merge of ONE record's fields: element-merge arrays, deep-merge nested maps,
// scalars favour whichever side changed (local wins a true conflict). Used when a
// record was edited on BOTH sides so no field/element is dropped.
function _mergeRecord(base, local, remote, scope) {
  const b = _isPlainObj(base) ? base : {}, l = _isPlainObj(local) ? local : {}, r = _isPlainObj(remote) ? remote : {};
  const out = { ...l };
  const keys = new Set([...Object.keys(l), ...Object.keys(r)]);
  for (const k of keys) {
    const lv = l[k], rv = r[k], bv = b[k], inL = (k in l), inR = (k in r);
    // A field present on only ONE side → keep that side WHOLE. This MUST come before the
    // array/map element-merge below: element-merging an array/map against an ABSENT side
    // (undefined → treated as []) would drop every base-unchanged element/cell the present
    // side holds, and (for arrays) also tombstone them. Firestore docs are complete so this
    // is defensive, but it closes the vector entirely. (v6.324 architecture review)
    if (inL && !inR) { out[k] = lv; continue; }
    if (!inL && inR) { out[k] = rv; continue; }
    // pass a per-field scope so a content-keyed delete tombstone is honoured on the READ
    // merge too (not just the cloud write) — makes an enrollment delete stick even if a
    // stale second tab pushes the row back. (v6.308.0)
    if (Array.isArray(lv) || Array.isArray(rv)) { out[k] = _mergeArrayById(bv, lv, rv, scope ? scope + ':' + k : undefined); continue; }
    if (_isPlainObj(lv) && _isPlainObj(rv)) { out[k] = _mergeRecord(bv, lv, rv, scope ? scope + ':' + k : undefined); continue; }
    const lCh = _stableStr(lv) !== _stableStr(bv), rCh = _stableStr(rv) !== _stableStr(bv);
    out[k] = (rCh && !lCh) ? rv : lv;   // only remote changed → remote; else local (incl. conflict)
  }
  return out;
}
if (typeof window !== 'undefined') { window._mergeArrayById = _mergeArrayById; window._mergeRecord = _mergeRecord; }

// Merge one collection. Returns { merged: [...], conflicts: n }.
function _mergeCollection(baseArr, localArr, remoteArr, collKey) {
  const base = _indexById(baseArr);
  const local = _indexById(localArr);
  const remote = _indexById(remoteArr);
  const _dk = id => (collKey || '') + '|' + id;
  // Records WITHOUT an id can't be merged by key. To avoid ever dropping them,
  // handle them separately: if this collection contains any id-less records,
  // keep the side (local vs remote) that has more of them, and never lose data.
  const localNoId = (Array.isArray(localArr) ? localArr : []).filter(r => !r || r.id == null);
  const remoteNoId = (Array.isArray(remoteArr) ? remoteArr : []).filter(r => !r || r.id == null);
  const allIds = new Set([...local.keys(), ...remote.keys(), ...base.keys()]);
  const out = [];
  let conflicts = 0;
  for (const id of allIds) {
    const b = base.get(id), l = local.get(id), r = remote.get(id);
    const inL = local.has(id), inR = remote.has(id), inB = base.has(id);
    if (inR) _delStrikes.delete(_dk(id));   // present in remote → clear any pending-delete strike
    // Present on both sides → compare against base to decide.
    if (inL && inR) {
      const lChanged = !inB || _stableStr(l) !== _stableStr(b);
      const rChanged = !inB || _stableStr(r) !== _stableStr(b);
      if (lChanged && rChanged && _stableStr(l) !== _stableStr(r)) {
        // Both sides edited this record → field/element-level merge so NObody's list
        // entry (payment, sport, …) or field is dropped, instead of keeping local whole.
        out.push(_mergeRecord(b, l, r, (collKey || '') + ':' + id)); conflicts++;
      } else if (rChanged && !lChanged) {
        out.push(r);                         // only remote changed
      } else {
        out.push(l);                         // only local changed, or identical
      }
      continue;
    }
    // Present on only one side.
    if (inL && !inR) {
      // Missing remotely. If it was CONFIRMED (in base, unchanged locally) the other
      // device MAY have deleted it — but only honour that after TWO consecutive absences,
      // so a single stale/partial snapshot can't delete a confirmed record (paid salary).
      // The strike itself carries the "was confirmed, now missing once" state across the
      // base advancing to the record-less remote, so genuine deletes still propagate.
      const lChanged = inB ? _stableStr(l) !== _stableStr(b) : false;
      const hadStrike = _delStrikes.has(_dk(id));
      if ((inB && !lChanged) || hadStrike) {
        if (hadStrike) { _delStrikes.delete(_dk(id)); /* 2nd consecutive absence → honour delete (drop) */ }
        else { _delStrikes.set(_dk(id), 1); out.push(l); /* 1st absence → KEEP this round */ }
      } else out.push(l);   // genuine fresh local add (never confirmed) → always keep
      continue;
    }
    if (inR && !inL) {
      const rChanged = !inB || _stableStr(r) !== _stableStr(b);
      if (inB && !rChanged) { /* deleted locally, untouched remotely → drop */ }
      else out.push(r);
      continue;
    }
    // (in base only → deleted on both → drop)
  }
  // Re-attach id-less records as a UNION of both sides, de-duplicated by content key —
  // never drop the smaller side. The old "keep whichever side has more" silently lost the
  // other side's distinct rows (e.g. Device A adds 1 schedule slot while remote already has
  // 2 different ones → A's slot vanished). (v6.324 architecture review)
  const _noIdSeen = new Set();
  for (const r of localNoId.concat(remoteNoId)) { const k = _elKey(r); if (_noIdSeen.has(k)) continue; _noIdSeen.add(k); out.push(r); }
  return { merged: out, conflicts };
}

// Merge a remote snapshot into local state in place. Returns the conflict count.
function mergeRemoteIntoState(remoteState) {
  if (!remoteState) return { conflicts: 0, changed: false };
  _checkVersionFromRemote(remoteState);   // flag if cloud is newer than this browser
  const base = _syncBase || {};
  let totalConflicts = 0;
  let changed = false;
  for (const key of MERGE_COLLECTIONS) {
    if (!(key in remoteState) && !(key in state)) continue;
    const before = _stableStr(state[key] || []);
    const { merged, conflicts } = _mergeCollection(base[key] || [], state[key] || [], remoteState[key] || [], key);
    if (_stableStr(merged) !== before) { state[key] = merged; changed = true; }
    totalConflicts += conflicts;
  }
  // settings: object — take remote only for keys local didn't change vs base.
  if (remoteState.settings) {
    const bs = (base.settings) || {}, ls = state.settings || {}, rs = remoteState.settings;
    const out = { ...ls };
    for (const k of Object.keys(rs)) {
      const lChanged = _stableStr(ls[k]) !== _stableStr(bs[k]);
      if (!lChanged) out[k] = rs[k];   // local untouched → accept remote
    }
    if (_stableStr(out) !== _stableStr(ls)) { state.settings = out; changed = true; }
  }
  // The CONFIRMED remote snapshot becomes the new shared base — NOT the merged
  // result. The merged state also contains our own local records that the cloud has
  // not echoed back yet; if those went into the base, the very next remote sync would
  // see them as "in base + local but missing remotely" and DELETE them (silent data
  // loss). Basing on the confirmed remote keeps unsynced local adds/edits as genuine
  // local changes that the merge preserves until the cloud confirms them.
  snapshotSyncBase(remoteState);
  // Records that ARRIVED from the cloud are marked "known" so the create-audit
  // tracker won't attribute another device's invoices/expenses to this one.
  try {
    if (window.__knownRecIds) {
      for (const inv of (remoteState.invoices || [])) window.__knownRecIds.invoices.add(String(inv.id));
      for (const e of (remoteState.expenses || [])) window.__knownRecIds.expenses.add(String(e.id));
    }
  } catch (_) {}
  // BELT-AND-SUSPENDERS (v6.301.0): dedupe the MERGED result so no remote snapshot can
  // ever leave a duplicate in local state (which the next save would push back to the
  // cloud). With _elKey now aligned to _enrKey the merge already self-dedupes; this
  // guarantees it even if a future path slips through.
  try { if (typeof _dedupeSubsGuard === 'function') _dedupeSubsGuard(); } catch (_) {}
  return { conflicts: totalConflicts, changed };
}

// BACKSTOP against the duplicate-subscriptions bug (v6.296.0). A subscription's
// `_sid` is a UNIQUE per-row id (registration `s<mid>_<i>`, renewal `s<ts>`, …), so
// two rows sharing a `_sid` are ALWAYS the same subscription cloned — never a legit
// distinct row (genuine rows, incl. family/twins, always get their own `_sid`). This
// runs on EVERY save and collapses same-`_sid` rows to ONE (keeping the most-attended),
// so the bloat can never persist or regrow no matter what created it. Cheap: it only
// rebuilds a member's list when a duplicate `_sid` is actually present; rows without a
// `_sid` are left untouched. Attendance is unaffected (it lives in dailyAttendance).
// Canonical signature of an enrollment for exact-duplicate detection. Enrollments have
// NO stable id and are meant to be ONE per sport, so two rows with the same content are
// always redundant clones. Built from sorted keys so field order can't fool it; volatile
// UI-only fields (stripped before save anyway) are ignored.
function _enrKey(e) {
  if (!e || typeof e !== 'object') return 'v:' + JSON.stringify(e);
  // IGNORE display-only / volatile fields so two otherwise-identical rows key the SAME.
  // `coach` is a DISPLAY string derived from `coachId` (which IS kept) and flips between
  // null / '—' (no-coach placeholder) / a name — that flip made two identical Summer-Camp
  // invoice lines look DIFFERENT, so the sync merge doubled them and the dedupe guard
  // couldn't collapse them (v6.310.0). coachId still distinguishes genuinely different coaches.
  const IGN = { _originalSport: 1, _paid: 1, _attended: 1, coach: 1 };
  const keys = Object.keys(e).filter(k => !IGN[k]).sort();
  return keys.map(k => k + '=' + JSON.stringify(e[k])).join('|');
}
function _dedupeSubsGuard() {
  let collapsed = 0, membersHit = 0, enrCollapsed = 0, enrMembers = 0, liCollapsed = 0, liInv = 0;
  for (const m of (state.members || [])) {
    // ── subscriptions: dedupe by the stable unique id `_sid` ──
    const subs = m && m.subscriptions;
    if (Array.isArray(subs) && subs.length >= 2) {
      const sids = new Set(); let hasDupe = false;
      for (const s of subs) { const k = s && s._sid; if (k == null) continue; if (sids.has(k)) { hasDupe = true; break; } sids.add(k); }
      if (hasDupe) {
        const seen = new Map(); const out = [];
        for (const s of subs) {
          const k = s && s._sid;
          if (k == null) { out.push(s); continue; }              // id-less row → keep as-is
          const prev = seen.get(k);
          if (!prev) { seen.set(k, s); out.push(s); continue; }
          collapsed++;                                            // duplicate _sid → collapse
          if ((s.attendedClasses || 0) > (prev.attendedClasses || 0)) { const i = out.indexOf(prev); if (i >= 0) out[i] = s; seen.set(k, s); }
        }
        m.subscriptions = out; membersHit++;
      }
    }
    // ── enrollments: STRICTLY ONE PER SPORT (the app's invariant — _enrollmentsMatchSubs
    // treats a repeated sport as drift, the edit path matches by sport). Keying by content
    // missed near-identical same-sport rows (e.g. a 2nd "Summer Camp" differing in a hidden
    // field), which is the "duplicate sport I deleted keeps coming back" bug. Collapse to one
    // per sport, KEEPING the row whose coach matches the active subscription (else the first).
    // v6.302.0
    const enr = m && m.enrollments;
    if (Array.isArray(enr) && enr.length >= 2) {
      let subsBySport = null;
      try { subsBySport = (typeof _activeSubsBySport === 'function') ? _activeSubsBySport(m) : null; } catch (_) {}
      const seen = new Map(); const out = []; let hit = false;
      for (const e of enr) {
        const sp = e && e.sport;
        if (!sp) { out.push(e); continue; }                    // rows without a sport → keep
        const kept = seen.get(sp);
        if (!kept) { seen.set(sp, e); out.push(e); continue; }
        enrCollapsed++; hit = true;                            // duplicate sport → collapse
        const sub = subsBySport && subsBySport.get(sp);
        if (sub && (e.coachId || null) === (sub.coachId || null) && (kept.coachId || null) !== (sub.coachId || null)) {
          const i = out.indexOf(kept); if (i >= 0) out[i] = e; seen.set(sp, e);   // prefer the coach-correct row
        }
      }
      if (hit) { m.enrollments = out; enrMembers++; }
    }
  }
  // ── invoice line-items: no id → collapse EXACT-content duplicate lines (the merge
  // doubled them). NEVER touches invoice.amount, so REVENUE cannot move — only the
  // redundant line rows are removed so the line-sum matches the (correct) stored amount.
  for (const inv of (state.invoices || [])) {
    const li = inv && inv.lineItems;
    if (!Array.isArray(li) || li.length < 2) continue;
    const seen = new Set(); const out = []; let hit = false;
    for (const l of li) { const k = _enrKey(l); if (seen.has(k)) { liCollapsed++; hit = true; continue; } seen.add(k); out.push(l); }
    if (hit) { inv.lineItems = out; liInv++; }
  }
  if (collapsed > 0) { try { console.warn(`[dedupe-guard] collapsed ${collapsed} duplicate subscription row(s) across ${membersHit} member(s) before save`); } catch (_) {} }
  if (enrCollapsed > 0) { try { console.warn(`[dedupe-guard] collapsed ${enrCollapsed} duplicate enrollment row(s) across ${enrMembers} member(s) before save`); } catch (_) {} }
  if (liCollapsed > 0) { try { console.warn(`[dedupe-guard] collapsed ${liCollapsed} duplicate invoice line-item(s) across ${liInv} invoice(s) before save (amounts untouched)`); } catch (_) {} }
  return collapsed + enrCollapsed + liCollapsed;
}

// Give every invoice payment a STABLE, cross-device-deterministic `pid` if it lacks one, so
// the element-merge keys it by id (never by volatile content). Two IDENTICAL installments
// (same amount+date+method, no id) get DISTINCT ids via a per-content collision counter, so
// a later merge can't silently collapse them into one and under-count money. Idempotent:
// a payment that already has a pid/id is left untouched. (v6.324 architecture review)
function _ensurePaymentIds() {
  for (const inv of (state.invoices || [])) {
    const ps = inv && inv.payments;
    if (!Array.isArray(ps) || !ps.length) continue;
    const seen = {};
    for (const p of ps) {
      if (!p || typeof p !== 'object') continue;
      if (p.pid != null && p.pid !== '') continue;
      if (p.id != null && p.id !== '') { p.pid = 'i' + p.id; continue; }   // reuse an existing id
      const at = (p.at != null ? String(p.at) : '');
      const base = at ? ('a' + at) : ('c' + (Number(p.amount) || 0) + '|' + (p.date || '') + '|' + String(p.method || '').toLowerCase());
      const n = seen[base] = (seen[base] || 0) + 1;
      p.pid = base + '#' + n;
    }
  }
}
function save() {
  // Stamp a create-audit for any new invoice/expense before persisting, so the
  // revenue stream is always traceable (runs before the stale/quota guards below
  // so a to-be-saved creation is logged even if that save is later deferred).
  try { _auditNewRecords(); } catch (_) {}
  // BACKSTOP: never let duplicate-subscription clones reach the cloud (see above).
  try { _dedupeSubsGuard(); } catch (_) {}
  // MONEY SAFETY (v6.324 review): give every invoice payment a STABLE pid so the element-
  // merge can never collapse two genuine identical installments (same amount+date+method
  // with no id) into one — which would silently under-count collected money.
  try { _ensurePaymentIds(); } catch (_) {}
  // Stale-version guard (v6.313.0 — NON-DESTRUCTIVE). This tab runs OLDER code than the
  // cloud (common right after a deploy, or when another device is on a newer build). We WARN
  // the user to refresh for the latest features — but we NO LONGER BLOCK the save. The old
  // behaviour (return false, persist nothing) SILENTLY THREW THE USER'S DATA AWAY: they saved,
  // refreshed, and it was gone. With field-level + element-level merge an older tab only writes
  // the fields/records IT changed and CANNOT wipe newer data, so persisting is safe — and never
  // losing the user's work is the priority. (The persistent banner already asks them to refresh.)
  if (_staleVersion) {
    try { if (typeof showStaleVersionBanner === 'function') showStaleVersionBanner(_cloudAppVersion); } catch (_) {}
  }
  // MULTI-DOCUMENT model (multi-user build): the old single-writer "session lock"
  // that forced everyone but one device into read-only is GONE. The storage layer
  // now writes only the records that changed, each as its own Firestore document
  // with field-level merge (nested maps like member.dailyAttendance are deep-merged),
  // so any number of users — reception, coaches marking attendance, the owner — can
  // edit at the same time without overwriting each other. No save is ever blocked
  // for being a non-holder. (The stale-version guard above still applies.)
  let stateToSave;
  try {
    // Device-local / session-only fields must NEVER be synced to other devices:
    // the open page (route), the signed-in identity (user) and the admin
    // preview role (session) belong to THIS browser only.
    const { user, route, session, ...persistable } = state;
    // Never let a stale tab roll the cloud's version stamp BACKWARD (that would un-flag other
    // newer tabs as stale). Stamp the HIGHER of our version and the highest cloud version seen.
    const stampVer = (_cloudAppVersion && _verCmp(_cloudAppVersion, APP_VERSION) > 0) ? _cloudAppVersion : APP_VERSION;
    stateToSave = { ...persistable, __schema: SCHEMA_VERSION, __appVersion: stampVer };

    // Capacity check on the serialized payload (the dominant localStorage user).
    let approxBytes = 0;
    try { approxBytes = JSON.stringify(stateToSave).length; } catch (_) {}
    const pct = LS_LIMIT_BYTES ? (approxBytes / LS_LIMIT_BYTES * 100) : 0;
    const mb = (approxBytes / 1048576).toFixed(1);
    if (pct >= 90 && _lastStorageWarnLevel < 90) {
      _lastStorageWarnLevel = 90;
      storageToast(`⚠ Storage ${Math.round(pct)}% full (${mb}MB of ~5MB). Click to export a backup now, then archive old data — saves may soon start failing.`, 'error');
    } else if (pct >= 70 && _lastStorageWarnLevel < 70) {
      _lastStorageWarnLevel = 70;
      storageToast(`Storage is ${Math.round(pct)}% full (${mb}MB of ~5MB). Click here to export a backup.`, 'info');
    } else if (pct < 70) {
      _lastStorageWarnLevel = 0;   // dropped back down (e.g. after archiving) — re-arm
    }

    window.Storage.save(stateToSave);
    localStorage.setItem(LS_VERSION_KEY, SEED_VERSION);
    // NOTE: we deliberately do NOT advance the sync base here. A local save is not yet
    // confirmed by the cloud, so treating it as the base would make the next remote
    // merge delete our just-added records as "missing remotely" (silent data loss).
    // The base only advances from CONFIRMED cloud data — on load(), and after a remote
    // snapshot is merged (mergeRemoteIntoState → snapshotSyncBase(remoteState)).
  } catch (e) {
    const isQuota = e && (e.name === 'QuotaExceededError' || e.code === 22 ||
      e.code === 1014 || /quota/i.test(e.message || ''));
    if (isQuota) {
      _lastStorageWarnLevel = 90;
      console.error('Save failed — storage quota exceeded:', e);
      try {
        storageToast('❌ SAVE FAILED — browser storage is full. Your latest change was NOT saved. Click here to export a backup now, then archive or delete old records to free space.', 'error');
      } catch (_) {}
    } else {
      console.warn('Save failed:', e);
    }
  }
  return true;   // save was attempted (queued to cloud + written locally)
}

// ─── Write-through confirmation (persist to the cloud BEFORE proceeding) ─────
// saveConfirmed(): run the normal save, then RESOLVE only once the cloud has the data.
// Returns { ok:true } (offline/local are durable instantly) or { ok:false, error }.
async function saveConfirmed() {
  const okLocal = save();   // create-audit + guards + queue the write (Storage.save)
  // save() returns false when it was BLOCKED (stale version) — never falsely confirm.
  if (okLocal === false) return { ok: false, error: 'save blocked — refresh to the latest version' };
  try {
    if (window.Storage && typeof window.Storage.saveAndConfirm === 'function') return await window.Storage.saveAndConfirm();
  } catch (e) { return { ok: false, error: (e && (e.code || e.message)) || String(e) }; }
  return { ok: true };
}
window.saveConfirmed = saveConfirmed;

// UI wrapper for a CRITICAL action (payment / invoice / member / attendance): perform the
// mutation, then WAIT for the cloud to confirm before proceeding. On success → onOk (close
// modal + toast); on failure → loud persistent warning + Retry, and it does NOT proceed, so
// nobody thinks money/data was saved when it wasn't. opts.btn (optional) shows "Saving…".
async function withCloudConfirm(opts) {
  opts = opts || {};
  const btn = opts.btn || null;
  let btnHtml = null;
  if (btn) { btnHtml = btn.innerHTML; btn.disabled = true; btn.innerHTML = '⏳ ' + t('Saving…', 'جاري الحفظ…'); }
  const res = await saveConfirmed();
  if (btn) { btn.disabled = false; if (btnHtml != null) btn.innerHTML = btnHtml; }
  if (res && res.ok) {
    if (typeof opts.onOk === 'function') { try { opts.onOk(res); } catch (_) {} }
    else if (opts.okMsg) { try { toast('✓ ' + opts.okMsg, 'success'); } catch (_) {} }
    return true;
  }
  const reason = (res && (res.error || res.blocked)) || 'unknown';
  try { toast('⚠ ' + t('NOT saved to the cloud', 'لم يُحفظ في السحابة') + ' — ' + t('check your connection & retry', 'تحقق من الاتصال وأعد المحاولة') + ' (' + reason + ')', 'error'); } catch (_) {}
  if (typeof opts.onFail === 'function') { try { opts.onFail(res); } catch (_) {} }
  return false;
}
window.withCloudConfirm = withCloudConfirm;

async function load() {
  try {
    const parsed = await window.Storage.load();
    if (!parsed) return false;
    _checkVersionFromRemote(parsed);   // flag if the stored data is from a newer app version

    // Migrate from older schemas. NEVER wipe user data — only adapt its shape.
    const savedSchema = parsed.__schema || 1;
    if (savedSchema < SCHEMA_VERSION) {
      runMigrations(parsed, savedSchema);
      parsed.__schema = SCHEMA_VERSION;
      window._schemaMigrated = { from: savedSchema, to: SCHEMA_VERSION };
    }

    // Apply parsed onto live state (preserve session-only fields for THIS device)
    const savedUser = state.user, savedRoute = state.route, savedSession = state.session;
    Object.assign(state, parsed);
    state.user = savedUser; state.route = savedRoute; state.session = savedSession;

    // Ensure all expected fields exist (safe no-ops if already present).
    if (!Array.isArray(state.trials))          state.trials = [];
    if (!Array.isArray(state.rentals))         state.rentals = [];
    if (!Array.isArray(state.rentalCustomers)) state.rentalCustomers = [];
    if (!Array.isArray(state.schedule))        state.schedule = [];
    if (!Array.isArray(state.products))        state.products = [];
    // One-time, non-destructive expense-category update: the legacy "Coach Pool" and
    // "Coach Commission" categories are retired (coach payouts live on the Salaries
    // screen), and "Maintenance" is added. Existing expenses keep their saved category
    // text — only the SELECTABLE list changes. Idempotent: safe to run every load.
    if (state.settings && Array.isArray(state.settings.expenseCategories)) {
      const drop = ['coach pool', 'coach commission'];
      state.settings.expenseCategories = state.settings.expenseCategories.filter(c => !drop.includes(String(c).toLowerCase()));
      if (!state.settings.expenseCategories.some(c => String(c).toLowerCase() === 'maintenance')) {
        // Insert Maintenance near the other operational categories (after Rent if present).
        const idx = state.settings.expenseCategories.findIndex(c => String(c).toLowerCase() === 'rent');
        if (idx >= 0) state.settings.expenseCategories.splice(idx + 1, 0, 'Maintenance');
        else state.settings.expenseCategories.unshift('Maintenance');
      }
      // Ensure "Bank Commission" exists (used by the auto card-fee row), pinned first.
      if (!state.settings.expenseCategories.some(c => String(c).toLowerCase() === 'bank commission')) {
        state.settings.expenseCategories.unshift('Bank Commission');
      }
    }
    if (!Array.isArray(state.sales))           state.sales = [];
    if (!Array.isArray(state.advices))         state.advices = [];
    // Broadcast advice/articles (coach→students, admin→coaches+members) with
    // audience targeting, read receipts and reply threads.
    if (!Array.isArray(state.posts))           state.posts = [];
    state.posts.forEach(p => {
      if (!Array.isArray(p.comments)) p.comments = [];
      if (!Array.isArray(p.recipients)) p.recipients = [];
      if (!p.readBy || typeof p.readBy !== 'object') p.readBy = {};
      if (!p.audience || typeof p.audience !== 'object') p.audience = { scope: 'all' };
    });
    if (!Array.isArray(state.families))        state.families = [];
    if (!Array.isArray(state.drivers))         state.drivers = [];
    if (!Array.isArray(state.cashCounts))      state.cashCounts = [];
    // Each advice can carry a comment thread (coach ↔ student). Ensure it exists.
    state.advices.forEach(a => { if (!Array.isArray(a.comments)) a.comments = []; });
    // Every invoice MUST carry a billing month. Some imported/legacy invoices only
    // had a date; backfill month = date[:7] so the revenue screens (which fall back
    // to the date) and the commission/payroll screens (which read i.month) can never
    // disagree about which month an invoice belongs to.
    (state.invoices || []).forEach(i => { if (i && !i.month && i.date) i.month = String(i.date).slice(0, 7); });
    // Same for expenses: the dashboard filters by e.month while the Monthly Report
    // falls back to the date — backfill so both screens count the same expenses.
    (state.expenses || []).forEach(e => { if (e && !e.month && e.date) e.month = String(e.date).slice(0, 7); });
    if (!state.settings) state.settings = {};
    if (state.settings.expiringSoonDays == null) state.settings.expiringSoonDays = 3;
    if (state.settings.lowStockThreshold == null) state.settings.lowStockThreshold = 3;
    // Commission basis: keep a valid stored value; default unknown → attendance.
    if (state.settings.commissionBasis !== 'attendance' && state.settings.commissionBasis !== 'payment') state.settings.commissionBasis = 'attendance';
    // One-time switch of existing clubs to the agreed attendance-based rule.
    // (Sets a flag so the admin can still switch back to 'payment' afterwards.)
    if (!state.settings.commissionBasisInit) {
      state.settings.commissionBasis = 'attendance';
      state.settings.commissionBasisInit = true;
    }
    // Commission start date: commission only counts invoices/subscriptions dated on or
    // after this. Default to 1 June 2026 the first time; admin can change it in Settings.
    if (state.settings.commissionStartDate === undefined) state.settings.commissionStartDate = '2026-06-01';
    if (!state.campSchedule || !state.campSchedule.days) state.campSchedule = defaultCampSchedule();
    if (!state.session || !state.session.role) state.session = { role: 'admin' };
    // Camp duration corrected to 14–28 Jun 2026 — fix existing data that still has the old end date.
    if (state.campSchedule && state.campSchedule.endDate === '2026-08-27') {
      state.campSchedule.startDate = '2026-06-14';
      state.campSchedule.endDate = '2026-06-28';
    }
    // Partial payments: existing invoices predate amountPaid → treat as fully paid
    // so no historical revenue changes. New invoices set amountPaid explicitly.
    for (const inv of (state.invoices || [])) {
      if (inv.amountPaid == null) inv.amountPaid = inv.amount;
    }
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
    // Record the freshly-loaded data as the merge base for multi-device sync.
    try { snapshotSyncBase(state); } catch (_) {}
    // Baseline the create-audit tracker: existing invoices/expenses are NOT "new".
    try { _seedKnownRecIds(); } catch (_) {}
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
        { label: '6 weeks', days: 42, price: 2500 },
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

  // 8 → 9: Strip coachId from existing Summer Camp enrollments + subscriptions.
  // From v100 onward, Summer Camp has no coach — but older data may have coach
  // assignments that now confuse the UI. Clean them up on first load.
  if (fromVersion < 9) {
    for (const m of (data.members || [])) {
      (m.enrollments || []).forEach(e => {
        if (e.sport === SUMMER_CAMP) { e.coachId = null; e.coach = null; }
      });
      (m.subscriptions || []).forEach(s => {
        if (s.activity === SUMMER_CAMP) { s.coachId = null; s.coach = null; }
      });
    }
    // Also clean line items on existing invoices
    for (const inv of (data.invoices || [])) {
      (inv.lineItems || []).forEach(li => {
        if (li.sport === SUMMER_CAMP) { li.coachId = null; li.coach = null; }
      });
    }
  }
  // Future migrations go here as more `if (fromVersion < N)` blocks.
}

function resetData(skipConfirm) {
  if (!skipConfirm && !confirm('Clear ALL data and start with an empty database? You will need to re-import your Excel sheets. This cannot be undone.')) return;
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
  window.__allowEmptySave = true;   // this empty write is intentional — bypass the wipe-guard
  save();
  window.__allowEmptySave = false;
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

// Arabic month names (e.g. يونيه, مايو) for the Arabic side of invoices.
const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيه','يوليه','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
function fmtDateAr(d) {
  if (!d) return '—';
  const s = String(d);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${parseInt(m[3], 10)} ${AR_MONTHS[parseInt(m[2], 10) - 1]} ${m[1]}`;
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return `${dt.getDate()} ${AR_MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
  } catch { return d; }
}
function fmtMonthAr(m) {
  if (!m) return '—';
  const [y, mo] = m.split('-');
  return `${AR_MONTHS[parseInt(mo) - 1]} ${y}`;
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

// Latest month that actually has data, but never AHEAD of the current month, so a
// future-dated invoice (e.g. a July renewal created in June) doesn't make every
// screen default to a month that hasn't started yet. Falls back to today.
function latestDataMonth() {
  const cm = currentMonth();
  const a = availableMonths();
  if (!a.length) return cm;
  const started = a.filter(m => m && m <= cm);          // months that have begun
  if (started.length) return started.reduce((x, y) => (y > x ? y : x));
  return a.reduce((x, y) => (y > x ? y : x));            // all data is future-dated → newest
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length || !parts[0]) return '?';
  return ((parts[0][0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

// ─── Gender-aware member avatar ─────────────────────────────────────
// Boys (gender Male) get a 👦 on a blue tile, girls (Female) a 👧 on a pink tile;
// a member with no gender set keeps their initials on the default tile. Returns
// { content, bg, isEmoji } so callers can size the tile themselves.
function memberAvatarParts(m) {
  const g = m && m.gender;
  if (g === 'Male')   return { content: '👦', bg: 'linear-gradient(135deg,#5b8def,#3870d0)', isEmoji: true };
  if (g === 'Female') return { content: '👧', bg: 'linear-gradient(135deg,#ec4899,#d13d8a)', isEmoji: true };
  return { content: initials(m && m.name), bg: 'linear-gradient(135deg,var(--blue),var(--purple))', isEmoji: false };
}
// Full .avatar div for a member at the given pixel size (default 32).
function memberAvatarHtml(m, size, extraStyle) {
  size = size || 32;
  const { content, bg, isEmoji } = memberAvatarParts(m);
  const fs = Math.round(size * (isEmoji ? 0.58 : 0.36));
  return `<div class="avatar" style="width:${size}px;height:${size}px;font-size:${fs}px;background:${bg}${extraStyle ? ';' + extraStyle : ''}">${content}</div>`;
}

// ─── Coach avatar (sport-based emoji + gender-tinted tile) ───────────
// An emoji for a sport/activity. Reuses the camp icon map (hoisted). Returns ''
// for an empty sport and '⭐' for an unknown one.
function sportIcon(sport) { return (typeof campActivityIcon === 'function') ? campActivityIcon(sport) : ''; }
// A coach's primary (first) sport — drives their avatar emoji.
function coachPrimarySport(c) { return (c && Array.isArray(c.sports) && c.sports.length) ? c.sports[0] : null; }
// Tile colour by gender: male=blue, female=pink, unset=neutral brand gradient.
function genderTile(gender) {
  if (gender === 'Male')   return 'linear-gradient(135deg,#5b8def,#3870d0)';
  if (gender === 'Female') return 'linear-gradient(135deg,#ec4899,#d13d8a)';
  return 'linear-gradient(135deg,var(--blue),var(--purple))';
}
// Avatar for a coach/staff: their PRIMARY sport's emoji on a gender-tinted tile.
// Staff (no sport) fall back to 👔; a coach with no sport set falls back to 🥋.
function coachAvatarHtml(c, size, extraStyle) {
  size = size || 32;
  const sport = coachPrimarySport(c);
  const emoji = sport ? sportIcon(sport) : ((c && c.role === 'staff') ? '👔' : '🥋');
  const bg = genderTile(c && c.gender);
  const fs = Math.round(size * 0.56);
  return `<div class="avatar" style="width:${size}px;height:${size}px;font-size:${fs}px;background:${bg}${extraStyle ? ';' + extraStyle : ''}">${emoji || '🥋'}</div>`;
}

// The coach record for the signed-in account, resolved ROBUSTLY: prefer the
// account's mapped coachId, but if that is missing/stale (points to a coach that
// no longer exists) fall back to matching the LOGIN EMAIL to a coach's email.
// Returns the coach object, or null when the account isn't a coach / can't link.
function myCoach() {
  const u = state.user;
  if (!u || u.role !== 'coach') return null;
  const byId = (u.coachId != null) ? (state.coaches || []).find(c => c.id === u.coachId) : null;
  if (byId) return byId;
  const em = (u.email || u.username || '').trim().toLowerCase();
  if (em) {
    const byEmail = (state.coaches || []).find(c => (c.email || '').trim().toLowerCase() === em && em);
    if (byEmail) return byEmail;
  }
  return null;
}

// ─── Phone display + WhatsApp helpers ───────────────────────────────
// List of country codes shown in the mobile-input dropdown. Ordered by
// relevance to a Qatar-based club: GCC first, then Levant + nearby Arab
// states, then the most common nationalities working in Qatar, then a
// few major Western codes for visiting members. Qatar is the default.
const COUNTRY_CODES = [
  { code: '+974', flag: '🇶🇦', name: 'Qatar' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+965', flag: '🇰🇼', name: 'Kuwait' },
  { code: '+973', flag: '🇧🇭', name: 'Bahrain' },
  { code: '+968', flag: '🇴🇲', name: 'Oman' },
  { code: '+20',  flag: '🇪🇬', name: 'Egypt' },
  { code: '+962', flag: '🇯🇴', name: 'Jordan' },
  { code: '+961', flag: '🇱🇧', name: 'Lebanon' },
  { code: '+963', flag: '🇸🇾', name: 'Syria' },
  { code: '+964', flag: '🇮🇶', name: 'Iraq' },
  { code: '+967', flag: '🇾🇪', name: 'Yemen' },
  { code: '+970', flag: '🇵🇸', name: 'Palestine' },
  { code: '+218', flag: '🇱🇾', name: 'Libya' },
  { code: '+216', flag: '🇹🇳', name: 'Tunisia' },
  { code: '+213', flag: '🇩🇿', name: 'Algeria' },
  { code: '+212', flag: '🇲🇦', name: 'Morocco' },
  { code: '+249', flag: '🇸🇩', name: 'Sudan' },
  { code: '+91',  flag: '🇮🇳', name: 'India' },
  { code: '+92',  flag: '🇵🇰', name: 'Pakistan' },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: '+94',  flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '+977', flag: '🇳🇵', name: 'Nepal' },
  { code: '+63',  flag: '🇵🇭', name: 'Philippines' },
  { code: '+62',  flag: '🇮🇩', name: 'Indonesia' },
  { code: '+60',  flag: '🇲🇾', name: 'Malaysia' },
  { code: '+90',  flag: '🇹🇷', name: 'Turkey' },
  { code: '+98',  flag: '🇮🇷', name: 'Iran' },
  { code: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: '+27',  flag: '🇿🇦', name: 'South Africa' },
  { code: '+44',  flag: '🇬🇧', name: 'UK' },
  { code: '+1',   flag: '🇺🇸', name: 'USA / Canada' },
  { code: '+49',  flag: '🇩🇪', name: 'Germany' },
  { code: '+33',  flag: '🇫🇷', name: 'France' },
];
const DEFAULT_COUNTRY_CODE = '+974';
const MIN_PHONE_DIGITS = 8;  // National-number portion (excluding country code)

// Parse a stored phone string like "+97450012345" or "97450012345" or
// "974 5001 2345" into { code, digits }. Best-effort: matches the longest
// known country code prefix; if none matches, defaults to Qatar.
function parseStoredPhone(stored) {
  if (!stored) return { code: DEFAULT_COUNTRY_CODE, digits: '' };
  let s = String(stored).trim();
  const leadPlus = s.startsWith('+');
  const cleaned = s.replace(/[^\d]/g, '');
  // Sort codes by length DESC so '+974' wins over '+9'
  const codesSorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);

  // Pass 1: explicit '+' prefix → match by country code
  if (leadPlus) {
    for (const c of codesSorted) {
      const digitsOfCode = c.code.replace('+', '');
      if (cleaned.startsWith(digitsOfCode)) {
        return { code: c.code, digits: cleaned.slice(digitsOfCode.length) };
      }
    }
  }

  // Pass 2: no '+' but the digits start with a known country code AND the
  // remaining national-number portion is at least MIN_PHONE_DIGITS long.
  // This catches CSV imports / legacy data where the leading '+' was missing.
  // Example: "97450012345" → +974 + 50012345
  for (const c of codesSorted) {
    const digitsOfCode = c.code.replace('+', '');
    if (cleaned.startsWith(digitsOfCode) &&
        cleaned.length - digitsOfCode.length >= MIN_PHONE_DIGITS) {
      return { code: c.code, digits: cleaned.slice(digitsOfCode.length) };
    }
  }

  // Pass 3: no country code detectable — treat the whole thing as the local
  // number under the default country (Qatar).
  return { code: DEFAULT_COUNTRY_CODE, digits: cleaned };
}

// Render the country-code dropdown + digit input as a single block.
// idPrefix: e.g. 'f-phone' → produces #f-phone-code and #f-phone-digits.
// currentPhone: stored value to pre-populate (best-effort parse).
function phoneInputHtml(idPrefix, currentPhone, opts = {}) {
  const { code, digits } = parseStoredPhone(currentPhone);
  const placeholder = opts.placeholder || `e.g. 50012345`;
  const required = opts.required !== false;
  const reqStar = required ? ' <span style="color:var(--accent)">*</span>' : '';
  const label = opts.label || 'Mobile';
  const fieldStyle = opts.fieldStyle || '';
  return `
    <div class="field" style="${fieldStyle}">
      <label>${escapeHtml(label)}${reqStar}</label>
      <div style="display:grid;grid-template-columns:120px 1fr;gap:6px">
        <select id="${idPrefix}-code">
          ${COUNTRY_CODES.map(c => `<option value="${c.code}" ${c.code === code ? 'selected' : ''}>${c.flag} ${c.code}</option>`).join('')}
        </select>
        <input id="${idPrefix}-digits" type="tel" inputmode="numeric" pattern="[0-9]*" value="${escapeHtml(digits)}" placeholder="${escapeHtml(placeholder)}" />
      </div>
      <div class="text-mute" style="font-size:10px;margin-top:3px">Country + ${MIN_PHONE_DIGITS}+ digits</div>
    </div>
  `;
}

// Read the phone input back. Returns { phone, code, digits, valid, error }.
// `phone` is the canonical combined string like "+97450012345".
// `valid` is false if digits < MIN_PHONE_DIGITS (caller decides what to do).
function readPhoneInput(idPrefix) {
  const codeEl = document.getElementById(idPrefix + '-code');
  const digitsEl = document.getElementById(idPrefix + '-digits');
  const code = codeEl ? codeEl.value : DEFAULT_COUNTRY_CODE;
  const rawDigits = digitsEl ? digitsEl.value.replace(/[^\d]/g, '') : '';
  // If admin pasted "+97450012345" into the digits field, strip the redundant code
  let digits = rawDigits;
  const codeDigits = code.replace('+', '');
  if (digits.startsWith(codeDigits) && digits.length > MIN_PHONE_DIGITS) {
    digits = digits.slice(codeDigits.length);
  }
  const valid = digits.length >= MIN_PHONE_DIGITS;
  const phone = digits ? `${code}${digits}` : '';
  return {
    phone,
    code,
    digits,
    valid,
    error: !digits ? 'Mobile required' : (!valid ? `Mobile must be at least ${MIN_PHONE_DIGITS} digits` : null),
  };
}

// Renders a phone number with a clickable WhatsApp icon. Used everywhere
// admin sees a phone (Members, Invoices, Rentals, Coaches, etc.) so the
// "message this person" action is always one click away.
//
// Filters out the +9747000... placeholder phones from old imports — they
// look like real numbers but reach nobody.
//
// opts:
//   stop:  default true — adds event.stopPropagation() so clicking the icon
//          inside a row doesn't also open the row's detail view
//   empty: HTML to show when no phone — defaults to a muted "—"
//   text:  pre-filled WhatsApp message (URL-encoded automatically)
function isRealPhone(phone) {
  if (!phone) return false;
  const trimmed = String(phone).trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('+9747000')) return false;  // legacy placeholder
  return true;
}

function waLink(phone, text) {
  if (!isRealPhone(phone)) return null;
  const clean = String(phone).replace(/[^\d]/g, '');
  const t = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${clean}${t}`;
}

// Bilingual birthday celebration message for the Birthdays screen.
function birthdayWaMessage(m) {
  const first = (m && m.name) ? String(m.name).split(' ')[0] : '';
  const ar = (m && m.nameArabic) ? String(m.nameArabic).trim() : '';
  const en = `Happy Birthday ${first}! 🎂🎉\n\nEveryone at Black Stars Sports Club wishes you a wonderful day filled with joy and success. Keep shining — see you on the mat! 🥋💪`;
  const arMsg = `🎂🎉 كل عام وأنت بخير${ar ? ' يا ' + ar : ''}!\n\nيتمنى لك جميع أعضاء نادي بلاك ستارز الرياضي يوماً سعيداً مليئاً بالفرح والنجاح. نراك في النادي! 🥋💪`;
  return en + '\n\n———\n\n' + arMsg;
}

// ─── REMINDER TEMPLATES ──────────────────────────────────────────
// Bilingual WhatsApp messages for renewal nudges. Stored in settings so
// admin can customize from System → Settings. Tokens are substituted at
// send time: {name}, {nameArabic}, {sport}, {coach}, {expiry}, {daysAgo}, {daysLeft}.
// If a member has no Arabic name, the Arabic section is skipped automatically.
const DEFAULT_REMINDER_TEMPLATES = {
  expired_en: `Hi {name} 👋

Your {sport} membership at Black Stars Sports Club expired {daysAgo} ago (on {expiry}).

We miss you on the mat! 🥋 Come back and pick up right where you left off — your goals are still waiting 💪🔥

Renew today and let's get back to work 🌟

⭐ Black Stars Sports Club`,
  expired_ar: `مرحباً {nameArabic} 👋

انتهى اشتراكك في {sport} بنادي بلاك ستارز الرياضي منذ {daysAgo} (بتاريخ {expiry}).

اشتقنا لك على البساط! 🥋 عُد وأكمل من حيث توقفت — أهدافك ما زالت تنتظرك 💪🔥

جدد اشتراكك اليوم ولنعد إلى التدريب 🌟

⭐ نادي بلاك ستارز الرياضي`,
  expiring_en: `Hi {name} 👋

Friendly reminder: your {sport} membership at Black Stars Sports Club expires in {daysLeft} (on {expiry}) ⏳

Don't break your momentum now! 🔥 Renew today and keep training toward your goals 💪 See you on the mat 🥋

⭐ Black Stars Sports Club`,
  expiring_ar: `مرحباً {nameArabic} 👋

تذكير ودّي: اشتراكك في {sport} بنادي بلاك ستارز الرياضي سينتهي خلال {daysLeft} (بتاريخ {expiry}) ⏳

لا توقف اندفاعك الآن! 🔥 جدد اشتراكك اليوم وواصل التقدّم نحو أهدافك 💪 نراك على البساط 🥋

⭐ نادي بلاك ستارز الرياضي`,
  completed_en: `Hi {name} 👋

Congratulations — you've completed all your {sport} sessions at Black Stars Sports Club! 🎉🥋

You put in the work and it shows 💪 Ready for the next round? Renew now to keep the momentum going 🔥

⭐ Black Stars Sports Club`,
  completed_ar: `مرحباً {nameArabic} 👋

مبارك — لقد أكملت جميع حصص {sport} بنادي بلاك ستارز الرياضي! 🎉🥋

بذلت جهداً رائعاً وظهرت النتيجة 💪 جاهز للجولة القادمة؟ جدّد الآن لتواصل تقدّمك 🔥

⭐ نادي بلاك ستارز الرياضي`,
  trial_en: `Hi {name} 👋

It was great having you at Black Stars Sports Club for your {sport} trial! 🥋 Our coaches were impressed 💪

Ready to make it official? Join us and start your journey — your spot is waiting and the team can't wait to train with you 🔥

Reply here and we'll get you set up 🌟

⭐ Black Stars Sports Club`,
  trial_ar: `مرحباً {nameArabic} 👋

سعدنا بوجودك في نادي بلاك ستارز الرياضي في حصة {sport} التجريبية! 🥋 وقد أعجب المدربون بأدائك 💪

جاهز للانضمام رسمياً؟ ابدأ رحلتك معنا — مكانك بانتظارك والفريق متحمس للتدريب معك 🔥

ردّ علينا هنا وسنجهّز لك كل شيء 🌟

⭐ نادي بلاك ستارز الرياضي`,
};

function reminderTemplate(key) {
  const fromSettings = state.settings?.reminderTemplates?.[key];
  return (typeof fromSettings === 'string' && fromSettings.trim())
    ? fromSettings
    : DEFAULT_REMINDER_TEMPLATES[key];
}

function joinSports(arr, conj) {
  if (!arr || !arr.length) return '';
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return arr[0] + ' ' + conj + ' ' + arr[1];
  return arr.slice(0, -1).join(', ') + ' ' + conj + ' ' + arr[arr.length - 1];
}

// Distinct sports a member would need to renew (their enrolments, excluding camp).
function memberRenewalSports(m) {
  const out = [];
  for (const e of (m?.enrollments || [])) {
    if (e.sport && e.sport !== SUMMER_CAMP && !out.includes(e.sport)) out.push(e.sport);
  }
  if (!out.length && m?.sport) out.push(m.sport);
  return out;
}

// A coach's earnings for a month: fixed salary + commission (rate% of revenue
// from invoices linked to this coach for currently-active members that month).
// monthKey = 'YYYY-MM'. Mirrors the Coach Performance / Salaries logic.
function coachEarnings(coach, monthKey) {
  let revenue = 0, commissionBase = 0; const studentSet = new Set();
  for (const inv of (state.invoices || [])) {
    if (inv.deleted) continue;
    if (monthKey && invoiceBillMonth(inv) !== monthKey) continue;
    // Walk LINE ITEMS so a multi-sport / merged invoice credits each coach only
    // for their own sport's price — not the whole invoice. Fall back to the
    // invoice-level coach when an invoice has no line items.
    const lines = (Array.isArray(inv.lineItems) && inv.lineItems.length)
      ? inv.lineItems
      : [{ coachId: inv.coachId, price: inv.amount || 0 }];
    let coachAmt = 0, involved = false, eligBase = 0;
    const mem = inv.customerId ? state.members.find(x => x.id === inv.customerId) : null;
    for (const li of lines) {
      if (li.coachId !== coach.id) continue;
      involved = true;
      coachAmt += parseFloat(li.price) || 0;
      // Commission base follows the club rule: ≥1 attended class required,
      // frozen members pro-rated by attendance, others full.
      const elig = lineCommissionEligibility(mem, inv, li, null);
      if (elig.eligible) eligBase += elig.base;
    }
    if (!involved) continue;
    revenue += coachAmt;
    if (inv.customerId && mem) {
      studentSet.add(mem.id);
      commissionBase += eligBase;
    }
  }
  const rate = coach.rate || 0;
  const commission = commissionBase * rate / 100;
  const fixed = coach.fixedSalary || 0;
  return { revenue, commissionBase, rate, commission, fixed, total: fixed + commission, students: studentSet.size };
}

// What ONE member is worth per renewal cycle = the sum of all their enrolment
// prices (what they pay each cycle for every sport they're enrolled in).
function memberRenewalValue(m) {
  if (!m) return 0;
  // 1) Preferred: sum of current enrolment prices (the intended renewal price).
  const list = (m.enrollments && m.enrollments.length)
    ? m.enrollments
    : (m.sport ? [{ price: m.price }] : []);
  let v = list.reduce((s, e) => s + (parseFloat(e.price) || 0), 0);
  if (v > 0) return v;
  // 2) Fallback: the member's most recent REAL invoice total (what they actually
  //    last paid). Skips zero / internal switch-credit invoices. This covers
  //    imported or renewed members whose enrolment prices weren't captured.
  if (state && Array.isArray(state.invoices)) {
    let best = null;
    for (const inv of state.invoices) {
      if (inv.customerId !== m.id || inv.switchCredit) continue;
      if (!((parseFloat(inv.amount) || 0) > 0)) continue;
      const key = inv.date || inv.month || '';
      if (!best || key > best.key) best = { key, amount: parseFloat(inv.amount) || 0 };
    }
    if (best) return best.amount;
  }
  // 3) Last resort: latest subscription amountPaid.
  if (Array.isArray(m.subscriptions) && m.subscriptions.length) {
    for (let i = m.subscriptions.length - 1; i >= 0; i--) {
      const amt = parseFloat(m.subscriptions[i].amountPaid) || 0;
      if (amt > 0) return amt;
    }
  }
  return 0;
}

// Club-wide: if EVERY distinct (non-deleted) member renewed once, total value +
// how many members that covers, and how many of them have a priced membership.
function clubRenewalValue(members) {
  const list = (members || (state && state.members) || []).filter(m => !m.deleted);
  let total = 0, withValue = 0;
  for (const m of list) {
    const v = memberRenewalValue(m);
    total += v;
    if (v > 0) withValue++;
  }
  return { total, members: list.length, withValue };
}


// Date + time (e.g. "04 Jun 2026 · 03:12 PM").
function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return fmtDate(iso.slice(0, 10)) + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Build the WhatsApp message body for a given member + scenario.
// `kind` is 'expired' or 'expiring'. Pads English + Arabic, separated by a
// horizontal divider. Skips the Arabic section if the member has no Arabic name.
// Encouraging WhatsApp follow-up for a trial (prospect who came for a free class).
// Bilingual — Arabic first, then English. Uses a customisable template (Settings →
// reminder templates) with sensible defaults, and fills {name}/{sport}/{coach}.
function buildTrialFollowupMessage(t) {
  if (!t) return '';
  const sportEn = t.sport || 'training';
  const sportAr = t.sport || 'التدريب';
  const coach = t.coachId ? coachName(t.coachId) : '';
  function fill(tpl, isArabic) {
    return tpl
      .replace(/\{name\}/g, (isArabic ? (t.nameArabic || t.name) : t.name) || '')
      .replace(/\{nameArabic\}/g, t.nameArabic || t.name || '')
      .replace(/\{sport\}/g, isArabic ? sportAr : sportEn)
      .replace(/\{coach\}/g, coach);
  }
  const ar = fill(reminderTemplate('trial_ar'), true);
  const en = fill(reminderTemplate('trial_en'), false);
  return `${ar}\n\n— — — — — — —\n\n${en}`;
}

function buildReminderMessage(m, kind, daysFromToday) {
  const _sports = memberRenewalSports(m);
  const sportEn = joinSports(_sports, '&') || 'membership';
  const sportAr = joinSports(_sports, 'و') || 'membership';
  const coach = m.coachId ? coachName(m.coachId) : '';
  const expiry = fmtDate(m.expiryDate);
  // Days strings — Arabic uses Arabic numerals naturally via the locale; we
  // emit plain numbers since WhatsApp renders them correctly in both contexts
  const daysAbs = Math.abs(daysFromToday || 0);
  const daysAgoEn = daysAbs === 1 ? '1 day' : `${daysAbs} days`;
  const daysAgoAr = daysAbs === 1 ? 'يوم واحد' : daysAbs === 2 ? 'يومين' : `${daysAbs} أيام`;
  const daysLeftEn = daysAbs === 0 ? 'today' : daysAbs === 1 ? '1 day' : `${daysAbs} days`;
  const daysLeftAr = daysAbs === 0 ? 'اليوم' : daysAbs === 1 ? 'يوم واحد' : daysAbs === 2 ? 'يومين' : `${daysAbs} أيام`;

  function fill(tpl, isArabic) {
    return tpl
      .replace(/\{name\}/g, m.name || '')
      .replace(/\{nameArabic\}/g, m.nameArabic || m.name || '')
      .replace(/\{sport\}/g, isArabic ? sportAr : sportEn)
      .replace(/\{coach\}/g, coach)
      .replace(/\{expiry\}/g, expiry || '')
      .replace(/\{daysAgo\}/g, isArabic ? daysAgoAr : daysAgoEn)
      .replace(/\{daysLeft\}/g, isArabic ? daysLeftAr : daysLeftEn);
  }

  const enKey = kind === 'expired' ? 'expired_en' : kind === 'completed' ? 'completed_en' : 'expiring_en';
  const arKey = kind === 'expired' ? 'expired_ar' : kind === 'completed' ? 'completed_ar' : 'expiring_ar';
  const en = fill(reminderTemplate(enKey), false);
  const ar = fill(reminderTemplate(arKey), true);   // {nameArabic} falls back to {name}
  // Always send BOTH languages, Arabic first.
  return `${ar}\n\n— — — — — — —\n\n${en}`;
}

// ─── DUPLICATE DETECTION ─────────────────────────────────────────
// Normalizes a phone for comparison: digits-only.
// Two phones are considered "duplicates" if:
//   (a) their digits-only forms are equal, OR
//   (b) one is a suffix of the other AND the shorter one has ≥ 8 digits
//       (catches the "+97450012345" vs "50012345" case where one stored the
//        country code and the other didn't)
// Shared search matcher: builds a normalised haystack from the given fields and
// tests the query against it (Arabic-letter-folded + lowercase), then falls back
// to phone-digit matching. `phones` are the stored phone fields to digit-match.
function searchMatchesFields(query, textFields, phones) {
  const raw = String(query || '').trim();
  if (!raw) return true;
  const q = normalizeArabicForSearch(raw);
  const hay = normalizeArabicForSearch((textFields || []).filter(Boolean).join(' '));
  if (q && hay.includes(q)) return true;
  // Phone-aware fallback: match by digits, format-insensitive.
  const qDigits = raw.replace(/\D/g, '');
  if (qDigits.length >= 4) {
    for (const p of (phones || [])) {
      if (p && phoneSearchMatches(p, qDigits)) return true;
    }
  }
  return false;
}

function normalizePhoneForCompare(phone) {
  if (!phone) return '';
  let d = String(phone).replace(/[^\d]/g, '');
  // Canonicalise Qatari numbers to the local 8-digit form so every way of writing
  // the same number compares equal: +97450413948 / 0097450413948 / 974 50413948 /
  // 50413948 / "5041 3948" all reduce to 50413948.
  d = d.replace(/^00/, '');        // 00974… → 974…
  if (d.length > 8 && d.startsWith('974')) d = d.slice(3);   // drop 974 country code
  return d;
}

// Normalise Arabic text so common letter variants compare equal in search:
//  • alef forms أ إ آ ٱ → ا
//  • ة → ه , ى → ي , ؤ → و , ئ → ي
//  • strip tashkeel (diacritics) and tatweel (ـ)
// Also lowercases, so it's safe to run on mixed Arabic/Latin strings.
function normalizeArabicForSearch(s) {
  if (!s) return '';
  return String(s)
    .replace(/[أإآٱ]/g, 'ا')        // alef variants → ا
    .replace(/ة/g, 'ه')             // ة → ه
    .replace(/ى/g, 'ي')             // ى → ي
    .replace(/ؤ/g, 'و')             // ؤ → و
    .replace(/ئ/g, 'ي')             // ئ → ي
    .replace(/ء/g, '')              // standalone hamza ء → (drop)
    .replace(/[\u064B-\u0652\u0670]/g, '')   // tashkeel/diacritics
    .replace(/ـ/g, '')              // tatweel ـ
    .replace(/[ \t\n\r\u00A0\u200B\u200C\u200D\u202F\uFEFF]+/g, '')   // all spaces incl Arabic/NBSP/zero-width
    .toLowerCase()
    .trim();
}

// Returns true if two stored phones likely refer to the same person.
function phonesMatch(a, b) {
  const aD = normalizePhoneForCompare(a);
  const bD = normalizePhoneForCompare(b);
  if (!aD || !bD) return false;
  if (aD === bD) return true;
  // Suffix match — the shorter one is missing the country code
  const minLen = MIN_PHONE_DIGITS;  // 8
  if (aD.length >= minLen && bD.length >= minLen) {
    if (aD.endsWith(bD) || bD.endsWith(aD)) return true;
  }
  return false;
}

// ─── Partial payments ───────────────────────────────────────────────
// An invoice's `amount` is the full price. `amountPaid` is cash collected so
// far, and `payments` is the receipt ledger [{date, month, amount, method}].
// Legacy invoices (neither field) are treated as fully paid, so historical
// revenue is unchanged. Revenue is CASH-basis: counted in the month each
// payment is received. Coach commission stays on the full fee (uses `amount`).
function invoicePaid(inv) {
  if (!inv) return 0;
  if (inv.amountPaid != null) return inv.amountPaid;
  return inv.amount || 0;               // legacy = fully paid
}

// Canonical payment-method token. Collapses any casing / label ("Cash", "Bank
// transfer", "Visa", Arabic) to exactly one of: cash | card | fawran | transfer.
// Applied on WRITE (recordPayment) so a by-method breakdown can NEVER split into
// separate "cash" vs "Cash" buckets (the accuracy bug where 19 camp payments were
// stored as capital-C "Cash"). The financial screens also normalise on read.
function normalizeMethod(mRaw) {
  const x = String(mRaw == null ? '' : mRaw).toLowerCase();
  if (x.indexOf('card') >= 0 || x.indexOf('visa') >= 0 || x.indexOf('mada') >= 0) return 'card';
  if (x.indexOf('fawran') >= 0 || x.indexOf('فوران') >= 0) return 'fawran';
  if (x.indexOf('transfer') >= 0 || x.indexOf('bank') >= 0 || x.indexOf('online') >= 0 || x.indexOf('حويل') >= 0) return 'transfer';
  return 'cash';
}

// ── The ONE supported way to add money to an invoice ─────────────────────────
// Append a single immutable, dated payment row. APPEND-ONLY: existing rows are
// never rewritten, re-split, or re-derived. Amount is rounded to 2dp and must be
// finite and non-zero. `paid` is always just the sum of these rows. This is the
// guardrail that makes the payment ledger impossible to corrupt by re-derivation
// (the failure mode that produced the old garbage rows cannot occur here).
function recordPayment(inv, opts) {
  if (!inv) return null;
  opts = opts || {};
  const amt = Math.round((Number(opts.amount) || 0) * 100) / 100;
  if (!isFinite(amt) || amt === 0) return null;
  if (!Array.isArray(inv.payments)) inv.payments = [];
  const date = opts.date || TODAY;
  const row = { date, month: String(date).slice(0, 7), amount: amt, method: normalizeMethod(opts.method) };
  if (opts.sport) row.sport = opts.sport;   // tag: which SPORT this installment pays for (drives the per-month split)
  // Who recorded this installment (req #4 payment history + #5 last-updated).
  row.by = opts.by || currentUserId();
  row.byName = opts.byName || currentUserName();
  row.at = new Date().toISOString();
  inv.payments.push(row);
  inv.amountPaid = inv.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  stampUpdate(inv);
  return row;
}
// Sum of an invoice's recorded payment rows (the canonical paid amount when a
// payments[] ledger exists). Falls back to invoicePaid for legacy invoices.
function invoicePaymentsSum(inv) {
  if (inv && Array.isArray(inv.payments) && inv.payments.length) {
    return inv.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }
  return invoicePaid(inv);
}

// How much of a (possibly multi-sport) invoice was paid TOWARD ONE sport.
// Payments tagged with that sport are counted directly; any remaining (untagged,
// legacy) paid amount is apportioned by the sport's price share. This stops the
// "Edit pricing" screen from mixing two sports' partial payments together.
function invoicePaidForSport(inv, sport) {
  if (!inv) return 0;
  const total = invoicePaid(inv);
  const pays = Array.isArray(inv.payments) ? inv.payments : [];
  let taggedForSport = 0, taggedTotal = 0;
  for (const p of pays) {
    if (p && p.sport) {
      const amt = Number(p.amount) || 0;
      taggedTotal += amt;
      if (p.sport === sport) taggedForSport += amt;
    }
  }
  const lineSum = (Array.isArray(inv.lineItems) && inv.lineItems.length)
    ? inv.lineItems.reduce((s, x) => s + (Number(x.price) || 0), 0)
    : (Number(inv.amount) || 0);
  const li = Array.isArray(inv.lineItems) ? inv.lineItems.find(x => x.sport === sport) : null;
  const linePrice = li ? (Number(li.price) || 0) : (Number(inv.amount) || 0);
  const share = lineSum > 0 ? (linePrice / lineSum) : 1;
  const untagged = Math.max(0, total - taggedTotal);
  return taggedForSport + untagged * share;
}
// Canonical invoice TOTAL. When an invoice has line items, THEY are the bill (each
// sport's price) — `inv.amount` is only a cache that can go stale if a sport was
// added without recomputing it (e.g. Football added to a member who already had
// Summer Camp). Using the line sum makes balance / status / dues reflect what the
// member actually owes — the same figure the Edit-pricing screen shows. Falls back
// to inv.amount for single-line / legacy invoices with no line items.
function invoiceTotal(inv) {
  if (!inv) return 0;
  if (Array.isArray(inv.lineItems) && inv.lineItems.length) {
    return inv.lineItems.reduce((s, li) => s + (Number(li.price) || 0), 0);
  }
  return Number(inv.amount) || 0;
}
function invoiceBalance(inv) {
  if (!inv) return 0;
  // Legacy invoices with NO payment ledger are treated as fully paid (the app's
  // long-standing convention) — never invent a phantom balance for them.
  if (inv.amountPaid == null && !(Array.isArray(inv.payments) && inv.payments.length)) return 0;
  return Math.max(0, invoiceTotal(inv) - invoicePaid(inv));
}
function invoiceStatus(inv) {
  if (!inv || invoiceTotal(inv) <= 0) return 'Paid';
  const paid = invoicePaid(inv);
  if (paid <= 0.001) return 'Unpaid';
  if (invoiceBalance(inv) > 0.001) return 'Partial';
  return 'Paid';
}
// ── Canonical month-revenue (SINGLE SOURCE OF TRUTH) ─────────────────────────
// Every "revenue / billed / collected / due" KPI MUST go through these so the
// Invoices, Transactions, Club Revenue and Owner Dashboard screens can never
// disagree again. Definition (matches the Invoices screen, the agreed truth):
//   • Scope  = invoices whose BILLING MONTH (i.month, falling back to the date)
//              equals the given YYYY-MM, excluding soft-deleted invoices.
//   • Value  = i.amount  (the invoice's own charged amount — NOT a re-sum of
//              line items, which can drift from amount and caused the 92,480 vs
//              91,530 gap). Line items are still used ONLY for per-sport / per-
//              coach attribution, never for the headline total.
function invoiceBillMonth(i) { return (i && (i.month || String(i.date || '').slice(0, 7))) || ''; }

// Fast member-by-id lookup, rebuilt only when the members array reference changes
// (i.e. on load / remote merge), so the hot revenue paths below stay O(1) per line.
let _memberIdx = null, _memberIdxSrc = null;
function memberById(id) {
  if (_memberIdxSrc !== state.members) {
    _memberIdxSrc = state.members;
    _memberIdx = new Map();
    for (const m of (state.members || [])) if (m) _memberIdx.set(m.id, m);
  }
  return _memberIdx.get(id) || null;
}

// The month a sport (invoice line) actually STARTS, taken from the member's
// subscription for that sport — the basis for revenue recognition (club policy:
// revenue follows the sport's start date, not the invoice month or payment date).
function lineSportStartMonth(li, inv) {
  if (!li || !inv || inv.customerId == null) return null;
  const sport = li.sport;
  if (!sport) return null;
  const mem = memberById(inv.customerId);
  if (!mem || !Array.isArray(mem.subscriptions)) return null;
  const subs = mem.subscriptions.filter(s => s && (s.activity || '') === sport);
  if (!subs.length) return null;
  const invMonth = inv.month || String(inv.date || '').slice(0, 7);
  const invDate = String(inv.date || (inv.month ? inv.month + '-15' : '')).slice(0, 10);
  // Pick the RIGHT subscription for THIS invoice (a member who renewed has several
  // for the same sport). Order: (1) exact invoice-ref link, (2) a subscription that
  // STARTED the same month as the invoice — a renewal invoice dated 30 Jun belongs to
  // the June period, not the member's original April enrolment, (3) the latest
  // subscription that started on/before the invoice date, (4) the first as a fallback.
  let sub = subs.find(s => s.invoiceNumber && inv.ref && s.invoiceNumber === inv.ref);
  if (!sub && invMonth) sub = subs.find(s => String(s.start || '').slice(0, 7) === invMonth);
  if (!sub && invDate) sub = subs.filter(s => s.start && String(s.start).slice(0, 10) <= invDate)
    .sort((a, b) => String(b.start).localeCompare(String(a.start)))[0];
  if (!sub) sub = subs[0];
  return (sub && sub.start) ? String(sub.start).slice(0, 7) : null;
}

// Day-level START date of every activity on an invoice — the subscription start date
// (YYYY-MM-DD) for each sport line, using the SAME subscription-picking as
// lineSportStartMonth. Used by the Invoices date filter so a picked date / range can
// match the invoice date OR any activity's start date. A walk-in / unlinked invoice
// (no member or no matching subscription) returns [] → it matches on its invoice date
// only, as intended.
function invoiceActivityStartDates(inv) {
  if (!inv || inv.customerId == null) return [];
  const mem = memberById(inv.customerId);
  if (!mem || !Array.isArray(mem.subscriptions)) return [];
  const items = (Array.isArray(inv.lineItems) && inv.lineItems.length) ? inv.lineItems : (inv.sport ? [{ sport: inv.sport }] : []);
  const invMonth = inv.month || String(inv.date || '').slice(0, 7);
  const invDate = String(inv.date || (inv.month ? inv.month + '-15' : '')).slice(0, 10);
  const out = new Set();
  for (const li of items) {
    const sport = li && li.sport;
    if (!sport) continue;
    const subs = mem.subscriptions.filter(s => s && (s.activity || '') === sport);
    if (!subs.length) continue;
    let sub = subs.find(s => s.invoiceNumber && inv.ref && s.invoiceNumber === inv.ref);
    if (!sub && invMonth) sub = subs.find(s => String(s.start || '').slice(0, 7) === invMonth);
    if (!sub && invDate) sub = subs.filter(s => s.start && String(s.start).slice(0, 10) <= invDate).sort((a, b) => String(b.start).localeCompare(String(a.start)))[0];
    if (!sub) sub = subs[0];
    if (sub && sub.start) out.add(String(sub.start).slice(0, 10));
  }
  return [...out];
}

// Per-line billing month: a sport added in a later month carries its own billMonth;
// otherwise it bills in the invoice's month. Used by COMMISSION scoping (kept on the
// invoice month so payroll is unchanged). REVENUE uses lineRevenueMonth() below.
function lineBillMonth(li, inv) { return (li && li.billMonth) || invoiceBillMonth(inv); }

// Per-line REVENUE month = the month that SPORT's revenue is recognized. Order:
//   1) an explicit li.billMonth (set when a sport is added in a later month), then
//   2) the sport's subscription START month (club policy — e.g. a Summer Camp that
//      starts in July counts in July even though the invoice was issued in June), then
//   3) the invoice's own month as a fallback.
// This lets ONE invoice span months — each sport's revenue counts in its start
// month — without splitting the invoice. (Commission stays on lineBillMonth.)
function lineRevenueMonth(li, inv) {
  if (li && li.billMonth) return li.billMonth;
  return lineSportStartMonth(li, inv) || invoiceBillMonth(inv);
}

// Map of month -> fraction of the invoice's value billed that month (by line price),
// on the REVENUE basis (each sport in its start month). No lineItems (rentals/sales/
// products) -> the whole invoice in its own month.
function invoiceMonthShares(inv) {
  const base = invoiceBillMonth(inv);
  const items = (inv && Array.isArray(inv.lineItems) && inv.lineItems.length) ? inv.lineItems : null;
  if (!items) return new Map([[base, 1]]);
  const sum = items.reduce((s, li) => s + (Number(li.price) || 0), 0);
  const m = new Map();
  if (sum <= 0) { m.set(base, 1); return m; }
  for (const li of items) {
    const mo = lineRevenueMonth(li, inv);
    m.set(mo, (m.get(mo) || 0) + (Number(li.price) || 0) / sum);
  }
  return m;
}
function invoiceMonths(inv) { return [...invoiceMonthShares(inv).keys()]; }
function invoiceMonthShare(inv, ym) { return invoiceMonthShares(inv).get(ym) || 0; }
function invoiceTouchesMonth(inv, ym) { return invoiceMonthShares(inv).has(ym); }

// Invoices whose PRIMARY month is ym (back-compat for counts).
function monthInvoices(ym) {
  return (state.invoices || []).filter(i => i && !i.deleted && invoiceBillMonth(i) === ym);
}
// Invoices that bill ANY value in ym — used for SEARCH / listing / month dropdowns
// so a multi-month invoice shows up under every month it touches.
function monthInvoicesAny(ym) {
  return (state.invoices || []).filter(i => i && !i.deleted && invoiceTouchesMonth(i, ym));
}
// Billed / collected / due in ym are LINE-aware: each invoice contributes its share
// for that month. For a single-month invoice the share is 1, so these are byte-for-
// byte identical to the old invoice-level sums (no change to existing data).
function billedInMonth(ym, pred) {
  let t = 0;
  for (const i of (state.invoices || [])) {
    if (!i || i.deleted) continue;
    if (pred && !pred(i)) continue;
    const sh = invoiceMonthShare(i, ym);
    if (sh) t += invoiceTotal(i) * sh;   // invoiceTotal = Σ line prices (or inv.amount if no lines) — the SAME total balance/dues use, so every screen agrees
  }
  return t;
}
// Collected toward a month's billing, using the PRECISE per-payment attribution
// (invoicePaidInMonth: tagged installments count in their sport's month, untagged
// waterfall earliest-first), capped at that month's billed so it can never exceed
// billed. This is the SAME "collected" the Invoices & Transactions screens show, so
// every financial screen agrees. The identity billed = collected + due holds per
// month (see dueInMonth). Raw cash by payment date is separate: cashCollectedInMonth.
function invoiceBilledInMonth(inv, ym) { return invoiceTotal(inv) * invoiceMonthShare(inv, ym); }
function collectedInMonth(ym) {
  let t = 0;
  for (const i of (state.invoices || [])) {
    if (!i || i.deleted) continue;
    const billed = invoiceBilledInMonth(i, ym);
    if (billed <= 0) continue;
    t += Math.min(invoicePaidInMonth(i, ym), billed);
  }
  return t;
}
function dueInMonth(ym) {
  let t = 0;
  for (const i of (state.invoices || [])) {
    if (!i || i.deleted) continue;
    const billed = invoiceBilledInMonth(i, ym);
    if (billed <= 0) continue;
    t += Math.max(0, billed - invoicePaidInMonth(i, ym));
  }
  return t;
}
// CASH actually collected in a month, by each PAYMENT's own date (drawer basis) —
// money physically received that month. Distinct from billedInMonth (revenue,
// recognized in each sport's START month). A camp prepaid in June but starting in
// July shows here in June (cash in) yet in July's revenue.
function cashCollectedInMonth(ym) {
  let t = 0;
  for (const i of (state.invoices || [])) { if (!i || i.deleted) continue; t += cashInMonth(i, ym); }
  return t;
}
// How much of an invoice's PAID amount belongs to a given month, using each
// payment's SPORT tag: a payment tagged to a sport counts in that sport's START
// month (regardless of the date it was physically paid — that stays in history).
// Untagged payments are applied EARLIEST-MONTH-FIRST against the remaining billed.
// This is the precise per-payment attribution behind the per-month Paid / Due.
function invoicePaidInMonth(inv, ym) {
  if (!inv) return 0;
  const pays = Array.isArray(inv.payments) ? inv.payments : [];
  if (!pays.length) {   // legacy invoice, no ledger → its paid sits in its own month
    return (invoiceBillMonth(inv) === ym) ? Math.min(invoicePaid(inv), invoiceTotal(inv)) : 0;
  }
  const invValue = invoiceTotal(inv);   // canonical total (Σ lines)
  const billedByMonth = new Map();
  for (const [mo, frac] of invoiceMonthShares(inv)) billedByMonth.set(mo, invValue * frac);
  // 1) Tagged payments → their sport's start month, exactly.
  const taggedByMonth = new Map();
  let tagged = 0, total = 0;
  for (const p of pays) {
    const a = Number(p.amount) || 0; total += a;
    if (p && p.sport) {
      const mo = lineSportStartMonth({ sport: p.sport }, inv) || _pMonth(p);
      taggedByMonth.set(mo, (taggedByMonth.get(mo) || 0) + a);
      tagged += a;
    }
  }
  // 2) Untagged remainder → waterfall over (billed − tagged), earliest month first.
  let untagged = total - tagged;
  const untaggedByMonth = new Map();
  for (const mo of [...billedByMonth.keys()].sort()) {
    const remain = Math.max(0, (billedByMonth.get(mo) || 0) - (taggedByMonth.get(mo) || 0));
    const alloc = Math.min(untagged, remain);
    if (alloc !== 0) untaggedByMonth.set(mo, alloc);
    untagged -= alloc;
  }
  return (taggedByMonth.get(ym) || 0) + (untaggedByMonth.get(ym) || 0);
}

// Period-aware (predicate on YYYY-MM) versions for the Reports dashboard, so it
// uses the SAME billed basis as the Monthly Report instead of a separate cash one.
function billedInPeriod(monthPred) {
  let t = 0;
  for (const i of (state.invoices || [])) {
    if (!i || i.deleted) continue;
    for (const [mo, sh] of invoiceMonthShares(i)) if (monthPred(mo)) t += invoiceTotal(i) * sh;   // canonical total (Σ lines) — matches billedInMonth
  }
  return t;
}
function billedByCategoryInPeriod(monthPred) {
  const out = {};
  for (const i of (state.invoices || [])) {
    if (!i || i.deleted) continue;
    const cat = i.category || 'Membership';
    for (const [mo, sh] of invoiceMonthShares(i)) if (monthPred(mo)) out[cat] = (out[cat] || 0) + invoiceTotal(i) * sh;
  }
  return out;
}
function billedBySportInPeriod(monthPred) {
  const out = {};
  for (const i of (state.invoices || [])) {
    if (!i || i.deleted) continue;
    const amount = invoiceTotal(i);
    const items = (Array.isArray(i.lineItems) && i.lineItems.length) ? i.lineItems
      : [{ sport: i.sport || i.activity || i.category || 'Other', price: amount }];
    const lineSum = items.reduce((s, li) => s + (Number(li.price) || 0), 0);
    for (const li of items) {
      const mo = lineBillMonth(li, i);
      if (!monthPred(mo)) continue;
      const sp = li.sport || i.sport || i.activity || i.category || 'Other';
      // Normalize line price to the invoice amount so per-sport totals re-sum to
      // billedInPeriod even when the invoice carries a discount.
      const val = lineSum > 0 ? amount * ((Number(li.price) || 0) / lineSum) : (items.length ? amount / items.length : 0);
      out[sp] = (out[sp] || 0) + val;
    }
  }
  return out;
}
// All months that appear anywhere in the data (invoices / expenses / salaries).
function allDataMonths() {
  const s = new Set();
  for (const i of (state.invoices || [])) if (!i.deleted) for (const mo of invoiceMonths(i)) if (mo) s.add(mo);
  for (const e of (state.expenses || [])) { if (e.deleted) continue; const mo = e.month || String(e.date || '').slice(0, 7); if (mo) s.add(mo); }
  for (const x of (state.salaries || [])) if (x.month) s.add(x.month);
  return [...s];
}
// Auto-calculated salary COST over a period = Σ salariesEarnedInMonth for each
// month in the period (same single source of truth used by the Monthly Report).
function salariesEarnedInPeriod(monthPred) {
  let t = 0;
  for (const mo of allDataMonths()) if (monthPred(mo)) t += salariesEarnedInMonth(mo);
  return t;
}
// Attribute an invoice's i.amount across its line items proportionally, so a
// per-sport / per-coach breakdown always re-sums to billedInMonth (no drift).
function invoiceLineShares(i) {
  const items = (i.lineItems && i.lineItems.length) ? i.lineItems
    : [{ sport: i.sport || null, coachId: i.coachId || null, price: i.amount || 0 }];
  const liSum = items.reduce((s, li) => s + (Number(li.price) || 0), 0);
  const amount = invoiceTotal(i);   // canonical total (Σ lines) — per-sport/coach shares re-sum to billedInMonth
  const factor = liSum > 0 ? amount / liSum : (items.length ? amount / items.length : 0);
  return items.map(li => ({
    sport: li.sport, coachId: li.coachId != null ? li.coachId : i.coachId,
    value: liSum > 0 ? (Number(li.price) || 0) * factor : factor,
  }));
}
function _pMonth(p) { return p.month || (p.date || '').slice(0, 7); }
// Cash received for this invoice in a specific month.
function cashInMonth(inv, monthKey) {
  if (!inv) return 0;
  if (Array.isArray(inv.payments) && inv.payments.length)
    return inv.payments.reduce((s, p) => s + (_pMonth(p) === monthKey ? (p.amount || 0) : 0), 0);
  return inv.month === monthKey ? invoicePaid(inv) : 0;   // legacy fallback
}
// Cash received within a month-range, given a predicate on the YYYY-MM string.
function cashInPeriod(inv, monthPred) {
  if (!inv) return 0;
  if (Array.isArray(inv.payments) && inv.payments.length)
    return inv.payments.reduce((s, p) => s + (monthPred(_pMonth(p)) ? (p.amount || 0) : 0), 0);
  return monthPred(inv.month) ? invoicePaid(inv) : 0;     // legacy fallback
}
// Total salary CASH actually paid out for a month ('all' = whole dataset).
// A 'paid' record stores snapshotNet (net handed over after deducting any
// advance); an 'advance' record stores amount. Summing advance.amount +
// paid.snapshotNet = the real money out (no double-count). Older/legacy records
// that used amount/paid are still handled by the fallback.
// A "Salary" expense category (any spelling: Salary / Salaries) means money paid
// to a coach — a settlement of the auto-calculated salary cost, NOT an extra P&L
// expense. So these are excluded from the expense total and counted as paid-so-far.
function isSalaryCategory(cat) {
  return String(cat || '').toLowerCase().startsWith('salar');
}

// An AD-HOC / external coach salary payment: a "Salary" expense with a free-text
// coach name and NO registered coach id. These coaches have no auto-calculated
// pay, so their payment IS their salary cost (it must be counted in the P&L),
// unlike a registered coach's payment which merely settles the auto-calc cost.
function isAdHocSalaryExpense(e) {
  return e && !e.deleted && isSalaryCategory(e.category) && !!String(e.coachName || '').trim() && !e.coachId;
}
function adHocSalariesInMonth(ym) {
  let total = 0;
  for (const e of (state.expenses || [])) {
    if (!isAdHocSalaryExpense(e)) continue;
    const m = e.month || String(e.date || '').slice(0, 7);
    if (ym !== 'all' && m !== ym) continue;
    total += Number(e.amount) || 0;
  }
  return total;
}

function salariesPaidInMonth(ym) {
  let total = 0;
  for (const s of (state.salaries || [])) {
    if (ym !== 'all' && (s.month || '') !== ym) continue;
    if (s.kind === 'advance') total += Number(s.amount || 0) || 0;
    else if (s.kind === 'paid') total += Number(s.snapshotNet != null ? s.snapshotNet : (s.amount != null ? s.amount : s.paid || 0)) || 0;
    else total += Number(s.amount != null ? s.amount : (s.paid || 0)) || 0;   // legacy
  }
  // Salary payments logged on the Expenses screen (category "Salary") also count
  // as money handed to coaches. These are settlements of the already-booked
  // salary cost, so they are EXCLUDED from the P&L expense total (see
  // isSalaryCategory usage) and surface here as "paid so far" instead.
  for (const e of (state.expenses || [])) {
    if (e.deleted) continue;
    if (!isSalaryCategory(e.category)) continue;
    const m = e.month || String(e.date || '').slice(0, 7);
    if (ym !== 'all' && m !== ym) continue;
    total += Number(e.amount) || 0;
  }
  return total;
}

// THE salary figure for reports: the auto-calculated salary COST for the month —
// every active coach's computed pay (fixed + commission). Admins change it by
// editing a coach's fixed salary / commission settings; the total recomputes.
// This is the single number shown across Dashboard, Monthly Report and the
// Financial Overview so the screens never disagree. (salariesPaidInMonth above
// is the separate "cash actually handed over so far" figure.)
function salariesEarnedInMonth(ym) {
  if (typeof computeMonthlyPay !== 'function') return 0;
  const months = ym === 'all'
    ? [...new Set((state.salaries || []).map(s => s.month).filter(Boolean))]
    : [ym];
  let total = 0;
  for (const c of (state.coaches || [])) {
    if (typeof isCoachActive === 'function' && !isCoachActive(c)) continue;
    for (const m of months) {
      const p = computeMonthlyPay(c.id, m);
      if (p) total += Number(p.gross || 0) || 0;
    }
  }
  // Ad-hoc / external coaches (free-text name on a Salary expense) have no
  // auto-calculated pay, so their payment IS the cost — add it to the total.
  total += adHocSalariesInMonth(ym);
  return total;
}

// Record a cash receipt against an invoice (defaults to today's month).
function recordInvoicePayment(inv, amount, opts) {
  if (!inv || !(amount > 0)) return;
  opts = opts || {};
  const date = opts.date || TODAY;
  const month = opts.month || date.slice(0, 7);
  if (!Array.isArray(inv.payments)) {
    const prior = inv.amountPaid != null ? inv.amountPaid : 0;   // seed ledger from any prior partial
    inv.payments = prior > 0 ? [{ date: inv.date || date, month: inv.month || month, amount: prior, method: inv.method || 'cash' }] : [];
  }
  inv.payments.push({ date, month, amount, method: opts.method || inv.method || 'cash', by: opts.by || currentUserId(), byName: opts.byName || currentUserName(), at: new Date().toISOString() });
  inv.amountPaid = inv.payments.reduce((s, p) => s + (p.amount || 0), 0);
  stampUpdate(inv);
}

// ── Qatar ID (residency permit) OCR parsing ────────────────────────
// Takes raw OCR text from a QID card photo and best-effort extracts the
// fields we can auto-fill. Heuristic + label-anchored; the admin always
// verifies. Returns {nameEn, nameAr, birthdate, qid, nationality} (nulls if
// not confidently found). The OCR image→text step happens in the browser
// (Tesseract.js); this function is pure so it can be unit-tested.
function _qidTitleCaseName(s) {
  return titleCaseName(s);
}
function _qidCleanArabic(s) {
  // keep Arabic letters, spaces and Arabic-Indic digits; drop the rest
  return String(s).replace(/[^\u0600-\u06FF\u0660-\u0669\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function parseQatarId(text) {
  const out = { nameEn: null, nameAr: null, birthdate: null, qid: null, nationality: null };
  if (!text) return out;
  const raw = String(text);
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // QID — an 11-digit number standalone (the 14-digit serial that contains it
  // is bounded by digits, so it won't match).
  const qidM = raw.match(/(?:^|\D)(\d{11})(?:\D|$)/);
  if (qidM) out.qid = qidM[1];

  const toISO = (d, m, y) => {
    d = +d; m = +m; y = +y;
    if (!(y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };
  const oneDate = (s) => { const m = s.match(/(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{4})/); return m ? toISO(m[1], m[2], m[3]) : null; };

  // Birthdate — prefer the date on the line labelled D.O.B / Birth / الميلاد,
  // so we don't grab the Expiry or Passport-Expiry dates.
  for (const ln of lines) {
    if (/d\.?\s*o\.?\s*b|birth|الميلاد/i.test(ln)) { const iso = oneDate(ln); if (iso) { out.birthdate = iso; break; } }
  }
  if (!out.birthdate) {   // fallback: earliest plausible past date in the card
    const all = []; const rx = /(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{4})/g; let mm;
    while ((mm = rx.exec(raw))) { const iso = toISO(mm[1], mm[2], mm[3]); if (iso) all.push(iso); }
    const past = all.filter(d => d <= TODAY).sort();
    if (past.length) out.birthdate = past[0];
  }

  // Nationality — Latin word(s) after the "Nationality" label.
  for (const ln of lines) {
    const m = ln.match(/nationality\s*[:\-]?\s*([A-Za-z][A-Za-z \-']{2,})/i);
    if (m) { out.nationality = _qidTitleCaseName(m[1]); break; }
  }

  // English name — uppercase Latin after a "Name:" label.
  for (const ln of lines) {
    const m = ln.match(/\bname\s*[:\-]\s*([A-Za-z][A-Za-z \-'.]{2,})/i);
    if (m) { const c = m[1].replace(/\s+/g, ' ').trim(); if (c.length >= 3) { out.nameEn = _qidTitleCaseName(c); break; } }
  }

  // Arabic name — after the الإسم / الاسم label, else the longest Arabic-only,
  // non-label line on the card.
  const AR_LABELS = ['دولة', 'قطر', 'رخصة', 'إقامة', 'اقامة', 'الجنسية', 'الميلاد', 'الصلاحية', 'المهنة', 'الرقم', 'جواز', 'السفر', 'المستقدم', 'الرخصة', 'عائلية', 'طفلة', 'توقيع', 'حامل'];
  for (const ln of lines) {
    const m = ln.match(/(?:الإسم|الاسم|الإسـم|الأسم)\s*[:：]?\s*(.+)/);
    if (m && /[\u0600-\u06FF]/.test(m[1])) { out.nameAr = _qidCleanArabic(m[1]); break; }
  }
  if (!out.nameAr) {
    let best = null;
    for (const ln of lines) {
      if (/[A-Za-z]/.test(ln)) continue;
      const arCount = (ln.match(/[\u0600-\u06FF]/g) || []).length;
      if (arCount >= 4 && !AR_LABELS.some(lbl => ln.includes(lbl))) { if (!best || arCount > best.c) best = { s: ln, c: arCount }; }
    }
    if (best) out.nameAr = _qidCleanArabic(best.s);
  }
  return out;
}

// What a coach was ACTUALLY credited (commission base) for a given sport for a
// member — summed from real Membership invoices, excluding switch credits and
// negatives. A sport-switch reconciliation is based on THIS (never the nominal
// enrollment price), so a switch can never claw back more than was credited.
function coachBaseForSport(member, sport, coachId) {
  let total = 0;
  for (const inv of (state.invoices || [])) {
    if (!member || inv.customerId !== member.id) continue;
    if ((inv.category || 'Membership') !== 'Membership') continue;
    if (inv.switchCredit || inv.activityType === 'switch-credit' || (inv.amount || 0) < 0) continue;
    if (Array.isArray(inv.lineItems) && inv.lineItems.length) {
      for (const li of inv.lineItems) {
        if (li.sport === sport && (coachId == null || li.coachId === coachId)) total += parseFloat(li.price) || 0;
      }
    } else if (inv.sport === sport && (coachId == null || inv.coachId === coachId)) {
      total += parseFloat(inv.amount) || 0;
    }
  }
  return Math.round(total * 100) / 100;
}

// Sport-switch reconciliation split. Coach A keeps commission on the classes the
// member actually attended; the unearned remainder transfers to coach B. The
// deduction from A is exactly (credited − attended value) and never exceeds the
// credited base.
function computeSwitchSplit(base, attendedA, totalClasses) {
  base = parseFloat(base) || 0;
  if (base <= 0) return { aShare: 0, bShare: 0, deductionA: 0 };
  let aShare;
  if (totalClasses > 0) aShare = Math.round((Math.max(0, attendedA) / totalClasses) * base * 100) / 100;
  else aShare = 0;                               // no planned classes → A earned nothing yet
  aShare = Math.min(aShare, base);
  const bShare = Math.round((base - aShare) * 100) / 100;   // unearned → transfers to B
  return { aShare, bShare, deductionA: -bShare };
}

// ─── Summer Camp schedule (Sun–Thu, 14 Jun – 27 Aug 2026) ───────────
const CAMP_GROUPS = [
  { key: 'kids',  label: 'Kids Stars (4-7)',   color: '#2e9e4f' },
  { key: 'boys',  label: 'Boys Stars (7-12)',  color: '#1565c0' },
  { key: 'girls', label: 'Girls Stars (7-12)', color: '#d81b60' },
];
const CAMP_SLOTS = [
  { time: '8:00 - 9:00',   type: 'activities' },
  { time: '9:00 - 9:30',   type: 'break', label: '🍳 Breakfast & Break', bg: 'rgba(245,200,80,.20)' },
  { time: '9:30 - 10:30',  type: 'activities' },
  { time: '10:30 - 11:30', type: 'activities' },
  { time: '11:30 - 12:00', type: 'break', label: '🕌 Prayer Break', bg: 'rgba(80,180,100,.18)' },
  { time: '12:00 - 1:00',  type: 'activities' },
  { time: '1:00 - 1:30',   type: 'break', label: '🎒 Dismissal', bg: 'rgba(150,150,160,.14)' },
];
const CAMP_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];
const CAMP_DAY_LABELS = { sunday: 'Sunday', monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday' };

function defaultCampSchedule() {
  const C = (a, coach) => ({ activity: a, coach: coach || '' });
  const COMBAT = 'Combat Sports (Kickboxing & Muay Thai)';
  return {
    startDate: '2026-06-14',
    endDate: '2026-06-28',
    days: {
      sunday: [
        { kids: C('Swimming'),               boys: C('Taekwondo'), girls: C('Swimming') },
        { kids: C('Karate'),                 boys: C(COMBAT),      girls: C('Art') },
        { kids: C('Ninja Training','Jennifer'), boys: C(COMBAT),   girls: C('Art') },
        { kids: C('Art'),                    boys: C('Karate'),    girls: C('Zumba','Jennifer') },
      ],
      monday: [
        { kids: C('Art'),                    boys: C('Swimming'),  girls: C('Kickboxing') },
        { kids: C('Kids Kickboxing'),        boys: C('Taekwondo'), girls: C('Gymnastics') },
        { kids: C('Karate'),                 boys: C(COMBAT),      girls: C('Zumba','Jennifer') },
        { kids: C('Ninja Training','Jennifer'), boys: C('Karate'), girls: C('Fitness','Aya') },
      ],
      tuesday: [
        { kids: C('Swimming'),               boys: C('Karate'),    girls: C('Swimming') },
        { kids: C('Art'),                    boys: C('Taekwondo'), girls: C('Kickboxing') },
        { kids: C('Art'),                    boys: C(COMBAT),      girls: C('Gymnastics') },
        { kids: C('Ninja Training'),         boys: C(COMBAT),      girls: C('Zumba','Jennifer') },
      ],
      wednesday: [
        { kids: C('Art'),                    boys: C('Swimming'),  girls: C('Kickboxing') },
        { kids: C('Karate'),                 boys: C('Taekwondo'), girls: C('Art') },
        { kids: C('Kids Kickboxing'),        boys: C(COMBAT),      girls: C('Gymnastics') },
        { kids: C('Ninja Training'),         boys: C('Karate'),    girls: C('Zumba','Jennifer') },
      ],
      thursday: [
        { kids: C('Karate'),                 boys: C(COMBAT),      girls: C('Swimming') },
        { kids: C('Kids Kickboxing'),        boys: C('Taekwondo'), girls: C('Kickboxing') },
        { kids: C('Art'),                    boys: C('Karate'),    girls: C('Gymnastics') },
        { kids: C('Ninja Training','Jennifer'), boys: C(COMBAT),   girls: C('Art') },
      ],
    },
  };
}

// True if a name has at least a first AND last name (2+ space-separated words).
function hasFirstAndLast(name) {
  return !!name && String(name).trim().split(/\s+/).filter(Boolean).length >= 2;
}

// ── Withdrawal refund (grace period + attendance) ──
// Member keeps the value of classes attended. The unused portion is refundable;
// within the grace window it's fully refundable, after it an admin fee applies.
//   perClass = price / totalClasses
//   used     = perClass × attended           (kept by club)
//   unused   = price − used
//   withinGrace = daysSinceStart ≤ graceDays  (true if start unknown)
//   fee      = withinGrace ? 0 : unused × feePct%
//   refund   = max(0, unused − fee)
function computeWithdrawRefund(o) {
  const price = parseFloat(o.price) || 0;
  const total = parseInt(o.totalClasses) || 0;
  let attended = parseInt(o.attended) || 0;
  if (total > 0) attended = Math.min(attended, total);
  const graceDays = (o.graceDays != null && o.graceDays !== '') ? (parseInt(o.graceDays) || 0) : 7;
  const feePct = (o.feePct != null && o.feePct !== '') ? (parseFloat(o.feePct) || 0) : 20;
  const perClass = total > 0 ? price / total : 0;
  const r2 = n => Math.round(n * 100) / 100;
  const used = r2(perClass * attended);
  const unused = Math.max(0, r2(price - used));
  let daysSinceStart = null, withinGrace = true;
  if (o.startDate && o.refundDate) {
    daysSinceStart = daysBetween(o.startDate, o.refundDate);
    withinGrace = daysSinceStart <= graceDays;
  }
  const fee = withinGrace ? 0 : r2(unused * (feePct / 100));
  const refund = Math.max(0, r2(unused - fee));
  return { price, total, attended, perClass: r2(perClass), used, unused, daysSinceStart, withinGrace, graceDays, feePct, fee, refund };
}

// ── Fuzzy text matching (used by the members name column filter) ──
function levenshtein(a, b) {
  a = String(a); b = String(b);
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}
// True if `query` matches `text` exactly, as a substring, or as a close
// (typo-tolerant) match against the whole string or any word in it.
function fuzzyMatch(text, query) {
  text = String(text || '').toLowerCase().trim();
  query = String(query || '').toLowerCase().trim();
  if (!query) return true;
  if (!text) return false;
  if (text.includes(query)) return true;
  // Short queries must match exactly / by prefix — a wide edit-distance on a
  // 3-4 letter query matches half the dictionary ("test" ≈ "best", "tens"…).
  // Longer queries keep typo tolerance (madani ≈ madanee).
  const thr = query.length <= 4 ? 0 : query.length <= 6 ? 2 : 3;
  if (thr && levenshtein(text, query) <= thr) return true;
  for (const w of text.split(/\s+/)) {
    if (!w) continue;
    if (w.startsWith(query)) return true;
    if (thr && levenshtein(w, query) <= thr) return true;
  }
  return false;
}

// ── Arabic localization (used by the schedule Arabic export / future i18n) ──
const SPORT_AR = {
  'Gymnastic': 'الجمباز',
  'Taekwondo': 'التايكوندو',
  'Kick Boxing': 'الكيك بوكسينغ',
  'Boxing': 'الملاكمة',
  'Football': 'كرة القدم',
  'MMA': 'الفنون القتالية',
  'Karate': 'الكاراتيه',
  'Swimming': 'السباحة',
  'Zumba': 'الزومبا',
  'Summer Camp': 'المعسكر الصيفي',
};
function sportNameAR(sport) { return SPORT_AR[sport] || sport; }

const DAY_AR = {
  sat: 'السبت', sun: 'الأحد', mon: 'الإثنين', tue: 'الثلاثاء', wed: 'الأربعاء', thu: 'الخميس', fri: 'الجمعة',
  saturday: 'السبت', sunday: 'الأحد', monday: 'الإثنين', tuesday: 'الثلاثاء', wednesday: 'الأربعاء', thursday: 'الخميس', friday: 'الجمعة',
};
function dayNameAR(key) { return DAY_AR[String(key || '').toLowerCase()] || key; }

const MONTH_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
function monthNameAR(date) { const d = date instanceof Date ? date : new Date(date); return MONTH_AR[d.getMonth()] + ' ' + d.getFullYear(); }

// "3PM - 4PM" → "3 - 4 م"  (م = PM, ص = AM). Keeps western digits.
function timeLabelAR(label) {
  const m = String(label || '').match(/(\d+)\s*(AM|PM)\s*-\s*(\d+)\s*(AM|PM)/i);
  if (!m) return label;
  const suf = ap => (/pm/i.test(ap) ? 'م' : 'ص');
  return suf(m[2]) === suf(m[4])
    ? `${m[1]} - ${m[3]} ${suf(m[4])}`
    : `${m[1]} ${suf(m[2])} - ${m[3]} ${suf(m[4])}`;
}

// Emoji for a camp activity name (best-effort match).
function campActivityIcon(activity) {
  const a = String(activity || '').toLowerCase();
  if (!a) return '';
  if (a.includes('swim')) return '🏊';
  if (a.includes('taekwondo')) return '🦵';
  if (a.includes('karate')) return '🥋';
  if (a.includes('kick') || a.includes('box') || a.includes('combat')) return '🥊';
  if (a.includes('gymnast')) return '🤸';
  if (a.includes('art')) return '🎨';
  if (a.includes('zumba') || a.includes('dance')) return '💃';
  if (a.includes('ninja')) return '🥷';
  if (a.includes('football') || a.includes('soccer')) return '⚽';
  if (a.includes('fitness') || a.includes('gym ')) return '💪';
  if (a.includes('mma')) return '🥋';
  if (a.includes('yoga')) return '🧘';
  return '⭐';
}

// Map a YYYY-MM-DD date to its camp day key (sunday..thursday), or null on an
// off day (Fri/Sat). Parsed in local time to avoid UTC weekday drift.
function campDayKeyForDate(dateStr) {
  if (!dateStr) return null;
  const p = String(dateStr).split('-').map(Number);
  if (p.length < 3 || !p[0]) return null;
  const wd = new Date(p[0], p[1] - 1, p[2]).getDay();   // 0=Sun..6=Sat
  return CAMP_DAYS[wd] || null;                          // 5/6 → undefined → null
}

// Proper-case a person's name: "anas madni" → "Anas Madni", "al-awad" → "Al-Awad".
function titleCaseName(s) {
  if (s == null) return s;
  return String(s).replace(/\s+/g, ' ').trim().toLowerCase()
    .replace(/(^|[\s\-'’])([a-z\u00e0-\u024f])/g, (m, sep, ch) => sep + ch.toUpperCase());
}

// ── Family / household helpers ──────────────────────────────────────────────
// A household groups several members (e.g. siblings + parent) under one shared
// contact. m.familyId references state.families[].id.
function familyMembers(famId, includeArchived) {
  return (state.members || []).filter(m => m.familyId === famId && (includeArchived || !m.deleted));
}
function getFamily(famId) { return (state.families || []).find(f => f.id === famId) || null; }
function familyName(famId) {
  const f = getFamily(famId);
  if (f && f.name) return f.name;
  const ms = familyMembers(famId);
  return ms.length ? (ms[0].name || '').split(' ').slice(-1)[0] + ' family' : 'Family';
}
function familyContactPhone(famId) {
  const f = getFamily(famId);
  if (f && f.phone) return f.phone;
  const m = familyMembers(famId).find(x => isRealPhone(x.phone));
  return m ? m.phone : '';
}
function familyOutstanding(famId) {
  return familyMembers(famId, true).reduce((s, m) => s + memberOutstanding(m.id), 0);
}

// Total outstanding balance for a member across their membership invoices.
function memberOutstanding(memberId) {
  return (state.invoices || [])
    .filter(i => !i.deleted && i.customerId === memberId && (i.category || 'Membership') === 'Membership')
    .reduce((s, i) => s + invoiceBalance(i), 0);
}

// Total amount this member has PAID across all their (non-deleted) invoices —
// every category, cash-basis. Used for the family financial summary.
function memberPaidTotal(memberId) {
  return (state.invoices || [])
    .filter(i => i.customerId === memberId && !i.deleted)
    .reduce((s, i) => s + invoicePaid(i), 0);
}
function familyPaidTotal(famId) {
  return familyMembers(famId, true).reduce((s, m) => s + memberPaidTotal(m.id), 0);
}

// Split ONE family payment equally across a set of sibling members. `members` is
// the list of sibling member objects; `familyTotal` is the single amount the
// parent paid for the whole group. Each sibling's membership invoice is set to
// (familyTotal / N) as both amount and paid, with a "Family share (1/N)" note.
// Members with no membership invoice get one created. Returns the per-head share.
function splitSiblingPayment(members, familyTotal) {
  const sibs = (members || []).filter(m => m && !m.deleted);   // active siblings only
  const n = sibs.length;
  if (n === 0 || !(familyTotal > 0)) return 0;
  // Round to 2dp; put any rounding remainder on the first sibling so the parts
  // sum exactly to the family total.
  const share = Math.floor((familyTotal / n) * 100) / 100;
  const remainder = Math.round((familyTotal - share * n) * 100) / 100;
  sibs.forEach((m, idx) => {
    const myShare = idx === 0 ? Math.round((share + remainder) * 100) / 100 : share;
    let inv = (state.invoices || []).find(iv => !iv.deleted && iv.customerId === m.id
      && (iv.category || 'Membership') === 'Membership' && !iv.switchCredit && (iv.amount || 0) >= 0);
    const note = `Family share (1/${n})`;
    if (inv) {
      inv.amount = myShare;
      inv.amountPaid = myShare;
      inv.payments = [{ date: (inv.payments && inv.payments[0] && inv.payments[0].date) || inv.date || TODAY,
        month: (inv.payments && inv.payments[0] && inv.payments[0].month) || inv.month || (TODAY).slice(0, 7),
        amount: myShare, method: (inv.method || 'cash') }];
      inv.familyShare = { of: n, total: familyTotal };
      if (inv.description && !/Family share/.test(inv.description)) inv.description += ` — ${note}`;
    } else {
      const enr = Array.isArray(m.enrollments) ? m.enrollments.filter(e => e && e.sport) : [];
      const label = (typeof sportListWithDuration === 'function' && sportListWithDuration(enr)) || enr.map(e => e.sport).join(', ') || 'Membership';
      state.invoices.push({
        id: nextId(state.invoices), date: TODAY, month: (TODAY).slice(0, 7),
        ref: nextInvoiceRef(), category: 'Membership', activityType: 'subscription',
        customerId: m.id, customerName: m.name, customerPhone: m.phone,
        sport: label, coach: enr[0] ? coachName(enr[0].coachId) : '', coachId: enr[0] ? enr[0].coachId : null,
        amount: myShare, amountPaid: myShare,
        payments: [{ date: TODAY, month: (TODAY).slice(0, 7), amount: myShare, method: 'cash' }],
        method: 'cash', familyShare: { of: n, total: familyTotal },
        description: `${m.name} — ${label} subscription — ${note}`,
        lineItems: enr.map(e => ({ sport: e.sport, coach: coachName(e.coachId), coachId: e.coachId, classes: e.classes, price: e.price })),
      });
    }
  });
  return share;
}

// Returns the first sport enrolled more than once (a member may hold only one
// active enrollment per sport), or null. Used to block duplicate enrollments.
function duplicateEnrollmentSport(enrollments) {
  const seen = new Set();
  for (const e of (enrollments || [])) {
    if (!e || !e.sport) continue;
    if (seen.has(e.sport)) return e.sport;
    seen.add(e.sport);
  }
  return null;
}

// A sport added later can carry its own start date; otherwise it inherits the
// member's start date (then today as a last resort).
function enrollmentStartDate(enrollment, member) {
  return (enrollment && enrollment.start) || (member && member.startDate) || TODAY;
}

// Apply edited enrollment values onto its existing subscription, and keep the
// linked invoice line's coach in sync so commission re-attributes correctly.
// Matching is by SPORT only (a member holds one active enrollment per sport),
// so changing the coach must UPDATE this subscription — never create a duplicate.
// Build a sport-list label that includes a duration suffix for Summer Camp
// (e.g. "Summer Camp · 1 month" instead of just "Summer Camp"). For multi-sport
// invoices, joins with ", ". Pure helper, used in invoice descriptions / sport
// fields so receipts and reports read clearly. Accepts either an array of
// enrolment objects ({sport, durationLabel, classes}) or invoice lineItems
// ({sport, durationLabel, classes}). Falls back to the sport name only when no
// label is available.
function sportListWithDuration(items) {
  if (!Array.isArray(items)) return '';
  return items.map(it => {
    if (!it || !it.sport) return '';
    if (it.sport !== SUMMER_CAMP) return it.sport;
    const label = it.durationLabel || (typeof DEFAULT_SUMMER_CAMP_PRICES !== 'undefined'
      ? (campLabelForClasses(it.classes) || '')
      : '');
    return label ? `${SUMMER_CAMP} · ${label}` : SUMMER_CAMP;
  }).filter(Boolean).join(', ');
}

function syncSubToEnrollment(sub, e, member, invoices) {
  if (!sub || !e) return;
  if (e.classes != null) sub.totalClasses = e.classes;
  if (e.durationLabel != null) sub.durationLabel = e.durationLabel;
  if (sub.coachId !== e.coachId) {
    const oldCoach = sub.coachId;
    sub.coachId = e.coachId;
    sub.coach = coachName(e.coachId);
    const inv = (invoices || []).find(iv => iv.ref === sub.invoiceNumber);
    if (inv) {
      (inv.lineItems || []).forEach(li => { if (li.sport === e.sport) { li.coachId = e.coachId; li.coach = coachName(e.coachId); } });
      if (inv.coachId === oldCoach) { inv.coachId = e.coachId; inv.coach = coachName(e.coachId); }
    }
  }
  // Price change on a paid enrollment → reconcile the linked invoice so REVENUE and
  // coach COMMISSION follow the new price (not just the subscription's amountPaid).
  if (e.price != null && invoices && sub.invoiceNumber) {
    const inv = invoices.find(iv => iv.ref === sub.invoiceNumber);
    if (inv && (inv.category || 'Membership') === 'Membership' && !inv.switchCredit && inv.activityType !== 'switch-credit') {
      const hasLines = Array.isArray(inv.lineItems) && inv.lineItems.length;
      const line = hasLines ? inv.lineItems.find(li => li.sport === e.sport) : null;
      const oldPrice = hasLines ? (line ? (parseFloat(line.price) || 0) : null) : (parseFloat(inv.amount) || 0);
      const newPrice = parseFloat(e.price) || 0;
      // Keep the line's duration / classes fresh too — even when the price did NOT change,
      // changing a Summer Camp duration (e.g. 1 week → 1 month at the same price) should
      // still update the invoice description + lineItem labels.
      if (hasLines && line) {
        if (e.classes != null) line.classes = e.classes;
        if (e.durationLabel != null) line.durationLabel = e.durationLabel;
        if (e.coachId != null) { line.coachId = e.coachId; line.coach = coachName(e.coachId); }
      }
      if (oldPrice != null && Math.abs(oldPrice - newPrice) > 0.001) {
        const wasPaidInFull = invoiceBalance(inv) <= 0.01;
        // An UPGRADE (price went UP — e.g. Summer Camp 1 day → 1 month) means the member
        // is buying MORE; the extra is NOT paid yet. Only a price CORRECTION or a
        // downgrade on a fully-paid invoice should stay "paid in full". So we keep the
        // paid amount as-is on an increase, letting the difference show as a NEW balance
        // due — instead of silently pretending the higher amount was already paid.
        const isUpgrade = newPrice > oldPrice + 0.001;
        if (hasLines && line) { line.price = newPrice; inv.amount = inv.lineItems.reduce((s, li) => s + (parseFloat(li.price) || 0), 0); }
        else { inv.amount = newPrice; }
        if (wasPaidInFull && !isUpgrade) {
          // Price correction / downgrade on a paid invoice → keep it paid in full.
          inv.amountPaid = inv.amount;
          if (Array.isArray(inv.payments) && inv.payments.length) {
            const others = inv.payments.slice(0, -1).reduce((s, p) => s + (p.amount || 0), 0);
            inv.payments[inv.payments.length - 1].amount = Math.max(0, Math.round((inv.amount - others) * 100) / 100);
          } else {
            inv.payments = [{ date: inv.date, month: inv.month, amount: inv.amount, method: inv.method || 'cash' }];
          }
        }
        // else (an UPGRADE, or an already-partial invoice): leave payments alone, so the
        // amount the member hasn't paid yet correctly appears as a balance due.
        if (isUpgrade) inv._upgradeDue = { sport: e.sport, from: oldPrice, to: newPrice, paid: invoicePaid(inv) };
        stampUpdate(inv);
        if (typeof audit === 'function') audit('invoice.price_edit', `invoice:${inv.id}`,
          `Adjusted ${e.sport} price ${fmt(oldPrice)} → ${fmt(newPrice)}${member ? ' for ' + member.name : ''}`,
          { invoiceId: inv.id, recordName: member ? member.name : (inv.customerName || ''), sport: e.sport, old: oldPrice, new: newPrice, wasPaidInFull });
      }
      // After any edit, refresh the description + header sport so receipts read
      // clearly (e.g. "Summer Camp · 1 month" instead of stale "Summer Camp · 1 week").
      if (hasLines) {
        const label = sportListWithDuration(inv.lineItems);
        if (label) {
          inv.sport = label;
          if (member && member.name) inv.description = `${member.name} — ${label} subscription`;
          else inv.description = `${label} subscription`;
        }
      }
    }
  }
  if (e.price != null) sub.amountPaid = e.price;
  const eStart = enrollmentStartDate(e, member);
  // Camp: the time window is the VALIDITY (calendar days, e.g. 1 month), independent
  // of the class-day count (e.classes). Using e.classes here was the bug that reverted
  // an edited validity back to the day-count on save.
  const eValidity = e.sport === SUMMER_CAMP
    ? (parseInt(e.validity) || parseInt(e.classes) || DEFAULT_VALIDITY)
    : (parseInt(e.validity) || DEFAULT_VALIDITY);
  if (eStart) { sub.start = eStart; sub.validity = eValidity; sub.end = addDays(eStart, eValidity); }
}

// Derive member-level dates from the per-sport enrollment cards (each sport has
// its own start + validity). Member start = earliest sport start; member expiry
// = latest sport end (start + validity); first registration = entered value, or
// the earliest sport start when left blank.
function deriveMemberDates(enrollments, firstRegInput) {
  const list = enrollments || [];
  const starts = list.map(e => e.start || TODAY).sort();
  const minStart = starts[0] || TODAY;
  const ends = list.map(e => addDays(e.start || minStart, e.validity || DEFAULT_VALIDITY)).filter(Boolean).sort();
  return {
    startDate: minStart,
    firstRegistration: firstRegInput || minStart,
    expiryDate: ends.length ? ends[ends.length - 1] : null,
  };
}

// Cleanly remove an enrollment added by mistake: drops the enrollment row, its
// subscription, and its invoice line(s) — NO refund record (that's Withdraw).
// Combined invoices keep their other sports (amount reduced); single-sport
// invoices for this sport are deleted. Member expiry is recomputed.
function removeEnrollmentData(member, sport) {
  if (!member || !sport) return;
  member.enrollments = (member.enrollments || []).filter(e => e.sport !== sport);
  member.subscriptions = (member.subscriptions || []).filter(s => s.activity !== sport);
  const kept = [];
  for (const inv of state.invoices) {
    if (inv.customerId !== member.id || (inv.category || 'Membership') !== 'Membership') { kept.push(inv); continue; }
    if (Array.isArray(inv.lineItems) && inv.lineItems.length) {
      const before = inv.lineItems.length;
      inv.lineItems = inv.lineItems.filter(li => li.sport !== sport);
      if (inv.lineItems.length === 0) continue;                 // whole invoice was just this sport → drop
      if (inv.lineItems.length !== before) {                    // had other sports → keep, reduce amount
        inv.amount = inv.lineItems.reduce((s, li) => s + (parseFloat(li.price) || 0), 0);
        inv.sport = inv.lineItems.map(li => li.sport).join(', ');
      }
      kept.push(inv);
    } else {
      if ((inv.sport || '') === sport) continue;                // single-sport invoice for this sport → drop
      kept.push(inv);
    }
  }
  state.invoices = kept;
  const ends = (member.subscriptions || []).map(s => s.end).filter(Boolean).sort();
  if (ends.length) member.expiryDate = ends[ends.length - 1];
}

// Pre-save guard: returns an existing Membership invoice that matches a new one
// (same member, sport, month, amount) so callers can warn before creating a copy.
function findDuplicateInvoiceOf(customerId, sport, month, amount, excludeId) {
  if (!customerId) return null;
  return state.invoices.find(inv =>
    inv.id !== excludeId &&
    (inv.category || 'Membership') === 'Membership' &&
    !inv.switchCredit && inv.activityType !== 'switch-credit' &&
    inv.customerId === customerId &&
    (inv.sport || '') === (sport || '') &&
    (inv.month || '') === (month || '') &&
    Math.abs((parseFloat(inv.amount) || 0) - (parseFloat(amount) || 0)) < 0.01
  ) || null;
}

// Returns duplicate-invoice groups across ALL categories, in two tiers:
//   tier 'exact'    — same customer, category, sport/items, month AND amount
//   tier 'possible' — same customer, category, items and amount, dated within
//                     7 days of each other (catches same-purchase duplicates that
//                     straddle a month boundary, or near-identical re-entries)
// Skips deleted, switch-credit, and negative (refund/credit) invoices.
function detectDuplicateInvoices() {
  const usable = state.invoices.filter(inv =>
    !inv.deleted &&
    !inv.switchCredit && inv.activityType !== 'switch-credit' &&
    (inv.amount || 0) > 0
  );
  const info = (inv) => {
    const mem = inv.customerId ? state.members.find(x => x.id === inv.customerId) : null;
    const memName = mem ? mem.name : (inv.customerName || inv.customer || '— walk-in —');
    const cat = inv.category || 'Membership';
    const items = (Array.isArray(inv.lineItems) && inv.lineItems.length)
      ? inv.lineItems.map(l => l.sport || l.name || l.product).filter(Boolean).sort().join('+')
      : (inv.sport || inv.description || '—');
    return { memName, cat, items };
  };
  // Rentals (Court Rental / Boxing Room) are inherently REPEATABLE — the same
  // customer books the same facility many times. So a rental is only a true
  // duplicate when it's on the exact SAME DATE (a double-entry), never just the
  // same month, and it's excluded from the "within 7 days" possible tier.
  const isRental = (inv) => inv.activityType === 'rental' || inv.category === 'Court Rental' || inv.category === 'Boxing Room';
  // Summer Camp is also REPEATABLE: a member can buy several camp packages in one
  // month (e.g. a 1-week camp, then renew for another week). Different DATES are
  // legitimate renewals, NOT duplicates — so, like rentals, a camp invoice is only
  // a true duplicate when it falls on the exact SAME DATE (a genuine double-entry).
  const isCampInv = (inv) => {
    if ((inv.activity || inv.sport) === SUMMER_CAMP) return true;
    const items = (Array.isArray(inv.lineItems) && inv.lineItems.length)
      ? inv.lineItems.map(l => l.sport || l.name).filter(Boolean) : [];
    return items.includes(SUMMER_CAMP);
  };
  // Invoices that may legitimately repeat within a month → key on exact date.
  const isRepeatable = (inv) => isRental(inv) || isCampInv(inv);

  // Tier 1 — EXACT
  const exactGroups = {};
  for (const inv of usable) {
    const { memName, cat, items } = info(inv);
    // For repeatable invoices (rentals + Summer Camp), key by the full DATE (only a
    // same-day double entry is a real duplicate); for everything else, key by month
    // (a repeat membership/product in one month is suspect).
    const period = isRepeatable(inv) ? (inv.date || '') : (inv.month || (inv.date || '').slice(0, 7));
    const key = (inv.customerId || memName) + '|' + cat + '|' + items + '|' + period + '|' + (inv.amount || 0);
    (exactGroups[key] = exactGroups[key] || []).push({ inv, memName, sport: items, cat });
  }
  const exact = Object.values(exactGroups).filter(g => g.length > 1).map(g => ({ tier: 'exact', rows: g }));

  // Tier 2 — POSSIBLE (same customer+cat+items+amount, ≤7 days apart, not already
  // exact). Rentals AND camp are skipped here — repeat purchases days apart are normal.
  const exactInvIds = new Set(exact.flatMap(g => g.rows.map(r => r.inv.id)));
  const bySig = {};
  for (const inv of usable) {
    if (isRepeatable(inv)) continue;
    const { memName, cat, items } = info(inv);
    const sig = (inv.customerId || memName) + '|' + cat + '|' + items + '|' + (inv.amount || 0);
    (bySig[sig] = bySig[sig] || []).push({ inv, memName, sport: items, cat });
  }
  const possible = [];
  for (const rows of Object.values(bySig)) {
    if (rows.length < 2) continue;
    const sorted = rows.slice().sort((a, b) => (a.inv.date || '').localeCompare(b.inv.date || ''));
    let cluster = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date((cluster[cluster.length - 1].inv.date || '1970-01-01') + 'T00:00:00');
      const cur = new Date((sorted[i].inv.date || '1970-01-01') + 'T00:00:00');
      const days = Math.abs((cur - prev) / 86400000);
      if (days <= 7) cluster.push(sorted[i]);
      else { if (cluster.length > 1) possible.push(cluster); cluster = [sorted[i]]; }
    }
    if (cluster.length > 1) possible.push(cluster);
  }
  const possibleGroups = possible
    .filter(c => !c.every(r => exactInvIds.has(r.inv.id)))   // drop clusters already fully captured as exact
    .map(rows => ({ tier: 'possible', rows }));

  return [...exact, ...possibleGroups];
}

// ─── Batch C cleanup detectors ──────────────────────────────────────────────
// Members whose enrollments[] list the SAME sport more than once (usually a
// legacy-import artifact). Returns [{ member, sport, rows:[enrollment,...] }].
function findDuplicateEnrollments() {
  const out = [];
  for (const m of (state.members || [])) {
    if (m.deleted || !Array.isArray(m.enrollments) || m.enrollments.length < 2) continue;
    const bySport = {};
    m.enrollments.forEach((e, i) => {
      if (!e || !e.sport) return;
      (bySport[e.sport] = bySport[e.sport] || []).push({ e, i });
    });
    for (const [sport, rows] of Object.entries(bySport)) {
      if (rows.length > 1) out.push({ member: m, sport, rows: rows.map(r => r.e), count: rows.length });
    }
  }
  return out;
}

// Members holding more than one non-deleted Membership invoice — candidates for
// consolidation into a single invoice (the v6.55 rule, applied to legacy data).
// Returns [{ member, invoices:[...], total, paid }].
// Membership invoices whose DATE is meaningfully later than the member's earliest
// sport start — usually old members registered after the fact, so the invoice (and
// its revenue month) landed on the entry day instead of the real start. Returns
// [{ member, inv, invDate, startDate, gapDays }] sorted by biggest gap first.
// Products that share the same NAME (case-insensitive) — duplicate catalog
// records that split stock and sales reporting. Returns
// [{ name, products:[...], totalStock, count }] for groups with 2+ records.
// ─── Personal Notes & Reminders ─────────────────────────────────────────────
// state.notes[] = { id, title, body, priority('high'|'medium'|'low'),
//   remindDate(YYYY-MM-DD|null), done(bool), follow(bool), createdAt, updatedAt }
const NOTE_PRIORITIES = ['high', 'medium', 'low'];
function allNotes() { return state.notes || (state.notes = []); }
// A note "needs attention" (drives the sidebar badge) if it's not done AND is
// either flagged to follow up, or has a reminder date that's today/overdue.
function noteNeedsAttention(n) {
  if (!n || n.done) return false;
  if (n.follow) return true;
  if (n.remindDate && n.remindDate <= TODAY) return true;
  return false;
}
function dueNotesCount() { return allNotes().filter(noteNeedsAttention).length; }

// Build and toggle the notifications dropdown panel under the bell.
function toggleNotifPanel(wrap) {
  const existing = wrap.querySelector('.notif-panel');
  if (existing) { existing.remove(); document.removeEventListener('click', _notifOutside, true); return; }
  const items = buildNotifications();
  const panel = el('div', { className: 'notif-panel' });
  const toneColor = (tone) => tone === 'urgent' ? 'var(--red)' : tone === 'warn' ? 'var(--accent-2)' : 'var(--blue)';
  const header = `<div class="notif-head">${t('Notifications', 'الإشعارات')}${items.length ? ` <span class="notif-head-count">${items.length}</span>` : ''}</div>`;
  const body = items.length
    ? items.map((n, i) => `<button type="button" class="notif-item" data-route="${n.route || ''}" data-i="${i}">
        <span class="notif-ico" style="background:${toneColor(n.tone)}22;color:${toneColor(n.tone)}">${n.icon}</span>
        <span class="notif-txt"><span class="notif-title">${escapeHtml(n.title)}</span><span class="notif-body">${escapeHtml(n.body)}</span></span>
      </button>`).join('')
    : `<div class="notif-empty">🎉 ${t('You\\u2019re all caught up', 'لا توجد إشعارات جديدة')}</div>`;
  panel.innerHTML = header + `<div class="notif-list">${body}</div>`;
  wrap.append(panel);
  panel.querySelectorAll('.notif-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const route = btn.getAttribute('data-route');
      panel.remove(); document.removeEventListener('click', _notifOutside, true);
      if (route && typeof navigate === 'function') navigate(route);
    });
  });
  setTimeout(() => document.addEventListener('click', _notifOutside, true), 0);
}
function _notifOutside(e) {
  const wrap = document.querySelector('.notif-wrap');
  if (wrap && !wrap.contains(e.target)) {
    const p = wrap.querySelector('.notif-panel');
    if (p) p.remove();
    document.removeEventListener('click', _notifOutside, true);
  }
}

// ─── Notifications (Facebook-style bell) ────────────────────────────────────
// Role-aware notification list. Each item: { icon, title, body, tone, route? }.
// tone: 'info' | 'warn' | 'urgent'. Computed live from current data.
const SCHED_DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];   // JS getDay() 0..6
function _todayDayKey(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return SCHED_DAY_KEYS[d.getDay()];
}
function _memberSports(m) {
  const set = new Set();
  (m.enrollments || []).forEach(e => e.sport && set.add(e.sport));
  (m.subscriptions || []).forEach(s => s.activity && s.status !== 'Withdrawn' && set.add(s.activity));
  if (m.sport) set.add(m.sport);
  return [...set];
}
// Next scheduled class for a set of sports (and optionally a coach), today first
// then tomorrow. Returns { whenLabel, slot, sport, coachId } or null.
function _nextClassFor(sports, coachId) {
  const sched = state.schedule || [];
  for (const [offset, label] of [[0, 'today'], [1, 'tomorrow']]) {
    const dayKey = _todayDayKey(offset);
    const matches = sched.filter(c => c.day === dayKey
      && (!sports || sports.includes(c.sport))
      && (coachId == null || c.coachId === coachId));
    if (matches.length) {
      // Earliest slot wins (slots sort lexically well enough with hour prefixes,
      // but fall back to array order).
      const first = matches[0];
      return { whenLabel: label, slot: first.slot, sport: first.sport, coachId: first.coachId };
    }
  }
  return null;
}

function buildNotifications() {
  const role = (typeof currentRole === 'function') ? currentRole() : 'admin';
  const out = [];
  const LOW_CLASSES = 2;            // "running low" threshold
  const EXPIRE_SOON_DAYS = 7;

  if (role === 'student') {
    const id = effectiveMemberId();
    const m = id != null ? state.members.find(x => x.id === id) : null;
    if (m) {
      const sports = _memberSports(m);
      const nc = _nextClassFor(sports, null);
      if (nc) out.push({ icon: '📅', tone: 'info', title: t('Next class', 'الحصة القادمة'),
        body: `${escapeHtml(nc.sport)} · ${escapeHtml(nc.slot)} · ${nc.whenLabel === 'today' ? t('today', 'اليوم') : t('tomorrow', 'غداً')}`, route: 'mymembership' });
      const dexp = m.expiryDate ? daysUntil(m.expiryDate) : null;
      if (memberStatus(m) !== 'Frozen' && dexp != null && dexp >= 0 && dexp <= EXPIRE_SOON_DAYS) out.push({ icon: '⏳', tone: dexp <= 2 ? 'urgent' : 'warn',
        title: t('Membership expiring soon', 'الاشتراك ينتهي قريباً'),
        body: `${t('Expires', 'ينتهي')} ${fmtDate(m.expiryDate)} · ${dexp} ${t('days left', 'يوم متبقٍ')}`, route: 'mymembership' });
      // Low remaining classes per active subscription
      for (const s of (m.subscriptions || [])) {
        if (s.status === 'Withdrawn') continue;
        const remaining = (parseInt(s.totalClasses) || 0) - (parseInt(s.attendedClasses) || 0);
        if (remaining > 0 && remaining <= LOW_CLASSES) out.push({ icon: '🎯', tone: 'warn',
          title: t('Classes running low', 'الحصص قاربت على الانتهاء'),
          body: `${escapeHtml(s.activity)} · ${remaining} ${t('classes left — finish them before expiry', 'حصص متبقية — أنهِها قبل الانتهاء')}`, route: 'mymembership' });
      }
      const due = memberOutstanding(m.id);
      if (due > 0.5) out.push({ icon: '💳', tone: 'warn', title: t('Unpaid balance', 'رصيد غير مدفوع'),
        body: `${fmt(due)} QAR ${t('still due', 'مستحقة')}`, route: 'mymembership' });
      const unreadP = (typeof unreadPostsForUser === 'function') ? unreadPostsForUser('member', m.id) : [];
      if (unreadP.length) out.push({ icon: '📢', tone: 'info', title: t('New advice / article', 'نصيحة / مقال جديد'),
        body: `${unreadP.length} ${t('new message(s) from your coach or the club', 'رسالة جديدة من مدربك أو النادي')}`, route: 'posts' });
    }
  } else if (role === 'coach') {
    const cid = effectiveCoachId();
    const unreadPC = (cid != null && typeof unreadPostsForUser === 'function') ? unreadPostsForUser('coach', cid) : [];
    if (unreadPC.length) out.push({ icon: '📢', tone: 'info', title: t('New advice / article', 'نصيحة / مقال جديد'),
      body: `${unreadPC.length} ${t('new message(s) from the club', 'رسالة جديدة من النادي')}`, route: 'posts' });
    const nc = _nextClassFor(null, cid);
    if (nc) out.push({ icon: '📅', tone: 'info', title: t('Your next class', 'حصتك القادمة'),
      body: `${escapeHtml(nc.sport)} · ${escapeHtml(nc.slot)} · ${nc.whenLabel === 'today' ? t('today', 'اليوم') : t('tomorrow', 'غداً')}`, route: 'coachhome' });
    // Students of this coach: expiring soon + low classes + recently assigned
    const myStudents = (state.members || []).filter(m => !m.deleted
      && ((m.enrollments || []).some(e => e.coachId === cid) || (m.subscriptions || []).some(s => s.coachId === cid && s.status !== 'Withdrawn')));
    const expiring = myStudents.filter(m => { const st = memberStatus(m); if (st === 'Frozen' || st === 'Withdrawn') return false; const d = m.expiryDate ? daysUntil(m.expiryDate) : null; return d != null && d >= 0 && d <= EXPIRE_SOON_DAYS; });
    if (expiring.length) out.push({ icon: '⏳', tone: 'warn', title: t('Students expiring soon', 'طلاب اشتراكهم ينتهي قريباً'),
      body: `${expiring.length} ${t('of your students expire within a week — nudge them to renew', 'من طلابك ينتهي اشتراكهم خلال أسبوع — ذكّرهم بالتجديد')}`, route: 'coachhome' });
    let lowCount = 0;
    for (const m of myStudents) for (const s of (m.subscriptions || [])) {
      if (s.coachId !== cid || s.status === 'Withdrawn') continue;
      const remaining = (parseInt(s.totalClasses) || 0) - (parseInt(s.attendedClasses) || 0);
      if (remaining > 0 && remaining <= LOW_CLASSES) { lowCount++; break; }
    }
    if (lowCount) out.push({ icon: '🎯', tone: 'info', title: t('Students with few classes left', 'طلاب لديهم حصص قليلة'),
      body: `${lowCount} ${t('students have classes running low', 'طلاب حصصهم قاربت على الانتهاء')}`, route: 'coachhome' });
    const newly = myStudents.filter(m => { const d = m.firstRegistration ? daysUntil(m.firstRegistration) : null; return d != null && d <= 0 && d >= -7; });
    if (newly.length) out.push({ icon: '🆕', tone: 'info', title: t('New students assigned', 'طلاب جدد'),
      body: `${newly.length} ${t('new students joined your classes this week', 'طلاب جدد انضموا لحصصك هذا الأسبوع')}`, route: 'coachhome' });
  } else {
    // Admin / staff: actionable summaries
    const dn = dueNotesCount();
    if (dn) out.push({ icon: '📝', tone: 'warn', title: t('Notes need attention', 'ملاحظات تحتاج انتباه'),
      body: `${dn} ${t('reminders due or flagged to follow up', 'تذكير مستحق أو معلّم للمتابعة')}`, route: 'notes' });
    const campSoon = (typeof campExpiringSoonCount === 'function') ? campExpiringSoonCount() : 0;
    if (campSoon) out.push({ icon: '☀️', tone: 'warn', title: t('Camp members expiring', 'أعضاء معسكر ينتهون'),
      body: `${campSoon} ${t('camp members expire within a week', 'أعضاء معسكر ينتهي اشتراكهم خلال أسبوع')}`, route: 'campmembers' });
    const expSoon = (state.members || []).filter(m => { if (m.deleted || m.sport === SUMMER_CAMP) return false; const st = memberStatus(m); if (st === 'Frozen' || st === 'Withdrawn') return false; const d = m.expiryDate ? daysUntil(m.expiryDate) : null; return d != null && d >= 0 && d <= EXPIRE_SOON_DAYS; }).length;
    if (expSoon) out.push({ icon: '⏳', tone: 'info', title: t('Memberships expiring soon', 'اشتراكات تنتهي قريباً'),
      body: `${expSoon} ${t('members expire within a week', 'أعضاء ينتهي اشتراكهم خلال أسبوع')}`, route: 'expiring' });
  }
  return out;
}
function notificationCount() { try { return buildNotifications().length; } catch (_) { return 0; } }

// Count of camp members whose membership expires within the next week (0–7 days),
// for the sidebar reminder badge on Camp Members. Mirrors the page's own check.
function campExpiringSoonCount() {
  const isCamp = m => m && !m.deleted && (m.sport === SUMMER_CAMP || (Array.isArray(m.enrollments) && m.enrollments.some(e => e.sport === SUMMER_CAMP)));
  return (state.members || []).filter(m => {
    if (!isCamp(m)) return false;
    if (typeof memberStatus === 'function' && memberStatus(m) === 'Withdrawn') return false;
    const d = m.expiryDate ? daysUntil(m.expiryDate) : null;
    return d != null && d >= 0 && d <= 7;
  }).length;
}
function notePriorityRank(p) { return p === 'high' ? 0 : p === 'medium' ? 1 : 2; }

// ─── Camp business-day recalculation (Cleanup) ──────────────────────────────
// Camp members created before the business-day rules (v6.87/6.88) may still carry
// calendar-based class counts (7/14/30…) and calendar expiry dates. This finds
// camp memberships whose stored class count or end date doesn't match the
// business-day rule (1 week = 5 classes, 1 month = 22, …; week-based expiry counted
// Sun–Thu), and the fixer recomputes them. Attendance is never changed.
function _campTargetForSub(sub) {
  // Recover the sold duration from the stored class count or duration label, then
  // return the correct business-day class count + end date for it.
  let priceRow = null;
  if (sub.durationLabel) priceRow = (DEFAULT_SUMMER_CAMP_PRICES || []).find(p => p.label === sub.durationLabel);
  if (!priceRow) {
    const cls = parseInt(sub.totalClasses) || 0;
    const paid = parseFloat(sub.amountPaid) || 0;
    const rows = DEFAULT_SUMMER_CAMP_PRICES || [];
    // A stored count can be ambiguous: it may be a legacy CALENDAR-days value
    // (7, 14, 30, 60 …) or an already-correct BUSINESS-day count (5, 10, 22, 44 …).
    // 30 in particular is both "1 month" (legacy days) and "6 weeks" (business days).
    // Disambiguate by the amount paid when we can; otherwise prefer the legacy
    // calendar-days interpretation, since this tool exists to convert old records.
    const legacyMatch = rows.find(p => p.days === cls);
    const bizMatch = rows.find(p => campClassCount(p.days) === cls);
    if (legacyMatch && bizMatch && legacyMatch.label !== bizMatch.label) {
      // Ambiguous — pick the row whose price is closest to what was paid.
      if (paid > 0) {
        priceRow = Math.abs((legacyMatch.price || 0) - paid) <= Math.abs((bizMatch.price || 0) - paid)
          ? legacyMatch : bizMatch;
      } else {
        priceRow = legacyMatch;   // default to the legacy reading
      }
    } else {
      priceRow = legacyMatch || bizMatch;
    }
  }
  if (!priceRow) return null;
  const targetClasses = campClassCount(priceRow.days);
  const targetEnd = sub.start ? campEndDate(sub.start, priceRow.days) : sub.end;
  return { priceRow, targetClasses, targetEnd };
}

function findCampMembersToRecalc() {
  const out = [];
  for (const m of (state.members || [])) {
    if (m.deleted) continue;
    const isCamp = m.sport === SUMMER_CAMP || (Array.isArray(m.enrollments) && m.enrollments.some(e => e.sport === SUMMER_CAMP));
    if (!isCamp) continue;
    const fixes = [];
    for (const sub of (m.subscriptions || [])) {
      if ((sub.activity || '') !== SUMMER_CAMP || sub.status === 'Withdrawn') continue;
      const tgt = _campTargetForSub(sub);
      if (!tgt) continue;
      const clsOff = (parseInt(sub.totalClasses) || 0) !== tgt.targetClasses;
      const endOff = tgt.targetEnd && sub.end !== tgt.targetEnd;
      if (clsOff || endOff) {
        fixes.push({ sub, label: tgt.priceRow.label, fromClasses: parseInt(sub.totalClasses) || 0, toClasses: tgt.targetClasses, fromEnd: sub.end, toEnd: tgt.targetEnd });
      }
    }
    if (fixes.length) out.push({ member: m, fixes });
  }
  return out;
}

function recalcCampMember(memberId) {
  const m = (state.members || []).find(x => x.id === memberId);
  if (!m) return 0;
  let changed = 0;
  for (const sub of (m.subscriptions || [])) {
    if ((sub.activity || '') !== SUMMER_CAMP || sub.status === 'Withdrawn') continue;
    const tgt = _campTargetForSub(sub);
    if (!tgt) continue;
    let touched = false;
    if ((parseInt(sub.totalClasses) || 0) !== tgt.targetClasses) { sub.totalClasses = tgt.targetClasses; touched = true; }
    if (tgt.targetEnd && sub.end !== tgt.targetEnd) { sub.end = tgt.targetEnd; touched = true; }
    if (!sub.durationLabel && tgt.priceRow) sub.durationLabel = tgt.priceRow.label;
    // Mirror onto the matching enrollment + the member's expiry/headline.
    const enr = (m.enrollments || []).find(e => e.sport === SUMMER_CAMP);
    if (enr) { enr.classes = tgt.targetClasses; if (tgt.priceRow) enr.durationLabel = tgt.priceRow.label; }
    if (m.sport === SUMMER_CAMP && tgt.targetEnd) m.expiryDate = tgt.targetEnd;
    if (touched) changed++;
  }
  return changed;
}

// ─── Enrollment ↔ subscription re-sync (Cleanup) ────────────────────────────
// A member's enrollments[] (the headline sport rows shown on cards/attendance) can
// drift out of sync with subscriptions[] (the source-of-truth billing/attendance
// records) — e.g. a sport duplicated, missing, or pointing at the wrong coach. This
// was the root cause behind wrong-coach attendance. The detector flags those members;
// the fixer rebuilds enrollments from the ACTIVE subscriptions (one row per sport,
// correct coach), preserving the existing enrollment's classes/price/dates/validity
// where it already had a matching row. Attendance and subscriptions are NOT touched.
function _activeSubsBySport(m) {
  const bySport = new Map();
  for (const s of (m.subscriptions || [])) {
    if (!s.activity || s.status === 'Withdrawn') continue;
    // Keep the most recent active sub per sport (later start wins).
    const prev = bySport.get(s.activity);
    if (!prev || (s.start || '') >= (prev.start || '')) bySport.set(s.activity, s);
  }
  return bySport;
}
function _enrollmentsMatchSubs(m) {
  const subsBySport = _activeSubsBySport(m);
  const enr = Array.isArray(m.enrollments) ? m.enrollments.filter(e => e && e.sport) : [];
  // Duplicate sport in enrollments?
  const seen = new Set();
  for (const e of enr) { if (seen.has(e.sport)) return false; seen.add(e.sport); }
  // Same set of sports?
  if (seen.size !== subsBySport.size) return false;
  for (const sport of subsBySport.keys()) if (!seen.has(sport)) return false;
  // Coach matches the active sub for each sport?
  for (const e of enr) {
    const s = subsBySport.get(e.sport);
    if (!s) return false;
    if ((e.coachId || null) !== (s.coachId || null)) return false;
  }
  return true;
}
function findMembersWithEnrollmentDrift() {
  const out = [];
  for (const m of (state.members || [])) {
    if (m.deleted) continue;
    // Only meaningful for members that have subscriptions to compare against.
    if (!Array.isArray(m.subscriptions) || !m.subscriptions.some(s => s.status !== 'Withdrawn')) continue;
    if (!_enrollmentsMatchSubs(m)) {
      const subsBySport = _activeSubsBySport(m);
      const enrSports = (m.enrollments || []).filter(e => e && e.sport).map(e => e.sport);
      out.push({
        member: m,
        enrollmentSports: enrSports,
        subscriptionSports: [...subsBySport.keys()],
      });
    }
  }
  return out;
}
function resyncMemberEnrollments(memberId) {
  const m = (state.members || []).find(x => x.id === memberId);
  if (!m) return false;
  const subsBySport = _activeSubsBySport(m);
  if (!subsBySport.size) return false;
  const oldBySport = new Map();
  for (const e of (m.enrollments || [])) if (e && e.sport && !oldBySport.has(e.sport)) oldBySport.set(e.sport, e);
  const rebuilt = [];
  for (const [sport, s] of subsBySport) {
    const old = oldBySport.get(sport) || {};
    rebuilt.push({
      sport,
      coachId: s.coachId != null ? s.coachId : (old.coachId ?? null),
      classes: old.classes != null ? old.classes : (s.totalClasses || 0),
      price: old.price != null ? old.price : (s.amountPaid || 0),
      start: old.start || s.start || null,
      validity: old.validity || s.validity || DEFAULT_VALIDITY,
      ...(old.durationLabel ? { durationLabel: old.durationLabel } : (s.durationLabel ? { durationLabel: s.durationLabel } : {})),
      ...(old.transferLocked ? { transferLocked: true } : {}),
    });
  }
  m.enrollments = rebuilt;
  // Keep the headline sport pointing at something that still exists.
  if (m.sport && !subsBySport.has(m.sport)) m.sport = rebuilt[0] ? rebuilt[0].sport : m.sport;
  return true;
}

function findDuplicateProducts() {
  const byName = {};
  for (const p of (state.products || [])) {
    if (p.deleted) continue;
    const key = (p.name || '').trim().toLowerCase();
    if (!key) continue;
    (byName[key] = byName[key] || []).push(p);
  }
  const out = [];
  for (const group of Object.values(byName)) {
    if (group.length < 2) continue;
    const sorted = group.slice().sort((a, b) => (a.id || 0) - (b.id || 0));   // keep lowest id
    const totalStock = sorted.reduce((s, p) => s + (typeof productCurrentStock === 'function' ? productCurrentStock(p.id) : (p.stock || 0)), 0);
    const initialStock = sorted.reduce((s, p) => s + (p.stock || 0), 0);
    out.push({ name: sorted[0].name, products: sorted, totalStock, initialStock, count: sorted.length });
  }
  return out;
}

// Merge all product records sharing a name into the OLDEST (lowest-id) record:
// re-point every sale line item to the kept id, set the kept record's initial
// stock to the SUM of all the merged records' initial stock (so current stock =
// summed initial − all sales), and remove the duplicate records. Returns the kept
// product.
function mergeDuplicateProducts(name) {
  const key = (name || '').trim().toLowerCase();
  const group = (state.products || []).filter(p => !p.deleted && (p.name || '').trim().toLowerCase() === key)
    .sort((a, b) => (a.id || 0) - (b.id || 0));
  if (group.length < 2) return null;
  const keep = group[0];
  const rest = group.slice(1);
  const restIds = new Set(rest.map(p => p.id));
  // Sum initial stock onto the kept record.
  keep.stock = group.reduce((s, p) => s + (p.stock || 0), 0);
  // Inherit category/sku/threshold from a duplicate if the kept one is missing them.
  for (const p of rest) {
    if (!keep.category && p.category) keep.category = p.category;
    if (!keep.sku && p.sku) keep.sku = p.sku;
    if (keep.lowStockThreshold == null && p.lowStockThreshold != null) keep.lowStockThreshold = p.lowStockThreshold;
  }
  // Re-point all sale line items from the duplicates to the kept product.
  for (const sale of (state.sales || [])) {
    for (const it of (sale.items || [])) {
      if (restIds.has(it.productId)) { it.productId = keep.id; if (!it.name) it.name = keep.name; }
    }
  }
  // Remove the duplicate product records.
  state.products = (state.products || []).filter(p => !restIds.has(p.id));
  return keep;
}

function findMisdatedInvoices(minGapDays = 3) {
  const out = [];
  // Group membership invoices per member; only the member's OLDEST invoice should
  // line up with their start date. Renewals and later invoices are dated to their
  // own period and must never be re-dated back to the original start.
  const byMember = {};
  for (const inv of (state.invoices || [])) {
    if (inv.deleted || inv.switchCredit || inv.activityType === 'switch-credit') continue;
    if ((inv.category || 'Membership') !== 'Membership') continue;
    if (inv.customerId == null || !inv.date) continue;
    (byMember[inv.customerId] = byMember[inv.customerId] || []).push(inv);
  }
  for (const [cid, invs] of Object.entries(byMember)) {
    const m = state.members.find(x => x.id === parseInt(cid));
    if (!m || m.deleted) continue;
    // If the member has more than one membership invoice, they've renewed — the
    // later ones are legitimately dated to their own months, so skip this member
    // entirely (consolidating is a separate Cleanup tool). Only fix single-invoice
    // members whose one invoice drifted off their start date.
    if (invs.length !== 1) continue;
    const inv = invs[0];
    const enrStarts = (Array.isArray(m.enrollments) ? m.enrollments : [])
      .map(e => enrollmentStartDate(e, m)).filter(Boolean).sort();
    const startDate = enrStarts[0] || m.startDate || m.firstRegistration || null;
    if (!startDate) continue;
    const gapDays = daysBetween(startDate, inv.date);
    if (gapDays >= minGapDays && inv.date > startDate) {
      out.push({ member: m, inv, invDate: inv.date, startDate, gapDays });
    }
  }
  return out.sort((a, b) => b.gapDays - a.gapDays);
}

// Re-date one invoice (and its payment records / month) to the member's start
// date. Keeps amounts intact; only the date/month move, so revenue is recognised
// in the correct month. Returns the corrected invoice.
function fixInvoiceDateToStart(invId) {
  const inv = (state.invoices || []).find(i => i.id === invId && !i.deleted);
  if (!inv) return null;
  const m = state.members.find(x => x.id === inv.customerId);
  if (!m) return null;
  const enrStarts = (Array.isArray(m.enrollments) ? m.enrollments : [])
    .map(e => enrollmentStartDate(e, m)).filter(Boolean).sort();
  const startDate = enrStarts[0] || m.startDate || m.firstRegistration || null;
  if (!startDate) return null;
  const newMonth = startDate.slice(0, 7);
  inv.date = startDate;
  inv.month = newMonth;
  if (Array.isArray(inv.payments)) {
    inv.payments.forEach(p => { p.date = startDate; p.month = newMonth; });
  }
  return inv;
}

function findMembersWithMergeableInvoices() {
  const byMember = {};
  for (const inv of (state.invoices || [])) {
    if (inv.deleted || inv.switchCredit || inv.activityType === 'switch-credit') continue;
    if ((inv.category || 'Membership') !== 'Membership') continue;
    if (inv.customerId == null) continue;
    (byMember[inv.customerId] = byMember[inv.customerId] || []).push(inv);
  }
  const out = [];
  for (const [cid, invs] of Object.entries(byMember)) {
    if (invs.length < 2) continue;
    const member = state.members.find(x => x.id === parseInt(cid));
    if (!member || member.deleted) continue;
    const sorted = invs.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const total = sorted.reduce((s, i) => s + invoiceTotal(i), 0);
    const paid = sorted.reduce((s, i) => s + invoicePaid(i), 0);
    out.push({ member, invoices: sorted, total, paid });
  }
  return out;
}

// Merge all of a member's membership invoices into the OLDEST one: combine line
// items + payments, set the oldest's amount to the sum, soft-delete the rest.
// Payments keep their own months so revenue stays accurate. Returns the kept inv.
function mergeMemberInvoices(memberId) {
  const invs = (state.invoices || []).filter(inv =>
    !inv.deleted && inv.customerId === memberId && !inv.switchCredit
    && inv.activityType !== 'switch-credit' && (inv.category || 'Membership') === 'Membership');
  if (invs.length < 2) return null;
  const sorted = invs.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  // Capture the TRUE charged total and combined discount BEFORE merging, so a
  // discounted invoice (whose amount is below its line-price sum) isn't inflated
  // by recomputing the total from raw line prices.
  const trueChargedTotal = invs.reduce((s, iv) => s + (Number(iv.amount) || 0), 0);
  const combinedDiscount = invs.reduce((s, iv) => s + (Number(iv.discount) || 0), 0);
  const keep = sorted[0];
  const rest = sorted.slice(1);
  if (!Array.isArray(keep.lineItems)) {
    keep.lineItems = [{ sport: keep.sport, coach: keep.coach, coachId: keep.coachId, price: keep.amount || 0, classes: keep.classes }];
  }
  if (!Array.isArray(keep.payments)) {
    keep.payments = (keep.amountPaid || 0) > 0 ? [{ date: keep.date, month: keep.month || (keep.date || '').slice(0, 7), amount: keep.amountPaid, method: keep.method || 'cash' }] : [];
  }
  for (const r of rest) {
    const rLines = (Array.isArray(r.lineItems) && r.lineItems.length)
      ? r.lineItems
      : [{ sport: r.sport, coach: r.coach, coachId: r.coachId, price: r.amount || 0, classes: r.classes }];
    keep.lineItems.push(...rLines);
    const rPays = (Array.isArray(r.payments) && r.payments.length)
      ? r.payments
      : ((r.amountPaid || 0) > 0 ? [{ date: r.date, month: r.month || (r.date || '').slice(0, 7), amount: r.amountPaid, method: r.method || 'cash' }] : []);
    keep.payments.push(...rPays);
    r.deleted = true;
    r.deletedReason = 'Merged into ' + (keep.ref || ('INV' + keep.id));
  }
  keep.amount = trueChargedTotal;
  if (combinedDiscount > 0) keep.discount = combinedDiscount;
  keep.amountPaid = (keep.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
  const mem = state.members.find(x => x.id === memberId);
  if (mem) {
    const label = (typeof sportListWithDuration === 'function' && sportListWithDuration(keep.lineItems)) || keep.lineItems.map(li => li.sport).join(', ');
    keep.sport = label;
    keep.description = `${mem.name} — ${label} subscription`;
  }
  return keep;
}


// Phone-aware SEARCH match. The query may include spaces, a +974 country code,
// or be a partial fragment. We compare digits-only so "+974 6699 5549",
// "6699 5549" and "66995549" all match the same stored number, and a partial
// like "6699" still matches. queryDigits is the digits-only form of what the
// user typed.
function phoneSearchMatches(storedPhone, queryDigits) {
  if (!storedPhone || !queryDigits) return false;
  const d = normalizePhoneForCompare(storedPhone);
  if (!d) return false;
  if (d.includes(queryDigits)) return true;     // partial / space-insensitive
  return phonesMatch(d, queryDigits);           // full number with/without +974
}
// trim, exact match.
function findMembersByQid(qid, excludeId) {
  if (!qid) return [];
  const target = String(qid).trim().toUpperCase();
  if (!target) return [];
  return state.members.filter(m => {
    if (m.id === excludeId) return false;
    const mQid = String(m.qid || '').trim().toUpperCase();
    return mQid && mQid === target;
  });
}

// ─── NAME MATCHING (for the composite uniqueness key) ────────────
// A member is uniquely identified by Mobile + Name. Two records with the
// same phone are only the SAME person when a name also matches; if the names
// differ they're distinct people (e.g. a family sharing one phone), which is
// allowed. Names match on EITHER the English or the Arabic field.
function normalizeNameForCompare(name) {
  if (!name) return '';
  // Trim, lowercase (no-op for Arabic), collapse internal whitespace.
  return String(name).trim().toLowerCase().replace(/\s+/g, ' ');
}

// Group members whose names are the SAME or very SIMILAR (likely accidental
// duplicates). Compares English and Arabic names with normalized edit distance,
// so "Mohamed Ali" ≈ "Mohammed Ali", "ahmad" ≈ "ahmed", and exact matches all
// cluster. Returns an array of groups: [{ key, members:[m,...], reason }].
// `threshold` is the max similarity distance ratio (0 = identical only).
function findSimilarNameMembers(members, opts = {}) {
  const list = (members || []).filter(m => m && !m.deleted && (m.name || m.nameArabic));
  // Similarity test between two members (true if names are close enough).
  const ratio = opts.ratio != null ? opts.ratio : 0.2;   // ≤20% of length may differ
  const close = (a, b) => {
    if (!a || !b) return false;
    if (a === b) return true;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen < 4) return a === b;                 // too short to fuzz safely
    const allowed = Math.max(1, Math.floor(maxLen * ratio));
    return levenshtein(a, b) <= allowed;
  };
  const simMembers = (m1, m2) => {
    const e1 = normalizeNameForCompare(m1.name), e2 = normalizeNameForCompare(m2.name);
    const a1 = normalizeNameForCompare(m1.nameArabic), a2 = normalizeNameForCompare(m2.nameArabic);
    let how = null;
    if (e1 && e2 && close(e1, e2)) how = (e1 === e2) ? 'exact' : 'similar';
    if (!how && a1 && a2 && close(a1, a2)) how = (a1 === a2) ? 'exact' : 'similar';
    return how;
  };
  // Union-find style clustering.
  const parent = list.map((_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { parent[find(a)] = find(b); };
  const reasons = {};
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const how = simMembers(list[i], list[j]);
      if (how) { union(i, j); if (how === 'exact') reasons[find(i)] = 'exact'; else if (!reasons[find(i)]) reasons[find(i)] = 'similar'; }
    }
  }
  const clusters = {};
  for (let i = 0; i < list.length; i++) {
    const r = find(i);
    (clusters[r] = clusters[r] || []).push(list[i]);
  }
  return Object.entries(clusters)
    .filter(([, ms]) => ms.length > 1)
    .map(([r, ms]) => ({ members: ms, reason: reasons[r] || 'similar', key: (ms[0].name || ms[0].nameArabic || '') }))
    .sort((a, b) => (a.reason === b.reason ? b.members.length - a.members.length : (a.reason === 'exact' ? -1 : 1)));
}

// True if two members share an English name OR an Arabic name (non-empty).
function namesMatch(a, b) {
  const aEn = normalizeNameForCompare(a.name);
  const bEn = normalizeNameForCompare(b.name);
  if (aEn && bEn && aEn === bEn) return true;
  const aAr = normalizeNameForCompare(a.nameArabic);
  const bAr = normalizeNameForCompare(b.nameArabic);
  if (aAr && bAr && aAr === bAr) return true;
  return false;
}

// Composite-key duplicate lookup used at save time. Returns the existing
// member (active OR archived) that is the SAME person as the one being saved
// — i.e. phone matches AND a name matches — or null. Same phone with a
// different name is NOT a duplicate (returns null).
function findDuplicateMember(phone, nameEn, nameAr, excludeId) {
  if (!phone) return null;
  const candidate = { name: nameEn, nameArabic: nameAr };
  return state.members.find(m => {
    if (m.id === excludeId) return false;
    if (!phonesMatch(m.phone, phone)) return false;
    return namesMatch(m, candidate);
  }) || null;
}

// Group members who share a phone number, REGARDLESS of name. Returns clusters
// of 2+ members on the same last-8 digits. Use case: spotting a child wrongly
// registered with a parent's mobile, or any two records on the same number
// before they get merged into a Family. Members in this list may legitimately
// be siblings on a shared family phone — admin reviews.
function findSharedPhoneClusters() {
  const buckets = new Map();
  for (const m of state.members) {
    const d = normalizePhoneForCompare(m.phone);
    if (!d || d.length < MIN_PHONE_DIGITS) continue;
    const key = d.slice(-8);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(m);
  }
  const out = [];
  for (const [key, members] of buckets) {
    if (members.length >= 2) out.push({ key, members });
  }
  // Largest first; ties broken by name for stable display.
  out.sort((a, b) => b.members.length - a.members.length || (a.members[0].name || '').localeCompare(b.members[0].name || ''));
  return out;
}

// Group members into TRUE duplicate clusters: same phone AND same name.
// Returns an array of arrays, each inner array being 2+ members that are the
// same person. Members who merely share a phone (different names — families)
// are intentionally NOT clustered.
function findAllDuplicateMembers() {
  // 1. Bucket by phone (last 8 digits — the stable portion across formats).
  const phoneBuckets = new Map();  // phoneKey -> [members]
  for (const m of state.members) {
    const d = normalizePhoneForCompare(m.phone);
    if (!d || d.length < MIN_PHONE_DIGITS) continue;
    const key = d.slice(-8);
    if (!phoneBuckets.has(key)) phoneBuckets.set(key, []);
    phoneBuckets.get(key).push(m);
  }
  // 2. Within each phone bucket, sub-group members whose names also match.
  const clusters = [];
  for (const members of phoneBuckets.values()) {
    if (members.length < 2) continue;
    const used = new Set();
    for (let i = 0; i < members.length; i++) {
      if (used.has(members[i].id)) continue;
      const group = [members[i]];
      used.add(members[i].id);
      for (let j = i + 1; j < members.length; j++) {
        if (used.has(members[j].id)) continue;
        if (namesMatch(members[i], members[j])) {
          group.push(members[j]);
          used.add(members[j].id);
        }
      }
      if (group.length >= 2) clusters.push(group);
    }
  }
  return clusters;
}

// Group members whose NAMES are similar (typo-tolerant), regardless of phone —
// for cleanup. Uses Levenshtein on the raw and word-sorted name (so reordered
// names match), in English or Arabic. Clusters fully covered by the exact
// phone+name duplicate scan are skipped to avoid showing the same group twice.
function findSimilarNameClusters() {
  const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const sortWords = s => norm(s).split(' ').filter(Boolean).sort().join(' ');
  const members = state.members.filter(m => norm(m.name) || norm(m.nameArabic));
  const similar = (a, b) => {
    const an = norm(a.name), bn = norm(b.name);
    if (an && bn) {
      if (an === bn) return true;
      const aw = sortWords(a.name), bw = sortWords(b.name);
      if (aw === bw) return true;
      const thr = Math.max(1, Math.floor(Math.max(an.length, bn.length) * 0.2));
      if (levenshtein(an, bn) <= thr || levenshtein(aw, bw) <= thr) return true;
    }
    const aa = norm(a.nameArabic), ba = norm(b.nameArabic);
    if (aa && ba) {
      if (aa === ba) return true;
      if (levenshtein(aa, ba) <= Math.max(1, Math.floor(Math.max(aa.length, ba.length) * 0.2))) return true;
    }
    return false;
  };
  const parent = members.map((_, i) => i);
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { parent[find(a)] = find(b); };
  for (let i = 0; i < members.length; i++)
    for (let j = i + 1; j < members.length; j++)
      if (similar(members[i], members[j])) union(i, j);
  const groupsMap = new Map();
  for (let i = 0; i < members.length; i++) {
    const r = find(i);
    if (!groupsMap.has(r)) groupsMap.set(r, []);
    groupsMap.get(r).push(members[i]);
  }
  const dupIds = new Set();
  for (const c of findAllDuplicateMembers()) for (const m of c) dupIds.add(m.id);
  const out = [];
  for (const g of groupsMap.values()) {
    if (g.length < 2) continue;
    if (g.every(m => dupIds.has(m.id))) continue;  // already in the phone+name scan
    out.push(g);
  }
  out.sort((a, b) => b.length - a.length || (a[0].name || '').localeCompare(b[0].name || ''));
  return out;
}

function phoneCell(phone, opts = {}) {
  if (!isRealPhone(phone)) {
    return opts.empty != null ? opts.empty : '<span class="text-mute">—</span>';
  }
  const url = waLink(phone, opts.text);
  const stop = opts.stop === false ? '' : 'event.stopPropagation();';
  return `<span style="white-space:nowrap">${escapeHtml(phone)} <a href="${url}" target="_blank" onclick="${stop}" title="Open WhatsApp" style="color:#25D366;text-decoration:none;font-size:14px;vertical-align:middle;margin-left:2px">💬</a></span>`;
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
        phone2: m.phone2 || null,
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
function liveAttendanceCount(m, sport = null, fromDate = null, toDate = null) {
  let y = 0, n = 0;
  const da = m?.dailyAttendance;
  if (!da) return { y, n, total: 0 };
  // Build a full YYYY-MM-DD for a (monthKey, dayKey) so we can window by date.
  const inWindow = (monthKey, dayKey) => {
    if (!fromDate && !toDate) return true;
    const d = String(parseInt(dayKey, 10)).padStart(2, '0');
    const full = `${monthKey}-${d}`;            // e.g. 2026-05-08
    if (fromDate && full < fromDate) return false;
    if (toDate && full > toDate) return false;
    return true;
  };
  for (const monthKey of Object.keys(da)) {
    const mo = da[monthKey];
    if (!mo) continue;
    const sample = Object.values(mo)[0];
    if (sample && typeof sample === 'object') {
      // Per-sport shape
      for (const sp of Object.keys(mo)) {
        if (sport && sp !== sport) continue;
        const days = mo[sp] || {};
        for (const [dayKey, v] of Object.entries(days)) {
          if (!inWindow(monthKey, dayKey)) continue;
          if (v === 'Y') y++;
          else if (v === 'N') n++;
        }
      }
    } else {
      // Legacy flat (counts as primary sport)
      if (sport && sport !== m.sport) continue;
      for (const [dayKey, v] of Object.entries(mo)) {
        if (!inWindow(monthKey, dayKey)) continue;
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

// Top N most active members for a scheduled class (a sport + optional coach),
// ranked by attended classes in that sport. Narrows to the class's coach when
// any of that sport's members are with them; otherwise shows all in the sport.
function topActiveMembersForClass(sport, coachId, limit) {
  limit = limit || 10;
  const inSport = (m) => !m.deleted && (
    (m.enrollments || []).some(e => e.sport === sport) ||
    (m.subscriptions || []).some(s => s.activity === sport)
  );
  const withCoach = (m) => (
    (m.enrollments || []).some(e => e.sport === sport && e.coachId === coachId) ||
    (m.subscriptions || []).some(s => s.activity === sport && s.coachId === coachId)
  );
  let pool = (state.members || []).filter(inSport);
  if (coachId != null) {
    const byCoach = pool.filter(withCoach);
    if (byCoach.length) pool = byCoach;
  }
  return pool
    .map(m => ({ id: m.id, name: m.name || m.nameArabic || ('#' + m.id), attended: attendedClassesFor(m, sport) }))
    .sort((a, b) => b.attended - a.attended || String(a.name).localeCompare(String(b.name)))
    .slice(0, limit);
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

// Is this a real, bookable sport (so coach-eligibility should be enforced)?
// Summer-camp activities like "Art"/"Combat" aren't sports, so no constraint there.
function isBookableSport(sport) {
  if (!sport) return false;
  const names = ((state.settings && state.settings.sports) || []).map(s => s.name);
  if (names.includes(sport)) return true;
  return (typeof DEFAULT_SPORTS !== 'undefined' && DEFAULT_SPORTS.includes(sport));
}
// Does this coach teach the given sport? Coaches with no sports recorded are not
// over-blocked (returns true) so legacy data still works; admins should set sports.
// Private variants ("Kick Boxing (Private)") match coaches of the BASE sport.
function coachTeachesSport(coach, sport) {
  if (!coach) return false;
  if (!isBookableSport(sport) && !isBookableSport(baseSportName(sport))) return true;  // unknown / camp activity → no constraint
  const list = coach.sports || [];
  if (!list.length) return true;                   // sports not recorded → don't block
  return list.includes(sport) || list.includes(baseSportName(sport));
}
// Coaches eligible to be booked for `sport`: active AND teach it. `selectedId`
// (a currently-assigned coach) is always kept in the list — even if now inactive
// or no longer teaching — so existing bookings stay visible and aren't dropped.
function coachesForSport(sport, selectedId) {
  const all = state.coaches || [];
  const eligible = all.filter(c => isCoachActive(c) && coachTeachesSport(c, sport));
  if (selectedId != null && selectedId !== '') {
    const sel = all.find(c => String(c.id) === String(selectedId));
    if (sel && !eligible.some(c => c.id === sel.id)) eligible.unshift(sel);
  }
  return eligible;
}
// Dropdown label that flags why a kept-but-ineligible coach is shown.
function coachOptionLabel(c, sport) {
  if (!isCoachActive(c)) return escapeHtml(c.name) + ' (inactive)';
  if (isBookableSport(sport) && !coachTeachesSport(c, sport)) return escapeHtml(c.name) + ' (doesn\u2019t teach ' + escapeHtml(sport) + ')';
  return escapeHtml(c.name);
}

// Coaches selectable for NEW enrollments / renewals / registrations.
// Inactive coaches are excluded here, but still appear in search/filter dropdowns
// and remain attached to their historical records.
function activeCoaches() {
  return state.coaches.filter(isCoachActive);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  // Parse date-only strings as LOCAL midnight (append T00:00:00) so the day count
  // doesn't drift by one in non-UTC timezones — matching addDays/addBusinessDays.
  const target = new Date(/^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr + 'T00:00:00' : dateStr);
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
// ─── Member helpers: age, tenure, birthday ──────────────────────────
// All accept ISO date strings (YYYY-MM-DD) and return display values.

// Years from birthdate to today. Returns null if birthdate missing/invalid.
function memberAge(birthdate) {
  if (!birthdate) return null;
  const b = new Date(birthdate);
  if (isNaN(b)) return null;
  const t = new Date(TODAY);
  let age = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  // Adjust if the birthday hasn't happened yet this year
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) age--;
  return age >= 0 ? age : null;
}

// Approximate birthdate from a plain age (today minus N years) — used for quick
// age-only entry. memberAge() of the result reads back as exactly `age` today.
function ageToBirthdate(age) {
  const a = parseInt(age);
  if (!Number.isFinite(a) || a < 3 || a > 120) return '';
  const t = new Date(TODAY);
  return `${t.getFullYear() - a}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

// Returns true if the member's birthday falls in the given YYYY-MM (default: this month)
function isBirthdayInMonth(birthdate, monthKey) {
  if (!birthdate) return false;
  const m = (monthKey || currentMonth()).slice(5, 7);
  return birthdate.slice(5, 7) === m;
}

// Days until next birthday (positive number). null if no birthdate.
function daysUntilBirthday(birthdate) {
  if (!birthdate) return null;
  const b = new Date(birthdate);
  if (isNaN(b)) return null;
  const t = new Date(TODAY);
  // Build this year's birthday, then advance to next year if it's already passed
  let next = new Date(t.getFullYear(), b.getMonth(), b.getDate());
  if (next < t) next = new Date(t.getFullYear() + 1, b.getMonth(), b.getDate());
  return Math.round((next - t) / 86400000);
}

// "1 year 4 months" since the given date. Returns null if missing/future.
function memberTenure(joinDateStr) {
  if (!joinDateStr) return null;
  const j = new Date(joinDateStr);
  if (isNaN(j)) return null;
  const t = new Date(TODAY);
  if (j > t) return null;
  let years = t.getFullYear() - j.getFullYear();
  let months = t.getMonth() - j.getMonth();
  if (t.getDate() < j.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  if (years === 0 && months === 0) return 'New';
  if (years === 0) return `${months} month${months === 1 ? '' : 's'}`;
  if (months === 0) return `${years} year${years === 1 ? '' : 's'}`;
  return `${years} year${years === 1 ? '' : 's'} ${months} month${months === 1 ? '' : 's'}`;
}

function isCompleted(m) {
  if (!m) return false;
  // "Completed" means the member finished all classes of their CURRENT membership
  // early. It must reflect the current cycle only — a fully-attended PAST month
  // must not keep marking them Completed once they've renewed into a new, still-
  // in-progress subscription. So we look only at subscriptions belonging to the
  // current cycle (on/after the current start date), and require ALL of those to
  // be fully attended.
  const cycleStart = m.startDate || m.firstRegistration || null;
  const subs = [...(m.subscriptions || []), ...(m.renewals || [])];
  // Current-cycle subscriptions: those that start on/after the cycle start. If we
  // can't tell (no dates), fall back to the most recent subscription only.
  let current = cycleStart ? subs.filter(s => (s.start || '') >= cycleStart) : [];
  if (!current.length && subs.length) {
    // No cycle match — use the latest by start/end date as "current".
    current = [subs.slice().sort((a, b) => (a.start || a.end || '').localeCompare(b.start || b.end || '')).slice(-1)[0]];
  }
  if (!current.length) return false;
  // Every current subscription with a class plan must be fully attended, and at
  // least one must actually have a plan (so a 0-class row doesn't count).
  let sawPlan = false;
  for (const s of current) {
    const total = s.totalClasses, attended = s.attendedClasses;
    if (total == null || total <= 0) continue;     // no plan on this row → skip
    sawPlan = true;
    if (attended == null || attended < total) return false;   // still has classes left → not completed
  }
  return sawPlan;
}

// True when a Summer Camp member has attended at least all the classes their camp
// duration allows (the class limit = totalClasses). Counts live attendance within
// the camp subscription's window. Only applies to camp; regular sports renew by date.
// Carry-forward credit for a renewal: when a member's previous period for a sport
// EXPIRED with classes still unused (paid but not attended), they may carry a few of
// those classes into their next membership. Capped at CARRY_FORWARD_MAX (2).
//   credit = min( unused classes on the latest finished sub for this sport, 2 )
// "unused" = totalClasses − classes actually attended (live), never negative.
const CARRY_FORWARD_MAX = 2;
function carryForwardCredit(m, sport) {
  if (!m || !Array.isArray(m.subscriptions)) return 0;
  const subs = m.subscriptions.filter(s => (s.activity || '') === sport);
  if (!subs.length) return 0;
  // Use the most recent FINISHED period (expired/completed/ended) as the source.
  const today = (typeof TODAY !== 'undefined' ? TODAY : '9999-99-99');
  const finished = subs
    .filter(s => s.status !== 'active' || (s.end && s.end < today))
    .sort((a, b) => (a.end || '').localeCompare(b.end || ''));
  const src = finished.length ? finished[finished.length - 1] : null;
  if (!src) return 0;
  const total = parseInt(src.totalClasses) || 0;
  if (total <= 0) return 0;
  const liveAtt = (typeof liveAttendanceCount === 'function')
    ? (liveAttendanceCount(m, sport, src.start || null, src.end || null).y || 0) : 0;
  const attended = Math.max(parseInt(src.attendedClasses) || 0, liveAtt);
  const unused = Math.max(0, total - attended);
  return Math.min(CARRY_FORWARD_MAX, unused);
}

function campLimitReached(m) {
  if (!m || !Array.isArray(m.subscriptions)) return false;
  const campSubs = m.subscriptions.filter(s => (s.activity || '') === SUMMER_CAMP && s.status !== 'Withdrawn');
  if (!campSubs.length) return false;
  // A non-camp member (has other active sports) is not expired by camp alone.
  const hasOtherSport = (m.enrollments || []).some(e => e.sport && e.sport !== SUMMER_CAMP);
  if (hasOtherSport) return false;
  // Use the most recent camp subscription as the current one.
  const sorted = campSubs.slice().sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  const sub = sorted[sorted.length - 1];
  // Limit = the camp class-day count for this duration (e.g. 1 week = 5), NOT the
  // calendar validity window. Prefer durationLabel/days; fall back to stored total.
  let limit = 0;
  if (sub.durationLabel && typeof campDaysForLabel === 'function') {
    const d = campDaysForLabel(sub.durationLabel);
    if (d) limit = campClassCount(d);
  }
  if (!limit) limit = parseInt(sub.totalClasses) || 0;
  if (limit <= 0) return false;
  // Count ONLY the attendance that falls inside THIS period's window [start, nextStart)
  // so days from earlier camp periods (or the next renewal's boundary day) don't leak in.
  const idx = sorted.indexOf(sub);
  const winStart = sub.start || null;
  const nextStart = (idx >= 0 && sorted[idx + 1]) ? sorted[idx + 1].start : null;
  // End the window the day BEFORE the next period starts (exclusive boundary), else
  // use the sub's own end.
  let winEnd = sub.end || null;
  if (nextStart) { const d = new Date(nextStart + 'T00:00:00'); d.setDate(d.getDate() - 1); winEnd = d.toISOString().slice(0, 10); }
  let attended = 0;
  if (typeof liveAttendanceCount === 'function') {
    const live = liveAttendanceCount(m, SUMMER_CAMP, winStart, winEnd);
    attended = (live && live.total > 0) ? live.y : (parseInt(sub.attendedClasses) || 0);
  } else {
    attended = parseInt(sub.attendedClasses) || 0;
  }
  return attended >= limit;
}

// Derived display status: 'Completed' | 'Active' | 'Expired'
// Completed members are still ACTIVE (current), just finished their package early.
function memberStatus(m) {
  if (!m) return 'Expired';
  // Withdrawn is a terminal, explicitly-set state (refunded & left) — trust it.
  if (m.status === 'Withdrawn') return 'Withdrawn';
  // Transferred: the member moved their membership(s) to someone else and has no
  // sports of their own left. Terminal, explicitly-set (cleared if they re-enroll).
  if (m.status === 'Transferred' && !((m.enrollments || []).length)) return 'Transferred';
  // Frozen takes priority: freeze pauses the membership and shifts the expiry,
  // so a frozen member is never considered Expired even if their original
  // expiry slipped past today.
  if (m.currentFreezeUntil && TODAY <= m.currentFreezeUntil) return 'Frozen';
  // Derive Expired from data — don't trust the stored status field. This fixes
  // the case where status was set once (e.g. on import) and never updated as
  // the expiry date passed.
  if (m.expiryDate && m.expiryDate < TODAY) return 'Expired';
  // Camp class limit: once a Summer Camp member has attended all the classes their
  // duration allows, they've COMPLETED the camp (even if their validity window hasn't
  // ended yet). If the window itself has passed, the expiry check above already
  // returned 'Expired'. Uses live attendance so it reflects the roll-call grid.
  if (campLimitReached(m)) return 'Completed';
  // If the stored status explicitly says Expired and we have no expiryDate
  // to argue otherwise, respect it (legacy data).
  if (!m.expiryDate && m.status === 'Expired') return 'Expired';
  if (isCompleted(m)) return 'Completed';
  return 'Active';
}

// Is the member counted as active (Active, Completed, AND Frozen all count)?
// Frozen members are not Expired — they're paused but still paying customers.
// Returns the list of members NOT soft-deleted. Use for active-state operations
// (lists, dashboards, counts, exports). For looking up a specific member by id
// (e.g. to show their name on an old invoice), still use state.members.find()
// directly — historical references should resolve even for archived members.
function activeMembers() {
  return state.members.filter(m => !m.deleted);
}

function isActiveStatus(m) {
  return memberStatus(m) !== 'Expired';
}

// ── Canonical member counts — ONE source of truth used by every page ──
// Always computed over non-archived members, with strict per-status buckets so
// the Dashboard, Members header, Reports, etc. can never disagree.
//   active/expired/completed/frozen/withdrawn = exact memberStatus buckets
//   current = memberships valid right now (active + completed + frozen)
//   total   = non-archived members
function memberCounts() {
  const list = activeMembers();
  const c = { active: 0, expired: 0, completed: 0, frozen: 0, withdrawn: 0, total: list.length };
  for (const m of list) {
    const s = memberStatus(m);
    if (s === 'Active') c.active++;
    else if (s === 'Expired') c.expired++;
    else if (s === 'Completed') c.completed++;
    else if (s === 'Frozen') c.frozen++;
    else if (s === 'Withdrawn') c.withdrawn++;
  }
  c.current = c.active + c.completed + c.frozen;
  return c;
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
// ─── Attendance-based commission (opt-in) ──────────────────────────────────
// Default is the original "payment basis" (whole fee counts in the month the
// invoice was recorded). When state.settings.commissionBasis === 'attendance',
// a coach is instead paid PER CLASS ATTENDED, in the month attended. Paid-but-
// unattended classes show as "pending" and pay out either as they're attended
// or, when the membership ends, as a one-off true-up. Over a membership's life
// the two approaches sum to exactly the same fee × rate — only the timing moves.
// Falls back to payment basis for memberships with no class count and for
// sport-switch credit lines (kept on their existing behaviour for now).
// ── Per-coach salary exclusions ──
// Lets the club drop specific members from a coach's commission (e.g. the coach's
// own child, or a comped member). Stored as settings.salaryExclusions[coachId] = [memberIds].
function salaryExclusionSet(coachId) {
  const map = (state.settings && state.settings.salaryExclusions) || {};
  return new Set(map[coachId] || map[String(coachId)] || []);
}
function isExcludedFromCoachSalary(coachId, memberId) {
  if (memberId == null) return false;
  return salaryExclusionSet(coachId).has(memberId);
}
// Distinct members who contribute commissionable membership revenue to a coach.
function coachStudents(coachId) {
  const seen = new Map();
  for (const inv of (state.invoices || [])) {
    if ((inv.category || 'Membership') !== 'Membership') continue;
    if (!inv.customerId) continue;
    const mem = state.members.find(x => x.id === inv.customerId);
    if (!mem) continue;
    const lineItems = commissionLineItems(inv, mem);
    for (const li of lineItems) {
      if (li.coachId !== coachId) continue;
      if (li.sport === SUMMER_CAMP) continue;
      const isSwitch = !!inv.switchCredit || inv.activityType === 'switch-credit' || (parseFloat(li.price) || 0) < 0;
      if (isSwitch) continue;
      if (!seen.has(mem.id)) seen.set(mem.id, { id: mem.id, name: mem.name || mem.nameArabic || ('#' + mem.id), sports: new Set(), deleted: !!mem.deleted });
      seen.get(mem.id).sports.add(li.sport);
    }
  }
  return Array.from(seen.values())
    .map(s => ({ id: s.id, name: s.name, deleted: s.deleted, sports: Array.from(s.sports) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Broadcast posts: advice / articles with audience + read receipts ───────
// Recipient keys: members are "m:<id>", coaches are "c:<id>". This keeps the
// audience list and read map compact and role-aware.
function postKey(role, id) { return (role === 'coach' ? 'c:' : 'm:') + id; }

function _activeMembersForPosts() {
  return (state.members || []).filter(m => !m.deleted);
}
function _memberInSport(m, sport) {
  if (!sport) return false;
  if (m.sport === sport) return true;
  return (m.enrollments || []).some(e => e.sport === sport);
}

// Resolve an audience descriptor into a flat list of recipient keys.
//  authorRole: 'coach' | 'admin'
//  audience: { scope:'all'|'sport'|'custom', sport, memberIds:[], coachIds:[], includeCoaches:bool }
function resolvePostRecipients(audience, authorRole, authorId) {
  audience = audience || { scope: 'all' };
  const keys = new Set();
  if (authorRole === 'coach') {
    // A coach can only reach THEIR OWN students (members).
    const mine = coachStudents(authorId).filter(s => !s.deleted);
    let list = mine;
    if (audience.scope === 'sport' && audience.sport) {
      list = mine.filter(s => (s.sports || []).includes(audience.sport));
    } else if (audience.scope === 'custom') {
      const pick = new Set((audience.memberIds || []).map(Number));
      list = mine.filter(s => pick.has(Number(s.id)));
    }
    list.forEach(s => keys.add(postKey('member', s.id)));
  } else {
    // Admin: members + (optionally) coaches, across the whole club.
    if (audience.scope === 'custom') {
      (audience.memberIds || []).forEach(id => keys.add(postKey('member', id)));
      (audience.coachIds || []).forEach(id => keys.add(postKey('coach', id)));
    } else {
      let members = _activeMembersForPosts();
      let coaches = (state.coaches || []).filter(c => !c.deleted);
      if (audience.scope === 'sport' && audience.sport) {
        members = members.filter(m => _memberInSport(m, audience.sport));
        coaches = coaches.filter(c => (state.invoices || []).some(i => !i.deleted
          && (i.coachId === c.id || (Array.isArray(i.lineItems) && i.lineItems.some(li => li.coachId === c.id && li.sport === audience.sport)))));
      }
      members.forEach(m => keys.add(postKey('member', m.id)));
      if (audience.includeCoaches) coaches.forEach(c => keys.add(postKey('coach', c.id)));
    }
  }
  return Array.from(keys);
}

// Is this post addressed to the given user?
function postIsForUser(post, role, id) {
  if (!post || id == null) return false;
  return (post.recipients || []).includes(postKey(role, id));
}
function postsForUser(role, id) {
  return (state.posts || [])
    .filter(p => postIsForUser(p, role, id))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
function markPostRead(postId, role, id) {
  const p = (state.posts || []).find(x => x.id === postId);
  if (!p || id == null) return;
  if (!p.readBy || typeof p.readBy !== 'object') p.readBy = {};
  const k = postKey(role, id);
  if (!postIsForUser(p, role, id)) return;     // only recipients can be "read"
  if (!p.readBy[k]) { p.readBy[k] = TODAY; save(); }
}
function postReadCount(post) {
  const recips = (post.recipients || []).length;
  const read = Object.keys(post.readBy || {}).filter(k => (post.recipients || []).includes(k)).length;
  return { read, total: recips };
}
function unreadPostsForUser(role, id) {
  if (id == null) return [];
  const k = postKey(role, id);
  return postsForUser(role, id).filter(p => !(p.readBy || {})[k]);
}
function postRecipientName(key) {
  const parts = String(key).split(':');
  const id = Number(parts[1]);
  if (parts[0] === 'c') return (state.coaches.find(c => c.id === id) || {}).name || ('Coach #' + id);
  const m = state.members.find(x => x.id === id) || {};
  return m.name || m.nameArabic || ('Member #' + id);
}

// Create + store a broadcast post. Returns the post (or null if no recipients).
function publishPost(opts) {
  const audience = opts.audience || { scope: 'all' };
  const recipients = resolvePostRecipients(audience, opts.authorRole, opts.authorId);
  if (!recipients.length) return null;
  const post = {
    id: nextId(state.posts),
    authorRole: opts.authorRole,
    authorId: opts.authorId != null ? opts.authorId : null,
    authorName: opts.authorName || (opts.authorRole === 'admin' ? 'Admin' : 'Coach'),
    title: (opts.title || '').trim() || null,
    text: (opts.text || '').trim(),
    date: TODAY,
    audience,
    recipients,
    readBy: {},
    comments: [],
  };
  state.posts.push(post);
  if (typeof audit === 'function') audit('post.publish', `post:${post.id}`, `${opts.authorRole} -> ${recipients.length} recipients`);
  save();
  return post;
}

function _ymOf(d) { return d ? String(d).slice(0, 7) : null; }

// Count 'Y' marks for a member+sport in one month, bounded to a subscription's
// [start,end] window so renewals of the same sport don't double-count.
function attendedYInMonth(m, sport, monthKey, startDate, endDate, uptoDate) {
  const day = attendanceFor(m, monthKey, sport) || {};
  let y = 0;
  for (const d of Object.keys(day)) {
    if (day[d] !== 'Y') continue;
    const iso = monthKey + '-' + String(d).padStart(2, '0');
    if (uptoDate && iso > uptoDate) continue;          // settlement cap
    if (startDate || endDate) {
      if (startDate && iso < startDate) continue;
      if (endDate && iso > endDate) continue;
    }
    y++;
  }
  return y;
}

// Total 'Y' for a subscription across its whole life (bounded to [start,end]).
function attendedYForSub(m, sub, uptoDate) {
  const da = m && m.dailyAttendance;
  if (!da) return 0;
  let y = 0;
  for (const monthKey of Object.keys(da)) y += attendedYInMonth(m, sub.activity, monthKey, sub.start, sub.end, uptoDate);
  return y;
}

// The subscription (for a sport) that a given attendance date belongs to — so a
// renewed member's new present is counted against the NEW cycle, not the expired
// one. Prefers the sub whose [start,end] window CONTAINS the date; else the latest
// sub that started on/before it; else the earliest upcoming. Handles unordered
// subscription arrays (renewals aren't guaranteed to be pushed in date order).
function subForAttendanceDate(m, sport, dateISO) {
  const subs = (m && Array.isArray(m.subscriptions) ? m.subscriptions : []).filter(s => (s.activity || '') === sport);
  if (!subs.length) return null;
  const d = String(dateISO || '').slice(0, 10);
  const byStartDesc = (a, b) => String(b.start || '').localeCompare(String(a.start || ''));
  const containing = subs.filter(s => (!s.start || s.start <= d) && (!s.end || d <= s.end)).sort(byStartDesc);
  if (containing.length) return containing[0];
  const started = subs.filter(s => !s.start || s.start <= d).sort(byStartDesc);
  if (started.length) return started[0];
  return subs.slice().sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')))[0];
}

// ── Freeze-window helpers ─────────────────────────────────────────────────────
// Is the member paused (frozen) as of a specific date / month? Uses the freeze
// records (start–end) when present for MONTH-ACCURATE history (so a member frozen
// in July is NOT treated as frozen in June); falls back to the coarse
// currentFreezeUntil for legacy members that predate freeze records.
function memberFreezeSpans(m) {
  return (m && Array.isArray(m.freezes)) ? m.freezes.filter(f => f && f.start && f.end) : [];
}
function isMemberFrozenAt(m, dateStr) {
  if (!m || !dateStr) return false;
  const d = String(dateStr).slice(0, 10);
  const spans = memberFreezeSpans(m);
  if (spans.length) return spans.some(f => d >= String(f.start).slice(0, 10) && d <= String(f.end).slice(0, 10));
  return !!(m.currentFreezeUntil && d <= String(m.currentFreezeUntil).slice(0, 10));
}
function isMemberFrozenInMonth(m, ym) {
  if (!m || !ym) return false;
  const spans = memberFreezeSpans(m);
  if (spans.length) return spans.some(f => String(f.start).slice(0, 7) <= ym && ym <= String(f.end).slice(0, 7));
  return !!(m.currentFreezeUntil && ym <= String(m.currentFreezeUntil).slice(0, 7));
}

// Link an invoice line to its subscription row (for class count + attendance).
function findSubForLine(m, inv, li) {
  if (!m) return null;
  const subs = m.subscriptions || [];
  return subs.find(s => s.invoiceNumber === inv.ref && s.activity === li.sport)
      || subs.find(s => s.activity === li.sport && s.coachId === li.coachId)
      || null;
}

// ── Coach commission eligibility for ONE membership invoice line ──────────────
// Club rule (payment-basis):
//   • COMPLETED member → FULL fee (they finished all their classes).
//   • EXPIRED member who attended at least one class → FULL fee (they forfeited
//     the classes they didn't take; the coach still earns the whole fee).
//   • EVERYONE ELSE — Active, Frozen, Expired-with-no-class, Withdrawn, … → the
//     commission is PRO-RATED by attendance: attended ÷ total × price. A member
//     with zero attended classes earns the coach nothing.
// Returns { eligible, base, attended, total, status, ratio, mode }.
function lineCommissionEligibility(m, inv, li, uptoDate) {
  const price = parseFloat(li && li.price) || 0;
  // SUMMER CAMP earns the coach NO commission — ever (camp has no coach).
  if (li && li.sport === SUMMER_CAMP) {
    return { eligible: false, excluded: true, base: 0, attended: 0, total: 0, status: m ? memberStatus(m) : 'Active', ratio: 0, mode: 'camp' };
  }
  const status = m ? memberStatus(m) : 'Active';
  let attended = 0, total = 0;
  if (m) {
    const sub = findSubForLine(m, inv, li);
    if (sub) {
      total = subClassLimit(sub) || (parseInt(sub.totalClasses) || 0);
      attended = attendedYForSub(m, sub, uptoDate || null);
      if (!attended && sub.attendedClasses) attended = parseInt(sub.attendedClasses) || 0;
    } else {
      // The line didn't map to a specific subscription (e.g. a membership invoice
      // with no sport on the line). Derive attended ÷ total from the member's own
      // subscription(s) — preferring this line's coach (and sport, if given) — so
      // non-completed members STILL pro-rate by attendance instead of defaulting
      // to full just because the line carries no class count.
      const subs = Array.isArray(m.subscriptions) ? m.subscriptions : [];
      const sport = li && li.sport;
      const wantCoach = (li && li.coachId != null) ? li.coachId : (inv && inv.coachId);
      const subTotal = s => (subClassLimit(s) || parseInt(s.totalClasses) || 0);
      let relevant = subs.filter(s => subTotal(s) > 0
        && (!sport || (s.activity || '') === sport)
        && (wantCoach == null || s.coachId == null || s.coachId === wantCoach));
      if (!relevant.length) relevant = subs.filter(s => subTotal(s) > 0 && (!sport || (s.activity || '') === sport));
      for (const s of relevant) {
        total += subTotal(s);
        let a = attendedYForSub(m, s, uptoDate || null);
        if (!a && s.attendedClasses) a = parseInt(s.attendedClasses) || 0;
        attended += a;
      }
      if (total === 0) {                       // member truly has no class plan
        total = parseInt(li && li.classes) || 0;
        attended = attendedClassesFor(m, sport);
      }
    }
  }
  // COMPLETED → full fee.
  if (status === 'Completed') {
    return { eligible: price > 0, excluded: false, base: price, attended, total, status, ratio: 1, mode: 'full' };
  }
  // EXPIRED with ≥1 attended class → full fee.
  if (status === 'Expired' && attended >= 1) {
    return { eligible: price > 0, excluded: false, base: price, attended, total, status, ratio: 1, mode: 'full' };
  }
  // EXPIRED with ZERO attendance → never showed up: exclude from the coach report.
  if (status === 'Expired') {
    return { eligible: false, excluded: true, base: 0, attended, total, status, ratio: 0, mode: 'expired-noshow' };
  }
  // FROZEN → the membership is PAUSED. The coach earns ONLY the classes the member
  // has ACTUALLY attended (pro-rated attended ÷ total); the remaining/deferred
  // portion is NOT paid until they return, or the freeze ends and they expire (then
  // it trues up to full via the Expired rules above). Crucially, unlike an Active
  // member, a FROZEN membership with NO class plan (total unknown) does NOT default
  // to the full fee — a paused flat membership earns 0 until it resolves.
  if (status === 'Frozen') {
    const fratio = total > 0 ? Math.min(1, attended / total) : 0;
    const fbase = price * fratio;
    return { eligible: fbase > 0, excluded: false, base: fbase, attended, total, status, ratio: fratio, mode: 'frozen' };
  }
  // Everyone else (Active, …) → pro-rate by attendance.
  // With no class total to divide by, there is nothing to pro-rate against → full fee.
  const ratio = total > 0 ? Math.min(1, attended / total) : 1;
  const base = price * ratio;
  return { eligible: base > 0, excluded: false, base, attended, total, status, ratio, mode: 'prorated' };
}

// ── Per-member commission rows (for the admin Member Commission report) ───────
// One row per (member, sport) membership line. Summer Camp lines and expired-
// with-zero-attendance lines are dropped (no coach commission). Pass a billing
// month ('2026-06') to scope, or '' / 'all' for every month.
function computeMemberCommissions(ym) {
  const all = !ym || ym === 'all';
  const invs = all
    ? state.invoices.filter(i => (i.category || 'Membership') === 'Membership' && !i.deleted)
    : monthInvoicesAny(ym).filter(i => (i.category || 'Membership') === 'Membership');   // line-month aware: include multi-month invoices
  const rows = [];
  for (const inv of invs) {
    const mem = inv.customerId ? state.members.find(x => x.id === inv.customerId) : null;
    if (mem && mem.deleted) continue;
    const lineItems = commissionLineItems(inv, mem);
    for (const li of lineItems) {
      if (!all && lineBillMonth(li, inv) !== ym) continue;   // per-line month (a sport added later bills in its own month)
      const elig = lineCommissionEligibility(mem, inv, li, null);
      if (elig.excluded) continue;                       // camp + expired-no-show
      const coachId = (li.coachId != null) ? li.coachId : inv.coachId;
      const coach = (coachId != null) ? state.coaches.find(c => c.id === coachId) : null;
      const rate = coach ? (parseFloat(coach.rate) || 0) : 0;
      const sub = mem ? findSubForLine(mem, inv, li) : null;
      rows.push({
        invoiceId: inv.id, ref: inv.ref || '', month: lineBillMonth(li, inv),
        memberId: mem ? mem.id : null,
        memberName: mem ? (mem.name || '') : (inv.customerName || '—'),
        nameArabic: mem ? (mem.nameArabic || '') : '',
        sport: li.sport || '—',
        coachId,
        coachName: (coachId != null) ? coachName(coachId) : '—',
        start: (sub && sub.start) || inv.date || (inv.month ? inv.month + '-01' : ''),
        expiry: (mem && mem.expiryDate) || (sub && sub.end) || '',
        paid: parseFloat(li.price) || 0,
        attended: elig.attended || 0,
        total: elig.total || 0,
        status: elig.status,
        mode: elig.mode,
        ratio: elig.ratio || 0,
        commissionBase: elig.base || 0,
        rate,
        commission: (elig.base || 0) * rate / 100,
      });
    }
  }
  rows.sort((a, b) =>
    (a.memberName || '').localeCompare(b.memberName || '') ||
    (a.sport || '').localeCompare(b.sport || ''));
  return rows;
}

// Effective commission line items for an invoice. Usually the invoice's own
// lineItems — but a legacy / family invoice sometimes lumps SEVERAL enrolled sports
// into ONE sport-less line under a single coach. That hides the other coaches and
// defeats per-class attendance (their classes never get counted, and a frozen member
// dumps the whole fee on the wrong coach). When a line has no sport AND the member's
// per-sport ENROLLMENTS sum to that same total, expand into one line per enrolment
// (its own sport, coach, price, class count) so EVERY coach is credited and
// attendance is honoured. Revenue is unchanged — the parts sum to the invoice total.
function commissionLineItems(inv, mem) {
  const raw = (Array.isArray(inv.lineItems) && inv.lineItems.length)
    ? inv.lineItems
    : [{ sport: inv.sport, coachId: inv.coachId, price: inv.amount || 0 }];
  if (raw.some(li => li && li.sport)) return raw;                  // any per-sport info → trust the invoice
  const enr = (mem && Array.isArray(mem.enrollments)) ? mem.enrollments.filter(e => e && e.sport && (Number(e.price) || 0) > 0) : [];
  if (enr.length < 2) return raw;                                  // single sport → nothing to split
  const enrSum = enr.reduce((s, e) => s + (Number(e.price) || 0), 0);
  const invTot = raw.reduce((s, li) => s + (Number(li.price) || 0), 0);
  if (enrSum <= 0 || invTot <= 0) return raw;
  // Safety: the flat line must plausibly bundle THESE enrolments — its coach is one of
  // the enrolment coaches (or unset), and the totals are in the same ballpark — so we
  // never re-attribute an invoice whose enrolments have since changed.
  const flatCoaches = new Set(raw.map(li => li.coachId));
  const coachMatch = raw.some(li => li.coachId == null) || enr.some(e => flatCoaches.has(e.coachId));
  const ratio = invTot / enrSum;
  if (!coachMatch || ratio < 0.6 || ratio > 1.6) return raw;
  // Scale enrolment prices to the invoice total so revenue attribution stays exact
  // (e.g. a 50 QAR registration add-on spreads across the sports).
  const scale = invTot / enrSum;
  return enr.map(e => ({ sport: e.sport, coachId: e.coachId, price: (Number(e.price) || 0) * scale, classes: e.classes, _expandedFromEnrollment: true }));
}

// Returns { base, pendingBase, lines, pendingLines } for a coach in a month.
function computeAttendanceCommission(coachId, monthKey, uptoDate) {
  let base = 0, pendingBase = 0;
  const lines = [];        // earned this month (attended classes + expiry true-up)
  const pendingLines = []; // not-yet-earned remainder on still-active memberships
  // Commission start-date cutoff: ignore invoices/subscriptions dated before this.
  const commStart = (state.settings && state.settings.commissionStartDate) || '';
  for (const inv of state.invoices) {
    if ((inv.category || 'Membership') !== 'Membership') continue;
    const mem = inv.customerId ? state.members.find(x => x.id === inv.customerId) : null;
    if (mem && mem.deleted) continue;   // archived member → treated as not existing
    const lineItems = commissionLineItems(inv, mem);
    for (const li of lineItems) {
      if (li.coachId !== coachId) continue;
      if (mem && isExcludedFromCoachSalary(coachId, mem.id)) continue;   // excluded from this coach's salary
      if (li.sport === SUMMER_CAMP) continue;             // camp earns no commission
      const fee = parseFloat(li.price) || 0;
      const isSwitch = !!inv.switchCredit || inv.activityType === 'switch-credit' || fee < 0;
      let sub = findSubForLine(mem, inv, li);
      let totalClasses = (sub && parseFloat(sub.totalClasses)) || 0;
      // FALLBACK: a sport added to a member without a linked subscription row still
      // has an ENROLLMENT carrying its class count + coach. Synthesize a sub from it so
      // the coach still earns / pends by attendance — otherwise a class-based line with
      // no sub falls into the month-gated flat-fee path and the member silently vanishes
      // from the coach's salary report. (Root cause: adding a sport via the pricing panel
      // created the invoice line + enrolment but no subscription.)
      if (totalClasses <= 0 && !isSwitch && mem && Array.isArray(mem.enrollments)) {
        const enr = mem.enrollments.find(e => (e.sport || '') === li.sport
          && (e.coachId == null || li.coachId == null || e.coachId === li.coachId)
          && (parseInt(e.classes) || 0) > 0);
        if (enr) {
          totalClasses = parseInt(enr.classes) || 0;
          const _start = (sub && sub.start) || inv.date || (inv.month ? inv.month + '-01' : TODAY);
          const _end = (sub && sub.end) || (enr.validity ? addDays(_start, parseInt(enr.validity) || 0) : null);
          sub = { activity: li.sport, coachId: li.coachId, start: _start, end: _end, totalClasses, _synthFromEnrollment: true };
        }
      }
      // Apply the commission start-date cutoff: use the subscription start if present,
      // else the invoice date. Anything dated before the cutoff earns no commission.
      const anchor = (sub && sub.start) || inv.date || inv.month || '';
      if (commStart && anchor && String(anchor).slice(0, 10) < commStart) continue;
      const memberName = mem ? mem.name : (inv.customerName || '— deleted —');
      const status = mem ? memberStatus(mem) : '—';

      // SETTLE-PENDING: an admin paid this membership's commission IN FULL in
      // `settledMonth` (even though classes weren't finished). After that month the
      // coach earns nothing more for it, and it never pends or trues-up — so the
      // pending is not carried forward. `sub.commissionSettled` holds the month.
      const settledMonth = sub && sub.commissionSettled ? String(sub.commissionSettled).slice(0, 7) : null;
      const _refMonth = uptoDate ? String(uptoDate).slice(0, 7) : monthKey;
      if (settledMonth && _refMonth && _refMonth > settledMonth) continue;

      // A FROZEN membership is paused: the coach earns nothing for it while frozen —
      // the fee is DEFERRED (pending) until the member returns, or the freeze ends and
      // they expire (then it trues up). Computed here so BOTH the flat-fee fallback and
      // the per-class path below honour it. Only a genuinely EXPIRED membership trues up.
      const frozen = mem && (uptoDate ? isMemberFrozenAt(mem, uptoDate) : isMemberFrozenInMonth(mem, monthKey));

      // Fallback to PAYMENT basis: switch credits, and memberships with no class count.
      if (isSwitch || totalClasses <= 0) {
        const inWindow = uptoDate ? (inv.date && inv.date <= uptoDate) : (lineBillMonth(li, inv) === monthKey);
        if (inWindow) {
          if (frozen && !isSwitch) {
            // Frozen flat membership (no class plan) → defer the whole fee; the coach
            // is NOT paid the full amount while the member is frozen.
            pendingBase += fee;
            pendingLines.push({ memberName, sport: li.sport, classes: null, amountBase: fee,
              start: sub?.start || inv.date, end: sub?.end || null,
              attended: mem ? attendedClassesFor(mem, li.sport) : 0, total: totalClasses || null, status,
              note: 'frozen — pending until return / expiry' });
          } else {
            base += fee;
            lines.push({ memberName, sport: li.sport, kind: isSwitch ? 'switch' : 'flat',
              classes: null, amountBase: fee, start: sub?.start || inv.date, end: sub?.end || null,
              attended: mem ? attendedClassesFor(mem, li.sport) : 0, total: totalClasses || null, status,
              note: isSwitch ? 'switch credit' : 'no class count — full fee' });
          }
        }
        continue;
      }

      const perClass = fee / totalClasses;
      const ref = uptoDate || TODAY;

      if (uptoDate) {
        // ── SETTLEMENT (cumulative): everything earned from the start through the date ──
        const attended = attendedYForSub(mem, sub, uptoDate);
        const remaining = Math.max(0, totalClasses - attended);
        const ended = !frozen && sub.end && sub.end <= uptoDate;
        if (attended > 0) {
          base += perClass * attended;
          lines.push({ memberName, sport: li.sport, kind: 'attended', classes: attended, perClass,
            amountBase: perClass * attended, start: sub.start, end: sub.end, attended, total: totalClasses, status });
        }
        if (ended && remaining > 0 && !settledMonth) {   // expired by this date → pay the rest in full
          base += perClass * remaining;
          lines.push({ memberName, sport: li.sport, kind: 'trueup', classes: remaining, perClass,
            amountBase: perClass * remaining, start: sub.start, end: sub.end, attended, total: totalClasses, status,
            note: 'membership ended — remaining paid out' });
        }
        if (!ended && remaining > 0 && !settledMonth) {  // still active → remainder pending (unless settled in full)
          pendingBase += perClass * remaining;
          pendingLines.push({ memberName, sport: li.sport, classes: remaining, perClass,
            amountBase: perClass * remaining, start: sub.start, end: sub.end, attended, total: totalClasses, status });
        }
      } else {
        // ── MONTHLY: per-month attended + true-up only in the month the sub ended ──
        const attMonth = attendedYInMonth(mem, li.sport, monthKey, sub.start, sub.end);
        if (attMonth > 0) {
          base += perClass * attMonth;
          lines.push({ memberName, sport: li.sport, kind: 'attended', classes: attMonth, perClass,
            amountBase: perClass * attMonth, start: sub.start, end: sub.end, attended: attMonth, total: totalClasses, status });
        }
        const endMonth = _ymOf(sub.end);
        const ended = !frozen && sub.end && sub.end < TODAY;
        const attendedAll = attendedYForSub(mem, sub);
        const remaining = Math.max(0, totalClasses - attendedAll);
        if (endMonth === monthKey && ended && remaining > 0 && !settledMonth) {
          base += perClass * remaining;
          lines.push({ memberName, sport: li.sport, kind: 'trueup', classes: remaining, perClass,
            amountBase: perClass * remaining, start: sub.start, end: sub.end, attended: attendedAll, total: totalClasses, status,
            note: 'membership ended — remaining paid out' });
        }
        if (!ended && remaining > 0 && !settledMonth) {
          pendingBase += perClass * remaining;
          pendingLines.push({ memberName, sport: li.sport, classes: remaining, perClass,
            amountBase: perClass * remaining, start: sub.start, end: sub.end, attended: attendedAll, total: totalClasses, status });
        }
      }
    }
  }
  return { base, pendingBase, lines, pendingLines };
}

// Mark every ACTIVE membership that still has pending (unattended) commission for a
// coach as "settled in full" as of `monthKey`. After this, those memberships earn the
// coach nothing further and never carry a pending remainder — used when an admin pays
// a coach's full salary (incl. pending) in one month. Returns how many were settled.
function settleCoachPendingCommission(coachId, monthKey) {
  let count = 0;
  const commStart = (state.settings && state.settings.commissionStartDate) || '';
  for (const inv of (state.invoices || [])) {
    if (!inv || inv.deleted || (inv.category || 'Membership') !== 'Membership') continue;
    const mem = inv.customerId ? state.members.find(x => x.id === inv.customerId) : null;
    if (!mem || mem.deleted) continue;
    const lines = commissionLineItems(inv, mem);
    for (const li of lines) {
      if (li.coachId !== coachId) continue;
      if (li.sport === SUMMER_CAMP) continue;
      const sub = findSubForLine(mem, inv, li);
      if (!sub || sub.commissionSettled) continue;
      const anchor = (sub.start) || inv.date || inv.month || '';
      if (commStart && anchor && String(anchor).slice(0, 10) < commStart) continue;
      const total = (subClassLimit(sub) || parseInt(sub.totalClasses) || 0);
      if (total <= 0) continue;
      const remaining = Math.max(0, total - attendedYForSub(mem, sub));
      const ended = sub.end && sub.end < TODAY;
      const frozen = isMemberFrozenAt(mem, TODAY);
      if (ended || frozen || remaining <= 0) continue;   // only active memberships with a real pending remainder
      sub.commissionSettled = monthKey;
      count++;
    }
  }
  return count;
}

// ─── Coach salary payments (multi-payment ledger) ────────────────────────────
// A 'paid' salary record can now hold MULTIPLE payments (different dates/methods)
// toward a TARGET (the agreed payout — defaults to the computed net, but an admin
// may override it to add a bonus or deduct). These helpers normalise that and stay
// backward-compatible with the old single-payment record (paidDate/payMethod/
// snapshotNet, no payments[]).
function salaryPayments(rec) {
  if (!rec) return [];
  if (Array.isArray(rec.payments)) return rec.payments;
  // Legacy single-payment record (has paidDate, no payments[]). Its snapshotNet was
  // the NET at pay time, which can be NEGATIVE (the coach was over-advanced) — a
  // negative "payment" is nonsensical and corrupts paidTotal, so clamp at 0.
  if (rec.paidDate != null) return [{ id: 'legacy', amount: Math.max(0, rec.snapshotNet != null ? Number(rec.snapshotNet) : 0), date: rec.paidDate, method: rec.payMethod || 'cash', _legacy: true }];
  return [];
}
function salaryPaidTotal(rec) { return salaryPayments(rec).reduce((s, p) => s + (Number(p.amount) || 0), 0); }
// The agreed payout: explicit override, else a POSITIVE legacy snapshot, else the
// live computed net. A stale/negative snapshotNet (over-advanced legacy record) is
// ignored so the target reflects what the coach is actually owed now.
function salaryTarget(rec, netFallback) {
  if (rec && rec.target != null && rec.target !== '') return Number(rec.target);
  if (rec && rec.snapshotNet != null && Number(rec.snapshotNet) > 0.005) return Number(rec.snapshotNet);
  return netFallback;
}

function computeMonthlyPay(coachId, monthKey, uptoDate) {
  const c = state.coaches.find(x => x.id === coachId);
  if (!c) return null;
  // Settlement mode: when an "up to date" is given, we report that date's month
  // counting only what happened on or before it (a partial-month settlement).
  if (uptoDate) monthKey = String(uptoDate).slice(0, 7);
  const fixedFull = parseFloat(c.fixedSalary) || 0;
  const commissionRate = parseFloat(c.rate) || 0;
  const basis = (state.settings && state.settings.commissionBasis) || 'payment';
  let commissionBase = 0;
  let commissionPendingBase = 0;   // attendance basis only: paid-but-unattended remainder
  let attendanceLines = null;      // { lines, pendingLines } for the per-member report

  if (basis === 'attendance') {
    // Pay per class attended in the month; remainder pends / trues-up at expiry.
    const r = computeAttendanceCommission(coachId, monthKey, uptoDate);
    commissionBase = r.base;
    commissionPendingBase = r.pendingBase;
    attendanceLines = { lines: r.lines, pendingLines: r.pendingLines };
  } else {
    // Payment basis: whole fee counts in the invoice's month. In settlement mode
    // (uptoDate) sum ALL invoices dated on/before the date, across months.
    const commStartP = (state.settings && state.settings.commissionStartDate) || '';
    for (const inv of state.invoices) {
      // Commission start-date cutoff: skip invoices dated before it.
      const invAnchor = inv.date || (inv.month ? inv.month + '-01' : '');
      if (commStartP && invAnchor && String(invAnchor).slice(0, 10) < commStartP) continue;
      if (uptoDate) {
        if (!inv.date || inv.date > uptoDate) continue;     // cumulative up to date
      }
      // NOTE: single-month scoping is now done PER LINE (below), so a sport added in a
      // later month — carrying its own billMonth — earns its commission in THAT month,
      // matching where its revenue is billed. Single-month invoices are unaffected
      // (lineBillMonth falls back to the invoice month).
      const cat = inv.category || 'Membership';
      if (cat !== 'Membership') continue;
      if (inv.customerId) {
        const mem = state.members.find(x => x.id === inv.customerId);
        if (mem && mem.deleted) continue;   // archived member → treated as not existing
      }
      const memForLine = inv.customerId ? state.members.find(x => x.id === inv.customerId) : null;
      const lineItems = commissionLineItems(inv, memForLine);
      for (const li of lineItems) {
        if (li.sport === SUMMER_CAMP) continue;            // camp earns no commission
        if (li.coachId !== coachId) continue;
        if (!uptoDate && monthKey && lineBillMonth(li, inv) !== monthKey) continue;   // per-line month
        if (isExcludedFromCoachSalary(coachId, inv.customerId)) continue;
        // Attendance gate + frozen proration (the club rule).
        const elig = lineCommissionEligibility(memForLine, inv, li, uptoDate);
        if (elig.eligible) commissionBase += elig.base;
      }
    }
  }

  // Fixed salary: full month normally; prorated by days when settling to a date.
  let fixed = fixedFull;
  if (uptoDate && fixedFull > 0) {
    const y = parseInt(uptoDate.slice(0, 4), 10), mo = parseInt(uptoDate.slice(5, 7), 10);
    const day = parseInt(uptoDate.slice(8, 10), 10);
    const daysInMonth = new Date(y, mo, 0).getDate();
    fixed = Math.round(fixedFull * day / daysInMonth * 100) / 100;
  }

  const commissionAmount = commissionBase * commissionRate / 100;
  const commissionPending = commissionPendingBase * commissionRate / 100;
  const gross = fixed + commissionAmount;
  const advanceRecords = (state.salaries || [])
    .filter(s => s.coachId === coachId && s.kind === 'advance' && (uptoDate ? s.month <= monthKey : s.month === monthKey))
    .reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  // Salary payments logged on the Expenses screen (category "Salary") attributed
  // to this coach also count as money already handed over this month.
  const expensePaid = (state.expenses || [])
    .filter(e => !e.deleted && !e._salaryAutoExpense && isSalaryCategory(e.category) && String(e.coachId) === String(coachId)
      && (uptoDate ? (e.month || String(e.date || '').slice(0, 7)) <= monthKey : (e.month || String(e.date || '').slice(0, 7)) === monthKey))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const advance = advanceRecords + expensePaid;
  // Carry-forward of a prior month's over-advance (negative net). A 'carry' record
  // { kind:'carry', fromMonth, month:<target>, amount } moves an over-advance out of
  // its source month (CREDIT — settles that month's negative net back toward 0) and
  // into a later month (DEBIT — behaves like an opening advance there). Symmetric, so
  // the club's real cash total is unchanged and the "settle up to a date" cumulative
  // view stays exact (credit + debit cancel once both months are in scope).
  const carryRecords = (state.salaries || []).filter(s => s.coachId === coachId && s.kind === 'carry');
  const carriedOut = carryRecords
    .filter(s => uptoDate ? s.fromMonth <= monthKey : s.fromMonth === monthKey)
    .reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  const carriedIn = carryRecords
    .filter(s => uptoDate ? s.month <= monthKey : s.month === monthKey)
    .reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  const paidRecord = (state.salaries || [])
    .find(s => s.coachId === coachId && s.month === monthKey && s.kind === 'paid');

  const net = gross - advance + carriedOut - carriedIn;
  // Multi-payment settlement: sum the payments made toward the agreed target.
  const payments = salaryPayments(paidRecord);
  const paidTotal = salaryPaidTotal(paidRecord);
  const paidTarget = paidRecord ? salaryTarget(paidRecord, net) : net;
  // Settlement tolerance: a coach is paid in WHOLE QAR (the payment box defaults to a
  // rounded amount), but a commission target is often fractional (e.g. 30% × 391 =
  // 117.3). Treat any gap under 1 QAR as fully settled so paying the default amount
  // marks the month PAID instead of sticking at "partial · 0.30 remaining".
  const PAY_EPS = 0.5;
  const _rem = paidTarget - paidTotal;
  const paidRemaining = _rem > PAY_EPS ? _rem : 0;
  let paidStatus = 'pending';
  if (paidRecord) {
    if (paidTotal >= paidTarget - PAY_EPS && paidTotal > 0.005) paidStatus = 'paid';
    else if (paidTotal > 0.005) paidStatus = 'partial';   // some — but not all — paid
    else paidStatus = 'pending';
  }
  const paidDate = payments.length ? payments[payments.length - 1].date : (paidRecord ? paidRecord.paidDate : null);

  return {
    coachId, month: monthKey,
    uptoDate: uptoDate || null,
    fixedFull,
    name: c.name,
    role: c.role || 'coach',
    fixed,
    commissionBase,
    commissionRate,
    commissionAmount,
    basis,
    commissionPendingBase,
    commissionPending,
    attendanceLines,
    gross,
    advance,
    advanceRecords,
    expensePaid,
    carriedOut,
    carriedIn,
    net,
    salaryRecord: paidRecord || null,
    payments,
    paidTotal,
    paidTarget,
    paidRemaining,
    paidDate,
    paidStatus,
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
// `opts` may carry { start, end } to freeze a specific date range (e.g. 18 Jun →
// 1 Sep) instead of starting today; if given, `days` is derived from the range.
function applyFreeze(m, days, reason, opts) {
  opts = opts || {};
  let startDate = opts.start || TODAY;
  let endDate, frozenDays;
  if (opts.start && opts.end) {
    endDate = opts.end;
    frozenDays = Math.max(1, daysBetween(opts.start, opts.end));
  } else {
    frozenDays = parseInt(days);
    if (!m || !frozenDays || frozenDays < 1) return;
    endDate = addDays(startDate, frozenDays);
  }
  if (!m) return;
  if (!m.freezes) m.freezes = [];
  m.freezes.push({
    id: 'fr_' + Date.now(),
    days: frozenDays,
    start: startDate,
    end: endDate,
    reason: reason || '',
    appliedAt: new Date().toISOString(),
    previousExpiry: m.expiryDate,
  });
  m.currentFreezeUntil = endDate;
  // Shift expiry forward by the freeze duration.
  if (m.expiryDate) m.expiryDate = addDays(m.expiryDate, frozenDays);
  // Shift each subscription's end too so per-sport expiry stays in sync.
  for (const sub of (m.subscriptions || [])) {
    if (sub.end) sub.end = addDays(sub.end, frozenDays);
  }
  // Extend each enrolment's validity window by the freeze days so the stored
  // validity period reflects the pause too (keeps expiry recomputation correct).
  for (const e of (m.enrollments || [])) {
    if (e.validity != null && e.validity !== '') e.validity = (parseInt(e.validity) || 0) + frozenDays;
  }
  stampUpdate(m);
  audit('member.freeze', `member:${m.id}`, `Froze ${m.name} for ${frozenDays} day(s) (${startDate} → ${endDate})${reason ? ' · ' + reason : ''}`, {
    name: m.name, memberId: m.id, membershipNo: m.membershipNo || m.qid || '', mobile: m.phone || '',
    new: { frozenUntil: endDate, days: frozenDays, reason: reason || '' },
  });
}

// The membership validity in days — the longest enrolment validity, falling back
// to the current cycle length. Used to size the self-service freeze allowance.
function memberValidityDays(m) {
  let v = 0;
  for (const e of (m?.enrollments || [])) v = Math.max(v, parseInt(e.validity) || 0);
  if (!v && m?.startDate && m?.expiryDate) v = daysBetween(m.startDate, m.expiryDate);
  return v || 30;
}

// Self-service freeze allowance: ONE WEEK (7 days) per 30 days of validity
// (30d→7, 60d→14, 90d→21 …), tracked per current membership cycle (renewing
// resets it). Members may freeze MULTIPLE times as long as the total stays
// within the allowance; each freeze can be any number of days up to whatever
// allowance remains.
const FREEZE_DAYS_PER_MONTH = 7;
function freezeAllowance(m) {
  const validityDays = memberValidityDays(m);
  const months = Math.max(1, Math.round(validityDays / 30));   // 1-month plans → 1 week
  const allowanceDays = months * FREEZE_DAYS_PER_MONTH;
  const cycleStart = m?.startDate || m?.firstRegistration || '0000-00-00';
  let usedDays = 0;
  let freezeCount = 0;
  for (const f of (m?.freezes || [])) {
    if ((f.start || '') >= cycleStart) { usedDays += (parseInt(f.days) || 0); freezeCount++; }
  }
  const remainingDays = Math.max(0, allowanceDays - usedDays);
  return { validityDays, months, allowanceDays, usedDays, remainingDays, freezeCount, cycleStart, perRequestCap: remainingDays };
}

function nextId(arr) {
  // COLLISION-SAFE new-record id. A plain max+1 makes two devices that create a
  // record at the same moment pick the SAME id — and since each record is its own
  // Firestore doc written with merge:true, the two then fuse into one document and
  // one person's record is silently lost. So we mint a TIME-BASED unique number
  // (ms × 1000 + random), always kept above any existing id. It stays numeric,
  // sortable and a safe JS integer, so every id lookup / reference keeps working.
  const list = Array.isArray(arr) ? arr : [];
  const maxExisting = list.length ? Math.max(0, ...list.map(x => Number(x && x.id) || 0)) : 0;
  const unique = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  return unique > maxExisting ? unique : maxExisting + 1;
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
        const hay = [m.name, m.nameArabic, m.phone, m.phone2, m.qid].filter(Boolean).join(' ').toLowerCase();
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
  // Clamp the current page into range first. Otherwise, if a filter/deletion
  // shrinks the result set below the current page (e.g. you were on page 5 and now
  // there's only 1 page), the slice would fall past the end and show an empty table.
  const totalPages = Math.max(1, Math.ceil(rows.length / pg.size));
  if (pg.page > totalPages) pg.page = totalPages;
  if (pg.page < 1) pg.page = 1;
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

// Convenience wrapper used by Products / Sales / Rentals: takes the container
// element id (e.g. 'prod-pagination'), renders the bar into it, and wires the
// controls. The logical pager id is the element id without the '-pagination'
// suffix ('prod', 'sale', 'rent'), which is what paginationBar/bindPagination key on.
function renderPagination(elId, pg, totalCount, onChange) {
  const logical = String(elId).replace(/-pagination$/, '');
  const el = document.getElementById(elId);
  if (el) el.innerHTML = paginationBar(pg, totalCount, logical);
  bindPagination(logical, pg, totalCount, onChange);
}

let toastTimer;
// ─── AUDIT LOG ─────────────────────────────────────────────────────
// Records significant actions so admin can trace "who changed what, when".
// Lightweight: just an in-array log capped at 1000 entries (oldest dropped).
// Hook into delete/restore, withdraw, refunds, expense edits, salary marks,
// member edits — any action that affects money or membership state.
// ── Current-user identity + record stamping ─────────────────────
// Short login id (email/username) and full display name of whoever is acting.
function currentUserId() { return (state.user && (state.user.username || state.user.email)) || 'system'; }
function currentUserName() { return (state.user && state.user.name) || currentUserId(); }
// Stamp a record with who/when last modified it (and created it the first time),
// so the UI can show "last updated by X at Y" without opening the Audit Log.
// Used across members, invoices, payments, attendance, freeze and user accounts.
function stampUpdate(rec) {
  if (!rec || typeof rec !== 'object') return rec;
  const now = new Date().toISOString();
  if (!rec.createdAt) { rec.createdAt = now; rec.createdBy = currentUserId(); rec.createdByName = currentUserName(); }
  rec.updatedAt = now;
  rec.updatedBy = currentUserId();
  rec.updatedByName = currentUserName();
  return rec;
}
// Human "last updated by X · <date>" line for a stamped record (or '' if none).
function lastUpdatedLine(rec) {
  if (!rec || !rec.updatedAt) return '';
  const who = rec.updatedByName || rec.updatedBy || 'unknown';
  return `${who} · ${typeof fmtDateTime === 'function' ? fmtDateTime(rec.updatedAt) : rec.updatedAt}`;
}

function audit(action, target, summary, details = null) {
  if (!Array.isArray(state.auditLog)) state.auditLog = [];
  const tgt = String(target || '');
  const colon = tgt.indexOf(':');
  const recType = colon >= 0 ? tgt.slice(0, colon) : (action || '').split('.')[0];
  const recId = colon >= 0 ? tgt.slice(colon + 1) : '';
  const d = details || {};
  state.auditLog.push({
    id: 'al_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    ts: new Date().toISOString(),
    user: currentUserId(),                         // login id / email
    userName: currentUserName(),                   // full display name
    role: (typeof currentRole === 'function' ? currentRole() : (state.user?.role || 'admin')),
    action,                                        // e.g. 'member.archive', 'invoice.payments'
    module: (action || '').split('.')[0],          // e.g. 'member', 'invoice', 'attendance'
    target,                                        // e.g. 'member:42', 'invoice:107'
    recType, recId,                                // parsed from target
    recordName: d.name || d.recordName || d.member || d.memberName || d.customer || d.customerName || '',
    summary,                                       // short human description
    oldValue: (d.old !== undefined ? d.old : (d.oldValue !== undefined ? d.oldValue : null)),
    newValue: (d.new !== undefined ? d.new : (d.newValue !== undefined ? d.newValue : null)),
    details,                                       // optional object with extra context
  });
  // NO cap / trimming: the audit trail is IMMUTABLE and append-only (req #8) —
  // dropping oldest entries would delete synced Firestore docs, which the
  // immutable-audit security rule now forbids anyway. Entries live forever.
}

// ─── CREATE-AUDIT for invoices & expenses (traceability for the revenue stream) ──
// Invoices are the main revenue stream, so every new invoice/expense gets a
// 'invoice.create' / 'expense.create' audit entry — CENTRALLY, on save(), so no
// creation site can be missed. If a record ever goes missing, the audit log still
// proves it existed (id, ref, amount, who, when) so it can be reconstructed.
// Records that ARRIVED from another device via the sync merge are pre-marked
// "known" (see mergeRemoteIntoState) so we never attribute them to this device.
function _seedKnownRecIds() {
  window.__knownRecIds = {
    invoices: new Set((state.invoices || []).map(r => String(r.id))),
    expenses: new Set((state.expenses || []).map(r => String(r.id))),
  };
}
function _auditNewRecords() {
  if (typeof audit !== 'function') return;
  if (window.__allowEmptySave) return;          // a restore / clear-all — not real creations
  if (!window.__knownRecIds) { _seedKnownRecIds(); return; }   // first pass → seed baseline, don't audit history
  const K = window.__knownRecIds;
  for (const inv of (state.invoices || [])) {
    const id = String(inv.id);
    if (K.invoices.has(id)) continue;
    K.invoices.add(id);
    const mem = inv.customerId ? (state.members || []).find(m => m.id === inv.customerId) : null;
    const who = mem ? mem.name : (inv.customerName || '—');
    const amt = (typeof invoiceTotal === 'function') ? invoiceTotal(inv) : (Number(inv.amount) || 0);
    try { audit('invoice.create', 'invoice:' + id, `Created ${inv.ref || ('#' + id)} · ${fmt(amt)} QAR · ${who}`, { recordName: who, amount: amt, ref: inv.ref, category: inv.category }); } catch (_) {}
  }
  for (const e of (state.expenses || [])) {
    const id = String(e.id);
    if (K.expenses.has(id)) continue;
    K.expenses.add(id);
    try { audit('expense.create', 'expense:' + id, `Created expense · ${fmt(Number(e.amount) || 0)} QAR · ${e.category || 'Others'}`, { amount: Number(e.amount) || 0, category: e.category, description: e.description }); } catch (_) {}
  }
}

// Common status/toast messages → Arabic. This lets short, exact-match toasts
// localize centrally without editing every call site. Interpolated messages
// (with ${...}) still need t() at the call site. Extend this map as needed.
const TOAST_AR = {
  'Member not found': 'العضو غير موجود',
  'Invoice not found': 'الفاتورة غير موجودة',
  'Coach not found': 'المدرب غير موجود',
  'Subscription not found': 'الاشتراك غير موجود',
  'Name required': 'الاسم مطلوب',
  'Admins only': 'للمسؤولين فقط',
  'Admins or receptionists only': 'للمسؤولين أو موظفي الاستقبال فقط',
  'Only an admin can perform this action': 'هذا الإجراء متاح للمسؤول فقط',
  'Only an admin can clear the schedule': 'مسح الجدول متاح للمسؤول فقط',
  'Only an admin can freeze a membership': 'تجميد الاشتراك متاح للمسؤول فقط',
  'No active members selected': 'لم يتم اختيار أعضاء نشطين',
  'No selected members have phone numbers': 'لا توجد أرقام هواتف للأعضاء المحددين',
  'Customer has no phone number on file': 'لا يوجد رقم هاتف مسجّل للعميل',
  'Enter a valid amount': 'أدخل مبلغاً صحيحاً',
  'Email format is invalid': 'صيغة البريد الإلكتروني غير صحيحة',
  'Birthdate cannot be in the future': 'تاريخ الميلاد لا يمكن أن يكون في المستقبل',
  'Use at least 6 characters': 'استخدم 6 أحرف على الأقل',
  'Walk-in customer name required': 'اسم العميل المباشر مطلوب',
  'This member has no sports enrolled yet': 'هذا العضو غير مسجّل في أي رياضة بعد',
  'This member has no invoices': 'لا توجد فواتير لهذا العضو',
  'No attendance recorded yet for this member': 'لا يوجد حضور مسجّل لهذا العضو بعد',
  'The end date must be after the start date': 'يجب أن يكون تاريخ الانتهاء بعد تاريخ البداية',
  'Tick at least 2 invoices to merge': 'حدّد فاتورتين على الأقل للدمج',
  'Merge failed': 'فشل الدمج',
  'Nothing to recalculate': 'لا يوجد ما يُعاد حسابه',
  'Nothing to re-sync': 'لا يوجد ما تتم إعادة مزامنته',
  'Popup blocked — please allow popups': 'تم حظر النافذة المنبثقة — يرجى السماح بالنوافذ المنبثقة',
  'Allow pop-ups to print': 'اسمح بالنوافذ المنبثقة للطباعة',
  'Image export failed — try the PDF instead': 'فشل تصدير الصورة — جرّب ملف PDF بدلاً منها',
  'Refreshed': 'تم التحديث',
  'Saved': 'تم الحفظ',
  'Member saved': 'تم حفظ العضو',
  'Trial deleted': 'تم حذف الحصة التجريبية',
  'Trials exported': 'تم تصدير الحصص التجريبية',
  'Templates restored to defaults': 'تمت استعادة القوالب الافتراضية',
  '✓ Password updated': '✓ تم تحديث كلمة المرور',
  '✓ Cash collection deleted': '✓ تم حذف التحصيل النقدي',
  '💬 Reminder templates saved': '💬 تم حفظ قوالب التذكير',
  'Write some advice first': 'اكتب بعض الملاحظات أولاً',
  'Summer Camp schedule reset': 'تمت إعادة ضبط جدول المعسكر الصيفي',
  'Summer Camp prices reset to defaults': 'تمت إعادة أسعار المعسكر الصيفي إلى الافتراضي',
  'Demo data loaded': 'تم تحميل البيانات التجريبية',
};

function toast(msg, type = 'success') {
  if (typeof msg === 'string' && getLang() === 'ar' && TOAST_AR[msg]) msg = TOAST_AR[msg];
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
  const userLabel = isCloud ? t('Email or mobile number', 'البريد الإلكتروني أو رقم الجوال') : t('Username', 'اسم المستخدم');
  const userPlaceholder = isCloud ? 'admin@blackstars.qa  or  55512345' : 'admin';
  const userDefault = isCloud ? '' : 'admin';
  const passDefault = isCloud ? '' : 'admin123';
  const hint = isCloud
    ? t('Staff: use your email + password. Members: use your mobile number (password is your mobile number the first time).',
        'الموظفون: استخدم بريدك وكلمة المرور. الأعضاء: استخدم رقم جوالك (كلمة المرور هي رقم جوالك في أول مرة).')
    : t('Default: admin / admin123', 'الافتراضي: admin / admin123');
  card.innerHTML = `
    <div style="text-align:${getLang() === 'ar' ? 'left' : 'right'}"><button id="login-lang" class="btn ghost" style="padding:3px 10px;font-size:12px">${getLang() === 'ar' ? 'English' : 'العربية'}</button></div>
    <div class="login-logo" style="background-image:url('${BRAND_LOGO}');background-size:cover;background-position:center;font-size:0"></div>
    <h1>Black Stars CRM</h1>
    <div class="subtitle">${t('Sports Club · Waab, Doha', 'نادي رياضي · الوعب، الدوحة')}</div>
    ${cloudBadge}
    <div class="field" style="margin-top:14px">
      <label>${userLabel}</label>
      <input id="login-user" type="text" value="${userDefault}" placeholder="${userPlaceholder}" autofocus />
    </div>
    <div class="field">
      <label>${t('Password', 'كلمة المرور')}</label>
      <input id="login-pass" type="password" value="${passDefault}" />
    </div>
    <button class="btn primary full lg" id="login-btn">${t('Sign in', 'تسجيل الدخول')}</button>
    <div class="text-mute mt-3" style="text-align:center;font-size:11px">
      ${hint}
    </div>
  `;
  root.append(card);
  document.body.append(root);
  const langToggle = card.querySelector('#login-lang');
  if (langToggle) langToggle.addEventListener('click', () => { setLang(getLang() === 'ar' ? 'en' : 'ar'); loginScreen(); });

  const doLogin = async () => {
    const raw = $('#login-user').value.trim();
    const p = $('#login-pass').value;
    // A phone-like entry (digits, no "@") is a member mobile login → synthetic email.
    const looksPhone = !raw.includes('@') && raw.replace(/\D/g, '').length >= 6;
    const btn = $('#login-btn');
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    try {
      let user;
      if (looksPhone) {
        // Try the number with and without the 974 country code, and the password
        // both as typed and canonicalised — so members get in however they type it.
        const d = raw.replace(/\D/g, '');
        const canon = canonicalMobile(raw);
        const digitForms = [...new Set([canon, d, d.startsWith('974') ? d : ('974' + d)])];
        // Build candidate emails across BOTH the current domain and the legacy one,
        // so members provisioned under either domain can still sign in.
        const emails = [];
        for (const dom of MEMBER_EMAIL_DOMAINS) for (const x of digitForms) emails.push(x + '@' + dom);
        const passwords = [...new Set([p, canonicalMobile(p)])];
        let lastErr;
        for (const em of emails) {
          for (const pw of passwords) {
            try { user = await window.Storage.signIn(em, pw); break; } catch (err) { lastErr = err; }
          }
          if (user) break;
        }
        if (!user) throw lastErr || new Error('Invalid credentials');
      } else {
        user = await window.Storage.signIn(raw, p);
      }
      state.user = { username: user.email, name: 'Administrator', role: 'admin', email: user.email };
      if (window.Storage.isCloud()) await load();
      // App-level access revoke: account exists in Firebase but admin disabled it.
      const _map = (state.settings && state.settings.userRoles) || {};
      const _me = _map[(user.email || '').toLowerCase()];
      if (_me && _me.disabled) {
        await window.Storage.signOut().catch(() => {});
        state.user = null;
        toast('This account\u2019s access has been revoked. Please contact the club.', 'error');
        btn.disabled = false; btn.textContent = 'Sign in';
        return;
      }
      const resolved = roleForEmail(user.email);
      let name = 'Administrator';
      if (resolved.role === 'coach') {
        // Heal a missing/stale coach link by matching the login email to a coach's
        // email — so the account still scopes correctly even if the admin forgot
        // to pick a coach (or the coach record was recreated with a new id).
        let cid = (resolved.coachId != null && state.coaches.some(c => c.id === resolved.coachId)) ? resolved.coachId : null;
        if (cid == null) {
          const em = (user.email || '').trim().toLowerCase();
          const byEmail = em ? state.coaches.find(c => (c.email || '').trim().toLowerCase() === em) : null;
          if (byEmail) cid = byEmail.id;
        }
        resolved.coachId = cid;
        name = cid != null ? coachName(cid) : 'Coach (unlinked)';
      }
      else if (resolved.role === 'student') { const mm = state.members.find(m => m.id === resolved.memberId); name = (mm && mm.name) || 'Member'; }
      state.user = { username: user.email, name, role: resolved.role, email: user.email, coachId: resolved.coachId, memberId: resolved.memberId };
      state.session = { role: resolved.role, coachId: resolved.coachId, memberId: resolved.memberId };
      // Land on this role's own home, not whatever route was left over.
      state.route = roleHome(resolved.role);
      // Still on the default password? True if a member typed their mobile as the
      // password — whether they signed in by mobile OR by their email.
      let stillDefault = looksPhone && canonicalMobile(p) === canonicalMobile(raw);
      if (!stillDefault && resolved.role === 'student' && resolved.memberId != null) {
        const mm = state.members.find(x => x.id === resolved.memberId);
        const mob = mm ? canonicalMobile(mm.phone) : '';
        if (mob && mob.length >= 6 && canonicalMobile(p) === mob) stillDefault = true;
      }
      render();
      try { _idleReset(); } catch (_) {}   // start the idle auto-logout timer
      // Claim/observe the single-writer session lock now that we know who's in.
      try { if (typeof SessionLock !== 'undefined') SessionLock.start(); } catch (_) {}
      if (stillDefault && typeof window.promptPasswordChange === 'function') window.promptPasswordChange(true);
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
  _idleStop();
  await window.Storage.signOut();
  state.user = null;
  loginScreen();
}

// ─── Idle session guard ──────────────────────────────────────────────
// After N minutes with NO activity (N = state.settings.idleLogoutMin, admin-
// configurable, default 10; 0 = never), a dialog asks "Continue session or Log
// out?". An ACTIVE user is never interrupted — any click / keypress / mouse move
// resets the clock, so the dialog only appears when the device is genuinely idle.
// If the dialog is ignored, a grace countdown signs the user out (so a walked-away
// device still locks). Pending cloud writes are flushed before sign-out.
const IDLE_DEFAULT_MIN = 10;             // default idle minutes when nothing is configured
const IDLE_GRACE_MS = 60 * 1000;         // once the dialog shows, auto sign-out after this if ignored
let _idleTimer = null, _idleGraceIv = null, _idleWarning = false;
function _idleMin() {
  const v = (typeof state !== 'undefined' && state && state.settings) ? state.settings.idleLogoutMin : undefined;
  if (v === undefined || v === null || v === '') return IDLE_DEFAULT_MIN;
  const n = Number(v);
  return (isNaN(n) || n < 0) ? IDLE_DEFAULT_MIN : n;
}
function _idleSignedIn() { return !!(typeof state !== 'undefined' && state && state.user); }
function _idleClearWarn() {
  _idleWarning = false;
  if (_idleGraceIv) { clearInterval(_idleGraceIv); _idleGraceIv = null; }
  try { const el = document.getElementById('idle-warn'); if (el) el.remove(); } catch (_) {}
}
function _idleStop() { clearTimeout(_idleTimer); _idleTimer = null; _idleClearWarn(); }
function _idleExpire() {
  _idleStop();
  try { if (window.Storage && window.Storage.flushPending) window.Storage.flushPending(); } catch (_) {}
  try { logout(); } catch (_) {}
  try { toast(t('Signed out for inactivity', 'تم تسجيل الخروج لعدم النشاط'), 'info'); } catch (_) {}
}
function _idleWarn() {
  if (!_idleSignedIn()) return;
  _idleClearWarn();
  _idleWarning = true;                   // a decision is pending — activity no longer auto-resets
  let secs = Math.round(IDLE_GRACE_MS / 1000);
  const el = document.createElement('div');
  el.id = 'idle-warn';
  el.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px';
  el.innerHTML = `<div style="background:var(--surface,#fff);color:var(--text,#16202e);max-width:400px;width:100%;border-radius:14px;box-shadow:0 16px 50px rgba(0,0,0,.4);padding:22px;text-align:center">
    <div style="font-size:34px;margin-bottom:6px">🔒</div>
    <div style="font-size:17px;font-weight:800;margin-bottom:6px">${t('Are you still there?', 'هل ما زلت موجوداً؟')}</div>
    <div style="font-size:13px;color:var(--text-mute,#5c6b7f);line-height:1.5;margin-bottom:16px">${t('Your session has been idle for', 'جلستك خاملة منذ')} ${_idleMin()} ${t('minutes', 'دقيقة')}. ${t('Auto sign-out in', 'تسجيل خروج تلقائي خلال')} <b id="idle-count">${secs}</b>s.</div>
    <div style="display:flex;gap:10px">
      <button id="idle-logout" style="flex:1;background:transparent;color:var(--red,#c0392b);border:1px solid var(--red,#c0392b);border-radius:9px;padding:11px;font-weight:700;cursor:pointer">${t('Log out', 'تسجيل الخروج')}</button>
      <button id="idle-continue" style="flex:2;background:var(--green,#12724a);color:#fff;border:none;border-radius:9px;padding:11px;font-weight:700;cursor:pointer">${t('Continue session', 'متابعة الجلسة')}</button>
    </div>
  </div>`;
  document.body.appendChild(el);
  try { el.querySelector('#idle-continue').addEventListener('click', () => { _idleClearWarn(); _idleReset(); }); } catch (_) {}
  try { el.querySelector('#idle-logout').addEventListener('click', _idleExpire); } catch (_) {}
  _idleGraceIv = setInterval(() => {
    secs -= 1;
    const c = document.getElementById('idle-count'); if (c) c.textContent = String(Math.max(0, secs));
    if (secs <= 0) _idleExpire();
  }, 1000);
}
function _idleReset() {
  if (_idleWarning) return;   // a Continue/Log-out decision is pending — don't silently reset
  clearTimeout(_idleTimer); _idleTimer = null;
  if (!_idleSignedIn()) return;                 // no timer on the login screen
  const min = _idleMin();
  if (!(min > 0)) return;                        // 0 / disabled → never auto sign-out
  _idleTimer = setTimeout(_idleWarn, min * 60 * 1000);
}
window._idleReset = _idleReset;   // (re)started after login, on init, and when the setting changes
(function _wireIdleActivity() {
  if (typeof document === 'undefined' || !document.addEventListener) return;
  ['mousedown', 'keydown', 'click', 'touchstart'].forEach(ev => document.addEventListener(ev, _idleReset, { passive: true, capture: true }));
  // Throttle high-frequency events so we don't reset the timer on every pixel of movement.
  let _last = 0;
  const throttled = () => { const now = Date.now(); if (now - _last > 2000) { _last = now; _idleReset(); } };
  ['mousemove', 'scroll', 'wheel'].forEach(ev => document.addEventListener(ev, throttled, { passive: true, capture: true }));
})();

// ─── Routes ──────────────────────────────────────────────────────────
const ROUTES = {
  mymembership: { label: 'My Membership', icon: '🪪', section: 'Main', memberOnly: true },
  coachhome:  { label: 'My Dashboard', icon: '🧑‍🏫', section: 'Main', coachOnly: true },
  coachsalary: { label: 'My Salary', icon: '💰', section: 'Main', coachOnly: true },
  dashboard:  { label: 'Dashboard',  icon: '📊', section: 'Main' },
  reports:    { label: 'Reports',    icon: '📈', section: 'Main' },
  notes:      { label: 'Notes & Reminders', icon: '📝', section: 'Main', badge: () => dueNotesCount() },
  members:    { label: 'Members',    icon: '👥', section: 'Membership' },
  families:   { label: 'Families',   icon: '👨‍👩‍👧', section: 'Membership' },
  history:    { label: 'History',    icon: '📜', section: 'Membership' },
  schedule:   { label: 'Schedule',   icon: '🗓', section: 'Activities' },
  swimgroups: { label: 'Swimming Groups', icon: '🏊', section: 'Activities' },
  campschedule: { label: 'Summer Camp', icon: '☀️', section: 'Summer Camp', hidden: true },
  campmembers: { label: 'Camp Members', icon: '🚌', section: 'Summer Camp', badge: () => campExpiringSoonCount() },
  campdrivers: { label: 'Drivers', icon: '🚐', section: 'Summer Camp' },
  camproutes: { label: 'Driver Students', icon: '🧒', section: 'Summer Camp' },
  expiring:   { label: 'Expiring',   icon: '⏰', section: 'Membership' },
  duepayment: { label: 'Due Payment', icon: '💰', section: 'Membership' },
  reminders:  { label: 'Reminders',  icon: '🔔', section: 'Membership', adminOnly: true },
  birthdays:  { label: 'Birthdays',   icon: '🎂', section: 'Membership' },
  trials:     { label: 'Trials',     icon: '🎁', section: 'Membership' },
  transfers:  { label: 'Transfer Membership', icon: '🔁', section: 'Membership', adminOnly: true },
  onboarding: { label: 'Portal Onboarding', icon: '📲', section: 'Membership' },
  rentals:    { label: 'Rentals',    icon: '🏟', section: 'Activities' },
  coaches:    { label: 'Staff',      icon: '🥋', section: 'Team & Sports' },
  attendance: { label: 'Attendance', icon: '✓',  section: 'Activities' },
  coachattendance: { label: 'Attendance Report', icon: '📋', section: 'Activities', coachOnly: true },
  advice:     { label: 'Coach Advice', icon: '💬', section: 'Activities' },
  posts:      { label: 'Advice & Articles', icon: '📢', section: 'Activities' },
  invoices:   { label: 'Invoices',   icon: '📄', section: 'Finance' },
  dupinvoices:{ label: 'Duplicate Invoices', icon: '🔍', section: 'Finance', adminOnly: true },
  cashcollection: { label: 'Cash Collection', icon: '💵', section: 'Finance' },
  cashinhand: { label: 'Cash in Hand', icon: '🧮', section: 'Finance' },   // admin + receptionist (via ROLE_ALLOWED); front-desk cash management
  bankaccount: { label: 'Bank Account', icon: '🏦', section: 'Finance', adminOnly: true, hidden: true },
  reconciliation: { label: 'Reconciliation', icon: '⚖️', section: 'Finance', adminOnly: true, hidden: true },
  expenses:   { label: 'Expenses',   icon: '💸', section: 'Finance' },
  salaries:   { label: 'Salaries',   icon: '💰', section: 'Finance' },
  citadel:    { label: 'Citadel',    icon: '🏛', section: 'Finance', adminOnly: true },
  products:   { label: 'Products',   icon: '📦', section: 'Finance' },
  productsales:{ label: 'Product Sales', icon: '📊', section: 'Finance' },
  dashboardkpi: { label: 'Owner Dashboard', icon: '📊', section: 'Insights', adminOnly: true, hidden: true },
  monthlyreport: { label: 'Monthly Report', icon: '🗓', section: 'Insights', adminOnly: true },
  payanalysis:{ label: 'Payments Analysis', icon: '💳', section: 'Insights', hidden: true },
  coachperf:  { label: 'Coach Performance', icon: '📊', section: 'Insights' },
  clubrevenue:{ label: 'Club Revenue Summary', icon: '💼', section: 'Insights', hidden: true },
  moneyflow:  { label: 'Financial Overview', icon: '💰', section: 'Insights', adminOnly: true, hidden: true },
  transactions:{ label: 'Transactions', icon: '🧾', section: 'Insights' },
  missinginvoices: { label: 'Missing Invoices', icon: '🧩', section: 'Insights', adminOnly: true, hidden: true },   // folded into Invoice Integrity (still deep-linkable)
  invoicechecker: { label: 'Invoice Integrity', icon: '🔎', section: 'Insights', adminOnly: true },
  membercommission: { label: 'Member Commission', icon: '🧾', section: 'Insights', adminOnly: true, hidden: true },
  renewals:   { label: 'Renewals',   icon: '🔄', section: 'Insights' },
  renewaldetail: { label: 'Renewal Potential', icon: '💰', section: 'Insights', adminOnly: true },
  attreport:  { label: 'Attendance Report', icon: '📋', section: 'Insights' },
  sports:     { label: 'Sports',     icon: '🥋', section: 'Team & Sports' },
  dataimport: { label: 'Data Import', icon: '📥', section: 'System' },
  dataexport: { label: 'Data Export', icon: '📤', section: 'System' },
  audit:      { label: 'Audit Log',  icon: '📋', section: 'System', adminOnly: true },
  users:      { label: 'Users & Roles', icon: '🔐', section: 'System', adminOnly: true },
  preferences:{ label: 'Preferences', icon: '🎛', section: 'System', adminOnly: true },
  club:       { label: 'Club Setup',  icon: '🏷', section: 'System', adminOnly: true },
  databackup: { label: 'Data & Backup', icon: '💾', section: 'System', adminOnly: true },
  cleanup:    { label: 'Cleanup Center', icon: '🧹', section: 'System', adminOnly: true },
  danger:     { label: 'Danger Zone', icon: '⚠️', section: 'System', adminOnly: true },
  settings:   { label: 'Settings',   icon: '⚙️', section: 'System', hidden: true },
};

// ─── Roles (preview/view layer) ─────────────────────────────────────
// Which nav routes each role sees. 'admin' sees everything (null = all).
// NOTE: this is a UI preview layer, not a security boundary — real per-role
// enforcement needs the (pending) Firebase Auth + server rules.
const ROLE_ALLOWED = {
  admin: null,
  // Coaches: their classes, attendance roll-call, trials. NOT salaries (other
  // coaches' pay) or the full members list / club financials.
  coach: ['coachhome', 'coachsalary', 'coachattendance', 'schedule', 'campschedule', 'attendance', 'trials', 'advice', 'posts'],
  // Students/members: their own membership + the class timetable. No other members.
  student: ['mymembership', 'schedule', 'campschedule', 'advice', 'posts'],
  // Receptionist: pure front-desk. Can manage members, families, trials,
  // attendance, schedule, rentals, advice and the Summer Camp tools. CAN view
  // Invoices (to look up a member's payment status — but with NO revenue totals,
  // just the invoice count) and Products (catalog + sell price, no cost/margin).
  // To avoid leaking the club's earnings: NO Dashboard, NO Cash Collection (owner
  // till-withdrawal totals), NO Salaries, NO Insights / Reports / Club Revenue,
  // NO Coach Performance, NO Renewal Potential, NO totals/net-profit views, NO CSV
  // exports, NO Sports admin, NO Users & Roles, NO Backup / Danger / Audit.
  receptionist: [
    'members', 'families', 'expiring', 'duepayment', 'trials', 'reminders',
    'schedule', 'attendance', 'rentals', 'advice',
    'campschedule', 'campmembers', 'campdrivers', 'camproutes',
    'invoices', 'products', 'onboarding', 'expenses',
    // Cash management: front-desk collects cash + tracks the till (owner request).
    'cashcollection', 'cashinhand',
    // NOTE: 'coaches' (Team roster) removed — not needed for front-desk work
    // (least-privilege, req #9). 'onboarding' = WhatsApp portal invites (req #6,
    // reception may send invites). 'expenses' = reception may record/view expenses
    // but the CSV/sheet EXPORT is hidden for them (see the Expenses page).
  ],
};
const ROLE_LABELS = { admin: 'Admin', coach: 'Coach', student: 'Student', receptionist: 'Receptionist' };
// True when the current role has READ-ONLY access to finance pages (revenue,
// salaries, profit). Used to hide edit/save buttons on those pages.
function isViewerRole() { try { return currentRole() === 'receptionist'; } catch (_) { return false; } }
// Membership freezes may only be managed by Admin or Reception — never by the
// member themselves (or a coach). Enforced at every freeze/unfreeze entry point,
// not just by hiding the buttons.
function canManageFreeze() { try { return ['admin', 'receptionist'].includes(currentRole()); } catch (_) { return false; } }
// Arabic labels for the nav items so the menu is consistent in Arabic mode.
const NAV_AR = {
  mymembership: 'عضويتي',
  coachhome: 'لوحة المدرب',
  dashboard: 'لوحة التحكم',
  notes: 'الملاحظات والتذكيرات',
  members: 'الأعضاء',
  families: 'العائلات',
  history: 'السجل',
  schedule: 'الجدول',
  campschedule: 'المعسكر الصيفي',
  campmembers: 'أعضاء المعسكر',
  campdrivers: 'السائقون',
  camproutes: 'طلاب كل سائق',
  expiring: 'قرب الانتهاء',
  duepayment: 'المدفوعات المستحقة',
  reminders: 'التذكيرات',
  birthdays: 'أعياد الميلاد',
  trials: 'الحصص التجريبية',
  rentals: 'الإيجارات',
  coaches: 'الطاقم',
  attendance: 'الحضور',
  advice: 'نصائح المدرب',
  posts: 'النصائح والمقالات',
  invoices: 'الفواتير',
  dupinvoices: 'الفواتير المكررة',
  cashcollection: 'تحصيل النقدية',
  bankaccount: 'الحساب البنكي',
  reconciliation: 'التسوية المالية',
  expenses: 'المصروفات',
  salaries: 'الرواتب',
  citadel: 'سيتاديل',
  products: 'المنتجات',
  productsales: 'مبيعات المنتجات',
  reports: 'التقارير',
  dashboardkpi: 'لوحة المالك',
  monthlyreport: 'التقرير الشهري',
  coachperf: 'أداء المدربين',
  clubrevenue: 'ملخص إيرادات النادي',
  moneyflow: 'النظرة المالية',
  transactions: 'العمليات',
  missinginvoices: 'الفواتير الناقصة',
  invoicechecker: 'سلامة الفواتير',
  membercommission: 'عمولة الأعضاء',
  renewals: 'التجديدات',
  attreport: 'تقرير الحضور',
  dataimport: 'استيراد البيانات',
  dataexport: 'تصدير البيانات',
  sports: 'الرياضات',
  audit: 'سجل التدقيق',
  users: 'المستخدمون والصلاحيات',
  preferences: 'التفضيلات',
  club: 'إعداد النادي',
  databackup: 'البيانات والنسخ الاحتياطي',
  cleanup: 'مركز التنظيف',
  danger: 'منطقة الخطر',
  settings: 'الإعدادات',
};
const ROLE_LABELS_AR = { admin: 'مشرف', coach: 'مدرب', student: 'عضو' };
// The role of the logged-in ACCOUNT (set at sign-in from the Users & Roles map).
function accountRole() { return (state.user && state.user.role) || 'admin'; }
// The effective role NOW. Only an admin account may "preview" another role; a
// coach/student account is locked to its own role and cannot escalate.
function currentRole() {
  const acct = accountRole();
  if (acct !== 'admin') return acct;
  return (state.session && state.session.role) || 'admin';
}
function roleCanAccess(role, route) {
  if (!role || role === 'admin') return true;
  const allow = ROLE_ALLOWED[role];
  return !allow || allow.indexOf(route) >= 0;
}
function roleHome(role) {
  if (!role || role === 'admin') return 'dashboard';
  const allow = ROLE_ALLOWED[role];
  return (allow && allow[0]) || 'dashboard';
}
// The coach/member the app should scope to right now: the logged-in account's,
// unless an ADMIN is previewing as a specific coach/member (session carries the id).
function effectiveCoachId() {
  if (accountRole() === 'admin' && state.session && state.session.role === 'coach') return state.session.coachId ?? null;
  const mapped = (state.user && state.user.coachId) ?? null;
  // If the mapped id no longer resolves to a coach (stale/broken link), fall back
  // to matching the login email → coach.email so the account still works.
  if (mapped != null && (state.coaches || []).some(c => c.id === mapped)) return mapped;
  const healed = myCoach();
  return healed ? healed.id : mapped;
}
function effectiveMemberId() {
  if (accountRole() === 'admin' && state.session && state.session.role === 'student') return state.session.memberId ?? null;
  return (state.user && state.user.memberId) ?? null;
}
// Resolve which role a signed-in email gets, from the cloud Users & Roles map.
// Unmapped emails fall back to settings.unmappedRole (default 'admin' so the
// owner is never locked out); if the map is empty we're bootstrapping → admin.
// Members log in with their MOBILE NUMBER. Internally that maps to a hidden
// Firebase Auth email so we can use standard email/password auth.
const MEMBER_EMAIL_DOMAIN = 'blackstars.com';
// Older builds provisioned logins under this domain; keep recognizing it so those
// already-created accounts still sign in.
const MEMBER_EMAIL_DOMAINS = ['blackstars.com', 'members.blackstars.qa'];
// Canonical mobile = digits only, with the Qatar country code stripped, so the
// SAME login works whether a member types "55512345" or "+974 5551 2345".
function canonicalMobile(input) {
  let d = String(input || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('974') && d.length > 8) d = d.slice(3);
  return d;
}
// True if `query` matches `storedPhone` regardless of formatting — spaces,
// dashes, a leading + or 00, and the 974 country code are all ignored on BOTH
// sides. So "5040 5905", "+974 5040 5905", "0097450405905" and "50405905" all
// match a stored "+97450405905". Used by search boxes across the app.
// ─── Recent searches ────────────────────────────────────────────────────────
// A small, shared "recent searches" memory for the app's search boxes. Each box
// keeps its own list under a key (e.g. 'members', 'invoices'). attachRecentSearch
// wires a dropdown that appears on focus and records committed searches.
const RECENT_SEARCH_MAX = 8;
function recentSearches(key) {
  const all = state.recentSearches || (state.recentSearches = {});
  return Array.isArray(all[key]) ? all[key] : (all[key] = []);
}
function recordRecentSearch(key, term) {
  term = (term || '').trim();
  if (term.length < 2) return;                       // ignore trivial/very short
  const list = recentSearches(key);
  const lc = term.toLowerCase();
  const idx = list.findIndex(t => t.toLowerCase() === lc);
  if (idx >= 0) list.splice(idx, 1);                 // move existing to front
  list.unshift(term);
  if (list.length > RECENT_SEARCH_MAX) list.length = RECENT_SEARCH_MAX;
  if (typeof save === 'function') save();
}
function clearRecentSearches(key) {
  const all = state.recentSearches || (state.recentSearches = {});
  all[key] = [];
  if (typeof save === 'function') save();
}

// Wire a search input (by element id) to a recent-searches dropdown stored under
// `key`. onPick(term) is called when the user clicks a recent item (so the page
// can apply it); if omitted, the input's own 'input' event is dispatched.
function attachRecentSearch(inputId, key, onPick) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const wrap = input.closest('.search') || input.parentElement;
  if (wrap && getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';

  let menu = null;
  const close = () => { if (menu) { menu.remove(); menu = null; } };
  const open = () => {
    close();
    const items = recentSearches(key);
    if (!items.length) return;
    menu = document.createElement('div');
    menu.className = 'recent-search-menu';
    menu.innerHTML =
      `<div class="recent-search-head">${t('Recent searches', 'عمليات البحث الأخيرة')}<button type="button" class="recent-search-clear">${t('Clear', 'مسح')}</button></div>` +
      items.map(term =>
        `<button type="button" class="recent-search-item" data-term="${escapeHtml(term)}"><span class="rs-ico">🕘</span><span class="rs-term">${escapeHtml(term)}</span></button>`
      ).join('');
    wrap.appendChild(menu);
    menu.querySelector('.recent-search-clear').addEventListener('mousedown', (e) => {
      e.preventDefault(); clearRecentSearches(key); close();
    });
    menu.querySelectorAll('.recent-search-item').forEach(btn => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const term = btn.getAttribute('data-term');
        input.value = term;
        if (typeof onPick === 'function') onPick(term);
        else input.dispatchEvent(new Event('input', { bubbles: true }));
        recordRecentSearch(key, term);
        close();
      });
    });
  };

  input.addEventListener('focus', open);
  input.addEventListener('blur', () => {
    recordRecentSearch(key, input.value);
    setTimeout(close, 150);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { recordRecentSearch(key, input.value); close(); }
    else if (e.key === 'Escape') close();
  });
}

function phoneQueryMatches(storedPhone, query) {
  const qDigits = canonicalMobile(query);
  if (!qDigits || qDigits.length < 4) return false;   // too short / not a phone
  const pDigits = canonicalMobile(storedPhone);
  if (!pDigits) return false;
  return pDigits.includes(qDigits) || qDigits.includes(pDigits);
}
function phoneToMemberEmail(input) {
  const digits = canonicalMobile(input);
  return digits ? digits + '@' + MEMBER_EMAIL_DOMAIN : '';
}
function isMemberEmail(email) {
  if (typeof email !== 'string') return false;
  const e = email.toLowerCase();
  return MEMBER_EMAIL_DOMAINS.some(dom => e.endsWith('@' + dom));
}
function memberByPhoneDigits(digits) {
  if (!digits) return null;
  return (state.members || []).find(m => {
    for (const p of [m.phone, m.phone2]) {
      const pd = String(p || '').replace(/\D/g, '');
      if (pd && (pd === digits || pd.endsWith(digits) || digits.endsWith(pd))) return true;
    }
    return false;
  }) || null;
}
function roleForEmail(email) {
  const map = (state.settings && state.settings.userRoles) || {};
  const e = (email || '').toLowerCase();
  const entry = map[e];
  if (entry && entry.role) return { role: entry.role, coachId: entry.coachId ?? null, memberId: entry.memberId ?? null };
  // Member mobile logins auto-resolve to the matching member (no manual mapping).
  if (isMemberEmail(e)) {
    const m = memberByPhoneDigits(e.split('@')[0].replace(/\D/g, ''));
    return { role: 'student', coachId: null, memberId: m ? m.id : null };
  }
  // A member signing in with their OWN real email auto-resolves to Student, linked
  // to that member — no manual Users & Roles entry needed.
  const byEmail = (state.members || []).find(m => !m.deleted && m.email && m.email.toLowerCase() === e);
  if (byEmail) return { role: 'student', coachId: null, memberId: byEmail.id };
  const keys = Object.keys(map);
  // Bootstrap: with NO mappings at all, the first account in is admin so the
  // owner can set things up. Once ANY mapping exists, an unmapped account gets
  // the configured default — which is least-privilege (Student) unless the admin
  // explicitly chose Admin. This stops a random new login getting full access.
  if (!keys.length) return { role: 'admin', coachId: null, memberId: null };
  const fallback = (state.settings && state.settings.unmappedRole) || 'student';
  return { role: fallback, coachId: null, memberId: null };
}

// History stack for the in-app Back button. Each entry remembers the route and the
// scroll position so Back returns the user to the exact spot. Page filter state lives
// in persistent window._*State / loadFilter globals, so those are restored automatically.
window._navStack = window._navStack || [];
// The element/position that actually scrolls. Most pages scroll the document, but if a
// .main/.content wrapper is the scroller we handle that too. Returns a getter/setter pair.
function _getScroll() {
  const m = document.querySelector('.main') || document.querySelector('main');
  if (m && m.scrollHeight > m.clientHeight + 4 && m.scrollTop > 0) return m.scrollTop;
  return window.scrollY || document.documentElement.scrollTop || 0;
}
function _setScroll(y) {
  const m = document.querySelector('.main') || document.querySelector('main');
  if (m && m.scrollHeight > m.clientHeight + 4) { m.scrollTop = y; }
  window.scrollTo(0, y);
}
function navigate(route, opts) {
  // Sales page was merged into Invoices in v89 — silently redirect old bookmarks.
  if (route === 'sales') route = 'invoices';
  // Role guard: a non-admin preview can't open screens outside its allow-list.
  if (!roleCanAccess(currentRole(), route)) route = roleHome(currentRole());
  // Push the CURRENT location onto the back-stack before leaving it (unless this is a
  // back navigation, or we're re-opening the same route).
  if (!(opts && opts.isBack) && state.route && state.route !== route) {
    window._navStack.push({ route: state.route, scroll: _getScroll() });
    if (window._navStack.length > 50) window._navStack.shift();   // cap memory
  }
  state.route = route;
  render();
  // Mirror into the browser history so the device/browser Back button also works.
  try {
    if (!(opts && opts.isBack && opts.fromPop)) {
      if (opts && opts.isBack) { history.replaceState({ route }, '', '#' + route); }
      else history.pushState({ route }, '', '#' + route);
    }
  } catch (_) {}
  // Restore scroll if this navigation carried a saved position (a Back action).
  if (opts && typeof opts.scroll === 'number') {
    const y = opts.scroll;
    requestAnimationFrame(() => requestAnimationFrame(() => _setScroll(y)));
  } else if (!(opts && opts.isBack)) {
    requestAnimationFrame(() => _setScroll(0));
  }
}

// Go back to the previous screen, restoring its scroll position + filters.
function navigateBack() {
  if (!window._navStack || !window._navStack.length) return;
  const prev = window._navStack.pop();
  navigate(prev.route, { isBack: true, scroll: prev.scroll });
}
window.navigateBack = navigateBack;
function canGoBack() { return !!(window._navStack && window._navStack.length); }
window.canGoBack = canGoBack;

// Browser/device Back button → use our back-stack so scroll + filters are restored.
if (!window._popstateBound) {
  window._popstateBound = true;
  window.addEventListener('popstate', (ev) => {
    if (!state || !state.user) return;   // ignore before login
    if (window._navStack && window._navStack.length) {
      const prev = window._navStack.pop();
      navigate(prev.route, { isBack: true, fromPop: true, scroll: prev.scroll });
    } else if (ev.state && ev.state.route) {
      navigate(ev.state.route, { isBack: true, fromPop: true });
    }
  });
}

// ─── Sync refresh banner ─────────────────────────────────────────────
// When another device makes a real change, the data is already merged + saved
// in the background. Rather than refresh the screen out from under the user,
// we show this banner so they can refresh when ready (or keep working). The
// banner is idempotent — repeated remote updates just keep it shown (and bump
// the conflict note), never stacking.
// A small, non-destructive note shown when the cloud has newer data than this device
// loaded. "Refresh" does a clean full reload (re-loads the latest from the cloud) — no
// merging, so it can never overwrite the user's open work without their say-so.
// "Later" just dismisses; the note re-appears on the next remote change.
function showNewerDataNote() {
  try {
    if (document.getElementById('newer-data-note')) return;   // already showing
    const msg = `🔄 <b>${t('Newer data is available', 'تتوفر بيانات أحدث')}</b> — ${t('updated on another device. Refresh to load it?', 'تم التحديث على جهاز آخر. هل تريد تحديث الصفحة لجلبها؟')}`;
    const bar = document.createElement('div');
    bar.id = 'newer-data-note';
    bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:9999;max-width:560px;width:calc(100% - 32px);background:#1f2937;color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.3);padding:12px 14px;display:flex;align-items:center;gap:12px;font-size:13px;line-height:1.4';
    bar.innerHTML = `<div style="flex:1">${msg}</div>
      <button id="newer-data-refresh" style="background:#5b8def;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer;white-space:nowrap">${t('Refresh', 'تحديث')}</button>
      <button id="newer-data-later" style="background:transparent;color:#cbd5e1;border:none;padding:8px 6px;cursor:pointer;white-space:nowrap">${t('Later', 'لاحقاً')}</button>`;
    document.body.appendChild(bar);
    document.getElementById('newer-data-refresh').addEventListener('click', () => { location.reload(); });
    document.getElementById('newer-data-later').addEventListener('click', () => bar.remove());
  } catch (e) { console.warn('[sync] note error:', e); }
}

// ─── Render ──────────────────────────────────────────────────────────
function render() {
  // Page-local hooks (e.g. the Invoices in-place refresh) must not survive a
  // full re-render onto another page.
  window._invoicesRefresh = null;
  if (!state.user) {
    loginScreen();
    return;
  }

  // If a toast is currently visible, preserve it across the body wipe.
  // (toast() calls before render() were getting silently erased — UX bug.)
  const liveToast = document.querySelector('.toast');
  const toastClone = liveToast ? liveToast.cloneNode(true) : null;

  document.body.innerHTML = '';

  // Mobile hamburger button — visible only via CSS at < 900px.
  // Toggles the .open class on .sidebar and .sidebar-backdrop.
  const menuBtn = el('button', {
    className: 'mobile-menu-btn',
    'aria-label': 'Toggle menu',
    title: 'Menu',
    innerHTML: '☰',
  });
  const backdrop = el('div', { className: 'sidebar-backdrop' });
  function closeDrawer() {
    document.querySelector('.sidebar')?.classList.remove('open');
    backdrop.classList.remove('open');
  }
  menuBtn.addEventListener('click', () => {
    const sb = document.querySelector('.sidebar');
    const isOpen = sb?.classList.contains('open');
    if (isOpen) {
      closeDrawer();
    } else {
      sb?.classList.add('open');
      backdrop.classList.add('open');
    }
  });
  backdrop.addEventListener('click', closeDrawer);
  document.body.append(menuBtn);
  document.body.append(backdrop);

  const app = el('div', { id: 'app' });
  const sidebar = renderSidebar();
  const main = el('main', { className: 'main' });

  app.append(sidebar);
  app.append(main);
  document.body.append(app);

  // Close drawer when a nav item is clicked (mobile UX)
  sidebar.addEventListener('click', e => {
    if (e.target.closest('.nav-item') && window.innerWidth <= 900) {
      closeDrawer();
    }
  });

  // Re-append the surviving toast (already on its timer; will fade naturally)
  if (toastClone) document.body.append(toastClone);

  // NOW main is in the DOM — page handler can safely query elements.
  // Enforce access on the CURRENT route too (not just on click): if this role
  // can't open state.route — e.g. a student left on 'dashboard' after login or a
  // refresh — send them to their own home instead of rendering a forbidden page.
  if (!roleCanAccess(currentRole(), state.route)) {
    state.route = roleHome(currentRole());
  }
  const handler = PAGES[state.route] || PAGES[roleHome(currentRole())] || PAGES.dashboard;
  handler(main);

  // ── Global Back button ── Inject a back arrow at the start of the page's topbar
  // (every screen has a .topbar). Returns to the previous screen, scroll + filters.
  try {
    if (canGoBack()) {
      const topbar = main.querySelector('.topbar');
      if (topbar && !topbar.querySelector('.back-btn')) {
        const back = document.createElement('button');
        back.className = 'btn ghost back-btn';
        back.type = 'button';
        back.title = t('Back', 'رجوع');
        back.setAttribute('aria-label', t('Back', 'رجوع'));
        back.style.cssText = 'margin-inline-end:10px;padding:8px 12px;font-size:16px;line-height:1;flex:0 0 auto';
        back.innerHTML = '←';
        back.addEventListener('click', () => navigateBack());
        // Place it before the title block so it reads as a leading control.
        topbar.insertBefore(back, topbar.firstChild);
        topbar.style.display = topbar.style.display || 'flex';
        topbar.style.alignItems = topbar.style.alignItems || 'center';
      }
    }
  } catch (_) {}

  // ── Global CLOUD-REFRESH button (v6.316.0) ── pull the latest data from the cloud WITHOUT a
  // full page reload. Present on every screen (top-right of the page header). Soft refresh:
  // reads the authoritative cloud, element-merges it into state (keeps your unsaved local
  // edits), and re-renders in place with scroll preserved.
  if (!window.refreshFromCloud) {
    window.refreshFromCloud = async function (btn) {
      if (!(window.Storage && window.Storage.isCloud && window.Storage.isCloud())) { try { toast(t('Offline — nothing to pull from the cloud', 'غير متصل — لا شيء لجلبه'), 'info'); } catch (_) {} return; }
      if (btn) { btn.classList.add('bs-spin'); btn.disabled = true; }
      try {
        const remote = await window.Storage.readCloud();
        if (remote && typeof mergeRemoteIntoState === 'function') {
          mergeRemoteIntoState(remote);
          try { (typeof _renderKeepScroll === 'function') ? _renderKeepScroll() : render(); } catch (_) { try { render(); } catch (__) {} }
          try { toast(t('✓ Refreshed from cloud', '✓ تم التحديث من السحابة'), 'success'); } catch (_) {}
        } else { try { toast(t('No cloud data to load', 'لا توجد بيانات'), 'info'); } catch (_) {} }
      } catch (e) {
        try { toast(t('Refresh failed — check your connection', 'فشل التحديث — تحقق من الاتصال'), 'error'); } catch (_) {}
      } finally { if (btn) { btn.classList.remove('bs-spin'); btn.disabled = false; } }
    };
    try { if (!document.getElementById('bs-spin-style')) { const st = document.createElement('style'); st.id = 'bs-spin-style'; st.textContent = '@keyframes bs-spin-kf{to{transform:rotate(360deg)}}.bs-spin{animation:bs-spin-kf .8s linear infinite}'; document.head.appendChild(st); } } catch (_) {}
  }
  // (The refresh button lives in the SIDEBAR footer — a clean, always-visible menu item —
  //  so it never disturbs a page's own header layout. See renderSidebar / #sidebar-refresh.)

  // ── Session control button — REMOVED in the multi-document multi-user model ──
  // The lock/take-over icon belonged to the old single-writer design. With
  // per-record concurrent editing there is no "editing session" to hold, so the
  // button is no longer rendered. (openSessionManager() still exists for the
  // settings "connected devices" view, but is no longer surfaced here.)

  // Make every data table sortable by clicking its column headers.
  try { makeTablesSortable(main); } catch (_) {}
  // Keep it working for tables that appear AFTER this render — filter refreshes
  // that rebuild a table, tables inside modals, and async-loaded tables.
  try { setupSortObserver(); } catch (_) {}

  // Gentle data-safety nudge if it's been a while since the last backup.
  try { maybeShowBackupReminder(); } catch (_) {}
}

// ─── Generic sortable tables ─────────────────────────────────────
// Every table on every page becomes sortable by clicking a column header
// (numeric-, currency- and date-aware). Headers that already implement their
// own sort (th[data-sortkey], e.g. the Members table) are left untouched.
// Sorting reorders the CURRENT tbody rows (the visible page when paginated).
function makeTablesSortable(root) {
  const tables = (root || document).querySelectorAll('table');
  tables.forEach(table => {
    const headRow = table.tHead && table.tHead.rows[0];
    const body = table.tBodies && table.tBodies[0];
    if (!headRow || !body) return;
    Array.from(headRow.cells).forEach((th, colIdx) => {
      if (th.dataset.sortkey != null) return;          // page has its own sort
      if (th.dataset.sortable === '0') return;          // explicitly opted out
      if (!th.textContent.trim()) return;               // empty / action columns
      if (th.querySelector('input,select,button')) return;
      if (!th.classList.contains('th-sort')) {
        th.classList.add('th-sort');
        th.title = th.title || 'Click to sort';
        const ic = document.createElement('span');
        ic.className = 'th-sort-ic';
        ic.textContent = '⇅';
        th.appendChild(ic);
        th.addEventListener('click', () => {
          const dir = th.dataset.dir === 'asc' ? 'desc' : 'asc';
          headRow.querySelectorAll('th').forEach(o => { delete o.dataset.dir; const i = o.querySelector('.th-sort-ic'); if (i) i.textContent = '⇅'; });
          th.dataset.dir = dir;
          const icEl = th.querySelector('.th-sort-ic'); if (icEl) icEl.textContent = dir === 'asc' ? '↑' : '↓';
          const rows = Array.from(body.rows);
          // Don't sort empty-state / spanning rows; keep them at the end.
          const sortable = rows.filter(r => !Array.from(r.cells).some(c => c.colSpan > 2));
          const rest = rows.filter(r => !sortable.includes(r));
          const cellVal = r => (r.cells[colIdx] ? r.cells[colIdx].textContent.trim() : '');
          const toNum = v => { const n = parseFloat(String(v).replace(/[,٬\s]/g, '').replace(/QAR|ر\.ق|%/g, '')); return isNaN(n) ? null : n; };
          const toDate = v => { const ts = Date.parse(v); return isNaN(ts) ? null : ts; };
          sortable.sort((a, b) => {
            const va = cellVal(a), vb = cellVal(b);
            const na = toNum(va), nb = toNum(vb);
            let cmp;
            if (na != null && nb != null) cmp = na - nb;
            else {
              const da = toDate(va), db = toDate(vb);
              if (da != null && db != null) cmp = da - db;
              else cmp = va.localeCompare(vb, undefined, { sensitivity: 'base' });
            }
            return dir === 'asc' ? cmp : -cmp;
          });
          sortable.forEach(r => body.appendChild(r));
          rest.forEach(r => body.appendChild(r));
        });
      }
    });
  });
}

// Re-apply sortable headers when tables appear after the initial page render —
// e.g. a filter change that rebuilds a table, a table inside a modal, or async
// data. makeTablesSortable is idempotent (already-enhanced headers are skipped),
// so a debounced full re-scan is safe and cheap, and can't loop on itself.
function setupSortObserver() {
  if (window.__sortObserver) return;
  let timer = null;
  const obs = new MutationObserver(() => {
    if (timer) return;
    timer = setTimeout(() => { timer = null; try { makeTablesSortable(document.body); } catch (_) {} }, 150);
  });
  try { obs.observe(document.body, { childList: true, subtree: true }); } catch (_) { return; }
  window.__sortObserver = obs;
}

// ─── Auto-backup reminder ───────────────────────────────────────
// Browser-stored data has no server copy, so nudge the admin to export a
// JSON backup if it's been more than 7 days (snoozes for 3 days on dismiss).
// Shows at most once per session.
function maybeShowBackupReminder() {
  if (!state.user) return;                       // only when signed in
  if (window.__backupReminderShown) return;      // once per session
  const dataCount = (state.members?.length || 0) + (state.invoices?.length || 0);
  if (dataCount === 0) return;                    // nothing to lose yet

  const DAY = 86400000, now = Date.now();
  const cloud = isCloudStorage();
  const last = parseInt(localStorage.getItem('bs-last-backup') || '0', 10) || 0;
  const snooze = parseInt(localStorage.getItem('bs-backup-snooze') || '0', 10) || 0;
  // Cloud data is already safe in Firestore, so nudge far less often (30d vs 7d).
  if (now - last < (cloud ? 30 : 7) * DAY) return;   // backed up recently
  if (now - snooze < (cloud ? 14 : 3) * DAY) return; // recently snoozed

  window.__backupReminderShown = true;
  document.getElementById('backup-reminder')?.remove();

  const daysSince = last ? Math.floor((now - last) / DAY) : null;
  const msg = cloud
    ? `Your ${dataCount} records are saved in the cloud and sync across devices. A JSON export is a handy extra offline copy — optional, but nice to have.`
    : (daysSince == null
      ? `You haven't saved a backup yet. Your ${dataCount} records live only in this browser.`
      : `It's been ${daysSince} day${daysSince === 1 ? '' : 's'} since your last backup.`);
  const title = cloud ? 'Keep an extra copy?' : 'Time for a backup?';
  const icon = cloud ? '☁️' : '💾';

  const bar = el('div', { id: 'backup-reminder' });
  bar.style.cssText =
    'position:fixed;left:16px;bottom:16px;z-index:60;max-width:330px;' +
    'background:var(--surface);border:1px solid var(--border);border-radius:12px;' +
    'box-shadow:var(--shadow-md);padding:14px 16px;font-size:13px;color:var(--text)';
  bar.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:10px">
      <span style="font-size:18px;line-height:1">${icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;margin-bottom:2px">${title}</div>
        <div style="color:var(--text-dim);font-size:12px;line-height:1.4">${msg}</div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn primary sm" id="backup-reminder-now">💾 ${cloud ? 'Export a copy' : 'Back up now'}</button>
          <button class="btn ghost sm" id="backup-reminder-later">Later</button>
        </div>
      </div>
    </div>`;
  document.body.append(bar);

  window.__hideBackupReminder = () => { document.getElementById('backup-reminder')?.remove(); };
  bar.querySelector('#backup-reminder-now').addEventListener('click', () => {
    if (typeof window.downloadBackup === 'function') window.downloadBackup();
    window.__hideBackupReminder();
  });
  bar.querySelector('#backup-reminder-later').addEventListener('click', () => {
    try { localStorage.setItem('bs-backup-snooze', String(Date.now())); } catch (_) {}
    window.__hideBackupReminder();
  });
}

function renderSidebar() {
  const collapsed = (() => { try { return localStorage.getItem('bs-sidebar-collapsed') === '1'; } catch (_) { return false; } })();
  const sb = el('aside', { className: 'sidebar' + (collapsed ? ' sidebar-collapsed' : '') });

  // Brand
  const brand = el('div', { className: 'brand' });
  brand.innerHTML = `
    <div class="brand-logo" style="background-image:url('${BRAND_LOGO}');background-size:cover;background-position:center;font-size:0"></div>
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
  // Language toggle (English ⇄ Arabic). Affects the member-facing screens + RTL.
  const langBtn = el('button', {
    id: 'quick-lang',
    title: 'English / العربية',
    onclick: () => { setLang(getLang() === 'ar' ? 'en' : 'ar'); render(); },
  }, getLang() === 'ar' ? 'EN' : 'ع');
  langBtn.style.cssText = 'background:var(--surface-2);border:1px solid var(--border);cursor:pointer;font-size:13px;font-weight:700;padding:6px 10px;border-radius:8px;color:var(--text);margin-left:4px';
  brand.append(langBtn);

  // Notification bell (Facebook-style). Shows a red count badge and a dropdown
  // list of role-aware alerts (next class, expiry, low classes, balance, etc.).
  const notifWrap = el('div', { className: 'notif-wrap' });
  notifWrap.style.cssText = 'position:relative;margin-left:4px';
  const notifCount = (() => { try { return notificationCount(); } catch (_) { return 0; } })();
  const bellBtn = el('button', { id: 'quick-notif', title: t('Notifications', 'الإشعارات') }, '🔔');
  bellBtn.style.cssText = 'background:var(--surface-2);border:1px solid var(--border);cursor:pointer;font-size:16px;padding:6px 10px;border-radius:8px;color:var(--text);position:relative';
  if (notifCount > 0) {
    const badge = el('span', { className: 'notif-badge' }, notifCount > 9 ? '9+' : String(notifCount));
    badge.style.cssText = 'position:absolute;top:-5px;right:-5px;background:var(--red);color:#fff;font-size:9px;font-weight:700;min-width:16px;height:16px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;padding:0 4px';
    bellBtn.append(badge);
  }
  bellBtn.onclick = (ev) => { ev.stopPropagation(); toggleNotifPanel(notifWrap); };
  notifWrap.append(bellBtn);
  brand.append(notifWrap);

  // Collapse / expand toggle (desktop). Its own clearly-labelled row so it's easy
  // to find. Persists across sessions.
  const collapseBtn = el('button', {
    className: 'sidebar-collapse-btn',
    title: 'Collapse / expand the menu',
    onclick: () => {
      const isNow = sb.classList.toggle('sidebar-collapsed');
      try { localStorage.setItem('bs-sidebar-collapsed', isNow ? '1' : '0'); } catch (_) {}
      collapseBtn.innerHTML = isNow ? '»' : '<span class="icon">«</span><span class="lbl">' + t('Collapse menu', 'طيّ القائمة') + '</span>';
    },
  });
  collapseBtn.innerHTML = sb.classList.contains('sidebar-collapsed') ? '»' : '<span class="icon">«</span><span class="lbl">' + t('Collapse menu', 'طيّ القائمة') + '</span>';
  sb.append(collapseBtn);

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

  // Role banner. An ADMIN previewing another role gets an "Exit" button back to
  // full access. A real coach/student login is locked to its role — no exit.
  if (currentRole() !== 'admin') {
    const isAdminPreview = accountRole() === 'admin';
    // Show the actual person's name (not just "Student"/"Coach"), and use a pink
    // accent for female members.
    let who = ROLE_LABELS[currentRole()] || currentRole();
    let pink = false;
    if (currentRole() === 'student') {
      const mm = state.members.find(x => x.id === effectiveMemberId());
      if (mm) { who = mm.name; pink = (mm.gender === 'Female'); }
    } else if (currentRole() === 'coach') {
      who = coachName(effectiveCoachId()) || who;
    }
    const accent = pink ? '236,72,153' : '245,158,11';   // pink vs amber
    const banner = el('div', {});
    banner.style.cssText = `margin:8px 12px;padding:8px 10px;background:rgba(${accent},.14);border:1px solid rgba(${accent},.4);border-radius:8px;font-size:11px;display:flex;align-items:center;gap:8px`;
    const roleLbl = t(ROLE_LABELS[currentRole()] || currentRole(), ROLE_LABELS_AR[currentRole()]);
    banner.innerHTML = `<span style="flex:1">${isAdminPreview ? t('👁 Previewing as', '👁 معاينة كـ') : t('🔒 Signed in as', '🔒 تسجيل الدخول كـ')} <b>${escapeHtml(who)}</b> <span style="opacity:.7">· ${roleLbl}</span></span>`;
    if (isAdminPreview) {
      const exit = el('button', {
        onclick: () => { state.session = { role: 'admin' }; save(); navigate('dashboard'); toast('Back to Admin'); },
        title: 'Exit preview and return to full Admin access',
      }, 'Exit');
      exit.style.cssText = 'background:var(--accent-2);color:#fff;border:none;border-radius:6px;padding:3px 9px;font-size:11px;font-weight:600;cursor:pointer';
      banner.append(exit);
    }
    sb.append(banner);
  }

  // Navigation — each section is a collapsible group (persisted; the group holding
  // the current route always stays open so you never lose your place).
  const nav = el('nav', { className: 'nav' });
  const sections = ['Main','Membership','Activities','Summer Camp','Team & Sports','Finance','Insights','System'];
  const SECTION_AR = { Main: 'الرئيسية', Membership: 'العضوية', Activities: 'الأنشطة', 'Summer Camp': 'المعسكر الصيفي', 'Team & Sports': 'الفريق والرياضات', Finance: 'المالية', Insights: 'التقارير', System: 'النظام' };
  const collapsedGroups = (() => {
    try { return new Set(JSON.parse(localStorage.getItem('bs-nav-collapsed') || '[]')); } catch (_) { return new Set(); }
  })();
  for (const section of sections) {
    const entries = Object.entries(ROUTES).filter(([key, route]) => route.section === section && !route.hidden && roleCanAccess(currentRole(), key) && (!route.memberOnly || currentRole() === 'student') && (!route.coachOnly || currentRole() === 'coach') && (!route.adminOnly || currentRole() === 'admin'));
    if (!entries.length) continue;
    const hasActive = entries.some(([key]) => key === state.route);
    const startCollapsed = collapsedGroups.has(section) && !hasActive;
    const header = el('button', { className: 'nav-section nav-section-toggle' + (startCollapsed ? ' collapsed' : '') });
    header.innerHTML = `<span>${t(section, SECTION_AR[section] || section)}</span><span class="nav-section-chev">▾</span>`;
    const group = el('div', { className: 'nav-group' + (startCollapsed ? ' nav-group-collapsed' : '') });
    header.addEventListener('click', () => {
      const nowCollapsed = group.classList.toggle('nav-group-collapsed');
      header.classList.toggle('collapsed', nowCollapsed);
      if (nowCollapsed) collapsedGroups.add(section); else collapsedGroups.delete(section);
      try { localStorage.setItem('bs-nav-collapsed', JSON.stringify([...collapsedGroups])); } catch (_) {}
    });
    for (const [key, route] of entries) {
      const item = el('button', {
        className: 'nav-item' + (state.route === key ? ' active' : ''),
        onclick: () => navigate(key),
      });
      item.innerHTML = `<span class="icon">${route.icon}</span><span>${NAV_AR[key] ? t(route.label, NAV_AR[key]) : route.label}</span>`;
      if (typeof route.badge === 'function') {
        let n = 0; try { n = route.badge() || 0; } catch (_) { n = 0; }
        if (n > 0) {
          const b = el('span', { className: 'nav-badge' });
          b.textContent = n > 99 ? '99+' : String(n);
          b.style.cssText = 'margin-left:auto;background:var(--red);color:#fff;font-size:10px;font-weight:700;min-width:18px;height:18px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;padding:0 5px';
          item.append(b);
        }
      }
      group.append(item);
    }
    nav.append(header);
    nav.append(group);
  }
  sb.append(nav);

  // Footer (user info)
  const footer = el('div', { className: 'sidebar-footer' });
  const _nm = state.user.name || 'User';
  const _initials = (_nm.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('') || 'U').toUpperCase();
  // A signed-in coach gets their sport-based avatar; everyone else keeps initials.
  const _coachRec = (accountRole() === 'coach' && typeof myCoach === 'function') ? myCoach() : null;
  const _avatarHtml = _coachRec ? coachAvatarHtml(_coachRec, 34) : `<div class="avatar">${escapeHtml(_initials)}</div>`;
  const _roleLabel = t(ROLE_LABELS[accountRole()] || 'Administrator', ROLE_LABELS_AR[accountRole()]);
  const _isCloud = !!(window.Storage && window.Storage.isCloud && window.Storage.isCloud());
  const _isAdmin = accountRole() === 'admin';
  const _footMoreCollapsed = (() => { try { return localStorage.getItem('bs-foot-collapsed') !== '0'; } catch (_) { return true; } })();
  footer.innerHTML = `
    <div class="user-pill">
      ${_avatarHtml}
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(_nm)}</div>
        <div style="font-size:10px;color:var(--text-mute)">${escapeHtml(_roleLabel)} · v${APP_VERSION} · ${_isCloud ? '☁️ cloud' : '💾 offline'}</div>
      </div>
    </div>
    ${_isCloud ? `<button class="btn ghost sm full" id="sidebar-refresh" style="margin-bottom:6px;display:flex;align-items:center;justify-content:flex-start;gap:8px;text-align:left" title="${t('Pull the latest data from the cloud — no page reload','جلب أحدث البيانات من السحابة — بدون إعادة تحميل')}"><span class="sidebar-refresh-ic" style="width:18px;text-align:center;flex-shrink:0">🔄</span><span style="flex:1;min-width:0">${t('Refresh from cloud','تحديث من السحابة')}</span></button>` : ''}
    <button class="nav-section nav-section-toggle${_footMoreCollapsed ? ' collapsed' : ''}" id="foot-more-toggle" style="margin-top:6px"><span>${t('More', 'المزيد')}</span><span class="nav-section-chev">▾</span></button>
    <div class="nav-group${_footMoreCollapsed ? ' nav-group-collapsed' : ''}" id="foot-more-group">
      ${_isAdmin ? `<button class="btn ghost sm full" id="sidebar-cmdk" style="margin-bottom:6px;display:flex;align-items:center;justify-content:flex-start;gap:8px;text-align:left" title="Quick search (Ctrl+K / ⌘K)"><span style="width:18px;text-align:center;flex-shrink:0">🔎</span><span style="flex:1;min-width:0">${t('Quick search','بحث سريع')}</span><span style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:9px;padding:1px 4px;background:var(--surface);border:1px solid var(--border);border-radius:4px;flex-shrink:0">⌘K</span></button>` : ''}
      ${_isAdmin ? `<button class="btn ghost sm full" id="sidebar-backup" style="margin-bottom:6px;display:flex;align-items:center;justify-content:flex-start;gap:8px;text-align:left" title="Download a full JSON backup of your data"><span style="width:18px;text-align:center;flex-shrink:0">💾</span><span style="flex:1;min-width:0">${t('Quick backup','نسخة احتياطية سريعة')}</span></button>` : ''}
      ${_isCloud ? `<button class="btn ghost sm full" id="sidebar-changepw" style="margin-bottom:6px;display:flex;align-items:center;justify-content:flex-start;gap:8px;text-align:left" title="Change your sign-in password"><span style="width:18px;text-align:center;flex-shrink:0">🔐</span><span style="flex:1;min-width:0">${t('Change password','تغيير كلمة المرور')}</span></button>` : ''}
      <a href="guide.html" target="_blank" class="btn ghost sm full" style="margin-bottom:6px;text-decoration:none;display:flex;align-items:center;justify-content:flex-start;gap:8px;text-align:left"><span style="width:18px;text-align:center;flex-shrink:0">📖</span><span style="flex:1;min-width:0">${t('User Guide','دليل الاستخدام')}</span></a>
    </div>
    <button class="btn ghost sm full" id="logout-btn" style="display:flex;align-items:center;justify-content:flex-start;gap:8px;text-align:left"><span style="width:18px;text-align:center;flex-shrink:0">🚪</span><span style="flex:1;min-width:0">${t('Sign out','تسجيل الخروج')}</span></button>
  `;
  sb.append(footer);
  const _ft = footer.querySelector('#foot-more-toggle');
  const _fg = footer.querySelector('#foot-more-group');
  if (_ft && _fg) _ft.addEventListener('click', () => {
    const nowCollapsed = _fg.classList.toggle('nav-group-collapsed');
    _ft.classList.toggle('collapsed', nowCollapsed);
    try { localStorage.setItem('bs-foot-collapsed', nowCollapsed ? '1' : '0'); } catch (_) {}
  });
  footer.querySelector('#logout-btn').addEventListener('click', logout);
  const _bk = footer.querySelector('#sidebar-backup');
  if (_bk) _bk.addEventListener('click', () => {
    if (typeof window.downloadBackup === 'function') window.downloadBackup();
    else toast('Backup function not loaded yet', 'error');
  });
  const _ck = footer.querySelector('#sidebar-cmdk');
  if (_ck) _ck.addEventListener('click', () => { if (typeof openCmdK === 'function') openCmdK(); });
  const _cp = footer.querySelector('#sidebar-changepw');
  if (_cp) _cp.addEventListener('click', () => { if (typeof window.promptPasswordChange === 'function') window.promptPasswordChange(false); });
  const _rf = footer.querySelector('#sidebar-refresh');
  if (_rf) _rf.addEventListener('click', () => { const ic = _rf.querySelector('.sidebar-refresh-ic'); if (typeof window.refreshFromCloud === 'function') window.refreshFromCloud(ic); });

  return sb;
}

// ─── Page registry (filled in pages.js) ──────────────────────────
const PAGES = {};

// ─── Persistent filter helpers ──────────────────────────────────────
// Page-level filter state survives navigation within a session, so admin
// doesn't have to re-pick "Active" / sport / coach every time they switch
// pages. Stored in sessionStorage (per-tab); resets on browser close.
function loadFilter(pageKey, defaults) {
  try {
    const raw = sessionStorage.getItem('bs-filter-' + pageKey);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch { return { ...defaults }; }
}
function saveFilter(pageKey, filter) {
  try { sessionStorage.setItem('bs-filter-' + pageKey, JSON.stringify(filter)); }
  catch {}
}

// ─── Recently viewed members (last 5, per-tab) ──────────────────
function pushRecentMember(memberId) {
  if (!memberId) return;
  let list = [];
  try { list = JSON.parse(sessionStorage.getItem('bs-recent-members') || '[]'); }
  catch { list = []; }
  list = [memberId, ...list.filter(id => id !== memberId)].slice(0, 5);
  try { sessionStorage.setItem('bs-recent-members', JSON.stringify(list)); }
  catch {}
}
function getRecentMembers() {
  try {
    const ids = JSON.parse(sessionStorage.getItem('bs-recent-members') || '[]');
    return ids.map(id => state.members.find(m => m.id === id)).filter(Boolean);
  } catch { return []; }
}

// ─── Init ──────────────────────────────────────────────────────────
// ─── Theme manager ──────────────────────────────────────────────────
const THEMES = ['dark', 'light', 'cream', 'colorful'];
const LS_THEME_KEY = 'blackstars-crm-theme';
const DEFAULT_THEME = 'light';

function getTheme() {
  return localStorage.getItem(LS_THEME_KEY) || DEFAULT_THEME;
}
function setTheme(name) {
  if (!THEMES.includes(name)) name = DEFAULT_THEME;
  if (name === 'dark') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem(LS_THEME_KEY, name);
}
// Apply saved theme as early as possible (before render to avoid flash)
setTheme(getTheme());

// ─── Language (English / Arabic) ───────────────────────────────
// Member-facing screens (login, My Membership, My Advice, the student/coach nav,
// change-password) are translated. Admin/back-office screens stay English.
function getLang() {
  try { return localStorage.getItem('bs-lang') === 'ar' ? 'ar' : 'en'; } catch (_) { return 'en'; }
}
function setLang(l) {
  l = (l === 'ar') ? 'ar' : 'en';
  try { localStorage.setItem('bs-lang', l); } catch (_) {}
  applyLangDir();
}
function applyLangDir() {
  const ar = getLang() === 'ar';
  try {
    document.documentElement.lang = ar ? 'ar' : 'en';
    document.documentElement.dir = ar ? 'rtl' : 'ltr';
  } catch (_) {}
}
// t(english, arabic) → returns the Arabic string when Arabic is active, else English.
function t(en, ar) { return (getLang() === 'ar' && ar) ? ar : en; }
applyLangDir();
window.setLang = setLang; window.getLang = getLang; window.t = t;

async function init() {
  // Choose backend: Firebase if configured, otherwise localStorage.
  const backend = window.Storage.init();
  // Diagnostic: backend selection result is exposed via window.__storageBackend
  // for ops/debugging without polluting the console.
  window.__storageBackend = backend;

  // If the storage layer ever refuses to overwrite good data with an empty save
  // (the deploy/sync data-loss case), surface it loudly instead of failing silent.
  window.__onCloudWriteBlocked = (count, reason) => {
    if (document.getElementById('wipe-guard-banner')) return;
    const b = el('div', { id: 'wipe-guard-banner' });
    b.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:9999;background:#b91c1c;color:#fff;' +
      'padding:12px 16px;font-size:13px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.3)';
    b.innerHTML = `🛡️ <b>Your data was protected.</b> A risky save was blocked${reason ? ` (${reason})` : ''} so it could not overwrite your cloud data. Your saved data is safe. Please <b>reload this page</b> to resync from the cloud before making changes. <button id="wipe-guard-reload" style="margin-left:10px;background:#fff;color:#b91c1c;border:none;border-radius:6px;padding:4px 10px;font-weight:700;cursor:pointer">Reload now</button>`;
    document.body.append(b);
    document.getElementById('wipe-guard-reload')?.addEventListener('click', () => location.reload());
  };

  // Live "cloud save" status pill (bottom-right) so staff can SEE every change reach
  // Firebase — Saving… → ✅ Saved to cloud · HH:MM:SS → (fades), or ⚠️ Not saved.
  // Cloud mode only (the storage layer calls this hook only for the Firebase backend).
  window.__onCloudSaveStatus = (() => {
    let hideTimer = null;
    // MONEY collections → a CRITICAL save gets a stronger, longer confirmation (lock icon
    // + held ~6.5s) so a payment/invoice/salary change is unmistakably confirmed. Members
    // are deliberately NOT here: an attendance mark writes the member doc, and rapid roll-
    // call must stay the quick flash — member-EDIT's wait-for-confirm lives at its call
    // site (withCloudConfirm), not in this visual pill. (v6.321)
    const CRITICAL = { invoices: t('invoice', 'فاتورة'), expenses: t('expense', 'مصروف'), salaries: t('salary', 'راتب'), sales: t('sale', 'مبيعة') };
    const LABELS = { ...CRITICAL, members: t('member', 'عضو'), coaches: t('staff', 'طاقم'), auditLog: t('log', 'سجل'), families: t('family', 'عائلة'), schedule: t('schedule', 'جدول'), notes: t('note', 'ملاحظة'), products: t('product', 'منتج'), trials: t('trial', 'تجربة'), rentals: t('rental', 'إيجار') };
    // Human summary of what was written, e.g. "1 payment · 1 member" → "invoice, member".
    const summarize = (byCol) => {
      if (!byCol) return '';
      const parts = [];
      for (const k of Object.keys(byCol)) { const n = byCol[k]; if (!n) continue; const lab = LABELS[k] || k; parts.push(n > 1 ? n + ' ' + lab : lab); }
      return parts.slice(0, 3).join(' · ') + (parts.length > 3 ? ' …' : '');
    };
    const isCritical = (byCol) => !!byCol && Object.keys(CRITICAL).some(k => byCol[k]);
    const pill = () => {
      let p = document.getElementById('cloud-save-pill');
      if (!p) {
        p = document.createElement('div');
        p.id = 'cloud-save-pill';
        // Larger + higher-contrast than before so every save is genuinely NOTICED.
        p.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9998;font-size:13px;font-weight:800;padding:9px 15px;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.32);pointer-events:none;transition:opacity .2s,transform .2s;font-family:system-ui,sans-serif;max-width:min(78vw,360px);letter-spacing:.1px';
        document.body.append(p);
      }
      return p;
    };
    return (s) => {
      try {
        const p = pill(); clearTimeout(hideTimer); p.style.opacity = '1';
        const what = summarize(s.byCollection);
        const crit = isCritical(s.byCollection);
        if (s.phase === 'saving') {
          p.style.background = '#f59e0b'; p.style.color = '#fff'; p.style.transform = 'translateY(0) scale(1)';
          p.textContent = (crit ? '🔒 ' : '☁️ ') + t('Saving', 'جارٍ حفظ') + (what ? ' ' + what : '…') + (crit ? ' …' : '');
        } else if (s.phase === 'saved') {
          p.style.background = crit ? '#0f766e' : '#16a34a'; p.style.color = '#fff';
          // brief pop so the confirmation registers even mid-work
          p.style.transform = 'translateY(0) scale(1.04)'; setTimeout(() => { try { p.style.transform = 'scale(1)'; } catch (_) {} }, 160);
          const tm = new Date(s.at || Date.now()).toLocaleTimeString();
          p.textContent = (crit ? '🔒✅ ' : '✅ ') + (what ? t('Saved', 'حُفظ') + ': ' + what : t('Saved to cloud', 'حُفظ في السحابة')) + ' · ' + tm;
          hideTimer = setTimeout(() => { p.style.opacity = '0'; }, crit ? 6500 : 3500);
          // A write finally landed → tear down the persistent failure banner.
          try { const b = document.getElementById('cloud-save-fail-bar'); if (b) b.remove(); } catch (_) {}
        } else if (s.phase === 'error') { p.style.background = '#b91c1c'; p.style.color = '#fff'; p.style.transform = 'scale(1)'; p.textContent = '⚠️ ' + t('NOT saved — retrying…', 'لم يُحفظ — إعادة المحاولة…'); }
      } catch (_) {}
    };
  })();

  // Could not reach Firebase on load → the app is showing a read-only offline
  // copy and will NOT save to the cloud until reconnected. Warn loudly so the
  // user never assumes their changes were saved.
  window.__onCloudReadFailed = () => {
    if (document.getElementById('cloud-read-banner')) return;
    const b = el('div', { id: 'cloud-read-banner' });
    b.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:9999;background:#b45309;color:#fff;' +
      'padding:12px 16px;font-size:13px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.3)';
    b.innerHTML = `⚠️ <b>Working offline — changes will NOT be saved.</b> The app could not reach the cloud, so it is showing your last copy in read-only mode to protect your data. <b>Do not enter new data.</b> Check your connection and <button id="cloud-read-reload" style="margin-left:6px;background:#fff;color:#b45309;border:none;border-radius:6px;padding:4px 10px;font-weight:700;cursor:pointer">reload</button> to reconnect.`;
    document.body.append(b);
    document.getElementById('cloud-read-reload')?.addEventListener('click', () => location.reload());
  };

  // If a Firestore write fails, show a PERSISTENT banner that stays until the change
  // actually reaches the cloud — it is NOT dismissable, because the data is still only
  // on this device and would be lost on refresh. The app auto-retries in the background;
  // "↻ Retry now" forces an immediate attempt. The banner is torn down centrally the
  // moment any write succeeds (see phase:'saved' above), so it can never linger falsely.
  window.__onCloudSaveError = (err) => {
    try {
      const code = (err && (err.code || err.message)) || '';
      const isQuota = /resource-exhausted|exhausted|quota/i.test(String(code));
      let bar = document.getElementById('cloud-save-fail-bar');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'cloud-save-fail-bar';
        bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:10000;background:#7f1d1d;color:#fff;' +
          'padding:12px 16px;font-size:13px;line-height:1.45;box-shadow:0 -4px 18px rgba(0,0,0,.4);' +
          'display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;text-align:center';
        document.body.appendChild(bar);
      }
      const reason = isQuota
        ? t('the cloud is busy (too many rapid saves)', 'الخادم مشغول (عمليات حفظ سريعة كثيرة)')
        : t('the connection to the cloud dropped', 'انقطع الاتصال بالسحابة');
      bar.innerHTML =
        `<span style="flex:1 1 auto;min-width:220px">⚠️ <b>${t('Your last change is NOT saved to the cloud', 'آخر تغيير لم يُحفظ في السحابة')}</b> — ${reason}. ` +
        `${t('It is kept on this device and will be lost if you close now. Retrying automatically…', 'محفوظ على هذا الجهاز فقط وسيُفقد إذا أغلقت الآن. تتم إعادة المحاولة تلقائياً…')}</span>` +
        `<button id="cloud-retry-now" style="background:#fff;color:#7f1d1d;border:none;border-radius:8px;padding:8px 16px;font-weight:800;cursor:pointer;white-space:nowrap">↻ ${t('Retry now', 'أعد المحاولة الآن')}</button>` +
        `<span id="cloud-retry-msg" style="opacity:.9;white-space:nowrap"></span>`;
      const btn = document.getElementById('cloud-retry-now');
      const msg = document.getElementById('cloud-retry-msg');
      if (btn) btn.onclick = () => {
        btn.disabled = true; btn.style.opacity = '.6'; if (msg) msg.textContent = t('Saving…', 'جارٍ الحفظ…');
        Promise.resolve(window.Storage && window.Storage.retryNow ? window.Storage.retryNow() : { ok: false })
          .then(r => {
            if (r && r.ok) { try { bar.remove(); } catch (_) {} try { toast('✅ ' + t('Saved to cloud', 'حُفظ في السحابة'), 'success'); } catch (_) {} }
            else { btn.disabled = false; btn.style.opacity = '1'; if (msg) msg.textContent = t('Still failing — will keep retrying', 'لا يزال يفشل — ستستمر المحاولة'); }
          })
          .catch(() => { btn.disabled = false; btn.style.opacity = '1'; if (msg) msg.textContent = t('Still failing — will keep retrying', 'لا يزال يفشل — ستستمر المحاولة'); });
      };
    } catch (_) {}
  };

  // A record is getting close to Firestore's 1 MB per-document limit — warn the admin
  // by name so it can be cleaned before writes to it start failing. Throttled to once
  // per record per 5 min so it never spams.
  window.__onOversizeRecord = (() => {
    const shown = new Map();
    return (info) => {
      try {
        if (!info || currentRole() !== 'admin') return;
        const key = info.collection + '/' + info.id;
        const now = Date.now();
        if (now - (shown.get(key) || 0) < 300000) return;
        shown.set(key, now);
        let label = key;
        if (info.collection === 'members') { const m = (state.members || []).find(x => String(x.id) === String(info.id)); if (m && m.name) label = m.name; }
        toast('⚠ ' + t(`Record "${label}" is very large (${Math.round(info.bytes / 1024)} KB) and near the storage limit — run 🧹 Fix duplicate subscriptions or contact support.`, `السجل "${label}" كبير جداً (${Math.round(info.bytes / 1024)} كيلوبايت) وقريب من حد التخزين — شغّل 🧹 إصلاح الاشتراكات المكررة.`), 'error');
      } catch (_) {}
    };
  })();

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

  // AUTO-HEAL the duplicate-subscription bloat on load (v6.297.0). The clones grew a
  // few member documents to ~1 MB — Firestore's HARD per-document limit — so any
  // further write to them was REJECTED (invalid-argument): the "error while saving"
  // seen across machines. The save-time backstop fixes this on the next write; doing
  // it here too means every ADMIN device self-heals the instant it loads (no edit
  // needed), and the shrunk records propagate to every other machine via sync. One-shot
  // (only when duplicates are actually present), admin + cloud only (they can write
  // member records; member/coach logins are read-scoped).
  try {
    if (window.Storage.isCloud() && typeof currentRole === 'function' && currentRole() === 'admin') {
      const collapsed = (typeof _dedupeSubsGuard === 'function') ? _dedupeSubsGuard() : 0;
      if (collapsed > 0) {
        console.warn(`[auto-heal] collapsing ${collapsed} duplicate subscription row(s) and saving to shrink oversized member document(s)…`);
        setTimeout(() => {
          try {
            if (typeof saveConfirmed === 'function') {
              saveConfirmed().then(r => {
                try { toast((r && r.ok ? '🧹 ' : '⚠ ') + t(`Cleaned up ${collapsed} duplicate subscription row(s)`, `تم تنظيف ${collapsed} صف اشتراك مكرر`), r && r.ok ? 'success' : 'info'); } catch (_) {}
              }).catch(() => {});
            } else { save(); }
          } catch (_) {}
        }, 1500);
      }
    }
  } catch (_) {}

  // Subscribe to remote updates from other users (cloud only) — REAL-TIME AUTO-MERGE.
  // In the multi-document model the storage layer pushes a fresh snapshot whenever
  // ANY record changes anywhere (another receptionist adds a member, a coach marks
  // attendance, the owner records a payment). We merge it into the open session with
  // the existing record-level merge engine (mergeRemoteIntoState keeps local edits on
  // a genuine clash), then re-render so other users' changes appear live — UNLESS this
  // user is mid-edit (a modal is open or a field is focused), in which case we defer
  // the re-render until they're idle so we never yank a half-typed form out from under
  // them. Their data is already safely merged into state in the meantime, and the
  // cloud copy is never corrupted (per-record, field-level, deep-merged writes).
  if (window.Storage.isCloud()) {
    let _remoteRenderPending = false, _remoteRenderTimer = null;
    // Track the last moment the user interacted, so we can tell "actively working"
    // (scrolling / reading / hovering / typing) from "idle". While active we DON'T
    // redraw the page under them — the change is already merged in state, and we
    // apply it the moment they pause, so the screen never jumps mid-work.
    window.__lastInteractAt = window.__lastInteractAt || 0;
    try {
      const mark = () => { window.__lastInteractAt = Date.now(); };
      ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll', 'mousemove'].forEach(ev =>
        window.addEventListener(ev, mark, { passive: true, capture: true }));
    } catch (_) {}
    const ACTIVE_MS = 3500;   // consider the user "busy" for this long after any interaction
    const isBusyEditing = () => {
      try {
        if (document.querySelector('.modal-overlay, .modal, [role="dialog"], #blocked-save-modal')) return true;
        const a = document.activeElement;
        if (a) {
          const tag = (a.tagName || '').toUpperCase();
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || a.isContentEditable) return true;
        }
        if (Date.now() - (window.__lastInteractAt || 0) < ACTIVE_MS) return true;   // scrolling / hovering / reading
      } catch (_) {}
      return false;
    };
    // Redraw while KEEPING the current scroll position, so incoming changes update
    // the content in place instead of snapping the page to the top ("the flicker").
    const _renderKeepScroll = () => {
      let y = 0;
      try { y = _getScroll(); } catch (_) {}
      try { render(); } catch (e) { console.warn('[sync] render failed:', e); return; }
      try { requestAnimationFrame(() => requestAnimationFrame(() => { try { _setScroll(y); } catch (_) {} })); } catch (_) {}
    };
    const applyRemote = (remoteState) => {
      if (!remoteState) return;
      let res;
      try { res = mergeRemoteIntoState(remoteState); }
      catch (e) { console.warn('[sync] merge failed:', e); return; }
      if (!res || !res.changed) return;
      if (res.conflicts > 0) {
        try { toast(t(`Synced — ${res.conflicts} record(s) you were also editing kept your version`, `تمت المزامنة — احتُفظ بنسختك في ${res.conflicts} سجل`), 'info'); } catch (_) {}
      }
      if (isBusyEditing()) {
        // Don't touch the screen while they're working — merge silently, flag it.
        _remoteRenderPending = true;
        try { showNewerDataNote(); } catch (_) {}
      } else {
        // Idle: coalesce a burst of remote snapshots into ONE scroll-preserving redraw
        // after a short quiet gap (and re-check they didn't just start interacting).
        clearTimeout(_remoteRenderTimer);
        _remoteRenderTimer = setTimeout(() => {
          if (isBusyEditing()) { _remoteRenderPending = true; try { showNewerDataNote(); } catch (_) {} return; }
          _renderKeepScroll();
        }, 400);
      }
    };
    window.Storage.onRemoteUpdate(applyRemote);
    setInterval(() => {
      if (_remoteRenderPending && !isBusyEditing()) {
        _remoteRenderPending = false;
        try { const n = document.getElementById('newer-data-note'); if (n) n.remove(); } catch (_) {}
        _renderKeepScroll();
      }
    }, 1500);
  }

  // ── DATA-LOSS SAFETY NET: never lose an in-flight change on tab close/hide ──
  // Flush any throttled-but-unsent cloud write immediately, and take a final local
  // backup snapshot. visibilitychange→hidden is the reliable hook (fires on
  // tab-switch / app-background, page still alive so async completes); pagehide /
  // beforeunload are best-effort belt-and-suspenders for a hard close.
  const _flushOnExit = () => {
    try { if (window.Storage && window.Storage.flushPending) window.Storage.flushPending(); } catch (_) {}
    try {
      if (window.Storage && window.Storage.snapshotBackup) {
        const { user, route, session, ...persistable } = state;
        window.Storage.snapshotBackup(persistable, 'exit', true);
      }
    } catch (_) {}
  };
  try {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') _flushOnExit(); });
    window.addEventListener('pagehide', _flushOnExit);
    window.addEventListener('beforeunload', (e) => {
      _flushOnExit();
      // If a change is confirmed NOT yet in the cloud, block the refresh/close with the
      // browser's native "Leave site?" prompt so it can't be lost by an accidental reload.
      try {
        if (window.Storage && window.Storage.hasUnsavedCloud && window.Storage.hasUnsavedCloud()) {
          e.preventDefault(); e.returnValue = ''; return '';
        }
      } catch (_) {}
    });
  } catch (_) {}

  // Set initial route from URL hash
  const hash = location.hash.slice(1);
  if (hash && ROUTES[hash]) state.route = hash;

  // Show login
  render();
  try { _idleReset(); } catch (_) {}   // start idle auto-logout if a session was restored

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

  // ─── Global keyboard shortcuts ─────────────────────────────────
  // Press "/" to focus the first search box on the current page.
  // Ignored when the user is already typing in an input/textarea.
  document.addEventListener('keydown', (e) => {
    // Cmd+K / Ctrl+K → global command palette (jump anywhere)
    if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      openCmdK();
      return;
    }
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.target.isContentEditable) return;
    // Find the first visible input that looks like a search box
    const candidates = document.querySelectorAll('input[type="text"], input[type="search"], input[id*="search"], input[placeholder*="earch"]');
    for (const inp of candidates) {
      if (inp.offsetParent !== null) {  // visible
        e.preventDefault();
        inp.focus();
        inp.select?.();
        return;
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// Cmd+K Command Palette — global quick-jump search
// Triggered by Ctrl+K / Cmd+K from any page. Searches:
//   • Members (active first, then archived)
//   • Coaches/staff
//   • All navigation routes (pages)
// Selecting jumps to the page or opens member detail.
// ═══════════════════════════════════════════════════════════════════
function openCmdK() {
  // Security: the command palette can jump to members, coaches, money pages —
  // it must never be reachable before login. Bail out if no user is signed in.
  if (!state.user) return;
  // Don't open twice
  if (document.querySelector('.cmdk-backdrop')) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'cmdk-backdrop';
  backdrop.innerHTML = `
    <div class="cmdk-palette" role="dialog" aria-label="Quick search">
      <div class="cmdk-input-wrap">
        <span class="cmdk-icon">🔎</span>
        <input id="cmdk-input" class="cmdk-input" type="text" placeholder="Search members, coaches, pages…" autocomplete="off" spellcheck="false" />
        <span class="cmdk-hint">ESC</span>
      </div>
      <div id="cmdk-results" class="cmdk-results"></div>
      <div class="cmdk-footer">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span><kbd>↵</kbd> open</span>
        <span><kbd>esc</kbd> close</span>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const input = backdrop.querySelector('#cmdk-input');
  const results = backdrop.querySelector('#cmdk-results');
  let activeIdx = 0;
  let currentItems = [];

  function close() {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  }

  function buildItems(query) {
    const q = query.trim().toLowerCase();
    const items = [];

    // Pages — always shown, filter by query
    const pages = Object.entries(ROUTES).map(([key, route]) => ({
      type: 'page',
      icon: route.icon,
      title: route.label,
      subtitle: route.section,
      action: () => { navigate(key); },
      score: scoreMatch(q, route.label.toLowerCase()),
    })).filter(p => !q || p.score > 0);

    // Members — active first, archived last
    const members = state.members.map(m => ({
      type: 'member',
      icon: m.deleted ? '📦' : '👤',
      title: m.name + (m.nameArabic ? ' · ' + m.nameArabic : ''),
      subtitle: [
        m.deleted ? 'Archived' : memberStatus(m),
        m.sport,
        m.phone ? formatPhone(m.phone) : null,
      ].filter(Boolean).join(' · '),
      action: () => { window.viewMember?.(m.id); },
      score: scoreMatch(q, (m.name + ' ' + (m.nameArabic || '') + ' ' + (m.phone || '') + ' ' + (m.phone2 || '') + ' ' + (m.qid || '')).toLowerCase()),
      _archived: !!m.deleted,
    })).filter(m => !q || m.score > 0);

    // Coaches
    const coaches = state.coaches.map(c => ({
      type: 'coach',
      icon: c.role === 'staff' ? '👔' : '🥋',
      title: c.name,
      subtitle: [
        c.role === 'staff' ? 'Staff' : 'Coach',
        isCoachActive(c) ? 'Active' : 'Inactive',
        c.phone ? formatPhone(c.phone) : null,
      ].filter(Boolean).join(' · '),
      action: () => { navigate('coaches'); },
      score: scoreMatch(q, (c.name + ' ' + (c.phone || '')).toLowerCase()),
    })).filter(c => !q || c.score > 0);

    // Sort each group by score (descending), then alphabetically
    pages.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    members.sort((a, b) => {
      if (a._archived !== b._archived) return a._archived ? 1 : -1;
      return b.score - a.score || a.title.localeCompare(b.title);
    });
    coaches.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

    // Cap each section so the palette stays focused
    const capped = (arr, n) => arr.slice(0, n);

    if (!q) {
      items.push({ section: 'Pages' });
      capped(pages, 8).forEach(p => items.push(p));
    } else {
      if (members.length) { items.push({ section: 'Members' }); capped(members, 8).forEach(m => items.push(m)); }
      if (coaches.length) { items.push({ section: 'Team' });    capped(coaches, 5).forEach(c => items.push(c)); }
      if (pages.length)   { items.push({ section: 'Pages' });   capped(pages, 6).forEach(p => items.push(p)); }
    }
    return items;
  }

  // Simple fuzzy-ish scoring: exact match > startsWith > contains > word-boundary contains
  function scoreMatch(q, hay) {
    if (!q) return 1;
    if (!hay) return 0;
    if (hay === q) return 100;
    if (hay.startsWith(q)) return 80;
    // Word boundary match (any word starts with query)
    if (new RegExp('\\b' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(hay)) return 60;
    if (hay.includes(q)) return 40;
    return 0;
  }

  function renderResults() {
    const q = input.value;
    const items = buildItems(q);
    currentItems = items.filter(i => !i.section);
    if (!currentItems.length) {
      results.innerHTML = '<div class="cmdk-empty">No matches. Try a member name, phone, or page name.</div>';
      activeIdx = 0;
      return;
    }
    activeIdx = Math.min(activeIdx, currentItems.length - 1);

    let html = '';
    let itemIdx = 0;
    for (const it of items) {
      if (it.section) {
        html += `<div class="cmdk-section">${escapeHtml(it.section)}</div>`;
      } else {
        const isActive = itemIdx === activeIdx;
        html += `
          <div class="cmdk-item ${isActive ? 'active' : ''}" data-idx="${itemIdx}">
            <div class="cmdk-item-icon">${it.icon}</div>
            <div class="cmdk-item-text">
              <div class="cmdk-item-title">${escapeHtml(it.title)}</div>
              <div class="cmdk-item-subtitle">${escapeHtml(it.subtitle || '')}</div>
            </div>
          </div>`;
        itemIdx++;
      }
    }
    results.innerHTML = html;

    // Bind clicks
    results.querySelectorAll('.cmdk-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx);
        const item = currentItems[idx];
        if (item?.action) {
          close();
          item.action();
        }
      });
      el.addEventListener('mouseenter', () => {
        activeIdx = parseInt(el.dataset.idx);
        results.querySelectorAll('.cmdk-item').forEach((x, i) => x.classList.toggle('active', i === activeIdx));
      });
    });

    // Scroll active item into view
    const active = results.querySelector('.cmdk-item.active');
    active?.scrollIntoView({ block: 'nearest' });
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, currentItems.length - 1);
      renderResults();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
      renderResults();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = currentItems[activeIdx];
      if (item?.action) {
        close();
        item.action();
      }
    }
  }

  input.addEventListener('input', renderResults);
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

  renderResults();
  // Defer focus to next frame so the modal animation completes
  requestAnimationFrame(() => input.focus());
}
window.openCmdK = openCmdK;

// Helper: format a phone for display (uses parseStoredPhone if available)
function formatPhone(stored) {
  if (!stored) return '';
  try {
    const p = parseStoredPhone(stored);
    return p.code + ' ' + p.digits;
  } catch (e) {
    return stored;
  }
}

window.addEventListener('DOMContentLoaded', init);
