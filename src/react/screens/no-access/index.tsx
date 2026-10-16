import type { FC } from 'react';
import { Lock, RefreshCw } from 'lucide-react';
import { Button } from '@/react/components/ui/button';

/**
 * "لسه مفيش صلاحيات": what a signed-in person with no role (or no class) sees instead of the tabs. They can still open their profile and
 * the settings from the ⚙️ menu above. When an admin gives them a role, "تحديث" loads the app with it.
 */
const NoAccess: FC = () => {
  return (
    <section aria-label="لسه مفيش صلاحيات" className="tw:mx-auto tw:mt-10 tw:flex tw:max-w-sm tw:flex-col tw:items-center tw:gap-3 tw:rounded-card tw:border tw:border-line tw:bg-surface tw:p-6 tw:text-center">
      <Lock className="tw:size-14 tw:text-accent" aria-hidden="true" />
      <h1 className="tw:text-xl tw:font-black">لسه مفيش صلاحيات</h1>
      <p className="tw:text-sm tw:leading-relaxed tw:text-dim">حسابك اتسجّل، بس لسه محدش حدد لك دور. كلّم الأدمن يدّيك الدور المناسب، وبعدين دوس تحديث.</p>
      <p className="tw:text-xs tw:text-dim">تقدر تفتح ملفك الشخصي والإعدادات من ⚙️ فوق.</p>
      <Button type="button" className="tw:mt-2" onClick={() => location.reload()}>
        <RefreshCw className="tw:size-4" aria-hidden="true" /> تحديث
      </Button>
    </section>
  );
};

export default NoAccess;
