// The person's preferences, as hooks.
import { useSyncExternalStore } from 'react';
import { useMutation } from '@tanstack/react-query';
import { getPreferences, savePreferences, subscribePreferences, type Preferences } from '@/api/preferences';

/** The current preferences; every component using this re-renders when one changes. */
export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribePreferences, getPreferences);
}

/** Saves a change (`mutate({ cropPhotos: true })`); `isPending` / `isError` drive the saving state and the error message. */
export function useSavePreferences() {
  return useMutation({ mutationFn: (patch: Partial<Preferences>) => savePreferences(patch) });
}
