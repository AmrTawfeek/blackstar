# Black Stars CRM
Version 4.81.0 — Club logo applied as the application logo.

## What changed
Your uploaded Black Stars image is now the app logo, replacing the old ★:
- **Sidebar** brand mark (top-left).
- **Login screen** logo.
- **Browser tab favicon**.

The image is embedded directly in app.js (base64), so the sidebar and login
logos show even if a file gets missed when copying — and a copy of the image
is also included as `logo.jpg` (used by the favicon).

## Notes
- The image is a detailed square graphic, so at the small sidebar/favicon size
  it shows the whole collage scaled down. If you'd prefer a cleaner small icon
  (e.g. just the central BLACK STARS star mark), send a square-cropped version
  or say so and I'll crop it for you.
- The Schedule PNG export still prints the "★ BLACK STARS" text header (drawn
  on the canvas). I can swap that for the image too if you want.

## Unchanged
All v4.80.0 features stay intact.

## To load
Replace the files in C:\Users\kshawky\Desktop\CRM\blackstars-localhost\
(include the new logo.jpg), refresh, confirm the footer reads v4.81.0, and the
logo appears in the sidebar + tab.
