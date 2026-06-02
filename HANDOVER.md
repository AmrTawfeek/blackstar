# Black Stars CRM — Handover for Freelancer

**App version:** 4.46.2 (v89.2)
**Stack:** Vanilla JavaScript, no build step, no framework
**Total code:** ~9,000 lines across 3 main JS files
**Browser support:** Chrome / Edge 80+, Firefox 113+, Safari 16.4+

## What the app does

A CRM for a martial arts academy in Doha, Qatar:
- **Members** — registration, multi-sport enrollment, renewals, freezes
- **Attendance** — daily marking, per-sport, per-month
- **Invoices** — unified form for memberships, products (with cart/POS), other
- **Products** — stock catalog with low-stock alerts
- **Rentals** — football court / boxing room / swimming pool with hourly rates
- **Schedule** — drag-and-drop weekly grid (Saturday–Thursday, 3PM–9PM)
- **Coach performance** — commission tracking based on active-member revenue
- **Excel import/export** — Members, Attendance (with color-coded fills), Expenses, Sales
- **PDF generation** — invoices, per-student attendance cards
- **JSON backup/restore** — full state snapshot

## File structure

```
blackstars-localhost/
├── index.html              # Entry point — loads scripts in order
├── app.js                  # Core: state, routing, login, persistence (~990 lines)
├── pages.js                # All page renderers + importers + POS (~8,900 lines)
├── styles.css              # 4 themes: dark / light / cream / colorful
├── seed-embed.js           # Bundled demo data (207 sample members) — opt-in only
├── seed.json               # Same data as readable JSON
├── xlsx-mini.js            # Pure-JS XLSX reader with cell-color support
├── xlsx-mini-write.js      # Pure-JS XLSX writer with green/red/yellow fills
├── firebase-config.js      # ⚠️ EMPTY — freelancer fills this in to enable cloud sync
├── storage.js              # Abstraction: switches localStorage ↔ Firebase
├── guide.html              # User manual (accessible from sidebar)
├── deployment-guide.html   # Step-by-step Firebase + hosting setup
└── README.md               # Release notes
```

## What's been built that helps you

### 1. Storage abstraction is already in place
`storage.js` provides a tiny interface (`Storage.load()`, `Storage.save()`, `Storage.signIn()`, `Storage.onRemoteUpdate()`). It currently routes to `localStorage` by default. If `firebase-config.js` has valid keys, it auto-routes to Firebase instead.

**You don't need to refactor the app to add cloud sync. Just fill in the Firebase keys.**

### 2. Schema migration system
`app.js` has `runMigrations(data, fromVersion)` that adapts old data to new schema in-place — never wipes user data. `SCHEMA_VERSION` is currently `3`. Bump it ONLY when state shape changes; bumping `APP_VERSION` (display label) does nothing to data.

### 3. The login screen adapts automatically
- If `storage.js` returns `isCloud()` → login asks for email/password and validates against Firebase Auth
- If offline → login is the legacy `admin / admin123`

### 4. Data model is JSON-tree compatible
All app state lives in one `state` object with arrays: `members[]`, `coaches[]`, `invoices[]`, `expenses[]`, `salaries[]`, `sales[]`, `trials[]`, `rentals[]`, `rentalCustomers[]`, `schedule[]`, `products[]`, `settings{}`. This maps cleanly to a single Firestore document.

## Your tasks

1. **Set up the Firebase project** per `deployment-guide.html` (step-by-step)
2. **Fill in `firebase-config.js`** with the 6 config values from Firebase console
3. **Configure Firestore security rules** (auth required to read/write — example in deployment guide)
4. **Create the admin user** in Firebase Authentication
5. **Deploy** to Firebase Hosting (or Cloudflare Pages / Netlify if you prefer)
6. **Add the deployed URL** to Firebase Auth's authorized domains
7. **Test end-to-end**: log in, add a member, log out, log in on another device → data syncs
8. **Migrate existing data** if any (I'll send you a JSON backup; restore via Settings → Restore from backup after first cloud login)
9. **Short handover** — 1-page doc or 5-min screen recording showing me how to:
   - Add a new admin user in Firebase Console
   - View the data in Firestore Console
   - Make a manual backup

## Out of scope

- **No new features.** Don't add anything I haven't asked for.
- **No UI redesign.** Keep the existing look.
- **No code rewrites.** The vanilla-JS structure is intentional for now.
- **No database normalization.** Single JSON document in Firestore is fine for this scale (~500 members, ~3 users).

## Cost / scope constraints

- Free tier only (Firebase Spark plan)
- One Firestore document at path `clubs/blackstars` (configurable in `firebase-config.js`)
- Single shared admin account (no per-user roles needed)
- Estimated total: 5-10 hours of work for a competent developer

## Existing test data

The bundled `seed-embed.js` contains 207 sample members + sample coaches/schedule/etc. for testing. It's **NOT auto-loaded** — only loads if admin clicks "🧪 Load demo data" in Settings. You can use it to validate the Firestore round-trip works.

## Questions to ask me before starting

- Will I send you a JSON backup of real production data to migrate, or are we starting fresh?
- Do I want a custom domain (e.g. `crm.blackstars.qa`) or is `blackstars-crm.web.app` fine?
- Will you support the deployment ongoing, or one-time only?

## Communication

When you complete the work, send me:
1. The deployed URL
2. The Firebase project ID (so I can be added as a collaborator if needed)
3. The handover doc / video
4. A list of any deviations from this spec (and why)

Thanks!
