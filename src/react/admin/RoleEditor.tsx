import { useMemo, useState } from 'react';
import { GRADES, cellOf, isMixedGrade, mixedGradeCells } from '@/core/access-config';
import { Button } from '@/react/components/ui/button';
import type { Cell, Grade } from '@/types/access';
import { commit, newId } from './data';
import { membersOf, planRoleDelete, planRoleSave } from './logic';
import { PersonList } from './PersonList';
import type { AdminData, AdminRole } from './types';
import { CheckRow, Chip, Sheet, inputClass } from './ui';

const GRADE_NAMES = ['', 'أولى', 'تانية', 'تالتة', 'رابعة', 'خامسة', 'سادسة'];

/** Full-page editor of one role (a new one when `role` is null): name, admin switch, class grid, members. Saves everything in one batch. */
export function RoleEditor({ role, data, onDone, onCancel }: { role: AdminRole | null; data: AdminData; onDone: (message: string) => void; onCancel: () => void }) {
  const [id] = useState(() => role?.id ?? newId('roles'));
  const [name, setName] = useState(role?.name ?? '');
  const [admin, setAdmin] = useState(role?.admin ?? false);
  const [cells, setCells] = useState<Set<Cell>>(() => new Set(role?.cells ?? []));
  const [members, setMembers] = useState<Set<string>>(() => new Set(role ? membersOf(role.id, data.people).map((p) => p.id) : []));
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const draft: AdminRole = { id, name, admin, cells: [...cells] };
  const plan = useMemo(() => planRoleSave({ id, name, admin, cells: [...cells] }, [...members], data), [id, name, admin, cells, members, data]);
  const peopleById = useMemo(() => new Map(data.people.map((p) => [p.id, p])), [data.people]);

  const toggle = (list: Cell[], on: boolean) => setCells((prev) => { const next = new Set(prev); list.forEach((c) => (on ? next.add(c) : next.delete(c))); return next; });
  const has = (list: Cell[]) => list.every((c) => cells.has(c));

  async function save() {
    setErrors(plan.errors);
    if (plan.errors.length) return;
    setBusy(true);
    try { await commit(plan.ops); onDone(`اتحفظ الدور "${name.trim()}"${plan.affectedPeople ? ` — اتحدّث ${plan.affectedPeople} شخص` : ''}`); }
    catch (e) { setErrors(['مقدرناش نحفظ، جرّب تاني']); console.warn(e); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!role) return;
    const r = planRoleDelete(role.id, data);
    if (r.error) { setErrors([r.error]); return; }
    if (!confirm(`هتحذف الدور "${role.name}"؟`)) return;
    setBusy(true);
    try { await commit(r.ops); onDone(`اتحذف الدور "${role.name}"`); } catch (e) { setErrors(['مقدرناش نحذف، جرّب تاني']); console.warn(e); } finally { setBusy(false); }
  }

  return (
    <div className="tw:mx-auto tw:flex tw:max-w-2xl tw:flex-col tw:gap-4 tw:p-4 tw:pb-28">
      <h2 className="tw:text-lg tw:font-bold">{role ? 'تعديل دور' : 'دور جديد'}</h2>
      <label className="tw:flex tw:flex-col tw:gap-1 tw:text-sm tw:font-bold">اسم الدور
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: تالتة بنين" />
      </label>
      <CheckRow checked={admin} onChange={setAdmin} hint="الأدمن بيشوف ويعدّل كل حاجة في القسمين">دور أدمن</CheckRow>

      {!admin && (
        <fieldset className="tw:rounded-card tw:border tw:border-line tw:bg-surface tw:p-3">
          <legend className="tw:px-1 tw:text-sm tw:font-bold">الفصول (المخدومين + الخدام)</legend>
          <div className="tw:grid tw:grid-cols-2 tw:gap-x-2">
            <div className="tw:text-center tw:text-xs tw:font-bold tw:text-accent">بنات</div>
            <div className="tw:text-center tw:text-xs tw:font-bold tw:text-dim">بنين</div>
            {GRADES.map((g: Grade) => isMixedGrade(g) ? (
              <div key={g} className="tw:col-span-2">
                <CheckRow checked={has(mixedGradeCells(g))} onChange={(v) => toggle(mixedGradeCells(g), v)} hint="بنات وأولاد في نفس الفصل، وخادمات بس">{GRADE_NAMES[g]} — بنات وأولاد</CheckRow>
              </div>
            ) : (
              <div key={g} className="tw:contents">
                <CheckRow checked={cells.has(cellOf('female', g))} onChange={(v) => toggle([cellOf('female', g)], v)}>{GRADE_NAMES[g]} بنات</CheckRow>
                <CheckRow checked={cells.has(cellOf('male', g))} onChange={(v) => toggle([cellOf('male', g)], v)}>{GRADE_NAMES[g]} بنين</CheckRow>
              </div>
            ))}
          </div>
        </fieldset>
      )}

      <section className="tw:rounded-card tw:border tw:border-line tw:bg-surface tw:p-3">
        <div className="tw:mb-2 tw:flex tw:items-center tw:justify-between">
          <h3 className="tw:text-sm tw:font-bold">الأعضاء ({members.size})</h3>
          <Button size="sm" variant="secondary" onClick={() => setPicking(true)}>+ إضافة أشخاص</Button>
        </div>
        <ul className="tw:flex tw:flex-wrap tw:gap-2">
          {[...members].map((pid) => peopleById.get(pid)).filter((p) => !!p).map((p) => (
            <li key={p.id}><Chip>{p.name}<button type="button" aria-label={`شيل ${p.name}`} className="tw:ms-2 tw:cursor-pointer" onClick={() => setMembers((m) => { const n = new Set(m); n.delete(p.id); return n; })}>✕</button></Chip></li>
          ))}
          {members.size === 0 && <li className="tw:text-sm tw:text-dim">مفيش أعضاء لسه</li>}
        </ul>
      </section>

      <p className="tw:text-sm tw:text-dim" aria-live="polite">التغيير ده هيأثر على {plan.affectedPeople} شخص دلوقتي</p>
      {errors.length > 0 && <ul role="alert" className="tw:rounded-field tw:border tw:border-bad tw:p-3 tw:text-sm tw:text-bad">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}

      <div className="tw:fixed tw:inset-x-0 tw:bottom-0 tw:z-10 tw:border-t tw:border-line tw:bg-surface tw:p-3">
        <div className="tw:mx-auto tw:flex tw:max-w-2xl tw:gap-2">
          <Button className="tw:flex-1" disabled={busy} onClick={save}>{busy ? 'جاري الحفظ…' : 'حفظ'}</Button>
          <Button className="tw:flex-1" variant="outline" disabled={busy} onClick={onCancel}>إلغاء</Button>
          {role && <Button variant="destructive" disabled={busy} onClick={remove}>حذف</Button>}
        </div>
      </div>

      {picking && (
        <Sheet title="إضافة أعضاء للدور" onClose={() => setPicking(false)} footer={<Button className="tw:w-full" onClick={() => setPicking(false)}>تم ({members.size})</Button>}>
          <PersonList data={data} selected={members} forRole={draft} showRoles={false}
            onToggle={(pid, on) => setMembers((m) => { const n = new Set(m); if (on) n.add(pid); else n.delete(pid); return n; })} />
        </Sheet>
      )}
    </div>
  );
}
