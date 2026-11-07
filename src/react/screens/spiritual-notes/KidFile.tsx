import { useMemo, useState, type FC } from 'react';
import { Case, Switch } from 'react-if';
import { ArrowRight } from 'lucide-react';
import { notesErrorMessage } from '@/api/errors';
import type { NoteDay } from '@/api/spiritual-notes';
import { Alert } from '@/react/components/ui/alert';
import { Button } from '@/react/components/ui/button';
import { Input } from '@/react/components/ui/input';
import { Spinner } from '@/react/components/ui/spinner';
import { useConfession, useKidDay, useKidHistory, useKidRange, useNotePoints, useSaveNote } from '@/react/hooks/useSpiritualNotes';
import { addDays, dateToStr, dayLabel, dayPoints, didAnything, isFastDay, lastDays, monthOf, monthPoints, rangeFor, readGospel, summaryOf, weekDays, weekPoints } from './logic';

export type KidRef = { id: string; name: string };

enum FileView {
  Loading = 'loading',
  Failed = 'failed',
  Data = 'data',
}

type KidFileProps = {
  kid: KidRef;
  /** may write (a servant of the class); otherwise the file is only read */
  canEdit: boolean;
  /** the servant who writes, kept on what he saves */
  by: string;
  onBack: () => void;
};

const HISTORY_DAYS = 30;

const Toggle: FC<{ label: string; on: boolean; disabled: boolean; onToggle: () => void }> = ({ label, on, disabled, onToggle }) => {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onToggle}
      className={`tw:min-h-12 tw:flex-1 tw:cursor-pointer tw:rounded-field tw:border tw:px-3 tw:text-sm tw:font-bold tw:disabled:cursor-default ${on ? 'tw:border-ok tw:bg-ok tw:text-black' : 'tw:border-line tw:bg-surface-2 tw:text-fg'}`}
    >
      {on && <span aria-hidden="true">✓ </span>}
      {label}
    </button>
  );
};

type PointsBoxProps = { label: string; points: number | null };

const PointsBox: FC<PointsBoxProps> = ({ label, points }) => {
  return (
    <div className="tw:flex tw:flex-1 tw:flex-col tw:items-center tw:rounded-card tw:border tw:border-line tw:bg-surface tw:px-2 tw:py-2">
      <span className="tw:text-xs tw:text-dim">{label}</span>
      <span className="tw:text-lg tw:font-bold">{points === null ? '…' : points}</span>
    </div>
  );
};

type DayFormProps = { kid: KidRef; day: string; initial: NoteDay | null; initialConfession: boolean; canEdit: boolean; by: string; since: string; from: string; to: string };

