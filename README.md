# Black Stars CRM
Version 6.39.0 - Get Invoice now covers ALL the member's sports (full amount).

## 6.39.0 note - combined member invoice (CRITICAL fix)
"Get Invoice" on the member profile printed only the LATEST single membership
invoice, so a member registered in several sports got a PDF showing just one
sport's amount (e.g. 375 instead of the 750 they actually paid). It now builds a
COMBINED invoice across all of the member's non-deleted membership invoices: every
sport appears as a line item and the Subtotal / Total / Paid reflect the full
amount. The button shows "Get Invoice (N sports)" when there's more than one. The
combined invoice is generated in-memory only for the PDF and never saved, so it
doesn't affect stored data or revenue reports. Members with a single sport are
unchanged. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.38.0 - Transfer Membership: coach/sport filters + better search.

## 6.38.0 note - filter and search the transfer screen
The Transfer Membership screen now has Sport and Coach filter dropdowns on the
"From member" step, and the search box matches English name, Arabic name AND
mobile (any of phone/phone2). The right-side "Members with transferable
memberships" table reflects the same filters + search live (showing "X of Y"),
each member now shows their Arabic name and phone, and clicking a row starts a
transfer from that member/sport. This makes the 257-member list usable. No schema
change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.37.0 - Fix inflated sport member count (was double-counting).

## 6.37.0 note - Sports page count now matches reality
The Sports page count column was adding up enrollment rows PLUS subscription
(history) rows for each sport, so a member with both an active enrollment and a
subscription record - very common for Summer Camp, which renews - was counted
twice or more. That made Summer Camp show 46 when there were really 23 members.
It now counts DISTINCT members currently registered for the sport (headline sport
or an active enrollment), matching the Camp Members and member-list pages. The
column is relabelled "Members". The delete guard still blocks deleting a sport
that has any historical reference (old invoices/attendance), even when the current
count is 0. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.36.0 - Expiring: sort by last-renewal date (asc/desc).

## 6.36.0 note - sort expiring members by last renewal
The Expiring screen has a new Sort dropdown: keep the default Expiry order, or
sort each section by Last renewal date - newest first or oldest first. Members
with no recorded renewal go to the bottom. (Generic column-header sort icons, the
small up/down arrows that appear on clickable headers across all data tables, were
already present - clicking a header sorts the visible rows; this new control sorts
the whole grouped expiring list at the data level.) No schema change.

# Black Stars CRM
Version 6.35.0 - Camp group: manual override for siblings.

## 6.35.0 note - assign a camp member to a different group
The Camp group on the Edit camp member dialog is now a dropdown: "Auto (from age
+ gender)" by default, or pick Kids / Boys / Girls to override it. This keeps
siblings of different ages/genders together when a family asks. The override wins
over the automatic rule everywhere groups are used (member list, group KPI cards
and filters, CSV export). Members on a manual override show a small pencil mark on
their group badge; leaving the dropdown on Auto restores the age+gender rule. The
live preview in the dialog shows what Auto would resolve to vs the chosen override.
No schema change (the override reuses the existing m.campGroup field).

# Black Stars CRM
Version 6.34.0 - Camp Members: expiring-soon card + filter.

## 6.34.0 note - see Summer Camp members expiring soon
The Camp Members screen has a new red "Expiring soon" KPI card showing how many
ACTIVE camp members expire within the next 7 days (same window as the main
Expiring page). Click it to filter the list to just those members; click again to
clear. There's also an "Expiring <= 7 days" option in the filter bar. Already-
expired and withdrawn members are excluded from this count. No schema change.

# Black Stars CRM
Version 6.33.0 - Transactions screen (Insights) with rich filters.

## 6.33.0 note - dedicated Transactions screen
The transaction list that was a pop-up inside Club Revenue Summary is now a full
screen under Insights -> Transactions. It uses the same numbers (one row per
non-deleted invoice) and adds filters: period (Today / Yesterday / This week /
This month / Last month / This year / All time / Custom range), category, payment
method, coach, and a free-text search (customer / ref / sport). It shows a
by-category summary, a paginated table, a grand-total footer, and CSV export. The
Club Revenue Summary "Total revenue" card and Transactions button now open this
screen. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.32.0 - Expenses: payment-method filter + footer totals.

## 6.32.0 note - filter expenses by payment method, see totals
The Expenses screen has a new "All methods" filter (Cash / Card / Bank transfer)
alongside the existing month and category filters. The table now has a footer
showing the filtered total (red), and when any filter is active it also shows the
all-expenses (unfiltered) total beneath it, so you can compare the slice to the
whole. The header count line shows "filtered of total" too. No schema change.

# Black Stars CRM
Version 6.31.0 - Remove active sports that have no attendance yet.

## 6.31.0 note - delete a paid sport that was never attended
The "Manage sport history" panel on the member profile used to list only sports
that were no longer active (switched away). It now ALSO lists active sports that
have ZERO attendance, tagged "active - 0 attended", with a Remove button - so a
duplicate or mistakenly-added paid sport the member never attended can be removed
directly from the profile. Removing it deletes the subscription record and its
share of the linked invoice (Paid drops, commission reversed; no refund record).
Active sports that DO have attendance are still excluded - use Withdraw for those.
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.30.0 - Stronger duplicate-invoice finder (all categories).

## 6.30.0 note - find duplicate invoices across every category
The Invoices page "Find duplicates" tool was Membership-only and required an exact
same-month + same-amount match. It now scans ALL categories (Membership, Product,
Rental, Other) and reports two tiers: Exact (same customer, items, month AND amount)
and Possible (same customer, items and amount dated within 7 days - catches copies
that straddle a month boundary or near-identical re-entries; review before deleting).
Deleted, switch-credit and refund/credit invoices are excluded. The first invoice in
each group is kept; you delete the extras (with a confirm). No schema change.

## 6.29.0 note - Batch A correctness fixes
1. Transfer no longer leaves stale headline fields on the sender. When a sport is
   transferred away, if it was the member's primary sport their headline sport/coach
   repoints to a remaining enrollment (or clears if none), and start/expiry are
   recomputed from what's left - matching Delete sport / Switch Sport. No phantom
   sport with a wrong expiry.
2. Withdrawn members are excluded as a transfer source (UI list + engine guard).
   They can still RECEIVE a transfer (it reactivates them).

## 6.28.0 note - separate payment date from membership start date
The new-member form has a Payment date field (defaults to today) in the First-payment
box, separate from each sport's Start date. Use it when a member pays now but starts
later: the invoice/payment is dated to when cash was collected (revenue counts in the
right month) while the membership window/expiry runs from the Start date. Adding a
sport to an existing member likewise dates the invoice today.

## 6.27.0 note - attendance is per-subscription-period (CRITICAL fix)
Attendance now counts classes attended WITHIN each subscription's own window
(start -> end) instead of every class ever attended, so a renewal does not carry the
previous period forward. Applied to the Subscription History rows, headline KPIs, the
Members-list attendance column, needs-renewal detection, and the per-coach export.
Attendance rate is clamped to 100%. Falls back to the static field when no live marks.

## 6.26.0 note - same mobile allowed for different family members
Same phone + DIFFERENT name (siblings/family) is allowed: a new member gets a one-tap
confirmation naming who else uses that number, then saves as a separate member. Only a
TRUE duplicate (same phone AND same name) is blocked. QID stays unique per person.

## 6.25.0 note - capture customer mobile on invoices
The invoice screen (Membership / Other) has an optional Customer mobile field, like
the POS screen. A linked member's own phone is used automatically; otherwise the typed
mobile is saved. It flows into the invoices CSV export and receipts.

## 6.24.0 note - change a paid sport when there's no attendance yet
In Edit Member, a paid sport with NO attendance can be changed directly (the linked
invoice line and coach commission move with it; revenue unchanged). A paid sport with
>=1 attended class stays locked with a "why locked?" hint offering Withdraw / Switch.

# Black Stars CRM
Version 6.23.0 — Transfer Membership (member → member, one-time per membership).

## 6.23.0 note — transfer a membership from one member to another
New **🔁 Transfer Membership** screen (Membership section, admin only). Pick the
member to transfer FROM — only members with a transferable membership are listed,
each showing their sport(s) and coach — choose which sport, then pick the member
to transfer TO, and confirm.

Rules (as configured):
- The receiver gets a **full reset**: all classes, fresh expiry counted from the
  transfer date, same coach.
- The **payment moves to the receiver** — revenue and coach commission now count
  under them. (If the sender's invoice covered several sports, only the
  transferred sport's value is split out and moved; the rest stays with the
  sender.)
- **One transfer per membership.** A membership that was received via transfer is
  locked and can't be passed on again.

The screen also shows a live list of **members with transferable memberships**
(member · sport · coach · classes) and a full **transfer history** (date, from,
to, sport, coach, classes, amount). Every transfer is written to the Audit Log.
No schema change (SCHEMA_VERSION stays 9); transfers are stored in a new
state.membershipTransfers[] array that older data simply won't have until the
first transfer is made.

## 6.22.0 note — see every transaction behind the revenue total
Club Revenue Summary now has a **🧾 Transactions** view. Click the green
**Total revenue** card (or the new Transactions button in the toolbar) to open a
pop-up listing every invoice counted in the selected period — newest first —
showing **date, category, customer, sport, ref and amount**. The top of the
pop-up summarises totals **by category** (Membership / Product / Court Rental /
etc.), and the footer shows the **grand total** and transaction count. It uses
exactly the same numbers that feed the KPIs and respects the current period
filter (today / this month / custom range…). Deleted and out-of-period invoices
are excluded, same as the totals. An Export CSV button is available from inside
the pop-up too. No schema change (SCHEMA_VERSION stays 9).

