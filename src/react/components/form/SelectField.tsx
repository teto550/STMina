import type { FC, SelectHTMLAttributes } from 'react';
import { useFormContext } from 'react-hook-form';
import { Field } from '@/react/components/ui/field';
import { inputClass } from '@/react/components/ui/input';

export type SelectOption = {
  value: string;
  /** shown instead of the value */
  label?: string;
};

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'name' | 'onChange'> & {
  name: string;
  label: string;
  options: readonly SelectOption[];
  /** the first, empty option ("اختر ...") */
  placeholder?: string;
  /** runs when the choice changes (react-hook-form's own onChange still runs) */
  onChange?: () => void;
};

/** A dropdown wired to the surrounding react-hook-form. */
export const SelectField: FC<SelectFieldProps> = ({ name, label, options, placeholder, onChange, ...selectProps }) => {
  const { register, formState: { errors } } = useFormContext();
  return (
    <Field label={label} error={errors[name]?.message as string | undefined}>
      <select className={inputClass} {...selectProps} {...register(name, { onChange })}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label ?? o.value}</option>)}
      </select>
    </Field>
  );
};
