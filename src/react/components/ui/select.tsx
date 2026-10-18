import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { inputClass } from '@/react/components/ui/input';
import { cn } from '@/react/lib/utils';

// A dropdown styled like the text fields, with the app's own arrow instead of the browser's: the arrow has room on its side
// (padding at the end of the line) so the text never touches it. Use it for every <select> of the React screens.
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <span className="tw:relative tw:block">
      <select ref={ref} className={cn(inputClass, 'tw:cursor-pointer tw:appearance-none tw:pe-11', className)} {...props}>
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="tw:pointer-events-none tw:absolute tw:end-4 tw:top-1/2 tw:size-4 tw:-translate-y-1/2 tw:text-dim" />
    </span>
  ),
);
Select.displayName = 'Select';
