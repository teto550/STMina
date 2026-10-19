// @ts-nocheck
import { loadClassSettings, saveClassSettings } from '@/api/class-settings';
import { cleanClassSettings, setKeptClassSettings, getKeptClassSettings } from '@/core/class-settings';
import { SECTION } from '@/core/section';

// One small read, kept for a few minutes (and forced after a save), so no screen reads it twice in a row.
const TTL_MS = 5 * 60 * 1000;
let loadedAt = 0;
let loadedSection = '';

export async function ensureClassSettings({ force = false } = {}) {
  if (!force && loadedSection === SECTION && Date.now() - loadedAt < TTL_MS) {
    return getKeptClassSettings();
  }
  try {
    setKeptClassSettings(await loadClassSettings(SECTION));
    loadedAt = Date.now();
    loadedSection = SECTION;
  } catch (e) {
    console.warn('class settings not loaded:', e.code || e.message || e); // the app keeps working with the defaults
  }
  return getKeptClassSettings();
}

export async function updateClassSettings(settings) {
  const clean = cleanClassSettings(settings);
  await saveClassSettings(SECTION, clean);
  setKeptClassSettings(clean);
  loadedAt = Date.now();
  loadedSection = SECTION;
}
