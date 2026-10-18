// Is there a newer build on the server? The build writes `version.json` ({ version, build, builtAt }) next to index.html; the running
// app compares its own build id with it. One tiny file, no Firestore reads. The service worker never caches it (public/sw.js).
import { http } from '@/core/http';

export interface LatestVersion {
  /** the version number (package.json), for people */
  version: string;
  /** the id of that build (what is compared) */
  build: string;
  builtAt: string;
}

/** The newest build, or null when it cannot be told (offline, no file in this build, a broken answer). */
export async function fetchLatestVersion(): Promise<LatestVersion | null> {
  try {
    const { data } = await http.get('version.json', { params: { t: Date.now() }, timeout: 8000 });
    if (data && typeof data.build === 'string' && data.build) {
      return { version: typeof data.version === 'string' ? data.version : '', build: data.build, builtAt: typeof data.builtAt === 'string' ? data.builtAt : '' };
    }
    return null;
  } catch {
    return null;
  }
}

/** A newer build exists when the server's build id differs from the one running. (Never in `npm run dev`, which is always "dev".) */
export function isUpdateAvailable(currentBuild: string, latest: LatestVersion | null | undefined): boolean {
  return !!latest && currentBuild !== 'dev' && latest.build !== currentBuild;
}
