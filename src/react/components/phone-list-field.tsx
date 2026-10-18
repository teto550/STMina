import type { Control, FieldValues, Path, UseFormRegister } from 'react-hook-form';
import { useFieldArray } from 'react-hook-form';
import { Button } from '@/react/components/ui/button';
import { inputClass } from '@/react/components/ui/input';
import type { PhoneItem } from '@/schemas/common';

/** The form value shape of a list of phone numbers: `{ phones: [{ value: '01...' }] }`. */
export type PhoneValues = { phones: PhoneItem[] };

type PhoneListFieldProps<F extends FieldValues & PhoneValues> = {
  control: Control<F>;
  register: UseFormRegister<F>;
};

/**
 * Several phone numbers with "add another" and a remove button (shown only when there is more than one).
 * Shared by the registration form and the edit-servant screen. `F` is the form's value type; it must contain `phones`.
 */
export const PhoneListField = <F extends FieldValues & PhoneValues>({ control, register }: PhoneListFieldProps<F>) => {
  const phones = useFieldArray({ control: control as unknown as Control<PhoneValues>, name: 'phones' });
  const reg = register as unknown as UseFormRegister<PhoneValues>;
  return (
    <div className="tw:flex tw:flex-col tw:gap-2">
      {phones.fields.map((f, i) => (
        <div key={f.id} className="tw:flex tw:gap-2">
          <input className={inputClass} type="tel" dir="ltr" placeholder="01xxxxxxxxx" autoComplete="tel" aria-label={`رقم التليفون ${i + 1}`} {...reg(`phones.${i}.value` as Path<PhoneValues>)} />
          {phones.fields.length > 1 && <Button type="button" variant="outline" size="icon" aria-label={`شيل رقم ${i + 1}`} onClick={() => phones.remove(i)}>✕</Button>}
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={() => phones.append({ value: '' })}>+ إضافة رقم تليفون تاني</Button>
    </div>
  );
};
