# To-do and clean-up list

Revisit this file regularly (at the start of a session, together with `docs/TESTING-CHECKLIST.md`). When an item is finished, tick it
(`[x]`) and move it to "Done"; when it is no longer needed, delete it. Each item says WHEN it is safe.

## A. After the roles / ID migration (do NOT do before the live site runs the new code)
- [ ] Remove legacy access fields from `users`: `role` (replaced by the admin role flag), `isLead`, `isPhaseLead`, `phaseGrades`, `grade`,
      `lastActiveTab`. *Safe when:* the live site runs the new code and every account has roles for a month. Back up first.
- [ ] Remove `deacons.grade` and `deacons.section` (class now comes from roles). *Safe when:* same.
- [ ] Remove the name-as-link fields once `deaconId` is used everywhere: `students.deacon`, `deaconAttendance.name`,
      `parts_distribution.deaconName`, `part_notifications.deaconName` (and the names inside `activity_log.details`). *Safe when:* new code
      stopped writing them and a rollback is no longer wanted.
- [ ] Delete the old client code paths that read the legacy fields (`getUserManagedGrades`, `isGradeManagerOf`, lead/phase-lead flags).
- [ ] Remove the temporary dual-mode fallback in `core/access.ts`.
- [ ] Tighten the Firestore security rules by section / cell (`docs/SECURITY-SECTIONS.md`): backfill `cell`/`section` first, then rules.
- [ ] Decide what to do with `part_notifications` (needs a rule or removal of the feature).

## B. Project hygiene
- [ ] **Delete the Firestore `config` collection** (and its rule `match /config/{docId}` in `firestore.rules`) once you are sure: nothing in the app reads or writes it any
      more (2026-10-10). Take a backup first (`config/settings` held `adminEmail`, `legacyMigrated: true`, `cleanedAttendanceGrades: [سنة رابعة ابتدائي]`).
- [ ] **Email to the admin (new servant registered):** it was NOT working before either (the EmailJS service/template/public key were empty in `config/settings`). It now reads
      `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID`, `VITE_EMAILJS_PUBLIC_KEY` and `VITE_ADMIN_EMAIL` (`.env.local`, and the GitHub Actions secrets of the same
      names). Fill them in from the EmailJS dashboard to turn it on; until then nothing is sent and nothing else is affected.
- [ ] ID migration steps 5-6 (docs/ID-MIGRATION.md): after a quiet period, read/write ids only and remove the name link fields; delete `tools/firestore/backfill-deacon-ids.cjs` once run here and in the other project.
- [ ] Switch GitHub Pages to the build (`deploy:ghpages`, source = `gh-pages`) and bump the service worker cache version at go-live.
- [ ] Replace the runtime CDN scripts (EmailJS, SheetJS, ExcelJS) with bundled packages loaded on demand.
- [ ] Type the data model and remove `// @ts-nocheck` file by file (React code is already strict).
- [ ] Remove dev helpers when no longer useful: `window.__state`, `window.__reads` (dev only, harmless).
- [ ] Delete `tools/monolith-split/` after the other project has been ported (it is kept only for that).
- [ ] Prune old `activity_log` entries (older than ~90 days) with a script, if the log grows.
- [ ] Run the gender script (`tools/firestore/set-gender.cjs`) in the OTHER Firebase project (done here on 2026-09-24: 49 servants + 32 accounts = male).

- [ ] Delete the one-off data scripts once the OTHER project has been migrated too: `tools/firestore/set-gender.cjs`, `remove-word.cjs`, `fix-corrupted-names.cjs`, `backfill-access.cjs` (they are done and no longer needed in this project; kept only for the other one). Keep `_client.cjs` and `analyze.cjs`.
- [ ] **Photos: maybe move from Firestore (base64 in `students.photo` / `users.photo`) to Firebase Storage.** Decided 2026-10-16 to keep Firestore for now (the wider wish list for the Blaze plan is in `docs/BLAZE-PLAN.md`).
  Move when lists get slow or heavy once most kids have photos (about 6-7 MB per class load if all 145 have one), or when the project is on the Blaze plan anyway.
  How, when needed: (1) a script in `tools/firestore/` uploads each photo to `photos/students/{id}.jpg` / `photos/servants/{uid}.jpg` and replaces the field by the link (idempotent: skip values that already start with `http`; one read per document that has a photo, backup first);
  (2) `savePhoto()` in `src/api/photos.ts` uploads to Storage and stores the link, delete removes the file (the photo manager, the avatars and the lists do not change: `<Avatar src>` already takes a data URL or a link);
  (3) Storage rules: signed-in approved users read; a servant (or an admin) writes their own photo, an admin or the kid's servants write a kid's. Optional meanwhile: shrink the saved size from 480 to about 320 px (one constant in `src/core/image.ts`).
