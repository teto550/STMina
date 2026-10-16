import { useEffect, useState, type FC } from 'react';
import { User } from 'lucide-react';
import { cn } from '@/react/lib/utils';

type AvatarProps = {
  /** the person's name (the initials come from it, and it is the accessible name); empty = a person icon */
  name: string;
  /** the photo (a data URL or a link); without it, or when it fails to load, the initials show */
  src?: string | null;
  /** width and height in pixels */
  size?: number;
  /** a solid accent background for the initials, for headers */
  accent?: boolean;
  /** makes the avatar a button; the owner decides what happens (PhotoManager: see / change the photo) */
  onClick?: () => void;
  /** the accessible name when `name` is empty */
  label?: string;
  className?: string;
};

/**
 * Arabic names: the first letter of the name ("مينا باسم" -> "م"; two Arabic letters side by side read as one odd word).
 * Latin names: the first letters of the first two words ("Mina Bassem" -> "MB"). "؟" when empty.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (!first) {
    return '؟';
  }
  if (/[؀-ۿ]/.test(first)) {
    return Array.from(first)[0] ?? '؟';
  }
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toUpperCase();
}

/** A person's picture, or their initials (or a person icon) when there is none. The ONE avatar of the app: kids and servants, lists and profiles. */
export const Avatar: FC<AvatarProps> = ({ name, src, size = 42, accent = false, onClick, label = 'الصورة', className }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  const showPhoto = !!src && !failed;
  const nameless = name.trim() === '';
  const accessibleName = nameless ? label : name;
  const box = cn(
    'tw:relative tw:inline-flex tw:shrink-0 tw:items-center tw:justify-center tw:overflow-hidden tw:border-0 tw:p-0 tw:font-bold',
    accent ? 'tw:bg-linear-to-br tw:from-accent tw:to-accent-2 tw:text-white' : 'tw:bg-surface-2 tw:text-accent',
    onClick && 'tw:cursor-pointer',
    className,
  );
  const style = { width: size, height: size, borderRadius: Math.round(size * 0.28), fontSize: Math.round(size * (showPhoto ? 0.42 : 0.4)) };
  let content;
  if (showPhoto) {
    content = <img src={src} alt={accessibleName} className="tw:size-full tw:object-cover" onError={() => setFailed(true)} />;
  } else if (nameless) {
    content = <User style={{ width: size * 0.5, height: size * 0.5 }} aria-hidden="true" />;
  } else {
    content = <span aria-hidden="true">{initialsOf(name)}</span>;
  }
  if (onClick) {
    return (
      <button type="button" aria-label={accessibleName} className={box} style={style} onClick={onClick}>
        {content}
      </button>
    );
  }
  return (
    <span role={showPhoto ? undefined : 'img'} aria-label={showPhoto ? undefined : accessibleName} className={box} style={style}>
      {content}
    </span>
  );
};
