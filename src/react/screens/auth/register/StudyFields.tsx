import type { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { When } from 'react-if';
import { EGYPT_UNIVERSITIES } from '@/core/universities';
import { SelectField } from '@/react/components/form/SelectField';
import { TextField } from '@/react/components/form/TextField';
import type { RegisterValues } from '@/schemas/auth';

/** Study status; a student also gives their college and university. */
export const StudyFields: FC = () => {
  const { watch } = useFormContext<RegisterValues>();
  return (
    <>
      <SelectField name="status" label="الحالة الدراسية *" options={[{ value: 'student', label: 'لسه بيدرس' }, { value: 'graduated', label: 'متخرج' }]} />
      <When condition={watch('status') === 'student'}>
        <TextField name="college" label="الكلية" placeholder="مثلاً: كلية الهندسة" />
        <SelectField name="university" label="الجامعة" placeholder="اختر الجامعة" options={EGYPT_UNIVERSITIES.map((u) => ({ value: u }))} />
      </When>
    </>
  );
};
