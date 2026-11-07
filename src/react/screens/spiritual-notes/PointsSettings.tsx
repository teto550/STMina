import { useState, type FC } from 'react';
import { notesErrorMessage } from '@/api/errors';
import { Alert } from '@/react/components/ui/alert';
import { Button } from '@/react/components/ui/button';
import { Field } from '@/react/components/ui/field';
import { Input } from '@/react/components/ui/input';
import { Sheet } from '@/react/components/ui/sheet';
import { useNotePoints, useSaveNotePoints } from '@/react/hooks/useSpiritualNotes';
import { DEFAULT_POINTS, isValidPoint, MAX_NOTE_POINT, NOTE_POINT_ITEMS, type NotePointKey, type NotePoints } from '@/core/notes-points';

type PointsSettingsProps = {
  /** the servant who saves (kept on the document) */
  by: string;
  onClose: () => void;
};

type Draft = Record<NotePointKey, string>;

const toDraft = (points: NotePoints): Draft => Object.fromEntries(NOTE_POINT_ITEMS.map((i) => [i.key, String(points[i.key])])) as Draft;

/** "5" -> 5; empty, a fraction, a negative or a huge number -> null (not a valid point). */
const parsePoint = (text: string): number | null => {
  const n = text.trim() === '' ? NaN : Number(text);
  return isValidPoint(n) ? n : null;
};

/**
 * "⚙️ نقاط النوتة": the admin sets how many points each thing is worth. A new value counts for every day (the old ones too), because the points are worked
 * out from what was ticked, not stored with each day.
 */
export const PointsSettings: FC<PointsSettingsProps> = ({ by, onClose }) => {
  const current = useNotePoints();
  const [draft, setDraft] = useState<Draft>(() => toDraft(current));
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const save = useSaveNotePoints();

  const parsed = NOTE_POINT_ITEMS.map((i) => ({ key: i.key, value: parsePoint(draft[i.key]) }));
  const invalid = parsed.some((p) => p.value === null);

  const edit = (key: NotePointKey, text: string) => {
    setDraft({ ...draft, [key]: text });
    setSaved(false);
  };

  const onSave = async () => {
    setProblem(null);
    const points = Object.fromEntries(parsed.map((p) => [p.key, p.value])) as NotePoints;
    try {
      await save.mutateAsync({ points, by });
      setSaved(true);
    } catch (e) {
      setProblem(notesErrorMessage(e));
    }
  };

  return (
    <Sheet
      title="⚙️ نقاط النوتة"
      onClose={onClose}
      footer={
        <div className="tw:flex tw:flex-col tw:gap-2">
          {saved && <p role="status" className="tw:text-center tw:text-sm tw:font-bold tw:text-ok">اتحفظ ✓</p>}
          <div className="tw:flex tw:gap-2">
            <Button className="tw:flex-1" size="lg" disabled={invalid} loading={save.isPending} onClick={() => void onSave()}>حفظ النقاط</Button>
            <Button size="lg" variant="secondary" onClick={() => { setDraft(toDraft(DEFAULT_POINTS)); setSaved(false); }}>الأصلية</Button>
          </div>
        </div>
      }
    >
      <div className="tw:flex tw:flex-col tw:gap-3">
        <p className="tw:text-xs tw:text-dim">اكتب عدد النقط لكل حاجة (من ٠ لـ {MAX_NOTE_POINT}). النقط الجديدة بتتحسب على كل الأيام، القديمة كمان.</p>
        {NOTE_POINT_ITEMS.map((item) => (
          <Field key={item.key} label={item.hint ? `${item.label} (${item.hint})` : item.label} error={parsePoint(draft[item.key]) === null ? `اكتب رقم صحيح من 0 لـ ${MAX_NOTE_POINT}` : undefined}>
            <Input type="number" inputMode="numeric" min={0} max={MAX_NOTE_POINT} step={1} value={draft[item.key]} onChange={(e) => edit(item.key, e.target.value)} />
          </Field>
        ))}
        {problem && <Alert onDismiss={() => setProblem(null)}>{problem}</Alert>}
      </div>
    </Sheet>
  );
};
