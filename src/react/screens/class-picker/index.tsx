import type { FC } from 'react';
import { Sheet } from '@/react/components/ui/sheet';
import { shortGrade } from '@/react/components/class-filter';
import { cn } from '@/react/lib/utils';
import type { ScreenProps } from '../registry';

export type ClassPickerProps = ScreenProps & {
  /** the classes the person may work in */
  grades: string[];
  /** the class that is open now (highlighted) */
  current: string;
  /** the chosen class, or null when the popup was closed without choosing */
  onPick: (grade: string | null) => void;
};

/** "اختار الفصل": asked before the dashboard options to people who work in more than one class. */
const ClassPicker: FC<ClassPickerProps> = ({ grades, current, onPick }) => {
  return (
    <Sheet title="اختار الفصل" onClose={() => onPick(null)}>
      <ul className="tw:grid tw:grid-cols-2 tw:gap-2">
        {grades.map((g) => (
          <li key={g}>
            <button
              type="button"
              aria-pressed={g === current}
              onClick={() => onPick(g)}
              className={cn(
                'tw:w-full tw:cursor-pointer tw:rounded-card tw:border tw:px-3 tw:py-4 tw:text-sm tw:font-bold',
                g === current ? 'tw:border-accent tw:bg-accent tw:text-white' : 'tw:border-line tw:bg-surface-2 tw:text-fg',
              )}
            >
              {shortGrade(g)}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
};

export default ClassPicker;
