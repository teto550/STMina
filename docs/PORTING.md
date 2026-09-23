# Porting log: changes to apply to the OTHER project

**Standing rule:** the other project (same purpose and same code structure, but a **different Firebase project,
different Firestore, different data**) is a clone of this repo taken *before* these changes. Every change made here
must be recorded in this file (see "Change log") so it can be ported later. Nothing is ported yet.

- Base the other project was cloned from: this repo at commit `5ba9691` (original single-file `index.html`).
- All changes below live on branch `refactor/vite-modules` of this repo.
- Keep entries short: what changed, which files, and anything project-specific.

## What is project-specific (must NOT be copied blindly)
| Thing | Where | Notes for the other project |
| --- | --- | --- |
| Firebase web config (apiKey, projectId, appId, ...) | `.env.local` (`VITE_FIREBASE_*`) | Different Firebase project. `.env.local` is git-ignored. |
| reCAPTCHA Enterprise site key | `.env.local` `VITE_RECAPTCHA_SITE_KEY` | Own key; add its domains (below). |
| FCM VAPID key, push worker URL, assistant worker URL | `.env.local` `VITE_FCM_VAPID_KEY`, `VITE_PUSH_WORKER_URL`, `VITE_ASSISTANT_WORKER_URL` | Own Cloudflare workers; worker `ALLOWED_ORIGIN` must include the new site origins. |
| Firebase project id for deploys | `.firebaserc` | Change `default` to the other project id. |
| GitHub repo / Pages | `deploy:ghpages` script, README | Different repo and Pages URL. |
| Admin email default, EmailJS ids | Firestore `config` doc / `src/core/config.ts` | Read from that project's own Firestore. |
| Firestore data & security rules | Firebase console | Different data; rules are not in this repo. |

### Google Cloud / Firebase console settings that had to be done for THIS project (repeat for the other one)
1. **Browser API key** (APIs & Services -> Credentials -> Browser key) -> Application restrictions -> HTTP referrers:
   add the Hosting test channel URL, `https://<project>.web.app/*`, `https://<project>.firebaseapp.com/*`,
   `http://localhost:5173/*`, and the GitHub Pages URL. Without this, login returns 403 "referer ... blocked".
2. **reCAPTCHA Enterprise key** -> Settings -> Domains: same hostnames (no scheme/path).
3. Firebase Hosting site exists by default (`<project>.web.app`). Test channel: `npm run deploy:test`.
4. App Check enforcement was **not** enabled for Auth/Firestore here. If it is enabled in the other project, set
   `VITE_APPCHECK_DEBUG_TOKEN` and register it under App Check -> Manage debug tokens (dev only).

## How to port (recommended order)
1. In the other project, `git diff` its `index.html` against the original (`git show 5ba9691:index.html` from this repo)
   to list anything project-specific it changed (config values, URLs, texts). Write those down first.
2. **Option A (preferred): merge.** Add this repo as a remote, merge/cherry-pick `refactor/vite-modules`. `index.html`
   will conflict: take THIS repo's version, then move the other project's Firebase config/URLs into its `.env.local`.
3. **Option B: re-run the split** on the other project's `index.html` with `tools/monolith-split/` (see its README),
   then re-apply the later entries of the change log by hand.
4. Create `.env.local` from `.env.example`, edit `.firebaserc`, do the console settings above.
5. `npm install`, `npm run build`, `npm run dev`, then `npm run deploy:test` and test before anything goes live.
6. Do not switch GitHub Pages / live hosting until the test channel is verified.

## Change log
Status: C1-C3 are commit `ee6f2d1`; C4-C8 the second commit; C9 the third (`git log refactor/vite-modules`).

### C1. Vite + TypeScript, single file split into modules (committed)
- `index.html` reduced to markup + `<script type="module" src="/src/main.ts">`. Script body split into 41 modules
  under `src/core/*` (firebase, state, session, config, helpers, presence, section, splash, pwa, utils) and
  `src/features/{auth,shell,students,attendance,assistant,servants,dashboard,import-export}/*`.
- 29 module-level `let`s that several modules write to now live in `src/core/state.ts` (`state.x`).
- CSS moved to `src/styles/app.css` and `src/styles/girls.css`. Static files moved to `public/`.
  `push-worker.js` moved to `workers/` (Cloudflare Worker, not part of the site).
- Firebase SDK from npm (pinned `10.12.2`) instead of the gstatic CDN. `public/sw.js`: CDN URLs removed from the
  precache list, cache name `v6`.
- All files are `// @ts-nocheck` for now (typing is a later step). Import alias `@/` -> `src/`.
- Tooling: `package.json`, `vite.config.ts` (`base: './'`), `tsconfig.json`, `.gitignore`.

### C2. Config from `.env` (committed)
- `src/core/firebase.ts`, `src/features/shell/push.ts`, `src/features/assistant/assistant.ts` read `import.meta.env.VITE_*`.
  Variables are listed in `.env.example`. **Project-specific values go in `.env.local` only.**

### C3. Deploy scripts and Firebase Hosting (committed)
- `firebase.json`, `.firebaserc`, npm scripts `deploy:test` (Hosting preview channel `test`, 30d),
  `deploy:live` (Hosting live), `deploy:ghpages` (`gh-pages` branch; **not used yet**, Pages source must be switched
  first and the branch must not be merged to `main` before that). Dev deps: `firebase-tools`, `gh-pages`.

### C4. Account switch without confirm popup (committed)
- `src/core/section.ts`: `toggleAppSection` no longer asks `confirm(...)`.

