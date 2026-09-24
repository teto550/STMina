import { StrictMode, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import './styles.css';

// Mounts / unmounts a React tree inside an element of the existing page. Everything React lives in the element and
// nothing outside it is touched, so React screens and the plain screens can sit side by side.
const roots = new Map<HTMLElement, Root>();

export function mountIsland(el: HTMLElement, node: ReactNode): void {
  unmountIsland(el);
  el.classList.add('rx-root');
  const root = createRoot(el);
  roots.set(el, root);
  root.render(<StrictMode>{node}</StrictMode>);
}

export function unmountIsland(el: HTMLElement): void {
  const root = roots.get(el);
  if (!root) return;
  root.unmount();
  roots.delete(el);
  el.classList.remove('rx-root');
}
