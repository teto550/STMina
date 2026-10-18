import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/react/lib/utils';

// A message box for a form or a screen: errors, confirmations, warnings, hints. Use it anywhere instead of a loose red <p>.
//
//   <Alert>حصل خطأ</Alert>                                              error (the default), announced to screen readers at once
//   <Alert tone="success" title="تم">اتحفظ الدور</Alert>                  the other tones are announced politely
//   <Alert onDismiss={() => setError(null)}>…</Alert>                   adds a close button; the parent decides what closing means
//   <Alert tone="info" autoDismissMs={4000} onDismiss={clear}>…</Alert>  closes itself (calls onDismiss) after 4 seconds
//   <Alert action={<Button size="sm" onClick={retry}>حاول تاني</Button>}>…</Alert>   a button under the message (retry, undo, ...)
//
// It does not hold state: show it while you have a message, and drop the message in `onDismiss`. Give it a `key` when a NEW
// message should restart the auto-dismiss timer.
const alertVariants = cva('tw:flex tw:items-start tw:gap-3 tw:rounded-card tw:border tw:bg-surface-2 tw:p-3 tw:text-sm tw:leading-relaxed', {
  variants: {
    tone: {
      error: 'tw:border-bad tw:text-bad',
      success: 'tw:border-ok tw:text-ok',
      warning: 'tw:border-warn tw:text-warn',
      info: 'tw:border-accent tw:text-accent',
    },
  },
  defaultVariants: { tone: 'error' },
});

export type AlertTone = NonNullable<VariantProps<typeof alertVariants>['tone']>;

const defaultIcons: Record<AlertTone, React.ElementType> = { error: CircleAlert, success: CircleCheck, warning: TriangleAlert, info: Info };

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: AlertTone;
  title?: React.ReactNode;
  /** replaces the tone's icon; `false` shows none */
  icon?: React.ReactNode | false;
  /** shows a close button and is called when it is pressed (or when `autoDismissMs` has passed) */
  onDismiss?: () => void;
  /** accessible name of the close button */
  dismissLabel?: string;
  autoDismissMs?: number;
  /** something to do about it, shown under the message (usually a retry button) */
  action?: React.ReactNode;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ tone = 'error', title, icon, action, onDismiss, dismissLabel = 'إغلاق', autoDismissMs, className, children, role, ...props }, ref) => {
    const latest = React.useRef(onDismiss);
    latest.current = onDismiss;
    React.useEffect(() => {
      if (!autoDismissMs) {
        return;
      }
      const timer = setTimeout(() => latest.current?.(), autoDismissMs);
      return () => clearTimeout(timer);
    }, [autoDismissMs]);

    const Icon = defaultIcons[tone];
    return (
      <div ref={ref} role={role ?? (tone === 'error' ? 'alert' : 'status')} className={cn(alertVariants({ tone }), className)} {...props}>
        {icon !== false && <span className="tw:mt-0.5 tw:shrink-0" aria-hidden="true">{icon ?? <Icon className="tw:size-4" />}</span>}
        <div className="tw:min-w-0 tw:flex-1">
          {title && <div className="tw:font-bold">{title}</div>}
          <div className={cn(title && 'tw:text-fg')}>{children}</div>
          {action && <div className="tw:mt-2">{action}</div>}
        </div>
        {onDismiss && (
          <button type="button" aria-label={dismissLabel} onClick={onDismiss}
            className="tw:-m-1.5 tw:flex tw:size-8 tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-field tw:opacity-70 tw:hover:opacity-100">
            <X className="tw:size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }
);
Alert.displayName = 'Alert';
