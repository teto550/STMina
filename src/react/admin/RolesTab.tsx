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

const GRADE_NAMES = ['', 'أولى', 'تانية', 'تالتة', 'رابعة', 'خامسة', 'سادسة'];
const mixedCols = GRADES.filter((g) => isMixedGrade(g)).map((g) => ({ key: `mixed${g}`, title: GRADE_NAMES[g] ?? '', cells: [cellOf('female', g), cellOf('male', g)] as Cell[] }));
const girlsCols = GRADES.filter((g) => !isMixedGrade(g)).map((g) => ({ key: `f${g}`, title: GRADE_NAMES[g] ?? '', cells: [cellOf('female', g)] as Cell[] }));
const boysCols = GRADES.filter((g) => !isMixedGrade(g)).map((g) => ({ key: `m${g}`, title: GRADE_NAMES[g] ?? '', cells: [cellOf('male', g)] as Cell[] }));
const groups = [
  { title: 'بنات وأولاد (خادمات)', cols: mixedCols },
  { title: 'بنات', cols: girlsCols },
  { title: 'بنين', cols: boysCols },
];
const columns = groups.flatMap((g) => g.cols);

/** Wide screens: roles x classes matrix with sticky header row and first column, and a side panel with the members of the selected role. */
export function RoleMatrix({ data, onOpen, onNew }: { data: AdminData; onOpen: (r: AdminRole) => void; onNew: () => void }) {
  const [selected, setSelected] = useState<string | null>(data.roles[0]?.id ?? null);
  // (after a save the list is reloaded: keep the selection if the role still exists)
  const sel = data.roles.find((r) => r.id === selected) ?? null;
  const head = 'tw:sticky tw:z-10 tw:bg-surface-2 tw:px-2 tw:text-xs tw:font-bold tw:whitespace-nowrap tw:border-b tw:border-line';
  return (
    <div className="tw:flex tw:gap-5 tw:p-4">
      <div className="tw:max-h-[72dvh] tw:min-w-0 tw:flex-1 tw:overflow-auto tw:rounded-card tw:border tw:border-line">
        <table className="tw:w-full tw:border-collapse tw:text-sm">
          <thead>
            <tr>
              <th rowSpan={2} className={cn(head, 'tw:top-0 tw:start-0 tw:z-20 tw:min-w-36 tw:text-start')}>الدور</th>
              {groups.map((g) => <th key={g.title} colSpan={g.cols.length} className={cn(head, 'tw:top-0 tw:h-9 tw:border-s tw:border-line tw:text-center tw:text-accent')}>{g.title}</th>)}
              <th rowSpan={2} className={cn(head, 'tw:top-0 tw:border-s tw:border-line')}>أدمن</th>
              <th rowSpan={2} className={cn(head, 'tw:top-0')}>الأعضاء</th>
            </tr>
            <tr>
              {groups.flatMap((g) => g.cols.map((c, i) => <th key={c.key} className={cn(head, 'tw:top-9 tw:h-9 tw:text-center tw:text-dim', i === 0 && 'tw:border-s tw:border-line')}>{c.title}</th>))}
            </tr>
          </thead>
          <tbody>
            {data.roles.map((r) => (
              <tr key={r.id} className={cn('tw:cursor-pointer tw:hover:bg-surface-2', selected === r.id && 'tw:bg-surface-2')} onClick={() => setSelected(r.id)}>
                <th scope="row" className="tw:sticky tw:start-0 tw:bg-surface tw:px-3 tw:py-2 tw:text-start tw:font-bold tw:border-b tw:border-line">{r.name}</th>
                {columns.map((c) => <td key={c.key} className="tw:h-11 tw:min-w-10 tw:border-b tw:border-line tw:text-center tw:text-base tw:font-bold tw:text-ok">{!r.admin && c.cells.every((x) => r.cells.includes(x)) ? '✓' : ''}</td>)}
                <td className="tw:border-s tw:border-b tw:border-line tw:text-center tw:text-base tw:font-bold tw:text-warn">{r.admin ? '✓' : ''}</td>
                <td className="tw:border-b tw:border-line tw:text-center">{membersOf(r.id, data.people).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.roles.length === 0 && <p className="tw:py-10 tw:text-center tw:text-dim">مفيش أدوار لسه. دوس "+ دور جديد" واعمل أول دور.</p>}
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
