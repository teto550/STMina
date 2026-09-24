# React in this project (incremental "islands")

The app is still the plain TypeScript/DOM app. React was added **next to it**: a React screen can be mounted into any element
of the page (or full-screen over the app), and the plain screens stay as they are. Screens can be moved to React one at a
time, or never.

## What was added (2026-09-25)
| Piece | Where |
| --- | --- |
| React 19, `@vitejs/plugin-react` | `vite.config.ts` |
| Tailwind CSS 4 (`tw:` prefix, no reset, colours from the app's own CSS variables) | `src/react/styles.css` |
| shadcn/ui-style components (Radix Slot + class-variance-authority + tailwind-merge); example: Button | `src/react/components/ui/`, `src/react/lib/utils.ts` (`cn`) |
| Forms: `react-hook-form` + `zod` (+ `@hookform/resolvers`); icons: `lucide-react` | used by screens |
| Mounting: `mountIsland()`, the screen registry and `window.openReactScreen(name, container?)` | `src/react/mount.tsx`, `src/react/screens/registry.ts`, `src/react/bootstrap.ts` |
| Self-check page (open the app with `?react-check`); can be deleted at any time | `src/react/screens/ReactCheck.tsx` |
| Tests: Vitest + Testing Library (`npm test`) | `src/react/__tests__/` |
| Strict TypeScript for React code only (`tsconfig.strict.json`; the old code stays non-strict) | `npm run typecheck` runs both |

## Why it cannot break the old screens
- The React code and the Tailwind CSS are separate chunks loaded **on demand** the first time a React screen opens. A normal page
  load downloads none of it (the main bundle grew by under 2 kB for the tiny loader; the old CSS file is unchanged).
- Tailwind classes always carry the `tw:` prefix (`tw:flex`, `tw:bg-surface`), there is **no Tailwind reset**, and all utilities are
  `!important` (the old CSS has `* { padding: 0 }` which would otherwise win). Nothing generic (`html`, `body`, `button`...) is styled.
- Colours are the app's own variables (`--surface`, `--accent`, ...), so React screens follow the boys/girls theme; direction is
  inherited (RTL). Use logical utilities: `tw:ms-2`, `tw:pe-4`, `tw:start-0`, `tw:text-start`.
- Available colour tokens: `bg`, `surface`, `surface-2`, `accent`, `accent-2`, `fg`, `dim`, `line`, `ok`, `warn`, `bad`
  (e.g. `tw:bg-surface`, `tw:text-dim`, `tw:border-line`, `tw:rounded-card`, `tw:rounded-field`).

## Rule for this project
**All new screens are built in React.** Existing (plain) screens are migrated one at a time when they change substantially, and each migration
is verified (behaviour, mobile and desktop, tests) before the next one starts. The first real React screen is the admin "users and roles" screen.
Screens are **mobile first** (most users are on phones) and work on desktop: design the phone layout first, add breakpoints (`tw:md:`) for wider
screens, touch targets at least 44px, RTL-safe (logical utilities).

## Adding a React screen
1. Create `src/react/screens/MyScreen.tsx` with a default export component (props: `{ close?: () => void }`).
2. Register it in `src/react/screens/registry.ts`: `'my-screen': () => import('./MyScreen')`.
3. Open it from old code: `window.openReactScreen('my-screen')` (full-screen overlay) or
   `window.openReactScreen('my-screen', document.getElementById('some-panel'))` (embedded in the old layout).
4. Read the old state with `import { state } from '@/core/state'`; call old global functions through typed declarations in
   `src/react/globals.d.ts` (e.g. `window.showToast`). Firebase (`db`, `auth`) is imported from `@/core/firebase` like everywhere else.
5. Write a test next to it in `src/react/__tests__/` and run `npm test` and `npm run typecheck`.

More shadcn/ui components: copy the pattern of `button.tsx` (add the `tw:` prefix to every class, use the tokens above). Radix
primitives (`@radix-ui/react-dialog`, `-checkbox`, ...) are installed when a component needs them.

## Commands
`npm run dev` · `npm test` · `npm run typecheck` (old code + strict React code) · `npm run build` (typecheck + build)

## Verified (2026-09-25)
Typecheck (both modes), 7 unit tests, production build, and in the browser (dev and built): the plain app loads exactly as
before with no Tailwind/React downloaded; `?react-check` passes 6/6 checks (React running, utilities beat the old reset, theme
colours, RTL, old state readable, section theme), form validation, sticky header + first column in RTL, closing the overlay,
and embedding inside an existing panel.

## Reverting
Everything is in one commit ("Add React + TypeScript + Tailwind foundation"): `git revert <hash>`. By hand: remove
`import '@/react/bootstrap'` from `src/main.ts`, delete `src/react/`, `tsconfig.strict.json`, `src/test/`, and the React/Tailwind
lines of `vite.config.ts` and `package.json`.
