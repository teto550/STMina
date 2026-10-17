import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithQuery } from '@/test/render';
import type { Part } from '@/api/parts';

const h = vi.hoisted(() => ({ fetchParts: vi.fn(), createPart: vi.fn(), updatePart: vi.fn(), deletePart: vi.fn() }));
vi.mock('@/api/occasions', () => ({ fetchOccasions: vi.fn(async () => []), addOccasion: vi.fn(), updateOccasion: vi.fn(), deleteOccasion: vi.fn(), yearOf: (d: string) => Number(d.slice(0, 4)) }));
vi.mock('@/api/parts', () => ({ fetchParts: h.fetchParts, createPart: h.createPart, updatePart: h.updatePart, deletePart: h.deletePart }));

import PartsScreen from '@/react/screens/parts';

const part = (id: string, date: string, over: Partial<Part> = {}): Part => ({ id, grade: 'سنة رابعة ابتدائي', type: '', title: id, date, deaconName: '', ...over });
const parts = [
  part('ترنيمة الدخول', '2030-10-18', { type: 'الترانيم', deaconName: 'مينا' }),
  part('فقرة من غير نوع', '2030-10-18'),
  part('درس الإثنين', '2030-10-21', { type: 'الدرس', deaconName: 'ماركو' }),
];

// each test uses its own class: which days are open is remembered per class while the app runs
let classNo = 0;
function setup(over: Partial<React.ComponentProps<typeof PartsScreen>> = {}) {
  h.fetchParts.mockResolvedValue(parts);
  renderWithQuery(<PartsScreen grade={`سنة رابعة ${++classNo}`} section="boys" canManage isAdmin={false} servants={['مينا', 'ماركو']} user={{ uid: 'u1', name: 'المسؤول' }} {...over} />);
  return { user: userEvent.setup() };
}
const open = async (user: ReturnType<typeof userEvent.setup>, header: RegExp) => user.click(await screen.findByRole('button', { name: header }));

beforeEach(() => {
  Object.values(h).forEach((m) => m.mockReset());
  h.createPart.mockImplementation(async ({ input, grade }: { input: Record<string, string>; grade: string }) => ({ id: 'new', grade, ...input }));
  h.updatePart.mockImplementation(async ({ before, input }: { before: Part; input: Record<string, string> }) => ({ ...before, ...input }));
  h.deletePart.mockResolvedValue(undefined);
});

