import type { FC } from 'react';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/react/lib/utils';

type ClassListProps = {
  grades: string[];
  /** the class that was open last: marked so it is easy to find again */
  activeGrade?: string | null;
  onOpen: (grade: string) => void;
  onBack: () => void;
};

/** Every class the person may open. Picking one opens that class with its own tabs. */
export const ClassList: FC<ClassListProps> = ({ grades, activeGrade, onOpen, onBack }) => {
  return (
    <section aria-label="الفصول" className="tw:flex tw:flex-col tw:gap-3">
      <div className="tw:flex tw:items-center tw:gap-3">
        <button type="button" onClick={onBack} aria-label="رجوع" className="tw:flex tw:size-11 tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-field tw:border tw:border-line tw:bg-surface-2 tw:text-fg">
          <ArrowRight className="tw:size-5" aria-hidden="true" />
        </button>
        <h1 className="tw:text-lg tw:font-black">🏫 الفصول</h1>
      </div>
      {grades.length === 0 ? (
        <p className="tw:rounded-card tw:border tw:border-line tw:bg-surface tw:p-5 tw:text-center tw:text-sm tw:text-dim">مفيش فصول متاحة ليك</p>
      ) : (
        <ul className="tw:flex tw:flex-col tw:gap-2">
          {grades.map((grade) => (
            <li key={grade}>
              <button
                type="button"
                onClick={() => onOpen(grade)}
                aria-current={grade === activeGrade ? 'true' : undefined}
                className={cn(
                  'tw:flex tw:min-h-14 tw:w-full tw:cursor-pointer tw:items-center tw:gap-3 tw:rounded-card tw:border tw:bg-surface tw:px-4 tw:py-3 tw:text-start tw:text-fg tw:transition-colors tw:hover:border-accent',
                  grade === activeGrade ? 'tw:border-accent' : 'tw:border-line'
                )}
              >
                <span className="tw:text-2xl" aria-hidden="true">📚</span>
                <span className="tw:min-w-0 tw:flex-1 tw:text-base tw:font-bold">{grade}</span>
                {grade === activeGrade && <span className="tw:rounded-full tw:bg-accent/15 tw:px-2 tw:py-0.5 tw:text-[11px] tw:font-bold tw:text-accent">آخر فصل</span>}
                <ChevronLeft className="tw:size-5 tw:shrink-0 tw:text-dim" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
