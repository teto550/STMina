import type { FC, ReactNode } from 'react';
import { cn } from '@/react/lib/utils';

type ChipProps = {
  children: ReactNode;
  tone?: 'plain' | 'girls' | 'boys' | 'admin';
};

/** A small rounded label (a class, a role, a status). */
export const Chip: FC<ChipProps> = ({ children, tone = 'plain' }) => {
  return (
    <span className={cn('tw:inline-flex tw:items-center tw:rounded-full tw:border tw:px-2.5 tw:py-0.5 tw:text-xs tw:font-bold tw:whitespace-nowrap',
      tone === 'plain' && 'tw:border-line tw:bg-surface-2 tw:text-dim',
      tone === 'girls' && 'tw:border-accent tw:bg-surface-2 tw:text-accent',
      tone === 'boys' && 'tw:border-line tw:bg-surface-2 tw:text-fg',
      tone === 'admin' && 'tw:border-warn tw:bg-surface-2 tw:text-warn')}>
      {children}
    </span>
  );
};
