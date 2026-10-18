// functions of the old (plain JS) app that React code may call
export {};
// set at build time by vite.config.ts: the version number (package.json), the id of this build and its time
declare const __APP_VERSION__: string;
declare const __APP_BUILD__: string;
declare const __APP_BUILT_AT__: string;
declare global {
  interface Window {
    showToast?: (message: string, type?: 'info' | 'success' | 'error') => void;
  }
}
