import type { ReactNode } from 'react';
import { parseCell } from '@/core/access-config';
import { Chip } from '@/react/components/ui/chip';
import { cn } from '@/react/lib/utils';
import type { Cell } from '@/types/access';

const GRADE_NAMES = ['', 'أولى', 'تانية', 'تالتة', 'رابعة', 'خامسة', 'سادسة'];

/** "3 أولاد", "1 و2 بنات وأولاد"... */
export function cellLabel(cell: Cell): string {
  const { gender, grade } = parseCell(cell);
  return `${GRADE_NAMES[grade]} ${gender === 'female' ? 'بنات' : 'أولاد'}`;
}

export function CellChips({ cells }: { cells: Cell[] }) {
  return <>{cells.map((c) => <Chip key={c} tone={parseCell(c).gender === 'female' ? 'girls' : 'boys'}>{cellLabel(c)}</Chip>)}</>;
}

/** A big pill that toggles one class (a real checkbox underneath, so it works with keyboard and screen readers). */
export function CellToggle({ checked, onChange, label, tone, children }: { checked: boolean; onChange: (v: boolean) => void; label: string; tone: 'girls' | 'boys'; children: ReactNode }) {
  return (
    <label className="tw:block tw:cursor-pointer">
      <input type="checkbox" className="tw:peer tw:sr-only" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={cn('tw:flex tw:min-h-11 tw:items-center tw:justify-center tw:gap-1 tw:rounded-field tw:border tw:text-sm tw:font-bold tw:transition-colors tw:peer-focus-visible:ring-2 tw:peer-focus-visible:ring-accent',
        checked ? (tone === 'girls' ? 'tw:border-accent tw:bg-accent tw:text-white' : 'tw:border-fg tw:bg-fg tw:text-bg') : 'tw:border-line tw:bg-surface-2 tw:text-dim')}>
        {checked && <span aria-hidden="true">✓</span>}{children}
      </span>
    </label>
  );
}
