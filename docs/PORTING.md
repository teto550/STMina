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
- Decision (updated): **girls and boys share the same blue palette and the same header colours; the ONLY difference is the
  "🌸 حساب البنات" badge colour** (rose; variables `--badge-rgb`/`--badge-text` in `app.css`, overridden in `girls.css`).
  The header tint, its border and the browser-bar colour are the same as boys.
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

### C12. Read reduction: home screen, lazy loading, short cache, activity viewer (pending until committed)
Full explanation in `docs/READ-OPTIMIZATION.md`. Nothing is project-specific; no new Firestore index is needed.
- **Home screen, nothing loaded at start.** `index.html`: new `#tab-home` panel + `#tab-btn-home` tab (default), tiles, a
  "refresh data" button; `#tab-attendance` no longer visible by default. `src/features/shell/tabs.ts` rewritten: `switchTab`,
  `openTab`, `loadTabData` (each screen loads only what it needs), `reloadOpenTab`, `refreshData`. `app-shell.ts`: `initApp`
  only builds the UI and shows home; `switchActiveGrade` reloads only the open screen. CSS `.home-*` in `app.css`.
- **Lazy loader + short cache.** New `src/core/data.ts` (`ensureStudents/Deacons/DeaconUsers/Attendance/DeaconAttendance/
  TodayListener/CoreData`, `refreshAllData`); `getDocsTtl()`/`clearReadCache()` in `core/firestore-helpers.ts` serve a query from
  Firestore's local cache for 5 minutes after it was fetched (`rc:` keys in localStorage). Kept in MEMORY only (a reload re-fetches). Loaders using it: students (per class),
  servants, approved accounts, attendance, servants' attendance.
- **Students** are fetched per class (`where('grade','==',...)`, name sort in memory) instead of everything.
- **Attendance history** is no longer loaded at start: `loadAttendance('recent'|'full')` in `attendance.ts` (recent = last 90 days).
  `recent` for the statistics, the servant pages and the "absent last time" chip; `full` for export and imports (duplicate check).
  The student profile now queries only that student's attendance. `state.attendanceLevel` added.
- **Other entry points load on demand:** dashboard (`openDashboard`), voice assistant (on switch-on), export modal, imports.
- **Activity viewer rewritten** (`servants/online.ts`, markup in `index.html`): nothing is read until the tab opens; 20 entries
  per page, next page on scroll (IntersectionObserver); servant / type / date / class filters applied by the server on
  "apply". No free-text search (Firestore cannot). Needs composite indexes: `firestore.indexes.json` (new, registered under
  `firestore` in `firebase.json`) -> `firebase deploy --only firestore:indexes` in EACH Firebase project. Removed the live
  listener and "delete all". Tab-open logging removed (`tabs.ts`). Fix (same day): when the client-side checks hid every entry of a
  page the viewer stopped until a tab switch re-armed the scroll trigger; it now keeps loading while the bottom is on screen
  (gives up after 200 raw entries with nothing shown) and retries after an error when the tab is opened again.
- **Heartbeat removed:** `startPresence`/`stopPresence` deleted; instead `touchLastActive(uid)` (`core/presence.ts`, called from
  `enterApp`) writes `users.lastActive` once per page load. `lastActiveTab` is no longer written.
- **axios:** `npm i axios`; `src/core/http.ts` is the one instance for every non-Firebase call (`push.ts` x2, `assistant.ts`
  x1 were `fetch`). CDN `<script>` loaders (EmailJS, SheetJS, ExcelJS) are still runtime downloads; candidates for npm packages.
- **Servants directory fix** (the "🙏 الخدام" chip next to the class chips): `showServantsDirectorySection()` (`app-shell.ts`) now hides
  every main screen (it did not know `home`, and never `parts`); `openServantsDirectory()` (`servants.ts`) loads what it shows
  through `ensureDeacons/ensureDeaconUsers/ensureDeaconAttendance` (it used to rely on the servants list loaded at start-up).
  Dev only: `window.__state` (`core/state.ts`).
