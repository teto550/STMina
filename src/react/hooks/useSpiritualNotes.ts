// The spiritual notes (النوتة الروحية) of one kid, as React Query hooks. Saving updates what is already held (no second read).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchConfession, fetchKidDay, fetchKidsMonthData, fetchKidDays, fetchKidDaysBetween, fetchNotePoints, saveConfession, saveNotePoints, saveNoteDay, type NoteDay, type NoteValues } from '@/api/spiritual-notes';
import { cleanPoints, DEFAULT_POINTS, type NotePoints } from '@/core/notes-points';

const MINUTE = 60 * 1000;

export const notesKeys = {
  points: ['spiritual-notes', 'points'] as const,
  day: (id: string, day: string) => ['spiritual-notes', 'day', id, day] as const,
  month: (id: string, month: string) => ['spiritual-notes', 'month', id, month] as const,
  history: (id: string, since: string) => ['spiritual-notes', 'history', id, since] as const,
  ranking: (ids: string, from: string, to: string, month: string) => ['spiritual-notes', 'ranking', ids, from, to, month] as const,
  range: (id: string, from: string, to: string) => ['spiritual-notes', 'range', id, from, to] as const,
};

/** The chosen day of a kid: `null` = nothing written that day. */
export function useKidDay(id: string, day: string) {
  return useQuery({ queryKey: notesKeys.day(id, day), queryFn: () => fetchKidDay(id, day), staleTime: MINUTE });
}

export function useConfession(id: string, month: string) {
  return useQuery({ queryKey: notesKeys.month(id, month), queryFn: () => fetchConfession(id, month), staleTime: MINUTE });
}

/** The days a kid wrote since `since`, newest first. */
export function useKidHistory(id: string, since: string) {
  return useQuery({ queryKey: notesKeys.history(id, since), queryFn: () => fetchKidDays(id, since), staleTime: MINUTE });
}

/** The days from `from` to `to` of a kid (covers the week and the month of the open day, for the points). */
export function useKidRange(id: string, from: string, to: string) {
  return useQuery({ queryKey: notesKeys.range(id, from, to), queryFn: () => fetchKidDaysBetween(id, from, to), staleTime: MINUTE });
}

type SaveInput = { childId: string; day: string; month: string; values: NoteValues; confession: boolean; confessionChanged: boolean; by: string; since: string; from: string; to: string };

/** Saves the chosen day, and the month's confession when it changed. */
export function useSaveNote() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, day, month, values, confession, confessionChanged, by }: SaveInput) => {
      const saved = await saveNoteDay({ childId, day, values, by });
      if (confessionChanged) {
        await saveConfession({ childId, month, value: confession, by });
      }
      return saved;
    },
    onSuccess: (saved, input) => {
      client.setQueryData<NoteDay | null>(notesKeys.day(input.childId, input.day), saved);
      client.setQueryData<boolean>(notesKeys.month(input.childId, input.month), input.confession);
      const put = (old: NoteDay[] = []) => [saved, ...old.filter((n) => n.day !== saved.day)].sort((a, b) => (a.day < b.day ? 1 : -1));
      client.setQueryData<NoteDay[]>(notesKeys.history(input.childId, input.since), put);
      client.setQueryData<NoteDay[]>(notesKeys.range(input.childId, input.from, input.to), put);
    },
  });
}

/** The last 4 weeks of many kids (and the month's confession), for the ranking in the statistics. Kept 5 minutes: the servant refreshes by hand. */
export function useKidsMonthData(ids: string[], from: string, to: string, month: string) {
  const key = [...ids].sort().join(',');
  return useQuery({ queryKey: notesKeys.ranking(key, from, to, month), queryFn: () => fetchKidsMonthData(ids, from, to, month), staleTime: 5 * MINUTE, enabled: ids.length > 0 });
}

/** The points of each thing, as the admin set them (the defaults until he did, or when they could not be read: the screens never wait for them or break without them). */
export function useNotePointsQuery() {
  return useQuery({ queryKey: notesKeys.points, queryFn: async () => cleanPoints(await fetchNotePoints()), staleTime: 5 * MINUTE });
}

export function useNotePoints(): NotePoints {
  return useNotePointsQuery().data ?? DEFAULT_POINTS;
}

/** Saves the points (admin only); the screens that show points use the new ones at once. */
export function useSaveNotePoints() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { points: NotePoints; by: string }) => saveNotePoints(input),
    onSuccess: (points) => client.setQueryData<NotePoints>(notesKeys.points, points),
  });
}
