# Firestore helper scripts

Use your own `firebase login`; the project id is read from `.firebaserc`, so the same scripts work in the other
project. They talk to the Firebase MCP server through `npx firebase-tools@latest mcp` (first run downloads it).

- `analyze.cjs` – read-only structure report (collections, counts, fields, date ranges; no values).
- `set-gender.cjs` – sets `gender: 'male'|'female'` on servants (`users` + `deacons`) that have none. Dry run by default;
  `--apply --limit 1` to test, then `--apply`. Only 'male' and 'female' are ever valid values.
- `remove-word.cjs` – removes a whole word (default "مستر") from servant-name fields in all collections, trims spaces.
  Dry run by default (writes only a local backup); `--apply --limit 1` to test on one document, then `--apply`.
- `audit-account-links.cjs` – READ-ONLY. Finds logins (Firebase Authentication) that have no `users/{uid}` document, and account documents whose uid has no login (a login that was deleted and made again gets a new uid, so its old document is orphaned). Prints names and masked emails only. `MCP_FEATURES=core,firestore,auth node tools/firestore/audit-account-links.cjs`. Reads the `users` collection once.
- `remove-orphan-accounts.cjs` – removes DEAD DUPLICATE account documents (uid has no login any more while the same email has a live login with its own document and the same `deaconId`); anything else is listed and left alone. Backup to `backups/` first; dry run by default, `--apply` to remove. `MCP_FEATURES=core,firestore,auth node tools/firestore/remove-orphan-accounts.cjs`.
- `coptic-occasions.mjs` – works out the Coptic Orthodox occasions the church keeps (the reviewed list: `RULES` in the file) for ANY year, from the Coptic calendar and the date of Easter: `node tools/firestore/coptic-occasions.mjs 2028 --out my.json`, then review it and import it with `add-occasions.cjs`. Tested against what copticchurch.net publishes for 2024, 2026, 2027 and 2028. Add / remove a line of `RULES` to change the list.
- `add-occasions.cjs` – adds a JSON list of occasions (feasts / fasts: `{ title, date }`) to the `occasions` collection; only adds, skips ones that exist. Dry run by default; `--apply --limit 1`, then `--apply`. See `occasions.example.json`. (Ask Claude to fetch a year's dates into such a file first.)
- One-off scripts used on 2026-09-24 in the first project (legacy collection cleanup) were removed after use; see git history
  (`git show cd33c1c:tools/firestore/cleanup-legacy.cjs`). In another project, run `analyze.cjs` first and adapt.

**Free-plan quota warning:** on the Spark plan Firestore allows 50,000 reads per day for the whole project (the live app
included). Every full scan reads every document (`activity_log` alone is ~2,800), so a handful of scans plus dry runs can use
the whole quota and make the app fail with "Quota exceeded" until it resets (midnight Pacific time). Scan sparingly, never
loop, and prefer `--limit` and dry runs only when needed.

Always take a backup of what you delete first. On the free (Spark) plan there are no managed Firestore backups/exports,
so dump the documents to JSON under `backups/` (git-ignored).

## backfill-access.cjs
Roles step 2 (docs/ROLES-DESIGN.md): adds only NEW fields (`students.gender/cell`, `deacons.roleIds`, `users.deaconId`); dry run by default, `--apply --limit 1`, then `--apply`. Reports unmatched accounts and duplicate names without writing them.
