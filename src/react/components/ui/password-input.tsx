import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/react/lib/utils';
import { Input } from './input';

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** accessible names of the eye button (Arabic by default) */
  showLabel?: string;
  hideLabel?: string;
}

/**
 * A password field with an eye button that shows or hides what was typed.
 * It is a normal input underneath (forwards its ref and all props), so it works with react-hook-form's `register`.
 * The wrapper is left-to-right, like a password: the eye sits at the end (right) and the text never runs under it.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showLabel = 'إظهار كلمة المرور', hideLabel = 'إخفاء كلمة المرور', disabled, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div dir="ltr" className="tw:relative">
        <Input ref={ref} dir="ltr" disabled={disabled} {...props} type={visible ? 'text' : 'password'} className={cn('tw:pe-11', className)} />
        <button
          type="button"
          disabled={disabled}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
          className="tw:absolute tw:inset-y-0 tw:end-0 tw:flex tw:w-11 tw:cursor-pointer tw:items-center tw:justify-center tw:text-dim tw:hover:text-fg tw:disabled:opacity-50"
        >
          {visible ? <EyeOff className="tw:size-5" aria-hidden="true" /> : <Eye className="tw:size-5" aria-hidden="true" />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';