- [ ] **Move the legacy backend calls into `src/api/`** (BACKEND ACCESS rule in CLAUDE.md, 2026-10-18). `tools/backend-imports-baseline.json` lists the 32 old files that still import
  `firebase/*`, `@/core/firebase` or `@/core/firestore-helpers` directly (core: access-link, data, presence, servant-rename; features: assistant, attendance, auth, dashboard, import-export,
  servants, shell, students; React: `useAuth.ts`, `admin-roles/data.ts`, `edit-servant`). Do it file by file when a screen is rewritten in React (or touched), then run
  `node tools/check-backend-imports.cjs --shrink`. When the list is empty, a backend change (e.g. to Supabase) is a rewrite of `src/api/` only.
- [ ] **Classes of servants that come from roles are not copied to the old `grade` field of the servants list**, which the class lists (servants of a class, the kids' servant dropdown) still read. "+ شخص جديد" sets it for the new person, but adding an EXISTING person to a class role (batch bar, role editor) does not change it. Make the class lists read the roles (or sync the field when roles change) before relying on roles alone.

## C. Decisions pending / postponed (roles design)
- [ ] **Actions across classes** (promotion to the next grade, bulk imports, attendance clean-up): postponed on purpose. The new school year has just
      started and graduation is less than a year away. Decide before the next graduation who may do them (admin only, or the class's servants)
      and that promotion recomputes each kid's `cell` and `section` (boys leave the girls' section at grade 2 -> 3).
- [ ] Approve the mobile-first mockups of the roles screens (shown 2026-09-25) and the "no access yet" wording.

## Done
- [x] Orphan account documents (found 2026-10-22 with `tools/firestore/audit-account-links.cjs`): the 3 dead duplicates of one servant were removed with `tools/firestore/remove-orphan-accounts.cjs` (backup in `backups/`); a servant whose login had been made again was relinked by copying his profile to the new uid. The audit now shows 46 logins = 46 account documents.
- [x] "نسيت كلمة المرور" on the login screen (Firebase `sendPasswordResetEmail`, Arabic; the same email as "Reset password" in the Firebase console) so nobody has to re-create their login (2026-10-22).
- [x] Sign-up self-heal: an email that is already a login but has no account document is finished with the typed password instead of "الإيميل ده مسجل بالفعل" (2026-10-22).
- [x] `loadConfig` and the `config` collection are no longer used: admins come only from roles; the one-time legacy-data migration button and the manual old-attendance cleanup tool (whose "done" marks lived in `config/settings`) were removed; the email settings moved to env variables (2026-10-10).
- [x] Unused code removed (2026-10-10, C41 in `docs/PORTING.md`): only what nothing used and was never visible (duplicate root `app-shell.ts`, `lucide-react`, unused imports and trivial dead helpers); anything reusable was kept.
- [x] Old admin / lead / phase-lead toggle buttons removed from the servants tab (roles are the only way to give access).
- [x] Kids' passwords are admin only (display + rules; the import stays, admin only); rules deployed 2026-09-25.
- [x] "مستر" rename completed and verified (0 left, 2026-09-24); 17 duplicate account profiles removed.
- [x] Firestore rules deployed (roles collection, users.deaconId/access locked to admins, admin may rename part assignments) on 2026-09-25.
- [x] QR feature removed (scanner, generation, print-all cards).
- [x] Legacy Firestore collections `paragraphs` and `deacon_attendance` and the leftover fields deleted (backup in `backups/`).
- [x] "مستر" removed from servant names (all collections).
- [x] Heartbeat removed; `lastActive` written once per page load.
- [x] Read reduction: home screen, lazy loading, memory-only cache, on-demand activity viewer.
- [x] React + TypeScript + Tailwind foundation (islands); the `?react-check` self-check page was removed once the first real screen existed.
