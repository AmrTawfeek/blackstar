// v6.408 — RELIABILITY WAVE 1: deploy auto-reload + global error capture. Source-level guards
// (the runtime behaviour of both is verified live in the browser). These lock in that:
//   • the deploy-watch is wired and uses a DISTINCT banner from the save-block stale banner,
//   • version.json exists and matches APP_VERSION (the packager must keep them in sync),
//   • the global error handlers are installed and non-blocking.
const fs = require('fs'), path = require('path');
const DIR = [path.join(__dirname, 'crm238', 'blackstars-localhost'), path.join(__dirname, '..')]
  .find(p => { try { return fs.existsSync(path.join(p, 'app.js')); } catch (_) { return false; } });
const appSrc = fs.readFileSync(path.join(DIR, 'app.js'), 'utf8');
const pagesSrc = fs.readFileSync(path.join(DIR, 'pages.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗ FAIL:', n, got !== undefined ? '→ ' + JSON.stringify(got) : ''); } };

console.log('DEPLOY AUTO-RELOAD:');
{
  ok('a deploy watcher polls version.json', /fetch\('version\.json\?t=' \+ Date\.now\(\), \{ cache: 'no-store' \}\)/.test(appSrc));
  ok('it compares the served build against the running APP_VERSION', /_verCmp\(APP_VERSION, served\) < 0/.test(appSrc));
  ok('a newer served build shows the update-available banner', /showUpdateAvailableBanner\(served\)/.test(appSrc));
  ok('the watcher starts on boot', /window\.addEventListener\('DOMContentLoaded', \(\) => \{ try \{ startDeployWatch\(\)/.test(appSrc));
  ok('it re-checks on a timer and on tab refocus/visibility', /setInterval\(_pollDeployedVersion/.test(appSrc) && /visibilityState === 'visible'\) _pollDeployedVersion\(\)/.test(appSrc));

  // The update banner must NOT be the save-blocking stale banner — different case, different UI.
  ok('the update banner is a DISTINCT id from the save-block stale banner',
    /id = 'update-available-banner'/.test(appSrc) && /getElementById\('update-available-banner'\)/.test(appSrc));
  ok('it defers to the stronger save-block banner if that is already showing',
    /if \(document\.getElementById\('stale-version-banner'\)\) return;/.test(appSrc));
  ok('Reload flushes any unsaved change BEFORE reloading',
    /upd-reload'\)\.onclick = \(\) => \{[\s\S]{0,400}?flushPending\(\)[\s\S]{0,200}?location\.reload/.test(appSrc));
  ok('it never reloads on its own (reload only on the button click)',
    !/setInterval[\s\S]{0,60}location\.reload/.test(appSrc));

  // The pre-existing save-block banner (pages.js) is untouched and still separate.
  ok('the save-block stale banner still lives in pages.js and pauses saving',
    /window\.showStaleVersionBanner = function/.test(pagesSrc) && /saving is paused to protect your data/.test(pagesSrc));
}

console.log('\nversion.json ↔ APP_VERSION sync:');
{
  const vjPath = path.join(DIR, 'version.json');
  ok('version.json exists (deployed alongside the app)', fs.existsSync(vjPath));
  const vj = JSON.parse(fs.readFileSync(vjPath, 'utf8'));
  const appVer = (appSrc.match(/APP_VERSION = '([\d.]+)'/) || [])[1];
  ok('version.json.version equals APP_VERSION (packager keeps them in sync)', vj.version === appVer, { versionJson: vj.version, appVersion: appVer });
}

console.log('\nGLOBAL ERROR CAPTURE:');
{
  ok('a catch-all is installed once', /window\.__errorCaptureInstalled = true;/.test(appSrc));
  ok('it listens for window errors', /window\.addEventListener\('error',/.test(appSrc));
  ok('it listens for unhandled promise rejections', /window\.addEventListener\('unhandledrejection',/.test(appSrc));
  ok('errors go to an inspectable ring buffer capped at 50', /window\.__errorLog\.push\(/.test(appSrc) && /window\.__errorLog\.length > 50/.test(appSrc));
  ok('the user gets a THROTTLED toast, never a modal or reload', /now - _lastToastAt > 8000/.test(appSrc) && /window\.toast\(/.test(appSrc));
  ok('benign resource-load errors (no .message) are ignored', /if \(e && e\.message\) record\('error'/.test(appSrc));
  ok('both handlers are defensive — each wraps its work in try/catch',
    /addEventListener\('error', \(e\) => \{[\s\S]{0,200}?try \{[\s\S]{0,120}?catch \(_\) \{\}/.test(appSrc)
    && /addEventListener\('unhandledrejection', \(e\) => \{[\s\S]{0,120}?try \{[\s\S]{0,120}?catch \(_\) \{\}/.test(appSrc));
}

console.log('\nRELIABILITY WAVE 1:', pass, 'passed,', fail, 'failed');
process.exit(fail ? 1 : 0);
