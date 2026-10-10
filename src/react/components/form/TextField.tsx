import type { FC, InputHTMLAttributes } from 'react';
import { useFormContext } from 'react-hook-form';
import { Field } from '@/react/components/ui/field';
import { Input } from '@/react/components/ui/input';

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'name'> & {
  name: string;
  label: string;
};

/** A text input wired to the surrounding react-hook-form (`<FormProvider>`): label, field, and its validation message. */
export const TextField: FC<TextFieldProps> = ({ name, label, ...inputProps }) => {
  const { register, formState: { errors } } = useFormContext();
  return (
    <Field label={label} error={errors[name]?.message as string | undefined}>
      <Input {...inputProps} {...register(name)} />
    </Field>
  );
};
