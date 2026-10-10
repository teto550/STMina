// The join requests of the servants, as React Query hooks.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approveJoinRequest, fetchJoinRequests, rejectJoinRequest, type JoinRequestScope } from '@/api/join-requests';

export const joinRequestKeys = {
  list: (scope: JoinRequestScope) => ['join-requests', scope.section, scope.grades.join(',')] as const,
};

/** Always fetched fresh when the popup opens, so a request that arrived a minute ago shows up. `refetch()` is the retry button. */
export function useJoinRequests(scope: JoinRequestScope) {
  return useQuery({ queryKey: joinRequestKeys.list(scope), queryFn: () => fetchJoinRequests(scope), staleTime: 0, gcTime: 0 });
}

/** Approve or reject one request; on success the list is refreshed from the answer already held (no extra read). */
export function useDecideJoinRequest(scope: JoinRequestScope, isAdmin: boolean) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, approve }: { uid: string; approve: boolean }) => (approve ? approveJoinRequest(uid, isAdmin) : rejectJoinRequest(uid)),
    onSuccess: (_data, { uid }) => {
      client.setQueryData<Awaited<ReturnType<typeof fetchJoinRequests>>>(joinRequestKeys.list(scope), (old) => (old ?? []).filter((r) => r.id !== uid));
    },
  });
}
