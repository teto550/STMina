import { useEffect, type ReactNode } from 'react';
import { cn } from '@/react/lib/utils';
import type { Cell } from '@/types/access';
import { parseCell } from '@/core/access-config';

// Small building blocks of the admin screens (mobile first, RTL safe, app colour tokens).

export function Chip({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'girls' | 'boys' | 'admin' }) {
  return (
    <span className={cn('tw:inline-flex tw:items-center tw:rounded-full tw:border tw:px-2.5 tw:py-0.5 tw:text-xs tw:font-bold tw:whitespace-nowrap',
      tone === 'plain' && 'tw:border-line tw:bg-surface-2 tw:text-dim',
      tone === 'girls' && 'tw:border-accent tw:bg-surface-2 tw:text-accent',
      tone === 'boys' && 'tw:border-line tw:bg-surface-2 tw:text-fg',
      tone === 'admin' && 'tw:border-warn tw:bg-surface-2 tw:text-warn')}>
      {children}
    </span>
  );
}

const GRADE_NAMES = ['', 'أولى', 'تانية', 'تالتة', 'رابعة', 'خامسة', 'سادسة'];

/** "3 بنين", "1 و2 بنات وأولاد"... */
export function cellLabel(cell: Cell): string {
  const { gender, grade } = parseCell(cell);
  return `${GRADE_NAMES[grade]} ${gender === 'female' ? 'بنات' : 'بنين'}`;
}

export function CellChips({ cells }: { cells: Cell[] }) {
  return <>{cells.map((c) => <Chip key={c} tone={parseCell(c).gender === 'female' ? 'girls' : 'boys'}>{cellLabel(c)}</Chip>)}</>;
}

/** Big touch-friendly checkbox row. */
export function CheckRow({ checked, onChange, disabled, children, hint }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; children: ReactNode; hint?: string }) {
  return (
    <label className={cn('tw:flex tw:min-h-12 tw:cursor-pointer tw:items-center tw:gap-3 tw:rounded-field tw:px-3 tw:py-2 tw:hover:bg-surface-2', disabled && 'tw:cursor-not-allowed tw:opacity-50')}>
      <input type="checkbox" className="tw:size-5 tw:shrink-0 tw:accent-accent" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="tw:min-w-0 tw:flex-1">{children}{hint && <span className="tw:block tw:text-xs tw:text-dim">{hint}</span>}</span>
    </label>
  );
}

/** Full-height sheet on a phone, centred dialog on a wide screen. */
export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="tw:fixed tw:inset-0 tw:z-[10010] tw:flex tw:items-end tw:justify-center tw:bg-black/60 tw:md:items-center" onClick={onClose}>
      <div role="dialog" aria-label={title} className="tw:flex tw:max-h-[92dvh] tw:w-full tw:max-w-lg tw:flex-col tw:rounded-t-card tw:border tw:border-line tw:bg-surface tw:md:rounded-card" onClick={(e) => e.stopPropagation()}>
        <div className="tw:flex tw:items-center tw:justify-between tw:border-b tw:border-line tw:px-4 tw:py-3">
          <h2 className="tw:text-base tw:font-bold">{title}</h2>
          <button type="button" aria-label="إغلاق" className="tw:size-10 tw:cursor-pointer tw:text-xl tw:text-dim" onClick={onClose}>✕</button>
        </div>
        <div className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:p-3">{children}</div>
        {footer && <div className="tw:border-t tw:border-line tw:p-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="group" aria-label={label} className="tw:flex tw:rounded-field tw:border tw:border-line tw:bg-surface-2 tw:p-1">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
          className={cn('tw:min-h-10 tw:flex-1 tw:cursor-pointer tw:rounded-field tw:px-3 tw:text-sm tw:font-bold', value === o.value ? 'tw:bg-accent tw:text-white' : 'tw:text-dim')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const inputClass = 'tw:h-11 tw:w-full tw:rounded-field tw:border tw:border-line tw:bg-surface-2 tw:px-3 tw:text-sm tw:text-fg';

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

/** A labelled on/off switch in a card (a real checkbox with role="switch" underneath). */
export function SwitchCard({ checked, onChange, title, hint }: { checked: boolean; onChange: (v: boolean) => void; title: string; hint?: string }) {
  return (
    <label className="tw:flex tw:min-h-20 tw:cursor-pointer tw:items-center tw:justify-between tw:gap-4 tw:rounded-card tw:border tw:border-line tw:bg-surface tw:p-5">
      <span className="tw:min-w-0">
        <span className="tw:block tw:text-sm tw:font-bold">{title}</span>
        {hint && <span className="tw:mt-1 tw:block tw:text-xs tw:text-dim">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className="tw:peer tw:sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden="true" className={cn('tw:relative tw:h-7 tw:w-12 tw:shrink-0 tw:rounded-full tw:border tw:border-line tw:transition-colors tw:peer-focus-visible:ring-2 tw:peer-focus-visible:ring-accent', checked ? 'tw:bg-accent' : 'tw:bg-surface-2')}>
        <span className={cn('tw:absolute tw:top-0.5 tw:size-6 tw:rounded-full tw:bg-white tw:transition-all', checked ? 'tw:end-0.5' : 'tw:start-0.5')} />
      </span>
    </label>
  );
}
