import type { FC } from 'react';
import { Case, Switch } from 'react-if';
import { Button } from '@/react/components/ui/button';
import { Spinner } from '@/react/components/ui/spinner';
import { APP_BUILT_AT, APP_VERSION, IS_DEV_BUILD } from '@/core/app-version';
import { reloadApp, useAppUpdate } from '@/react/hooks/useAppUpdate';
import { SettingsSection } from './SettingsSection';

enum UpdateView {
  Dev = 'dev',
  Checking = 'checking',
  Available = 'available',
  Unreachable = 'unreachable',
  Current = 'current',
}

const builtOn = (iso: string): string => (iso ? new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }) : '');

/** "التطبيق": which version is running and a button to look for a newer one. */
export const AppSettings: FC = () => {
  const { latest, updateAvailable, checking, unreachable, check } = useAppUpdate();
  let view = UpdateView.Current;
  if (IS_DEV_BUILD) {
    view = UpdateView.Dev;
  } else if (checking) {
    view = UpdateView.Checking;
  } else if (updateAvailable) {
    view = UpdateView.Available;
  } else if (unreachable) {
    view = UpdateView.Unreachable;
  }
  return (
    <SettingsSection title="التطبيق">
      <div className="tw:flex tw:flex-col tw:gap-2 tw:px-3 tw:py-2">
        <p className="tw:text-sm tw:font-bold">🔄 التحديثات</p>
        <p className="tw:text-xs tw:text-dim">
          الإصدار {APP_VERSION}
          {APP_BUILT_AT && ` · ${builtOn(APP_BUILT_AT)}`}
        </p>
        <Switch>
          <Case condition={view === UpdateView.Dev}>
            <p className="tw:text-xs tw:text-dim">نسخة التطوير: مفيش فحص للتحديثات.</p>
          </Case>
          <Case condition={view === UpdateView.Checking}>
            <Spinner label="بدور على تحديث…" />
          </Case>
          <Case condition={view === UpdateView.Available}>
            <p className="tw:text-sm tw:text-ok">🆕 فيه نسخة أحدث{latest?.version ? ` (${latest.version})` : ''}.</p>
            <Button size="sm" onClick={reloadApp}>تحديث الآن</Button>
          </Case>
          <Case condition={view === UpdateView.Unreachable}>
            <p className="tw:text-sm tw:text-bad">معرفناش نوصل للسيرفر، اتأكد من النت.</p>
            <Button size="sm" variant="secondary" onClick={() => check()}>حاول تاني</Button>
          </Case>
          <Case condition={view === UpdateView.Current}>
            <p className="tw:text-sm tw:text-ok">✓ إنت على آخر نسخة.</p>
            <Button size="sm" variant="secondary" onClick={() => check()}>تحقق من التحديث</Button>
          </Case>
        </Switch>
      </div>
    </SettingsSection>
  );
};
