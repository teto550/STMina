import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { doc, setDoc } from 'firebase/firestore';
import { z } from 'zod';
import { db } from '@/core/firebase';
import { renameServant, type RenameResult } from '@/core/servant-rename';
import { EGYPT_UNIVERSITIES } from '@/core/universities';
import { cleanName } from '@/react/admin/logic';
import { inputClass } from '@/react/admin/ui';
import { Button } from '@/react/components/ui/button';
import type { ScreenProps } from './registry';

export interface ServantProfile {
  name: string;
  /** login of the servant; null when they have not registered yet (then only the name can be edited) */
  uid: string | null;
  /** id of the servant in the servants list (needed to rename); null when unknown */
  personId: string | null;
  phones: string[]; address: string; dob: string; graduated: boolean; college: string; university: string;
}
export interface ProfileData { phones: string[]; phone: string; address: string; dob: string; graduated: boolean; college: string; university: string }
export interface EditServantProps extends ScreenProps {
  servant: ServantProfile;
  /** only an admin may change the name */
  canRename: boolean;
  onSaved: (result: { name: string; data: ProfileData; renamed: RenameResult | null }) => void;
}

const schema = z.object({
  // a single first name is fine
  name: z.string().trim().min(1, 'اكتب الاسم'),
  phones: z.array(z.object({ value: z.string() })),
  address: z.string(),
  dob: z.string(),
  status: z.enum(['student', 'graduated']),
  college: z.string(),
  university: z.string(),
});
type Form = z.infer<typeof schema>;

const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <label className="tw:flex tw:flex-col tw:gap-2 tw:text-sm tw:font-bold">{label}{children}{error && <span className="tw:text-xs tw:font-normal tw:text-bad">{error}</span>}</label>
);

/** "تعديل بيانات الخادم": the servant's data (and, for an admin, the name). */
export default function EditServant({ close, servant, canRename, onSaved }: EditServantProps) {
  const [problem, setProblem] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const hasAccount = servant.uid !== null;
  const { register, control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: servant.name,
      phones: (servant.phones.length ? servant.phones : ['']).map((value) => ({ value })),
      address: servant.address, dob: servant.dob, status: servant.graduated ? 'graduated' : 'student', college: servant.college, university: servant.university,
    },
  });
  const phones = useFieldArray({ control, name: 'phones' });
  const student = watch('status') === 'student';

  const submit = handleSubmit(async (v) => {
    setProblem(null);
    setPhoneError(null);
    const list = v.phones.map((p) => p.value.trim()).filter(Boolean);
    if (hasAccount && list.length === 0) { setPhoneError('اكتب رقم تليفون واحد على الأقل'); return; }
    const data: ProfileData = {
      phones: list, phone: list[0] ?? '', address: v.address.trim(), dob: v.dob, graduated: v.status === 'graduated',
      college: v.status === 'student' ? v.college.trim() : '', university: v.status === 'student' ? v.university : '',
    };
    try {
      let renamed: RenameResult | null = null;
      const wanted = cleanName(v.name);
      if (canRename && servant.personId && wanted !== servant.name) {
        renamed = await renameServant(servant.personId, servant.name, wanted);
        if (!renamed.ok) { setProblem(renamed.error ?? 'مقدرناش نغيّر الاسم'); return; }
      }
      if (servant.uid) await setDoc(doc(db, 'users', servant.uid), data, { merge: true });
      onSaved({ name: renamed ? wanted : servant.name, data, renamed });
      close?.();
    } catch (e) { console.warn(e); setProblem('حصل خطأ، جرّب تاني'); }
  });

  return (
    <div className="tw:min-h-dvh tw:bg-bg">
      <header className="tw:sticky tw:top-0 tw:z-20 tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-line tw:bg-surface tw:px-3 tw:py-2">
        {close && <Button variant="ghost" size="icon" aria-label="رجوع" onClick={close}>→</Button>}
        <h1 className="tw:text-base tw:font-bold">✏️ تعديل بيانات الخادم</h1>
      </header>
      <form className="tw:mx-auto tw:flex tw:max-w-xl tw:flex-col tw:gap-5 tw:px-4 tw:pt-6 tw:pb-36" onSubmit={submit} noValidate>
        <section className="tw:flex tw:flex-col tw:gap-4 tw:rounded-card tw:border tw:border-line tw:bg-surface tw:p-5">
          <Field label="الاسم" error={errors.name?.message}>
            <input className={inputClass} readOnly={!canRename} {...register('name')} />
            {!canRename && <span className="tw:text-xs tw:font-normal tw:text-dim">الأدمن بس هو اللي يغيّر الاسم</span>}
          </Field>
          {hasAccount && <>
          <Field label="رقم التليفون" error={phoneError ?? undefined}>
            <div className="tw:flex tw:flex-col tw:gap-2">
              {phones.fields.map((f, i) => (
                <div key={f.id} className="tw:flex tw:gap-2">
                  <input className={inputClass} type="tel" dir="ltr" placeholder="01xxxxxxxxx" aria-label={`رقم التليفون ${i + 1}`} {...register(`phones.${i}.value` as const)} />
                  {phones.fields.length > 1 && <Button type="button" variant="outline" size="icon" aria-label={`شيل رقم ${i + 1}`} onClick={() => phones.remove(i)}>✕</Button>}
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={() => phones.append({ value: '' })}>+ إضافة رقم تليفون تاني</Button>
            </div>
          </Field>
          <Field label="العنوان"><input className={inputClass} {...register('address')} /></Field>
          <Field label="تاريخ الميلاد"><input className={inputClass} type="date" {...register('dob')} /></Field>
          </>}
          {!hasAccount && <p className="tw:rounded-field tw:bg-surface-2 tw:px-4 tw:py-3 tw:text-sm tw:text-dim">الخادم ده لسه ماسجلش بياناته في التطبيق، فتقدر تعدّل الاسم بس.</p>}
        </section>

        {hasAccount && <section className="tw:flex tw:flex-col tw:gap-4 tw:rounded-card tw:border tw:border-line tw:bg-surface tw:p-5">
          <Field label="الحالة الدراسية">
            <select className={inputClass} {...register('status')}><option value="student">لسه بيدرس</option><option value="graduated">متخرج</option></select>
          </Field>
          {student && (
            <>
              <Field label="الكلية"><input className={inputClass} {...register('college')} /></Field>
              <Field label="الجامعة">
                <select className={inputClass} {...register('university')}>
                  <option value="">اختر الجامعة</option>
                  {EGYPT_UNIVERSITIES.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
            </>
          )}
        </section>}

        {problem && <p role="alert" className="tw:rounded-field tw:border tw:border-bad tw:p-3 tw:text-sm tw:text-bad">{problem}</p>}
        <div className="tw:fixed tw:inset-x-0 tw:bottom-0 tw:z-10 tw:border-t tw:border-line tw:bg-surface tw:p-3">
          <div className="tw:mx-auto tw:flex tw:max-w-xl tw:gap-2">
            <Button className="tw:flex-1" type="submit" disabled={isSubmitting}>{isSubmitting ? 'جاري الحفظ…' : '💾 حفظ'}</Button>
            <Button className="tw:flex-1" type="button" variant="outline" disabled={isSubmitting} onClick={close}>إلغاء</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
