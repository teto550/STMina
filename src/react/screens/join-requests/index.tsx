import { useEffect, useRef, type FC } from 'react';
import { Switch, Case } from 'react-if';
import { Alert } from '@/react/components/ui/alert';
import { Button } from '@/react/components/ui/button';
import { Sheet } from '@/react/components/ui/sheet';
import { Spinner } from '@/react/components/ui/spinner';
import { useDecideJoinRequest, useJoinRequests } from '@/react/hooks/useJoinRequests';
import type { Section } from '@/types/access';
import type { ScreenProps } from '../registry';
import { RequestCard } from './RequestCard';

enum RequestsView {
  Loading = 'loading',
  Error = 'error',
  Empty = 'empty',
  Data = 'data',
}

export type JoinRequestsProps = ScreenProps & {
  section: Section;
  /** the classes the reader manages; empty = all */
  grades: string[];
  isAdmin: boolean;
  /** called with the number of requests still waiting, so the old screen can refresh its counters */
  onCount: (count: number) => void;
};

/** "طلبات انضمام": the servants waiting to join, with their details and approve / reject. */
const JoinRequests: FC<JoinRequestsProps> = ({ close, section, grades, isAdmin, onCount }) => {
  const scope = { section, grades };
  const requests = useJoinRequests(scope);
  const decide = useDecideJoinRequest(scope, isAdmin);
  const count = requests.data?.length;
  const reported = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (count !== undefined && count !== reported.current) {
      reported.current = count;
      onCount(count);
    }
  }, [count, onCount]);

  let view = RequestsView.Data;
  if (requests.isPending) {
    view = RequestsView.Loading;
  } else if (requests.isError) {
    view = RequestsView.Error;
  } else if (requests.data.length === 0) {
    view = RequestsView.Empty;
  }

  return (
    <Sheet title={count ? `طلبات انضمام (${count})` : 'طلبات انضمام'} onClose={() => close?.()}>
      <div className="tw:flex tw:flex-col tw:gap-3">
        {decide.isError && (
          <Alert onDismiss={() => decide.reset()}>معرفناش نسجّل القرار، جرّب تاني.</Alert>
        )}
        <Switch>
          <Case condition={view === RequestsView.Loading}>
            <Spinner label="جاري تحميل الطلبات…" />
          </Case>
          <Case condition={view === RequestsView.Error}>
            <Alert action={<Button size="sm" onClick={() => requests.refetch()}>حاول تاني</Button>}>معرفناش نحمّل الطلبات.</Alert>
          </Case>
          <Case condition={view === RequestsView.Empty}>
            <p className="tw:py-6 tw:text-center tw:text-sm tw:text-dim">مفيش طلبات انضمام دلوقتي.</p>
          </Case>
          <Case condition={view === RequestsView.Data}>
            <ul className="tw:flex tw:flex-col tw:gap-3">
              {requests.data?.map((r) => (
                <RequestCard
                  key={r.id}
                  request={r}
                  busy={decide.isPending && decide.variables?.uid === r.id}
                  onApprove={() => decide.mutate({ uid: r.id, approve: true })}
                  onReject={() => decide.mutate({ uid: r.id, approve: false })}
                />
              ))}
            </ul>
          </Case>
        </Switch>
      </div>
    </Sheet>
  );
};

export default JoinRequests;
