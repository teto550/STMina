import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/react/lib/utils';

// shadcn/ui-style button, written with the `tw:` prefix and the app's colour tokens.
const buttonVariants = cva(
  'tw:inline-flex tw:items-center tw:justify-center tw:gap-2 tw:whitespace-nowrap tw:rounded-field tw:text-sm tw:font-bold tw:transition-opacity tw:disabled:opacity-50 tw:disabled:pointer-events-none tw:cursor-pointer',
  {
    variants: {
      variant: {
        default: 'tw:bg-linear-to-br tw:from-accent tw:to-accent-2 tw:text-white tw:hover:opacity-90',
        secondary: 'tw:bg-surface-2 tw:text-fg tw:border tw:border-line tw:hover:opacity-90',
        outline: 'tw:border tw:border-line tw:bg-transparent tw:text-fg tw:hover:bg-surface-2',
        destructive: 'tw:bg-bad tw:text-white tw:hover:opacity-90',
        ghost: 'tw:bg-transparent tw:text-fg tw:hover:bg-surface-2',
      },
      size: {
        default: 'tw:h-10 tw:px-4',
        sm: 'tw:h-8 tw:px-3 tw:text-xs',
        lg: 'tw:h-12 tw:px-6 tw:text-base',
        icon: 'tw:h-10 tw:w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  }
);
Button.displayName = 'Button';
