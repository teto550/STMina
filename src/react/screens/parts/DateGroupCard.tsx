import type { FC } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import type { Part } from '@/api/parts';
import { cn } from '@/react/lib/utils';
import { formatDateHeader, type DateGroup } from './logic';
import { PartRow } from './PartRow';

type DateGroupCardProps = {
  group: DateGroup;
  open: boolean;
  /** the next day: green */
  upcoming: boolean;
  /** this day has passed: a little dimmer */
  past: boolean;
  canManage: boolean;
  /** the id of the part being deleted (its row is disabled) */
  busyId: string | null;
  onToggle: () => void;
  /** "add another part on this day" */
  onAdd: () => void;
  onEdit: (part: Part) => void;
  onDelete: (part: Part) => void;
};

/** All the parts of one day: a header (tap to open / close, and for a manager a + to add another part on that day) and the parts. */
export const DateGroupCard: FC<DateGroupCardProps> = ({ group, open, upcoming, past, canManage, busyId, onToggle, onAdd, onEdit, onDelete }) => {
  const label = group.date ? `📅 يوم ${formatDateHeader(group.date)}` : '📌 بدون تاريخ محدد';
  return (
    <li className={cn('tw:overflow-hidden tw:rounded-field tw:border tw:bg-surface', upcoming ? 'tw:border-ok/40' : 'tw:border-line', past && 'tw:opacity-80')}>
      <div className={cn('tw:flex tw:items-center', upcoming ? 'tw:bg-ok/10' : 'tw:bg-accent/10')}>
        <button type="button" aria-expanded={open} onClick={onToggle} className="tw:flex tw:min-w-0 tw:flex-1 tw:cursor-pointer tw:items-center tw:justify-between tw:gap-2 tw:px-4 tw:py-3.5 tw:text-start">
          <span className={cn('tw:text-[15px] tw:font-bold', upcoming ? 'tw:text-ok' : 'tw:text-accent')}>{label}</span>
          <span className="tw:flex tw:items-center tw:gap-2">
            <span className={cn('tw:rounded-full tw:px-2.5 tw:py-0.5 tw:text-xs tw:font-bold', upcoming ? 'tw:bg-ok/20 tw:text-ok' : 'tw:bg-accent/20 tw:text-accent')}>{group.parts.length}</span>
            <ChevronDown className={cn('tw:size-4 tw:text-dim tw:transition-transform', open && 'tw:rotate-180')} aria-hidden="true" />
          </span>
        </button>
        {canManage && group.date && (
          <button type="button" aria-label={`إضافة فقرة تانية في ${formatDateHeader(group.date)}`} onClick={onAdd} className={cn('tw:me-2 tw:ms-1 tw:flex tw:size-10 tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-full tw:border', upcoming ? 'tw:border-ok/40 tw:text-ok' : 'tw:border-accent/40 tw:text-accent')}>
            <Plus className="tw:size-5" aria-hidden="true" />
          </button>
        )}
      </div>
      {open && (
        <ul className="tw:flex tw:flex-col tw:gap-2 tw:px-4 tw:pt-1 tw:pb-3.5">
          {group.parts.map((p) => (
            <PartRow key={p.id} part={p} upcoming={upcoming} canManage={canManage} busy={busyId === p.id} onEdit={() => onEdit(p)} onDelete={() => onDelete(p)} />
          ))}
        </ul>
      )}
    </li>
  );
};
