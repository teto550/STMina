import type { FC } from 'react';
import { cn } from '@/react/lib/utils';

type ClassFilterProps = {
  /** the classes to choose from, in display order */
  grades: string[];
  /** the chosen class, '' = all of them */
  value: string;
  onChange: (grade: string) => void;
};

/** "ابتدائي" is the same on every class, so the chip drops it. */
export const shortGrade = (grade: string): string => grade.replace(/\s*ابتدائي\s*$/, '');

/** A row of chips to filter a list by class: "الكل" and one chip per class. Scrolls sideways on a narrow phone. */
export const ClassFilter: FC<ClassFilterProps> = ({ grades, value, onChange }) => {
  const options = [{ key: '', label: 'الكل' }, ...grades.map((g) => ({ key: g, label: shortGrade(g) }))];
  return (
    <div role="group" aria-label="فلتر الفصل" className="tw:flex tw:gap-2 tw:overflow-x-auto tw:pb-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            'tw:shrink-0 tw:cursor-pointer tw:rounded-full tw:border tw:px-3.5 tw:py-1.5 tw:text-xs tw:font-bold tw:whitespace-nowrap',
            value === o.key ? 'tw:border-accent tw:bg-accent tw:text-white' : 'tw:border-line tw:bg-surface-2 tw:text-dim',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
};
