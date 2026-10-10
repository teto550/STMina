import type { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { TextField } from '@/react/components/form/TextField';
import { PhoneListField } from '@/react/components/phone-list-field';
import { Field } from '@/react/components/ui/field';
import type { RegisterValues } from '@/schemas/auth';

/** Email, phone numbers, address and birth date. */
export const ContactFields: FC = () => {
  const { control, register, formState: { errors } } = useFormContext<RegisterValues>();
  return (
    <>
      <TextField name="email" label="البريد الإلكتروني *" type="email" dir="ltr" placeholder="example@gmail.com" autoComplete="email" />
      <Field label="رقم التليفون *" error={errors.phones?.message ?? errors.phones?.root?.message}>
        <PhoneListField control={control} register={register} />
      </Field>
      <TextField name="address" label="العنوان" placeholder="العنوان بالتفصيل" autoComplete="street-address" />
      <TextField name="dob" label="تاريخ الميلاد" type="date" />
    </>
  );
};
