// What this page is running (written at build time by vite.config.ts). Plain code, no React.
//  - APP_VERSION: the version number from package.json (raised before every deployment, see CLAUDE.md), shown to people
//  - APP_BUILD: a unique id of this build (version + commit + time): what the update check compares
declare const __APP_VERSION__: string | undefined;
declare const __APP_BUILD__: string | undefined;
declare const __APP_BUILT_AT__: string | undefined;

export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
export const APP_BUILD: string = typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'dev';
export const APP_BUILT_AT: string = typeof __APP_BUILT_AT__ === 'string' ? __APP_BUILT_AT__ : '';
/** `npm run dev` has no version.json to compare with, so there is nothing to check there. */
export const IS_DEV_BUILD = import.meta.env.DEV;
