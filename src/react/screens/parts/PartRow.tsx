import { useState, type FC } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { Part } from '@/api/parts';
import { Button } from '@/react/components/ui/button';
import { LinkifiedText } from '@/react/components/ui/linkified-text';
import { cn } from '@/react/lib/utils';
import { iconOf } from './logic';

type PartRowProps = {
  part: Part;
  /** colour of the day (green = the next one) */
  upcoming: boolean;
  /** the reader may edit and delete (the class manager) */
  canManage: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

/** One part: its type (when set), title and servant (when set); for a manager an edit button and a delete button that asks once. */
export const PartRow: FC<PartRowProps> = ({ part, upcoming, canManage, busy, onEdit, onDelete }) => {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="tw:flex tw:items-center tw:gap-3 tw:rounded-field tw:bg-surface-2 tw:p-3">
      <span aria-hidden="true" className={cn('tw:flex tw:size-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-field tw:text-lg', upcoming ? 'tw:bg-ok/15' : 'tw:bg-accent/15')}>{iconOf(part.type)}</span>
      <span className="tw:min-w-0 tw:flex-1">
        {part.type && <span className={cn('tw:block tw:text-xs tw:font-bold', upcoming ? 'tw:text-ok' : 'tw:text-accent')}>{part.type}</span>}
        <LinkifiedText text={part.title} className="tw:block tw:text-[15px] tw:font-bold" />
        {part.reference && <LinkifiedText text={part.reference} className="tw:mt-1 tw:block tw:text-sm tw:text-dim" />}
        <span className="tw:mt-0.5 tw:block tw:text-xs tw:text-dim">👤 {part.deaconName || 'لسه ماتحددش خادم'}</span>
      </span>
      {canManage && (
        <span className="tw:flex tw:shrink-0 tw:gap-1.5">
          <button type="button" aria-label={`تعديل ${part.title}`} disabled={busy} onClick={onEdit} className="tw:flex tw:size-9 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-field tw:border tw:border-line tw:bg-surface tw:text-dim">
            <Pencil className="tw:size-4" aria-hidden="true" />
          </button>
          {confirming ? (
            <Button size="sm" variant="destructive" disabled={busy} onClick={onDelete}>أكيد؟ امسح</Button>
          ) : (
            <button type="button" aria-label={`حذف ${part.title}`} disabled={busy} onClick={() => setConfirming(true)} className="tw:flex tw:size-9 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-field tw:border tw:border-bad/30 tw:bg-bad/10 tw:text-bad">
              <Trash2 className="tw:size-4" aria-hidden="true" />
            </button>
          )}
        </span>
      )}
    </li>
  );
};