- Class switch: `loadStudents` captures the class it loads for (no mixing when switching during a load); home label follows.
- Logging out clears the cache (`refreshAllData()` in the signed-out branch of `auth.ts`).
- Dev-only read counter `window.__reads` (`core/firestore-helpers.ts`, `countSnapshot`/`countReads`).

### C13. Header colours, servant gender, section access (pending until committed)
Details and the honest limits in `docs/SECURITY-SECTIONS.md`.
- Girls header: same layout as boys, violet tint + violet "🌸 حساب البنات" badge, dark-violet browser bar (`girls.css`, `--badge-*`
  and `--section-*` variables in `app.css`, `THEME_COLOR` in `section.ts`, the early script in `index.html`).
- **`gender` field** (only `'male'` | `'female'`) on `users` and `deacons`: helpers `GENDERS`, `genderOfSection`, `sectionOfGender`,
  `accountSection` in `core/section.ts`; set at registration (`auth.ts`) and when an admin adds a servant (`servants.ts`);
  cached in the offline profile (`app-shell.ts`). Existing data: `tools/firestore/set-gender.cjs` (run in each project).
- **Section/class access:** `checkAccountSection()` decides at login (redirect / refuse); the section switch is admin-only;
  accounts without a class are refused; registration form has a gender select (`#reg-gender`) that switches the section;
  `?section=girls|boys` URL parameter. All in `core/section.ts`, `auth.ts`, `app-shell.ts`, `index.html`.

### C14. React + TypeScript + Tailwind foundation, incremental islands (committed)
Details in `docs/REACT.md`. No data or project-specific values; run `npm install` after merging.
- New: `src/react/**`, `src/test/setup.ts`, `tsconfig.strict.json`; changed: `vite.config.ts` (react + tailwind plugins, vitest),
  `tsconfig.json` (`jsx`, test types), `package.json` (deps + scripts `test`, `typecheck`), `src/main.ts` (imports `@/react/bootstrap`).
- The plain app is unchanged; React/Tailwind load on demand only when a React screen opens (`window.openReactScreen`).

### C15. Planned: roles and access (design only)
`docs/ROLES-DESIGN.md` (agreed decisions, data model, migration order) and `docs/TODO-CLEANUP.md`. Nothing implemented yet; the other
project needs the same migration after it is done here.

## Firestore data notes (data is per project, but the same checks apply to the other project)
Findings for THIS project on 2026-09-24 (Spark plan, database `(default)`). Nothing here is ported by copying data;
re-run `node tools/firestore/analyze.cjs` in the other project and compare with the collections used in `src/`.
- Collections the app uses: `users`, `students`, `attendance`, `deacons`, `deaconAttendance`, `activity_log`,
  `student_secrets` (kept on purpose: links to another data source, to be handled later), `parts_distribution`, `config`
  (single doc `settings`), plus `part_notifications` (see below).
- Legacy collections found, referenced by no code on `main` or on `refactor/vite-modules`: `paragraphs` (11 docs, old
  name of parts distribution) and `deacon_attendance` (6 docs, old name of `deaconAttendance`). Both are also blocked by
  the security rules. Backed up locally under `backups/` (git-ignored) and removed with
  a one-off script (removed after use, see git history `cd33c1c`). Status: see "Status of the Firestore cleanup" below.
- Leftover fields not read by any code: `students.lastVisit`, `students.waPhoneField`, `config/settings.currentGrade`
  (removed by the same script). `users.pushNotifiedAt` is NOT unused: the push worker writes it.
- `part_notifications` is used by the code but has no security rule (default deny) and the collection does not exist, so
  parts-distribution notifications fail with `permission-denied`. Decision postponed by the user ("revisit later").
- `deaconAttendance` holds two shapes (older docs have no `type`); the code handles both.
- Servant names carry the prefix "مستر" in `deacons.name` (47/49), `users.name` (16), `students.deacon` (134),
  `deaconAttendance.name` (65), `parts_distribution.deaconName` (4) and `activity_log.name`/`details` (453/146). Names are
  join keys, so all must change together. A verified plan (865 field changes, no collisions) is saved in
  `backups/2026-09-24-firestore-cleanup/remove-mister-plan-NOT-APPLIED.json` (now applied, see status below). Rule: remove the
  whole word, collapse double spaces, trim.
