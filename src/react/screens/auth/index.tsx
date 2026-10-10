import { useEffect, type FC } from 'react';
import { Case, Switch } from 'react-if';
import { enterApp } from '@/features/shell/app-shell';
import { openCompleteProfileScreen } from '@/features/auth/profile-complete';
import { applySectionTheme } from '@/core/section';
import { state } from '@/core/state';
import { Alert } from '@/react/components/ui/alert';
import { Button } from '@/react/components/ui/button';
import { useAccount, useAuthUser, useIsRegistering, useLogout } from '@/react/hooks/useAuth';
import { useAfter } from '@/react/hooks/useAfter';
import { AuthTabs } from './components/AuthTabs';
import { BlockedView } from './components/BlockedView';
import { Splash } from './components/Splash';

/** How long the page may show the loading picture before we show the login form instead (and say the connection is bad). */
const SLOW_MS = 7000;

/** What the screen shows. */
enum AuthView {
  /** the loading picture: finding out who is signed in, checking the account, or reloading into the person's section */
  Loading = 'loading',
  /** an account that cannot come in (with the reason) */
  Blocked = 'blocked',
  /** the account could not be read at all */
  Unreadable = 'unreadable',
  /** the person is in the old app: nothing is shown */
  InApp = 'in-app',
  /** the login and "new servant" forms */
  SignIn = 'sign-in',
}

type ViewState = {
  waiting: boolean;
  blocked: boolean;
  unreadable: boolean;
  inApp: boolean;
};

/** The first thing that applies wins, in this order. */
const viewOf = ({ waiting, blocked, unreadable, inApp }: ViewState): AuthView => {
  if (waiting) {
    return AuthView.Loading;
  }
  if (blocked) {
    return AuthView.Blocked;
  }
  if (unreadable) {
    return AuthView.Unreadable;
  }
  if (inApp) {
    return AuthView.InApp;
  }
  return AuthView.SignIn;
};

/**
 * The sign-in screen: the loading picture while we find out who is signed in, a message for an account that cannot come in, the
 * login and "new servant" forms for everyone else, and nothing at all once the person is in the app.
 */
const AuthScreen: FC = () => {
  const auth = useAuthUser();
  const registering = useIsRegistering(); // creating an account signs the new person in for a moment: that is not a login
  const account = useAccount(auth.user, !registering);
  const logout = useLogout();
  const decision = registering ? undefined : account.data;

  const loading = auth.status === 'loading' || (!!auth.user && !registering && account.isLoading);
  const slow = useAfter(SLOW_MS, loading);
  const reloading = decision?.kind === 'redirect-section'; // the device was switched to the person's section: the page reloads
  const blocked = decision?.kind === 'blocked' ? decision.reason : null;
  const view = viewOf({
    waiting: (loading && !slow) || reloading,
    blocked: blocked !== null,
    unreadable: !!auth.user && !registering && account.isError,
    inApp: decision?.kind === 'enter' || decision?.kind === 'incomplete-profile',
  });

  // hand the person over to the old app (or reload into their section)
  useEffect(() => {
    if (!auth.user || !decision) {
      return;
    }
    if (decision.kind === 'redirect-section') {
      location.reload();
    } else if (decision.kind === 'enter' || decision.kind === 'incomplete-profile') {
      try {
        sessionStorage.removeItem('sectionRedirect');
      } catch {
        /* private mode */
      }
      Object.assign(state, decision.session);
      if (decision.kind === 'enter') {
        void enterApp(auth.user, decision.profile);
      } else {
        openCompleteProfileScreen(auth.user, decision.profile);
      }
    }
  }, [auth.user, decision]);

  const showsSignIn = view === AuthView.Blocked || view === AuthView.Unreadable || view === AuthView.SignIn;
  useEffect(() => {
    if (showsSignIn) {
      applySectionTheme(false); // the sign-in screens are always the default blue
    }
  }, [showsSignIn]);
  useEffect(() => {
    if (slow) {
      window.showToast?.('في مشكلة اتصال — حاول تفتح الموقع تاني لما النت يرجع', 'error');
    }
  }, [slow]);

  return (
    <Switch>
      <Case condition={view === AuthView.Loading}>
        <Splash />
      </Case>
      <Case condition={view === AuthView.Blocked}>
        <BlockedView reason={blocked ?? 'pending'} />
      </Case>
      <Case condition={view === AuthView.Unreadable}>
        <div className="tw:flex tw:w-full tw:max-w-[320px] tw:flex-col tw:gap-3">
          <Alert action={<Button type="button" size="sm" variant="outline" loading={account.isFetching} onClick={() => void account.refetch()}>حاول تاني</Button>}>
            مقدرناش نتأكد من حسابك. اتأكد من النت وحاول تاني.
          </Alert>
          <Button type="button" variant="ghost" loading={logout.isPending} onClick={() => logout.mutate()}>خروج</Button>
        </div>
      </Case>
      <Case condition={view === AuthView.InApp}>
        <></>
      </Case>
      <Case condition={view === AuthView.SignIn}>
        <AuthTabs />
      </Case>
    </Switch>
  );
};

export default AuthScreen;