### C5. Girls/boys account indicator in the top banner (committed)
- `حساب البنات/البنين` badge next to the title and a tinted top bar. (A coloured 5px strip across the top was added first
  and removed later, see C10.)
- Files: `index.html` (`<span id="section-badge">`), `src/styles/app.css` (`--section-*` variables, badge, bar tint),
  `src/styles/girls.css` (girls values), `src/core/section.ts` (badge text).
- Decision: **girls and boys share the same blue palette everywhere; only the banner differs** (girls = rose/coral).
  Original pill-shaped chips / round icon buttons for girls were kept.

### C6. Login screen always blue; girls theme only inside the app (committed)
- `src/core/section.ts` `applySectionTheme(inApp)`; called with `true` in `enterApp` (`app-shell.ts`) and `false` on the
  login, pending, unauthorized and complete-profile branches (`auth.ts`). Uses localStorage `appSessionHint` so a
  reload of a logged-in girls session doesn't flash blue (inline script in `index.html` `<head>`). Also sets the
  browser `theme-color` and page title.
- Removed the `🌸` after the login title.

### C7. Local-dev fixes (committed)
- `src/core/firebase.ts`: in dev, App Check is skipped unless `VITE_APPCHECK_DEBUG_TOKEN` is set (an unregistered
  debug token made `signInWithEmailAndPassword` fail before sending the request). Production always uses reCAPTCHA.
- `src/core/pwa.ts`: service worker only registers in production builds; in dev it unregisters and clears caches.
  `vite.config.ts`: dev-only plugin answers `/sw.js` with a self-removing worker (an old cache-first worker was
  serving stale modules on localhost). **After changing `.env.local`, stop and start `npm run dev`** (don't rely on
  Vite's auto-restart).
- `src/features/auth/auth.ts`: `console.error('login failed:', code, message)` so the real error is visible
  (the UI still shows a generic "wrong credentials").

### C8. Horizontal chip/tab rows scroll with mouse and touch (committed)
- New `src/core/drag-scroll.ts` (imported first in `src/main.ts`): mouse wheel scrolls the row sideways, click-and-drag
  scrolls it, a drag never "clicks" a chip. Rows: `#active-grade-bar` (ends with الخدام/الخادمات), `#main-tabs`,
  `.grade-filter`. Touch/pen are left to native scrolling. CSS at the end of `src/styles/app.css`
  (`overscroll-behavior-x: contain`, `user-select: none`, grab cursor for mouse only). RTL-aware.

### C9. QR feature removed completely (committed)
QR turned out to be unnecessary, so both generating and scanning QR codes were removed. Nothing in Firestore changes
(the QR only ever encoded the student document id; no QR-related fields or collections exist).
- Deleted `src/features/attendance/qr-scanner.ts` (camera, jsQR CDN loader, `startScan`/`stopScan`/`handleQR`) and its
  import in `src/main.ts`. Removed `scanning`, `stream`, `scanInterval` from `src/core/state.ts` and the `stopScan()`
  call in `doLogout` (`src/features/auth/auth.ts`).
- `index.html`: removed the whole scan section of the attendance tab (title "مسح QR", camera button, video/scan zone);
  login subtitle now "تسجيل الحضور بسرعة وسهولة". The print-all-cards button was removed.
- `src/features/students/students.ts`: student list no longer shows a QR image (it was also the placeholder when a student
  had no photo) or the "⬇ QR" button; it uses `avatarBox(s, 64)` from `photos.ts` instead. Removed `downloadQR`.
  CSS classes renamed `qr-card|info|name|grade|actions` -> `stu-card|info|name|grade|actions`.
- `src/features/import-export/id-cards.ts`: ID cards are KEPT (avatar + name + class + reward stars) but no longer
  contain a QR code; `printOneQR` renamed `printOneCard`. The "🖨 طباعة كل الكروت" (print all cards) button and
  `printAllQR`/`printAllCards` were removed as well (only the per-student "🪪 كارت" print remains).
- `src/styles/app.css`: removed `.scan-*`, `#video-container`, `.stop-btn`, `@keyframes scan`, `.qr-img-wrap`.
- No longer used anywhere: jsQR (jsdelivr) and `api.qrserver.com`. Student photo capture (`capture="environment"`
  file inputs) is unrelated and stays.
- Open question for the user: keep or also remove the ID cards (they only made sense with a QR). Unused assets that
  could go if cards are removed: `public/avatar1-10.png` (only used by the cards). `public/nb-print-*.png` are
  unused by any code even before this change.

### C10. Removed the top strip and the online/offline dot (committed after C9 = pending until committed)
- Removed the thin coloured line across the top of the page (`body::before` + `--section-a/--section-b` in
  `app.css`/`girls.css`). The badge and the bar tint remain as the boys/girls indicator.
- Removed the small "أونلاين/أوفلاين" indicator next to the settings gear: `#net-status` element in `index.html` and
  `updateOnlineBanner()` in `src/features/shell/ui.ts`. The "back online / offline" toast messages were kept.

### C11. Pending join requests at the top of the servants tab (pending until committed)
- `index.html`: the `#pending-deacons-section` block (⏳ طلبات تسجيل خدام) moved to the very top of `#tab-deacons`
  (it used to sit below the add buttons, the sort dropdown and the full servants list). Markup move only, no code change
  (`loadPendingDeacons()` in `src/features/servants/approvals.ts` still fills it).

## Not done yet (planned, will also need porting)
- Firestore review/backup and cleanup of unused collections (data is per-project, do it separately for each).
- Step 2: TypeScript types for the data model, remove `@ts-nocheck`. Later: React + Tailwind, routes.
