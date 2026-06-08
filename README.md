# Black Stars CRM
Version 5.4.0 — Summer Camp: Day Off for Fri/Sat, coach dropdown, activity icons, admin drag-and-drop.

## 1. Salaries — settle up to a date (NEW)
On Salaries & Commissions, next to the month dropdown there's now an
**"or settle up to:"** date field. Pick a date (e.g. a coach's last working day)
and each person is recalculated for that date's month, counting only what happened
**on or before that date**:
- Attendance basis: only classes attended up to that date are paid; classes not
  yet attended show as **pending** ("stays with the club if they leave").
- Payment basis: only invoices dated on/before that date count.
- Fixed salary is **prorated by days** for the partial month (shown as
  "prorated from …").
Clear the date to return to the whole-month view. Month dropdown = everyday
payroll; date field = departures / settlements.

This answers "if a coach leaves on this date, how much does he get?" — everything
attended up to that day. Pending (unattended, paid) is shown separately and is NOT
paid to a leaving coach; it stays with the club for the next coach.

## 2. Coach commission — "by attendance" basis (opt-in, OFF by default)
Settings → Coach Commission Rates → Commission basis. "By attendance" pays per
class attended, in the month attended (fee ÷ total classes × rate); the rest is
pending and pays as attended or as a true-up at expiry. No-class-count memberships
and sport-switch credits stay on payment basis; Summer Camp earns nothing.
Switching basis never rewrites past payments and is reversible.

## 3. Firebase (cloud + multi-device)
See FIREBASE-SETUP.md — app already wired; backup/restore persist through whatever
storage is active. Real login + live sync + daily-email backup switch on once you
create the project and send the config.

## Tests
`tests/` — 109 logic assertions (both commission bases, settlement date cap,
lifetime pending, fixed proration, payment date cap) + all 24 pages render in both
modes. Run: node tests/logic-tests.js and node tests/render-tests.js.

## To load
Replace files in C:\Users\kshawky\Desktop\CRM\blackstars-localhost\, refresh,
confirm footer reads v5.27.0.

## 4.85.0 note — frozen vs expired (attendance basis)
- Member still ACTIVE → coach paid per class attended; rest pending.
- Validity/grace period FINISHED (expired, not frozen) → coach paid the FULL
  amount; the unattended classes true up that month.
- Member FROZEN → coach paid only for classes attended so far; the remainder
  stays PENDING (membership is paused, not finished) and is NOT paid out until
  the member returns and attends, or the membership later actually expires.


## 4.86.0 note — renewal reminders
WhatsApp renewal reminders are now ALWAYS bilingual, **Arabic first** then English,
even for members with no Arabic name (the Arabic half falls back to the Latin name).
The wording is more motivational and includes emojis (👋 🔥 💪 🥋 ⭐). You can still
edit the wording in Settings → Reminder templates; click "Restore defaults" there to
pull in this new bundled copy if you had previously customized it.


## 4.87.0 note — phone search
The Members search box now matches phone numbers by their digits, ignoring spaces
and the +974 country code. Pasting "+974 6699 5549" finds a member stored as
"6699 5549", "66995549", or "+974 6699 5549"; typing just "6699" matches as a
partial. (Duplicate detection when adding/importing already worked this way.)


## 4.88.0 note — switch commission basis from the Salaries screen
You no longer need to dig into Settings. The Salaries & Commissions screen now has
a **"Commission basis"** dropdown at the top: choose **By attendance** and the rows
recalculate instantly (e.g. a member who attended 2 of 6 classes shows 2/6 of the
fee now, with the rest as pending). The Revenue Detail report/PDF also prints the
active basis in its header, so you can always tell which mode produced a number.


## 4.89.0 note — settlement is now cumulative
"Settle up to a date" now shows everything a coach has earned from the start
through that date (not just the date's calendar month). Example: a member who
attended 2 of 6 classes in June, membership ending 02 Jul —
  • settle to 01 Jul  → 100 earned + 200 pending
  • settle to 02 Jul  → full 300 (expiry true-up), 0 pending
Advances are likewise summed up to the settlement date.


## 4.90.0 notes
- **Archived members are now excluded from commission and the coach reports.** When
  you archive (delete) a member they no longer count toward any coach's salary or
  appear in the Revenue Detail report — treated as if they don't exist. They still
  show on the Members page when you filter Status = Archived. (Restoring the member
  brings their figures back.)
- **Find duplicates** button on the Invoices page: scans for Membership invoices
  with the same member, sport, month and amount (a real double-entry, like the two
  identical lines you saw) and lets you delete the extras. The first in each group
  is kept.


## 4.91.0 note — duplicates are now prevented at creation
The **New Invoice** form now warns before saving a Membership invoice that matches
an existing one (same member, sport, month and amount) and lets you cancel — so a
second identical invoice isn't created by accident. "Generate latest invoice"
already had this guard; the "Find duplicates" tool remains for anything that slips
in via import.


## 4.92.0 notes — sport enrollments
- **No duplicate sports.** Adding or editing a member now blocks saving if the same
  sport appears twice ("X is enrolled more than once…"). One active enrollment per
  sport; use Switch Sport to change a sport.
- **Delete a mistake.** Paid enrollment rows now have a 🗑 button (next to ↩ Withdraw).
  It removes the enrollment, its subscription and its invoice line entirely with NO
  refund record — for sports added by accident. Withdraw is still there for real
  refunds. Unpaid rows keep the ✕ remove button.
- **Per-sport start date.** Each enrollment row has a 📅 Start date. A sport added
  later (member returns a week later for another sport) can start on its own date —
  that sport's subscription window and invoice use it. Blank = the member's start date.


## 4.92.1 note — QA pass
Two refinements found during testing: the Add-member path now also honors per-sport
start dates (it was edit-only), and the per-row 📅 Start date now appears only on
newly-added sport rows (so it's never shown where it wouldn't take effect). Test
suite expanded to 156 assertions including enrollment edge cases (duplicate Summer
Camp, unpaid-enrollment delete, other-member invoices untouched, absent-sport no-op).


## 4.93.0 note — per-sport start + validity (member form redesign)
- **Each sport is its own card.** Sport, coach, classes, price on the top row;
  its own 📅 Start date + Validity on the second row; a live "expires …" line per
  card. Editing a paid sport's start/validity now adjusts that sport's window.
- **No more confusing member-level dates.** The old member-level "Start / renewal"
  and "Expiry" inputs are gone. Membership expiry is shown as a read-only value =
  the latest sport end. Member start = the earliest sport start.
- **First registration kept.** If left blank it is set to the earliest sport's
  start date.
- **Legacy-safe.** When an older subscription has no stored validity, it is
  recovered from its start→end span so existing end dates are never silently
  changed when you open and save a member.
- Tests: 164 assertions (added per-sport validity derivation, first-registration
  fallback, earliest-start, and legacy-end preservation).


## 4.94.0 note — correctness + data safety (batch 1 of 2)
- **Coach-change bug fixed.** Editing a sport's coach now UPDATES that
  subscription (and re-attributes its invoice line so commission follows the new
  coach) instead of silently creating a second subscription + invoice for the
  same sport. Matching is by sport (one active enrollment per sport).
- **Import de-dupes sports.** The Excel importer now keeps ONE enrollment per
  sport per member (prefers the Active row, else the latest start) and reports
  how many duplicate rows were merged. Subscription history is preserved. This
  was the most likely source of the duplicate Kick Boxing rows.
- **Data safety.** Verified the backup→restore round-trip preserves members,
  invoices and the new per-sport start/validity/end. Backup tooling (manual
  export + 7-day reminder + storage-full warnings) already ships. Firebase cloud
  sync is wired and waiting on your project config (see FIREBASE-SETUP.md) — that
  activation + live test is the one piece I can't do from here.
- Tests: 170 assertions + an end-to-end import-dedup test (tests/import-test.js).


## 4.95.0 note — partial payments (UI completion)
The payment model was already cash-basis (revenue counts what's collected, in the
month it's received) with commission staying on the full fee. This release finishes
the UI around it:
- **Invoices list** shows a Partial / Unpaid badge + the balance due on each invoice.
- **💵 Pay** button on any unpaid/partial invoice opens a Record-payment dialog
  (amount defaults to the balance, pick date + method). It can't collect more than
  is owed, and the payment lands as revenue in the month of its date.
- **Member profile** shows a "💰 X due" badge when the member has any outstanding
  balance across their invoices.
- The New Invoice form's existing "Paid now" field is unchanged (type less than the
  total to start a partial).
- Tests: 181 assertions incl. the full partial lifecycle (300 now → 350 later),
  cash-by-month attribution, legacy-invoice = fully paid, and member-outstanding.


## 4.96.0 note — Scan Qatar ID (OCR auto-fill)
- The Add/Edit Member form has a **📷 Scan Qatar ID** button. Upload (or, on a
  phone, photograph) a residency-permit and it auto-fills English name, Arabic
  name, QID, birthdate and nationality.
- OCR runs **in the browser** via Tesseract.js, loaded from a CDN the first time
  you scan — so it needs an internet connection. Nothing is uploaded to a server.
- It fills only EMPTY fields (never overwrites what you typed) and reports what it
  read vs. couldn't — **always verify**, especially the Arabic name, which is the
  least reliable to OCR.
- The text→fields parser is unit-tested against this exact card layout (QID is the
  11-digit ID not the 14-digit serial; birthdate comes from the D.O.B line not the
  expiry dates; names + nationality; and no false fills on a blank scan). The
  image→text OCR step itself can only be verified in a real browser.
- Tests: 188 assertions.


## 4.97.0 note — deposit at enrollment
- The Add Member form's First payment section now has a **Paid now (deposit)** field
  (blank = pay in full). A live hint shows "Paid X · Y due" as you type.
- The enrollment invoice records the deposit as a partial payment; the balance shows
  as due on the invoices list, the member profile, and the printed/WhatsApp invoice.
- **The invoice document now shows Total, Paid, and Balance due** (PDF totals block +
  WhatsApp message) whenever it isn't paid in full. The success popup also shows
  "X paid · Y due".
- Settle the balance any time later with the 💵 Pay button on the Invoices list.
- Tests: 192 assertions (incl. deposit→balance, status Partial, deposit-only revenue,
  and over-deposit clamping).


## 4.98.0 note — completing & correcting partial payments
Two distinct flows, now both covered:
- **Member pays the rest later** → on the Invoices list, the partial/unpaid invoice
  shows a **💵 Pay** button. It records a dated payment (counts as revenue in the
  month received) and clears the balance.
- **You typed the wrong amount** → open the invoice's ✏️ Edit. It now has **Paid /
  collected** and a live **Balance due** readout alongside the total. Fixing "Paid"
  rebuilds that invoice's payment as a single corrected entry (it's a fix, not a new
  dated payment). You can never set paid above the total, and lowering the total
  below what's paid auto-corrects the paid amount.
- Also fixed: the club's own phone on the invoice now reads +974 3040 0103.
- Tests: 195 assertions (incl. correcting paid 2400→1000 leaving 1400 due, Partial
  status, and corrected revenue).


## 4.99.0 note — recall the member you just worked on
There's a **🕐 Recent** row at the top of the Members page (click a name to open it).
It used to fill only when you *viewed* a member, so one you just *added* didn't show.
Now adding or editing a member also drops it into 🕐 Recent, and the
"Member created" popup has an **✏️ Edit member** button to jump straight back in.
Tests: 199 assertions (incl. recent-list dedupe, cap, newest-first, and dropping
ids that no longer exist).


## 4.99.1 note — name capitalization
- Settings → Data Management → **Aa Fix name capitalisation** Title-cases every
  member's English name in one click (anas madni → Anas Madni, ANAS MADNI → Anas
  Madni). It previews a sample + count and asks to confirm before changing.
