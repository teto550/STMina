import { cn } from '@/react/lib/utils';

type SegmentedProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  /** the accessible name of the group */
  label: string;
};

/** A row of buttons of which exactly one is selected (the tab buttons). Put the selected tab's content in a react-if <Switch>. */
export const Segmented = <T extends string>({ value, onChange, options, label }: SegmentedProps<T>) => {
  return (
    <div role="group" aria-label={label} className="tw:flex tw:rounded-field tw:border tw:border-line tw:bg-surface-2 tw:p-1">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
          className={cn('tw:min-h-10 tw:flex-1 tw:cursor-pointer tw:rounded-field tw:px-3 tw:text-sm tw:font-bold', value === o.value ? 'tw:bg-accent tw:text-white' : 'tw:text-dim')}>
          {o.label}
        </button>
      ))}
    </div>
  );
};
