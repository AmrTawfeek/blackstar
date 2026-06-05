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
confirm footer reads v5.4.0.

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
