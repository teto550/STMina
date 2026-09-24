import { useMemo, useState } from 'react';
import { filterPeople, blockedReason, rolesOfPerson } from './logic';
import type { AdminData, AdminPerson, AdminRole } from './types';
import { CheckRow, Chip, Segmented, inputClass } from './ui';
import type { Gender } from '@/types/access';

type GenderFilter = Gender | 'all';

/** Searchable list of ALL servants (male and female) with checkboxes; the search and the gender filter run in the browser. */
export function PersonList({ data, selected, onToggle, forRole, showRoles = true, extraFilter }: {
  data: AdminData; selected: Set<string>; onToggle: (id: string, on: boolean) => void;
  /** when picking members of a role: people whose gender does not fit are disabled with the reason */
  forRole?: Pick<AdminRole, 'cells' | 'admin'>; showRoles?: boolean;
  extraFilter?: { roleId: string; setRoleId: (v: string) => void };
}) {
  const [query, setQuery] = useState('');
  const [gender, setGender] = useState<GenderFilter>('all');
  const roleId = extraFilter?.roleId ?? 'all';
  const list = useMemo(() => filterPeople(data.people, { query, gender, roleId }), [data.people, query, gender, roleId]);
  const label = (p: AdminPerson) => (p.gender === 'female' ? 'خادمة' : 'خادم');
  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      <input className={inputClass} type="search" placeholder="🔍 دوّر على اسم" aria-label="بحث بالاسم" value={query} onChange={(e) => setQuery(e.target.value)} />
      <Segmented<GenderFilter> label="النوع" value={gender} onChange={setGender}
        options={[{ value: 'all', label: 'الكل' }, { value: 'male', label: 'خدام' }, { value: 'female', label: 'خادمات' }]} />
      {extraFilter && (
        <select className={inputClass} aria-label="الدور" value={extraFilter.roleId} onChange={(e) => extraFilter.setRoleId(e.target.value)}>
          <option value="all">كل الأدوار</option>
          <option value="none">من غير دور</option>
          {data.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      )}
      <div className="tw:text-xs tw:text-dim" aria-live="polite">{list.length} من {data.people.length}</div>
      <ul className="tw:flex tw:flex-col">
        {list.map((p) => {
          const why = forRole ? blockedReason(p, forRole) : null;
          const roles = showRoles ? rolesOfPerson(p, data.roles) : [];
          const linked = data.accounts.some((a) => a.deaconId === p.id);
          return (
            <li key={p.id}>
              <CheckRow checked={selected.has(p.id)} disabled={!!why && !selected.has(p.id)} onChange={(v) => onToggle(p.id, v)} hint={why ?? undefined}>
                <span className="tw:flex tw:flex-wrap tw:items-center tw:gap-x-2 tw:gap-y-1">
                  <span className="tw:font-bold">{p.name}</span>
                  <span className="tw:text-xs tw:text-dim">{label(p)}{linked ? ' · مسجّل' : ''}</span>
                  {roles.map((r) => <Chip key={r.id} tone={r.admin ? 'admin' : 'plain'}>{r.name}</Chip>)}
                </span>
              </CheckRow>
            </li>
          );
        })}
        {list.length === 0 && <li className="tw:py-6 tw:text-center tw:text-dim">مفيش نتايج</li>}
      </ul>
    </div>
  );
}
