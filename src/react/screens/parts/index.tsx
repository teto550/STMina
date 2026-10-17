import { useMemo, useState, type FC } from 'react';
import { Case, Switch } from 'react-if';
import { CalendarDays, Plus } from 'lucide-react';
import type { Occasion } from '@/api/occasions';
import type { Part } from '@/api/parts';
import { Alert } from '@/react/components/ui/alert';
import { Button } from '@/react/components/ui/button';
import { Spinner } from '@/react/components/ui/spinner';
import { useNextOccasion } from '@/react/hooks/useOccasions';
import { useDeletePart, useParts, useSavePart } from '@/react/hooks/useParts';
import type { PartValues } from '@/schemas/parts';
import type { Section } from '@/types/access';
import { DateGroupCard } from './DateGroupCard';
import { NextOccasionCard } from './occasions/NextOccasionCard';
import { OccasionsSheet } from './occasions/OccasionsSheet';
import { PartFormSheet } from './PartFormSheet';
import { dateToStr, groupByDate, nextFridayStr, upcomingDate } from './logic';

enum PartsView {
  Loading = 'loading',
  Failed = 'failed',
  Empty = 'empty',
  Data = 'data',
}

export type PartsScreenProps = {
  /** the open class */
  grade: string;
  section: Section;
  /** may add, edit and delete (the manager of this class) */
  canManage: boolean;
  /** the servants of this class, for the "الخادم" choice */
  servants: string[];
  /** an admin: may add, edit and delete the occasions (the list is the same for every class) */
  isAdmin: boolean;
  user: { uid: string; name: string };
};

type Form = { mode: 'add' | 'edit'; part?: Part; initial: PartValues } | null;

// which days are open, kept per class while the app runs (the screen is drawn again each time the tab opens)
const openDays = new Map<string, Set<string>>();

/** "توزيع الفقرات": the parts of the open class grouped by day (any day, not only Fridays). */
const PartsScreen: FC<PartsScreenProps> = ({ grade, section, canManage, servants, isAdmin, user }) => {
  const parts = useParts(grade, section);
  const save = useSavePart({ grade, section, by: user });
  const remove = useDeletePart({ grade, section });
  const [form, setForm] = useState<Form>(null);
  const [occasionsOpen, setOccasionsOpen] = useState(false);
  const [open, setOpen] = useState<Set<string>>(() => new Set(openDays.get(grade) ?? []));
  const [problem, setProblem] = useState<string | null>(null);

  const groups = useMemo(() => groupByDate(parts.data ?? []), [parts.data]);
  const today = dateToStr(new Date());
  const next = upcomingDate(groups, today);
  const nextOccasion = useNextOccasion(today);

  const setDay = (date: string, on: boolean) => {
    setOpen((cur) => {
      const nextOpen = new Set(cur);
      if (on) {
        nextOpen.add(date);
      } else {
        nextOpen.delete(date);
      }
      openDays.set(grade, nextOpen);
      return nextOpen;
    });
  };

  let view = PartsView.Data;
  if (parts.isPending) {
    view = PartsView.Loading;
  } else if (parts.isError) {
    view = PartsView.Failed;
  } else if (groups.length === 0) {
    view = PartsView.Empty;
  }

  const blank = (date: string): PartValues => ({ title: '', date, type: '', deaconName: '' });

  return (
    <section aria-label="توزيع الفقرات" className="tw:flex tw:flex-col tw:gap-3">
      {nextOccasion && <NextOccasionCard next={nextOccasion} today={today} onOpen={() => setOccasionsOpen(true)} />}
      <h2 className="tw:text-base tw:font-bold">📋 توزيع الفقرات — {grade}</h2>
      <div className="tw:flex tw:gap-2">
        {canManage && (
          <Button size="lg" className="tw:flex-1" onClick={() => setForm({ mode: 'add', initial: blank(nextFridayStr()) })}>
            <Plus className="tw:size-5" aria-hidden="true" /> إضافة فقرة
          </Button>
        )}
        <Button size="lg" variant="secondary" className={canManage ? undefined : 'tw:flex-1'} onClick={() => setOccasionsOpen(true)}>
          <CalendarDays className="tw:size-5" aria-hidden="true" /> المناسبات
        </Button>
      </div>
      <div className="tw:flex tw:gap-4 tw:text-xs tw:text-dim">
        <span className="tw:flex tw:items-center tw:gap-1"><span className="tw:size-2 tw:rounded-full tw:bg-ok" />أقرب يوم جاي</span>
        <span className="tw:flex tw:items-center tw:gap-1"><span className="tw:size-2 tw:rounded-full tw:bg-accent" />باقي الأيام</span>
      </div>
      {problem && <Alert onDismiss={() => setProblem(null)}>{problem}</Alert>}
      <Switch>
        <Case condition={view === PartsView.Loading}>
          <Spinner label="جاري تحميل الفقرات…" />
        </Case>
        <Case condition={view === PartsView.Failed}>
          <Alert action={<Button size="sm" onClick={() => void parts.refetch()}>حاول تاني</Button>}>مقدرناش نجيب الفقرات.</Alert>
        </Case>
        <Case condition={view === PartsView.Empty}>
          <p className="tw:py-8 tw:text-center tw:text-sm tw:text-dim">📋 لسه مفيش فقرات متوزعة</p>
        </Case>
        <Case condition={view === PartsView.Data}>
          <ul className="tw:flex tw:flex-col tw:gap-2.5">
            {groups.map((g) => (
              <DateGroupCard
                key={g.date || 'none'}
                group={g}
                open={open.has(g.date)}
                upcoming={g.date === next}
                past={!!g.date && g.date < today && g.date !== next}
                canManage={canManage}
                busyId={remove.isPending ? (remove.variables ?? null) : null}
                onToggle={() => setDay(g.date, !open.has(g.date))}
                onAdd={() => setForm({ mode: 'add', initial: blank(g.date) })}
                onEdit={(part) => setForm({ mode: 'edit', part, initial: { title: part.title, date: part.date, type: part.type, deaconName: part.deaconName } })}
                onDelete={(part) => remove.mutate(part.id, { onError: () => setProblem('مقدرناش نمسح الفقرة') })}
              />
            ))}
          </ul>
        </Case>
      </Switch>
      {occasionsOpen && (
        <OccasionsSheet
          canAddAsPart={canManage}
          canManage={isAdmin}
          onClose={() => setOccasionsOpen(false)}
          onAddAsPart={(occasion: Occasion) => {
            // a part named after the occasion; the day is left empty on purpose (it is required: the person picks it)
            setOccasionsOpen(false);
            setForm({ mode: 'add', initial: { ...blank(''), title: occasion.title } });
          }}
        />
      )}
      {form && (
        <PartFormSheet
          mode={form.mode}
          initial={form.initial}
          servants={servants}
          onClose={() => setForm(null)}
          onSave={async (values) => {
            await save.mutateAsync({ part: form.part, input: { type: values.type, title: values.title.trim(), date: values.date, deaconName: values.deaconName } });
            setDay(values.date, true); // the day of the part is opened, so it shows up
          }}
        />
      )}
    </section>
  );
};

export default PartsScreen;
