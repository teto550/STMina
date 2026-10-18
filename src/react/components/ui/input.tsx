import * as React from 'react';
import { cn } from '@/react/lib/utils';

// The text field of the React screens: dark surface, the app's border and radius, 44px high (a good touch target).
// `inputClass` is exported for the places that style a <select> or <textarea> the same way.
export const inputClass = 'tw:h-11 tw:w-full tw:rounded-field tw:border tw:border-line tw:bg-surface-2 tw:px-3 tw:text-sm tw:text-fg';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(inputClass, className)} {...props} />
);
Input.displayName = 'Input';
