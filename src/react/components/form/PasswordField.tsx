import type { FC, InputHTMLAttributes } from 'react';
import { useFormContext } from 'react-hook-form';
import { Field } from '@/react/components/ui/field';
import { PasswordInput } from '@/react/components/ui/password-input';

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'type'> & {
  name: string;
  label: string;
};

/** A password input (with the show/hide eye) wired to the surrounding react-hook-form. */
export const PasswordField: FC<PasswordFieldProps> = ({ name, label, ...inputProps }) => {
  const { register, formState: { errors } } = useFormContext();
  return (
    <Field label={label} error={errors[name]?.message as string | undefined}>
      <PasswordInput {...inputProps} {...register(name)} />
    </Field>
  );
};
