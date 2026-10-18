import { useMemo, useState, type FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert } from '@/react/components/ui/alert';
import { Button } from '@/react/components/ui/button';
import { CheckRow } from '@/react/components/ui/check-row';
import { inputClass } from '@/react/components/ui/input';
import { Select } from '@/react/components/ui/select';
import { Sheet } from '@/react/components/ui/sheet';
import { addPersonSchema, type AddPersonValues } from '@/schemas/admin';
import { roleSummary } from './cell-ui';
import { commit, newId } from './data';
import { blockedReason, planAddPerson, sortRoles } from './logic';
import type { AdminData } from './types';

type AddPersonSheetProps = {
  data: AdminData;
  onClose: () => void;
  onDone: (message: string) => void;
};

/**
 * "+ شخص جديد": a servant of the list who is not an admin. Any roles (a class, خدام / خادمات, several), or none: a person with no role is
 * "general" and gets their class later, when they are added to a role.
 */
export const AddPersonSheet: FC<AddPersonSheetProps> = ({ data, onClose, onDone }) => {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<AddPersonValues>({ resolver: zodResolver(addPersonSchema), defaultValues: { name: '', gender: 'male', email: '' } });
  const gender = watch('gender');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const roles = useMemo(() => sortRoles(data.roles.filter((r) => !r.admin)), [data.roles]);
  // a role whose classes do not fit the chosen gender is shown with the reason and cannot be ticked
  const whyNot = (roleId: string): string | null => {
    const role = roles.find((r) => r.id === roleId);
    return role ? blockedReason({ id: '', name: '', gender, roleIds: [] }, role) : null;
  };

  const submit = handleSubmit(async (values) => {
    const roleIds = [...picked].filter((id) => !whyNot(id));
    const plan = planAddPerson({ id: newId('deacons'), ...values, roleIds }, data);
    if (plan.errors.length) {
      setProblem(plan.errors.join(' — '));
      return;
    }
    setBusy(true);
    try {
      await commit(plan.ops);
      onDone(`اتضاف ${values.name.trim()}`);
    } catch (e) {
      setProblem('مقدرناش نحفظ، جرّب تاني');
      console.warn(e);
    } finally {
      setBusy(false);
    }
  });

  return (
    <Sheet title="إضافة شخص جديد" onClose={onClose}>
      <form className="tw:flex tw:flex-col tw:gap-3" onSubmit={submit} noValidate>
        <label className="tw:flex tw:flex-col tw:gap-1 tw:text-sm tw:font-bold">الاسم
          <input className={inputClass} {...register('name')} />
          {errors.name && <span className="tw:text-xs tw:text-bad">{errors.name.message}</span>}
        </label>
        <label className="tw:flex tw:flex-col tw:gap-1 tw:text-sm tw:font-bold">النوع
          <Select {...register('gender')}><option value="male">خادم</option><option value="female">خادمة</option></Select>
        </label>
        <label className="tw:flex tw:flex-col tw:gap-1 tw:text-sm tw:font-bold">الإيميل (اختياري)
          <input className={inputClass} type="email" dir="ltr" {...register('email')} />
          {errors.email && <span className="tw:text-xs tw:text-bad">{errors.email.message}</span>}
        </label>
        <p className="tw:text-xs tw:text-dim">لو كتبت الإيميل، لما صاحبه يسجّل أو يدخل حسابه بيتربط بالشخص ده ويخد أدواره.</p>
        <fieldset className="tw:flex tw:flex-col tw:gap-1 tw:rounded-card tw:border tw:border-line tw:p-3">
          <legend className="tw:px-1 tw:text-sm tw:font-bold">الأدوار</legend>
          {roles.map((r) => {
            const why = whyNot(r.id);
            return (
              <CheckRow
                key={r.id}
                checked={picked.has(r.id) && !why}
                disabled={!!why}
                onChange={(on) => setPicked((prev) => { const next = new Set(prev); if (on) { next.add(r.id); } else { next.delete(r.id); } return next; })}
                hint={why ?? roleSummary(r)}
              >
                {r.name}
              </CheckRow>
            );
          })}
          {roles.length === 0 && <p className="tw:py-2 tw:text-sm tw:text-dim">مفيش أدوار لسه</p>}
          <p className="tw:mt-1 tw:text-xs tw:text-dim">من غير أي دور: الشخص بيتضاف عام، وتحدد له فصل (أو خدام / خادمات) بعدين بإضافته لدور.</p>
        </fieldset>
        {problem && <Alert onDismiss={() => setProblem(null)}>{problem}</Alert>}
        <Button type="submit" disabled={busy}>{busy ? 'جاري الحفظ…' : 'إضافة'}</Button>
      </form>
    </Sheet>
  );
};
