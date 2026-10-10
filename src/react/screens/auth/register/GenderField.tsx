import type { FC } from 'react';
import { genderOfSection } from '@/core/access-config';
import { SECTION, changeRegGender } from '@/core/section';
import { Field } from '@/react/components/ui/field';
import { inputClass } from '@/react/components/ui/input';
import type { Section } from '@/types/access';

/**
 * "النوع": male servant (boys' section) or female (girls'). It is not a form value: choosing the other one hands over to the old
 * code, which switches this device to that section and reloads the page (the classes and names below depend on the section).
 */
export const GenderField: FC = () => {
  return (
    <Field label="النوع *">
      <select className={inputClass} defaultValue={genderOfSection(SECTION as Section)} onChange={(e) => changeRegGender(e.target.value === 'female' ? 'female' : 'male')}>
        <option value="male">خادم</option>
        <option value="female">خادمه</option>
      </select>
    </Field>
  );
};
