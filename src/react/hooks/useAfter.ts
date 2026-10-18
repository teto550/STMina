import { useEffect, useState } from 'react';

/** Becomes true when `active` has stayed true for `ms` milliseconds (and false again as soon as `active` is). For "this is taking too long". */
export function useAfter(ms: number, active: boolean): boolean {
  const [passed, setPassed] = useState(false);
  useEffect(() => {
    if (!active) { setPassed(false); return; }
    const timer = setTimeout(() => setPassed(true), ms);
    return () => clearTimeout(timer);
  }, [ms, active]);
  return active && passed;
}
