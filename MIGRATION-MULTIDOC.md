# Black Stars CRM v6.238.0 — Multi-User (Multi-Document) Backend

This build re-architects the cloud backend so **any number of staff — reception,
coaches, the owner — can use the app at the same time** with no conflicts and no
lost data. The app, every page and all the business logic are unchanged; only the
way data is stored and synced changed.

> Built on top of stock **v6.238.0** — it keeps v6.238.0's hardened data-loss guard
> (`cloudReadFailed`, per-collection wipe detection) and server-source reads, and
> adds the new **`posts`** collection to the per-record set. Verified: logic suite
> **1085 pass / 4 pre-existing** date off-by-ones, import test passes, and the
> multi-document + concurrent-attendance harness **16/16** against the latest backup.

---

## The problem this solves

Previously the whole club lived in **one Firestore document** (`clubs/blackstars`),
overwritten in full on every save. To stop two people clobbering each other it used
a **single-writer "session lock"** — only one device could edit at a time; everyone
else was read-only. That also meant the data was approaching Firestore's hard
**1 MiB per-document limit**, after which all saves fail.

## What changed

| Before | After |
|---|---|
| 1 document holds everything | 1 document **per record** in subcollections |
| Whole-DB overwrite on save | **Only the fields that changed** are written |
| Single-writer session lock | **No lock — unlimited concurrent editors** |
| "Refresh for newer data" note | **Real-time auto-merge** — others' changes appear live |

```
clubs/blackstars                  ← settings / schema / camp schedule only
clubs/blackstars/members/{id}     ← one document per member (attendance lives here)
clubs/blackstars/invoices/{id}    ← one document per invoice
clubs/blackstars/auditLog/{id}    ← one document per log entry
…one subcollection per collection
```

### How attendance is kept safe (the key part of this request)
Attendance is stored inside each member as `dailyAttendance` (`{ "YYYY-MM": { sport:
{ day: "Y"/"N" } } }`). The new save path writes **only the changed fields** of a
record with Firestore's `merge:true`, which **deep-merges nested maps**. The result:

- **Two coaches marking different members at the same time** → different documents →
  zero contention.
- **Two coaches marking the *same* member's different sports/days at the same time**
  → the attendance map is deep-merged, so **both sets of marks are kept** — neither
  overwrites the other.
- **Reception editing a member's phone while a coach marks that member's attendance**
  → different fields, both preserved.

This is proven by `tests/storage-multidoc-test.js` (16 assertions, incl. the
same-member concurrent-attendance case).

### How conflicts are prevented (two layers)
1. **Real-time merge** — every device subscribes to live updates; another user's
   adds/edits/deletes merge into your open session automatically (the app's existing
   record-level merge keeps your own edits on a genuine clash). The re-render is
   deferred while you're mid-typing so nothing is yanked away.
2. **Field-level, deep-merged writes** — a save sends only the individual fields you
   changed, so simultaneous edits to different fields (or different attendance cells)
   of the same record never overwrite each other.

---

## One-time migration — what YOU do

> Your existing data is **not** touched until you click the button. It downloads a
> full backup first and is safe to re-run.

1. Deploy this build (copy your filled-in `firebase-config.js` into it).
2. **Update the Firestore rules** — Firebase Console → Firestore → Rules → paste
   `tools/firestore-rules-recommended.txt` → Publish. (Adds access to the per-record
   subcollections; lets all staff write concurrently.)
3. Open the app, sign in as admin.
4. **Settings → Data & Backup → 🧩 Cloud structure (multi-document)**.
   - If it says *"⚠ Legacy single-document detected"*, click
     **🧩 Migrate to multi-document**. A backup downloads, you confirm once, every
     record is copied into its own document, and the app reloads. Done.
   - If it says *"✓ Multi-document is active"*, you're already migrated.

After migration, the old `clubs/blackstars_session` lock document is unused and can
be deleted in Firestore (the new rules ignore it).

---

## Files changed vs. stock v6.211.0

- **`storage.js`** — rewritten Firebase backend: collection-based `load()`,
  field-level diff `save()` (deep-merges nested maps like `dailyAttendance`),
  per-collection real-time listeners, and `migrateToMultiDoc()`. localStorage
  (offline) backend unchanged.
- **`app.js`** — removed the single-writer save-gate; neutered `SessionLock` (kept as
  safe stubs); activated the previously-unused `mergeRemoteIntoState` for real-time
  auto-merge in `onRemoteUpdate`; added `membershipTransfers` + `drivers` to the merge
  set; removed the obsolete lock/take-over button. The stale-version write guard is
  kept.
- **`pages.js`** — added the **Cloud structure** card + one-click migration handler in
  Settings.
- **`tools/firestore-rules-recommended.txt`** — rules updated for subcollections.
- **`tests/storage-multidoc-test.js`** — new harness (mock Firestore with faithful
  deep-merge) proving migrate + diff-save + concurrent-attendance safety.

## Verifying

```
node tests/logic-tests.js            # business logic (unchanged: 1004 pass, 4 pre-existing date off-by-ones)
node tests/import-test.js            # member import (passes)
node tests/storage-multidoc-test.js  # multi-doc + attendance concurrency (16 pass)
```

## Notes / future options

- **Reads per load** — the app now reads every record document on load. For a club
  this is well within Firestore's free tier. If the audit log grows huge over years,
  we can paginate/archive it so startup stays fast.
- **Member-scoped security** — member logins can currently read all records; the
  per-record layout now makes a "members read only their own record" rule possible.
- Attendance stays inside the member document (deep-merged), which keeps **all current
  logic** — `memberStatus`, commission/payroll, reports, exports — working unchanged.
  No code that reads `member.dailyAttendance` had to change.