- Backups: on the Spark plan there are no managed Firestore backups, so dump what you delete to `backups/` (git-ignored,
  contains personal data, never commit).

### Status of the Firestore cleanup (update this line when done)
DONE on 2026-09-24 for this project, run by the user in their own terminal (the assistant's tool permission check blocks
bulk writes/deletes):
- Legacy cleanup: `paragraphs` and `deacon_attendance` deleted (17 docs); fields `lastVisit`, `waPhoneField`,
  `config/settings.currentGrade` removed; verified read-only (9 collections left, counts unchanged).
- "مستر" rename: `node tools/firestore/remove-word.cjs --apply` (reusable, `--word` parameter, dry run by default). The first
  full run hit the script's old 4 minute limit half-way and was re-run; it is idempotent. The user reported the data
  migrated; a final read-only verification could not be done because the project's free read quota was used up that night
  (see the quota warning in `tools/firestore/README.md`).
- Backups: `backups/` (git-ignored). Both still to do in the OTHER project (run `tools/firestore/analyze.cjs` first).

### Planned: link servants by id, not by name
The user wants every link to a servant to be an id so a name change never breaks anything. Full plan in
`docs/ID-MIGRATION.md` (data model, staged migration, code touch points). Not started; the same migration is needed in the
other project.

## Not done yet (planned, will also need porting)
- Applying the Firestore cleanup and the "مستر" rename (see Firestore data notes). Data is per project: do it separately for each.
- Step 2: TypeScript types for the data model, remove `@ts-nocheck`. Later: React + Tailwind, routes.

### C16 - Roles/access: config and types (step 1, no behaviour change)
New files `src/types/access.ts` (Gender, Section, Grade, Cell, Role, Person, Access), `src/core/access-config.ts` (`MIXED_GRADES`, cell/section helpers,
`computeAccess`, `canSwitchSection`, ...) and `src/core/__tests__/access-config.test.ts`. Pure code, no data, no screens; copy the three files as they are.

### C17 - Roles step 2: data backfill script
`tools/firestore/backfill-access.cjs` (new fields only). Run in the other Firebase project too (after `set-gender.cjs`); the dry-run report shows what needs a manual decision there.

### C18 - Duplicate accounts
Duplicate `users` profiles were removed here with a one-off script that has been deleted (its list was specific to this project). In the other project: find accounts sharing an email/name with `tools/firestore/analyze.cjs` or the console, keep the most recently active one per person, back up before deleting.

### C19 - Damaged names (U+FFFD)
`tools/firestore/_client.cjs` now decodes UTF-8 across chunk boundaries (before, Arabic text could be read with U+FFFD and a script could write it back). Copy the fixed `_client.cjs` FIRST, then run `fix-corrupted-names.cjs` (dry run) in the other project to look for damaged values.

### C20 - Roles step 3: access module (dual mode)
New `src/core/access.ts` (+ test), `state.access/accessSource` (`core/state.ts`), `resolveAccess` call in `features/auth/auth.ts` before the section gate, `access` in the offline profile cache with a 24 h limit (`core/firestore-helpers.ts`, `features/shell/app-shell.ts`). No visible change yet.

### C21 - Firestore rules now in the repo
`firestore.rules` (copied from the deployed rules) + `firebase.json` entry. Roles change: new `roles/{id}` block (read: approved, write: admin) and non-admins cannot change `users.deaconId` / `users.access`. Rules are per project: in the other project, first copy ITS deployed rules (`firebase_get_security_rules`), then add the same two changes.

