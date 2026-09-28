import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge that understands our `tw:` prefix, so later classes correctly replace earlier conflicting ones
const twMerge = extendTailwindMerge({ prefix: 'tw' });

/** Join class names and resolve Tailwind conflicts: cn('tw:p-2', cond && 'tw:p-4') -> 'tw:p-4' */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
