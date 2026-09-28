# St. Mina attendance (خدمة ابتدائي)

Attendance PWA for the primary-school service. Vite + TypeScript, Firebase (Auth, Firestore, App Check, Messaging).

## Develop

```bash
npm install
cp .env.example .env.local   # then fill in the Firebase config values
npm run dev                  # http://localhost:5173
npm run build                # type-check + production build into dist/
```

### App Check on localhost
Production uses reCAPTCHA Enterprise. In `npm run dev` App Check is **skipped** unless `VITE_APPCHECK_DEBUG_TOKEN` is set
in `.env.local`, which is only needed if App Check enforcement is switched on in the Firebase console
(then register the same value under App Check → your web app → Manage debug tokens).
After changing `.env.local`, stop and start `npm run dev` (don't rely on Vite's auto-restart).

## Layout
- `src/core/` – Firebase init, shared state, session/permissions, helpers.
- `src/features/<feature>/` – auth, shell (tabs/toast/push), students, attendance, assistant, servants, dashboard, import-export. Import with the `@/` alias.
- `src/styles/` – CSS.
- `public/` – static files copied as-is (icons, `manifest.json`, `sw.js`).
- `workers/push-worker.js` – Cloudflare Worker for push notifications (deployed separately, not part of the site).

## Deploy
All three build first (`npm run build`).

| Command | Where it goes |
| --- | --- |
| `npm run deploy:test` | Firebase Hosting preview channel `test` (separate URL, expires after 30 days, re-running updates the same URL). |
| `npm run deploy:live` | Firebase Hosting live site (`https://attends-39e5b.web.app`). |
| `npm run deploy:ghpages` | Pushes `dist/` to the `gh-pages` branch of the GitHub repo. |

Notes:
- All sites use the **same Firebase project**, so test and live share the same Firestore data and users.
- GitHub Pages can build itself via `.github/workflows/deploy-pages.yml`: it runs on every push to `main` (or
  manually from the Actions tab). One-time setup: Settings → Pages → Source → "GitHub Actions" (the GitHub API
  refused to flip this from the CLI, so it has to be done in the browser). Once set, `npm run deploy:ghpages`
  (local build pushed to the `gh-pages` branch) is no longer needed.
  The public URL stays `https://teto550.github.io/STMina/`. To roll back, switch the source back to the old branch/commit.
