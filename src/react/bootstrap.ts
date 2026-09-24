// The ONLY React-related code that is part of the normal app bundle. It is tiny and does not import React: it just adds
// `window.openReactScreen(name)`, which loads the React chunk when a React screen is actually opened.
import { screens } from './screens/registry';

declare global {
  interface Window {
    openReactScreen: (name: string, container?: HTMLElement) => Promise<void>;
    closeReactOverlay: () => void;
  }
}

let overlay: HTMLElement | null = null;

// Opens a React screen. Without `container` it opens full-screen over the app (with a close action); with a container
// (an element that already exists in the page) it renders inside it, which is how a screen is embedded in the old layout.
window.openReactScreen = async (name, container) => {
  const load = screens[name];
  if (!load) { console.warn('unknown React screen:', name); return; }
  const [{ mountIsland }, { createElement }, mod] = await Promise.all([import('./mount'), import('react'), load()]);
  let host = container;
  if (!host) {
    window.closeReactOverlay();
    overlay = document.createElement('div');
    overlay.id = 'react-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;overflow:auto;background:var(--bg);';
    document.body.appendChild(overlay);
    host = overlay;
  }
  const close = container ? undefined : () => window.closeReactOverlay();
  mountIsland(host, createElement(mod.default, { close }));
};

window.closeReactOverlay = () => {
  if (!overlay) return;
  const el = overlay;
  overlay = null;
  import('./mount').then(({ unmountIsland }) => { unmountIsland(el); el.remove(); });
};

// a hidden self-check page: open the app with ?react-check in the URL
try { if (new URLSearchParams(location.search).has('react-check')) window.openReactScreen('react-check'); } catch (e) { /* ignore */ }
