import type { FC, ReactNode } from 'react';
import { cn } from '@/react/lib/utils';

type FieldProps = {
  label: ReactNode;
  error?: string;
  /** the control; it goes inside the label, so clicking the label focuses it */
  children: ReactNode;
  className?: string;
};

/** A label above a control, with the field's error message under it. */
export const Field: FC<FieldProps> = ({ label, error, children, className }) => {
  return (
    <label className={cn('tw:flex tw:flex-col tw:gap-2 tw:text-sm tw:font-semibold tw:text-dim', className)}>
      {label}
      {children}
      {error && <span role="alert" className="tw:text-xs tw:font-normal tw:text-bad">{error}</span>}
    </label>
  );
};