## 6.21.0 note — attendance guard before deleting a sport
Removing a sport from a member's history now checks **attendance first**. If the
member actually attended classes in that sport, the confirmation dialog shows a
loud amber warning: **"attended X classes of [Sport] with [Coach]"**, and the
delete button changes to **"🗑 Delete anyway (X attended)"** — so you decide to
proceed or stop instead of wiping real attendance silently. The reason: attended
classes are real, and the coach earned commission for them; deleting reverses
that. If the member genuinely trained in the sport, the dialog points you to
**↩ Withdraw** instead. When there's no attendance, it shows a quiet "safe to
remove" note. The 🧹 Manage sport history panel also tags each obsolete sport
that has attendance with a **🟠 X attended** badge, so you can tell at a glance
before opening the dialog. No schema change (SCHEMA_VERSION stays 9).

## 6.20.0 note — remove obsolete sports from a member's history
The member profile now has a **🧹 Manage sport history** panel (admin only), shown
under the Subscription History table. It lists any sport the member has records
for that is **no longer active** — for example a sport they were switched away
from, or one entered by mistake as a separate paid subscription.

Each obsolete sport shows how many records it has and how much of the member's
**Paid** total it accounts for, with a **🗑 Remove** button. Removing a sport:
- deletes its subscription record(s) and its share of the linked invoice, so the
  member's **Paid** figure drops accordingly (e.g. a member showing 1,500 across
  four sports who really only paid for two now reads 750),
- reverses the coach commission automatically (Revenue Detail, Coach Performance
  and the Team page all read live from the remaining invoice line items),
- creates **NO refund record** — it's a data correction, treated as if the sport
  was never entered.

This reuses the existing, tested `deleteMemberSport()` cleanup (same confirmation
dialog showing exactly how much revenue + payment will be removed, same audit-log
entry). For an **actual refund** where money was returned, keep using **↩ Withdraw**
on the active sport — that intentionally leaves a refund trail. The new panel is
only for switches/mistakes where no money moved.

No schema change (SCHEMA_VERSION stays 9) — existing data is read as-is, never
migrated or wiped. After loading, confirm the footer reads **v6.20.0**.

---

# Black Stars CRM (previous notes)
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


## 5.30.0 note — QC report fixes · BATCH 5: member-count source of truth (Medium)
Fixes the report's "numbers disagree across pages" (active 70/71/78, expired 90/160/90).
- New shared helper `memberCounts()` — strict per-status buckets (active/expired/completed/
  frozen/withdrawn), always computed over NON-archived members.
- Dashboard, Members header, the live "X of Y" counter, and Reports now all use it, so:
  • "Active" is strictly Active (frozen/completed/withdrawn are their own buckets, not lumped in)
  • Expired no longer balloons by counting archived members (Members page used to count over
    ALL members incl. soft-deleted → that was the 160-vs-90 gap)
  • Totals exclude archived everywhere.
- Tests: 457 assertions.
Next Medium sub-batches: Coach Performance / Attendance Report counts, Invoices & Reports
revenue-by-category, Rentals stats.


## 5.31.0 note — Create a user + assign role from the admin screen
- Settings → Users & Roles → **Add user mapping** now optionally CREATES the Firebase login in
  the same step: type an email, choose the role (Admin / Coach / Student), and enter a password.
  Leave the password blank to just map an account you already created in Firebase.
