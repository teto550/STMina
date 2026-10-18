import type { FC } from 'react';
import { Alert } from '@/react/components/ui/alert';
import { CheckRow } from '@/react/components/ui/check-row';
import { Spinner } from '@/react/components/ui/spinner';
import { usePreferences, useSavePreferences } from '@/react/hooks/usePreferences';
import { SettingsSection } from './SettingsSection';

/** "الصور": how photos are added. Saved on the person's account, one write per change. */
export const PhotoSettings: FC = () => {
  const prefs = usePreferences();
  const save = useSavePreferences();
  return (
    <SettingsSection title="الصور">
      <CheckRow checked={prefs.cropPhotos} disabled={save.isPending} onChange={(on) => save.mutate({ cropPhotos: on })} hint="بعد ما تختار صورة من الكاميرا أو المعرض تظهر شاشة لقصها قبل الحفظ">
        ✂️ قص الصورة بعد اختيارها
      </CheckRow>
      {save.isPending && <Spinner label="جاري الحفظ…" className="tw:px-3 tw:pb-2" />}
      {save.isError && <Alert onDismiss={() => save.reset()}>معرفناش نحفظ الإعدادات، جرّب تاني.</Alert>}
    </SettingsSection>
  );
};