/** The tick boxes of one day of one kid, and the month's confession. Mounted again for each day (the `key`), so it starts from what is saved. */
const DayForm: FC<DayFormProps> = ({ kid, day, initial, initialConfession, canEdit, by, since, from, to }) => {
  const [morning, setMorning] = useState(!!initial?.prayerMorning);
  const [night, setNight] = useState(!!initial?.prayerNight);
  const [mass, setMass] = useState(!!initial?.mass);
  const [fast, setFast] = useState(!!initial?.fast);
  const [gospel, setGospel] = useState(initial ? readGospel(initial) : false);
  const [confession, setConfession] = useState(initialConfession);
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const save = useSaveNote();
  const fastDay = isFastDay(day);
  const month = monthOf(day);

  const change = (apply: () => void) => {
    apply();
    setSaved(false);
  };

  const onSave = async () => {
    setProblem(null);
    try {
      await save.mutateAsync({
        childId: kid.id,
        day,
        month,
        values: { prayerMorning: morning, prayerNight: night, mass, gospel, ...(fastDay ? { fast } : {}) },
        confession,
        confessionChanged: confession !== initialConfession,
        by,
        since,
        from,
        to,
      });
      setSaved(true);
    } catch (e) {
      setProblem(notesErrorMessage(e));
    }
  };

  return (
    <div className="tw:flex tw:flex-col tw:gap-4 tw:rounded-card tw:border tw:border-line tw:bg-surface tw:p-3">
      <h3 className="tw:text-sm tw:font-bold">{dayLabel(day)}</h3>
      <div className="tw:flex tw:flex-col tw:gap-2">
        <span className="tw:text-sm tw:font-bold">الصلاة</span>
        <div className="tw:flex tw:gap-2">
          <Toggle label="الصبح" on={morning} disabled={!canEdit} onToggle={() => change(() => setMorning(!morning))} />
          <Toggle label="بليل" on={night} disabled={!canEdit} onToggle={() => change(() => setNight(!night))} />
        </div>
      </div>
      <div className="tw:flex tw:items-center tw:gap-2">
        <span className="tw:w-16 tw:text-sm tw:font-bold">الإنجيل</span>
        <Toggle label="قرأ" on={gospel} disabled={!canEdit} onToggle={() => change(() => setGospel(!gospel))} />
      </div>
      <div className="tw:flex tw:items-center tw:gap-2">
        <span className="tw:w-16 tw:text-sm tw:font-bold">القداس</span>
        <Toggle label="حضر" on={mass} disabled={!canEdit} onToggle={() => change(() => setMass(!mass))} />
      </div>
      {fastDay && (
        <div className="tw:flex tw:items-center tw:gap-2">
          <span className="tw:w-16 tw:text-sm tw:font-bold">الصوم</span>
          <Toggle label="صام" on={fast} disabled={!canEdit} onToggle={() => change(() => setFast(!fast))} />
        </div>
      )}
      <div className="tw:flex tw:flex-col tw:gap-1">
        <div className="tw:flex tw:items-center tw:gap-2">
          <span className="tw:w-16 tw:text-sm tw:font-bold">الاعتراف</span>
          <Toggle label="اعترف" on={confession} disabled={!canEdit} onToggle={() => change(() => setConfession(!confession))} />
        </div>
        <span className="tw:text-xs tw:text-dim">مرة في الشهر (شهر {month})</span>
      </div>
      {problem && <Alert onDismiss={() => setProblem(null)}>{problem}</Alert>}
      {canEdit && (
        <Button size="lg" loading={save.isPending} onClick={() => void onSave()}>
          حفظ اليوم
        </Button>
      )}
      {saved && <p role="status" className="tw:text-center tw:text-sm tw:font-bold tw:text-ok">اتحفظ ✓</p>}
    </div>
  );
};

