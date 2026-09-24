import type { ComponentType } from 'react';

// Every React screen is registered here and loaded on demand (its own JS/CSS chunk), so the plain app does not get any
// heavier. To add a screen: create src/react/screens/MyScreen.tsx (default export) and add a line below.
export type ScreenProps = { close?: () => void };
type Loader = () => Promise<{ default: ComponentType<ScreenProps> }>;

export const screens: Record<string, Loader> = {
  'react-check': () => import('./ReactCheck'),
};