### C22 - Roles step 4: admin screen (React)
New: `src/react/screens/AdminRoles.tsx`, `src/react/admin/*` (types, logic, data, ui, PersonList, RoleEditor, RolesTab, PeopleTab), tests `src/react/__tests__/admin-logic.test.ts` + `AdminRoles.test.tsx`, registry entry `admin-roles`, admin-only menu entry (`index.html` `#admin-settings-wrap`, shown in `features/shell/app-shell.ts`), `.rx-root` list/button resets in `src/react/styles.css`, legacy admin kept in `core/access.ts`. Removed the `?react-check` page (`ReactCheck.tsx`, its test, its registry/bootstrap lines). Firestore rules for `roles` must be deployed in the other project too (C21).
Also: roles are sorted alphabetically and searchable in the roles tab (`sortRoles`/`filterRoles` in `admin/logic.ts`, `RolesTab.tsx`, `screens/AdminRoles.tsx`); the admin screens say "أولاد" instead of "بنين".

### C23 - Rename a servant (admin screen)
People tab: a ✎ button per servant opens a rename sheet that updates the name everywhere it is used as a link (`deacons.name`, logins, `students.deacon`, `deaconAttendance.name`, `parts_distribution.deaconName`) in one batch (parts in a second step). Files: `admin/logic.ts` (`planRename`, `cleanName`), `admin/data.ts` (`loadNameLinks`), `admin/PeopleTab.tsx`, `admin/PersonList.tsx`. Rule change in `firestore.rules`: an admin may edit ONLY `deaconName` of `parts_distribution` (deploy the rules in the other project too). Until the id migration (docs/ID-MIGRATION.md) names are links, so every rename must cascade.