/** The file of one kid: pick a day, tick what he did (prayers, gospel, mass, fasting, the month's confession) and save. Below: the last days. */
export const KidFile: FC<KidFileProps> = ({ kid, canEdit, by, onBack }) => {
  const today = useMemo(() => dateToStr(new Date()), []);
  const since = useMemo(() => lastDays(HISTORY_DAYS, new Date()).at(-1) ?? today, [today]);
  const [day, setDay] = useState(today);
  const week = weekDays(day); // the week runs from Friday to Thursday
  const dayData = useKidDay(kid.id, day);
  const confession = useConfession(kid.id, monthOf(day));
  const history = useKidHistory(kid.id, since);
  const { from, to } = rangeFor(day);
  const range = useKidRange(kid.id, from, to);
  const written = (history.data ?? []).filter(didAnything);
  const points = useNotePoints();

  // the points: the day from the saved day, the week and the month from the days read around it (the month also has the confession)
  const rangeReady = range.isSuccess && !confession.isPending && !confession.isError;
  const dayTotal = dayData.isSuccess ? dayPoints(dayData.data, points) : null;
  const weekTotal = rangeReady ? weekPoints(range.data, day, points) : null;
  const monthTotal = rangeReady ? monthPoints(range.data, day, confession.data === true, points) : null;

  let view = FileView.Data;
  if (dayData.isPending || confession.isPending) {
    view = FileView.Loading;
  } else if (dayData.isError || confession.isError) {
    view = FileView.Failed;
  }

  return (
    <section aria-label={`ملف ${kid.name}`} className="tw:flex tw:flex-col tw:gap-3">
      <div className="tw:flex tw:items-center tw:gap-2">
        <Button variant="ghost" size="icon" aria-label="رجوع" onClick={onBack}>
          <ArrowRight className="tw:size-5" aria-hidden="true" />
        </Button>
        <h2 className="tw:text-base tw:font-bold">{kid.name} — النوتة الروحية</h2>
      </div>
      <div className="tw:flex tw:gap-2" aria-label="النقط">
        <PointsBox label="نقط اليوم" points={dayTotal} />
        <PointsBox label="نقط الأسبوع" points={weekTotal} />
        <PointsBox label="نقط الشهر" points={monthTotal} />
      </div>
      {range.isError && <p className="tw:text-xs tw:text-dim">{notesErrorMessage(range.error)}</p>}
      <p className="tw:text-xs tw:text-dim">اختار اليوم اللي عايز تسجله (الأسبوع من الجمعة للخميس):</p>
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
        <Button size="sm" variant="secondary" onClick={() => setDay(addDays(day, -7))}>الأسبوع اللي فات</Button>
        <span className="tw:text-center tw:text-xs tw:text-dim">من {dayLabel(week[0] ?? day)} لـ {dayLabel(week[6] ?? day)}</span>
        <Button size="sm" variant="secondary" disabled={addDays(day, 7) > today} onClick={() => setDay(addDays(day, 7))}>الأسبوع الجاي</Button>
      </div>
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        {week.map((d) => (
          <button key={d} type="button" aria-pressed={d === day} disabled={d > today} onClick={() => setDay(d)} className={`tw:cursor-pointer tw:rounded-full tw:px-3 tw:py-2 tw:text-xs tw:font-bold tw:disabled:cursor-default tw:disabled:opacity-40 ${d === day ? 'tw:bg-accent tw:text-white' : 'tw:bg-surface-2 tw:text-dim'}`}>
            {dayLabel(d)}
          </button>
        ))}
      </div>
      <label className="tw:flex tw:flex-col tw:gap-1 tw:text-xs tw:text-dim">
        يوم تاني
        <Input type="date" max={today} value={day} onChange={(e) => e.target.value && e.target.value <= today && setDay(e.target.value)} />
      </label>
      <Switch>
        <Case condition={view === FileView.Loading}>
          <Spinner label="جاري تحميل اليوم…" />
        </Case>
        <Case condition={view === FileView.Failed}>
          <Alert action={<Button size="sm" onClick={() => { void dayData.refetch(); void confession.refetch(); }}>حاول تاني</Button>}>{notesErrorMessage(dayData.error ?? confession.error)}</Alert>
        </Case>
        <Case condition={view === FileView.Data}>
          <DayForm key={day} kid={kid} day={day} initial={dayData.data ?? null} initialConfession={confession.data === true} canEdit={canEdit} by={by} since={since} from={from} to={to} />
        </Case>
      </Switch>
      <h3 className="tw:text-sm tw:font-bold">آخر الأيام</h3>
      {history.isPending && <Spinner label="جاري تحميل آخر الأيام…" />}
      {history.isError && <p className="tw:text-xs tw:text-dim">{notesErrorMessage(history.error)}</p>}
      {history.isSuccess && written.length === 0 && <p className="tw:text-xs tw:text-dim">لسه مفيش أيام متسجلة في آخر ٣٠ يوم</p>}
      <ul className="tw:flex tw:flex-col">
        {written.map((n) => (
          <li key={n.day}>
            <button type="button" onClick={() => setDay(n.day)} className="tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:justify-between tw:gap-2 tw:border-b tw:border-line tw:py-2 tw:text-start tw:text-xs">
              <span className="tw:font-bold">{dayLabel(n.day)}</span>
              <span className="tw:text-dim">{summaryOf(n)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
