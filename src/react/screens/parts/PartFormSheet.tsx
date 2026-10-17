import { useEffect, useRef, useState, type FC, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert } from '@/react/components/ui/alert';
import { Button } from '@/react/components/ui/button';
import { inputClass } from '@/react/components/ui/input';
import { Select } from '@/react/components/ui/select';
import { Sheet } from '@/react/components/ui/sheet';
import { PART_TYPES, partSchema, type PartValues } from '@/schemas/parts';
import { weekdayOf } from './logic';

type PartFormSheetProps = {
  /** adding a part, or editing the given one */
  mode: 'add' | 'edit';
  initial: PartValues;
  /** the servants of this class (a servant already on the part is always offered) */
  servants: string[];
  /** saves; rejects when it cannot */
  onSave: (values: PartValues) => Promise<void>;
  onClose: () => void;
};

/**
 * Add or edit a part. Only the title and the day are required: the type and the servant can stay empty and be given later (edit).
 * While adding, "حفظ وفقرة تانية" saves and keeps the sheet open on the same day, to add the next part of that day.
 * Keyboard friendly: adding opens with the title focused; Enter on the keyboard saves (the same way as the button used last, so once "وفقرة تانية"
 * was used, Enter keeps adding parts to the day) and the title is focused again for the next part.
 */
export const PartFormSheet: FC<PartFormSheetProps> = ({ mode, initial, servants, onSave, onClose }) => {
  const { register, handleSubmit, reset, watch, setFocus, formState: { errors } } = useForm<PartValues>({ resolver: zodResolver(partSchema), defaultValues: initial });
  const [problem, setProblem] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refocus, setRefocus] = useState(0);
  const [busyButton, setBusyButton] = useState<'save' | 'another' | null>(null);
  const another = useRef(false); // which of the two save buttons was pressed (set before the form is submitted)
  const date = watch('date');
  const options = initial.deaconName && !servants.includes(initial.deaconName) ? [initial.deaconName, ...servants] : servants;

  useEffect(() => {
    setAdded(null);
  }, [date]);

  // adding: the keyboard comes up on the title; when the title is already known (a part made from an occasion) the day is what is missing
  useEffect(() => {
    if (mode === 'add') {
      setFocus(initial.title ? 'date' : 'title');
    }
    // only when the sheet opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // after "save and another" the form was reset: focus the title again once it has been drawn
  useEffect(() => {
    if (refocus > 0) {
      setFocus('title');
    }
  }, [refocus, setFocus]);

  const submit = handleSubmit(async (values) => {
    setProblem(null);
    setBusy(true);
    setBusyButton(another.current ? 'another' : 'save');
    try {
      await onSave(values);
      if (another.current) {
        // the next part of the same day: everything but the day is cleared
        reset({ title: '', date: values.date, type: '', deaconName: '' });
        setAdded(values.title.trim());
        setRefocus((n) => n + 1); // the keyboard stays open for the next title (focused once the form is drawn again)
      } else {
        onClose();
      }
    } catch (e) {
      console.warn(e);
      setProblem('مقدرناش نحفظ الفقرة، جرّب تاني');
    } finally {
      setBusy(false);
      setBusyButton(null);
    }
  });

  // Enter on the keyboard of a phone ("done"): saves the way the last save button was used. The browser's own Enter would press the first
  // footer button, which would forget that "وفقرة تانية" was chosen; typing with an Arabic keyboard (composing) is left alone.
  const saveOnEnter = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <Sheet
      title={mode === 'edit' ? 'تعديل الفقرة' : 'إضافة فقرة'}
      onClose={onClose}
      footer={
        <div className="tw:flex tw:gap-2">
          <Button type="submit" form="part-form" className="tw:flex-1" disabled={busy} onClick={() => { another.current = false; }}>{busyButton === 'save' ? 'جاري الحفظ…' : '💾 حفظ'}</Button>
          {mode === 'add' && (
            <Button type="submit" form="part-form" variant="secondary" className="tw:flex-1" disabled={busy} onClick={() => { another.current = true; }}>{busyButton === 'another' ? 'جاري الحفظ…' : '💾 حفظ وفقرة تانية'}</Button>
          )}
        </div>
      }
    >
      <form id="part-form" className="tw:flex tw:flex-col tw:gap-3" onSubmit={submit} onKeyDown={saveOnEnter} noValidate>
        {added && <Alert tone="success">اتضافت "{added}" ✓ — ضيف الفقرة اللي بعدها في نفس اليوم</Alert>}
        <label className="tw:flex tw:flex-col tw:gap-1 tw:text-sm tw:font-bold">تفاصيل الفقرة *
          <input className={inputClass} placeholder="مثلاً: اسم الترنيمة، أو موضوع الدرس" autoComplete="off" enterKeyHint="done" {...register('title')} />
          {errors.title && <span className="tw:text-xs tw:font-normal tw:text-bad">{errors.title.message}</span>}
        </label>
        <label className="tw:flex tw:flex-col tw:gap-1 tw:text-sm tw:font-bold">اليوم *
          <input className={inputClass} type="date" {...register('date')} />
          <span className="tw:text-xs tw:font-normal tw:text-dim">{date ? `📅 ${weekdayOf(date)} — أي يوم، مش لازم جمعة` : ''}</span>
          {errors.date && <span className="tw:text-xs tw:font-normal tw:text-bad">{errors.date.message}</span>}
        </label>
        <label className="tw:flex tw:flex-col tw:gap-1 tw:text-sm tw:font-bold">نوع الفقرة (اختياري)
          <Select {...register('type')}>
            <option value="">من غير نوع</option>
            {PART_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </label>
        <label className="tw:flex tw:flex-col tw:gap-1 tw:text-sm tw:font-bold">الخادم (اختياري)
          <Select {...register('deaconName')}>
            <option value="">من غير خادم لسه</option>
            {options.map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
          <span className="tw:text-xs tw:font-normal tw:text-dim">لما تختار خادم بياخد إشعار بالفقرة.</span>
        </label>
        {problem && <Alert onDismiss={() => setProblem(null)}>{problem}</Alert>}
      </form>
    </Sheet>
  );
};
