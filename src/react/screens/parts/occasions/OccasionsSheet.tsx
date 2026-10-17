import { useState, type FC } from 'react';
import { Case, Switch } from 'react-if';
import { ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import { yearOf, type Occasion } from '@/api/occasions';
import { Alert } from '@/react/components/ui/alert';
import { Button } from '@/react/components/ui/button';
import { Sheet } from '@/react/components/ui/sheet';
import { Spinner } from '@/react/components/ui/spinner';
import { useDeleteOccasion, useOccasions, useRefreshOccasions, useSaveOccasion } from '@/react/hooks/useOccasions';
import type { OccasionValues } from '@/schemas/occasions';
import { dateToStr } from '../logic';
import { OccasionFormSheet } from './OccasionFormSheet';
import { OccasionRow } from './OccasionRow';
import { splitOccasions } from './logic';

enum OccasionsView {
  Loading = 'loading',
  Failed = 'failed',
  Empty = 'empty',
  Data = 'data',
}

type OccasionsSheetProps = {
  /** the manager of the open class: each occasion gets "➕ فقرة" */
  canAddAsPart: boolean;
  /** an admin: may add, edit and delete occasions (the list is the same for every class) */
  canManage: boolean;
  /** "➕ فقرة" on an occasion: the parts screen opens its form with the occasion as the title */
  onAddAsPart: (occasion: Occasion) => void;
  onClose: () => void;
};

type Form = { mode: 'add' | 'edit'; occasion?: Occasion; initial: OccasionValues } | null;

/**
 * "🗓 المناسبات": the Christian occasions, one year at a time (the current year first, ‹ › for the other years), the coming ones first and
 * then the ones that have passed. Read only when this popup is open and kept for a week (src/api/occasions.ts), so it costs next to nothing.
 */
export const OccasionsSheet: FC<OccasionsSheetProps> = ({ canAddAsPart, canManage, onAddAsPart, onClose }) => {
  const today = dateToStr(new Date());
  const [year, setYear] = useState(() => yearOf(today));
  const occasions = useOccasions(year);
  const refresh = useRefreshOccasions(year);
  const save = useSaveOccasion();
  const remove = useDeleteOccasion();
  const [form, setForm] = useState<Form>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const split = splitOccasions(occasions.data ?? [], today);
  let view = OccasionsView.Data;
  if (occasions.isPending) {
    view = OccasionsView.Loading;
  } else if (occasions.isError) {
    view = OccasionsView.Failed;
  } else if ((occasions.data ?? []).length === 0) {
    view = OccasionsView.Empty;
  }

  const row = (o: Occasion) => (
    <OccasionRow
      key={o.id}
      occasion={o}
      today={today}
      canAddAsPart={canAddAsPart}
      canManage={canManage}
      busy={remove.isPending && remove.variables?.id === o.id}
      onAddAsPart={() => onAddAsPart(o)}
      onEdit={() => setForm({ mode: 'edit', occasion: o, initial: { title: o.title, date: o.date } })}
      onDelete={() => remove.mutate(o, { onError: () => setProblem('مقدرناش نمسح المناسبة') })}
    />
  );

  return (
    <>
      <Sheet title="🗓 المناسبات" onClose={onClose}>
        <div className="tw:flex tw:flex-col tw:gap-3">
          <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
            <Button size="sm" variant="outline" aria-label={`سنة ${year - 1}`} onClick={() => setYear(year - 1)}>
              <ChevronRight className="tw:size-4" aria-hidden="true" /> {year - 1}
            </Button>
            <h3 className="tw:text-lg tw:font-black" aria-live="polite">{year}</h3>
            <Button size="sm" variant="outline" aria-label={`سنة ${year + 1}`} onClick={() => setYear(year + 1)}>
              {year + 1} <ChevronLeft className="tw:size-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="tw:flex tw:items-center tw:gap-2">
            {canManage && (
              <Button size="sm" className="tw:flex-1" onClick={() => setForm({ mode: 'add', initial: { title: '', date: '' } })}>
                <Plus className="tw:size-4" aria-hidden="true" /> مناسبة جديدة
              </Button>
            )}
            <Button size="sm" variant="secondary" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
              <RefreshCw className="tw:size-4" aria-hidden="true" /> {refresh.isPending ? 'جاري التحديث…' : 'تحديث'}
            </Button>
          </div>
          {problem && <Alert onDismiss={() => setProblem(null)}>{problem}</Alert>}
          {refresh.isError && <Alert onDismiss={() => refresh.reset()}>معرفناش نحدّث القايمة، جرّب تاني.</Alert>}
          <Switch>
            <Case condition={view === OccasionsView.Loading}>
              <Spinner label="جاري تحميل المناسبات…" />
            </Case>
            <Case condition={view === OccasionsView.Failed}>
              <Alert action={<Button size="sm" onClick={() => void occasions.refetch()}>حاول تاني</Button>}>مقدرناش نجيب المناسبات.</Alert>
            </Case>
            <Case condition={view === OccasionsView.Empty}>
              <p className="tw:py-8 tw:text-center tw:text-sm tw:text-dim">🗓 مفيش مناسبات متسجلة في {year}</p>
            </Case>
            <Case condition={view === OccasionsView.Data}>
              <div className="tw:flex tw:flex-col tw:gap-4">
                {split.upcoming.length > 0 && (
                  <section aria-label="الجاية" className="tw:flex tw:flex-col tw:gap-2">
                    <h4 className="tw:text-sm tw:font-bold tw:text-ok">الجاية ({split.upcoming.length})</h4>
                    <ul className="tw:flex tw:flex-col tw:gap-2">{split.upcoming.map(row)}</ul>
                  </section>
                )}
                {split.past.length > 0 && (
                  <section aria-label="اللي عدّت" className="tw:flex tw:flex-col tw:gap-2">
                    <h4 className="tw:text-sm tw:font-bold tw:text-dim">اللي عدّت ({split.past.length})</h4>
                    <ul className="tw:flex tw:flex-col tw:gap-2">{split.past.map(row)}</ul>
                  </section>
                )}
              </div>
            </Case>
          </Switch>
        </div>
      </Sheet>
      {form && (
        <OccasionFormSheet
          mode={form.mode}
          initial={form.initial}
          onClose={() => setForm(null)}
          onSave={async (values) => {
            await save.mutateAsync({ occasion: form.occasion, input: values });
            setYear(yearOf(values.date)); // show the year it was saved in
          }}
        />
      )}
    </>
  );
};