- Going forward, saving a member gently fixes an obviously-wrong name (all-lowercase
  or ALL-UPPERCASE) to Title Case, while leaving intentional mixed-case like
  "McDonald" alone.
- Handles hyphens and apostrophes (al-awad → Al-Awad, o'brien → O'Brien).
- Tests: 206 assertions.


## 4.99.2 note — sport-switch deduction + commission column
- **Switch deduction fixed.** A sport/coach switch used to deduct based on the
  nominal enrollment price, so it could claw back MORE than the member actually
  paid the coach (e.g. −542 against a 375 line). It now bases the split on what
  the coach was ACTUALLY credited for that sport, and deducts only the unearned
  part = credited − (attended/planned × credited). The deduction can never exceed
  what was credited. If 0 classes were attended, the whole amount transfers to the
  new coach (instead of vanishing).
- **Commission column** added to the Revenue Detail report (on-screen + PDF):
  each line now shows its commission value (amount × rate) plus a commission total.
- Tests: 215 assertions (incl. 375@1/12 → −343.75, cap ≤ credited, 0-attended,
  all-attended, partial-payment base, and credited-base excluding switch credits).
- NOTE: existing switch records are NOT recalculated. To correct an old switch made
  before this fix, delete that switch and redo it.


## 4.99.3 note — schedule export dropped the 4th class
The schedule PNG export hard-capped each time-slot cell at 3 classes, so a cell with
4+ stacked classes (e.g. Sunday 5–6PM) lost the extras in the exported image even
though the app showed them. The export now renders every class in a cell and grows
the row height to fit them, matching the on-screen schedule.
NOTE: this is canvas-rendered, so it's verified by logic + needs a quick visual
check in the browser after re-exporting.


