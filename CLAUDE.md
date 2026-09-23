# St. Mina attendance (خدمة ابتدائي)

Vite + TypeScript PWA (Firebase Auth/Firestore/Messaging). See `README.md` for commands and layout.

## STANDING RULE: keep the other project in sync
There is a **second project** with the same purpose and the same code structure but a **different Firebase
project / Firestore / data** (it is a clone of this repo from before the Vite refactor, commit `5ba9691`).
Every change made in this repo must ALSO be recorded in `docs/PORTING.md` (Change log: what changed, which files,
anything project-specific) so it can be ported later. Do this in the same session as the change, before finishing.
Nothing is ported yet and the user did not ask to port now; only keep the log accurate.

- Project-specific values (Firebase config, keys, worker URLs, project ids) belong in `.env.local` / `.firebaserc`,
  never hard-coded in `src/`, so the code itself stays portable.
- Data (Firestore contents, rules, console/Google Cloud settings) is per project and never ported.

## Working agreements
- Stop and start the dev server after changing `.env.local` (don't rely on Vite auto-restart).
- Never publish to GitHub Pages or live Firebase Hosting without an explicit request; the test channel
  (`npm run deploy:test`) is the place to try things. The Pages link is already shared, keep it unchanged.
- Take a backup before any Firestore deletion; delete nothing without explicit approval.
