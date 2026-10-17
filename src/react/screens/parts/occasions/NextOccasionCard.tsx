import type { FC } from 'react';
import { CalendarDays } from 'lucide-react';
import { formatDateHeader } from '../logic';
import { countdownLabel, daysUntil, type NextOccasion } from './logic';

type NextOccasionCardProps = {
  next: NextOccasion;
  today: string;
  /** tapping the card opens the whole list */
  onOpen: () => void;
};

/** The next occasion, in green, with its day and how far it is: the first thing under the tabs of توزيع الفقرات. Tap = the whole list. */
export const NextOccasionCard: FC<NextOccasionCardProps> = ({ next, today, onOpen }) => {
  const { occasion, alsoThatDay } = next;
  return (
    <button type="button" aria-label={`المناسبة الجاية: ${occasion.title}، افتح كل المناسبات`} onClick={onOpen} className="tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:gap-3 tw:rounded-card tw:border tw:border-ok/40 tw:bg-ok/10 tw:p-4 tw:text-start">
      <span aria-hidden="true" className="tw:flex tw:size-11 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-field tw:bg-ok/20 tw:text-ok">
        <CalendarDays className="tw:size-6" />
      </span>
      <span className="tw:min-w-0 tw:flex-1">
        <span className="tw:block tw:text-xs tw:font-bold tw:text-ok">المناسبة الجاية</span>
        <span className="tw:block tw:text-base tw:font-black">{occasion.title}</span>
        <span className="tw:mt-0.5 tw:block tw:text-xs tw:text-dim">
          📅 {formatDateHeader(occasion.date)}
          {alsoThatDay > 0 ? ` · وفيه ${alsoThatDay === 1 ? 'مناسبة تانية' : `${alsoThatDay} مناسبات تانية`} نفس اليوم` : ''}
        </span>
      </span>
      <span className="tw:shrink-0 tw:rounded-full tw:bg-ok/20 tw:px-3 tw:py-1 tw:text-xs tw:font-bold tw:text-ok">{countdownLabel(daysUntil(occasion.date, today))}</span>
    </button>
  );
};