## 5.0.0 — Summer Camp Schedule page
New left-nav page **☀️ Summer Camp** (under Main). Shows the camp timetable for a
selected day via a **Sunday–Thursday dropdown** (Day 1–5), covering **14 Jun – 27 Aug 2026**.
Three groups — Kids Stars (4-7), Boys Stars (7-12), Girls Stars (7-12) — across the
day's time slots, with the Breakfast & Break, Prayer Break, and Dismissal rows.
All five days are seeded from the published plan (Karate, Swimming, Art, Taekwondo,
Kids Kickboxing, Combat Sports, Gymnastics, Zumba/Jennifer, Ninja Training/Jennifer,
Fitness/Aya, etc.). **Click any class to edit** its activity or coach; **Reset to
default** restores the original. Built on-brand in the app's style (not the cartoon
poster art). Tests: 226 assertions; 25/25 pages render (new page included).


## 5.0.1 note — Duplicate member (for siblings)
The member profile now has a **⧉ Duplicate** button next to Edit. It opens a fresh
Add-Member form pre-filled with the shared family/contact info — phone, second phone,
email, nationality, join date — while leaving the person-specific fields blank (name,
Arabic name, QID, birthdate, level). It copies NO financial data: no enrollments,
invoices, attendance, payments or switches. The form header shows "copied from <name>"
so it's clear it's a new member. Tests: 236 assertions.


