import type { FC } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/react/lib/utils';

type SpinnerProps = {
  /** says what is loading ("جاري تحميل الأسماء…"); also the accessible name */
  label?: string;
  className?: string;
};

/** A visible loader: a turning circle, with the label next to it when there is one. Announced politely to screen readers. */
export const Spinner: FC<SpinnerProps> = ({ label, className }) => {
  return (
    <span role="status" aria-label={label ?? 'جاري التحميل'} className={cn('tw:inline-flex tw:items-center tw:gap-2 tw:text-sm tw:text-dim', className)}>
      <LoaderCircle className="tw:size-4 tw:animate-spin" aria-hidden="true" />
      {label && <span>{label}</span>}
    </span>
  );
};
