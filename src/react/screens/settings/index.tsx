import type { FC } from 'react';
import { ArrowRight } from 'lucide-react';
import type { ScreenProps } from '../registry';
import { AttendanceSettings } from './AttendanceSettings';
import { AppSettings } from './AppSettings';
import { PhotoSettings } from './PhotoSettings';

/** "الإعدادات": the person's own settings, a full screen (back arrow on top) with one section per topic. */
const Settings: FC<ScreenProps> = ({ close }) => {
  return (
    <div className="tw:min-h-full">
      <header className="tw:sticky tw:top-0 tw:z-10 tw:flex tw:items-center tw:gap-3 tw:border-b tw:border-line tw:bg-surface tw:px-4 tw:py-3">
        <button type="button" aria-label="رجوع" onClick={() => close?.()} className="tw:flex tw:size-10 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-field tw:border tw:border-line tw:bg-surface-2">
          <ArrowRight className="tw:size-5" aria-hidden="true" />
        </button>
        <h1 className="tw:text-lg tw:font-bold">الإعدادات</h1>
      </header>
      <main className="tw:mx-auto tw:flex tw:max-w-lg tw:flex-col tw:gap-5 tw:p-4">
        <AttendanceSettings />
        <PhotoSettings />
        <AppSettings />
      </main>
    </div>
  );
};

export default Settings;
