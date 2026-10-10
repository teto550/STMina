import type { FC } from 'react';
import { Hourglass, Lock, LogOut, ShieldAlert, WifiOff } from 'lucide-react';
import { Button } from '@/react/components/ui/button';
import { useLogout } from '@/react/hooks/useAuth';
import type { BlockedReason } from '@/types/account';

/** What a signed-in person who cannot come in sees, for each reason. */
const REASONS = {
  pending: { Icon: Hourglass, title: 'في انتظار الموافقة', text: 'حسابك قيد المراجعة من الأدمن. هتقدر تدخل بعد الموافقة عليه.' },
  'no-access': { Icon: Lock, title: 'لسه مفيش صلاحيات', text: 'حسابك اتسجّل، بس لسه محدش حدد لك فصل. كلّم الأدمن يدّيك الدور المناسب وبعدين افتح التطبيق تاني.' },
  rejected: { Icon: ShieldAlert, title: 'تم رفض حسابك', text: 'الأدمن رفض طلب التسجيل بتاعك. لو ده غلط كلّمه.' },
  unregistered: { Icon: ShieldAlert, title: 'الحساب ده مش مسجل', text: 'الحساب ده مش مسجل في البرنامج. اخرج وسجّل الأول من "خادم جديد" واستنى موافقة الأدمن.' },
  unverifiable: { Icon: WifiOff, title: 'مش قادرين نتأكد من حسابك', text: 'مفيش نت. افتح التطبيق تاني لما النت يرجع.' },
  'wrong-section': { Icon: ShieldAlert, title: 'حسابك تابع لقسم تاني', text: 'مقدرناش نحوّلك للقسم بتاعك على الجهاز ده. جرّب متصفح تاني أو كلّم الأدمن.' },
  'no-class': { Icon: Lock, title: 'لسه مفيش فصل', text: 'حسابك لسه ملوش فصل. كلّم الأدمن يحدد لك فصلك.' },
} as const satisfies Record<BlockedReason, { Icon: FC<{ className?: string }>; title: string; text: string }>;

type BlockedViewProps = {
  reason: BlockedReason;
};

/** A signed-in person who cannot come in: says why, and lets them sign out. */
export const BlockedView: FC<BlockedViewProps> = ({ reason }) => {
  const { Icon, title, text } = REASONS[reason];
  const logout = useLogout();
  return (
    <div className="tw:flex tw:max-w-[320px] tw:flex-col tw:items-center tw:gap-3 tw:text-center">
      <Icon className="tw:size-14 tw:text-accent" aria-hidden="true" />
      <h1 className="tw:text-[22px] tw:font-black">{title}</h1>
      <p className="tw:text-sm tw:leading-relaxed tw:text-dim">{text}</p>
      <Button type="button" variant="secondary" className="tw:mt-3" loading={logout.isPending} onClick={() => logout.mutate()}>
        <LogOut className="tw:size-4" aria-hidden="true" /> خروج
      </Button>
    </div>
  );
};
