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
- [ ] ID migration steps 5-6 (docs/ID-MIGRATION.md): after a quiet period, read/write ids only and remove the name link fields; delete `tools/firestore/backfill-deacon-ids.cjs` once run here and in the other project.
- [ ] Switch GitHub Pages to the build (`deploy:ghpages`, source = `gh-pages`) and bump the service worker cache version at go-live.
- [ ] Replace the runtime CDN scripts (EmailJS, SheetJS, ExcelJS) with bundled packages loaded on demand.
- [ ] Type the data model and remove `// @ts-nocheck` file by file (React code is already strict).
- [ ] Remove dev helpers when no longer useful: `window.__state`, `window.__reads` (dev only, harmless).
- [ ] Delete `tools/monolith-split/` after the other project has been ported (it is kept only for that).
- [ ] Prune old `activity_log` entries (older than ~90 days) with a script, if the log grows.
- [ ] Run the gender script (`tools/firestore/set-gender.cjs`) in the OTHER Firebase project (done here on 2026-09-24: 49 servants + 32 accounts = male).

- [ ] Delete the one-off data scripts once the OTHER project has been migrated too: `tools/firestore/set-gender.cjs`, `remove-word.cjs`, `fix-corrupted-names.cjs`, `backfill-access.cjs` (they are done and no longer needed in this project; kept only for the other one). Keep `_client.cjs` and `analyze.cjs`.

## C. Decisions pending / postponed (roles design)
- [ ] **Actions across classes** (promotion to the next grade, bulk imports, attendance clean-up): postponed on purpose. The new school year has just
      started and graduation is less than a year away. Decide before the next graduation who may do them (admin only, or the class's servants)
      and that promotion recomputes each kid's `cell` and `section` (boys leave the girls' section at grade 2 -> 3).
- [ ] Approve the mobile-first mockups of the roles screens (shown 2026-09-25) and the "no access yet" wording.

## Done
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
