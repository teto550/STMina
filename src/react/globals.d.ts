// functions of the old (plain JS) app that React code may call
export {};
declare global {
  interface Window {
    showToast?: (message: string, type?: 'info' | 'success' | 'error') => void;
  }
}
