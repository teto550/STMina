import { useMemo, type FC } from 'react';
import { RefreshCw } from 'lucide-react';
import { notesErrorMessage } from '@/api/errors';
import { Alert } from '@/react/components/ui/alert';
import { Button } from '@/react/components/ui/button';
import { Spinner } from '@/react/components/ui/spinner';
import { useKidsMonthData } from '@/react/hooks/useSpiritualNotes';
import { dateToStr, monthOf, monthRange, rankKids } from '../spiritual-notes/logic';

export type SpiritualNotesRankingProps = {
  /** the kids to rank (the class, after the servant filter of the statistics) */
  kids: { id: string; name: string }[];
  /** called when a kid is tapped (opens his profile) */
  onOpenKid?: (id: string) => void;
};

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * Statistics > النوتة الروحية: the kids that have points in the last 4 weeks (Friday to Thursday, this week included), from the first place to the
 * last. Kids with the same score share the same place. The points are the ones of the "نقط الشهر" box in each kid's file.
 */
const SpiritualNotesRanking: FC<SpiritualNotesRankingProps> = ({ kids, onOpenKid }) => {
  const today = useMemo(() => dateToStr(new Date()), []);
  const { from, to } = monthRange(today);
  const ids = useMemo(() => kids.map((k) => k.id), [kids]);
  const data = useKidsMonthData(ids, from, to, monthOf(today));
  const ranked = useMemo(() => (data.data ? rankKids(kids, data.data, today) : []), [kids, data.data, today]);

  return (
    <section aria-label="ترتيب النوتة الروحية" className="tw:flex tw:flex-col tw:gap-3">
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
        <p className="tw:text-sm tw:font-bold">الترتيب حسب نقط آخر ٤ أسابيع</p>
        <span className="tw:flex tw:items-center tw:gap-2 tw:text-xs tw:text-dim">
          {data.isSuccess ? `${ranked.length} مخدوم` : ''}
          <Button size="icon" variant="ghost" aria-label="تحديث" disabled={data.isFetching} onClick={() => void data.refetch()}>
            <RefreshCw className="tw:size-4" aria-hidden="true" />
          </Button>
        </span>
      </div>
      {kids.length === 0 && <p className="tw:py-8 tw:text-center tw:text-sm tw:text-dim">مفيش مخدومين</p>}
      {kids.length > 0 && data.isPending && <Spinner label="جاري تحميل النقط…" />}
      {data.isError && <Alert action={<Button size="sm" onClick={() => void data.refetch()}>حاول تاني</Button>}>{notesErrorMessage(data.error)}</Alert>}
      {data.isSuccess && ranked.length === 0 && <p className="tw:py-8 tw:text-center tw:text-sm tw:text-dim">لسه مفيش حد عنده نقط في آخر ٤ أسابيع</p>}
      <ol className="tw:flex tw:flex-col tw:gap-2">
        {ranked.map((k) => (
          <li key={k.id}>
            <button type="button" onClick={() => onOpenKid?.(k.id)} className="tw:flex tw:min-h-12 tw:w-full tw:cursor-pointer tw:items-center tw:gap-3 tw:rounded-card tw:border tw:border-line tw:bg-surface tw:px-4 tw:py-2 tw:text-start">
              <span className="tw:w-8 tw:text-center tw:text-base tw:font-bold" aria-label={`المركز ${k.rank}`}>{MEDALS[k.rank - 1] ?? k.rank}</span>
              <span className="tw:flex-1 tw:text-base tw:font-bold">{k.name}</span>
              <span className="tw:flex tw:flex-col tw:items-end">
                <span className="tw:text-sm tw:font-bold">{k.month} نقطة</span>
                <span className="tw:text-xs tw:text-dim">الأسبوع: {k.week}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
};

export default SpiritualNotesRanking;
