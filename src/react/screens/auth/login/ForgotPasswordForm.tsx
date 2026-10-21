import type { FC } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { Case, Switch, When } from 'react-if';
import { passwordResetErrorMessage } from '@/api/errors';
import { TextField } from '@/react/components/form/TextField';
import { Alert } from '@/react/components/ui/alert';
import { Button } from '@/react/components/ui/button';
import { useSendPasswordReset } from '@/react/hooks/useAuth';
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/schemas/auth';

enum ResetView {
  Form = 'form',
  Sent = 'sent',
}

type ForgotPasswordFormProps = {
  /** the email already typed on the sign-in form */
  initialEmail: string;
  onBack: () => void;
};

/** "نسيت كلمة المرور": asks for the email and sends Firebase's reset email (the same one as "Reset password" in the Firebase console). */
export const ForgotPasswordForm: FC<ForgotPasswordFormProps> = ({ initialEmail, onBack }) => {
  const reset = useSendPasswordReset();
  const form = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: initialEmail } });
  const submit = form.handleSubmit((values) => reset.mutate(values.email));
  const view = reset.isSuccess ? ResetView.Sent : ResetView.Form;

  return (
    <Switch>
      <Case condition={view === ResetView.Form}>
        <FormProvider {...form}>
          <form className="tw:flex tw:flex-col tw:gap-4" onSubmit={submit} noValidate>
            <p className="tw:text-sm tw:leading-relaxed tw:text-dim">اكتب الإيميل اللي سجلت بيه، وهنبعتلك لينك تختار بيه كلمة مرور جديدة.</p>
            <TextField name="email" label="البريد الإلكتروني" type="email" dir="ltr" placeholder="example@gmail.com" autoComplete="username" />
            <Button type="submit" size="lg" className="tw:w-full" loading={reset.isPending}>{reset.isPending ? 'جاري الإرسال…' : 'ابعتلي اللينك'}</Button>
            <When condition={!!reset.error}>
              <Alert onDismiss={reset.reset}>{passwordResetErrorMessage(reset.error)}</Alert>
            </When>
            <Button type="button" variant="ghost" className="tw:w-full" onClick={onBack}>رجوع لتسجيل الدخول</Button>
          </form>
        </FormProvider>
      </Case>
      <Case condition={view === ResetView.Sent}>
        <div className="tw:flex tw:flex-col tw:gap-4">
          <Alert tone="success" title="اتبعتت الرسالة">لو الإيميل ده مسجل عندنا هتوصلك رسالة فيها لينك لكلمة مرور جديدة. لو مالقتهاش دوّر في الـSpam.</Alert>
          <Button type="button" size="lg" className="tw:w-full" onClick={onBack}>رجوع لتسجيل الدخول</Button>
        </div>
      </Case>
    </Switch>
  );
};
