# Connecting Black Stars CRM to Firebase (cloud + multi-device)

This makes your data live in the cloud, accessible from any device/browser,
instead of being trapped in one browser. The app is already built for it —
`storage.js` switches to Firebase automatically once `firebase-config.js` has
real keys. These are the steps only YOU can do (they need your Google account).

## 1. Create the project
1. Go to https://console.firebase.google.com → "Add project". Name it e.g. "blackstars-crm".
2. In the project, open **Build → Firestore Database → Create database**.
   Start in **production mode** (we'll paste rules below).

## 2. Turn on Authentication (so the app isn't public)
1. **Build → Authentication → Get started**.
2. Enable **Email/Password**.
3. Add a user (your email + a password) under the Users tab. Add one per staff member.

## 3. Get your web config
1. Project settings (gear icon) → "Your apps" → Web app (</>) → register the app.
2. Copy the `firebaseConfig` object (apiKey, authDomain, projectId, etc.).
   Note: the apiKey is NOT secret in Firebase — it's safe in the app. Security
   comes from the rules below, not from hiding the key.
3. Send me those values, or paste them into `firebase-config.js` so it sets
   `window.FIREBASE_CONFIG = { ...your values... }`.

## 4. Paste these security rules (Firestore → Rules → Publish)
Only signed-in users can read or write — nobody with just the URL can see member data.

    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /{document=**} {
          allow read, write: if request.auth != null;
        }
      }
    }

## 5. We finish + test together
Once the config is in, the login becomes a real Firebase login and your data
syncs across devices. We test it live (I can't test it from my side — there's
no project/keys until you create them).

## Backups still matter
Firebase is your live copy, not a backup. Keep using **💾 Backup all data**
(and Restore) — and once Firebase is live, I can add a scheduled cloud function
to email you a daily backup automatically (needs an email service like SendGrid).
