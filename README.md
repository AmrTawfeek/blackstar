# Black Stars CRM
Version 6.150.0 - FIX: Firestore "write stream exhausted" — the real cause of failed saves.

## 6.150.0 note - cloud write throttling (resource-exhausted)
The browser console revealed the true cause of saves not persisting:
  FirebaseError [resource-exhausted]: Write stream exhausted maximum allowed queued writes.
The app stores the whole dataset as one document and was firing a new Firestore write
on every change WITHOUT waiting for the previous one to finish. During rapid editing
these piled up, Firestore's write queue filled, and further writes were rejected — so
changes silently failed and the console flooded with retries. (This was NOT the merge
logic; sync was already simplified in 6.149.)
Fixes in the cloud storage layer:
- At most ONE Firestore write is outstanding at a time. If a save happens while a write
  is still in flight, the newest state is queued and flushed once the current write
  resolves (latest-wins) — so writes can never pile up and exhaust the stream.
- Save debounce raised 1.5s → 3s so bursts of edits batch into fewer writes.
- Every save still writes a local safety-net copy first, so data is never lost even if
  the cloud write is delayed.
- If cloud writes do fail (quota/connection), a clear notice now appears ("Cloud is
  busy — your data is safe locally and will sync in a moment") instead of failing
  silently. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.149.0 - Sync simplified: no live merge; just a "newer data available" note.

## 6.149.0 note - safe, simple cloud sync
Per the chosen design (sync as a convenience, not concurrent multi-user editing), the
live background MERGE has been removed entirely. It was the source of every data scare,
and it isn't needed for one person moving between two machines.
New behaviour:
- Your data saves to the cloud on every change and loads from the cloud when you open
  the app — exactly as before.
- When the cloud holds newer data than this device loaded (e.g. you saved on the other
  machine), a small note appears: "Newer data is available — Refresh?". Clicking Refresh
  does a clean full reload that pulls the latest. "Later" dismisses it.
- The remote listener now ONLY reads the cloud snapshot to decide whether to show that
  note. It never merges, never writes to your open session, and can never overwrite your
  unsaved work. This removes the whole class of edit-loss bug.
Tradeoff (accepted): if both machines are open and edited at the same time, the last
save wins for the whole dataset — fine for single-user convenience sync. The old merge
helpers remain defined but dormant. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.148.0 - HOTFIX: reverted the multi-device _rev change that risked edits not persisting.

## 6.148.0 note - revert record-revision merge (data safety)
After v6.145 introduced a per-record _rev timestamp into the multi-device merge, edits
could appear not to persist (edit → save → reload → change gone). To protect data
integrity, the _rev stamping in save() and the _rev tiebreaker in the merge have been
FULLY REVERTED to the proven-stable behaviour from v6.144 and earlier:
- save() no longer stamps _rev; it writes state as before.
- The record-level 3-way merge is back to: changed-remote-only → remote; changed-local
  -only → local; changed-both → keep local + flag conflict; deletes honoured only when
  the other side is untouched.
Edits now persist across reloads exactly as they did before today's sync experiment.
The original goal (stopping a stale second device from reverting a fresh edit) is
deferred to a proper per-record cloud backend rather than an app-layer timestamp. No
schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.147.0 - FIX: attendance-report image showed 100% instead of attended/enrolled.

## 6.147.0 note - attendance image rate
The per-member attendance IMAGE showed an inflated rate — e.g. a camp member who
attended 2 of her 8 enrolled days showed "2/2 · 100%" instead of "2/8 · 25%".
Cause: the image computed the rate as present ÷ (present + absent MARKS), so with 2
present and 0 absent it read 100%. The profile, by contrast, uses attended ÷ ENROLLED.
Fix: the image now uses the enrolled count (the subscription's class/day limit, or the
enrollment's classes) as the denominator, both per-sport and overall — so the image now
reads "2/8 · 25%", matching the profile's Att rate. Falls back to present ÷ marks only
when nothing is enrolled. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.146.0 - Members header status chips are now clickable filters.

## 6.146.0 note - clickable status chips
The status count chips in the Members header (Active / Expired / Frozen / Completed /
Withdrawn) are now CLICKABLE. Clicking one filters the member list to just that status;
the active chip gets a highlight ring. Clicking the same chip again clears the filter
(toggle). This is a quick shortcut for the existing status filter dropdown — both stay
in sync. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.145.0 - FIX: another device's stale save could revert your edit.

## 6.145.0 note - multi-device stale-overwrite protection
With two machines using the app, an edit saved on one could be silently reverted when
the OTHER device later saved while holding older data — e.g. you set a camp validity to
1 month (expiry 17 Jul), then the second device pushed its full state with the old 8-day
value, and the merge treated it as "only remote changed" and took the stale value.
Root cause: the cloud stores ONE document that each device overwrites wholesale; the
app-layer merge compares against a base, but after your own save the base equals your
value, so a stale remote looks like the only change.
Fix: every record that changes now carries a per-record revision timestamp (_rev). The
multi-device merge uses it as a tiebreaker — a remote record with an OLDER _rev can no
longer overwrite a fresher local edit, while a genuinely newer remote still wins. This
makes edits much more resilient when two devices are active. Records without a _rev keep
the previous merge behaviour (no regression).
Note: this is a strong mitigation, not a full multi-writer backend. For complete safety
when two people edit the SAME record at the same second, a per-record cloud store is
still the ultimate step. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.144.0 - Families: collapsible cards + search.

## 6.144.0 note - families collapse/expand + search
The Families page is now easier to navigate when there are many households:
- Each family card is COLLAPSIBLE — click the family header (or its ▼ caret) to fold/
  unfold its member table. Collapsed cards show just the family name, member count and
  contact, so you can scan all households at a glance.
- "⊕ Expand all" / "⊖ Collapse all" buttons toggle every card at once.
- A SEARCH box filters families live by family name, member name (English or Arabic),
  or phone number. Matching families auto-expand so the matching member is visible, and
  a "N / total shown" counter + a "no matches" message keep it clear.
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.143.0 - Expiring: green Remind button once reminded (+ reminded filter confirmed).

## 6.143.0 note - reminded button colour + filter
On the Expiring page:
- The "Remind" button now turns GREEN and reads "✓ Remind again" once the member has
  been reminded at least once. It stays fully clickable, so you can always send another
  reminder. Members not yet reminded keep the red "💬 Remind" button.
- The reminded/not-reminded FILTER already exists in the toolbar (🔔 All · ✓ Reminded ·
  ○ Not reminded yet) and filters the list by reminder status — confirmed working.
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.142.0 - FIX: attendance image export failed ("try the PDF instead").

## 6.142.0 note - attendance image export reliability
The attendance image export (member profile 🖼 Attendance EN/AR, and the Attendance
page image buttons) failed with "Image export failed — try the PDF instead".
Cause: the image is built by rendering HTML inside an SVG <foreignObject>, which
requires WELL-FORMED XHTML. The header contained an unclosed <br> tag, which made the
SVG invalid, so the browser refused to load it and the export aborted.
Fixes:
- Self-closed the <br/> tag so the SVG is valid XHTML.
- Switched from a blob URL to a UTF-8 data URI (encodeURIComponent) which encodes
  Arabic + emoji reliably across browsers.
- Wrapped the canvas/render steps in try/catch, and the member export now falls back to
  opening the PDF automatically if the image still can't be produced.
Image export (English + Arabic) now works for both the per-member report and the
attendance grid. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.141.0 - FIX: editing validity on a locked sport didn't persist (reverted on re-open).

## 6.141.0 note - validity edit not saved on locked/attended sports
Critical bug: on a sport LOCKED because the member already attended classes, changing
the Validity (e.g. to 1 month) and saving appeared to work (the in-dialog expiry even
showed the right date) but re-opening showed the OLD validity again.
Root cause: for an existing member, a matched sport is synced via syncSubToEnrollment(),
whose final step recomputed the subscription window with
  eValidity = isCamp ? e.classes : e.validity
— i.e. for Summer Camp it used the CLASS-DAY count (8) as the validity instead of the
real validity window (30). So every save forced the camp validity/end back to the
day-count (8 days → 25 Jun), silently reverting the edit.
Fix: that line now uses e.validity (the window) for camp, falling back to the class
count only if no validity is set. Editing a locked camp member's validity now persists:
validity sticks and expiry recomputes (17 Jun + 1 month → 17 Jul). No schema change
(SCHEMA_VERSION stays 9).

## 6.140.0 note - camp validity + expiry on edit
Two linked bugs when editing a camp member's validity:
1. Set Validity to "1 month", saved, re-opened → it showed 8 again. Cause: the edit
   form derived the validity from the member's saved expiry date via start→end. Since
   the saved expiry was a stale wrong value (from the pre-6.136 expiry bug), start→end
   came out as 8 days. Fix: the edit form now reads the validity from the stored
   subscription's own `validity` field (the real 30-day window) first, only deriving
   from start→end as a last resort.
2. Changing the Validity dropdown didn't update the Membership expiry field. Cause: the
   expiry field was flagged as a "manual override" (because the saved expiry no longer
   matched the freshly-computed auto value), which locks it. Fix: changing the camp
   validity now clears that manual override so the expiry auto-recomputes from the new
   window (e.g. 17 Jun + 1 month → 17 Jul).
Together: editing a camp member, picking a validity, and saving now stores the correct
window and expiry, and re-opening shows the right validity. No schema change
(SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.139.0 - FIX: Expiring "Attended" count disagreed with the Attendance grid.

## 6.139.0 note - consistent attended count
A member could show "6/8 attended" on the Expiring page but "9" present on the
Attendance grid — three different numbers for the same person. Cause: the Expiring page
counted only the present marks that fell INSIDE the member's start→expiry date window,
so any marks dated before the start or after the expiry were excluded (6), while the
Attendance grid counts all marks (9).
Fix: the Expiring "Attended" cell now uses the same live, unwindowed count as the
Attendance grid and the class-limit logic, and its denominator is the subscription's
real class/day limit. So the same member now reads consistently everywhere (e.g. 9/8,
which also makes an over-limit case obvious). No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.138.0 - Member profile: attendance report as IMAGE (English / Arabic).

## 6.138.0 note - per-member attendance image
The member profile's Attendance action now exports the member's attendance report as a
PNG IMAGE, in English or Arabic, in addition to CSV. The profile footer now shows:
- 🖼 Attendance (EN) — English image, left-to-right.
- 🖼 Attendance (AR) — Arabic image, right-to-left, Arabic labels + the member's Arabic
  name where available.
- 📊 Attendance CSV — the existing CSV export.
The image lists every marked day grouped by sport (with per-sport and overall totals and
percentages), rendered offline via SVG foreignObject + canvas at retina (2x) quality.
Downloads as <name>_attendance_<en|ar>.png. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.137.0 - Attendance: flag camp members over their enrolled day count.

## 6.137.0 note - camp over-limit attendance flag
On the Attendance grid, a Summer Camp member who has been marked present for as many
days as their enrolled duration (e.g. 8 of 8) is now clearly flagged:
- The row is tinted RED with a red left bar.
- A "🚩 OVER LIMIT 8/8" badge appears next to their name.
- Their status shows "✓ COMPLETED" (they finished their enrolled days).
You can still mark extra days if needed (the existing confirm prompt appears at the
limit), but the red row + flag make it obvious they've used all the days they paid for,
so nobody accidentally keeps marking a finished camp member. The "Completed" status was
already set by the class-limit logic; this adds the visual flag on the attendance row.
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.136.0 - FIX: camp expiry wrongly used the day-count, not the validity window.

## 6.136.0 note - camp expiry in edit form
Critical bug: editing a Summer Camp member with e.g. duration 8 days + validity 1 month
set the membership expiry to ~8 business days after the start (e.g. 17 Jun → 25 Jun)
instead of start + the 1-month validity window (17 Jul).
Cause: the edit form's auto-expiry helper (autoExpiryFromRows) still computed camp end
from the class-DAY count via campEndDate, even though camp duration and validity were
decoupled back in v6.115 (duration = class limit, validity = time window). The SAVE
path was already correct; only the live auto-fill preview was stale, and since the
field auto-fills, the wrong date got saved.
Fix: camp expiry now = start + VALIDITY (calendar days), matching the save path. So
duration 8 + validity 1 month from 17 Jun → expiry 17 Jul. No schema change
(SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.135.0 - Members header: bigger, more readable status counts.

## 6.135.0 note - member status count chips
The Members header status counts (active / expired / frozen / completed / withdrawn)
were a small one-line subtitle that was hard to read. They're now shown as larger
colored CHIPS — each with a big bold number and a clear labelled status — so the
breakdown is easy to scan at a glance. The "X of Y" total sits just above them in a
slightly larger weight. Same numbers, just far more readable. No schema change
(SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.134.0 - Carry-forward credit: up to 2 unused classes onto a renewal.

## 6.134.0 note - carry-forward credit
When a member's previous period for a sport EXPIRED with classes still unused (paid but
not attended), they can now carry up to 2 of those classes into their next membership.
- Credit = unused classes on the latest finished period = totalClasses − attended
  (live), capped at a maximum of 2 (even if 5 were unused, only 2 carry).
- On the Renew dialog, when credit exists a green "🎁 Carry-forward credit available"
  banner appears with a checked box: "Add N classes to this renewal". With it ticked,
  the carried classes are ADDED to the new package's class count (e.g. renew 8 + carry
  2 → 10 total). Untick to skip.
- Only applies to a finished/expired period; an active period gives no credit yet. The
  credit follows the sport being renewed. The success message notes "+N carried class".
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.133.0 - Clearer invoices: show days/classes + validity period per line.

## 6.133.0 note - invoice line detail
Each invoice line now spells out exactly what the customer paid for and the period it
covers, so any customer can read it at a glance:
- Summer Camp lines show the number of DAYS (e.g. "8 days · ٨ يوم").
- Normal membership lines show the number of CLASSES (e.g. "12 classes · ١٢ حصة").
- Both show the validity window: "Valid · صالح: <start> → <expiry>" pulled from the
  member's matching subscription (by invoice ref + activity).
This applies to multi-sport (line-item) invoices and to single-item membership
invoices. Quantity column reflects the same day/class count. No schema change
(SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.132.0 - Trials: encouraging WhatsApp follow-up message.

## 6.132.0 note - trial follow-up WhatsApp
The 💬 WhatsApp button on each Trial row now opens WhatsApp pre-filled with an
encouraging bilingual (Arabic + English) follow-up message inviting the prospect to
join — it greets them by name, references the sport they tried, and warmly nudges them
to sign up. (Before, the button opened an empty chat.)
Bonus: sending the message to a NEW trial automatically moves it into the "In follow-up"
stage and stamps today's date, so the Trials KPI ("In follow-up") and status stay
accurate without extra clicks. Trials already in follow-up / converted / declined are
left unchanged.
The TRIAL FOLLOW-UP template (EN + AR) is editable in Settings → reminder templates,
using {name} / {nameArabic} / {sport} / {coach} placeholders. No schema change
(SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.131.0 - Attendance sheet: export as IMAGE (English / Arabic).

## 6.131.0 note - attendance image export
The Attendance screen can now export the sheet as a PNG IMAGE, in addition to PDF and
CSV. Two new buttons sit next to Export PDF:
- 🖼 Image (EN) — English sheet, left-to-right.
- 🖼 صورة (AR) — Arabic sheet, right-to-left, with Arabic headings/labels and the
  member's Arabic name where available.
The image is built from the same grid as the PDF (respecting the current month, day,
coach, sport and attended/absent filters), rendered to a PNG via an SVG foreignObject +
canvas — no external libraries, works offline. It downloads as
attendance_<month>_<en|ar>.png at retina (2x) quality. Image export needs a specific
month selected (not "All months"); use the PDF for the all-months summary. No schema
change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.130.0 - Distinct reminder message for completed-camp members.

## 6.130.0 note - completed vs expired reminder wording
A Summer Camp member who finished ALL their classes early was getting the "expired N
days ago" message (e.g. "expired 0 days ago") because completed members are surfaced in
the expired bucket of the Expiring screen. That wording was wrong for someone who
actually completed their sessions.
Added a third reminder template — COMPLETED (English + Arabic) — with congratulatory
wording ("you've completed all your sessions! 🎉 Ready for the next round?"). The
Remind button now picks:
  • completed  → for class-completed members (finished all sessions),
  • expired    → for members whose date has actually passed,
  • expiring   → for members expiring soon (future date).
The new COMPLETED templates are editable in Settings → reminder templates, alongside
the existing ones. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.129.0 - Delete a single (not-started) subscription period.

## 6.129.0 note - per-subscription delete + the duplicate-sub question
Q: why couldn't I delete a sport that hasn't started, and how does one member have two
subscriptions for the same sport on overlapping dates?
- The "two same-sport subscriptions" happen when a member is renewed while a current
  period is still active — the renewal adds a NEW subscription without removing the old
  one, so both show as active. (This is by design for history, but creates the overlap
  you saw.)
- Previously the only delete worked by SPORT NAME, so for a member with 3 Gymnastic
  periods it was all-or-nothing — and it was blocked because one of those periods had
  6 attended classes.
Fix: the Subscription History table (member profile) now has a 🗑 on each row that has
ZERO attendance (admin only). It deletes just THAT one period and its linked invoice
(or that sport's invoice line, so PAID drops), leaves the member's other subscriptions
intact, and recomputes the expiry from what remains. Periods WITH attendance stay
protected (use Withdraw / Switch Sport). So you can now remove a not-started or
duplicate period cleanly. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.128.0 - Expiring: reminded filter + reminder count.

## 6.128.0 note - reminder filter & count
On the Expiring screen:
1. New "reminded" filter dropdown: All / ✓ Reminded / ○ Not reminded yet — so you can
   focus on members you still need to chase, or review who's already been contacted.
2. Each reminded row now shows the reminder COUNT, e.g. "✓ Reminded 2× · last 22 Jun
   2026" (the count appears once there's more than one).
Also fixed a latent bug: there were two markReminded() functions and the simpler one
(which only set a timestamp and did NOT track the count) was overriding the proper one.
Removed the duplicate, so reminders now correctly increment the per-cycle count (up to
the MAX_REMINDERS limit, with the "send a 2nd/final reminder?" confirmation). No schema
change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.127.0 - Smarter search: phone formats + Arabic letter folding.

## 6.127.0 note - search normalization everywhere
Two search improvements applied across ALL search fields (Members, Attendance,
Expiring, History, Trials, Product Sales, Coach detail, Camp list, user pickers,
quick views):
1. Phone numbers match regardless of format: +97450413948, 50413948, "5041 3948",
   and 00974 50413948 are all treated as the same number. Phones canonicalise to the
   local 8-digit form (country code 974 / 00974 / +974 and spaces are stripped).
2. Arabic letter folding: أ إ آ ٱ all match ا (so أنس == انس), ة matches ه, ى matches
   ي, and diacritics/tatweel are ignored. Searching either spelling now finds the
   member.
Implemented via shared helpers (normalizePhoneForCompare, normalizeArabicForSearch,
searchMatchesFields) so every screen behaves the same. No schema change (SCHEMA_VERSION
stays 9).

# Black Stars CRM
Version 6.126.0 - Review fix: merge never drops id-less records (schedule safety).

## 6.126.0 note - code review pass
Did a full review of the recent changes (sync merge, camp duration/validity, transfer,
attendance cap, role privacy). Found and fixed ONE real bug:
- Multi-device merge: the record-level merge keyed everything by `id`. Any record
  WITHOUT an id (e.g. legacy Summer schedule rows, or any id-less collection entry)
  was silently dropped during a merge — a data-loss risk when two devices sync. The
  merge now preserves id-less records (keeps them from whichever side has more), so
  they can never be wiped.
Everything else reviewed clean: the attendance cap correctly counts all present marks
and only triggers on a new "present" (not absent); the first cloud snapshot after load
does NOT show a false "updated on another device" banner (change-detection guard); the
transfer over-attendance edge clamps safely (no negative classes, no money created);
currentRole() can't throw. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.125.0 - Transfer keeps A's attendance; moves only remaining classes (live).

## 6.125.0 note - transfer attendance handling
Two clarifications applied to Membership Transfer (A → B):
1. The transferring member (A) KEEPS their own attendance marks — they are never wiped
   — and A's status becomes "Transferred" (when they have no sports left). This was
   already the case; confirmed and tested.
2. Only the REMAINING (unattended) classes move to B, so B's total = the original class
   count − what A already attended, and B starts at 0 attended. The count of A's
   attended classes now uses LIVE attendance (the actual roll-call marks), taking the
   greater of the live marks and the stored counter, so it's accurate even when the
   stored counter was never updated. Example: A had 12 classes and attended 5 → 7
   classes move to B; A keeps their 5 marks.

(Re. deleting a member: archived members already keep ALL their data, including
attendance — delete is a soft archive that can be restored, nothing is destroyed.)
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.124.0 - FIX: camp attendance could exceed its class-day limit.

## 6.124.0 note - attendance limit bypass fixed
Critical bug: a Summer Camp member set to e.g. 8 class days could be marked present far
more than 8 times (seen as 25/25). Cause: the "already attended all classes" cap, and
the Completed/Expired status check, counted ONLY the present marks that fell inside the
subscription's date window (start→end). Marks dated BEFORE the start (or after the end)
were not counted, so they slipped past the limit entirely.
Fix: both the attendance cap warning and campLimitReached now count ALL present marks
for that sport, regardless of date. So an 8-day camp warns on the 9th mark wherever it
falls, and the member correctly flips to Completed once 8 are marked. (totalClasses is
also parsed defensively in case it was stored as text.) No schema change (SCHEMA_VERSION
stays 9).

# Black Stars CRM
Version 6.123.0 - Sync: ask to refresh instead of auto-refreshing the screen.

## 6.123.0 note - refresh prompt on remote change
When another device makes a real change, the data is now merged + saved silently in
the background (nothing is lost), and instead of the screen refreshing on its own, a
banner appears at the bottom:
  "🔄 Data was updated on another device. Your work is saved. Refresh to see the
   latest, or keep working." — with [Refresh now] and [Keep working] buttons.
- Refresh now → re-renders with the latest merged data.
- Keep working → dismisses the banner; you continue uninterrupted (the data is already
  saved).
The screen never refreshes by itself anymore. Echoes of your own save or identical
snapshots do nothing (no banner, no loop). If both devices edited the SAME record, the
banner notes how many were kept as your version to double-check. No schema change
(SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.122.0 - FIX: constant screen refresh loop from multi-device sync.

## 6.122.0 note - stop the refresh loop
A bug introduced with the multi-device merge (v6.117) caused the screen to refresh
constantly: the remote-update handler always called save() after merging, that save
echoed back through the cloud listener as another "remote update", which merged + saved
again — an endless loop that re-rendered the page over and over.
Fix: the merge now reports whether it ACTUALLY changed any data. The handler only
saves + re-renders when something genuinely changed (a real edit from another device).
The echo of our own save, or any identical snapshot, changes nothing → no save, no
re-render → the loop is broken. Multi-device merge safety is unchanged. No schema
change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.121.0 - Camp duration: presets (auto business days) + Custom days.

## 6.121.0 note - presets AND custom day count
The Summer Camp Duration field is back to a dropdown that offers BOTH:
- Presets: 1 week, 2 weeks, 3 weeks, 1 month, 6 weeks, 2 months — each shown with its
  auto-calculated business-day class count (1 week = 5, 2 weeks = 10, 1 month = 22,
  2 months = 44) and price, which auto-fills when picked.
- "✏️ Custom (days)…": reveals a clean number input where you type the exact class-day
  count (e.g. 8), used as-is. Attendance is counted against whichever number applies.
Price keeps its own field and Validity keeps its own window dropdown, so no cramped
layout. Works on new registration and when editing a member. No schema change
(SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.120.0 - Summer Camp duration: simple free-text day count.

## 6.120.0 note - simpler camp duration field
The Summer Camp "Duration" field is now a single, plain number input: type the number
of class days (e.g. 8). That number is the class limit — attendance is counted against
it, and the member is Completed once they've attended that many days. Removed the
cramped Custom dropdown + squeezed-in price box; the camp Price keeps its own field and
Validity keeps its own window dropdown (e.g. 1 month). So a camp row is just:
Duration (days) + Price + Start + Validity (window). Both the add and add-sibling save
paths now consistently treat camp validity as the time window, independent of the day
count. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.119.0 - Generate latest invoice: payment method from membership data.

## 6.119.0 note - auto payment method
The "Generate latest invoice" dialog no longer shows a Cash/Card picker. The payment
method is now taken automatically from the member's membership data — specifically the
method on their most recent membership invoice (or its latest recorded payment),
defaulting to cash if they have no prior invoice. One less thing to set, and it stays
consistent with how the member usually pays. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.118.0 - Invoices: single "Summer Camp" activity filter.

## 6.118.0 note - collapse camp variants in invoices filter
The Invoices "activity" filter listed a separate option for every camp duration
(Summer Camp · 1 week, · 1 month, · 2 months, …), cluttering the dropdown. It now
shows a SINGLE "Summer Camp" option that matches invoices of any camp duration.
Regular sports are unaffected. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.117.0 - Multi-device safe sync: record-level merge (no data loss).

## 6.117.0 note - smarter multi-device sync
Previously the cloud stored everything as ONE document and every save overwrote it
wholesale (last-write-wins). With two machines open, whoever saved last could silently
wipe the other's recent change — even when they edited completely different records.

This release replaces the blind "remote replaces local" behaviour with a record-level
3-WAY MERGE that runs whenever another device's update arrives:
- It keeps a snapshot of the data as last loaded/saved (the "base").
- For every record (members, invoices, coaches, expenses, salaries, sales, advices,
  trials, rentals, schedule, audit, products, families, notes, cash counts) it compares
  base vs this device vs the other device:
  * changed on only one device  → that change is kept
  * a new record on either side  → kept
  * the SAME record changed on BOTH → this device's version is kept AND a warning is
    shown so you can double-check it
  * a delete is only honoured if the other side didn't also edit that record (so a
    concurrent edit is never silently dropped)
- Result: two people editing DIFFERENT members/invoices at the same time no longer lose
  each other's work; only a true same-record clash raises a notice.

Safety: the merge only ever UNIONS records from both sides — it can never turn a
populated dataset into an empty one, and the existing "block empty overwrite" guard
still stands. On any merge error the app keeps local data untouched rather than risk a
bad write. This is a big safety improvement but not a full real-time multi-writer
database; for heavy simultaneous editing a per-record backend would still be the
ultimate step. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.116.0 - Camp: finishing classes early = Completed + shows for renewal.

## 6.116.0 note - completed vs expired for camp
When a Summer Camp member uses up ALL their classes BEFORE their validity window
ends, their status is now "Completed" (purple badge) rather than "Expired" — they
finished everything they paid for. If instead their validity WINDOW passes (whether or
not all classes were used), they show as "Expired" as usual.
Either way they now appear on the Expiring page's expired list so reception can chase
the renewal: a class-completed member is surfaced in the "expired" bucket even though
their date hasn't passed yet. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.115.0 - Camp: duration (class limit) and validity (window) are now separate.

## 6.115.0 note - camp duration vs validity decoupled
Summer Camp now has TWO independent settings:
- Duration = the CLASS LIMIT (how many sessions the member may attend). Pick a preset
  (1 week = 5, 2 weeks = 10, 1 month = 22, 2 months = 44 business days) or "Custom"
  and type the exact number of class days.
- Validity = the TIME WINDOW the membership is valid for (calendar days). This field
  is now editable for camp (1 week / 2 weeks / 1 month / 2 months …), where before it
  was locked to the duration.
Example: Duration 8 + Validity 1 month → the member may attend 8 classes ANY time
within one month. They expire when EITHER all 8 classes are used OR the month ends —
whichever comes first. Attendance still warns + allows override at the limit, and the
status flips to Expired once the class limit is reached or the window passes.
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.114.0 - Custom camp duration also works when EDITING members.

## 6.114.0 note - edit existing members with custom camp duration
The "✏️ Custom (days)" camp duration option (v6.113) is available in the Edit Member
dialog too, not just on new registration — they share the same enrollment editor.
Fixed: the edit form now carries each camp enrollment's durationLabel into the editor,
so:
- An existing camp member already on a Custom duration shows "Custom" pre-selected
  with their day count, instead of guessing a preset.
- You can open any existing camp member, switch their Duration to "Custom (days)",
  type a number of business days + price, and Save — it stores the custom class limit
  and a business-day expiry, exactly like a new registration.
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.113.0 - Summer Camp: custom duration (free-text days) + class limit.

## 6.113.0 note - custom camp duration & class limit
Summer Camp enrollment now has a "✏️ Custom (days)..." option in the Duration picker
(in addition to 1 week / 2 weeks / 1 month / etc.). Choosing it reveals two inputs:
- Days: the admin types a number of BUSINESS days (Sun–Thu). This number is BOTH the
  class limit (totalClasses) and the length of the window — the expiry is set that
  many business days from the start (e.g. 10 days from a Sunday → ends the second
  Thursday).
- Price: free-text price for the custom package.
Attendance behaviour at the limit (camp): marking a member present once they've
already attended all their allotted classes still WARNS and lets you override (as
before). And once a camp-only member has attended all their classes, their status
automatically becomes Expired (they completed the camp). Members who also have a
regular sport are unaffected by the camp limit. Custom duration applies to Summer
Camp only. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.112.0 - Transfer: 'Transferred' status + attended classes credit original coach.

## 6.112.0 note - transfer status & coach salary
When a member transfers their membership to someone else:
1. STATUS: if they have no sports of their own left afterward, their status now shows
   "Transferred" (a distinct blue badge), instead of silently going Expired. If they
   still have other sports, they stay Active. (Re-enrolling clears it.)
2. COACH SALARY: the classes the member already ATTENDED before transferring now stay
   credited to their ORIGINAL coach. The sport's price is split by attendance — the
   attended share remains on an invoice line for the original coach (a "consumed"
   line), and only the UNATTENDED share's value (and the remaining classes) move to
   the receiver and the new coach. So commission follows who actually taught the
   classes. Example: 12 classes / 500 QAR, 5 attended → original coach keeps 208 QAR,
   new coach gets 292 QAR + 7 classes.
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.111.0 - Tighter money privacy for reception & coach roles.

## 6.111.0 note - hide money from limited roles
Reception keeps Invoices and Cash Collection (they collect at the desk), but money
that isn't needed for front-desk work is now hidden:
- Coach Performance ("Team") page: the TOTALS row revenue + commission cells are now
  hidden from reception (the per-row revenue/commission columns and "May Pay" quick
  card were already hidden). Reception sees students + attendance only.
Coaches (who can open the Attendance roll-call) no longer see member MONEY:
- The "💳 UNPAID" badge and its QAR-due amount are hidden from coaches (still shown to
  reception/admin who collect payments).
- The one-tap "🔄 Renew" button is hidden from coaches (renewal involves pricing).
Already enforced and verified: coaches can't open Coach Performance, Salaries,
Invoices, Cash Collection, or the members list; only admins can add/edit coach pay or
commission; the member-profile money card and invoice header totals are hidden from
reception. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.110.0 - Members: balance-due & expiry quick filters.

## 6.110.0 note - new Members filters
Added two quick-filter dropdowns to the Members screen toolbar:
- "Has balance due" — show only members who still owe money (membership balance > 0).
- Expiry — "Expiring within 7 days" or "Expired" — for fast renewal chasing.
Both combine with the existing status/sport/coach/nationality/search filters and the
"Similar names" toggle, are reset by "Clear filters", and persist with the screen's
saved filter. The toolbar wraps cleanly on narrow screens. No schema change
(SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.109.0 - Fix: camp recalc now correctly converts legacy 1-month (30) records.

## 6.109.0 note - camp business-day recalc fix
Camp class counts should be business-day based: 1 week = 5, 2 weeks = 10, 1 month = 22,
2 months = 44 (also 3 weeks = 15, 6 weeks = 30). The "Recalculate camp" Cleanup tool
already handled most cases, but a member stored with the OLD value 30 ("1 month" in
calendar days) was wrongly matched to "6 weeks" (whose business-day count is also 30),
so it was NOT converted to 22. Now the resolver disambiguates an ambiguous stored
count using the amount PAID (1 month = 1750 vs 6 weeks = 2500), defaulting to the
legacy "1 month" reading when there's no price — so old /30 camp members correctly
recalculate to /22, while genuine 6-week (30-class) members are left as-is. Existing
camp members are fixed via Cleanup Center -> "Recalculate camp (business days)";
attendance is never changed. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.108.0 - Cash in Hand: quick-record on the screen.

## 6.108.0 note - cash in hand
The Cash in Hand screen (Finance · admin-only) lets you record what you physically
counted in the drawer and shows the current total prominently, with a change-vs-
previous indicator and a full count history.
This release adds an inline QUICK-RECORD box right on the total card: type today's
drawer amount and press Enter (or tap Update) to log a new count dated today, without
opening the full dialog. The detailed dialog (with date / counted-by / note) is still
available via the top button. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.108.0 - New: Cash in Hand screen (manual drawer count).

## 6.108.0 note - cash in hand
Added a new admin-only Finance screen, "Cash in Hand" (🧮). You record what you
physically counted in the drawer (amount, date, optional counted-by + note), and the
screen shows the CURRENT total in big figures = your most recent count. It also keeps
a history of every count (newest first) with the change vs the previous count, and you
can delete an entry. Stored in a new state.cashCounts list (no migration; existing
data untouched). Admin-only, audit-logged. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.107.0 - Portrait attendance report (mobile) + more Arabic labels.

## 6.107.0 note
1. Attendance PDF reports (per-month and per-subscription) now print in PORTRAIT and
   list each marked day VERTICALLY (Date + Present/Absent rows) instead of a wide
   horizontal day-grid. They're centred at a phone-friendly width, so they're easy to
   read and share on mobile. Months/sports with no marks are skipped. (The Summer Camp
   schedule grids stay landscape — they're genuinely wide.)
2. Translated ~27 more user-facing labels into Arabic that were English-only:
   dashboard card titles (Top Coaches, Recent Invoices, Monthly Summary), several
   search placeholders (Members, Coaches, Invoices, Expenses, Sales, Audit, History),
   Settings titles (Appearance, Preferences, Coach Commission Rates, Data Management,
   About), and report titles (Renewals/Commission/Revenue/Students/Attendance by Coach,
   Trial Log, etc.).
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.106.0 - Coach & student role views enhanced.

## 6.106.0 note - role view upgrades
COACH dashboard (view-only):
- New "Today's classes" card listing each of the coach's scheduled classes for today
  with who's expected to attend (active students enrolled in that sport with them).
- (Already present: next-class card, students roster with attendance/expiry/at-risk,
  expiring-students list, monthly salary, advice.)

STUDENT "My Membership":
- Each sport card now shows a "Left" number = classes remaining on the subscription
  (totalClasses - attended), turning red with a "renew soon" note when only ≤2 remain.
- (Already present: next-class card, attendance log, planned/attended progress,
  balance-due KPI, payment history, expiry/renewal alert banner, freeze self-service.)

Coaches remain view-only (no attendance marking from their dashboard). No schema
change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.105.0 - One-tap Renew from the Attendance screen.

## 6.105.0 note - renew from attendance
The amber "needs renewal" rows in Attendance (expired but fully paid, added v6.102) now
have a one-tap "🔄 Renew" button in the actions column, right next to the PDF export.
Clicking it opens the renewal dialog for that member without leaving the screen, so
reception can extend a lapsed-but-paid member on the spot. The button only appears for
members flagged as needing renewal; after renewing, the grid refreshes and the row
clears. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.104.0 - Schedule clear-filters label + admin-only / double-confirm wipes.

## 6.104.0 note
1. Schedule filters: the filter-reset button is now labelled "Clear filters" (was
   "Clear all", which clashed with the destructive schedule-wipe button). It still
   appears whenever a coach/sport filter is active and resets them in one click;
   per-dropdown Clear buttons remain too.
2. The schedule "Clear all" (which wipes every scheduled class) is now ADMIN-ONLY -
   the button is hidden for non-admin editors, and the handler refuses if a non-admin
   somehow triggers it. It also now requires TWO confirmation popups (Continue… then
   a final "Are you absolutely sure?") and writes an audit-log entry.
3. The Danger Zone destructive actions (Clear all data, Hard Reset, Load demo) are now
   admin-only too, on top of their existing forced-backup + two-confirmation guard.
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.103.0 - Cleanup: re-sync enrollments from subscriptions.

## 6.103.0 note - re-sync enrollments
Added a sixth Cleanup Center tool: "Re-sync enrollments". It finds members whose
sport rows (enrollments[]) don't match their actual subscriptions[] - a sport
duplicated, missing, or pointing at the WRONG COACH (this mismatch was the root cause
behind earlier wrong-coach attendance issues). The tool shows the current vs correct
sports, and re-syncing rebuilds the enrollment rows from the active subscriptions
(one per sport, correct coaches), keeping each row's classes/price/dates/validity.
ATTENDANCE AND SUBSCRIPTIONS ARE NEVER CHANGED. Works per-member or "Re-sync all";
admin-only, confirmed, audit-logged. The Cleanup KPI grid is now 6 tiles. No schema
change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.102.0 - Notes date filter + attendance renewal cue.

## 6.102.0 note
1. Notes & Reminders: added "month" and "day" dropdowns that filter notes by their
   reminder date (works together with the Open/Attention/Done/All tabs). A "Clear
   dates" button resets them. Notes with no reminder date are hidden while a date
   filter is active.
2. Attendance: a member whose membership has EXPIRED but who owes NOTHING is now
   highlighted with an amber row + inset stripe and a "🔄 RENEW" badge - prompting
   reception to offer a renewal. This is visually distinct from the red "💳 UNPAID"
   case (expired AND still owing) and the plain grey expired row. Driven by member
   status + invoice balance; no data changed.
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.101.0 - Invoices: bulk "Delete selected".

## 6.101.0 note - bulk delete invoices
The blue selection bar on the Invoices screen (shown when you tick one or more
invoices) now has a red "Delete selected" button alongside "Merge into one invoice".
It asks for confirmation showing how many invoices and the total/paid amounts, then
permanently deletes them all at once. Linked sale records are kept but their invoice
link is broken cleanly (same as single delete), the action is audit-logged, and the
table refreshes IN PLACE so your current filters and page are preserved. No schema
change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.100.0 - Clarify revenue figures (Invoices vs Dashboard).

## 6.100.0 note - why Invoices total != Dashboard revenue
Not a calculation bug - the two numbers measure different things, but the labels made
them look contradictory:
- Invoices header (e.g. "68,781 QAR") = total CHARGED across all invoices, ALL-TIME
  (everything billed, paid or not).
- Dashboard "Total Revenue (Jun)" (e.g. "57,426") = cash actually COLLECTED in the
  current month only (cash-basis), via cashInMonth().
They legitimately differ because of (a) time scope - all-time vs one month - and
(b) charged vs collected (unpaid balances inflate the charged total).
Changes (display only, no math changed):
- Invoices header now reads "N invoices · X charged · Y collected · Z due", so it's
  explicit and reconciles (charged = collected + due).
- Dashboard revenue card gained a tooltip explaining it's cash collected this month.
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.99.0 - Bug audit batch: pagination, profile total, date counting.

## 6.99.0 note - proactive bug fixes
1. Pagination out-of-range: if you were on (say) page 5 and then applied a filter or
   deleted rows so only 1 page of results remained, the table could render EMPTY
   because the page slice fell past the end. paginate() now clamps the current page
   into range first, so it always shows the last valid page instead of blank rows.
   Affects every paginated screen (members, invoices, expenses, trials, etc.).
2. Member profile money card: the Total/Paid figures now exclude switch-credit
   (negative) invoices, matching the balance-due calculation - so the displayed total
   always reconciles with the amount due for members who switched sports.
3. daysUntil() now parses date-only values as local midnight, preventing a possible
   off-by-one in expiry / "days left" counts (robust across timezones).
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.98.0 - Expenses: export a fancy PDF report.

## 6.98.0 note - expenses PDF report
Added an "Export PDF" button to the Expenses screen. It opens a clean, branded,
print-ready report of the CURRENT filtered view with:
- a gradient header (club name + period),
- a meta line (date range, entry count, active filters, generated timestamp),
- summary cards (total, entries, average per entry, number of categories),
- a "Breakdown by category" section with coloured percentage bars,
- and an itemized table (date, description, category, method, amount) with a bold total.
The report reflects whatever filters/month are applied, and a "Save as PDF" button
prints it. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.97.0 - Fix: recent-searches & notification dropdowns now match the theme.

## 6.97.0 note - dropdown theme fix
The Recent Searches dropdown (and the notification bell panel) used a CSS variable
that doesn't exist (--surface-1), so they fell back to a hardcoded DARK background.
On the Light/Cream themes this made the panel dark with dark text - the recent
search terms looked like empty rows because the text was invisible against the wrong
background. Both panels now use the theme's real --surface colour, so they render
correctly (white panel + dark text on light, dark panel + light text on dark) and the
search terms are visible. CSS-only change. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.96.0 - Show unpaid clearly: attendance flag + profile total/balance.

## 6.96.0 note - unpaid visibility
1. Attendance grid: members who still owe money now show a red "💳 UNPAID" badge next
   to their name (with the amount due in the tooltip), so you can see at a glance who
   registered but hasn't paid. Driven by the member's invoice balance.
2. Member profile popup: the "Paid" card was misleading - it showed the subscription's
   stored amount even when nothing had been collected. It now shows the TOTAL charged,
   and when there's a balance it turns orange, relabels to "Total · due", and shows
   "<balance> due · <paid> paid" underneath. Figures come from invoices (the source of
   truth). No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.95.0 - New: notification bell (Facebook-style), role-aware.

## 6.95.0 note - notification bell
Added a bell icon in the top header with a red count badge and a dropdown list of
alerts, tailored to the signed-in role:
- STUDENT: next class (today/tomorrow), membership expiring soon, classes running low
  (finish the remaining ones), and unpaid balance.
- COACH: their next class, students expiring soon (to nudge them), students with few
  classes left, and new students assigned this week.
- ADMIN/STAFF: notes needing attention, camp members expiring, and memberships
  expiring soon.
Click an item to jump to the relevant screen. The bell count and list are computed
live from current data and refresh whenever the app re-renders. No schema change
(SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.94.0 - Cleanup: recalculate existing camp members to business days.

## 6.94.0 note - recalc existing camp data
Added a fifth Cleanup Center tool: "Recalculate camp (business days)". It finds camp
memberships added before the business-day rules (v6.87/6.88) that still carry
calendar class counts or expiry, shows the before -> after, and recalculates them:
class counts become business-day based (1 week = 5, 1 month = 22, 2 months = 44) and
camp expiry is counted in business days (Sun-Thu). The matching enrollment and the
member's expiry are updated too. ATTENDANCE IS NEVER CHANGED. Works per-member or
"Recalculate all"; admin-only, confirmed, audit-logged. No schema change
(SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.93.0 - Transfer Membership: merge same-sport into one enrollment + count attendance.

## 6.93.0 note - transfer merges instead of duplicating
Transferring a sport to a member who already has it used to be BLOCKED ("already
enrolled... only one active enrollment per sport"), and earlier flows could leave a
duplicate row (two "Boxing") that wouldn't save. Now:
- If the receiver already has the SAME sport with the SAME coach, the transfer MERGES
  into their existing enrollment: the classes are added to the current membership
  (and the subscription record), instead of creating a second row.
- Attendance is accounted for: only the sender's UNATTENDED (remaining) classes are
  transferred - attended classes were already used, so they don't carry over.
- If the receiver has that sport with a DIFFERENT coach, the transfer is blocked with
  guidance to use Switch Sport (can't merge across coaches).
- If the receiver doesn't have the sport, it's added as before.
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.92.0 - Edit Invoice: add Summer Camp to the Activity dropdown.

## 6.92.0 note - Summer Camp in Edit Invoice activity list
The Edit Invoice dialog's Activity dropdown listed the regular sports (plus Court
Rental / Merchandise) but NOT "Summer Camp" - so a camp invoice couldn't keep or set
its activity to Summer Camp. Now the dropdown includes Summer Camp (listed first),
and it also always includes the invoice's OWN current activity so an existing value
is never lost on edit. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.91.0 - Fix: editing an invoice keeps your filters & page (audit batch).

## 6.91.0 note - edit invoice without losing your place
Audited the Edit-invoice action on the Invoices screen. Found the same issue that
delete had before v6.79: saving an edit did a full page re-render, which reset every
filter (month, day, category, activity, coach, method, search) and jumped back to
page 1. Now editing an invoice refreshes the table IN PLACE - the row updates and
totals recompute, but the current filters and pagination stay exactly as they were.
(If an invoice is edited from outside the Invoices screen it still does a normal
render.) The other invoice-screen actions (merge, generate latest, add rental)
already refreshed in place. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.90.0 - Fix: camp renewals use business-day expiry (audit batch).

## 6.90.0 note - camp renewal audit
Audited camp renewal and the freeze/renewal interaction.
Found + fixed: when renewing a Summer Camp subscription, the auto expiry date used
calendar days (start + validity) instead of camp BUSINESS days. Now a camp renewal's
auto expiry follows the business-day rule (a week = 5 days Sun–Thu), derived from the
class count - matching how new camp registrations behave (v6.87/6.88). The class
field and expiry now recompute together when you change the camp duration/classes.
Manual expiry override still works for any sport.
Audited + verified CORRECT (no change): the freeze allowance correctly RESETS when a
member renews (renewal moves the cycle start, so pre-renewal freezes no longer count
against the new cycle's one-week-per-month allowance).
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.89.0 - Camp renewal: no coach field for Summer Camp.

## 6.89.0 note - hide coach on camp renewal
The Renew Subscription dialog showed a Coach dropdown even when renewing a Summer
Camp subscription (camp has no coach), and it defaulted to a real coach. Now the
Coach field is HIDDEN whenever the chosen Activity is Summer Camp - both on open and
when switching activity or quick-picking a sport. The saved renewal already stores
coachId = null for camp, so camp renewals are coach-free end to end. Regular sports
still show the Coach field. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.88.0 - Camp class counts (business days), bilingual attendance name, modal footer fix.

## 6.88.0 note
1. Summer Camp class counts are now BUSINESS-DAY based: 1 week = 5 classes,
   2 weeks = 10, 3 weeks = 15, 1 month = 22, 6 weeks = 30, 2 months = 44, 1 day = 1.
   New helpers campClassCount() / campLabelForClasses() drive registration, the camp
   pricing edit, invoice line items, and the duration label (legacy calendar counts
   like 7/30 still resolve so old records keep working).
2. The Attendance grid now shows the member's ARABIC name under the English name in
   the same cell (when an Arabic name exists), for easier reading.
3. Fixed a UI bug where the member profile popup's footer buttons (Get Invoice,
   Full History, Attendance, Family, Edit, Close) could be cut off on the left when
   there were many of them - the footer now wraps instead of overflowing.
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.87.0 - Summer Camp: a week = 5 business days; expiry reminder badge.

## 6.87.0 note - camp business-day expiry + reminder
1. Summer Camp durations sold in WEEKS now expire after FIVE BUSINESS DAYS per week
   (Sunday–Thursday), skipping the Fri/Sat weekend - so a "1 week" camp starting
   Sunday now ends Thursday, "2 weeks" ends the next Thursday, etc. Day and month
   durations still use the calendar. New helpers addBusinessDays() and campEndDate()
   drive new-member camp registration, the camp pricing edit, and the expiry preview.
2. The "Camp Members" sidebar item now shows a red REMINDER BADGE with the number
   of camp members expiring within a week, so you can see at a glance who needs a
   renewal nudge. The Camp Members page already has the "Expiring soon" filter and a
   "Remind all expiring" WhatsApp button. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.86.0 - Fix: editing a member reuses the same invoice (no duplicate).

## 6.86.0 note - one invoice per member when editing
Editing a member's pricing/sports could create a brand-NEW invoice instead of using
the member's existing one. The "Edit pricing & payment" dialog looked up an invoice
PER SPORT; if a sport had none yet (e.g. adding Swimming to a member who already had
a Kick Boxing invoice), it spawned a separate invoice for that sport. Now editing
REUSES the member's existing membership invoice and adds the sport as a LINE ITEM,
rolling up the total, discount and payments onto that one invoice. A fresh invoice
is only created if the member has none at all. Renewals are unchanged - renewing
still creates a new invoice as before. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.85.0 - Light is now the default theme.

## 6.85.0 note - default theme = Light
The app now defaults to the LIGHT theme for anyone who hasn't chosen a theme yet
(previously it defaulted to Dark). Members, coaches and admins opening the app for
the first time on a device will see the light theme. Anyone who has already picked
a theme (Dark / Light / Cream / Colorful) keeps their own choice - the theme toggle
still works and is remembered per device. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.84.0 - New: recent searches dropdown on search boxes.

## 6.84.0 note - recent searches
Search boxes now remember what you searched. Focus a search field (Members,
Invoices, Coaches, Sales, Expenses, History, Trials, Camp members, Enrolment, Audit)
and a dropdown shows your recent searches for THAT field - click one to run it
again. Each field keeps its own history (up to 8, newest first, duplicates merged,
very short terms ignored), with a Clear button. History is stored in
state.recentSearches and syncs across devices like the rest of your data. No schema
change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.83.0 - Fix: attendance grid showed wrong coach per sport.

## 6.83.0 note - attendance coach mismatch
On the Attendance grid, a member's sport row could show the WRONG coach. The grid
resolved each sport's coach by looking it up ONLY in the member's enrollments[]; if
a sport existed only in subscriptions[] (common for imported/older members, or when
enrollments got out of sync), the lookup failed and it fell back to the member's
HEADLINE coach. Example: a member with Gymnastic (Jennifer), Swimming (Mostafa),
Kick Boxing (Aya) where Gymnastic was missing from enrollments showed Gymnastic
under "Aya" instead of Jennifer. Fixed: the grid now resolves each sport's coach
from the matching enrollment, then the matching subscription, and only then the
headline coach. Each sport now pairs with its correct coach. No schema change.

# Black Stars CRM
Version 6.82.0 - Fix: coach earnings page now credits per-sport commission.

## 6.82.0 note - coach commission audit (batch)
Audited coach commission. Found and fixed a bug on the individual coach
earnings/profile page: its coachEarnings() calculation credited commission at the
INVOICE level (inv.coachId + full inv.amount). On a multi-sport / merged invoice -
where two coaches share one invoice (since the one-invoice-per-member change) - the
invoice's coach was credited the WHOLE amount and the other coach got nothing.
e.g. Karate (Coach A, 375) + Swimming (Coach B, 400) on one invoice credited A with
775 and B with 0. Fixed: coachEarnings() now walks LINE ITEMS and credits each
coach only for their own sport's price (A:375, B:400), with a fallback to the
invoice coach for legacy invoices that have no line items. The Salaries / Coach
Performance pages already used the correct line-item logic and were unaffected.
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.81.0 - Fix: invoice merge no longer loses discounts.

## 6.81.0 note - merge tools audit (batch)
Audited the invoice-merge and product-merge tools. Found and fixed one real bug:
when consolidating a member's invoices, if any invoice had a DISCOUNT (its charged
amount was below the sum of its line-item prices), the merge recomputed the total
from raw line prices and dropped the discount - inflating the total and creating a
phantom "balance due" on a fully-paid member. Now the merge keeps each invoice's
true charged amount (summing the original amounts) and carries the combined
discount onto the kept invoice. Partial payments and revenue months are still
preserved. The product-merge tool was audited and found correct (handles missing
stock and orphan sale refs safely). No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.80.0 - Freeze: admins can grant free days; invoice policy unchanged.

## 6.80.0 note - admin freeze override
Admins can now freeze a membership for ANY number of days, overriding the standard
one-week-per-month allowance (useful for goodwill / special cases). The freeze
dialog for an admin removes the cap and the "no allowance left" block, shows quick
presets up to 90 days, and notes that it's an admin override. Non-admin roles are
still held to the one-week-per-month allowance. The PRINTED INVOICE conditions are
deliberately unchanged - they still state "Membership may be frozen up to one week
for each month of membership" (EN + AR), since that remains the customer-facing
policy. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.79.0 - Invoices: deleting keeps your filters & page.

## 6.79.0 note - delete invoice without losing your place
Deleting an invoice from the Invoices screen used to re-render the whole page,
resetting every filter (month, day, category, activity, coach, method, search) and
jumping back to page 1. Now the delete updates the table IN PLACE: the row
disappears and totals update, but the current filters and pagination stay exactly
as they were. (If an invoice is deleted from somewhere other than the Invoices
screen, it still does a normal render.) No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.78.0 - Fix: can't renew Summer Camp members.

## 6.78.0 note - camp renewal bug
Renewing a Summer Camp member was broken: the renewal dialog's Activity dropdown
was hardcoded to the regular sports list (MMA, Boxing, ...) and did NOT include
"Summer Camp". So a camp member's renewal defaulted to a random sport (MMA) and
never applied camp pricing/duration. Fixed: the Activity dropdown now includes the
member's own enrolled activities - including Summer Camp - selected by default, so
camp members renew correctly as camp. Camp renewals also no longer require a coach
(camp has none; coach is stored as null). Regular members are unaffected. No schema
change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.77.0 - Fix: sibling split excludes withdrawn family members.

## 6.77.0 note - sibling split counts active siblings only
The "Add Sibling" payment split divided the family total across ALL members in the
family group, including withdrawn/archived ones. So if a family had a former member,
adding a new sibling would give the withdrawn person a share and shrink everyone
else's incorrectly (e.g. 750 split 3 ways = 250 instead of 375 across the 2 active
kids). Fixed: the split now counts only ACTIVE siblings, and splitSiblingPayment
itself skips deleted members as a safeguard. No schema change (SCHEMA_VERSION 9).

# Black Stars CRM
Version 6.76.0 - Fix: "Fix invoice dates" no longer touches renewals.

## 6.76.0 note - protect renewals in the fix-dates tool
The Cleanup Center "Fix invoice dates" tool (6.72) could wrongly flag a member's
RENEWAL invoice. A renewal is correctly dated to its own month (e.g. a June
renewal for a member who first started in January), but the tool compared every
membership invoice against the member's earliest start date - so it would offer to
move the June renewal back to January, corrupting its date and revenue month.
Fixed: the tool now only considers members with a SINGLE membership invoice (whose
one invoice should match the start date). Members who have renewed (2+ invoices)
are skipped entirely - consolidating those is the separate "Consolidate invoices"
tool. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.75.0 - New: Notes & Reminders screen with sidebar badge.

## 6.75.0 note - personal notes & reminders
Added a "Notes & Reminders" screen (Main). Jot a note with a title and details,
set a PRIORITY (High / Medium / Low - colour-coded), optionally a REMINDER date,
and flag items to FOLLOW UP. Notes that need attention - flagged to follow, or with
a reminder that is today or overdue - drive a red count BADGE on the sidebar item,
so you always see how many items are waiting. Filter by Open / Needs attention /
Done / All; mark done, edit, or delete each note. Stored in state.notes and synced
like everything else. Route count -> 48. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.74.0 - Invoices: filter by a specific day.

## 6.74.0 note - invoice day filter
Added a date picker to the Invoices filter bar. Pick a day to show only invoices
dated that exact day; a small clear (X) button resets it. Works alongside the
existing month / category / activity / coach / method filters and search. No
schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.73.0 - Cleanup Center: merge duplicate products.

## 6.73.0 note - merge duplicate products
Added a fourth Cleanup Center tool: "Merge duplicate products". It finds products
entered more than once under the same name (case-insensitive) - which split stock
and sales reporting (the root cause behind the earlier Gymnastic Uniform issue).
Merging keeps the oldest record, sums every duplicate's stock onto it, re-points
all past sale line items to the kept product, inherits category/sku/threshold where
missing, and removes the extra records. Current stock stays correct (summed initial
minus all sales). Admin-only, confirmed and audit-logged. No schema change.

# Black Stars CRM
Version 6.72.0 - Cleanup Center: fix misdated invoices.

## 6.72.0 note - fix invoice dates to start date
Added a third tool to the Cleanup Center: "Fix invoice dates". It finds membership
invoices dated noticeably after the member's start date (old members added after
the fact, like Saad - registered now but starting in January), shows the wrong vs
correct date and the day gap, and re-dates the invoice AND its payment records to
the member's start date so revenue is recognised in the correct month. Amounts are
never changed. Works per-invoice or "Fix all" at once; admin-only, confirmed and
audit-logged. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.71.0 - Fix: bilingual invoice labels no longer scramble (bidi).

## 6.71.0 note - invoice bidirectional-text fix
On the invoice PDF, bilingual labels that are followed by a value - "Issued",
"Printed", "Payment method", "Amount in words", and the per-line "Coach" - were
rendering in the wrong order (e.g. the date "21 Jun 2026" got split and reordered)
because the Arabic label between the English word and the value flipped the text
direction. Fixed by isolating every Arabic label in a <bdi> (bidirectional
isolate) element and forcing those lines to dir="ltr", so the order stays
"English . Arabic: value" correctly. Applied to all 17 bilingual invoice labels
for consistency. Visual-only; no data or schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.70.0 - Batch E: editable payment dates + refreshed handover.

## 6.70.0 note - Batch E housekeeping
1. The "Edit pricing & payment" dialog now has an editable PAYMENT DATE field
   (defaults to today). The payment(s) it records - on existing or newly-created
   invoices - are dated and counted in that date's month, so you can back-date a
   payment that was actually collected on another day.
2. The Summer Camp pricing edit now dates its payment to the CAMP START date
   instead of today, so camp revenue lands in the right month.
3. Refreshed HANDOVER.md - it was stuck at v4.46.2 / ~9,000 lines; now reflects
   the current v6.70 app (~19,900 lines, 47 routes, schema 9, test/render gates,
   and the major systems added since).
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.69.0 - Fix: new-member invoice dated to the sport start date.

## 6.69.0 note - invoice date follows start date
When registering a member (including back-dated / old members), the invoice was
always dated TODAY because the "Payment date" field was pre-filled with today.
Now that field is BLANK by default, and when left blank the invoice is dated to
the membership START date (the earliest sport start) - so a member registered now
but starting in January gets a January-dated invoice, and revenue lands in the
correct month. The admin can still type an explicit payment date to override (e.g.
when cash was actually collected on a different day). The printed invoice's
"Printed" line still shows today. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.68.0 - Add Sibling: copy all details + split the family payment.

## 6.68.0 note - sibling payment split
"Add Sibling" still copies all the shared details (phone, nationality, level, and
the full plan: sports / coaches / classes / prices), and now also SPLITS the one
family payment equally across the siblings. When you add a sibling, the parent's
single family total is divided by the number of siblings and each child's
membership invoice is set to that share (e.g. 750 for 2 kids -> 375 each; add a
3rd -> 250 each). The rounding remainder is placed on the first sibling so the
shares always add back to the exact family total - no money is created or lost.
The family total is captured once (stored on the family record) so adding a 3rd or
4th sibling re-splits the original total rather than compounding. Each split
invoice is noted "Family share (1/N)" and revenue stays in the month it was paid.
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.67.0 - Fix: Product Sales groups by product name (no more split rows).

## 6.67.0 note - Product Sales discrepancy
Product Sales was showing the same item (e.g. "Gymnastic Uniform") as several
separate rows. Cause: it grouped by product ID, but the same product can exist
under more than one product record, or a sale line can have no product ID - so
identical items landed in different buckets. Now it groups by the product NAME
(case-insensitive): one row per product name, with units, revenue and sales count
summed, and stock totalled across all product records sharing that name. This
makes Product Sales reconcile with the Invoices/Product sales lines. No schema
change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.66.0 - Invoices: removed Description column.

## 6.66.0 note - cleaner invoices table
Removed the Description column from the Invoices screen (header + cells) to
declutter the table - the sport/coach/customer columns already convey the same
information. Description is still stored on each invoice, still printed on the PDF,
and still searchable from the search box; it's only hidden from the list view.
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.65.0 - Invoice search by EN/AR name, mobile, QID.

## 6.65.0 note - richer invoice search
The Invoices search box now reliably matches by the customer's English name,
Arabic name, mobile number (any format - spaces, +974, partial), and QID, in
addition to ref/coach/sport/description. It pulls these from the linked member
record directly (plus the invoice's own snapshot fields), so a member's Arabic
name and QID are searchable even when not stored on the invoice itself. Phone
matching stays format-insensitive. Placeholder updated. No schema change.

# Black Stars CRM
Version 6.64.0 - Invoice: drop header coach, add Arabic customer name.

## 6.64.0 note - invoice header tidy-up
1. Removed the single "Coach" box from the invoice header. On a multi-sport
   invoice it only showed the FIRST sport's coach (misleading). Each coach is
   already listed per line item in the Description, so the header now shows just
   Activity and Period.
2. The "Billed to" block now shows the customer's ARABIC name under their English
   name when one is on file (right-aligned RTL). Works for saved invoices and the
   on-the-fly generated ones. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.63.0 - "Get Invoice" works even without a saved invoice.

## 6.63.0 note - Get Invoice always available
The "Get Invoice" button on a member profile used to disappear when the member had
no saved membership invoice (common for imported/legacy members who have
enrollments but no invoice record - e.g. Ali, 3 sports, PAID 1,125 but no invoice).
Now the button shows whenever the member has an invoice OR any sport enrollment,
and if there's no saved invoice it builds one ON THE FLY from the member's
enrollments (each sport, its coach, classes and price; total = sum; dated to the
earliest sport start). That invoice is temporary and never saved - it's only used
to render the PDF, exactly like the multi-invoice combined print. No schema change.

# Black Stars CRM
Version 6.62.0 - Cash collections kept off the Expenses screen.

## 6.62.0 note - separate cash collection from expenses
"Cash collected by owner" entries are no longer shown on the Expenses screen -
they belong on the dedicated Cash Collection page. The Expenses list, its grand
total and category subtitle now exclude that category, the category is removed
from the Expenses filter dropdown, and the "+ New Expense" form no longer offers
it (cash collection is recorded only from the Cash Collection screen). The
underlying records are unchanged - Reports / net-profit still account for cash
collection as before; this only cleans up the Expenses view. No schema change.

# Black Stars CRM
Version 6.61.0 - Fix: rentals no longer flagged as duplicate invoices.

## 6.61.0 note - duplicate detector ignores repeat rentals
Court Rental / Boxing Room invoices are inherently repeatable - the same customer
books the same facility many times a month. The duplicate detector was grouping
them by month, so two legitimate rentals of the same court on different days were
wrongly flagged as an "exact" duplicate. Now rentals are matched by the exact DATE
(so only a genuine same-day double-entry is flagged) and are excluded from the
"within 7 days" possible tier. Membership and product duplicate detection is
unchanged. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.60.0 - Fix: per-sport subscription status reflects its own end date.

## 6.60.0 note - subscription-row status bug
In the member profile's Subscription History, every sport row showed "active"
even when that sport's period had ended, because the badge used a stored 'status'
field that was set once and never updated. Now each row derives its OWN status
from its END date and attendance: a sport whose end date has passed shows
"expired", a fully-attended one shows "completed", otherwise "active". This is
independent of the member's overall status - a member can be Active (because one
sport still runs) while other sports on the same profile correctly show expired.
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.59.0 - Member profile: clickable attendance + export.

## 6.59.0 note - jump to attendance + export a member's history
1. On the member profile, the CLASSES and ATT RATE cards are now clickable - they
   open the Attendance grid pre-filtered to that member (all months, so their full
   history shows). A small "" download icon on the Att Rate card, and a new
   "Attendance" button in the profile footer, export that member's COMPLETE
   attendance history to CSV: one row per recorded day (date, month, sport,
   Present/Absent) with present/absent totals and the member's details at the top.
No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.58.0 - Fix: "Completed" status now reflects the CURRENT membership.

## 6.58.0 note - Completed status bug
A member could show "Completed" while their current membership was still in
progress (e.g. only 3 of 8 classes attended, expiry in the future). Cause:
isCompleted() scanned ALL subscriptions including past months, so a fully-attended
PRIOR month kept marking the member Completed even after they renewed into a new,
unfinished subscription. Fixed: isCompleted() now looks only at the CURRENT cycle's
subscription(s) (those starting on/after the member's current start date; if none
match, the most recent one). A member is Completed only when their current package
is fully attended - otherwise Active. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.57.0 - Bilingual invoice PDF + club rule conditions.

## 6.57.0 note - bilingual invoice + policy terms
1. The printed invoice is now bilingual (English / Arabic) on its structural
   labels: Invoice, Issued, Printed, From, Billed to, Activity, Coach, Period,
   Description, Qty, Amount, Subtotal, Tax, Total, Paid, Balance due, Amount in
   words, Payment method. (The Terms block was already English+Arabic side by
   side.) Member-entered data - names, notes - is left as typed.
2. Added the three club conditions to BOTH the English and Arabic terms lists:
   - The sport may be switched only once per membership.
   - Membership may be frozen up to one week for each month of membership.
   - Classes must be completed within the package validity period; unused classes
     after expiry are forfeited.
These match the in-app enforcement added in 6.53/6.54. No schema change.

# Black Stars CRM
Version 6.56.0 - Batch C: Cleanup Center for legacy data.

## 6.56.0 note - Cleanup Center (System, admin)
New System -> Cleanup Center screen to find and fix legacy data messes left from
imports and pre-6.55 edits:
1. DUPLICATE ENROLLMENTS - members with the same sport enrolled more than once.
   "Keep one" removes the extra enrollment row(s) (oldest kept); invoices and
   attendance are untouched.
2. SPLIT INVOICES - members holding several membership invoices. "Merge into one"
   consolidates all their sport lines and payments into the OLDEST invoice and
   soft-deletes the rest. Payments keep their own months, so monthly revenue is
   unchanged - it just becomes a single invoice document per member (the v6.55
   rule applied retroactively).
Both fixes are admin-only, confirmed, and audit-logged; invoice removals are soft
deletes (recoverable). Route count -> 47. No schema change (SCHEMA_VERSION 9).

# Black Stars CRM
Version 6.55.0 - One invoice per member: edits merge, not duplicate.

## 6.55.0 note - keep a single membership invoice per member
Editing an existing member no longer creates extra invoices. Specifically:
- ADDING a sport during edit now MERGES into the member's existing membership
  invoice (adds a line item, raises the total) instead of creating a second
  invoice. The added amount is recorded as a fresh PAYMENT dated today, so the
  invoice document stays single while revenue is still counted in the month the
  money was actually collected.
- DELETING a sport already adjusts the existing invoice in place (prorates paid).
- EDITING a sport's duration / price / coach already syncs the existing invoice.
- UPDATING member details (name, phone) now also syncs onto their existing linked
  invoice(s) - no new invoice.
New invoices are still created only for: adding a NEW member, RENEWING, a PRODUCT
sale, or a RENTAL. If a member somehow has no membership invoice yet, adding a
sport creates the first one (fallback). No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.54.0 - One sport switch; commission kept; 2-reminder tracking.

## 6.54.0 note - switch limit, commission, reminder status
1. SPORT SWITCH is now limited to ONCE per membership cycle. A second attempt is
   blocked with a clear message (shows the prior switch). The allowance resets when
   the member renews. For other corrections, Withdraw or Edit pricing still work.
2. Coach commission/salary on a switch is preserved (this already worked via the
   attended-classes split: the old coach keeps the share they earned for classes
   already attended, and the unearned remainder transfers to the new coach). No
   change to that maths - confirmed and now covered.
3. REMINDERS (expiring / expired / due) now track a COUNT, not just a date. A
   member can be reminded up to TWICE per cycle; the 2nd reminder asks for
   confirmation ("send a second/final reminder?") and a 3rd is blocked. The status
   column shows "1/2" or "2/2" with the last date, and the action turns to "done"
   once twice-reminded. Legacy lastRemindedAt counts as one. Same applies to the
   camp reminder buttons and the bulk camp panel. No schema change.

# Black Stars CRM
Version 6.53.0 - Freeze: one week per month, multiple freezes, in days.

## 6.53.0 note - freeze allowance one week per month
The membership freeze allowance is now ONE WEEK (7 days) for each month of
membership: a 1-month plan = 7 days, 2-month = 14, 3-month = 21, and so on
(rounded to the nearest month of validity). Members can freeze MORE THAN ONCE -
the allowance can be split across several freezes - as long as the running total
stays within it; the freeze dialog shows allowance / used / remaining and caps the
input at what is left. Freezes remain DAY-based (any number of days up to the
remaining allowance, with quick presets). The allowance resets when the member
renews (new cycle). Expiry and each sport's end date still shift forward by the
frozen days. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.52.0 - Bug-fix Batch 1: data-entry guards.

## 6.52.0 note - guard against bad data entry
1. Classes field now has sane bounds. A realistic count (<=60) saves freely; an
   unusually high one (61-365) asks for confirmation; anything absurd (>365, e.g.
   a mistyped year like "2026") is rejected with a clear message. The input also
   carries a max attribute. This stops fat-finger entries from polluting
   attendance percentages and coach reports.
2. Attendance marking is capped at the planned classes. If marking a member
   "present" would push their attended count past the classes they paid for in the
   current subscription period, it asks to confirm first (suggesting they may need
   to renew). Toggling an existing mark is unaffected. This complements the v6.27
   display clamp by stopping the over-count at the source.

No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.51.0 - Invoice date = sport start date; separate Printed date.

## 6.51.0 note - invoice issue date follows the sport start
1. "Generate latest invoice" now defaults the invoice date to the member's
   EARLIEST sport start date (the membership-period start), not today - so a
   retro-generated invoice carries the date the subscription actually began
   (e.g. 10 May, not the day you pressed Generate). With several sports it takes
   the earliest start. The admin can still override the date field; once edited
   by hand it won't be auto-changed.
2. The printed invoice now shows a separate "Printed {today}" line under the
   "Issued {invoice date}" line, so the document records when it was actually
   printed/exported, distinct from its issue date.

Revenue is unaffected by display-date changes where payments carry their own
month; for these generated invoices the month follows the issue (start) date as
before. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.50.0 - Remind all expiring camp members (guided panel).

## 6.50.0 note - "Remind all expiring" for camp
A "Remind all expiring (N)" button now appears on the Camp Members screen whenever
there are members expiring within 7 days. It opens a guided panel with one row per
expiring-soon camp member - name, phone, expiry and days left - each with its own
WhatsApp button carrying the warm bilingual renewal message. Because WhatsApp can
only open one chat at a time, you tap down the list one parent at a time; the panel
ticks each off (⏳ -> ✅), stamps them reminded (audit-logged), and shows a live
progress bar ("3 / 9 messaged") so nobody is missed or double-messaged. Members
without a phone are listed but flagged to add a number first. No schema change.

# Black Stars CRM
Version 6.49.0 - Camp expiring-soon: friendly WhatsApp renewal reminder.

## 6.49.0 note - remind expiring camp members
Camp members whose membership expires within 7 days now show a 📱 Remind button
on their row in the Camp Members screen. It opens WhatsApp with a warm, bilingual
(Arabic-first) message that names the member and their expiry date - "We'll really
miss {name} at camp! We'd love for them to renew and enjoy even more activities and
fun with their friends." Sending stamps lastRemindedAt (audit-logged), same as the
main renewal reminders. The button only appears for expiring-soon members who have
a real phone number. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.48.0 - Product Sales insights screen.

## 6.48.0 note - product-level sales analytics
New Finance -> Product Sales screen. It aggregates every product sale (from
state.sales items) by product so you can see best-sellers, units sold, revenue
per product (with a bar), number of sales, and current stock at a glance - rather
than reading it off individual invoices. Includes a period filter (This month /
Last month / This year / All time / Custom range), a Sort dropdown (revenue /
units / stock low-first / name), KPI cards (products sold, units, revenue, best
seller), a totals footer, low-stock flags, and CSV export. Read-only; no schema
change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.47.0 - Expenses: multi-select category & method filters.

## 6.47.0 note - pick several categories / methods at once
The Expenses screen's Category and Method filters are now multi-select checkbox
dropdowns instead of single-pick. You can view several categories together (e.g.
Salary + Coach Commission), or several methods (Cash + Card), and the table,
footer totals and subtitle all reflect the combined selection. The button shows
"N selected" when more than one is ticked. No schema change (SCHEMA_VERSION 9).

# Black Stars CRM
Version 6.46.0 - Families page: member breakdown + paid/owed totals.

## 6.46.0 note - family financials and member list
1. The Families page now shows, for each household, a TABLE of its members - name,
   Arabic name, sport(s), status, total PAID, and outstanding (Owes) - with a
   "Family total" footer summing paid and owed. A new "Total paid" KPI sits beside
   the combined-balance KPI at the top. Click any member row to open them.
2. The bulk "Add to family" button (in the Members selection bar) now appears only
   when 2 or more members are selected, since a family needs at least two. It still
   suggests a family name from the shared surname and the common phone.

memberPaidTotal counts paid amounts across ALL the member's non-deleted invoices
(every category, cash-basis); outstanding is membership balance as before. No
schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.45.0 - Bulk "Add to family" for selected members.

## 6.45.0 note - group selected members into a family at once
The Members selection bar (shown when you tick members) has a new "Add to family"
button. Pick several members - e.g. siblings who share a phone - and assign them
all to one household in one step: choose an existing family or create a new one.
The dialog pre-suggests a family name from the members' shared surname and a
shared contact phone from the selection, and lists everyone being grouped (showing
who is already in a family). No schema change - it sets each member's familyId,
the same field the single-member family dialog uses.

# Black Stars CRM
Version 6.44.0 - Fix Add Sibling; clearer same-phone handling.

## 6.44.0 note - Add Sibling now works end-to-end
"Add Sibling" (the copy-member button) used to copy the source member's NAME and
QID too, so when you pressed Save the new record looked like an exact duplicate
(same name + same phone) and was BLOCKED, reopening the original - which is why it
seemed broken. Now it copies the shared family data - phone, second phone, email,
nationality, level, and every sport/coach/class/price - but CLEARS the name,
Arabic name, birthdate, gender and QID (a sibling is a different person and QID is
a personal national ID). You just enter the sibling's own name + birthdate and
save. Because the name now differs, the same-phone/different-name confirmation
("Mobile X already belongs to Y - add as a separate member?") is what appears,
which is the intended family-on-one-phone path. No schema change.

# Black Stars CRM
Version 6.43.0 - Members: "Similar names" filter to find likely duplicates.

## 6.43.0 note - find redundant/duplicate member names
The Members screen has a new "Similar names" toggle in the filter bar. When on,
it shows only members whose English OR Arabic name is the SAME or very similar to
another member's - using edit-distance (Levenshtein) similarity, so "Mohamed Ali"
clusters with "Mohammed Ali", and Arabic names differing only by a hamza/diacritic
(احمد محمد / أحمد محمد) are caught too. A summary line shows how many groups and
members were flagged. Open each to compare and merge/archive the real duplicates.
Short names (<4 chars) require an exact match to avoid false positives. Toggling
it off or Clear filters restores the normal list. No schema change.

# Black Stars CRM
Version 6.42.0 - Format-insensitive phone search + per-coach invoice lines.

## 6.42.0 note - phone search any format + coaches on every invoice line
1. Mobile search now ignores formatting everywhere it matters: spaces ("5040
   5905"), a leading + or 00, and the 974 country code all match a stored
   "+97450405905". Added to the Invoices, Transactions and Transfer searches
   (the Members list already did this). Partial digit runs still match.
2. Generated/combined membership invoices now store per-sport LINE ITEMS, so the
   printed invoice lists EACH enrolled sport on its own row with its own coach
   (previously a multi-sport invoice showed only the primary coach and merged the
   sports into one description line with no second coach).

Note on the "4 invoices for one customer": those are real saved invoices - the
original per-sport ones plus a later combined one created via "Generate latest
invoice". That flow warns about a same-month duplicate but still lets you proceed,
so overlaps can exist. Use Finance -> Duplicate Invoices to review and remove the
extras. No schema change (SCHEMA_VERSION stays 9).

# Black Stars CRM
Version 6.41.0 - Duplicate Invoices: dedicated side-by-side review screen.

## 6.41.0 note - review duplicate invoices before deleting
Duplicate-invoice review moved from a cramped popup to a dedicated screen under
Finance -> Duplicate Invoices (admin only). Each suspected duplicate group now
shows its copies as detailed cards SIDE BY SIDE - ref, date, month, customer,
category, line items, amount, paid, method and description - with a "vs" between
them, so you can compare the old and new invoice before deciding. The oldest copy
is marked KEEP (green); each other copy has View PDF and Delete buttons. Summary
counters show groups / exact / possible / extra at the top. Delete is now a SOFT
delete (sets deleted=true) so it keeps an audit-log entry and revenue reports
exclude it cleanly, rather than hard-removing the record. The Invoices page
"Find duplicates" button opens this screen. No schema change.

# Black Stars CRM
Version 6.40.0 - Transfer Membership: cleaner single-column redesign.

## 6.40.0 note - clearer Transfer Membership UX
Removed the redundant right-side "Members with transferable memberships" table
(the From-member search + filters already do that job). The page is now a single
centered column with a clear numbered 3-step flow: 1) find the sender via search +
Sport/Coach filters, picking from a clean clickable result list (EN/AR name +
mobile); 2) choose the sport; 3) find the receiver the same way. Selected members
show as a confirmation chip with a Change button, the result lists cap at 40 for
performance, and a green "Ready to transfer" summary precedes the action. Transfer
history stays below, full width. No schema change (SCHEMA_VERSION stays 9).

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
