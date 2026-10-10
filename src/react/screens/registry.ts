import type { ComponentType } from 'react';

// Every React screen is registered here and loaded on demand (its own JS/CSS chunk), so the plain app does not get any
// heavier. To add a screen: create src/react/screens/MyScreen.tsx (default export) and add a line below.
export type ScreenProps = { close?: () => void };
// screens may take extra props from the caller (window.openReactScreen(name, container, props)), so the component type is open
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loader = () => Promise<{ default: ComponentType<any> }>;

export const screens: Record<string, Loader> = {
  'admin-roles': () => import('./admin-roles'),
  'edit-servant': () => import('./edit-servant'),
  auth: () => import('./auth'),
  'join-requests': () => import('./join-requests'),
  'class-picker': () => import('./class-picker'),
  'dashboard-options': () => import('./dashboard-options'),
  'servants-filter': () => import('./servants-filter'),
  'servants-list': () => import('./servants-list'),
};

// Screens shown as a popup over the running app (they draw their own backdrop) instead of a full-screen page.
export const popupScreens = new Set(['join-requests', 'class-picker', 'dashboard-options']);
