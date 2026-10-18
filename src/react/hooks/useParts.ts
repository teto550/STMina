// The parts of the programme, as React Query hooks. Saving and deleting update the list already held (no second read).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPart, deletePart, fetchParts, updatePart, type Author, type Part, type PartInput } from '@/api/parts';
import type { Section } from '@/types/access';

export const partKeys = {
  list: (grade: string, section: Section) => ['parts', section, grade] as const,
};

/** Fetched fresh every time the tab opens. `refetch()` is the retry button. */
export function useParts(grade: string, section: Section) {
  return useQuery({ queryKey: partKeys.list(grade, section), queryFn: () => fetchParts(grade, section), enabled: !!grade, staleTime: 0, gcTime: 0 });
}

type Scope = { grade: string; section: Section; by: Author };

/** Adds a part (no `part`) or edits one (`part`). */
export function useSavePart({ grade, section, by }: Scope) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ part, input }: { part?: Part; input: PartInput }) => (part ? updatePart({ before: part, section, input }) : createPart({ grade, section, input, by })),
    onSuccess: (saved) => {
      client.setQueryData<Part[]>(partKeys.list(grade, section), (old = []) => (old.some((p) => p.id === saved.id) ? old.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...old]));
    },
  });
}

export function useDeletePart({ grade, section }: Pick<Scope, 'grade' | 'section'>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePart(id),
    onSuccess: (_data, id) => {
      client.setQueryData<Part[]>(partKeys.list(grade, section), (old = []) => old.filter((p) => p.id !== id));
    },
  });
}
