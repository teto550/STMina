import { useState, type FC } from 'react';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/react/lib/utils';
import { DAY_NAMES, DEFAULT_CLASS_EMOJI, type ClassSettings, type ServiceDay } from '@/core/class-settings';

type ClassListProps = {
  grades: string[];
  /** the class that was open last: marked so it is easy to find again */
  activeGrade?: string | null;
  /** emoji + attendance weekday of each class */
  settings?: ClassSettings;
  /** only admins edit the classes (the classes themselves are fixed: they can be edited, never deleted) */
  canEdit?: boolean;
  onSave?: (settings: ClassSettings) => Promise<void>;
  onOpen: (grade: string) => void;
  onBack: () => void;
};

const DAYS: ServiceDay[] = [4, 5];

/** Every class the person may open. Picking one opens that class with its own tabs; an admin can also edit the emoji and the attendance day. */
export const ClassList: FC<ClassListProps> = ({ grades, activeGrade, settings: initial = {}, canEdit = false, onSave, onOpen, onBack }) => {
  const [settings, setSettings] = useState<ClassSettings>(initial); // what the list shows; replaced by what was just saved
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ClassSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const startEdit = () => {
    setDraft(settings);
    setError('');
    setEditing(true);
  };

  const change = (grade: string, patch: { emoji?: string; serviceDay?: ServiceDay | undefined }) => {
    setDraft((d) => ({ ...d, [grade]: { ...d[grade], ...patch } }));
  };

  const save = async () => {
    if (!onSave) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(draft);
      setSettings(draft);
      setEditing(false);
    } catch {
      setError('حصل خطأ أثناء الحفظ، جرّب تاني');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-label="الفصول" className="tw:flex tw:flex-col tw:gap-3">
      <div className="tw:flex tw:items-center tw:gap-3">
        <button type="button" onClick={onBack} aria-label="رجوع" className="tw:flex tw:size-11 tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-field tw:border tw:border-line tw:bg-surface-2 tw:text-fg">
          <ArrowRight className="tw:size-5" aria-hidden="true" />
        </button>
        <h1 className="tw:min-w-0 tw:flex-1 tw:text-lg tw:font-black">🏫 الفصول</h1>
        {canEdit && onSave && (
          <button
            type="button"
            onClick={() => (editing ? setEditing(false) : startEdit())}
            aria-pressed={editing}
            className={cn('tw:cursor-pointer tw:rounded-field tw:border tw:px-4 tw:py-2 tw:text-sm tw:font-bold', editing ? 'tw:border-accent tw:bg-accent/15 tw:text-accent' : 'tw:border-line tw:bg-surface-2 tw:text-fg')}
          >
            ✏️ تعديل
          </button>
        )}
      </div>
      {editing && <p className="tw:text-center tw:text-xs tw:text-dim">الفصول ثابتة ومينفعش تتحذف. غيّر الإيموجي ويوم الحضور، وبعدين دوس حفظ. بعد تحديد اليوم، الحضور بيتسجل للفصل في يومه بس.</p>}
      {grades.length === 0 ? (
        <p className="tw:rounded-card tw:border tw:border-line tw:bg-surface tw:p-5 tw:text-center tw:text-sm tw:text-dim">مفيش فصول متاحة ليك</p>
      ) : editing ? (
        <div className="tw:flex tw:flex-col tw:gap-3">
          <ul className="tw:flex tw:flex-col tw:gap-2">
            {grades.map((grade) => {
              const current = draft[grade] || {};
              return (
                <li key={grade} className="tw:flex tw:flex-col tw:gap-2 tw:rounded-card tw:border tw:border-line tw:bg-surface tw:p-3">
                  <div className="tw:flex tw:items-center tw:gap-3">
                    <input
                      type="text"
                      value={current.emoji || ''}
                      placeholder={DEFAULT_CLASS_EMOJI}
                      maxLength={8}
                      aria-label={`إيموجي ${grade}`}
                      onChange={(e) => change(grade, { emoji: e.target.value })}
                      className="tw:size-12 tw:shrink-0 tw:rounded-field tw:border tw:border-line tw:bg-surface-2 tw:text-center tw:text-2xl tw:text-fg"
                    />
                    <span className="tw:min-w-0 tw:flex-1 tw:text-base tw:font-bold">{grade}</span>
                  </div>
                  <div className="tw:flex tw:items-center tw:gap-2">
                    <span className="tw:text-xs tw:text-dim">يوم الحضور:</span>
                    {DAYS.map((day) => (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={current.serviceDay === day}
                        onClick={() => change(grade, { serviceDay: current.serviceDay === day ? undefined : day })}
                        className={cn('tw:cursor-pointer tw:rounded-field tw:border tw:px-4 tw:py-1.5 tw:text-sm tw:font-bold', current.serviceDay === day ? 'tw:border-success tw:bg-success/15 tw:text-success' : 'tw:border-line tw:text-dim')}
                      >
                        {DAY_NAMES[day]}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
          {error && <p role="alert" className="tw:text-center tw:text-sm tw:text-danger">{error}</p>}
          <button type="button" onClick={save} disabled={saving} className="tw:cursor-pointer tw:rounded-field tw:bg-success tw:px-4 tw:py-3 tw:text-base tw:font-black tw:text-white tw:disabled:opacity-50">
            {saving ? 'جاري الحفظ…' : '💾 حفظ'}
          </button>
        </div>
      ) : (
        <ul className="tw:flex tw:flex-col tw:gap-2">
          {grades.map((grade) => {
            const setting = settings[grade] || {};
            return (
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
                  <span className="tw:text-2xl" aria-hidden="true">{setting.emoji || DEFAULT_CLASS_EMOJI}</span>
                  <span className="tw:min-w-0 tw:flex-1 tw:text-base tw:font-bold">{grade}</span>
                  {setting.serviceDay && <span className="tw:rounded-full tw:bg-success/15 tw:px-2 tw:py-0.5 tw:text-[11px] tw:font-bold tw:text-success">{DAY_NAMES[setting.serviceDay]}</span>}
                  {grade === activeGrade && <span className="tw:rounded-full tw:bg-accent/15 tw:px-2 tw:py-0.5 tw:text-[11px] tw:font-bold tw:text-accent">آخر فصل</span>}
                  <ChevronLeft className="tw:size-5 tw:shrink-0 tw:text-dim" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