describe('PartsScreen: the list (loader, error, empty, data)', () => {
  it('shows a loader, then the parts grouped by day, each day closed until tapped', async () => {
    let finish: (v: Part[]) => void = () => undefined;
    h.fetchParts.mockImplementation(() => new Promise((r) => { finish = r; }));
    renderWithQuery(<PartsScreen grade="سنة رابعة ابتدائي" section="boys" canManage isAdmin={false} servants={[]} user={{ uid: 'u', name: 'n' }} />);
    expect(await screen.findByRole('status', { name: 'جاري تحميل الفقرات…' })).toBeInTheDocument();
    finish(parts);
    expect(await screen.findByRole('button', { name: /يوم الجمعة 18-10/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /يوم الاثنين 21-10/ })).toBeInTheDocument(); // any day, not only Fridays
    expect(screen.queryByText('ترنيمة الدخول')).not.toBeInTheDocument();
  });

  it('the latest day is first, and the next day from today on stays green wherever it is', async () => {
    const dayParts = [part('أ', '2030-10-18'), part('ب', '2030-10-21'), part('ج', '2030-10-25'), part('قديمة', '2020-01-03')];
    h.fetchParts.mockResolvedValue(dayParts);
    renderWithQuery(<PartsScreen grade="سنة رابعة 99" section="boys" canManage isAdmin={false} servants={[]} user={{ uid: 'u', name: 'n' }} />);
    const heads = await screen.findAllByRole('button', { expanded: false });
    expect(heads.map((b) => b.textContent)).toEqual([
      expect.stringContaining('يوم الجمعة 25-10'), expect.stringContaining('يوم الاثنين 21-10'), expect.stringContaining('يوم الجمعة 18-10'), expect.stringContaining('يوم الجمعة 3-1'),
    ]);
    const card = (name: RegExp) => screen.getByRole('button', { name }).closest('li');
    expect(card(/يوم الجمعة 18-10/)).toHaveClass('tw:border-ok/40'); // the NEXT day: green, in the middle of the list
    expect(card(/يوم الاثنين 21-10/)).not.toHaveClass('tw:border-ok/40');
    expect(card(/يوم الجمعة 25-10/)).not.toHaveClass('tw:border-ok/40');
  });

  it('a part without a type or a servant still shows (title only, "no servant yet")', async () => {
    const { user } = setup();
    await open(user, /يوم الجمعة 18-10/);
    expect(screen.getByText('ترنيمة الدخول')).toBeInTheDocument();
    expect(screen.getByText('فقرة من غير نوع')).toBeInTheDocument();
    expect(screen.getByText('👤 لسه ماتحددش خادم')).toBeInTheDocument();
    expect(screen.getByText('👤 مينا')).toBeInTheDocument();
  });

  it('error with a retry, and the empty state', async () => {
    const user = userEvent.setup();
    h.fetchParts.mockRejectedValueOnce(new Error('offline')).mockResolvedValue([]);
    renderWithQuery(<PartsScreen grade="سنة رابعة ابتدائي" section="boys" canManage isAdmin={false} servants={[]} user={{ uid: 'u', name: 'n' }} />);
    expect(await screen.findByText('مقدرناش نجيب الفقرات.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'حاول تاني' }));
    expect(await screen.findByText(/لسه مفيش فقرات متوزعة/)).toBeInTheDocument();
  });

  it('a reader who is not the manager cannot add, edit or delete', async () => {
    const { user } = setup({ canManage: false });
    await open(user, /يوم الجمعة 18-10/);
    expect(screen.queryByRole('button', { name: 'إضافة فقرة' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^إضافة فقرة تانية/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^تعديل/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^حذف/ })).not.toBeInTheDocument();
  });
});

describe('PartsScreen: adding', () => {
  it('a part with only a title and a day is saved (no type, no servant) and its day opens', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'إضافة فقرة' }));
    const sheet = within(screen.getByRole('dialog', { name: 'إضافة فقرة' }));
    await user.type(sheet.getByLabelText(/تفاصيل الفقرة/), 'ترنيمة جديدة');
    await user.clear(sheet.getByLabelText(/اليوم/));
    await user.type(sheet.getByLabelText(/اليوم/), '2030-10-22');
    await user.click(sheet.getByRole('button', { name: '💾 حفظ' }));
    await waitFor(() => expect(h.createPart).toHaveBeenCalled());
    expect(h.createPart.mock.calls[0]![0]).toMatchObject({ grade: expect.stringContaining('سنة رابعة'), section: 'boys', by: { uid: 'u1', name: 'المسؤول' }, input: { type: '', title: 'ترنيمة جديدة', date: '2030-10-22', deaconName: '' } });
    expect(await screen.findByText('ترنيمة جديدة')).toBeInTheDocument(); // the new day is open
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('the title and the day are required', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'إضافة فقرة' }));
    const sheet = within(screen.getByRole('dialog', { name: 'إضافة فقرة' }));
    await user.click(sheet.getByRole('button', { name: '💾 حفظ' }));
    expect(await sheet.findByText('اكتب تفاصيل الفقرة')).toBeInTheDocument();
    expect(h.createPart).not.toHaveBeenCalled();
  });

  it('every day has a + that adds another part on THAT day (the day is filled in)', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: /إضافة فقرة تانية في الاثنين 21-10/ }));
    const sheet = within(screen.getByRole('dialog', { name: 'إضافة فقرة' }));
    expect(sheet.getByLabelText(/اليوم/)).toHaveValue('2030-10-21');
  });

  it('"حفظ وفقرة تانية" saves and keeps the sheet open on the same day, with the rest cleared', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: /إضافة فقرة تانية في الجمعة 18-10/ }));
    const sheet = within(screen.getByRole('dialog', { name: 'إضافة فقرة' }));
    await user.type(sheet.getByLabelText(/تفاصيل الفقرة/), 'الأولى');
    await user.selectOptions(sheet.getByLabelText(/نوع الفقرة/), 'الدرس');
    await user.click(sheet.getByRole('button', { name: '💾 حفظ وفقرة تانية' }));
    await waitFor(() => expect(h.createPart).toHaveBeenCalledTimes(1));
    expect(await sheet.findByText(/اتضافت "الأولى"/)).toBeInTheDocument();
    expect(sheet.getByLabelText(/تفاصيل الفقرة/)).toHaveValue('');
    expect(sheet.getByLabelText(/نوع الفقرة/)).toHaveValue('');
    expect(sheet.getByLabelText(/اليوم/)).toHaveValue('2030-10-18');
    await user.type(sheet.getByLabelText(/تفاصيل الفقرة/), 'التانية');
    await user.click(sheet.getByRole('button', { name: '💾 حفظ' }));
    await waitFor(() => expect(h.createPart).toHaveBeenCalledTimes(2));
    expect(h.createPart.mock.calls[1]![0]).toMatchObject({ input: { title: 'التانية', date: '2030-10-18' } });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('says so and stays open when the part cannot be saved', async () => {
    h.createPart.mockRejectedValue(new Error('denied'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'إضافة فقرة' }));
    const sheet = within(screen.getByRole('dialog', { name: 'إضافة فقرة' }));
    await user.type(sheet.getByLabelText(/تفاصيل الفقرة/), 'x');
    await user.click(sheet.getByRole('button', { name: '💾 حفظ' }));
    expect(await sheet.findByText('مقدرناش نحفظ الفقرة، جرّب تاني')).toBeInTheDocument();
  });
});