## 5.1.0 note — schedule hover: top 10 active members
On the Schedule grid, hovering a class now shows a popover listing the **top 10 most
active members** for that class — ranked by attended classes in that sport. It narrows
to the class's coach when that sport has members with them (otherwise shows everyone in
the sport), excludes archived members, and shows each member's attended count.
NOTE: the popover is hover/positioned in the browser, so it's verified by logic +
needs a quick visual check after loading. Tests: 243 assertions.


## 5.1.1 note
- **Attendance export = all months.** The Data Export → Attendance file now writes
  one tab per month (Mar-2026, Apr-2026, …), oldest→newest, instead of just the
  current month. Each tab lists the members with marks that month, with the same
  green/red Y/N grid and import-compatible columns.
- **Removed the Enrolled Members page** from the nav (it duplicated the Members list).
  The Members page already covers it via search + sport/coach/status filters. (The
  page code is left in place unused, so it's trivial to restore if ever needed.)
- Tests: 250 assertions.


## 5.1.2 note — convert-trial duplicate check + mandatory fields
- **Convert checks for an existing member first.** Converting a trial now looks for a
  member with the SAME mobile + SAME name. If found, it warns and offers to open that
  member's profile instead of creating a duplicate. Same phone with a DIFFERENT name
  (siblings) is allowed through.
- **Mobile is mandatory** (already enforced) and **name now needs a first AND last
  name** (2+ words, English or Arabic) — on both the Add/Edit Member form and the
  Add/Edit Trial form. The trial form's Name and Mobile are marked with *.
- Tests: 258 assertions.


## 5.2.0 note — Summer Camp: print, date picker, duration
- **Printable.** A 🖨 Print button opens a clean, theme-independent printout of the
  selected day (Save-as-PDF works from the print dialog). Header shows the day + date.
- **Date picker + 📅 Today.** Pick a calendar date (14–28 Jun) and the grid jumps to
  that weekday; the day dropdown stays in sync (and vice-versa). Today jumps to the
  current date; off days (Fri/Sat) are flagged.
- **Editable** as before — click any class to change its activity/coach.
- **Duration corrected to 14 Jun – 28 Jun 2026** (existing data with the old end date
  is auto-updated on load, keeping your edits).
- Tests: 265 assertions (incl. 14 Jun→Sunday, Fri/Sat→off day, new end date).


## 5.3.0 note — roles + reminders
- **Roles (preview).** Settings → "Roles — preview" lets you view the app as Admin,
  Coach, or Student. The sidebar shows only that role's screens (Admin = all; Coach =
  Dashboard/Schedule/Summer Camp/Attendance/Members/Trials/Salaries; Student =
  Dashboard/Schedule/Summer Camp/Expiring), and navigation is guarded to the role's
  screens. A "Previewing as …" banner with **Exit** returns to Admin.
  IMPORTANT: this is a UI **preview**, not a security login — anyone on the browser can
  switch back to Admin. Real per-role access control needs online sign-in (Firebase Auth).
- **Reminder timestamp.** Clicking 💬 Remind (single or bulk) now stamps the member and
  shows "✓ Reminded <date · time>" so you can see when they were last contacted.
- **Multi-sport reminders.** If a member has more than one sport, the WhatsApp reminder
  now lists them all (e.g. "Karate & Boxing"), in both the Arabic and English sections.
- Tests: 279 assertions.


## 5.4.0 note — Summer Camp polish
- **Day Off.** Picking a Friday/Saturday date (or Today on those days) now shows a clear
  "🌙 Day Off" panel instead of a schedule (camp runs Sun–Thu).
