# Black Stars CRM
Version 4.87.0 — Phone search ignores spaces + country code (matches all formats).

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
confirm footer reads v4.87.0.

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
