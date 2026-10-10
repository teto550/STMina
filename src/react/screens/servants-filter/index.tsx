import type { FC } from 'react';
import { ClassFilter } from '@/react/components/class-filter';

export type ServantsFilterProps = {
  grades: string[];
  value: string;
  onChange: (grade: string) => void;
};

/** The class filter above the servants screens (attendance and servants list), embedded in the old page. */
const ServantsFilter: FC<ServantsFilterProps> = ({ grades, value, onChange }) => {
  return <ClassFilter grades={grades} value={value} onChange={onChange} />;
};

export default ServantsFilter;