### C24 - "تعديل بيانات الخادم" is now a React screen, with an editable name (admin only)
Moved from the plain modal to `src/react/screens/EditServant.tsx` (registry `edit-servant`; opened from `openEditDeaconProfile` in `features/servants/servants.ts`, which prepares the data and applies the result). The old modal HTML (`#edit-deacon-profile-modal`) and its functions were removed from `index.html`/`servants.ts`. New shared pieces: `src/core/servant-rename.ts` (`renameServant`, also used by the admin screen's rename sheet). The older "تعديل اسم خادم" button, its modal and functions in the servants tab (`index.html`, `features/servants/deacons-tab.ts`) were REMOVED: renaming is done only from the servant's edit screen or the admin screen, `src/core/universities.ts` (list moved out of `servants.ts`), `window.openReactScreen(name, container?, props?)` accepts props (`react/bootstrap.ts`, `react/screens/registry.ts`). A single-word name is allowed. Test: `src/react/__tests__/EditServant.test.tsx`.
Also in C24: an admin can rename a servant who has not registered yet (the edit screen then shows only the name; `servant.uid` is null and nothing is written to `users`).

### C25 - Roles step 5a: section switch, directory and no-access screen follow the access
`core/section.ts` (`checkAccountSection(role, data, redirectedTo, access)` uses the access sections when the account has role-based access; `toggleAppSection` allowed for admins and for people whose roles span both sections), `features/shell/app-shell.ts` (switch button by `canSwitchSection`; the servants-directory chip only for admins), `features/servants/servants.ts` (`openServantsDirectory` refuses non-admins), `features/auth/auth.ts` (`showPendingScreen`; the "لسه مفيش صلاحيات" screen for a role-based account without any class), `index.html` (`#pending-icon/#pending-title/#pending-text` ids). Accounts without a role snapshot behave as before (legacy fields).

### C26 - Roles step 5b: classes come from the roles (accounts that have a role snapshot)
`core/access-config.ts` (`GRADE_NAMES`, `gradeNamesOfAccess`), `core/session.ts` (`getUserManagedGrades` uses the roles' classes in this section for role-based accounts), `features/auth/auth.ts` (for non-admin role-based accounts: grade from the roles, lead/phase-lead flags off), `features/shell/app-shell.ts` (class chips also for a role-based person with several classes). Accounts without a role snapshot keep the old behaviour. Server-side rules are unchanged (see docs/SECURITY-SECTIONS.md).

### C27 - Roles: new records get the new fields; accounts link on approval; kids' passwords admin-only
- New kids get `gender` + `cell` (`core/access.ts` `newKidFields`; `features/students/students.ts` + a gender select `#new-gender` in `index.html`, shown only for grades 1-2 of the girls' section; Excel import sets them when they can be told, `features/import-export/import-students.ts`). New roster servants get `roleIds: []` (`features/servants/servants.ts`).
- On approval (`features/servants/approvals.ts`) the account is linked to its person (link, same email, or same name in the section) and, for an admin approver, gets the access snapshot of the person's roles and the admin flag: new `src/core/access-link.ts` (+ test). A class lead approving only records the link.
- Kids' passwords: admin only in the profile display (`features/students/student-profile.ts`) and in `firestore.rules` (`student_secrets` get: admin only). DEPLOY THE RULES in the other project too.

### C28 - The old admin / class-lead / phase-lead toggles were removed
`features/servants/deacons-tab.ts`: the three buttons per servant (👑 admin, ⭐ year lead, 🟣 phase lead) and their functions (`toggleDeaconAdmin`, `toggleGradeLead`, `togglePhaseLead`) are gone; admins get a "👥 الأدوار" shortcut to the roles screen, and accounts that still carry the old flags show their badges. Access is given only with roles. The old flags in the data and the client code that reads them stay until the clean-up (docs/TODO-CLEANUP.md, section A); to take a legacy flag away from an account, give the person a role (the role snapshot then overrides the old fields).

### C29 - ID migration, dual mode (servants linked by id, name kept)
New `src/core/servants-index.ts` (+ test): `deaconNameOf`, `isDeaconOf`, `deaconIdOfName`. Read sites now resolve the servant through the id when a record has one (assistant, attendance list, dashboard, stats, approvals, deacons tab, students list/profile/edit). Write sites add `deaconId` next to the name: `students/students.ts` (new kid), `students/student-edit.ts`, `import-export/import-students.ts`, `servants/deacon-attendance.ts`, `servants/parts.ts`. Data: run `tools/firestore/backfill-deacon-ids.cjs` (dry run first; the `ALIASES` map holds a misspelling found here, check the other project's dry-run report for its own). The name fields are NOT removed yet (docs/ID-MIGRATION.md steps 5-6).

### C30 - Missing imports fix + the undefined-name check
C29 shipped without the `servants-index` imports in `students/students.ts`, `servants/parts.ts`, `servants/deacon-attendance.ts` and `import-export/import-students.ts` (the kids list kept loading: "deaconNameOf is not defined"). Fixed, and new `tools/check-undefined-names.cjs` (`npm run check:names`, now part of `npm run build`) reports names used but never defined in the `@ts-nocheck` files. Copy the tool to the other project and run it after porting.

### C31 - The top banner scrolls with the page
`src/styles/app.css` `.top-bar`: `position: sticky; top: 0` -> `position: relative` (z-index kept so the settings menu stays above the content). On a phone the sticky banner (about 100 px, with a see-through gradient) covered a large part of the screen while scrolling.

### C32 - GitHub Actions builds and deploys to GitHub Pages
New `.github/workflows/deploy-pages.yml`: on push to `main` (or manual), runs `npm ci && npm run build` and publishes `dist/` to Pages via `actions/deploy-pages`. Needs Settings -> Pages -> Source = "GitHub Actions" set once per repo (in the browser; the REST API refused this PUT from the CLI). Once set, `npm run deploy:ghpages` (local build pushed to the `gh-pages` branch) is no longer needed, though it still works as a manual fallback. This file was committed straight to `main` (workflow files only take effect from the default branch) and should be copied to the other project too.

### C33 - GitHub Pages Actions workflow: fixed npm ci failure, added Firebase config via secrets
Two follow-up fixes to `.github/workflows/deploy-pages.yml` (C32): (1) `npm ci` failed on the runner with an
ajv-formats lockfile mismatch a from-scratch `npm install` does not reproduce locally -> switched to
`npm install --no-audit --no-fund`, no npm cache. (2) The build had no Firebase config (`.env.local` is
git-ignored) and the deployed site threw `auth/invalid-api-key` -> the build step now reads
`VITE_FIREBASE_API_KEY`/`_AUTH_DOMAIN`/`_PROJECT_ID`/`_STORAGE_BUCKET`/`_MESSAGING_SENDER_ID`/`_APP_ID`,
`VITE_RECAPTCHA_SITE_KEY`, `VITE_FCM_VAPID_KEY`, `VITE_PUSH_WORKER_URL`, `VITE_ASSISTANT_WORKER_URL` from
GitHub Actions repository secrets of the same names (Settings -> Secrets and variables -> Actions), values
copied from `.env.local`. `VITE_APPCHECK_DEBUG_TOKEN` is deliberately NOT a secret here (dev-only App Check
bypass; must never ship in a public build). Needs repo secrets added once per project when porting.

### C34 - Admin bulk delete of kids (select / select all) that also removes their data
`index.html` (`#bulk-delete-wrap`, `#bulk-bar`, buttons above the kids list; admin only), `features/students/students.ts` (`currentStudentsList`, select mode `toggleSelectMode`/`toggleSel`/`selectAllVisibleStudents`, `deleteSelectedStudents`, `purgeStudents`; `deleteStudent` now fully purges for admins: `student_secrets` + all `attendance` of the kid + the kid doc, in chunks of 30; non-admins keep the old behaviour). A JSON backup of the deleted kids (photos left out) and their attendance records is downloaded after each delete. `firestore.rules`: `student_secrets` now `allow delete: if isAdmin()` (update stays false). DEPLOY THE RULES in the other project too (`firebase deploy --only firestore:rules`). Costs reads/deletes per kid's attendance records (free-plan quota), a run stopped by the quota can simply be repeated.

### C35 - Kids import: servant names are matched leniently
`features/import-export/import-students.ts`: the servant column is matched against the roster (`resolveDeacon`: drops a leading "مستر/", normalises letters, needs exactly one match in the section; `ensureDeacons()` first). Servants that do not match are NOT written as free text any more: they are listed in the import log (the kid keeps its current servant). Needed because sheets write "مستر/ <name>" while the roster stores the plain name.


### C36 - Servants attendance: import from Excel (admin) + pick any day to take attendance on
**Import.** New `src/features/servants/import-deacon-attendance.ts` (imported in `src/main.ts` after `deacon-attendance`). `index.html`: the two buttons "عرض أيام الحضور" and "رفع حضور من إكسيل" are now at the very top of the servants directory's attendance tab (the dates list/detail block moved up right under them), and modal `#import-deacon-att-modal` sits before the import-students modal. "ابدأ الرفع" reads the sheet, matches names and writes in one go (batches of 400) to `deaconAttendance` with the same fields as the manual mark (`name, deaconId, date, type, section, ts`); "معاينة بس" shows the report without saving. Sheet: names in one column, date columns with TRUE/FALSE; either a header row with full dates, or the first 3 rows year/month/day (same as the students sheet). Names are matched leniently (letters normalised, leading "مستر/" dropped, all words of the shorter name inside the longer, 1-2 letter typos); only a single match is accepted, unmatched/ambiguous names are listed and not written. Records already present for the same servant + day + type are skipped, so re-running does not duplicate. No rules change (`deaconAttendance` is already `isApproved()` write). Cost: one read of `deaconAttendance` (cached 5 min) plus the writes.

**Day picker.** `features/servants/deacon-attendance.ts`: new `attDaySelected` (null = today, computed each time); the picker, the count and the toggle work on the chosen day; `markDeaconAttendance(name, type, dateKey?)` got an optional date (no date = today, so the voice assistant is unchanged) and only touches `todayDeaconAttendance` when the day is today; new `window.setDeaconAttDay` / `window.resetDeaconAttDay` and exported `resetDeaconAttDay()`. `features/servants/servants.ts`: `openServantsDirectory` calls `resetDeaconAttDay()` so the screen always opens on today. `index.html`: date input `#sd-att-date` (max = today) + "اليوم" button in the attendance card, and id `#sd-att-count-label` on the count caption. Nothing project-specific.

Import report (follow-up to C36): it now shows the date range found in the file, the first 5 dates as parsed, a warning for dates in the future (usually a day/month or year misread), skips the header cell "الاسم", and shows the closest registered name next to every name it could not match.

Import (second follow-up to C36): the real sheet has one date per week in row 1 (first cell of a 4-column group, the rest are `=C1+7` formulas) and, per week, columns حضور / إعتذار (مدارس الأحد) then حضور 2 / إعتذار 2 (اجتماع الخدام) with ✓ marks. `detectLayout` now finds the "حضور" header row and maps the first حضور column of each week group to sunday and the second to meeting (إعتذار columns are ignored); the type select got "both" (default) which imports the two types in one run (items carry their own `type`; the report is per type, and shows how many marks each unmatched name loses). `index.html`: new option in `#import-deacon-att-type`.

### C37 - Servants attendance: "اعتذار" box next to "حضور" (both types) + the import reads the إعتذار columns
`features/servants/deacon-attendance.ts`: every servant row in the attendance picker now has two boxes, حضور (tapping the row also marks it) and اعتذار; a servant is either present or excused for a day + type (marking one removes the other). Excuses are stored in the SAME `deaconAttendance` collection with `status: 'excuse'` (old records without `status` are presence), so no rules change and the admin rename tool (`loadNameLinks` by name) still moves them. New exported `DEACON_EXCUSES` (same shape as `DEACON_ATTENDANCE`), `markDeaconExcuse`, `deaconToggleExcuse`, `removeDeaconExcuse`; `loadDeaconAttendance` routes `status === 'excuse'` docs into `DEACON_EXCUSES` so counts of attendance are NOT inflated. The days list and the day detail show excuses; the detail got an "اعتذار" tab and "غياب" now means neither present nor excused. `index.html`: new tab `#deacon-att-mode-btn-excuse`. `features/servants/import-deacon-attendance.ts`: reads the إعتذار columns (first = مدارس الأحد, second = اجتماع الخدام) and writes them as excuse records; presence wins when both are marked; a servant who was excused in the app and is present in the sheet has the old excuse record deleted in the same batch (batches are 200 items because an item can be two operations). Anything else that reads `deaconAttendance` directly must skip `status === 'excuse'` (only `src/react/admin/data.ts` reads it, by name for renames, which is fine).

### C38 - Servants attendance: the Excel import was removed again
The servants Excel import added in C36 (and its follow-ups) is NOT part of the code any more: `src/features/servants/import-deacon-attendance.ts` was deleted, its `import` line removed from `src/main.ts`, and the button `#sd-import-att-btn` and modal `#import-deacon-att-modal` removed from `index.html`. Do NOT port the import part of C36. What stays from C36/C37: the day picker and the حضور / اعتذار boxes (`deacon-attendance.ts`, `servants.ts`, the picker/tab markup in `index.html`).


### C39 - Servants directory: filter by attended / absent in the last 1-4 sessions (مدارس الأحد or اجتماع الخدام)
`index.html`: new filter card at the top of the "🙏 الخدام" tab (`#sd-flt-status-tabs` الكل / ✅ حضر / ❌ غاب; when not "الكل" it shows `#sd-flt-extra` with `#sd-flt-type-tabs` and the `#sd-flt-count` select 1-4, plus `#sd-flt-hint` listing the dates counted). `features/servants/deacon-attendance.ts`: new exported `recentDeaconSessions(type, n)` (last n days that have any present/excuse record for that type, newest first, same definition as the "أيام الحضور" list) and `deaconStatusOn(name, type, dateKey)` -> `present | excuse | absent` (absent = neither present nor excused, same as the "غياب" tab of the day detail). `features/servants/servants.ts`: `renderServantsDirectory` keeps only servants whose status is the chosen one on EVERY one of the last n sessions (if fewer than n sessions exist it uses the ones that exist and says so in the hint); each row then also shows ✅/📝/❌ for those sessions. New `window.setDirFilterStatus` / `setDirFilterType`, filter resets to "الكل" every time the directory is opened. Reads only data already loaded (no extra Firestore reads). Nothing project-specific.
