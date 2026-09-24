# Firestore helper scripts

Use your own `firebase login`; the project id is read from `.firebaserc`, so the same scripts work in the other
project. They talk to the Firebase MCP server through `npx firebase-tools@latest mcp` (first run downloads it).

- `analyze.cjs` – read-only structure report (collections, counts, fields, date ranges; no values).
- `set-gender.cjs` – sets `gender: 'male'|'female'` on servants (`users` + `deacons`) that have none. Dry run by default;
  `--apply --limit 1` to test, then `--apply`. Only 'male' and 'female' are ever valid values.
- `remove-word.cjs` – removes a whole word (default "مستر") from servant-name fields in all collections, trims spaces.
  Dry run by default (writes only a local backup); `--apply --limit 1` to test on one document, then `--apply`.
- One-off scripts used on 2026-09-24 in the first project (legacy collection cleanup) were removed after use; see git history
  (`git show cd33c1c:tools/firestore/cleanup-legacy.cjs`). In another project, run `analyze.cjs` first and adapt.

**Free-plan quota warning:** on the Spark plan Firestore allows 50,000 reads per day for the whole project (the live app
included). Every full scan reads every document (`activity_log` alone is ~2,800), so a handful of scans plus dry runs can use
the whole quota and make the app fail with "Quota exceeded" until it resets (midnight Pacific time). Scan sparingly, never
loop, and prefer `--limit` and dry runs only when needed.

Always take a backup of what you delete first. On the free (Spark) plan there are no managed Firestore backups/exports,
so dump the documents to JSON under `backups/` (git-ignored).

## backfill-access.cjs
Roles step 2 (docs/ROLES-DESIGN.md): adds only NEW fields (`students.gender/cell`, `deacons.roleIds/uid`, `users.deaconId`); dry run by default, `--apply --limit 1`, then `--apply`. Reports unmatched accounts and duplicate names without writing them.
