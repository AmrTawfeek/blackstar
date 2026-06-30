# Test everything LOCALLY before deployment

Two ways to test, depending on what you want to check.

---

## A. Quick functional test — NO install (offline mode)

Your backup JSON **is** a full export of the Firebase database. To exercise every
page, your real data and all the business logic with zero setup:

1. Make sure `firebase-config.js` has blank keys (the shipped default → offline mode).
2. Open `index.html` (or serve the folder: `npx http-server . -p 5500`).
3. Sign in `admin` / `admin123`.
4. **Settings → Data & Backup → Restore from backup** → pick
   `blackstars-backup-2026-06-25.json` (or a fresher backup).

This loads all your data into the browser and lets you click through everything.
What it does **not** test is the cloud multi-document sync / concurrent multi-user
behaviour — for that, use option B.

---

## B. Full multi-user test — Firebase Local Emulator

This runs the **real** cloud code path (Firestore + Auth) entirely on your machine,
with your real data, so you can test the migration and true concurrent editing
before touching production.

### Prerequisites (one time)
- **Node.js** — already installed.
- **Java 21+** — already installed (the Firestore emulator needs a JRE).
- **Firebase CLI**:  `npm install -g firebase-tools`
- **Admin SDK** (for the seed script), run inside this folder:  `npm install firebase-admin`

### Step 1 — switch the app to local mode
In the `blackstars-localhost` folder, keep a copy of your real config, then activate
the emulator config:
```
copy firebase-config.js firebase-config.PROD.js
copy firebase-config.LOCAL.js firebase-config.js
```
(`firebase-config.LOCAL.js` points the app at the local emulator via `useEmulator:true`.)

### Step 2 — start the emulator  (terminal 1, leave it running)
```
firebase emulators:start --only firestore,auth --project demo-blackstars
```
Emulator dashboard: http://127.0.0.1:4000  ·  Firestore on 8080  ·  Auth on 9099.
The `demo-` project prefix means it runs fully offline — no Firebase login or real
project needed.

### Step 3 — seed your data + a login  (terminal 2)
```
node tools/seed-emulator.js
```
This creates a staff login **admin@blackstars.qa / admin123** and loads your backup
as a **legacy single document** — so you can test the in-app Migrate button next.
- Use a specific backup:  `node tools/seed-emulator.js "C:\path\to\backup.json"`
- Seed already-migrated instead:  `node tools/seed-emulator.js --multi`

### Step 4 — serve the app  (terminal 3)
```
npx http-server . -p 5500 -c-1
```
Open **http://127.0.0.1:5500** and sign in `admin` / `admin123`.
(Don't use ports 8080 / 9099 / 4000 — those are the emulator.)

### Step 5 — test the migration
**Settings → Data & Backup → 🧩 Cloud structure → Migrate to multi-document.**
Watch the Emulator UI (http://127.0.0.1:4000 → Firestore) — `clubs/blackstars` gains
`members`, `invoices`, `auditLog`, … subcollections, one document per record.

### Step 6 — test CONCURRENT multi-user
Open the app in **two windows** (two browsers, or one normal + one incognito) and
sign in on both. Then, at the same time:
- Edit **different members** in each window → both save, no conflict, each change
  appears live in the other window.
- Mark **attendance for different members** in each window → independent, no clash.
- Mark the **same member's** attendance for different days/sports in each window →
  **both are kept** (the attendance map is deep-merged — nothing is overwritten).
- Edit the **same member's** different fields (e.g. phone in one, email in the other)
  → both survive.

That is the behaviour you're deploying: any number of staff writing at once with no
corruption.

### Step 7 — finish up
- Stop the emulator with **Ctrl+C** in terminal 1. Emulator data is in-memory and
  resets on restart (see "Persist emulator data" below to keep it).
- Restore production config:  `copy firebase-config.PROD.js firebase-config.js`

---

### Persist emulator data between runs (optional)
```
firebase emulators:start --only firestore,auth --project demo-blackstars \
  --import ./emu-data --export-on-exit ./emu-data
```

### A second staff user (optional)
In the Emulator UI → Authentication → Add user, or sign in with any non-member email;
all staff logins can write concurrently.

### Troubleshooting
- **"Port already in use"** — close a previous emulator, or change ports in
  `firebase.json` (and the matching ports in `firebase-config.LOCAL.js`).
- **App still offline / no migrate button** — confirm `firebase-config.js` is the LOCAL
  one (`useEmulator:true`) and the browser console shows
  `🔧 Using LOCAL emulators`.
- **Writes denied** — make sure you signed in (the rules require a staff login; the
  seed script created `admin@blackstars.qa`).
