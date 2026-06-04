# Black Stars CRM
Version 4.98.0 — Edit Invoice can correct the paid/due amount; club phone fixed.

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
confirm footer reads v4.98.0.

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