- **Coach dropdown.** Editing a class now picks the coach from a dropdown of your Team
  (keeps any existing custom name if it's not in the list).
- **Activity icons.** Each class shows an emoji (🏊 Swimming, 🥋 Karate, 🥊 Kickboxing/
  Combat, 🤸 Gymnastics, 🥷 Ninja, 💃 Zumba, 🎨 Art…) on screen and in the printout.
- **Drag-and-drop (admin).** Admins can drag a class from one cell to another to move/
  swap it; coach/student previews can't (view only). Saves automatically.
- Tests: 289 assertions.


## 5.5.0 note — Permanently delete archived members
- New **🗑 Delete forever** button appears only on **archived** members (you must
  archive first — active members can't be hard-deleted by accident).
- Opens a dialog showing any linked financial records and an irreversibility warning,
  with a backup tip. You choose the scope:
  - **Member only (keep records)** — erases the person but keeps their invoices/sales
    as history (they keep the stored customer name).
  - **🗑 Delete everything** — also purges that member's invoices, sales, and rentals.
- Each choice asks a final confirmation, then writes an audit entry (`member.purge`).
- Unlike Archive, this **cannot be undone** — back up first (Settings → Backup).
- Tests: 295 assertions.


## 5.6.0 note — Arabic schedule export
- The Schedule page now has a **📸 PNG (عربي)** button next to the English export.
- The Arabic poster is fully right-to-left: TIME column on the right, days run
  Saturday → Thursday from right to left, with Arabic day names, sport names
  (السباحة، الكاراتيه، الكيك بوكسينغ، الملاكمة، الجمباز، كرة القدم…), Arabic month
  (يونيو 2026) and footer.
- Coach names use each coach's Arabic name (`nameArabic`) when one is set, otherwise
  the English name is kept.
- Reusable helpers added for future full-app Arabic: sportNameAR, dayNameAR,
  monthNameAR, timeLabelAR.
- Tests: 306 assertions.


## 5.7.0 note — Members table: columns, Arabic-name column, export choice
- **Export choice.** The Members **📥 Export CSV** button now asks whether to export the
  **Filtered (current view)** set or **All members** — both write the full CSV (incl. Arabic name).
- **Column chooser.** New **🧩 Columns** button lets you show/hide extra columns:
  Arabic Name, QID, Nationality, Email, Phone 2, Joined, Level, Birthdate, Outstanding.
  Your choice is saved. Member / Sport / Coach / Attendance / Last Renewal / Expiry /
  Status are always shown.
- **Arabic name is now its own column** (on by default). The Member cell now shows just
  the English name + mobile; the Arabic name moved into its dedicated column.
- **Add-sibling shortcut.** Each member row has a ⧉ button that copies the member's phone
  and family details into a new Add-Member form (the "brothers / siblings" duplicate — it
  was already on the profile; now it's one click from the list too).
- Tests: 306 assertions.


## 5.8.0 note — Members table: click-to-sort + per-column filters
- **Sort by any column.** Click a column header to sort by it; click again to reverse.
  An arrow shows the active column/direction (▲/▼), and ⇅ marks sortable columns.
  Sorts by name, Arabic name, sport, coach, attendance %, last renewal, expiry, status,
  and any optional column you've enabled (QID, nationality, joined, outstanding…).
- **Per-column quick filter.** Each text/identity column header has a small filter box —
  type to narrow the table on just that column (e.g. coach = "Anis", sport = "MMA").
  Column filters combine with each other and with the existing search/dropdown filters.
- Both work alongside the column chooser; non-text columns (Attendance, Last Renewal,
  Expiry) are sortable but don't show a filter box.
- Tests: 306 assertions.


## 5.9.0 note — Members table: smart column filters + fuzzy name search
- **Smart filter controls per column.** Enumerable columns now filter with a **dropdown**
  (Sport, Coach, Nationality, Level, Status) and date columns with a **date picker**
  (Expiry, Last Renewal, Joined, Birthdate) instead of free text.
- **Fuzzy name search.** The Member and Arabic Name filters are typo-tolerant — searching
  "mohamed" finds "Mohammed", "khalid" finds "Khaled", etc. The Member box also still
  matches phone/email.
- **Every column is show/hide now.** The 🧩 Columns chooser lists all columns (Sport,
  Coach, Attendance, Last Renewal, Expiry, Status included); only the **English name**
  (Member) is always shown. "Reset to default" restores the standard set.
- Column visibility is saved (settings.memberColsV2). Sorting works on every visible column.
- Tests: 316 assertions.


## 5.9.1 note — Removed per-column filters; search box is now fuzzy
- Removed the per-column header filter row (it duplicated the existing top filter bar:
  status / sports / coaches / nationalities / data-quality).
- The main **search box** is now typo-tolerant for names — "mohamed" finds "Mohammed",
  "khalid" finds "Khaled" — on top of its existing substring + phone matching.
- Kept: click-a-column-header **sorting** (arrows) and the 🧩 **Columns** show/hide chooser.
- Tests: 316 assertions.


## 5.10.0 note — Add Sibling copies everything; trimmed row actions
- **Add Sibling (⧉)** now copies **all** of a member's profile + plan details (name,
  Arabic name, QID, birthdate, level, phone/phone 2, email, nationality, address, notes,
  sport/coach and every enrollment with its classes/price). The new record gets a fresh
  id and opens in the Add-Member form pre-filled — just update the name/QID and save.
- It deliberately does **not** copy attendance, subscriptions, expiry, payments, freezes,
  switches or archive flags, so the sibling starts as a fresh unpaid registration
  (saving creates their own invoice — no double-counted revenue).
- Removed the row **👁 View** icon (click the row to open the card) and the **📜 History**
  icon (history lives inside the member card). Row actions are now: 🔄 renew · 🔀 switch ·
  ⧉ sibling · ✏️ edit · 🗑 archive.
- Tests: 330 assertions.


## 5.11.0 note — Membership expiry is now editable (still auto by default)
- The member form's **Membership expiry** is now an editable date input instead of a
  read-only readout. By default it auto-fills with the latest sport end and keeps tracking
  it live as you change start/validity/sports.
- If you type your own date it becomes a **manual override** — the auto-recompute stops
  touching it, and a "✎ Manual override · ↻ reset to auto" hint appears. Click **↻ reset
  to auto** to go back to the computed value.
- Editing an existing member whose stored expiry already differs from the auto value opens
  in manual mode (so a previous override is preserved and still editable).
- On save, the expiry you see is the expiry that's stored (clear it to fall back to auto).
- Tests: 333 assertions.


## 5.12.0 note — Withdraw: grace-period refund + Withdrawn status
- The withdraw/refund flow (↩ Withdraw on a paid sport) now factors in a **grace period**
  as well as attendance:
  - Member keeps the value of classes attended (perClass × attended).
  - The unused portion is refundable. **Within the grace window** (default 7 days from the
    sport's start) the full unused amount is refunded; **after grace** a configurable admin
    fee (default 20% of the unused) is deducted.
  - The modal shows the breakdown live (days since start, within/after grace, used, unused,
    fee) and lets you tweak the grace days, fee %, and final refund per withdrawal.
  - Defaults come from settings.refundGraceDays / settings.refundFeePct if set.
- New **Withdrawn** member status: when the last sport is withdrawn the member is marked
  **Withdrawn** (badge + status filter + member-form status option). Re-enrolling/editing
  can set them back to Active.
- Tests: 348 assertions.


## 5.13.0 note — Withdrawn polish + refund policy settings (autonomous batch)
Follow-ups that close the loop on the new Withdrawn/refund feature:
- **Re-activation fixed.** Renewing a withdrawn member (🔄) now clears the Withdrawn flag
  (Withdrawn was terminal and would otherwise stick forever). Editing a withdrawn member and
  giving them an enrollment also flips them back to Active automatically.
- **Withdrawn members excluded from renewal noise.** They no longer appear in the dashboard
  expiry alerts, "renewing this week", or the Expiring page (they're not renewing).
- **Members subtitle** now shows a "↩ N withdrawn" count when any exist.
- **Refund policy in Settings.** Preferences now has "Refund grace period (days)" and
  "Admin fee after grace (%)" — these set the defaults used by the ↩ Withdraw refund
  calculator (still overridable per withdrawal).
- Tests: 349 assertions; 25/25 pages render.


## 5.14.0 note — Products: original (cost) value + sell value totals
- Products now have two values: **Original value / cost** (what you paid) and **Sell price**.
  Both are in the New/Edit Product form.
- The table shows **Cost**, **Sell price**, **Stock**, and a per-row **Stock value** (stock × sell).
- Header + KPI cards now show **two totals**:
  - **Sell value** = Σ stock × sell price (the catalog's retail value).
  - **Inventory cost (original)** = Σ stock × cost (the amount paid for current stock —
    "amount supposed to pay"), with the **margin** (sell − cost) shown when costs are set.
- Existing products start with no cost (shows "—"); fill it in via Edit and the cost total
  populates. Tests: 352 assertions.


## 5.15.0 note — Salaries: exclude specific students from a coach's commission
- Each commission-earning coach row on the Salaries page has a new **👥** button.
- It opens a checklist of every member who contributes commission to that coach. **Untick**
  a member to exclude them from this coach's salary (e.g. a comped member or the coach's
  own child); tick to include. "Select all" / "Exclude all" shortcuts included.
- Exclusions are per-coach and persistent (settings.salaryExclusions), and apply to both
  commission bases (payment and attendance). The 👥 button shows the count of exclusions.
- Excluding a member only changes that coach's commission — the member keeps their
  membership, invoices and attendance untouched.
- Tests: 362 assertions (incl. an end-to-end check that excluding a member lowers the
  coach's commission base).


## 5.16.0 note — Expiring: "Recently expired" win-back view (configurable)
- The Expiring page has a new **🔴 Recently expired (≤Nd)** button (with a live count) and a
  matching option in the status filter. It shows members who expired **within the last N days**
  — the win-back window — instead of all 79 ever-expired.
- **N is configurable** in Settings → Preferences → "Recently-expired window (days)" (default 15,
  saved as settings.recentlyExpiredDays).
- Reuses the existing filters/bulk-reminder tools, so you can WhatsApp the recent lapses in one go.
- Tests: 367 assertions.


## 5.17.0 note — Paid enrollment price is now editable (invoice stays in sync)
- The Price field on a PAID sport enrollment is no longer locked — you can correct it.
- On save, changing a paid price **reconciles the linked invoice**: the line item price and
  invoice total update, so REVENUE and COACH COMMISSION follow the new figure (no silent
  desync, which is why it was locked before). An audit entry (`invoice.price_edit`) records
  the old → new price.
- If the invoice was paid in full, it stays paid in full at the corrected amount (treated as
  fixing the recorded price). If it was partially paid, the amount changes and the balance
  due updates accordingly (payments untouched).
- For an actual refund still use ↩ Withdraw; to remove a mistaken enrollment use 🗑.
- Tests: 375 assertions (incl. full-paid and partial-paid reconcile cases).


## 5.18.0 note — Attendance page: 4 fixes
1. **Phone search** now ignores spaces and the country code — typing `66400661` matches
   `+974 6640 0661` / `+97466400661`. Name search also tolerates typos (fuzzy).
2. **"Attended" filter** now narrows the day columns to the attended days only (and
   "Not attended" to absent days). Totals/rate still reflect the full selected scope.
3. **"All months"** now shows a whole-year summary: one column per month with the present
   (Y) count for each student/sport, plus a year Total — instead of just the latest month.
4. **Export PDF / CSV** now follow the on-screen filters: filtered rows, the selected /
   attended day columns, and the all-months summary when "All months" is chosen.
- Tests: 384 assertions.


## 5.19.0 note — Attendance: confirm before changing a mark · removed "Mark all present"
- Clicking an EMPTY cell still marks present (Y) in one tap (fast roll-call). But clicking a
  cell that already has a mark — Y→N, or N→clear — now pops a **confirmation dialog** showing
  the member, day, and the from → to change, so a stray tap can't silently flip a record.
- The **"✓ Mark all present (today)"** button has been **removed** from the Attendance page
  (and its references removed from the in-app guide).
- Tests: 384 assertions · 25/25 pages render.


## 5.20.0 note — Full backup / restore (daily backup) made clearer & safer
- This already existed in **Settings → Data Management**, but is now clearer:
  - **💾 Backup all data (1 JSON file)** exports the ENTIRE database — members, invoices,
    payments, attendance, products, expenses, salaries, settings, audit log — into one
    `blackstars-backup-YYYY-MM-DD.json`. Use it for daily backups.
  - **📂 Restore from backup** loads that file back after a crash, replacing all data.
- Restore is now safer: it shows the backup's date + contents before applying, **auto-downloads
  a safety copy of the current data first** (so a wrong restore is reversible), strips backup
  meta keys, and preserves the live session/route. An audit entry records each restore.
- Tests: 393 assertions (incl. a backup→restore round-trip).


## 5.21.0 note — Cloud-aware messaging (Firebase)
- Confirmed: when firebase-config.js has valid keys (this install), the app loads from and
  saves to Firebase Firestore on every change and syncs across devices; localStorage is only
  an offline cache/safety-net, not the source of truth.
- Fixed misleading "data lives only in this browser" copy. When cloud storage is active the
  app now says data is stored in the cloud and syncs across devices, on: the backup reminder,
  the dashboard backup note, the welcome/empty-state note, and Settings → Data Management.
- The **backup reminder** is now gentler in cloud mode (nudges every 30 days, snoozes 14) and
  reframed as an optional extra offline copy rather than "your data is at risk".
- Settings → Storage Stats now shows the active **Storage backend** (☁️ Firebase vs 💾 browser)
  and labels the local version as a cache in cloud mode. Hard-Reset note clarifies it only
  clears the local cache when cloud is active.
- Tests: 396 assertions.


## 5.22.0 note — Anti data-loss guard (cloud overwrite protection)
- Root cause of "lost data after deploy": cloud saves are a FULL-document overwrite
  (merge:false). If the app ever held empty/partial state — a failed cloud read after a
  deploy, or a device that hadn't synced — the next save overwrote the whole cloud document
  with that empty set, wiping data for every device.
- New guard in storage.js: the app now REFUSES to write an empty dataset over data it knows
  exists. It tracks the last-confirmed record count on load/save, and if a save would replace
  known records with zero, it blocks the write and shows a red banner: "Your data was
  protected … please reload to resync." Genuine "Clear all data" and Restore set an explicit
  override so they still work.
- Also protects the failed-load case: if the cloud read errors (so we can't trust our view),
  empty writes are blocked regardless, until you reload.
- Tests: 401 assertions (incl. the guard: blocks empty-over-good, allows non-empty, honors
  explicit clear/restore, protects after a failed load, lets a fresh install start empty).


## 5.23.0 note — QC report fixes · BATCH 1: coach eligibility (High impact)
Addresses the report's #1 recurring bug — coaches bookable for sports they don't teach.
New shared helpers (coachTeachesSport / coachesForSport / coachOptionLabel): a coach is
offered for a sport only if they ACTIVELY teach it. Applied to:
- Add/Edit Member sport enrollment coach dropdown (refreshes when the sport changes; an
  invalid coach is cleared when you switch the row's sport).
- Class Schedule "add class" coach picker (also drops inactive coaches; shows a note if no
  coach teaches that sport).
- Summer Camp cell coach picker (filtered by the cell's activity when it's a real sport).
- Switch Sport "new coach" list (rebuilds for the chosen new sport).
Coaches with no sports recorded are not over-blocked; non-sport camp activities (Art, etc.)
have no constraint. A currently-assigned but now-ineligible coach is kept visible (labelled)
so historical data is never dropped. Renewal dropdown deferred to a later batch.
Tests: 411 assertions.


## 5.24.0 note — QC report fixes · BATCH 2: Class Schedule (High impact)
- Added **Friday** to the class schedule (grid now Sat→Fri; columns adapt automatically).
- Schedule sports now come from the **enabled sports** in Settings, not a static list — so a
  newly-added sport (e.g. "Dance") appears, and **disabled sports can no longer be booked**.
- A scheduled class whose coach later becomes **inactive** is now flagged (⚠️ + yellow outline +
  "inactive" label) so it can be reassigned or removed.
- A coach can no longer be **double-booked in the same day + time slot** (blocked with a message).
- Tests: 418 assertions.


## 5.25.0 note — QC report fixes · BATCH 4: Roles & Logins (High impact, permissions)
- Roles are now bound to the **login account**, not just a preview toggle. On sign-in the app
  looks up the email in a new **Users & Roles** map (Settings) and applies that role.
- New admin screen **Settings → Users & Roles**: map each Firebase login email → Admin / Coach
  (linked to a coach) / Student (linked to a member). "Unmapped accounts default to" Admin
  (safe, no lock-out) or Student (least-privilege) once you've mapped your admin email.
- Tightened access (fixes the report's permission leaks): Coach sees Schedule, Summer Camp,
  Attendance, Trials — NOT Salaries or the full Members list. Student sees only Schedule &
  Summer Camp — not other members' details (Expiring/Members removed).
- Privilege-escalation closed: only an **admin account** can preview other roles; a coach/student
  login is locked to its role and the "Exit/Back to Admin" button is hidden for them.
- You still create the actual accounts + passwords in Firebase Console → Authentication.
- Tests: 431 assertions.


## 5.26.0 note — Member login by mobile number + My Membership (Batch 4b)
- Members sign in with their **mobile number**; the app maps it to a hidden Firebase login
  (<digits>@members.blackstars.qa). **Default password = their mobile number.**
- **Forced change on first login** (detected because password == mobile); members (and staff)
  can change it anytime via 🔐 Change password. Passwords are stored by **Firebase Auth**
  (salted+hashed) — never in the club database.
- Member accounts auto-resolve to the **Student** role linked to the matching member by phone
  (no manual mapping needed).
- New **My Membership** page (members' home): their status, expiry, balance due, and per-sport
  attendance — their own data only. Members see only My Membership + Schedule + Summer Camp.
- Ships two Firebase-side helpers in `tools/`: `create-member-logins.js` (one-time Admin SDK
  script to bulk-create the member accounts) and `firestore-rules-recommended.txt` (make
  members read-only).
- Tests: 441 assertions; 26 pages render.

### IMPORTANT security caveat
With the current single-document data model, a signed-in member could technically read the
whole club document (all members) via the browser, even though the UI shows only their own.
The recommended rules make members **read-only** (they can't change anything). True per-member
data isolation needs a per-member document restructure — a larger change; ask if you want it.


## 5.27.0 note — QC report fixes · BATCH 3: Rentals (High impact)
- Fixed the **"can't save an edited booking"** bug: editing a booking whose customer is a
  MEMBER crashed (null customer ref) so Save did nothing. Now null-safe; the edit also keeps
  the member link + invoice category in sync.
- **Start time is now mandatory** (it's what enables double-booking detection).
- **Past dates blocked** for new bookings (date picker also greys out earlier days).
- **Archived members can't be booked** — blocked with a clear message.
- **No overlapping bookings** of the same facility on the same date (time-overlap check).
- Deferred: warning when a rental overlaps a *class* on the schedule (cross-system; needs a
  facility↔sport mapping decision) — tell me if you want it.
- Tests: 447 assertions.


## 5.28.0 note — Member login tolerant of country code
- Member logins now work whether the member types their 8-digit number (55512345) OR the
  full form (+974 5551 2345 / 97455512345). The number is canonicalised (974/00 stripped) and
  the login also tries the password as-typed and canonicalised.
- The bulk-create script uses the same canonical form, so accounts are created as
  <8-digit>@members.blackstars.qa with the 8-digit number as the default password.
- NOTE: if you already created a test account with the 974 form (e.g.
  97455546447@members.blackstars.qa / 97455546447), either log in with that exact pair, or
  delete it and recreate as 55546447@members.blackstars.qa / 55546447.
- Tests: 449 assertions.


## 5.29.0 note — One-click "Generate member logins" (admin)
- New admin button in Settings → Users & Roles → **🔐 Generate member logins**. Creates a
  Firebase login for every member with a mobile number (login = mobile, first-time password =
  mobile; they're forced to change it). Members who already have a login are skipped.
- Runs client-side via a SECONDARY Firebase app, so creating accounts does NOT log the admin
  out. Throttled (~150ms each) with a live progress count and a created/existing/failed report.
- Honest limits: this is NOT "on deploy" (a static site has no server); it's a one-click admin
  action you run after deploying. Client-side creation can hit Firebase rate limits for very
  large batches — re-run later, or use tools/create-member-logins.js (Admin SDK) for big runs.
- Tests: 451 assertions (provisioning itself is Firebase-dependent and must be verified live).
