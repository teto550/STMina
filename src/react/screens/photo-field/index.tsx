import { useState, type FC } from 'react';
import { PhotoManager } from '@/react/components/photo/photo-manager';
import { Avatar } from '@/react/components/ui/avatar';

export type PhotoFieldProps = {
  /** the photo the form starts with ('' = none) */
  photo?: string;
  /** called with the photo whenever it changes ('' = deleted); the form saves it with the rest of its data */
  onChange: (photo: string) => void;
};

/** The photo of the "add kid" / "edit kid" forms: the same photo manager as everywhere, but it only reports the photo to the form. */
const PhotoField: FC<PhotoFieldProps> = ({ photo = '', onChange }) => {
  const [value, setValue] = useState(photo);
  const [open, setOpen] = useState(false);
  const set = async (next: string) => {
    setValue(next);
    onChange(next);
  };
  return (
    <div className="tw:flex tw:items-center tw:gap-3">
      <Avatar name="" label="صورة المخدوم" src={value} size={72} onClick={() => setOpen(true)} />
      <span className="tw:text-xs tw:text-dim">{value ? 'اضغط على الصورة لعرضها أو تغييرها' : 'اضغط لإضافة صورة'}</span>
      {open && <PhotoManager name="صورة المخدوم" photo={value} editable onSave={set} onRemove={() => set('')} onClose={() => setOpen(false)} />}
    </div>
  );
};

export default PhotoField;
