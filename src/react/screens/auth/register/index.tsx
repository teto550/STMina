import type { FC } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { When } from 'react-if';
import { registerErrorMessage } from '@/api/errors';
import { SECTION } from '@/core/section';
import { PasswordField } from '@/react/components/form/PasswordField';
import { Alert } from '@/react/components/ui/alert';
import { Button } from '@/react/components/ui/button';
import { useRegister } from '@/react/hooks/useAuth';
import { emptyRegister, registerSchema, type RegisterValues } from '@/schemas/auth';
import type { Section } from '@/types/access';
import { ClassAndNameFields } from './ClassAndNameFields';
import { ContactFields } from './ContactFields';
import { GenderField } from './GenderField';
import { StudyFields } from './StudyFields';
import { toRegisterInput } from './to-input';

/** "New servant": the form, its validation (registerSchema) and the request (useRegister), made of small field groups. */
export const RegisterForm: FC = () => {
  const register = useRegister(SECTION as Section);
  const form = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), defaultValues: emptyRegister });
  const submit = form.handleSubmit((values) => register.mutate(toRegisterInput(values), { onSuccess: () => form.reset(emptyRegister) }));

  return (
    <FormProvider {...form}>
      <form className="tw:flex tw:flex-col tw:gap-4" onSubmit={submit} noValidate>
        <GenderField />
        <ClassAndNameFields />
        <ContactFields />
        <StudyFields />
        <PasswordField name="password" label="كلمة المرور *" placeholder="6 أحرف على الأقل" autoComplete="new-password" />
        <Button type="submit" size="lg" className="tw:w-full" loading={register.isPending}>{register.isPending ? 'جاري الإرسال…' : '📨 طلب تسجيل'}</Button>
        <When condition={register.isError}>
          <Alert onDismiss={register.reset}>{registerErrorMessage(register.error)}</Alert>
        </When>
        <When condition={register.isSuccess}>
          <Alert tone="success" onDismiss={register.reset}>
            تم إرسال طلبك للأدمن<br /><span className="tw:text-xs tw:text-dim">انتظر موافقة الأدمن عشان تقدر تدخل</span>
          </Alert>
        </When>
      </form>
    </FormProvider>
  );
};
