# Plan: link servants by ID, never by name

**Goal (from the user):** nothing in the data should be linked to a servant's *name*. Everything links to an id, so
changing a servant's name later is a one-field edit and everything keeps working. No hard-coded plain-text links.

Status: **in progress (2026-09-25), dual mode.** Done: code reads by `deaconId` with the name as fallback (`src/core/servants-index.ts`: `deaconNameOf`, `isDeaconOf`, `deaconIdOfName`), new/edited kids, servant attendance and part assignments write `deaconId` next to the name, `users.deaconId` exists (linked on approval / backfill), and `tools/firestore/backfill-deacon-ids.cjs` adds `deaconId` to the existing records (dry run checked: 144 kids, 66 attendance, 4 parts, 0 unmatched after correcting the misspelling "فيلبواتير"). Renaming a servant still also rewrites the name fields (rollback safety) until step 6. Not done: step 5 (ids only) and step 6 (remove the name fields); `activity_log` keeps names. Do the Firestore cleanup and the "مستر" rename first (see `docs/PORTING.md`, Firestore
data notes) so names are clean before the backfill. The other project needs the same migration (data is per project;
the scripts read the project id from `.firebaserc`).

## Where names are used as links today
Counts are from the analysis of 2026-09-24.

| Data | Field | Holds | Docs |
| --- | --- | --- | --- |
| `students` | `deacon` | servant name | 134 of 144 |
| `deaconAttendance` | `name` | servant name (join key for stats) | 65 of 66 |
| `parts_distribution` | `deaconName` | servant name | 4 |
| `part_notifications` | `deaconName` | servant name (collection currently blocked by rules) | 0 |
| `users` <-> `deacons` | `users.name` == `deacons.name` | the account/roster link is by name (registration picks a roster name) | 32 / 49 |
| `activity_log` | `name`, and names inside `details` text | display snapshot of who acted / on whom | 2,808 |
| `activity_log`, `users` presence | `uid` | already an id (good) | |

Code that is name-keyed (grep `DEACON_DOC_IDS|DEACON_ADMIN_MAP|DEACONS|currentDeacon|currentUserName`):
`servants/deacons-tab.ts` (25 uses, incl. the rename feature that rewrites `students.deacon` doc by doc),
`servants/deacons.ts`, `servants/servants.ts`, `assistant/assistant.ts` (voice matching), `dashboard/dashboard.ts`,
`dashboard/stats.ts`, `servants/parts.ts`, `servants/online.ts`, `servants/deacon-attendance.ts`
(`DEACON_ATTENDANCE[type][date][name]`), `shell/app-shell.ts` and `auth/*` (compare with `currentUserName`),
`import-export/import-students.ts` (servant names typed in the sheet).

## Target model
- `deacons/{deaconId}`: roster entry `{ name, grade, section, createdAt, uid? }`. The **only** place a name is stored.
- `users/{uid}`: add `deaconId` (the roster entry this account is). Admins may have none.
- `students`: `deaconId` instead of `deacon`.
- `deaconAttendance`: `deaconId` instead of `name` (keep `date`, `type`, `section`).
- `parts_distribution` and `part_notifications`: `deaconId` instead of `deaconName`.
- `activity_log`: keep `uid`; add `targetDeaconId` where an action is about a servant; resolve display names at read time
  (id -> current name) instead of storing text.
- In code: one `Map<id, deacon>` (`state.deaconsById`) replaces `DEACON_DOC_IDS` / name-keyed maps; names only appear
  when rendering. Voice/Excel input still starts from a spoken/typed name, but is resolved to an id immediately.
- Renaming a servant = `updateDoc(deacons/{id}, { name })`. The rename feature that batch-updates students is deleted.

## Migration steps (staged, reversible)
1. **Backup** (`backups/`, git-ignored). Verify names in `deacons` are unique per section; list duplicates.
2. **Dual-read code**: read `deaconId`, fall back to the old name field. Deploy to the test channel only.
3. **Backfill script** (dry run by default, like `tools/firestore/remove-word.cjs`): build `name -> id` from `deacons`,
   write `deaconId` on `students`, `deaconAttendance`, `parts_distribution`, `part_notifications` and `users.deaconId`
   (match `users.name` to `deacons.name`; report accounts with no roster match, e.g. admins). Use per-document
   preconditions and stop on any unmatched name.
4. **Verify**: same counts and same attendance/statistics before and after (compare per servant), test channel with
   real accounts (admin, year lead, phase lead, servant).
5. **Switch code to ids only**, ship to the test channel, then live when approved.
6. **Remove the old name fields** (`students.deacon`, `deaconAttendance.name`, `parts_distribution.deaconName`) after a
   quiet period, with a backup first.
7. **Security rules** (not in this repo, edit in the console/CLI): stop users changing their own `deaconId` (same
   protection as `role`/`isLead` in the `users` update rule); allow the new fields in the existing rules.

## Edge cases to decide
- Two servants with the same name (different grades/sections): ids fix this, but the backfill must disambiguate by
  `grade`/`section`.
- A student whose servant was deleted: show "بدون خادم" (id not found), never crash.
- Servants with no account (roster only) and accounts with no roster entry (admins).
- `students.confessor` is free text about a person outside the system: leave as text unless told otherwise.
- Old `deaconAttendance` docs without `type` still need the existing fallback.

## Test checklist
Attendance by servant, absence/birthday/visit filters, parts distribution, dashboard/stat tabs, servants directory,
registration + approval, the rename of a servant (should touch exactly one document), voice assistant lookups, Excel
import/export of students.
