// "Is the app I am running the newest?", as a hook. Checked when the app opens, when it comes back to the foreground, and every
// half hour while it stays open (a phone often resumes an installed app without reloading it, so it would stay old for days).
import { useQuery } from '@tanstack/react-query';
import { fetchLatestVersion, isUpdateAvailable } from '@/api/version';
import { APP_BUILD, IS_DEV_BUILD } from '@/core/app-version';

const HALF_HOUR = 30 * 60 * 1000;

export function useAppUpdate() {
  const query = useQuery({
    queryKey: ['app-version'],
    queryFn: fetchLatestVersion,
    enabled: !IS_DEV_BUILD,
    refetchOnWindowFocus: true, // also fires when a phone app returns to the foreground
    refetchOnReconnect: true,
    refetchInterval: HALF_HOUR,
    staleTime: 60 * 1000, // coming back to the app twice in a minute is one request
    retry: false,
  });
  return {
    latest: query.data ?? null,
    updateAvailable: isUpdateAvailable(APP_BUILD, query.data),
    checking: query.isFetching,
    /** asks the server again right now */
    check: () => query.refetch(),
    /** true when the last check could not reach the server */
    unreachable: query.isFetched && !query.isFetching && query.data === null,
  };
}

/** Loads the newest build: the service worker fetches index.html from the network every time, which points at the new files. */
export function reloadApp(): void {
  location.reload();
}
