// ═══════════════════════════════════════════════════════════════════════════
// FIREBASE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════
//
// To enable cloud sync, edit the values below with YOUR Firebase project's
// configuration. If you leave them empty, the app falls back to localStorage
// (offline-only mode).
//
// ─── How to get these values ────────────────────────────────────────────────
//
// 1. Go to https://console.firebase.google.com and sign in with a Google account.
//
// 2. Click "Add project" → name it (e.g. "Black Stars CRM") → continue → disable
//    Google Analytics (not needed) → Create project.
//
// 3. Once the project is created, click the </> icon (Web app) to register a
//    web app for your project.
//    - Nickname: "Black Stars CRM Web"
//    - DO NOT check "Set up Firebase Hosting" yet (we'll do that separately)
//    - Click "Register app"
//
// 4. Firebase shows you a `firebaseConfig` object. Copy the values into the
//    object below, replacing the empty strings.
//
// 5. In the Firebase Console:
//    - Build → Firestore Database → Create database → Start in PRODUCTION mode
//      → Pick a location (closest to Qatar: "asia-south1" for Mumbai is good)
//      → Enable.
//    - Build → Authentication → Get Started → Sign-in method tab → enable
//      "Email/Password" → Save.
//    - Authentication → Users tab → Add user. Use the email you want the club
//      admin to log in with. Set a password. (e.g. admin@blackstars.qa /
//      somepassword)
//
// 6. Firestore Security Rules — go to Firestore → Rules tab and paste:
//
//      rules_version = '2';
//      service cloud.firestore {
//        match /databases/{database}/documents {
//          // Only authenticated users can read/write
//          match /{document=**} {
//            allow read, write: if request.auth != null;
//          }
//        }
//      }
//
//    Click Publish.
//
// 7. Save this file. Reload the app. It will now use Firebase.
//
// ═══════════════════════════════════════════════════════════════════════════

window.FIREBASE_CONFIG = {
  // Paste your Firebase project's web config here. Leave blank for offline-only mode.
  apiKey: "AIzaSyAcQW1KoHSuzO3B7nScIfjSgyCp1FZHeHc",
  authDomain: "blackstar-8e83d.firebaseapp.com",
  projectId: "blackstar-8e83d",
  storageBucket: "blackstar-8e83d.firebasestorage.app",
  messagingSenderId: "849608553495",
  appId: "1:849608553495:web:34d2d0662fb7965f845852",

  // The Firestore document path where club data is stored. Don't change this
  // unless you want multiple clubs in the same Firebase project.
  dataPath: "clubs/blackstars",
};
