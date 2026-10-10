import type { FC } from 'react';
import { cn } from '@/react/lib/utils';

type SwitchCardProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  hint?: string;
};

/** A labelled on/off switch in a card (a real checkbox with role="switch" underneath). */
export const SwitchCard: FC<SwitchCardProps> = ({ checked, onChange, title, hint }) => {
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
};
