// The servants, as React Query hooks.
import { useQuery } from '@tanstack/react-query';
import { fetchRoster } from '@/api/roster';
import type { Section } from '@/types/access';

export const servantKeys = {
  roster: (section: Section) => ['servants', 'roster', section] as const,
};

/**
 * The servants list of a section (a new servant picks their own name from it). It is fetched again every time `enabled` turns on
 * (for example each time the "new servant" tab opens), so a servant added a minute ago shows up. `refetch()` is the retry button.
 */
export function useRoster(section: Section, enabled = true) {
  return useQuery({ queryKey: servantKeys.roster(section), queryFn: () => fetchRoster(section), enabled, staleTime: 0 });
}
