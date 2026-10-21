import { useState, type FC } from 'react';
import { Case, Switch } from 'react-if';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { SignInForm } from './SignInForm';

enum LoginView {
  SignIn = 'sign-in',
  ForgotPassword = 'forgot-password',
}

/** The "تسجيل دخول" tab: the sign-in form, or (after "نسيت كلمة المرور؟") the form that sends the reset email. */
export const LoginForm: FC = () => {
  const [view, setView] = useState<LoginView>(LoginView.SignIn);
  const [email, setEmail] = useState('');

  return (
    <Switch>
      <Case condition={view === LoginView.SignIn}>
        <SignInForm onForgot={(typed) => { setEmail(typed); setView(LoginView.ForgotPassword); }} />
      </Case>
      <Case condition={view === LoginView.ForgotPassword}>
        <ForgotPasswordForm initialEmail={email} onBack={() => setView(LoginView.SignIn)} />
      </Case>
    </Switch>
  );
};
