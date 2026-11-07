import { useMemo, useState, type FC } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/react/components/ui/button';
import { Input } from '@/react/components/ui/input';
import { NOTE_POINT_ITEMS } from '@/core/notes-points';
import { useNotePoints } from '@/react/hooks/useSpiritualNotes';
import { KidFile, type KidRef } from './KidFile';
import { PointsSettings } from './PointsSettings';
import { filterKids } from './logic';

export type SpiritualNotesProps = {
  /** the open class */
  grade: string;
  /** the kids of the open class */
  kids: KidRef[];
  /** may write the notes (a servant of the class, or an admin) */
  canEdit: boolean;
  /** the servant who writes */
  user: { name: string };
  /** may set the points of each thing (the admin): the "نقاط النوتة" button */
  canSetPoints?: boolean;
};

/**
 * "نوتة روحية": the kids of the open class with a search box; opening a kid opens his file, where the servant records, day by day, what he did
 * (prayers, gospel, mass, fasting, the month's confession). Nothing is read until a kid is opened: the names are already loaded by the app.
 */
const SpiritualNotesScreen: FC<SpiritualNotesProps> = ({ grade, kids, canEdit, user, canSetPoints = false }) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<KidRef | null>(null);
  const [settingPoints, setSettingPoints] = useState(false);
  const points = useNotePoints();
  const shown = useMemo(() => filterKids(kids, search), [kids, search]);

  if (open) {
    return <KidFile key={open.id} kid={open} canEdit={canEdit} by={user.name} onBack={() => setOpen(null)} />;
  }
  return (
    <section aria-label="نوتة روحية" className="tw:flex tw:flex-col tw:gap-3">
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
        <h2 className="tw:text-base tw:font-bold">📓 النوتة الروحية — {grade}</h2>
        {canSetPoints && <Button size="sm" variant="secondary" onClick={() => setSettingPoints(true)}>⚙️ نقاط النوتة</Button>}
      </div>
      <p className="tw:text-xs tw:text-dim" aria-label="نقاط كل حاجة">{NOTE_POINT_ITEMS.map((i) => `${i.label.replace('صلاة ', '')} ${points[i.key]}`).join(' · ')}</p>
      <div className="tw:relative">
        <Search className="tw:pointer-events-none tw:absolute tw:top-3.5 tw:start-3 tw:size-4 tw:text-dim" aria-hidden="true" />
        <Input type="search" aria-label="ابحث باسم الولد" placeholder="ابحث باسم الولد…" className="tw:ps-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <p className="tw:text-xs tw:text-dim">{kids.length} مخدوم</p>
      {kids.length === 0 && <p className="tw:py-8 tw:text-center tw:text-sm tw:text-dim">مفيش مخدومين في الفصل ده</p>}
      {kids.length > 0 && shown.length === 0 && <p className="tw:py-8 tw:text-center tw:text-sm tw:text-dim">مفيش ولد بالاسم ده</p>}
      <ul className="tw:flex tw:flex-col tw:gap-2">
        {shown.map((kid) => (
          <li key={kid.id}>
            <button type="button" onClick={() => setOpen(kid)} className="tw:flex tw:min-h-12 tw:w-full tw:cursor-pointer tw:items-center tw:justify-between tw:rounded-card tw:border tw:border-line tw:bg-surface tw:px-4 tw:text-start">
              <span className="tw:text-base tw:font-bold">{kid.name}</span>
              <span className="tw:text-dim" aria-hidden="true">‹</span>
            </button>
          </li>
        ))}
      </ul>
      {settingPoints && <PointsSettings by={user.name} onClose={() => setSettingPoints(false)} />}
    </section>
  );
};

export default SpiritualNotesScreen;
