import { useState, type FC } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Occasion } from '@/api/occasions';
import { Button } from '@/react/components/ui/button';
import { cn } from '@/react/lib/utils';
import { formatDateHeader } from '../logic';
import { countdownLabel, daysUntil } from './logic';

type OccasionRowProps = {
  occasion: Occasion;
  today: string;
  /** may add it as a part of the open class (the manager of the class) */
  canAddAsPart: boolean;
  /** may edit and delete (an admin: the list is for the whole app) */
  canManage: boolean;
  busy: boolean;
  onAddAsPart: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

/** One occasion: its day, its name and how far it is; for a manager of the class "➕ فقرة", for an admin edit and delete (asks once). */
export const OccasionRow: FC<OccasionRowProps> = ({ occasion, today, canAddAsPart, canManage, busy, onAddAsPart, onEdit, onDelete }) => {
  const [confirming, setConfirming] = useState(false);
  const days = daysUntil(occasion.date, today);
  return (
    <li className={cn('tw:flex tw:flex-col tw:gap-2 tw:rounded-field tw:border tw:border-line tw:bg-surface-2 tw:p-3', days < 0 && 'tw:opacity-70')}>
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-2">
        <span className="tw:min-w-0">
          <span className="tw:block tw:text-[15px] tw:font-bold">{occasion.title}</span>
          <span className="tw:mt-0.5 tw:block tw:text-xs tw:text-dim">📅 {formatDateHeader(occasion.date)}</span>
        </span>
        <span className={cn('tw:shrink-0 tw:rounded-full tw:px-2.5 tw:py-0.5 tw:text-xs tw:font-bold', days >= 0 ? 'tw:bg-ok/15 tw:text-ok' : 'tw:bg-line tw:text-dim')}>{countdownLabel(days)}</span>
      </div>
      {(canAddAsPart || canManage) && (
        <div className="tw:flex tw:items-center tw:gap-2">
          {canAddAsPart && (
            <Button size="sm" variant="outline" className="tw:flex-1" aria-label={`إضافة ${occasion.title} كفقرة`} onClick={onAddAsPart}>
              <Plus className="tw:size-4" aria-hidden="true" /> فقرة
            </Button>
          )}
          {canManage && (
            <>
              <button type="button" aria-label={`تعديل ${occasion.title}`} disabled={busy} onClick={onEdit} className="tw:flex tw:size-8 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-field tw:border tw:border-line tw:bg-surface tw:text-dim">
                <Pencil className="tw:size-4" aria-hidden="true" />
              </button>
              {confirming ? (
                <Button size="sm" variant="destructive" disabled={busy} onClick={onDelete}>أكيد؟ امسح</Button>
              ) : (
                <button type="button" aria-label={`حذف ${occasion.title}`} disabled={busy} onClick={() => setConfirming(true)} className="tw:flex tw:size-8 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-field tw:border tw:border-bad/30 tw:bg-bad/10 tw:text-bad">
                  <Trash2 className="tw:size-4" aria-hidden="true" />
                </button>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
};
