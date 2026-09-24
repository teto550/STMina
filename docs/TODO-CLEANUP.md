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
- [ ] Switch GitHub Pages to the build (`deploy:ghpages`, source = `gh-pages`) and bump the service worker cache version at go-live.
- [ ] Replace the runtime CDN scripts (EmailJS, SheetJS, ExcelJS) with bundled packages loaded on demand.
- [ ] Type the data model and remove `// @ts-nocheck` file by file (React code is already strict).
- [ ] Remove the `?react-check` self-check page (`src/react/screens/ReactCheck.tsx`) once the first real React screen exists.
- [ ] Remove dev helpers when no longer useful: `window.__state`, `window.__reads` (dev only, harmless).
- [ ] Delete `tools/monolith-split/` after the other project has been ported (it is kept only for that).
- [ ] Prune old `activity_log` entries (older than ~90 days) with a script, if the log grows.
- [ ] Verify the "مستر" rename left 0 occurrences (read-only scan).
- [ ] Run the gender script on the existing servants (`tools/firestore/set-gender.cjs`) and the same steps in the OTHER Firebase project.

## C. Questions waiting for the user (roles design)
- [ ] Membership on people (roster) rather than accounts only, and a person record for admin accounts not in the roster.
- [ ] Which actions stay admin-only (imports, passwords, promotion/cleanup, activity log) and which any servant of the class may do.
- [ ] The in-class "servants" tab: everybody, or only people with servant cells?

## Done
- [x] QR feature removed (scanner, generation, print-all cards).
- [x] Legacy Firestore collections `paragraphs` and `deacon_attendance` and the leftover fields deleted (backup in `backups/`).
- [x] "مستر" removed from servant names (all collections).
- [x] Heartbeat removed; `lastActive` written once per page load.
- [x] Read reduction: home screen, lazy loading, memory-only cache, on-demand activity viewer.
- [x] React + TypeScript + Tailwind foundation (islands).
