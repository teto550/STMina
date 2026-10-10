# React in this project (incremental "islands")

The app is still the plain TypeScript/DOM app. React was added **next to it**: a React screen can be mounted into any element
of the page (or full-screen over the app), and the plain screens stay as they are. Screens can be moved to React one at a
time, or never.

## What exists
| Piece | Where |
| --- | --- |
| React 19, `@vitejs/plugin-react`; Tailwind CSS 4 (`tw:` prefix, no reset, colours from the app's own CSS variables) | `vite.config.ts`, `src/react/styles.css` |
| Mounting: `mountIsland()` (wraps every screen in the React Query provider), the screen registry, `window.openReactScreen(name, container?, props?)` | `src/react/mount.tsx`, `src/react/screens/registry.ts`, `src/react/bootstrap.ts` |
| **Screens**, one folder each with an `index.tsx` (+ subfolders `components/`, `login/`, ... when they need parts) | `src/react/screens/<name>/` : `auth` (login + "new servant", mounted at start-up into `#auth-screen`, no props), `admin-roles`, `edit-servant`, `join-requests` (popup: `popupScreens` in the registry), `servants-filter`, `servants-list` |
| **Hooks** (React Query), one file per feature with several hooks: `useAuth.ts` (`useAuthUser`, `useAccount`, `useLogin`, `useLogout`, `useRegister`, `useIsRegistering`), `useServants.ts` (`useRoster`), `useAfter.ts` | `src/react/hooks/` |
| **API functions** the hooks wrap (plain async functions, no React; Firebase calls, the account check, the email through axios) | `src/api/` (`auth.ts`, `account.ts`, `roster.ts`, `email.ts`, `errors.ts`) |
| **Schemas** (zod), grouped by topic: `auth.ts` (login, registration), `servant.ts`, `admin.ts`, `common.ts` | `src/schemas/` |
| **Shared UI**: `Alert` (error / success / warning / info; title, icon, close button, auto-dismiss, action), `Spinner`, `Button` (`loading`), `Input`, `PasswordInput` (eye), `Field`, `Segmented`, `Sheet`, `Chip`, `CheckRow`, `SwitchCard` | `src/react/components/ui/` |
| **Form fields** wired to react-hook-form (`<FormProvider>`): `TextField`, `PasswordField`, `SelectField`, `PhoneListField` | `src/react/components/form/`, `src/react/components/phone-list-field.tsx` |
| Tests: Vitest + Testing Library (`npm test`); `renderWithQuery()` renders a screen inside a fresh React Query client | `src/react/__tests__/`, `src/api/__tests__/`, `src/schemas/__tests__/`, `src/test/render.tsx` |
| Strict TypeScript for `src/react`, `src/api`, `src/schemas`, `src/types` (`tsconfig.strict.json`; the old code stays non-strict) | `npm run typecheck` runs both |

## Why it cannot break the old screens
- The React code and the Tailwind CSS are separate chunks loaded **on demand** the first time a React screen opens. A normal page
  load downloads none of it (the main bundle grew by under 2 kB for the tiny loader; the old CSS file is unchanged).
- Tailwind classes always carry the `tw:` prefix (`tw:flex`, `tw:bg-surface`), there is **no Tailwind reset**, and all utilities are
  `!important` (the old CSS has `* { padding: 0 }` which would otherwise win). Nothing generic (`html`, `body`, `button`...) is styled.
- Colours are the app's own variables (`--surface`, `--accent`, ...), so React screens follow the boys/girls theme; direction is
  inherited (RTL). Use logical utilities: `tw:ms-2`, `tw:pe-4`, `tw:start-0`, `tw:text-start`.
- Available colour tokens: `bg`, `surface`, `surface-2`, `accent`, `accent-2`, `fg`, `dim`, `line`, `ok`, `warn`, `bad`
  (e.g. `tw:bg-surface`, `tw:text-dim`, `tw:border-line`, `tw:rounded-card`, `tw:rounded-field`).

## Rules for this project (the user's, also in CLAUDE.md)
- **All new screens, and any screen the user asks to rewrite, are React + TypeScript.** Old plain screens migrate one at a time, each
  verified before the next. Mobile first, touch targets at least 44px, RTL-safe (logical utilities).
- **Component style:** `export const Name: FC<NameProps> = ({ a, b }) => { ... };` with `type NameProps = {...}` defined above.
- **Screens are folders** (`screens/<name>/index.tsx`, a thin wrapper); parts live in subfolders; a few-line one-off piece is inlined.
- **Schemas are global** in `src/schemas/<topic>.ts`; forms = react-hook-form + the zod resolver, using the shared form fields.
- **Data through hooks:** `src/react/hooks/use<Feature>.ts` (React Query) wrapping plain functions in `src/api/`; non-Firebase HTTP uses the
  axios instance (`src/core/http.ts`). Every screen shows a **visible loader** and a **visible error** (with retry).
- **react-if for conditions:** tabs are `<Switch><Case condition=...>`; async states are loading -> error -> empty -> data, on an enum (example: `auth/register/ClassAndNameFields.tsx`).
- **No side channels** (event buses, globals) between old code and React when React can own the logic. A screen opened by the old code
  gets props only for data it truly needs from the caller (`edit-servant` gets the servant); `auth` takes none.
- **Every change to a React screen/component updates its tests.**

## Adding a React screen
1. Create `src/react/screens/my-screen/index.tsx` with a default export component (`const MyScreen: FC<ScreenProps> = ...`; `ScreenProps`
   is `{ close?: () => void }` from `../registry`), and put its parts in subfolders next to it.
2. Register it in `src/react/screens/registry.ts`: `'my-screen': () => import('./my-screen')`.
3. Open it from old code: `window.openReactScreen('my-screen', undefined, { ...props })` (full-screen overlay; props optional)
   or `window.openReactScreen('my-screen', document.getElementById('some-panel'))` (embedded in the old layout).
4. Data: add hooks to `src/react/hooks/use<Feature>.ts` over functions in `src/api/`; validation in `src/schemas/<topic>.ts`.
   The old state is `import { state } from '@/core/state'`; old globals are typed in `src/react/globals.d.ts` (e.g. `window.showToast`).
5. Write the tests in `src/react/__tests__/` (mock `@/api/*` modules, render with `renderWithQuery`), then `npm test` and `npm run typecheck`.

More shadcn/ui components: copy the pattern of `button.tsx` (add the `tw:` prefix to every class, use the tokens above).

## Commands
`npm run dev` · `npm test` · `npm run typecheck` (old code + strict React code) · `npm run build` (typecheck + build)

## Verified (2026-09-25)
Typecheck (both modes), 7 unit tests, production build, and in the browser (dev and built): the plain app loads exactly as
before with no Tailwind/React downloaded; the (since removed) `?react-check` page passed 6/6 checks (React running, utilities beat the old reset, theme
colours, RTL, old state readable, section theme), form validation, sticky header + first column in RTL, closing the overlay,
and embedding inside an existing panel.

## Reverting
Everything is in one commit ("Add React + TypeScript + Tailwind foundation"): `git revert <hash>`. By hand: remove
`import '@/react/bootstrap'` from `src/main.ts`, delete `src/react/`, `tsconfig.strict.json`, `src/test/`, and the React/Tailwind
lines of `vite.config.ts` and `package.json`.
