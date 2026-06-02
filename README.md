# Black Stars CRM
Version 4.59.0 — Status auto-sync + CSV exports + data-quality filter.

## What's new

### 1. Auto-status sync on app load
A one-time sweep aligns each member's stored `m.status` field with the live derived status (based on `expiryDate` vs today). Frozen and Completed members are not touched. If any changes happen, a toast shows the count: *"✓ Refreshed status on N members (date-based)"*.

**Why:** the UI always uses `memberStatus()` which correctly derives Expired from dates, but the stored `m.status` could drift after imports or over time. CSV exports and any other consumer reading `m.status` directly now see fresh values.

### 2. Rentals CSV export
The Rentals page now has a **📥 Export** button in the topbar. Exports the CURRENT filtered set (respects facility + month + search filters). 12 columns:

Date · Time · Facility · Customer · Mobile · QID · Hours · Rate/hr · Amount · Method · Notes · Invoice Ref

Filename includes today's date for easy archiving (e.g. `rentals-2026-06-02.csv`).

### 3. Invoices CSV export — fixed + enhanced
The existing **📥 Export** button on Invoices now:
- **Respects the current filter** (was: exported ALL invoices regardless of filter dropdowns)
- **Adds 3 new columns**: Month, Category, QID
- **Sorted** newest-first
- **Empty-state warning** if nothing matches the filter
- **Filename** includes today's date (`invoices-2026-06-02.csv`)

### 4. Members data-quality filter
New filter dropdown on the Members page (next to nationality):
- **📋 All data** (default)
- **⚠️ Missing any field**
- **⚠️ No phone**
- **⚠️ No QID**
- **⚠️ No email**
- **⚠️ No birthdate**
- **⚠️ No nationality**

Smart phone detection: treats `+9747000...` placeholder numbers from old imports as "no phone".

**Use case:** the prior data audit flagged 191/207 members missing contact info. Now you can progressively clean up by filtering "No phone" → bulk-edit those members.

## Verified
- Status sync: stale 'Active' with expired date → flipped to 'Expired'; stale 'Expired' with future date → flipped to 'Active'; Frozen + Completed untouched ✓
- Data-quality filter excludes placeholder `+9747000...` phones ✓
- Invoices/Rentals export respects filter state ✓

## Backwards compat
- No schema bump
- Status sync is idempotent — running it again does nothing
- All existing exports still work
