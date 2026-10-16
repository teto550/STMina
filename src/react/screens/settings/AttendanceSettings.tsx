import type { FC } from 'react';
import { Alert } from '@/react/components/ui/alert';
import { CheckRow } from '@/react/components/ui/check-row';
import { Spinner } from '@/react/components/ui/spinner';
import { usePreferences, useSavePreferences } from '@/react/hooks/usePreferences';
import { SettingsSection } from './SettingsSection';

/** "الحضور": how taking attendance behaves. Saved on the person's account, one write per change. */
export const AttendanceSettings: FC = () => {
  const prefs = usePreferences();
  const save = useSavePreferences();
  return (
    <SettingsSection title="الحضور">
      <CheckRow
        checked={prefs.focusSearchAfterMark}
        disabled={save.isPending}
        onChange={(on) => save.mutate({ focusSearchAfterMark: on })}
        hint="مفعّل: بعد كل تسجيل ترجع لخانة البحث جاهزة تكتب الاسم اللي بعده. لو وقفته تكمّل تمرير القائمة وتسجّل من غير بحث"
      >
        🔍 الرجوع لخانة البحث بعد تسجيل الحضور
      </CheckRow>
      {save.isPending && <Spinner label="جاري الحفظ…" className="tw:px-3 tw:pb-2" />}
      {save.isError && <Alert onDismiss={() => save.reset()}>معرفناش نحفظ الإعدادات، جرّب تاني.</Alert>}
    </SettingsSection>
  );
};
