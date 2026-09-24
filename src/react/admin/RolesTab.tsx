import { useState } from 'react';
import { Button } from '@/react/components/ui/button';
import { membersOf } from './logic';
import type { AdminData, AdminRole } from './types';
import { CellChips, Chip } from './ui';
import { cn } from '@/react/lib/utils';
import { GRADES, cellOf, isMixedGrade } from '@/core/access-config';
import type { Cell } from '@/types/access';

/** Mobile: one card per role. */
export function RoleCards({ data, onOpen, onNew }: { data: AdminData; onOpen: (r: AdminRole) => void; onNew: () => void }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-3 tw:p-4">
      <Button onClick={onNew}>+ دور جديد</Button>
      {data.roles.map((r) => (
        <button key={r.id} type="button" onClick={() => onOpen(r)} className="tw:flex tw:cursor-pointer tw:flex-col tw:gap-2 tw:rounded-card tw:border tw:border-line tw:bg-surface tw:p-4 tw:text-start">
          <span className="tw:flex tw:items-center tw:justify-between"><span className="tw:text-base tw:font-bold">{r.name}</span><span className="tw:text-sm tw:text-dim">{membersOf(r.id, data.people).length} شخص</span></span>
          <span className="tw:flex tw:flex-wrap tw:gap-1.5">{r.admin ? <Chip tone="admin">أدمن</Chip> : <CellChips cells={r.cells} />}</span>
        </button>
      ))}
      {data.roles.length === 0 && <p className="tw:py-8 tw:text-center tw:text-dim">مفيش أدوار لسه. اعمل أول دور.</p>}
    </div>
  );
}

const columns: { key: string; title: string; cells: Cell[] }[] = [
  ...GRADES.filter((g) => isMixedGrade(g)).map((g) => ({ key: `mixed${g}`, title: `${g} بنات وأولاد`, cells: [cellOf('female', g), cellOf('male', g)] })),
  ...GRADES.filter((g) => !isMixedGrade(g)).map((g) => ({ key: `f${g}`, title: `${g} بنات`, cells: [cellOf('female', g)] })),
  ...GRADES.filter((g) => !isMixedGrade(g)).map((g) => ({ key: `m${g}`, title: `${g} بنين`, cells: [cellOf('male', g)] })),
];

/** Wide screens: roles x classes matrix with sticky header row and first column, and a side panel with the members of the selected role. */
export function RoleMatrix({ data, onOpen, onNew }: { data: AdminData; onOpen: (r: AdminRole) => void; onNew: () => void }) {
  const [selected, setSelected] = useState<string | null>(data.roles[0]?.id ?? null);
  const sel = data.roles.find((r) => r.id === selected) ?? null;
  const head = 'tw:sticky tw:top-0 tw:z-10 tw:bg-surface-2 tw:px-2 tw:py-2 tw:text-xs tw:font-bold tw:whitespace-nowrap tw:border-b tw:border-line';
  return (
    <div className="tw:flex tw:gap-4 tw:p-4">
      <div className="tw:max-h-[70dvh] tw:min-w-0 tw:flex-1 tw:overflow-auto tw:rounded-card tw:border tw:border-line">
        <table className="tw:w-full tw:border-collapse tw:text-sm">
          <thead>
            <tr>
              <th className={cn(head, 'tw:start-0 tw:z-20 tw:text-start')}>الدور</th>
              {columns.map((c) => <th key={c.key} className={head}>{c.title}</th>)}
              <th className={head}>أدمن</th><th className={head}>الأعضاء</th>
            </tr>
          </thead>
          <tbody>
            {data.roles.map((r) => (
              <tr key={r.id} className={cn('tw:cursor-pointer tw:hover:bg-surface-2', selected === r.id && 'tw:bg-surface-2')} onClick={() => setSelected(r.id)}>
                <th scope="row" className="tw:sticky tw:start-0 tw:bg-surface tw:px-3 tw:py-2 tw:text-start tw:font-bold tw:border-b tw:border-line">{r.name}</th>
                {columns.map((c) => <td key={c.key} className="tw:border-b tw:border-line tw:text-center">{!r.admin && c.cells.every((x) => r.cells.includes(x)) ? '✓' : ''}</td>)}
                <td className="tw:border-b tw:border-line tw:text-center">{r.admin ? '✓' : ''}</td>
                <td className="tw:border-b tw:border-line tw:text-center">{membersOf(r.id, data.people).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <aside className="tw:flex tw:w-72 tw:shrink-0 tw:flex-col tw:gap-3 tw:rounded-card tw:border tw:border-line tw:bg-surface tw:p-4" aria-label="أعضاء الدور">
        <Button onClick={onNew}>+ دور جديد</Button>
        {sel ? (
          <>
            <div className="tw:flex tw:items-center tw:justify-between"><h3 className="tw:font-bold">{sel.name}</h3><Button size="sm" variant="secondary" onClick={() => onOpen(sel)}>تعديل</Button></div>
            <ul className="tw:flex tw:flex-col tw:gap-1 tw:text-sm">
              {membersOf(sel.id, data.people).map((p) => <li key={p.id}>{p.name}</li>)}
              {membersOf(sel.id, data.people).length === 0 && <li className="tw:text-dim">مفيش أعضاء</li>}
            </ul>
          </>
        ) : <p className="tw:text-dim">اختار دور</p>}
      </aside>
    </div>
  );
}
