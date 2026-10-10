import { useState, type FC } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Alert } from '@/react/components/ui/alert';
import { Button } from '@/react/components/ui/button';
import { CheckRow } from '@/react/components/ui/check-row';
import { Sheet } from '@/react/components/ui/sheet';
import type { ScreenProps } from '../registry';

export type DashboardSection = { id: string; name: string; desc: string };

export type DashboardOptionsProps = ScreenProps & {
  sections: DashboardSection[];
  /** the ids chosen last time */
  selected: string[];
  /** saves the choice and opens the dashboard (loads its data); rejects when that fails */
  onShow: (ids: string[]) => Promise<void>;
};

/** "داشبورد الخدام": choose which sections to show, then load and open the dashboard (with a visible loader and error). */
const DashboardOptions: FC<DashboardOptionsProps> = ({ close, sections, selected, onShow }) => {
  const [chosen, setChosen] = useState<string[]>(selected);
  const show = useMutation({
    mutationFn: (ids: string[]) => onShow(ids),
    onSuccess: () => close?.(),
  });
  const toggle = (id: string, on: boolean) => {
    setChosen((cur) => (on ? [...cur, id] : cur.filter((x) => x !== id)));
  };
  return (
    <Sheet
      title="📊 داشبورد الخدام"
      onClose={() => close?.()}
      footer={
        <div className="tw:flex tw:gap-2">
          <Button variant="secondary" className="tw:flex-1" onClick={() => close?.()}>إلغاء</Button>
          <Button className="tw:flex-[2]" disabled={show.isPending} onClick={() => show.mutate(sections.map((s) => s.id).filter((id) => chosen.includes(id)))}>
            {show.isPending ? 'جاري التحميل…' : '📊 اعرض الداشبورد'}
          </Button>
        </div>
      }
    >
      <div className="tw:flex tw:flex-col tw:gap-2">
        <p className="tw:text-sm tw:text-dim">اختار الأقسام اللي عايزها تظهر في الداشبورد</p>
        {show.isError && (
          <Alert onDismiss={() => show.reset()}>معرفناش نحمّل الداشبورد، جرّب تاني.</Alert>
        )}
        {sections.map((s) => (
          <CheckRow key={s.id} checked={chosen.includes(s.id)} onChange={(on) => toggle(s.id, on)} hint={s.desc}>
            {s.name}
          </CheckRow>
        ))}
      </div>
    </Sheet>
  );
};

export default DashboardOptions;
