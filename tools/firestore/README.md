# Firestore helper scripts

Use your own `firebase login`; the project id is read from `.firebaserc`, so the same scripts work in the other
project. They talk to the Firebase MCP server through `npx firebase-tools@latest mcp` (first run downloads it).

- `analyze.cjs` – read-only structure report (collections, counts, fields, date ranges; no values).
- `cleanup-legacy.cjs` – one-off cleanup of leftovers found on 2026-09-24. Dry run by default, `--apply` to execute.
  Needs the local backup in `backups/` (git-ignored, created before the cleanup; not in the repo). For another project,
  re-run `analyze.cjs` first and adapt the lists.

Always take a backup of what you delete first. On the free (Spark) plan there are no managed Firestore backups/exports,
so dump the documents to JSON under `backups/` (git-ignored).
