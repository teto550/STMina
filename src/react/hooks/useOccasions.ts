// The occasions, as React Query hooks. The reading is done (and kept for a week) by src/api/occasions.ts; after a change the list is read
// again from that kept copy, which the change has already updated, so it costs no Firestore read.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addOccasion, deleteOccasion, fetchOccasions, updateOccasion, type Occasion, type OccasionInput } from '@/api/occasions';
import { nextOccasion, type NextOccasion } from '@/react/screens/parts/occasions/logic';

export const occasionKeys = {
  all: ['occasions'] as const,
  year: (year: number) => ['occasions', year] as const,
};

/** One year of occasions. Only fetched while the popup is open (`enabled`). */
export function useOccasions(year: number, enabled = true) {
  return useQuery({ queryKey: occasionKeys.year(year), queryFn: () => fetchOccasions(year), enabled, staleTime: 5 * 60 * 1000 });
}

/** "تحديث": reads the year from Firestore again, ignoring the kept copy. */
export function useRefreshOccasions(year: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => fetchOccasions(year, { force: true }),
    onSuccess: (items) => client.setQueryData<Occasion[]>(occasionKeys.year(year), items),
  });
}

/** Adds an occasion (no `occasion`) or edits one. */
export function useSaveOccasion() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ occasion, input }: { occasion?: Occasion; input: OccasionInput }) => (occasion ? updateOccasion(occasion, input) : addOccasion(input)),
    onSuccess: () => client.invalidateQueries({ queryKey: occasionKeys.all }),
  });
}

export function useDeleteOccasion() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (occasion: Occasion) => deleteOccasion(occasion),
    onSuccess: () => client.invalidateQueries({ queryKey: occasionKeys.all }),
  });
}

/**
 * The next occasion, for the card at the top of توزيع الفقرات. It reads (and keeps for a week, like the popup) the current year; only when
 * nothing is left in it (the end of December) does it look at the next year too. Quiet: while loading, or when it cannot be read, there is
 * simply no card.
 */
export function useNextOccasion(today: string): NextOccasion | null {
  const year = Number(today.slice(0, 4));
  const thisYear = useOccasions(year);
  const inThisYear = thisYear.data ? nextOccasion(thisYear.data, today) : null;
  const lookAhead = thisYear.isSuccess && !inThisYear;
  const nextYear = useOccasions(year + 1, lookAhead);
  return inThisYear ?? (lookAhead && nextYear.data ? nextOccasion(nextYear.data, today) : null);
}
