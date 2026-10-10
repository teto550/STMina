# St. Mina attendance (خدمة ابتدائي)

Vite + TypeScript PWA (Firebase Auth/Firestore/Messaging). See `README.md` for commands and layout.

## Other project (porting is dropped)
There used to be a second project cloned from this repo. The user no longer cares about porting changes to it (2026-10-10): do NOT
update `docs/PORTING.md`, do not write porting notes, and do not let it block or slow any work. The file stays as history only.
Project-specific values (Firebase config, keys, worker URLs) still belong in `.env.local` / `.firebaserc`, never hard-coded in `src/`.

## Working agreements
- **Do not commit (or push) until the user has verified the changes by hand and says so.** Leave edits in the working tree, say what
  changed and how to check it. **But `git add` every NEW core file as you create it** (source, tests, docs, schemas, hooks, the lockfile...)
  so nothing important stays untracked; never stage config/secrets/backups (`.env*`, `backups/`, `dist/`, scratch files) and never commit. (Branch: new work goes on a feature branch off `main`; `main` is what GitHub Pages builds.)
- The old plain files keep `// @ts-nocheck`, so a forgotten import is NOT caught by `tsc`: `npm run check:names` (also part of `npm run build`)
  finds names that are used but never defined. Run it after editing old files (2026-09-25: a missing import broke the kids list).
- Stop and start the dev server after changing `.env.local` (don't rely on Vite auto-restart).
- Never publish to GitHub Pages or live Firebase Hosting without an explicit request; the test channel
  (`npm run deploy:test`) is the place to try things. The Pages link is already shared, keep it unchanged.
- Take a backup before any Firestore deletion; delete nothing without explicit approval.
- Local Firestore backups live in `backups/` (git-ignored, personal data). Reusable helper scripts: `tools/firestore/`.
- The Claude Code permission check may block bulk Firestore writes/deletes; if so, stop and hand the user the exact
  script/command instead of working around it.
- **Firestore free-plan quota:** 50,000 reads/day for the whole project (the live app included). Scans of every document
  (`activity_log` ~2,800 docs) add up fast; on 2026-09-24 repeated full scans exhausted it and the app showed
  "Quota exceeded". Never loop or repeat full scans; prefer small targeted reads.

## REMINDER for the next working session
The read-reduction work (home screen, lazy loading, cache, activity viewer, axios, once-per-load `lastActive`) has NOT been
tested against real data. At the start of the next session remind the user and go through `docs/TESTING-CHECKLIST.md`
(first step: `firebase deploy --only firestore:indexes`). Keep the checklist updated. Open decisions: see the end of that file.

## React rules (see docs/REACT.md) - STANDING, set by the user 2026-10-10
- **React + TypeScript for everything new, and for any screen the user asks to rewrite.** Prefer React components over plain JS in general
  (strict types). Old screens migrate when they change substantially, each verified before the next. Mount with `window.openReactScreen`.
- **Screens live in folders:** `src/react/screens/<screen-name>/index.tsx` (the folder name is the registry key, e.g. `auth`, `admin-roles`),
  with that screen's extra sub-components next to it. Never a bare `Screen.tsx` file. Generic, reusable pieces go in `src/react/components/`.
- **Always braces: never an if/else without `{ }`** (no `if (x) return;` one-liners, no brace-less `else`). This is the user's global rule
  (also in `~/.claude/CLAUDE.md`, for every project). `npm run check:braces` enforces it in all of `src` except the old plain files
  (those start with `// @ts-nocheck`; fix their if/else when you touch them: `node tools/check-braces.cjs --fix <file>`) and is part of `npm run build`.
- **Components are written as `export const Name: FC<NameProps> = ({ a, b }) => { ... };`** with the props type defined just above
  (`type NameProps = { ... };`), never inline in the signature and not as `function` declarations. (Components that need a ref use
  `forwardRef`; generic ones use a generic arrow function. Hooks and plain helpers stay `function`s.) Convert an older component to this
  style whenever you touch it.
- **A screen's folder may have subfolders** (e.g. `auth/components/`, `auth/login/`, `auth/register/`, each with an `index.tsx`);
  `index.tsx` stays a thin wrapper. A piece that is only used once and is a few lines is inlined, not given its own component.
- **Validation schemas (zod) are global, grouped by topic:** `src/schemas/<topic>.ts` (e.g. `auth.ts` holds the login and registration
  schemas), never written inline in a screen. Forms use react-hook-form + the zod resolver.
- **Network/data: axios instance + React Query, through hooks.** Non-Firebase HTTP goes through the single axios instance in
  `src/core/http.ts`. Data and actions are React Query hooks (`useQuery` / `useMutation`) in `src/react/hooks/`, **one file per feature
  holding several hooks** (e.g. `useAuth.ts`: `useLogin`, `useLogout`, `useRegister`, ...), typed with TypeScript. Each hook wraps a plain
  API function from `src/api/` (the query/mutation function; no React in it). Screens only call hooks, and every screen shows the three
  states: a **visible loader** while loading, a **visible error message** (with retry where it makes sense) on failure, and the data.
- **Conditional rendering with `react-if`** (`<Switch>` / `<Case condition>` / `<Default>`), not nested ternaries:
  - **Tabs:** the selected tab's content is a `<Case>` of a `<Switch>`, always, for every tab in every React screen.
  - **What a `<Switch>` switches on is an enum, never plain strings:** `enum AuthTab { Login = 'login', Register = 'register' }`, `<Case condition={tab === AuthTab.Login}>`.
    For a screen with several views, compute one enum value (`AuthView`) first and give each `<Case>` a comparison with it.
  - **Async screens:** a `<Switch>` whose cases are, in this order, **loading** (spinner), **error** (visible message + retry), **empty**
    (an empty-state message), and last the **data**, on an enum like every other `<Switch>` (see `auth/register/ClassAndNameFields.tsx`).
    Write it in the screen; extract a shared component only when a second screen needs the very same thing.
- **Small files, more components:** one component per file, a screen's `index.tsx` is only a thin wrapper that composes them. Each form
  is its own component that owns its validation and logic (e.g. `LoginForm.tsx`). Forms share fields from `src/react/components/form/`.
- **Keep it in React:** do not add side channels between old code and React (no event buses/globals) when React can own the logic.
- **Tests are part of every React change:** any change to a React screen or component MUST update/add tests in `src/react/__tests__/`
  (or `src/schemas/__tests__/` for schemas) so the change is covered. No React change is finished until its tests are updated and pass.
- Conventions: Tailwind classes always use the `tw:` prefix and the app's colour tokens, logical (RTL-safe) utilities, a test per screen.
  Never add a global Tailwind reset or unprefixed classes: that would change the old screens.

## Roles design and clean-up list
The agreed access design (roles with cells, people, sections) is in `docs/ROLES-DESIGN.md`; nothing of it is implemented until the user
says so. `docs/TODO-CLEANUP.md` is the running list of clean-ups and waiting questions: at the start of a session mention it (together with
the testing checklist), tick items when done and move them to "Done".
