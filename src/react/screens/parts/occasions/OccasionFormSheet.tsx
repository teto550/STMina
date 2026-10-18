import { useState, type FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert } from '@/react/components/ui/alert';
import { Button } from '@/react/components/ui/button';
import { inputClass } from '@/react/components/ui/input';
import { Sheet } from '@/react/components/ui/sheet';
import { occasionSchema, type OccasionValues } from '@/schemas/occasions';

type OccasionFormSheetProps = {
  mode: 'add' | 'edit';
  initial: OccasionValues;
  /** saves; rejects when it cannot */
  onSave: (values: OccasionValues) => Promise<void>;
  onClose: () => void;
};

/** Add or edit an occasion (an admin): a name and a day. Enter on the phone keyboard saves. */
export const OccasionFormSheet: FC<OccasionFormSheetProps> = ({ mode, initial, onSave, onClose }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<OccasionValues>({ resolver: zodResolver(occasionSchema), defaultValues: initial });
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = handleSubmit(async (values) => {
    setProblem(null);
    setBusy(true);
    try {
      await onSave({ title: values.title.trim(), date: values.date });
      onClose();
    } catch (e) {
      console.warn(e);
      setProblem('مقدرناش نحفظ المناسبة، جرّب تاني');
    } finally {
      setBusy(false);
    }
  });
  return (
    <Sheet title={mode === 'edit' ? 'تعديل المناسبة' : 'إضافة مناسبة'} onClose={onClose} footer={<Button type="submit" form="occasion-form" className="tw:w-full" disabled={busy}>{busy ? 'جاري الحفظ…' : '💾 حفظ'}</Button>}>
      <form id="occasion-form" className="tw:flex tw:flex-col tw:gap-3" onSubmit={submit} noValidate>
        <label className="tw:flex tw:flex-col tw:gap-1 tw:text-sm tw:font-bold">اسم المناسبة *
          <input className={inputClass} placeholder="مثلاً: عيد الميلاد، صوم الميلاد" autoFocus={mode === 'add'} autoComplete="off" enterKeyHint="done" {...register('title')} />
          {errors.title && <span className="tw:text-xs tw:font-normal tw:text-bad">{errors.title.message}</span>}
        </label>
        <label className="tw:flex tw:flex-col tw:gap-1 tw:text-sm tw:font-bold">التاريخ *
          <input className={inputClass} type="date" {...register('date')} />
          {errors.date && <span className="tw:text-xs tw:font-normal tw:text-bad">{errors.date.message}</span>}
        </label>
        {problem && <Alert onDismiss={() => setProblem(null)}>{problem}</Alert>}
      </form>
    </Sheet>
  );
};
