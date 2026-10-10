import type { FC, ReactNode } from 'react';
import { cn } from '@/react/lib/utils';

type CheckRowProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
  hint?: string;
};

/** Big touch-friendly checkbox row. */
export const CheckRow: FC<CheckRowProps> = ({ checked, onChange, disabled, children, hint }) => {
  return (
    <label className={cn('tw:flex tw:min-h-12 tw:cursor-pointer tw:items-center tw:gap-3 tw:rounded-field tw:px-3 tw:py-2 tw:hover:bg-surface-2', disabled && 'tw:cursor-not-allowed tw:opacity-50')}>
      <input type="checkbox" className="tw:size-5 tw:shrink-0 tw:accent-accent" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="tw:min-w-0 tw:flex-1">{children}{hint && <span className="tw:block tw:text-xs tw:text-dim">{hint}</span>}</span>
    </label>
  );
};
