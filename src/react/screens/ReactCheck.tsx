import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { version as reactVersion } from 'react';
import { state } from '@/core/state';
import { Button } from '@/react/components/ui/button';
import type { ScreenProps } from './registry';

// A self-check page for the React setup (open the app with ?react-check). It proves, on the real page, that the pieces the
// upcoming screens need all work next to the old app: Tailwind utilities beat the old CSS reset, the app's theme colours
// and RTL direction reach React, a form with validation works, sticky headers work in RTL, and React can read the old state.
// It can be deleted at any time (see docs/REACT.md).

const schema = z.object({
  roleName: z.string().trim().min(2, 'اسم الدور لازم حرفين على الأقل'),
  gender: z.enum(['male', 'female']),
  isAdmin: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

type Check = { label: string; ok: boolean; detail?: string };

export default function ReactCheck({ close }: ScreenProps) {
  const probe = useRef<HTMLDivElement>(null);
  const accent = useRef<HTMLDivElement>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [saved, setSaved] = useState<FormValues | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { roleName: '', gender: 'male', isAdmin: false },
  });

  useEffect(() => {
    const root = document.documentElement;
    const pad = probe.current ? parseFloat(getComputedStyle(probe.current).paddingTop) : 0;
    const bg = accent.current ? getComputedStyle(accent.current).backgroundColor : '';
    setChecks([
      { label: 'React ' + reactVersion + ' is running (StrictMode)', ok: true },
      { label: 'Tailwind utility (tw:p-4) beats the old CSS reset', ok: pad > 0, detail: 'padding-top = ' + pad + 'px' },
      { label: 'App theme colours reach React (tw:bg-accent)', ok: !!bg && bg !== 'rgba(0, 0, 0, 0)', detail: bg },
      { label: 'RTL direction is inherited', ok: getComputedStyle(root).direction === 'rtl' && !!probe.current && getComputedStyle(probe.current).direction === 'rtl', detail: 'dir = ' + root.dir },
      { label: 'Old app state is readable from React', ok: typeof state === 'object' && state !== null, detail: 'activeGrade = ' + String(state.activeGrade ?? '(none yet: not logged in)') },
      { label: 'Section theme: ' + (root.classList.contains('girls') ? 'girls' : 'boys'), ok: true },
    ]);
  }, []);

  return (
    <div className="tw:mx-auto tw:max-w-3xl tw:p-4 tw:pb-16">
      <div className="tw:mb-4 tw:flex tw:items-center tw:justify-between">
        <h1 className="tw:text-xl tw:font-black">✅ React setup check</h1>
        {close && <Button variant="outline" size="sm" onClick={close}>إغلاق</Button>}
      </div>

      <section className="tw:mb-4 tw:rounded-card tw:border tw:border-line tw:bg-surface tw:p-4" ref={probe}>
        <h2 className="tw:mb-3 tw:text-sm tw:font-bold tw:text-dim">Checks</h2>
        <ul className="tw:space-y-2 tw:text-sm">
          {checks.map((c) => (
            <li key={c.label} className="tw:flex tw:gap-2">
              <span className={c.ok ? 'tw:text-ok' : 'tw:text-bad'}>{c.ok ? '✔' : '✘'}</span>
              <span>{c.label}{c.detail && <span className="tw:text-dim"> — {c.detail}</span>}</span>
            </li>
          ))}
        </ul>
        <div ref={accent} className="tw:mt-3 tw:h-2 tw:rounded-full tw:bg-accent" />
      </section>

      <section className="tw:mb-4 tw:rounded-card tw:border tw:border-line tw:bg-surface tw:p-4">
        <h2 className="tw:mb-3 tw:text-sm tw:font-bold tw:text-dim">Buttons</h2>
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="ghost">Ghost</Button>
          <Button size="sm" onClick={() => window.showToast?.('👋 from React', 'success')}>Toast (old code)</Button>
        </div>
      </section>

      <section className="tw:mb-4 tw:rounded-card tw:border tw:border-line tw:bg-surface tw:p-4">
        <h2 className="tw:mb-3 tw:text-sm tw:font-bold tw:text-dim">Form (react-hook-form + zod)</h2>
        <form onSubmit={handleSubmit((v) => setSaved(v))} className="tw:space-y-3" noValidate>
          <div>
            <label htmlFor="rc-name" className="tw:mb-1 tw:block tw:text-xs tw:font-bold tw:text-dim">اسم الدور</label>
            <input id="rc-name" {...register('roleName')} className="tw:h-10 tw:w-full tw:rounded-field tw:border tw:border-line tw:bg-surface-2 tw:px-3" />
            {errors.roleName && <p role="alert" className="tw:mt-1 tw:text-xs tw:text-bad">{errors.roleName.message}</p>}
          </div>
          <div>
            <label htmlFor="rc-gender" className="tw:mb-1 tw:block tw:text-xs tw:font-bold tw:text-dim">النوع</label>
            <select id="rc-gender" {...register('gender')} className="tw:h-10 tw:w-full tw:rounded-field tw:border tw:border-line tw:bg-surface-2 tw:px-3">
              <option value="male">male</option>
              <option value="female">female</option>
            </select>
          </div>
          <label className="tw:flex tw:items-center tw:gap-2 tw:text-sm">
            <input type="checkbox" {...register('isAdmin')} className="tw:size-4 tw:accent-accent" /> Admin (everything)
          </label>
          <Button type="submit">Save</Button>
        </form>
        {saved && <pre data-testid="saved" className="tw:mt-3 tw:rounded-field tw:bg-surface-2 tw:p-3 tw:text-xs" dir="ltr">{JSON.stringify(saved)}</pre>}
      </section>

      <section className="tw:rounded-card tw:border tw:border-line tw:bg-surface tw:p-4">
        <h2 className="tw:mb-3 tw:text-sm tw:font-bold tw:text-dim">Sticky header + first column (the roles matrix needs this)</h2>
        <div className="tw:max-h-56 tw:overflow-auto tw:rounded-field tw:border tw:border-line">
          <table className="tw:w-max tw:min-w-full tw:border-separate tw:border-spacing-0 tw:text-sm">
            <thead>
              <tr>
                <th className="tw:sticky tw:top-0 tw:start-0 tw:z-20 tw:bg-surface-2 tw:p-2 tw:text-start">Role</th>
                {['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'].map((g) => (
                  <th key={g} className="tw:sticky tw:top-0 tw:z-10 tw:bg-surface-2 tw:p-2">{g}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }, (_, r) => (
                <tr key={r}>
                  <th className="tw:sticky tw:start-0 tw:z-10 tw:whitespace-nowrap tw:bg-surface tw:p-2 tw:text-start">Role number {r + 1}</th>
                  {Array.from({ length: 8 }, (_, c) => (
                    <td key={c} className="tw:border-t tw:border-line tw:p-2 tw:text-center"><input type="checkbox" aria-label={`r${r}c${c}`} className="tw:size-4 tw:accent-accent" /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
