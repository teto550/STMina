import type { FC } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { When } from 'react-if';
import { loginErrorMessage } from '@/api/errors';
import { PasswordField } from '@/react/components/form/PasswordField';
import { TextField } from '@/react/components/form/TextField';
import { Alert } from '@/react/components/ui/alert';
import { Button } from '@/react/components/ui/button';
import { useLogin } from '@/react/hooks/useAuth';
import { emptyLogin, loginSchema, type LoginValues } from '@/schemas/auth';

type SignInFormProps = {
  /** "نسيت كلمة المرور": gets the email typed so far, so the next form starts with it */
  onForgot: (email: string) => void;
};

/** The sign-in form: its fields, its validation (loginSchema), the sign-in itself (useLogin) and what the person sees while it runs. */
export const SignInForm: FC<SignInFormProps> = ({ onForgot }) => {
  const login = useLogin();
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: emptyLogin });
  const submit = form.handleSubmit((values) => login.mutate(values));
  // stays busy after the sign-in itself succeeded: the screen takes over as soon as the account has been checked
  const busy = login.isPending || login.isSuccess;

  return (
    <FormProvider {...form}>
      <form className="tw:flex tw:flex-col tw:gap-4" onSubmit={submit} noValidate>
        <TextField name="email" label="البريد الإلكتروني" type="email" dir="ltr" placeholder="example@gmail.com" autoComplete="username" />
        <PasswordField name="password" label="كلمة المرور" placeholder="••••••••" autoComplete="current-password" />
        <Button type="submit" size="lg" className="tw:w-full" loading={busy}>{busy ? 'جاري الدخول…' : 'دخول'}</Button>
        <When condition={!!login.error}>
          <Alert onDismiss={login.reset}>{loginErrorMessage(login.error)}</Alert>
        </When>
        <Button type="button" variant="ghost" className="tw:w-full" onClick={() => onForgot(form.getValues('email').trim())}>نسيت كلمة المرور؟</Button>
      </form>
    </FormProvider>
  );
};
