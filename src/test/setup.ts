import '@testing-library/jest-dom/vitest';

// jsdom has no ResizeObserver (the zoomable photo uses one)
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