- Creating uses the same secondary-app approach (won't sign the admin out). If the account
  already exists, it just saves the role mapping.
- Tests: 457 assertions (account creation itself is Firebase-dependent — verify live).


## 5.32.0 note — Change password for every role + role-aware sidebar
- Every signed-in account (admin, coach, member) now has a 🔐 **Change password** button in the
  sidebar (cloud only). Updates the password in Firebase Auth; members also still get the
  forced change on first login + the button on My Membership.
- Sidebar now shows the real role + initials (was always "AD / Administrator").
- Security: **Quick backup** (full data export) and Quick search are now admin-only — a coach or
  member can no longer download the whole database from the sidebar.
- Tests: 457 assertions.


## 5.33.0 note — Manage users from the app (create / edit / revoke), no Firebase console
- CREATE: Add user mapping with a password creates the login (already shipped).
- EDIT role/link: in-app (already shipped). EDIT password: 🔐 reset link via ✉️ for STAFF
  (real email). Members reset their own password in-app (their @members address isn't a real inbox).
- DELETE: client SDK cannot delete another user's Firebase account (security limit). Instead,
  ⏸ **Revoke access** disables the mapping so the account is blocked at login (app-level), and
  🗑 removes the mapping. A "revoked" badge shows in the list.
- TRUE delete / resetting another user's password directly requires a Firebase Cloud Function
  (Admin SDK, Blaze plan) — available on request; cannot be done from a static site.
- Tests: 459 assertions.


## 5.34.0 note — Unmapped accounts default to LEAST PRIVILEGE (security fix)
- Previously an account that signed in but wasn't mapped to a role got Admin (chosen to avoid
  lock-out). That meant e.g. test@test.com could see everything. Fixed: once ANY role mapping
  exists, an unmapped account defaults to **Student** (least privilege). With NO mappings yet
  (fresh setup) the first login is still Admin so the owner can configure things.
- Settings → Users & Roles "Unmapped accounts default to" now defaults to Student (recommended);
  Admin is available but flagged "not recommended".
- To lock down test@test.com: either map it explicitly, ⏸ revoke it, or just rely on the new
  Student default. Make sure YOUR admin email is mapped as Admin first.
- Tests: 460 assertions.


## 5.35.0 note — Users & Roles overview + role lookup (one screen)
- Settings → Users & Roles now opens with a role SUMMARY (Admins / Coaches / mapped Students /
  Members→Student / revoked counts) and a "🔎 Check a user's role" box: type any email or mobile
  and it shows the exact role that login will get (same logic as sign-in), plus the linked
  coach/member and how it was resolved (mapped / member mobile / default).
- Note: a browser app cannot LIST Firebase accounts (Admin-SDK only). But since every Admin/Coach
  must be mapped here and everyone else is a Student, this screen is the complete role picture.
- Tests: 460 assertions.


## 5.36.0 note — Member login list (emails to create in Firebase)
- Settings → Users & Roles → **📋 Member login list**: a table of every member with their
  login email (mobile@members.blackstars.qa) and default password (the mobile), since Firebase
  requires a valid email as the username. Members with a missing/short mobile are flagged (can't
  get a login). **Export CSV** gives you the full list (incl. real email if on file) to create or
  cross-check accounts in the Firebase console.
- Tests: 464 assertions.


## 5.37.0 note — Dedicated Users & Roles screen + targeted preview
- New **Users & Roles** screen in the sidebar (System section, admin-only). Settings now links to it.
  Shows the **signed-in account** (email, role, linked coach/member, change-password), full account
  list, role lookup, add/create/revoke, member-login list, and the preview controls.
- Preview reworked: removed the generic "View as Coach/Student". Admin now clicks **Preview as
  coach…/member…** and PICKS a specific coach/member to test as — scoped to that real person's data
  (My Membership shows that member). Exit (top-left) returns to Admin. Preview stays admin-only.
- Regression: 467 logic assertions + 27 pages render, all passing.

### Status of the QC report (NOT fully closed)
High tier done; one Medium sub-batch (member counts) done. ~remaining Medium (stat
inconsistencies in Coach Performance, Attendance Report, Reports/Invoices revenue, Rentals/Team
stats, CSV/search, low-stock, refresh) and all Low (cosmetic) items are still open.


## 5.38.0 note — Gender + age + named role banner
- Member form: new **Gender** field (Male/Female) + a live **age** readout next to birthdate
  (age was already computed from birthdate; now shown while editing too). Gender persists on
  create and edit, and appears on the member detail card.
- Role banner now shows the **person's name** (e.g. "Signed in as Muna · Student") instead of
  just the role, and uses a **pink** accent for female members.
- My Membership header shows the member's name (pink if female) plus age · gender.
- Regression: 470 logic assertions + 27 pages render, all passing.


## 5.39.0 note — SECURITY FIX: enforce role access on render, not just on click
- Bug: a non-admin (e.g. a Student) could SEE a forbidden page (the Dashboard, with revenue/
  expenses) if state.route was left on it after login or a refresh — navigation was filtered but
  the render path rendered whatever route was current without re-checking the role.
- Fix: render() now redirects to the role's home if the current role can't access state.route.
  Login also lands each account on its own home (Student → My Membership, Coach → Schedule).
- Regression: 476 logic assertions + 27 pages render, all passing.
- NOTE: your deployed site shows v5.29.0 — you must deploy this build for the fix to take effect.


## 5.40.0 note — Members can log in with their real email
- If a member has a real email on file, signing in with THAT email now auto-resolves to Student
  linked to that member — no manual Users & Roles entry needed (same as the mobile path).
  Precedence: explicit mapping → mobile synthetic email → member's real email → default.
- Add user mapping: choosing a member for a Student mapping now prefills that member's email.
- Regression: 479 logic assertions + 27 pages render, all passing.


## 5.41.0 note — Settings split into separate menu items + member email search
- New **Settings** nav section with separate pages (admin-only): **Users & Roles**, **Preferences**
  (appearance + alerts/thresholds), **Club Setup** (commission rates, expense categories, WhatsApp
  templates), **Data & Backup** (backup/restore, storage, diagnostic, about). The single monolithic
  "Settings" item is hidden from the sidebar (route still works).
  Implementation keeps ALL existing controls/wiring intact — each page just scopes to its module's
  cards — so nothing in Settings breaks.
- Member search already matches email (name, phone, phone2, QID, email, nationality) — confirmed;
  placeholder lists email.
- Regression: 481 logic assertions + 30 pages render, all passing.


## 5.42.0 note — Searchable member picker in Add user mapping
- The "Which member" field in Add/Edit user mapping is now a **type-to-search** box (name, mobile,
  email, QID; phone-digit tolerant) showing up to 12 matches — instead of a 200+ item dropdown.
  Picking a member fills the box and prefills that member's email if the email field is empty.
- Regression: 481 logic assertions + 30 pages render, all passing.


## 5.43.0 note — Generate member logins: email = username, mobile = password
- "Generate member logins" now targets members who have BOTH a valid email AND a mobile, and
  creates the Firebase account with the **email as the username** and the **mobile as the
  password**. Members missing either are skipped (counted).
- Forced first-login password change now also fires for EMAIL logins (when the typed password
  equals that member's mobile), not just mobile logins.
- Member login list now shows the real email as the login when present (password = mobile).
- NOTE: the earlier run created <mobile>@members.blackstars.qa accounts; those still exist and
  still work (members can sign in by mobile OR email). Delete the synthetic ones in Firebase if
  you want only email logins.
- Regression: 484 logic assertions + 30 pages render, all passing.


## 5.44.0 note — Collapsible sidebar + logged-in user at the top
- Sidebar now has a **collapse/expand** toggle (« / ») in the brand row; collapsed = icons-only,
  state remembered across sessions (localStorage).
- The **logged-in user** (name + role) now shows at the **top** of the sidebar, just under the
  brand (in addition to the footer). Collapses to just the avatar when the sidebar is collapsed.
- Settings already split into separate menu items (v5.41): Users & Roles, Preferences, Club Setup,
  Data & Backup.
- Regression: 484 logic assertions + 30 pages render, all passing (sidebar visuals need a browser
  check — CSS/DOM driven).


## 5.45.0 note — Member logins back to mobile, on the blackstars.com domain
- Member emails are unreliable placeholders, so logins are mobile-based again:
  username = <mobile>@blackstars.com, password = <mobile> (e.g. 50413948 -> 50413948@blackstars.com).
  (Yes, 50413948@blackstars.com is a valid email; Firebase only checks the format, not the domain.)
- Generate member logins: now targets EVERYONE with a valid mobile (no email needed).
- Login accepts BOTH the new blackstars.com domain AND the legacy members.blackstars.qa domain, so
  the ~accounts already created under the old domain still sign in. (Delete the old ones in Firebase
  if you want to avoid duplicates.)
- Member login list shows <mobile>@blackstars.com. Members can also still sign in by typing just
  their mobile number. tools/ script + Firestore rules updated (rules match both domains).
- Regression: 485 logic assertions + 30 pages render, all passing.


## 5.46.0 note — Danger Zone page + forced backup & double-confirm
- Destructive actions (Clear all data, Hard Reset, Load demo data) moved OFF the Data & Backup page
  to their own admin-only **Danger Zone** menu item.
- Each destructive action now: (1) downloads a full backup automatically, then (2) asks for
  confirmation TWICE before it runs.
- Data & Backup keeps the safe tools (Backup, Restore, Fix names, Storage stats, Diagnostic info).
- Regression: 487 logic assertions + 31 pages render, all passing.


## 5.48.0 note — Schedule is read-only (view + export) for coaches & students
- Only admins can edit the Class Schedule. Coaches and students now see a read-only grid:
  no drag palette, no per-class delete (×), no Clear all, no drag-to-move/click-to-edit.
- They can still VIEW the schedule, use the coach/sport filters, and Export PNG (EN + Arabic).
- Subtitle shows "· view only" for non-admins.
- Regression: 488 logic assertions + 31 pages render, all passing.


## 5.49.0 note — Student screen (attendance dates + history) + Coach Advice
- My Membership now shows: an **Attendance log with real dates** (date · sport · present/absent,
  newest first) and a **Membership history** table (subscriptions/renewals: sport, coach, start,
  end, classes, paid), plus a teaser of advice from the coach.
- New **Coach Advice** feature: coaches send advice to their students (pick a student, write a note);
  students read advice addressed to them (read-only) on a "My Advice" page and on My Membership.
  Data: state.advices [{id,memberId,coachId,text,date}]. Coach + student roles can access it.
- Regression: 489 logic assertions + 32 pages render, all passing.
- NOT done this version: full Arabic interface (see notes to user — it's a dedicated project).


## 5.50.0 note — Arabic (member-facing) interface + language toggle
- New language toggle (ع / EN) in the sidebar brand row AND on the login screen. Switches the
  member-facing screens to Arabic and sets right-to-left (RTL) layout. Persisted per browser.
- Translated: Login, role banner, student/coach nav labels, My Membership (all labels, tables,
  statuses, attendance log, history, advice), My Advice page, and the Change-password dialog.
- HONEST SCOPE: the admin/back-office screens remain in English (that's by design — customers only
  see the member screens). Numbers/dates use the existing formatters.
- Regression: 493 logic assertions + 32 pages render, all passing (Arabic rendering/RTL needs a
  browser check).


## 5.51.0 note — Collapsible sidebar groups
- Each sidebar SECTION (Main, Finance, Insights, System, Settings) is now a collapsible group:
  click the section header to fold/unfold its links. A chevron shows the state.
- Collapsed groups are remembered per browser; the group containing the current page always stays
  open. In icon-only (collapsed sidebar) mode all icons remain visible.
- Section headers are translated in Arabic mode too.
- Regression: 493 logic assertions + 32 pages render, all passing.


## 5.52.0 note — Full menu Arabic + name-only member form
- Arabic mode now translates the ENTIRE sidebar menu (not just member items) + the section headers,
  the collapse-menu label, the footer buttons (search/backup/change password/guide/sign out) and the
  role labels — so the menu is no longer a mix of English and Arabic. (Page CONTENT on admin screens
  is still English by design.)
- New member form: ONLY the name is required now. Mobile, sport enrollment, birthdate, etc. are all
  optional — you can save a member with just a name and fill the rest later. Form markers updated
  (Mobile no longer shows *, Sport enrollments marked optional).
- Regression: 493 logic assertions + 32 pages render, all passing.


## 5.53.0 note — Attendance screen shows total attended classes (all students)
- The Attendance page header now shows a green "Attended" figure: the TOTAL number of present (Y)
  classes across ALL students in the current view (the grid month, or every month when "All months"
  is selected). It respects the coach/sport/search filters and updates as you mark cells.
- Regression: 494 logic assertions + 32 pages render, all passing.


## 5.54.0 note — Dashboard translated to Arabic
- The Dashboard page content is now translated in Arabic mode: title, Refresh/Export, the
  "Needs attention today" block (expired/expiring/finished/low-stock), the info row (renewing,
  birthdays, most popular), and all KPI cards (Total Revenue, Active Members, Total Expenses,
  Net Profit, Coaching/Court Rental Revenue, Equipment Sales, Revenue Mix) + chart titles.
- Dates/numbers stay in Western format (month names still English in the date range line).
- Other admin pages (Members, Reports, etc.) are still English — can be done next on request.
- Regression: 494 logic assertions + 32 pages render, all passing.


## 5.55.0 note — Collapsible footer ("More"); Sign out always visible
- The sidebar footer utility links (Quick search, Quick backup, Change password, User Guide) are now
  tucked under a collapsible "More" toggle (collapsed by default). Sign out stays always visible.
- State persisted per browser.
- Regression: 494 logic assertions + 32 pages render, all passing.


## 5.56.0 note — First registration auto-fills (new members) + form tidy
- New member: the First registration date now AUTO-fills with the earliest sport start date and
  tracks it live as you add/change sports (with a hint + "reset to auto" if you type your own).
  Existing members keep their stored value.
- Tidied the First registration / Membership expiry row labels (shorter helper text, hint lines).
- Regression: 495 logic assertions + 32 pages render, all passing.


## 5.57.0 note — Confirm guards on name-only member create
- Name is still the only HARD requirement, but creating a NEW member now asks for confirmation when:
  (a) no mobile number is entered (they can't log in / risk of duplicates), and
  (b) no sport is enrolled (no membership, expiry or invoice).
- This keeps the quick name-only workflow you asked for, while preventing empty members by accident.
- Editing an existing member is not nagged. Regression: 495 logic assertions + 32 pages render, all passing.


## 5.58.0 note — Required fields restored (name + mobile + sport)
- Reverted the name-only relaxation. Adding/editing a member now REQUIRES, as hard blocks (no
  "are you sure" dialogs): a name, a valid mobile number, and at least one complete sport enrollment
  (sport + classes>0 + price>0, plus coach unless Summer Camp).
- Form markers restored: Mobile shows *, Sport enrollments shows *.
- Regression: 495 logic assertions + 32 pages render, all passing.


## 5.59.0 note — Dashboard: Renewal revenue potential
- New highlighted card on the Dashboard: "Renewal revenue potential" = the total you'd collect if
  EVERY distinct (non-deleted) member renewed once at their current membership price (sum of each
  member's enrolment prices). Shows the total + how many distinct members it covers and how many
  have a priced membership.
- Helpers: memberRenewalValue(m) and clubRenewalValue(members). Translated for Arabic mode.
- Regression: 499 logic assertions + 32 pages render, all passing.


## 5.60.0 note — Removed duplicate user chip in sidebar
- The sidebar showed the logged-in user TWICE (a chip under the brand AND the footer pill). Removed
  the top chip; the single account block now lives in the footer (name + role + version + cloud/offline)
  right above the More group and Sign out.
- Regression: 499 logic assertions + 32 pages render, all passing.


## 5.61.0 note — Each device keeps its own screen (route is not synced)
- Hardened the per-device session: the open PAGE (route), the signed-in IDENTITY (user) and the admin
  PREVIEW role (session) are now stripped from every cloud write and preserved on every remote update
  AND on load. Two people signed in at once no longer "screen-share" — navigating on one device does
  not change the other's page. (Club DATA still syncs live, as intended.)
- Note: the deployed site must be updated — older builds predate this and will still follow each other.
- Regression: 500 logic assertions + 32 pages render, all passing.


## 5.62.0 note — Expiring page: attendance sheet PDF per member
- Each member row on the Expiring page now has a "📄 Sheet" action that prints the member's attendance
  sheet for their LAST subscription (start/last-renewal → expiry). If the period crosses a calendar
  month it includes BOTH months (one section per month per sport), with per-sport and overall totals.
- Implemented as window._attPdfSubscription(memberId); reuses the existing attendance-PDF styling.
- Regression: 503 logic assertions + 32 pages render, all passing.


## 5.63.0 note — Coach home dashboard + two-way advice comments
- New coach landing page ("My Dashboard", coachhome) — the coach's home after login. Shows:
  their students (roster + sports), their salary for the CURRENT month and PREVIOUS months
  (Fixed + Commission + Total, commission = rate x active-member revenue that month), and a recent
  advice card with a link to write more. Coach-only route; admins see it when previewing as a coach.
- Advice is now a TWO-WAY thread: students can reply/comment on advice from their coach, and coaches
  can reply back. Each advice carries a comments[] thread ({by, name, text, date}); shown under each
  note on both the coach and student Advice screens. Arabic-translated.
- Helper: coachEarnings(coach, month). Regression: 507 logic assertions + 33 pages render, all passing.


## 5.64.0 note — More info for student & coach roles
- STUDENT (My Membership): new "Next class" card (soonest upcoming session for their sports, pulled
  from the weekly Schedule) and a "Payment history" table (their own invoices: date, ref, for, amount,
  paid, due). Both Arabic-translated.
- COACH (My Dashboard): the student roster now shows each student's attendance THIS MONTH (attended/total
  + rate %, colour-coded) and last-attended date, with a ⚠ "at risk" flag for low attendance (<50% over
  2+ marked sessions). New "My students expiring" card lists the coach's students who are expired or
  expiring within 14 days, soonest first.
- All scoped to own data only (students see their own; coaches see only their students).
- Regression: 512 logic assertions + 33 pages render, all passing.


## 5.65.0 note — Student self-service freeze (with allowance)
- Students can freeze their own membership from My Membership. Allowance = 5 days per 30 days of
  validity (30d→5, 60d→10, 90d→15 …), tracked per membership cycle (renewing resets it); a single
  freeze request is capped at 7 days ("up to one week at a time").
- Freezing pauses the membership and shifts the expiry (and per-sport ends) forward by the frozen
  days, reusing the existing applyFreeze(). The card shows remaining/used allowance; a frozen member
  sees their resume date. Arabic-translated. Only an Active (non-frozen) membership can be frozen.
- Regression: 519 logic assertions + 33 pages render, all passing.


## 5.66.0 note — Zero-write exports for coach & student
- All read-only (no DB writes, no growth to the shared document):
- STUDENT (My Membership): "📅 Add to calendar" downloads an .ics of their weekly classes (recurring,
  with coach + location) for Google/Apple Calendar; "📄 Attendance report" prints their attendance sheet.
- COACH (My Dashboard): "🖨 Sign-in sheet" prints a blank students × days-of-month attendance grid;
  "⬇ Roster CSV" exports their students with this-month attendance, rate, status, expiry, mobile.
- Reuses downloadFile()/daysInMonth()/the print engine. Arabic-translated.
- Regression: 521 logic assertions + 33 pages render, all passing.


## 5.67.0 note — Switch Sport can distribute classes across multiple sports
- The Switch Sport modal now has a "＋ Distribute into another sport" button. A member's REMAINING
  classes (planned − attended) can be split across several new sports/coaches, each with its own class
  count. A live tally enforces that the allocation equals the remaining classes.
- Commission: the old coach still keeps (attended/planned) × price; the remaining value is split across
  the targets in proportion to the classes each receives, credited to each new coach. The net-zero
  reconciliation invoice now carries one positive line per target.
- Enrollments: the source enrollment is replaced by one enrollment per target (classes + proportional
  value). Single-target switches behave exactly as before (unchanged path).
- Regression: 526 logic assertions + 33 pages render, all passing.


## 5.68.0 note — Renewal revenue potential now counts every paying member
- Fixed under-counting on the Dashboard "Renewal revenue potential" card. memberRenewalValue() now
  falls back to each member's most recent REAL invoice total (then latest subscription amountPaid)
  when their enrolment prices are blank/0 — so imported and renewed members are included and the
  "with a priced membership" count reflects everyone who actually pays.
- Zero-amount and internal switch-credit invoices are ignored in the fallback.
- Regression: 528 logic assertions + 33 pages render, all passing.


## 5.69.0 note — "My sports" redesigned for families (bigger, clearer)
- The student "My sports" table is now a grid of large, friendly cards: each sport shows a coloured
  icon, the sport name in big bold, the coach, two large numbers (Planned / Attended this month) and a
  coloured progress bar (attended of planned · %). Sport-specific colours and emojis. Arabic-translated,
  responsive (cards reflow on small screens).
- Regression: 528 logic assertions + 33 pages render, all passing.


## 5.70.0 note — Dashboard is single-month with a month dropdown
- The Dashboard KPI cards now show ONE month (default = current month) instead of spanning two months.
  Total Revenue, Total Expenses, Coaching Revenue, Court Rental, Equipment Sales, Net Profit and
  Revenue Mix are all for the selected month; labels show just that month.
- New month dropdown in the Dashboard header (lists months that have data + current). computeStats(month)
  honors it; month-over-month deltas/sparklines compare to the previous month. Selection is per-device
  (window._dashMonth — not synced to the DB) and resets to the current month on reload.
- Regression: 528 logic assertions + 33 pages render, all passing.


## 5.71.0 note — Schedule: move a class up/down by arrows
- Each class block on the Schedule now has small ▲ / ▼ arrows (admin only) to move it to the earlier /
  later time slot in the same day — an alternative to dragging. Clamped at the first/last slot, and
  blocked if it would clash with the same coach already booked in the target slot. Filters are preserved.
- Regression: 534 logic assertions + 33 pages render, all passing.


## 5.72.0 note — Members filters now allow multiple selections
- Status, Sport, Coach and Nationality on the Members page are now multi-select checkbox dropdowns
  (Sport already was). Pick several at once — e.g. Active + Frozen, or two coaches — and the list shows
  members matching ANY of the chosen values. Button labels show the count ("2 statuses", a single
  value, or "All ...").
- Filter state migrates old single values into arrays (filter.statuses/coaches/nationalities). Archived
  still shows only when 'Archived' is ticked. Clear-filters resets all of them.
- Regression: 534 logic assertions + 33 pages render, all passing.


## 5.73.0 note — Similar-name cleanup · Arabic camp print · Camp members + transport
- MEMBERS "Find Duplicates" now also finds SIMILAR NAMES (typos, different spellings, reordered words),
  in English or Arabic, regardless of phone — a new section in the scan modal with View/Archive actions.
  Exact phone+name duplicates still shown first; similar-name groups already covered by those are skipped.
- SUMMER CAMP schedule: added an Arabic (RTL) print button ("طباعة (عربي)") — Arabic title, day, group
  and break labels; activities/coaches print as entered.
- NEW "Camp Members" screen (admin, 🚌): lists everyone enrolled in Summer Camp with a per-member
  TRANSPORTATION toggle (Yes/No, stored as m.campTransport), KPI counts, and CSV export. New route
  registered in nav (+ Arabic label) and render harness.
- Regression: 537 logic assertions + 34 pages render, all passing.


## 5.74.0 note — Coach delete + coach transfer
- TEAM → coach profile now has 🗑 Delete and 🔁 Transfer students.
- Delete is allowed only when the coach has NO linked records (no students, enrolments, scheduled
  classes, or invoices); otherwise a modal explains what is still linked and points to Transfer.
- Transfer moves the coach's students (primary + enrolment coachId) and scheduled classes to a chosen
  new coach. Salary basis: "from transfer date" (past pay stays with the old coach; new coach earns from
  future renewals) or "from registration date" (past membership invoices are re-credited to the new
  coach too — a full hand-over that then lets you delete the old coach).
- Regression: 541 logic assertions + 34 pages render, all passing.


## 5.75.0 note — Family / household (part 1 of the family + reminders work)
- New 'families' concept: members carry m.familyId; state.families[] stores the household name + shared
  contact phone. Helpers: familyMembers/getFamily/familyName/familyContactPhone/familyOutstanding.
- Member profile has a new 👨‍👩‍👧 Family action to create a household or add the member to an existing one
  (or remove). New "Families" screen (Main nav, Arabic label) lists households with member chips,
  combined balance, expiring count, and a WhatsApp-the-family button; a per-family detail modal shows
  members, statuses, expiries and the combined balance.
- Arabic-translated, admin nav. Regression: 545 logic assertions + 35 pages render, all passing.
- NOTE: automated WhatsApp sending + PDF attachment is NOT possible from the static client app; the
  upcoming Reminder Center will be assisted (one-click prefilled WhatsApp + downloadable PDF).


## 5.76.0 note — Expiring screen shows attended classes
- New "Attended" column on the Expiring screen. Single-sport members show attended/planned (colour-coded
  by rate). Multi-sport members show a 🏅 medal with the total attended and a hover tooltip (ⓘ) breaking
  it down per sport (attended/planned). Counts only Y-marks inside the member's current cycle window.
- Regression: 547 logic assertions + 35 pages render, all passing.


## 5.77.0 note — Age field (two-way with birthdate) on the member form
- The member form now has an editable Age box next to Birthdate. Typing a birthdate fills the age; typing
  an age auto-fills an approximate birthdate (today minus N years, so the age reads back exactly). Only the
  birthdate is stored (age stays derived via memberAge), so nothing drifts. New helper ageToBirthdate().
- Regression: 551 logic assertions + 35 pages render, all passing.


## 5.78.0 note — Schedule move arrows clarified (same day, time only)
- Confirmed/hardened: the ▲/▼ arrows move a class to the earlier/later TIME slot within the SAME day
  only — c.day is never changed, just c.slot. Added a snap for off-grid slot values and clearer wording.
- Regression: 551 logic assertions + 35 pages render, all passing.


## 5.79.0 note — Edit / rename household
- Added editFamily(): rename a household, change its shared contact phone, or disband it (members kept,
  just un-grouped). Reachable from the Families card (✏️) and the family detail modal (✏️ Rename / edit).
- Regression: 551 logic assertions + 35 pages render, all passing.


## 5.80.0 note — Correct Arabic term for Columns (الأعمدة)
- The Members "Columns" button and modal are now bilingual and use الأعمدة (not الحقول) for Columns in
  Arabic mode; chrome (intro, Reset/Close/Apply, "always") translated. Will use الأقسام for Sections
  wherever a Sections label appears.
- Regression: 551 logic assertions + 35 pages render, all passing.


## 5.81.0 note — Summer Camp 6-week duration
- Added a "6 weeks" (42-day) camp duration option to the camp price/duration table (default price 2500
  QAR, editable in settings). 2 weeks and 3 weeks already existed. The tier is backfilled into existing
  data on load and the dropdown re-sorts by days. Admin can change the price anytime.
- Regression: 552 logic assertions + 35 pages render, all passing.


## 5.82.0 note — Attendance "Attended" chip now respects the day filter
- The green ATTENDED total used to sum Y-marks across the whole grid month even when a single day was
  selected (e.g. 25 rows shown for Day 9 but the chip read 58 = the month total). It now counts only the
  selected day(s), so it matches what the grid shows; with no day filter it shows the month (or all) total.
  The chip label shows the scope (e.g. "ATTENDED · DAY 9", "ATTENDED · JUN 26", "ATTENDED · ALL").
- Regression: 552 logic assertions + 35 pages render, all passing.


## 5.83.0 note — Backup button fixed + moved to the top
- Moved "Backup" to the Dashboard topbar beside Refresh (removed the footer button; the footer keeps the
  info text + Settings link). Topbar buttons are now wired BEFORE the chart draws, so a charting error
  can never leave them dead.
- Hardened downloadBackup(): wrapped in try/catch with a clear error toast, strips device fields
  (user/route/session), and falls back to a circular-safe JSON serializer so it always produces a file.
- Regression: 552 logic assertions + 35 pages render, all passing.


## 5.84.0 note — Fix stretched radios/checkboxes in modals
- Radios/checkboxes placed inside a .field (e.g. the coach Transfer "salary basis" options) were being
  stretched to width:100% with input padding by the global .field input rule, leaving a huge gap before
  the label text. Added a CSS rule so radios & checkboxes are always auto-width with no padding.
- Regression: 552 logic assertions + 35 pages render, all passing.


## 5.85.0 note — Inactive coaches grouped in filter · trials can record 2 sports
- Members coach filter now groups ACTIVE coaches first, then a "Former / inactive" section (still
  selectable for historical filtering, shown faded with "(former)"). Deactivating a coach never
  un-assigns their students — they remain that coach's records and coachName() still resolves the name.
- Trials: added an optional 2nd "sport tried" + coach. Saved as t.sport2/t.coachId2, shown in the list
  ("+ Sport / + Coach"), and the sport filter matches either sport. Picking a 2nd sport requires its coach
  and must differ from the first.
- Regression: 555 logic assertions + 35 pages render, all passing.


## 5.86.0 note — Products page fully Arabic-translated
- Translated all English labels on the Products page via t(): title, subtitle, the four KPI cards
  (catalog, inventory cost/margin, low stock, out of stock), filters (search placeholder, All categories,
  All stock levels, In stock/Low/Out), table headers (Product/Category/Cost/Sell price/Stock/Stock
  value/Status), row status badges (In stock/Low/Out of stock), Restock button, edit/delete titles,
  empty state, and the product count. Numbers/SKU unchanged.
- Regression: 555 logic assertions + 35 pages render, all passing.


## 5.87.0 note — Attendance-based commission switched ON + rule on the pay slip
- The agreed rule (already implemented behind state.settings.commissionBasis) is now the active default.
  A one-time load migration switches existing clubs to 'attendance' (sets commissionBasisInit so admins
  can still switch back to 'payment' from Settings/Salaries). Fresh installs default to attendance.
- Rule (computeAttendanceCommission): commission = fee x rate spread over the membership; each month
  earns per attended class (fee / total classes x rate); finishing all classes in a month pays full that
  month; on expiry the remaining commission trues up in full; a frozen membership keeps its remainder
  pending until it truly ends. Pending amounts shown separately.
- Coach pay slip PDF now shows a "How commission is calculated" points box (when basis = attendance) plus
  a Pending row. Regression: 557 logic assertions + 35 pages render, all passing.


## 5.88.0 note — Fix invisible Coach Advice textarea
- The advice input on the Coach Advice page was collapsing/rendering invisibly for some coaches, so
  "Send advice" always said "Write some advice first". Gave every .field textarea a guaranteed
  min-height (84px), resize:vertical and display:block, plus a belt-and-suspenders inline style on the
  advice box so it can never collapse or render white-on-white.
- Regression: 557 logic assertions + 35 pages render, all passing.


## 5.89.0 note — Renewal-potential detail page + camp member edit (transport & duration)
- The Dashboard "Renewal revenue potential" card is now clickable → opens a new hidden admin page
  (renewaldetail) listing ONE row per member x enrolled sport (incl. Summer Camp): Name, Mobile, Sport,
  Start date, End date, Paid value, with a total and CSV export. Start/End derived from the matching
  subscription, else enrolment start + validity, else member start/expiry.
- Camp Members: added a Duration column (2 weeks / 3 weeks / 6 weeks etc., from durationLabel) and an
  Edit action -> editCampMember() modal to update the transport flag AND the camp duration in one place
  (updates the camp enrolment, its subscription end date, and member expiry when camp is the membership).
  CSV export now includes Duration.
- Also includes the v5.88.0 Coach Advice textarea fix.
- Regression: 558 logic assertions + 36 pages render, all passing.


## 5.90.0 note — Fix Dashboard Backup button (downloadBackup was page-scoped)
- Root cause: window.downloadBackup was defined INSIDE another page's wiring function, so it only existed
  after visiting Settings/Data & Backup. On a fresh load on the Dashboard it was undefined, so the topbar
  Backup button did nothing. Moved the definition to top level so it is always available from any page.
- Regression: 559 logic assertions + 36 pages render, all passing (incl. a check that downloadBackup is global).


## 5.91.0 note — Nav regrouping
- New left-menu sections / order: Main · Summer Camp · Team & Sports · Finance · Insights · System.
- Summer Camp section = Summer Camp (schedule) + Camp Members.
- Team & Sports section = Team (coaches) + Sports.
- Merged the old Settings section into System (Users & Roles, Preferences, Club Setup, Data & Backup,
  Danger Zone now live under System alongside Data Import/Export and Audit Log).
- Removed the redundant "Users & Roles" card from the Data & Backup screen (it only linked to the
  dedicated Users page).
- Arabic section labels added: المعسكر الصيفي, الفريق والرياضات.
- Regression: 562 logic assertions + 36 pages render, all passing.


## 5.92.0 note — Summer Camp: Drivers / Transport page
- New page (Summer Camp section) "Drivers / Transport" (route campdrivers). Manage drivers (name +
  mobile: add / edit / delete) and link each camp student to a driver via a per-student dropdown.
- Data: state.drivers = [{id,name,phone}]; member.campDriverId links a camp student to a driver.
  Assigning a driver also flags campTransport=true; deleting a driver unassigns its students.
- KPIs (drivers / assigned / not assigned), per-driver student counts, and CSV export of the
  student↔driver roster. Arabic-labelled throughout. Bilingual nav label added.
- Regression: 564 logic assertions + 37 pages render, all passing.


## 5.93.0 note — Camp transport split into 3 simple pieces
- Drivers screen (campdrivers) is now drivers-only: add/edit/delete name + mobile, with student counts.
- Camp Members screen: each member now has a Driver dropdown (assignDriver) + Driver column in CSV.
- New "Driver Students" screen (camproutes): each driver shown with the students they pick up (name +
  phone), an "Not assigned" group, CSV + Print. Summer Camp section now: Summer Camp · Camp Members ·
  Drivers · Driver Students.
- Regression: 565 logic assertions + 38 pages render, all passing.


## 5.94.0 note — Split the crowded Main menu into logical groups
- Main: Dashboard (+ role homes). New Membership group: Members, Families, Expiring, Trials, History.
  New Activities group: Schedule, Attendance, Rentals, Coach Advice.
- Full section order: Main · Membership · Activities · Summer Camp · Team & Sports · Finance · Insights ·
  System. Arabic labels added: العضوية (Membership), الأنشطة (Activities).
- Regression: 567 logic assertions + 38 pages render, all passing.


## 5.95.0 note — Coach view part 1: own-classes scoping + next class
- Attendance: a signed-in coach now sees ONLY the sports they actually coach (per-enrolment coachId);
  the coach filter is hidden for them. Admin behaviour unchanged.
- Schedule: a coach sees ONLY their own classes (others hidden, not just dimmed).
- Coach dashboard: new "Your next class" card (sport · day · time · Today/Tomorrow/in N days) from the
  weekly schedule.
- (Salary is already shown on the coach dashboard; the advice textarea fix shipped in 5.88.0.)
- Regression: 567 logic assertions + 38 pages render, all passing.


## 5.96.0 note — Private sport variants (shared icon + lock)
- Any sport can have a "(Private)" variant: a separate, separately-priced sport that shares the base
  sport icon/colour and adds a 🔒 lock + "Private" tag. Convention: name ends with " (Private)".
- Helpers isPrivateSport()/baseSportName(); schedule + My-Sports icon resolvers look up the base name and
  append 🔒 for private. Sports screen gets a 🔒+ "Make private variant" button per sport that creates
  "<Sport> (Private)" (inherits icon/colour). Price is typed per enrolment as usual.
- Regression: 569 logic assertions + 38 pages render, all passing.


## 5.97.0 note — Student view enhancements
- Renewal alert banner at the top of My Membership when the membership is expired or expiring within
  7 days (red/amber, bilingual, "renew at reception").
- Advice card now shows the full coach↔student reply thread inline, a reply count in the subtitle, and a
  "Reply" button that opens the Advice tab (where students can post replies). Was read-only before.
- (My Membership already had: status/expiry/balance KPIs, next-class card, my-sports cards with
  attendance, freeze, attendance log, membership + payment history, calendar export, attendance PDF.)
- Regression: 569 logic assertions + 38 pages render, all passing.


## 5.98.0 note — Pre-launch QA batch (QC report fixes + consistency)
- Search false matches (QC): short queries (<=4 chars) now require exact/prefix match — "Test" no longer
  matches "Best"/"Tens". Longer queries keep typo tolerance (madani ~ madanee). Tests added.
- Dashboard "Needs attention" now uses memberStatus() for expired/expiring, so Dashboard, Members and
  Expiring all agree on what "expired" means (QC count-mismatch fix). Also removed a stale hardcoded
  sub.month==='may' filter from the finished-all-classes alert (legacy bug — alert only worked for May).
- Members CSV export now writes the LIVE memberStatus() instead of the stale stored m.status, so CSV
  counts match the table (QC fix).
- Members table Attendance column: when a member has several sports, the cell now labels WHICH sport the
  count belongs to (QC: count appeared to mismatch the Sport column).
- Private sports: coachTeachesSport() now matches the BASE sport, so a Kick Boxing coach can be booked
  for "Kick Boxing (Private)" (coach-sport validation respected for variants).
- Verified already-fixed QC items: rentals (mandatory start time, no past dates, no archived members,
  overlap block), schedule coach-sport validation + inactive-coach warning + same-slot clash block.
- Regression: 572 logic assertions + 38 pages render, all passing.


## 5.99.0 note — Reminder Center + small pending items
- New Reminders page (Membership section, admin-only): lists expired + expiring members (3/7/14/30-day
  window), each with a one-click WhatsApp button that opens chat with a PREFILLED bilingual (AR+EN)
  renewal message (member name, sport, expiry). Clicking also marks lastRemindedAt; a "Last reminded"
  column + "Reminded today" KPI track follow-up. Family members use the household contact number when
  set. Client-side only (WhatsApp click-to-chat) — no fees, no backend; admin just taps Send.
- Trials CSV export now includes 2nd Sport / 2nd Coach columns.
- Coach pay-slip "How commission is calculated" box is now bilingual (Arabic in Arabic mode).
- Regression: 573 logic assertions + 39 pages render, all passing.


## 6.0.0 note — Club Revenue Summary + Receptionist role + sortable tables + camp filters
- NEW Club Revenue Summary page (Insights section, route clubrevenue): per-sport and per-coach revenue
  for a chosen month (or All time), with commission per coach, member counts, sport share %, totals, and
  CSV export. Built on invoice line items so it stays correct with switch/split invoices.
- NEW Receptionist role: front-desk + READ-ONLY finance. Can use Members, Families, Trials,
  Reminders, Schedule, Attendance, Rentals, Coach Advice, Summer Camp (full), Invoices, Salaries,
  Products, Sales, all Insights (Reports / Coach Performance / Renewals / Attendance Report /
  Club Revenue Summary), and the Team list. NO access to Users & Roles, Preferences, Club Setup,
  Data & Backup, Danger Zone, Audit Log, Sports, Data Import/Export. Added isViewerRole() helper.
  Available in Settings -> add user (Receptionist) and in Preview-as.
- Sortable tables EVERYWHERE: every table column header gets a click-to-sort ⇅ icon (numeric, date and
  currency aware; sticky headers; toggles asc/desc; ↑/↓ when active). Pages with their own sort
  (Members table) are left untouched via data-sortkey opt-out.
- Camp Members now has 5 filters: search (name/phone), status, duration, transport (yes/no), driver
  (incl. "Unassigned"), with "Clear filters" and a "showing N of M" subtitle. State persists across
  driver/transport toggles.
- (Bumped to 6.0.0 — meaningful new capabilities + a new role.)
- Regression: 577 logic assertions + 40 pages render, all passing.


## 6.0.1 note — Receptionist visibility fixes
- setPreviewRole('receptionist') was falling through to admin (so "Preview as receptionist" reset to
  Admin). Now correctly sets session.role = 'receptionist'.
- Accounts & roles: the role summary pills now include a Receptionists count, and the row in the
  Users table now shows "front-desk, read-only finance" instead of "full access" for that role.
- (Receptionist option in add-mapping role dropdown was already present in 6.0.0.)
- Regression: 577 logic assertions + 40 pages render, all passing.


## 6.1.0 note — Tighten Receptionist to pure front-desk
- Receptionist allow-list trimmed: removed Dashboard, Salaries, Reports, Coach Performance, Renewals,
  Renewal Potential, Attendance Report, Club Revenue Summary. Home page now defaults to Members.
- Hidden from receptionist view:
  - Expiring screen: "Potential Revenue" KPI hidden.
  - Team screen: Rate, both months' Revenue and Commission columns + footer totals (cards drop the
    rate and "May Pay" cell, showing students + att-rate instead). Coach attribution kept (attendance %).
  - Invoices: subtitle drops the total amount; Export button hidden.
  - Sales / Products / Members / Camp Members / Driver Students / Trials / Expiring: all Export CSV
    buttons hidden. Products: Inventory-cost KPI card + subtitle totals hidden.
- isViewerRole() now drives every gated hide so it's consistent and one-line to toggle.
- Regression: 578 logic assertions + 40 pages render, all passing.


## 6.2.0 note — Camp member Edit: price + discount + paid + driver in one place
- The "Edit camp member" dialog was duration + transport only — no way to record/adjust the FEE or PAID
  amount. Now includes Price, Discount and Paid-so-far with a live Outstanding-balance summary; picking
  a duration auto-fills the preset price (admin can still override).
- Saving creates the camp Membership invoice if missing, or updates an existing one — amount,
  discount, amountPaid, the matching line item and the payments log all reconcile. Outstanding balance
  on Members / Reminders / Invoices reflects immediately.
- Same dialog also exposes the 🚐 Driver dropdown (matches Camp Members) so duration / transport /
  driver / fee are edited in one place.
- Validation: paid cannot exceed price - discount.
- Regression: 578 logic assertions + 40 pages render, all passing.


## 6.3.0 note — Universal "Edit pricing & payment" + Due flags
- New editMemberPricing(memberId) dialog: ONE place to edit price / discount / paid for every sport the
  member is enrolled in (not just camp). Each sport renders as a row with live "Outstanding" total;
  Save creates or updates the matching membership invoice (amount/discount/amountPaid/line item/
  payments log all reconcile). Validation: paid <= price - discount per sport.
- Reachable from: member profile (the "💰 NNN due" badge is now a button, and a new "💰 Edit pricing"
  button sits next to the status badges) AND from the Expiring screen's new Due column.
- Expiring screen: NEW "💰 Due" column showing a clickable ⚠ chip for members with an outstanding
  balance (opens the editor) or a green ✓ when settled. NEW "Money due (from these members)" KPI card
  totalling outstanding across the expired/expiring/upcoming buckets.
- Permissions: admins AND receptionists can both use the editor (collecting dues IS the receptionist's
  job). Other roles see the badges read-only.
- Regression: 579 logic assertions + 40 pages render, all passing.


## 6.4.0 note — Clearer payment / due capture during member registration
- The "First payment" block on the Add/Edit Member form is now a prominent 3-card summary that updates
  LIVE as you change Sport prices or the Paid Now field:
  Total (from sport prices) · 💵 Paid (collected now) · ⚠ Due (auto = Total − Paid).
  Leave Paid Now blank to pay full; type a partial amount and the Due card lights up amber with the
  exact balance that will be marked outstanding.
- Member profile: the "💰 Edit pricing / record payment" entry point is now a primary-coloured button
  on its own line (not a small ghost link) so it's unmissable. The 💰 NNN due chip remains clickable.
- Same "Edit pricing" dialog still available from Expiring (💰 column) and Members (profile).
  Admin AND receptionist can use it.
- Regression: 579 logic assertions + 40 pages render, all passing.


## 6.5.0 note — Summer Camp · Import Schedule page
- NEW Summer Camp -> Import Schedule page (route campimport, admin-only). One screen to bulk-load a day
  into state.campSchedule from a pasted text block — cleanest fit for the static client app (no AI/server).
- Workflow: open your printable poster in any OCR/AI tool (ChatGPT, Claude, Google Lens), ask it to give
  you the schedule as text with rows separated by lines and columns separated by |, paste, Preview, Apply.
- Parser is permissive: columns can be split by | or TAB or 2+ spaces; rows like "TIME | KIDS | BOYS |
  GIRLS" are ignored as headers; "Activity (Coach Name)" captures the coach into a separate field.
- Two apply modes: Replace day (default) overwrites everything for that day; Fill empty slots only keeps
  existing entries and only fills holes.
- "Load sample" button populates a SUNDAY example matching the new 7-slot layout (Swim/Breakfast/Sport/
  Sport/Prayer/Sport/Dismissal). Day picker covers Sat-Fri.
- Saving writes to state.campSchedule.days[day] with the same shape Camp Schedule already uses, so the
  printed/displayed schedule reflects immediately.
- Regression: 580 logic assertions + 41 pages render, all passing.


## 6.6.0 note — Camp Members: gender + group (Kids/Boys/Girls) + filters
- Camp Members table now has a Gender column (♂/♀/— not set) and a Group column. Group derives from
  gender + age: under-7 -> Kids, Male 7-12 -> Boys, Female 7-12 -> Girls — matching the printed
  schedule (Kids 4-7 / Boys 7-12 / Girls 7-12).
- Two new filters: Group (Kids/Boys/Girls/Need-info) and Gender (Male/Female/Not set). Both persist.
- KPI strip now breaks down the FILTERED list into Kids / Boys / Girls counts; click any card to
  one-click filter by that group. A "Need info" card appears only when there are members missing
  gender/birthdate so admins can chase them up.
- Edit Camp Member dialog: added Gender + Birthdate inputs so admins fix this without leaving the
  camp page; both write back to the member record.
- CSV export now includes Gender + Group columns alongside the existing ones.
- (Gender field already existed on members; this exposes it where it matters for camp planning.)
- Regression: 580 logic assertions + 41 pages render, all passing.


## 6.7.0 note — Camp group as an explicit override on the member
- New m.campGroup field (Kids | Boys | Girls | null). When set, the camp page uses it directly. When
  null/missing, falls back to the auto-derived value from gender + age (under-7 -> Kids; Male 7-12 ->
  Boys; Female 7-12 -> Girls). This lets admins override borderline cases (e.g. a strong 7-year-old
  joining Boys instead of Kids, or vice versa) without lying about age.
- Edit Camp Member dialog: new "Camp group" picker with options: Auto (shows current auto value) /
  Kids / Boys / Girls. Stored on save.
- Camp Members table: group chip gets a small "●" indicator when the group is set manually (hover for
  "Set manually" vs "Auto from gender + age").
- Filters / KPIs / CSV all already use campGroup() so they reflect the override automatically.
- Regression: 581 logic assertions + 41 pages render, all passing.


## 6.8.0 note — Camp group: automatic, no manual override
- Camp group is now COMPUTED only, per the explicit rule:
    age < 7              -> Kids
    age >= 7 + Male       -> Boys
    age >= 7 + Female     -> Girls
    missing data         -> Unknown (flagged on the Need-info KPI)
- Removed the manual override picker from the Edit Camp Member dialog (it was confusing). The "Camp group"
  field is now a read-only badge that updates LIVE as you change Gender or Birthdate in the same dialog
  — so the admin sees the calculation happen.
- Any old m.campGroup override saved by 6.7.x is cleared on next Save (no migration needed; the value
  was never used outside this dialog).
- KPIs / filters / CSV continue to use the computed value.
- Regression: 580 logic assertions + 41 pages render, all passing.


## 6.9.0 note — Due Payment page
- NEW Due Payment page (route duepayment, Membership section, accessible to admin AND receptionist —
  collecting dues is the front-desk job).
- Lists every member with an outstanding balance, sorted largest-first. Each row shows:
    - name + Arabic name
    - phone (clickable)
    - status badge (Active / Expired / Frozen)
    - membership expiry
    - PER-SPORT breakdown chips (e.g. "Kick Boxing · 400" + "Summer Camp · 250") so the receptionist
      knows WHICH enrollment is unpaid
    - total due in QAR (red, bold)
    - last reminded date
    - actions: 💰 Collect (opens editMemberPricing), 💬 WhatsApp (prefilled bilingual message), 👁 Profile
- 4 filters: search (name/phone), status, sport (only sports that have an unpaid member appear),
  amount range (<100 / 100-499 / 500-999 / 1000+).
- 3 KPI cards: Total due (filtered) · Total due (all) · Big balances ≥1000 QAR (clickable to filter).
- Footer row with grand total for the visible list. List updates on settle — paying via the Collect
  dialog removes the row instantly.
- Regression: 582 logic assertions + 42 pages render, all passing.


## 6.10.0 note — Receptionist hardening (no club info leaks)
- Removed `history` from receptionist allow-list (it is the full club revenue history).
- Member profile: hidden the Paid KPI card, per-row Paid column in the subscription table, the
  "🧾 N invoices · X QAR paid" lifetime summary line, the per-enrollment price labels, and the
  "📜 Full History" button. Receptionist still sees subs/attendance/status and can record payment.
- Members table: hidden 🗑 Archive, 🗑 Delete forever, ↩ Restore per-row, and the bulk Export-selected
  + Archive-selected actions in the selection bar.
- Invoices page: hidden 📜 customer-history, ⬇ Export PDF, ✏ Edit quick, 🗑 Delete per row. The receptionist
  keeps 💵 Pay (record payment) and 💬 WhatsApp.
- Team page: hidden + Add Coach / + Add Staff buttons. The Active/Inactive cell is a read-only badge.
- viewCoach modal: hidden Fixed-salary + commission % badges, May Revenue + May Pay KPI cards, the
  whole April detail row, and the Deactivate / Transfer / Edit / Delete actions. Receptionist sees
  only Close.
- Products page: hidden Cost column, Stock-value column, ✏ Edit, 🗑 Delete, + New Product. Restock kept.
- Sales: hidden the per-row 📄 invoice PDF and 🗑 delete (POS recording kept).
- Rentals: hidden ⚙ Rates, 📥 Export, the per-row 📄 invoice PDF and 🗑 Delete. The per-facility "this
  month" KPI shows booking COUNT instead of revenue value for viewers; total-amount subtitle hidden.
- Defence-in-depth: every destructive / financial mutation function now checks role first and refuses
  for non-admin. Covered: deleteInvoice, editInvoiceQuick, deleteMember, editCoach, toggleCoachActive,
  deleteCoach, transferCoachStudents, restoreMember, permanentlyDeleteMember, editProduct,
  deleteProduct, deleteSale, deleteRental. Even a crafted URL or console call refuses.
- All driven by the existing isViewerRole() helper so it stays consistent.
- Regression: 582 logic assertions + 42 pages render, all passing.


## 6.10.1 note — Schedule editable by receptionist
- The Class Schedule and the Summer Camp Schedule are VIEWABLE by every role (admin, receptionist,
  coach, student) and EDITABLE by admin + receptionist. Coaches and students get the read-only view.
- (No allow-list change — Schedule was already in the receptionist allow-list. This fixes the canEdit
  gate inside the page so receptionists can add / move / delete classes.)
- Same fix applied to PAGES.campschedule (isAdmin variable was admin-only; now admin OR receptionist).
- Regression: 586 logic assertions + 42 pages render, all passing.


## 6.10.2 note — Removed Summer Camp · Import Schedule page
- Removed the campimport route, nav entry, Arabic label, page implementation (PAGES.campimport),
  helpers (_parseCampCell, _parseCampPaste), and window globals (_campImport, _previewCampImport,
  _applyCampImport). Render harness updated; old test removed.
- (No data shape change — state.campSchedule is unaffected.)
- Regression: 585 logic assertions + 41 pages render, all passing.


## 6.11.0 note — Schedule filters now multi-select (coaches + sports)
- The two single-select dropdowns on the Schedule filter bar are replaced with checkbox menus matching
  the Members page pattern. Pick any combination of coaches AND any combination of sports — the grid
  highlights matches and dims the rest in real time.
- Empty selection = "All" (no filter). Each menu has a Clear button; a global "Clear all" appears next
  to the filters when anything is active.
- Labels show "All coaches" / "Coach X" / "N coaches" (same for sports), and update live on every tick.
- Coach view unchanged: a signed-in coach is still locked to their own classes (coach picker hidden).
- Count subtitle and export honour the multi-select filter automatically (they use the same
  isFiltered() function).
- Regression: 585 logic assertions + 41 pages render, all passing.


## 6.12.0 note — Club Revenue Summary: date-range filter + Invoices KPI
- The month-only dropdown is replaced with a richer period filter on Insights -> Club Revenue Summary:
  presets Today / Yesterday / This week / This month / Last month / All time, plus a Custom range with
  from + to date inputs (max = today).
- "This week" follows the Qatar week (Saturday start).
- New 4th KPI card "Invoices" shows the receipt count for the chosen period + the average invoice value
  alongside Total revenue. So a "daily report" reads: Total revenue today (X QAR) · Invoices today
  (N) · avg invoice (Y QAR) · plus the by-sport and by-coach breakdowns.
- CSV export now writes the period as a header line and uses a clear filename suffix
  (e.g. club-revenue-today-2026-06-13.csv or club-revenue-2026-06-01_to_2026-06-13-2026-06-13.csv).
- Filter persists in window._crsPeriod so the screen remembers it during the session.
- (No second screen needed — kept everything on one page.)
- Regression: 585 logic assertions + 41 pages render, all passing.


## 6.13.0 note — Find duplicates by mobile number
- New findSharedPhoneClusters() helper groups members who share a mobile number (last 8 digits)
  REGARDLESS of name — catches siblings on a parent phone, or wrong-number bugs missed by the
  same-name+phone scan.
- The Members -> Find Duplicates dialog now has a third section: "📞 Same mobile, different names".
  Each group shows the shared number prominently and lists the members with their status + sport
  + actions (👁 View / 📦 Archive). Groups already covered by the exact name+phone scan are NOT
  re-shown (no duplicate noise).
- Test added that locks the behaviour: two members with the same phone but different names form one
  shared-phone group.
- Regression: 586 logic assertions + 41 pages render, all passing.


## 6.14.0 note — Split-tender payments (cash + card on one transaction)
- The 💵 Record payment dialog (Invoices page, Due Payment page, Expiring page) now has a "Split between
  cash + card" checkbox. Tick it to swap the single Amount + Method controls for two side-by-side
  inputs (💵 Cash QAR / 💳 Card QAR) with a live "Collecting / Remaining" summary.
- Each part is recorded as its OWN payment row on the invoice (correct method preserved on each), so
  daily cash-vs-card reports show the right split.
- Over-collection guard: if cash + card > balance, asks before trimming the excess (trims card first
  since cash is usually the exact change). Single-payment flow is unchanged.
- recordInvoicePayment() already supported a payments[] array — this is purely a UI change.
- Test added: posting 100 cash + 200 card to a 300-balance invoice produces 2 payment rows, sums to
  300 paid, and preserves both methods.
- Regression: 589 logic assertions + 41 pages render, all passing.


## 6.15.0 note — Permanently delete a member's sport (history cleanup)
- New admin-only deleteMemberSport(memberId, sport) function with a confirmation modal that previews
  exactly what will be removed before the admin commits:
  * subscription rows for that sport
  * invoices affected — split into "deleted entirely" (only sport on the invoice) vs "shrunk"
    (other sports remain)
  * revenue removed from reports (QAR)
  * payments removed (QAR)
- The cascade reconciles everything:
  * removes the enrolment from m.enrollments + the matching subscription rows + any legacy renewal[]
    entry
  * for each affected invoice: strips matching lineItems, recalculates inv.amount,
    PRORATES inv.amountPaid + each payments[] row, and DROPS the invoice if no lines remain
  * falls back the headline m.sport to the next enrolment if the deleted one was it
- Coach commission / Club Revenue Summary / Coach Performance / Team page update automatically
  because they all read live from invoice lineItems (no cached totals).
- UI: a small 🗑 button is now embedded inside each sport chip on the member profile (admin only).
  Receptionists and coaches do not see it.
- Audit trail entry: "Deleted sport <name> — removed <X> QAR revenue, <Y> invoices dropped, <Z> shrunk".
- Test added: removing one sport from an invoice drops the matching coach's coachStudents() count but
  leaves the other coach unaffected.
- Regression: 591 logic assertions + 41 pages render, all passing.


## 6.16.0 note — Delete invoice (admin) with rich preview + history-modal access
- Delete invoice was already on the Invoices page (admin-only 🗑 button). Upgraded the confirmation:
  the bare "Delete this invoice?" prompt now becomes a full preview modal showing customer, ref, date,
  category, total / paid / balance, every line item with sport + coach + amount, payment rows that will
  vanish, and for each coach attributed in the line items the EXACT commission deduction (revenue ×
  coach rate %). A warning is shown if the invoice is linked to a Sale record (the sale row stays but
  its invoice link is cleared cleanly).
- Same delete action is now also reachable from the member profile -> "Invoice history" modal: every
  invoice row gets a 🗑 button for admins (next to the existing ⬇ Export PDF button). Receptionists +
  coaches do not see it.
- Audit log entry: "Deleted <ref> for <customer> — <total> QAR, <paid> paid".
- Coach revenue / Club Revenue Summary / Coach Performance update automatically because they read live
  from invoice line items — no extra recompute step.
- Regression: 591 logic assertions + 41 pages render, all passing.


## 6.17.0 note — 🔄 Regenerate invoice from current enrollment (admin)
- Real workflow: customer signs up for 1 week of Summer Camp, you issue the invoice, then they extend
  to 1 month. Bump the price on their enrolment, then click 🔄 on the existing invoice — it rewrites
  the line items / amount / description to match the live enrolment state. Payments STAY ON THE
  INVOICE so the new balance auto-recalculates (new amount − paid).
- Smart scope: if the original invoice was a single-sport one, regenerate narrows the rewrite to JUST
  that sport (so we never merge two separate invoices). Multi-sport invoices regenerate all matching
  enrolments.
- Preview modal before commit shows: per-sport diff (added / removed / unchanged / changed with
  before→after price), old vs new amount with delta, paid (unchanged), old vs new balance. Disabled
  if nothing would change.
- Reach it from TWO places: 🔄 button on each Membership invoice row (Invoices page), AND on each
  row in the member profile -> "Invoice history" modal.
- Admin only. Receptionists + coaches do NOT see the button (already locked by isViewerRole). Audit
  trail entry written: "Regenerated <ref> for <name> — old → new QAR".
- Coach revenue / Club Revenue Summary / Coach Performance reflect the change automatically because
  they read live from line items.
- Test: a 300 QAR invoice with 100 QAR paid, after regenerating from a 1500 QAR enrolment, ends up
  with amount=1500, paid=100 preserved, and balance=1400.
- Regression: 594 logic assertions + render harness all passing.


## 6.18.0 note — Cash Collection page (owner withdrawal from till)
- NEW Finance -> Cash Collection page (route cashcollection, accessible to admin AND receptionist —
  front-desk often hands the envelope).
- Records the cash the owner / partner takes from the till. Each row stores: amount, date, who
  collected, optional note, and writes to state.expenses with the reserved category "Cash collected
  by owner".
- Because it's stored as a normal expense, Reports / Net profit / Club Revenue Summary all
  automatically subtract it from earnings (it's money leaving the club). Because it has its own
  reserved category, it stays filterable and auditable separately from operating expenses.
- Page layout: 3 KPI cards (Total shown · Total all-time · This month), filter bar (search by
  collector / note + month dropdown), table with date, collected-by + note, month, amount, actions.
  Admin-only edit / delete buttons; receptionist can record but not modify history.
- Recording flow: "Record collection" modal asks for Amount (required), Date (default today),
  Collected by (free text), Notes (optional). Saves as one expense row.
- Category management: "Cash collected by owner" is now in DEFAULT_EXPENSE_CATEGORIES and in
  RESERVED_EXPENSE_CATEGORIES. EXP_CATS getter ensures reserved categories are ALWAYS present, so
  older installs auto-gain this category without a schema bump.
- Audit log entries: cash.collection.create / cash.collection.update / cash.collection.delete.
- Tests added: route registration, role permission, category presence, and that a cash-collection
  row counts toward monthly expense totals.
- Regression: 599 logic assertions + 26 pages render, all passing.


## 6.19.0 note — Invoice suite (auto-regenerate, Get Invoice, renewals, camp duration)
- (#1) Editing a member's sports / prices in the Edit Member form now AUTO-REGENERATES the linked
  membership invoice: line items, header sport, amount and description all refresh from the new
  enrolment state. Coach commission + Club Revenue Summary follow automatically because they read
  live from line items. This was already partly true (syncSubToEnrollment updated the line item
  price); now it also updates the description, the inv.sport label and the duration label.
- (#2) New "🧾 Get Invoice" button on the member profile (admin + receptionist). One click exports
  the LATEST Membership invoice PDF for that member — for handing the customer a receipt without
  leaving the profile. Hidden when the member has no invoice yet. (Bulk export across all invoices
  stays admin-only on the Invoices page.)
- (#3) Renewals already created a SEPARATE invoice (each with a unique ref). Confirmed and locked in
  a regression test so future refactors cannot regress it.
- (#4) Summer Camp invoices now display the duration label everywhere: line item carries
  durationLabel, the inv.sport header and the inv.description read e.g. "Summer Camp · 1 month"
  instead of plain "Summer Camp". Applied to: new member registration, add-sport-during-edit,
  Edit Camp Member dialog (new invoice + updates), Regenerate Invoice flow, and renewal invoices.
- NEW helper sportListWithDuration(items) renders the standard label across all paths.
- Receipts / PDF / Club Revenue Summary now read the duration suffix without any extra work.
- Tests added (8 new assertions): sportListWithDuration() output shape, edit-camp invoice updates
  amount + description + lineItem duration label, renewal produces a separate invoice without
  modifying the original.
- Regression: 607 logic assertions + 26 pages render, all passing.
