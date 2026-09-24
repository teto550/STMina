import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/react/components/ui/button';
import { loadAdminData } from '@/react/admin/data';
import { PeopleTab } from '@/react/admin/PeopleTab';
import { RoleEditor } from '@/react/admin/RoleEditor';
import { RoleCards, RoleMatrix } from '@/react/admin/RolesTab';
import type { AdminData, AdminRole } from '@/react/admin/types';
import { Segmented } from '@/react/admin/ui';
import type { ScreenProps } from './registry';

type Tab = 'roles' | 'people';

function useIsWide(): boolean {
  const query = '(min-width: 768px)';
  const [wide, setWide] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const m = window.matchMedia(query);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

/** "المستخدمين والأدوار": the admin screen for roles and who holds them. Same in the boys' and the girls' section. */
export default function AdminRoles({ close }: ScreenProps) {
  const wide = useIsWide();
  const [data, setData] = useState<AdminData | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>('roles');
  const [editing, setEditing] = useState<{ role: AdminRole | null } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setFailed(false);
    try { setData(await loadAdminData()); } catch (e) { console.warn(e); setFailed(true); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const changed = async (message: string) => { setEditing(null); setNote(message); await reload(); window.showToast?.(message, 'success'); };

  return (
    <div className="tw:min-h-dvh tw:bg-bg">
      <header className="tw:sticky tw:top-0 tw:z-20 tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-line tw:bg-surface tw:px-3 tw:py-2">
        {close && <Button variant="ghost" size="icon" aria-label="رجوع" onClick={close}>→</Button>}
        <h1 className="tw:text-base tw:font-bold">المستخدمين والأدوار</h1>
      </header>
      {editing && data ? (
        <RoleEditor role={editing.role} data={data} onDone={changed} onCancel={() => setEditing(null)} />
      ) : (
        <div className="tw:mx-auto tw:max-w-6xl">
          <div className="tw:mx-auto tw:max-w-md tw:p-3"><Segmented<Tab> label="القسم" value={tab} onChange={setTab} options={[{ value: 'roles', label: 'الأدوار' }, { value: 'people', label: 'الأشخاص' }]} /></div>
          {note && <p role="status" className="tw:px-4 tw:text-sm tw:text-ok">{note}</p>}
          {failed && <div className="tw:p-6 tw:text-center"><p className="tw:mb-3 tw:text-bad">مقدرناش نحمّل البيانات</p><Button onClick={() => void reload()}>حاول تاني</Button></div>}
          {!data && !failed && <p className="tw:p-6 tw:text-center tw:text-dim">جاري التحميل…</p>}
          {data && tab === 'roles' && (wide
            ? <RoleMatrix data={data} onOpen={(role) => setEditing({ role })} onNew={() => setEditing({ role: null })} />
            : <RoleCards data={data} onOpen={(role) => setEditing({ role })} onNew={() => setEditing({ role: null })} />)}
          {data && tab === 'people' && <div className="tw:mx-auto tw:max-w-2xl"><PeopleTab data={data} onChanged={(m) => void changed(m)} /></div>}
        </div>
      )}
    </div>
  );
}
