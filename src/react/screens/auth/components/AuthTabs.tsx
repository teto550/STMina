import { useEffect, useState, type FC } from 'react';
import { Case, Switch } from 'react-if';
import { Segmented } from '@/react/components/ui/segmented';
import { LoginForm } from '../login';
import { RegisterForm } from '../register';

enum AuthTab {
  Login = 'login',
  Register = 'register',
}

/** The page was reloaded by the gender choice of the registration form: it marks that so we come back to the registration tab. */
const wantsRegister = (): boolean => {
  try {
    return sessionStorage.getItem('openRegisterTab') === '1';
  } catch {
    return false;
  }
};

/**
 * The sign-in card: the app's picture and name, the tab buttons ("تسجيل دخول" / "خادم جديد") and the selected tab's form.
 * Only the selected form exists at a time.
 */
export const AuthTabs: FC = () => {
  const [tab, setTab] = useState<AuthTab>(() => (wantsRegister() ? AuthTab.Register : AuthTab.Login));
  useEffect(() => {
    try {
      sessionStorage.removeItem('openRegisterTab');
    } catch {
      /* private mode */
    }
  }, []);

  return (
    <>
      <img src="icon-192.png" alt="" className="tw:mb-3.5 tw:size-[110px] tw:rounded-[20px] tw:object-cover tw:shadow-[0_8px_32px_rgba(0,0,0,0.4)]" />
      <h1 className="tw:mb-1.5 tw:text-center tw:text-[28px] tw:font-black">خدمة ابتدائي</h1>
      <p className="tw:mb-9 tw:text-center tw:text-sm tw:text-dim">تسجيل الحضور بسرعة وسهولة</p>
      <div className="tw:w-full tw:max-w-[380px] tw:rounded-card tw:border tw:border-line tw:bg-surface tw:px-6 tw:py-7">
        <div className="tw:mb-5">
          <Segmented<AuthTab>
            label="الدخول"
            value={tab}
            onChange={setTab}
            options={[{ value: AuthTab.Login, label: 'تسجيل دخول' }, { value: AuthTab.Register, label: 'خادم جديد' }]}
          />
        </div>
        <Switch>
          <Case condition={tab === AuthTab.Login}><LoginForm /></Case>
          <Case condition={tab === AuthTab.Register}><RegisterForm /></Case>
        </Switch>
      </div>
    </>
  );
};
