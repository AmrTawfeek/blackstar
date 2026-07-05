// ═══════════════════════════════════════════════════════════════════════════
//// LOCAL EMULATOR CONFIG — for testing the full cloud path on your own machine.
// ═══════════════════════════════════════════════════════════════════════════
//
// To test locally:  rename this file to  firebase-config.js  (back up the real
// one first), start the emulator + seed (see LOCAL-TESTING.md), then open the app.
//
// For REAL deployment, use your real firebase-config.js (with useEmulator removed
// or set to false). This file only affects local testing.
// ═══════════════════════════════════════════════════════════════════════════

window.FIREBASE_CONFIG = {
  // With the emulator, the apiKey just needs to be non-empty — it is never checked
  // against real Google servers. projectId must match .firebaserc ("demo-*" means
  // the emulator runs fully offline — no real Firebase project or login needed).
  apiKey: "demo-emulator-key",
  authDomain: "demo-blackstars.firebaseapp.com",
  projectId: "demo-blackstars",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",

  dataPath: "clubs/blackstars",

  // ── Local emulator switch ──────────────────────────────────────────────────
  useEmulator: true,
  emulatorHost: "127.0.0.1",
  firestoreEmulatorPort: 8080,
  authEmulatorPort: 9099,
};
