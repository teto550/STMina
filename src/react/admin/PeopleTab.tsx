import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/react/components/ui/button';
import { commit, newId } from './data';
import { planAddAdmin, planMembership, rolesOfPerson } from './logic';
import { PersonList } from './PersonList';
import type { AdminData } from './types';
import { Sheet, inputClass } from './ui';

const adminSchema = z.object({
  name: z.string().trim().min(2, 'اكتب الاسم'),
  gender: z.enum(['male', 'female']),
  email: z.email('الإيميل مش صحيح'),
});
type AdminForm = z.infer<typeof adminSchema>;

function AddAdminSheet({ data, onClose, onDone }: { data: AdminData; onClose: () => void; onDone: (m: string) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<AdminForm>({ resolver: zodResolver(adminSchema), defaultValues: { gender: 'male' } });
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = handleSubmit(async (v) => {
    const plan = planAddAdmin({ id: newId('deacons'), ...v }, data);
    if (plan.errors.length) { setProblem(plan.errors.join(' — ')); return; }
    setBusy(true);
    try { await commit(plan.ops); onDone(`اتضاف الأدمن ${v.name.trim()}`); } catch (e) { setProblem('مقدرناش نحفظ، جرّب تاني'); console.warn(e); } finally { setBusy(false); }
  });
  return (
    <Sheet title="إضافة أدمن" onClose={onClose}>
      <form className="tw:flex tw:flex-col tw:gap-3" onSubmit={submit} noValidate>
        <label className="tw:flex tw:flex-col tw:gap-1 tw:text-sm tw:font-bold">الاسم
          <input className={inputClass} {...register('name')} />
          {errors.name && <span className="tw:text-xs tw:text-bad">{errors.name.message}</span>}
        </label>
        <label className="tw:flex tw:flex-col tw:gap-1 tw:text-sm tw:font-bold">النوع
          <select className={inputClass} {...register('gender')}><option value="male">خادم</option><option value="female">خادمة</option></select>
        </label>
        <label className="tw:flex tw:flex-col tw:gap-1 tw:text-sm tw:font-bold">الإيميل
          <input className={inputClass} type="email" dir="ltr" {...register('email')} />
          {errors.email && <span className="tw:text-xs tw:text-bad">{errors.email.message}</span>}
        </label>
        <p className="tw:text-xs tw:text-dim">لما صاحب الإيميل ده يسجّل أو يدخل، حسابه بيتربط بالشخص ده ويبقى أدمن.</p>
        {problem && <p role="alert" className="tw:text-sm tw:text-bad">{problem}</p>}
        <Button type="submit" disabled={busy}>{busy ? 'جاري الحفظ…' : 'إضافة'}</Button>
      </form>
    </Sheet>
  );
}

function RoleChooser({ title, roles, onPick, onClose }: { title: string; roles: { id: string; name: string }[]; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <ul className="tw:flex tw:flex-col">
        {roles.map((r) => <li key={r.id}><button type="button" className="tw:min-h-12 tw:w-full tw:cursor-pointer tw:rounded-field tw:px-3 tw:text-start tw:font-bold tw:hover:bg-surface-2" onClick={() => onPick(r.id)}>{r.name}</button></li>)}
        {roles.length === 0 && <li className="tw:py-6 tw:text-center tw:text-dim">مفيش أدوار</li>}
      </ul>
    </Sheet>
  );
}

/** People tab: search + filters, tick several servants, add them to / remove them from a role in one step. */
export function PeopleTab({ data, onChanged }: { data: AdminData; onChanged: (message: string) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState('all');
  const [chooser, setChooser] = useState<'add' | 'remove' | null>(null);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function apply(mode: 'add' | 'remove', roleId: string) {
    setChooser(null);
    const plan = planMembership(mode, roleId, [...selected], data);
    setError(plan.errors.length ? plan.errors.join(' — ') : null);
    if (plan.ops.length === 0) { if (!plan.errors.length) setError('مفيش حاجة تتغيّر'); return; }
    setBusy(true);
    try { await commit(plan.ops); setSelected(new Set()); onChanged(`اتحدّث ${plan.affectedPeople} شخص`); }
    catch (e) { setError('مقدرناش نحفظ، جرّب تاني'); console.warn(e); } finally { setBusy(false); }
  }
  const heldRoles = data.roles.filter((r) => data.people.some((p) => selected.has(p.id) && rolesOfPerson(p, data.roles).some((x) => x.id === r.id)));
  const allIds = data.people.map((p) => p.id);

  return (
    <div className="tw:flex tw:flex-col tw:gap-3 tw:p-4 tw:pb-28">
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
        <Button variant="secondary" size="sm" onClick={() => setSelected(selected.size ? new Set() : new Set(allIds))}>{selected.size ? 'إلغاء التحديد' : 'تحديد الكل'}</Button>
        <Button size="sm" onClick={() => setAddingAdmin(true)}>+ أدمن</Button>
      </div>
      <PersonList data={data} selected={selected} extraFilter={{ roleId: roleFilter, setRoleId: setRoleFilter }}
        onToggle={(id, on) => setSelected((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; })} />
      {error && <p role="alert" className="tw:rounded-field tw:border tw:border-bad tw:p-3 tw:text-sm tw:text-bad">{error}</p>}

      {selected.size > 0 && (
        <div className="tw:fixed tw:inset-x-0 tw:bottom-0 tw:z-10 tw:border-t tw:border-line tw:bg-surface tw:p-3">
          <div className="tw:mx-auto tw:flex tw:max-w-2xl tw:items-center tw:gap-2">
            <span className="tw:text-sm tw:font-bold">{selected.size} محدد</span>
            <Button className="tw:flex-1" disabled={busy} onClick={() => setChooser('add')}>إضافة لدور</Button>
            <Button className="tw:flex-1" variant="outline" disabled={busy || heldRoles.length === 0} onClick={() => setChooser('remove')}>إزالة من دور</Button>
          </div>
        </div>
      )}
      {chooser && <RoleChooser title={chooser === 'add' ? 'إضافة المحدّدين لدور' : 'إزالة المحدّدين من دور'} roles={chooser === 'add' ? data.roles : heldRoles} onClose={() => setChooser(null)} onPick={(id) => void apply(chooser, id)} />}
      {addingAdmin && <AddAdminSheet data={data} onClose={() => setAddingAdmin(false)} onDone={(m) => { setAddingAdmin(false); onChanged(m); }} />}
    </div>
  );
}

