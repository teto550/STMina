// @ts-nocheck

// ===== LIGHT / DARK MODE (settings menu switch "الوضع المظلم": ON = dark = the default look, OFF = light) =====
// The choice is per device (localStorage 'appTheme'); the inline <head> script in index.html applies it before first paint.
const THEME_KEY = 'appTheme';
const BAR_COLOR = {
  dark: { boys: '#1a1f2e', girls: '#221e38' },    // browser bar: dark blue / dark violet
  light: { boys: '#e4ebf7', girls: '#ece6f8' },   // soft light blue / soft light violet
};

export function getTheme() {
  try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch (e) { return 'dark'; }
}

// browser/status bar colour follows both the theme and the boys/girls account (called again by applySectionTheme)
export function syncThemeColorMeta() {
  const root = document.documentElement;
  const theme = root.classList.contains('light') ? 'light' : 'dark';
  const section = root.classList.contains('girls') ? 'girls' : 'boys';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', BAR_COLOR[theme][section]);
  // iOS home-screen app: dark text in the status bar on a light page
  const ios = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (ios) ios.setAttribute('content', theme === 'light' ? 'default' : 'black-translucent');
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle('light', theme === 'light');
  const sw = document.getElementById('theme-toggle-btn');
  if (sw) sw.setAttribute('aria-checked', theme === 'light' ? 'false' : 'true');
  syncThemeColorMeta();
}

window.toggleTheme = () => {
  const next = getTheme() === 'light' ? 'dark' : 'light';
  try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  applyTheme(next);
};

applyTheme(getTheme());
