import type { ComponentType } from 'react';

// Every React screen is registered here and loaded on demand (its own JS/CSS chunk), so the plain app does not get any
// heavier. To add a screen: create src/react/screens/MyScreen.tsx (default export) and add a line below.
export type ScreenProps = { close?: () => void };
// screens may take extra props from the caller (window.openReactScreen(name, container, props)), so the component type is open
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loader = () => Promise<{ default: ComponentType<any> }>;

export const screens: Record<string, Loader> = {
  'admin-roles': () => import('./AdminRoles'),
  'edit-servant': () => import('./EditServant'),
};