describe('PartsScreen: keyboard friendly on a phone', () => {
  it('adding opens with the title focused (the keyboard comes up), asking for a "done" key', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'إضافة فقرة' }));
    const title = within(screen.getByRole('dialog', { name: 'إضافة فقرة' })).getByLabelText(/تفاصيل الفقرة/);
    expect(title).toHaveFocus();
    expect(title).toHaveAttribute('enterkeyhint', 'done');
    expect(title).toHaveAttribute('autocomplete', 'off');
  });

  it('editing does not pop the keyboard up (you may only want to pick the type or the servant)', async () => {
    const { user } = setup();
    await open(user, /يوم الاثنين 21-10/);
    await user.click(screen.getByRole('button', { name: 'تعديل درس الإثنين' }));
    expect(within(screen.getByRole('dialog', { name: 'تعديل الفقرة' })).getByLabelText(/تفاصيل الفقرة/)).not.toHaveFocus();
  });

  it('Enter on the keyboard saves', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'إضافة فقرة' }));
    await user.keyboard('ترنيمة سريعة{Enter}');
    await waitFor(() => expect(h.createPart).toHaveBeenCalledTimes(1));
    expect(h.createPart.mock.calls[0]![0]).toMatchObject({ input: { title: 'ترنيمة سريعة' } });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('after "وفقرة تانية" the title is focused again and Enter keeps adding parts to the day', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: /إضافة فقرة تانية في الاثنين 21-10/ }));
    const sheet = within(screen.getByRole('dialog', { name: 'إضافة فقرة' }));
    await user.type(sheet.getByLabelText(/تفاصيل الفقرة/), 'الأولى');
    await user.click(sheet.getByRole('button', { name: '💾 حفظ وفقرة تانية' }));
    await waitFor(() => expect(h.createPart).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(sheet.getByLabelText(/تفاصيل الفقرة/)).toHaveFocus()); // the keyboard stays open
    await user.keyboard('التانية{Enter}');
    await waitFor(() => expect(h.createPart).toHaveBeenCalledTimes(2));
    expect(h.createPart.mock.calls[1]![0]).toMatchObject({ input: { title: 'التانية', date: '2030-10-21' } });
    expect(screen.getByRole('dialog', { name: 'إضافة فقرة' })).toBeInTheDocument(); // still open: Enter used the same way as the last button
    await waitFor(() => expect(sheet.getByLabelText(/تفاصيل الفقرة/)).toHaveFocus());
  });
});

describe('PartsScreen: editing and deleting', () => {
  it('gives a part its type and servant later', async () => {
    const { user } = setup();
    await open(user, /يوم الجمعة 18-10/);
    await user.click(screen.getByRole('button', { name: 'تعديل فقرة من غير نوع' }));
    const sheet = within(screen.getByRole('dialog', { name: 'تعديل الفقرة' }));
    expect(sheet.getByLabelText(/تفاصيل الفقرة/)).toHaveValue('فقرة من غير نوع');
    expect(sheet.queryByRole('button', { name: '💾 حفظ وفقرة تانية' })).not.toBeInTheDocument();
    await user.selectOptions(sheet.getByLabelText(/نوع الفقرة/), 'الصلاة');
    await user.selectOptions(sheet.getByLabelText(/الخادم/), 'ماركو');
    await user.click(sheet.getByRole('button', { name: '💾 حفظ' }));
    await waitFor(() => expect(h.updatePart).toHaveBeenCalled());
    expect(h.updatePart.mock.calls[0]![0]).toMatchObject({ before: { id: 'فقرة من غير نوع' }, input: { type: 'الصلاة', deaconName: 'ماركو', title: 'فقرة من غير نوع' } });
    expect(await screen.findByText('👤 ماركو')).toBeInTheDocument();
  });

  it('deleting asks once, then removes the part from the list', async () => {
    const { user } = setup();
    await open(user, /يوم الاثنين 21-10/);
    await user.click(screen.getByRole('button', { name: 'حذف درس الإثنين' }));
    expect(h.deletePart).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'أكيد؟ امسح' }));
    await waitFor(() => expect(h.deletePart).toHaveBeenCalledWith('درس الإثنين'));
    await waitFor(() => expect(screen.queryByText('درس الإثنين')).not.toBeInTheDocument());
  });
});
