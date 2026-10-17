import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithQuery } from '@/test/render';
import type { Occasion } from '@/api/occasions';

const h = vi.hoisted(() => ({ fetchOccasions: vi.fn(), addOccasion: vi.fn(), updateOccasion: vi.fn(), deleteOccasion: vi.fn(), fetchParts: vi.fn(), createPart: vi.fn() }));
vi.mock('@/api/occasions', () => ({
  fetchOccasions: h.fetchOccasions, addOccasion: h.addOccasion, updateOccasion: h.updateOccasion, deleteOccasion: h.deleteOccasion,
  yearOf: (date: string) => Number(date.slice(0, 4)),
}));
vi.mock('@/api/parts', () => ({ fetchParts: h.fetchParts, createPart: h.createPart, updatePart: vi.fn(), deletePart: vi.fn() }));

import PartsScreen from '@/react/screens/parts';

const occ = (id: string, date: string, title = id): Occasion => ({ id, title, date });
const y2026 = [occ('عيد النيروز', '2026-09-11'), occ('صوم الميلاد', '2026-11-25'), occ('عيد الميلاد الغربي', '2026-12-25'), occ('عيد القيامة', '2026-04-12')];

function setup(over: Partial<React.ComponentProps<typeof PartsScreen>> = {}) {
  h.fetchParts.mockResolvedValue([]);
  h.fetchOccasions.mockImplementation(async (year: number) => (year === 2026 ? y2026 : []));
  renderWithQuery(<PartsScreen grade="سنة رابعة ابتدائي" section="boys" canManage isAdmin servants={['مينا']} user={{ uid: 'u1', name: 'المسؤول' }} {...over} />);
  return { user: userEvent.setup() };
}
const openList = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: /المناسبات/ }));
  return within(await screen.findByRole('dialog', { name: '🗓 المناسبات' }));
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 17)); // 17 October 2026
  Object.values(h).forEach((m) => m.mockReset());
  h.addOccasion.mockImplementation(async (input: { title: string; date: string }) => ({ id: 'new', ...input }));
  h.updateOccasion.mockImplementation(async (before: Occasion, input: { title: string; date: string }) => ({ ...before, ...input }));
  h.deleteOccasion.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('Occasions: the popup under توزيع الفقرات', () => {
  it('is loaded only when opened, one year (the current one), with the coming occasions first and then the ones that passed', async () => {
    const { user } = setup();
    await screen.findByRole('button', { name: /المناسبات/ });
    const sheet = await openList(user);
    await waitFor(() => expect(h.fetchOccasions).toHaveBeenCalledWith(2026));
    expect(h.fetchOccasions).toHaveBeenCalledTimes(1); // the card on top already read this year: the popup reuses it
    const coming = within(await sheet.findByRole('region', { name: 'الجاية' }));
    expect(coming.getAllByRole('listitem').map((li) => li.textContent)).toEqual([expect.stringContaining('صوم الميلاد'), expect.stringContaining('عيد الميلاد الغربي')]);
    const passed = within(sheet.getByRole('region', { name: 'اللي عدّت' }));
    expect(passed.getAllByRole('listitem').map((li) => li.textContent)).toEqual([expect.stringContaining('عيد النيروز'), expect.stringContaining('عيد القيامة')]); // the most recent first
    expect(sheet.getByText('بعد 39 يوم')).toBeInTheDocument(); // 25 Nov
  });

  it('‹ › move to the previous / next year (each year is its own batch); an empty year says so', async () => {
    const { user } = setup();
    const sheet = await openList(user);
    await sheet.findByRole('region', { name: 'الجاية' });
    await user.click(sheet.getByRole('button', { name: 'سنة 2027' }));
    expect(await sheet.findByText(/مفيش مناسبات متسجلة في 2027/)).toBeInTheDocument();
    expect(h.fetchOccasions).toHaveBeenCalledWith(2027);
    expect(sheet.getByRole('heading', { name: '2027' })).toBeInTheDocument();
    await user.click(sheet.getByRole('button', { name: 'سنة 2026' }));
    expect(await sheet.findByRole('region', { name: 'الجاية' })).toBeInTheDocument();
  });

  it('shows a loader and an error with a retry', async () => {
    const user = userEvent.setup();
    h.fetchParts.mockResolvedValue([]);
    // the card on top fails first, opening the popup tries again (also failing), then the retry button works
    h.fetchOccasions.mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(y2026);
    renderWithQuery(<PartsScreen grade="سنة رابعة ابتدائي" section="boys" canManage isAdmin servants={[]} user={{ uid: 'u', name: 'n' }} />);
    const sheet = await openList(user);
    expect(await sheet.findByText('مقدرناش نجيب المناسبات.')).toBeInTheDocument();
    await user.click(sheet.getByRole('button', { name: 'حاول تاني' }));
    expect(await sheet.findByRole('region', { name: 'الجاية' })).toBeInTheDocument();
  });

  it('"تحديث" reads the year again from Firestore, ignoring the kept copy', async () => {
    const { user } = setup();
    const sheet = await openList(user);
    await sheet.findByRole('region', { name: 'الجاية' });
    await user.click(sheet.getByRole('button', { name: /تحديث/ }));
    await waitFor(() => expect(h.fetchOccasions).toHaveBeenCalledWith(2026, { force: true }));
  });
});

describe('Occasions: the next one in a card under the tabs', () => {
  const card = () => screen.findByRole('button', { name: /المناسبة الجاية/ });

  it('shows the next occasion with its day and how far it is, above the title of the tab', async () => {
    setup();
    const c = await card();
    expect(c).toHaveTextContent('صوم الميلاد');
    expect(c).toHaveTextContent('الأربعاء 25-11');
    expect(c).toHaveTextContent('بعد 39 يوم');
    expect(c).toHaveClass('tw:border-ok/40'); // green
    // it comes before the heading of the tab
    const heading = screen.getByRole('heading', { name: /توزيع الفقرات/ });
    expect(c.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('tapping the card opens the whole list', async () => {
    const { user } = setup();
    await user.click(await card());
    expect(await screen.findByRole('dialog', { name: '🗓 المناسبات' })).toBeInTheDocument();
    expect(h.fetchOccasions).toHaveBeenCalledTimes(1); // no second read
  });

  it('says when other occasions fall on the same day', async () => {
    h.fetchParts.mockResolvedValue([]);
    h.fetchOccasions.mockImplementation(async () => [occ('أ', '2026-10-20', 'عيد أ'), occ('ب', '2026-10-20', 'عيد ب'), occ('ج', '2026-10-20', 'عيد ج')]);
    renderWithQuery(<PartsScreen grade="سنة رابعة ابتدائي" section="boys" canManage isAdmin servants={[]} user={{ uid: 'u', name: 'n' }} />);
    expect(await card()).toHaveTextContent('وفيه 2 مناسبات تانية نفس اليوم');
  });

  it('there is no card when nothing is left, or when the list cannot be read', async () => {
    h.fetchParts.mockResolvedValue([]);
    h.fetchOccasions.mockRejectedValue(new Error('offline'));
    renderWithQuery(<PartsScreen grade="سنة رابعة ابتدائي" section="boys" canManage isAdmin servants={[]} user={{ uid: 'u', name: 'n' }} />);
    await screen.findByRole('heading', { name: /توزيع الفقرات/ });
    await waitFor(() => expect(h.fetchOccasions).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /المناسبة الجاية/ })).not.toBeInTheDocument();
  });

  it('at the end of the year, with nothing left, it looks at the next year', async () => {
    vi.setSystemTime(new Date(2026, 11, 30));
    h.fetchParts.mockResolvedValue([]);
    h.fetchOccasions.mockImplementation(async (year: number) => (year === 2027 ? [occ('م', '2027-01-07', 'عيد الميلاد المجيد')] : [occ('ق', '2026-04-12', 'عيد القيامة')]));
    renderWithQuery(<PartsScreen grade="سنة رابعة ابتدائي" section="boys" canManage isAdmin servants={[]} user={{ uid: 'u', name: 'n' }} />);
    expect(await card()).toHaveTextContent('عيد الميلاد المجيد');
    expect(h.fetchOccasions).toHaveBeenCalledWith(2027);
  });

  it('a year that still has an occasion left does not read the next year', async () => {
    setup();
    await card();
    expect(h.fetchOccasions).not.toHaveBeenCalledWith(2027);
  });
});

describe('Occasions: add an occasion as a part', () => {
  it('"➕ فقرة" opens the part form with the occasion as the title and the day LEFT EMPTY (required)', async () => {
    const { user } = setup();
    const sheet = await openList(user);
    await user.click(await sheet.findByRole('button', { name: 'إضافة صوم الميلاد كفقرة' }));
    expect(screen.queryByRole('dialog', { name: '🗓 المناسبات' })).not.toBeInTheDocument();
    const form = within(screen.getByRole('dialog', { name: 'إضافة فقرة' }));
    expect(form.getByLabelText(/تفاصيل الفقرة/)).toHaveValue('صوم الميلاد');
    expect(form.getByLabelText(/اليوم/)).toHaveValue('');
    expect(form.getByLabelText(/اليوم/)).toHaveFocus(); // the title is known, the day is what is missing
    // the day is required: saving without it is refused
    await user.click(form.getByRole('button', { name: '💾 حفظ' }));
    expect(await form.findByText('اختر ميعاد الفقرة')).toBeInTheDocument();
    expect(h.createPart).not.toHaveBeenCalled();
  });

  it('with a day picked, the part is saved with the occasion as its title', async () => {
    h.createPart.mockImplementation(async ({ input, grade }: { input: Record<string, string>; grade: string }) => ({ id: 'p', grade, ...input }));
    const { user } = setup();
    const sheet = await openList(user);
    await user.click(await sheet.findByRole('button', { name: 'إضافة عيد الميلاد الغربي كفقرة' }));
    const form = within(screen.getByRole('dialog', { name: 'إضافة فقرة' }));
    await user.type(form.getByLabelText(/اليوم/), '2027-01-07');
    await user.click(form.getByRole('button', { name: '💾 حفظ' }));
    await waitFor(() => expect(h.createPart).toHaveBeenCalled());
    expect(h.createPart.mock.calls[0]![0]).toMatchObject({ input: { title: 'عيد الميلاد الغربي', date: '2027-01-07', type: '', deaconName: '' } });
  });

  it('someone who is not the manager of the class cannot add occasions as parts', async () => {
    const { user } = setup({ canManage: false });
    const sheet = await openList(user);
    await sheet.findByRole('region', { name: 'الجاية' });
    expect(sheet.queryByRole('button', { name: /كفقرة/ })).not.toBeInTheDocument();
  });
});

describe('Occasions: an admin manages the list', () => {
  it('only an admin sees "مناسبة جديدة", edit and delete', async () => {
    const { user } = setup({ isAdmin: false });
    const sheet = await openList(user);
    await sheet.findByRole('region', { name: 'الجاية' });
    expect(sheet.queryByRole('button', { name: /مناسبة جديدة/ })).not.toBeInTheDocument();
    expect(sheet.queryByRole('button', { name: /^تعديل/ })).not.toBeInTheDocument();
    expect(sheet.queryByRole('button', { name: /^حذف/ })).not.toBeInTheDocument();
  });

  it('adds an occasion (a name and a day), and shows the year it was saved in', async () => {
    const { user } = setup();
    const sheet = await openList(user);
    await user.click(await sheet.findByRole('button', { name: /مناسبة جديدة/ }));
    const form = within(screen.getByRole('dialog', { name: 'إضافة مناسبة' }));
    await user.type(form.getByLabelText(/اسم المناسبة/), 'عيد الغطاس');
    await user.type(form.getByLabelText(/التاريخ/), '2027-01-19');
    await user.click(form.getByRole('button', { name: '💾 حفظ' }));
    await waitFor(() => expect(h.addOccasion).toHaveBeenCalledWith({ title: 'عيد الغطاس', date: '2027-01-19' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '2027' })).toBeInTheDocument());
  });

  it('the name and the day are required', async () => {
    const { user } = setup();
    const sheet = await openList(user);
    await user.click(await sheet.findByRole('button', { name: /مناسبة جديدة/ }));
    const form = within(screen.getByRole('dialog', { name: 'إضافة مناسبة' }));
    await user.click(form.getByRole('button', { name: '💾 حفظ' }));
    expect(await form.findByText('اكتب اسم المناسبة')).toBeInTheDocument();
    expect(form.getByText('اختر التاريخ')).toBeInTheDocument();
    expect(h.addOccasion).not.toHaveBeenCalled();
  });

  it('edits an occasion', async () => {
    const { user } = setup();
    const sheet = await openList(user);
    await user.click(await sheet.findByRole('button', { name: 'تعديل عيد النيروز' }));
    const form = within(screen.getByRole('dialog', { name: 'تعديل المناسبة' }));
    expect(form.getByLabelText(/اسم المناسبة/)).toHaveValue('عيد النيروز');
    await user.clear(form.getByLabelText(/اسم المناسبة/));
    await user.type(form.getByLabelText(/اسم المناسبة/), 'رأس السنة القبطية');
    await user.click(form.getByRole('button', { name: '💾 حفظ' }));
    await waitFor(() => expect(h.updateOccasion).toHaveBeenCalled());
    expect(h.updateOccasion.mock.calls[0]![1]).toEqual({ title: 'رأس السنة القبطية', date: '2026-09-11' });
  });

  it('deletes an occasion after asking once', async () => {
    const { user } = setup();
    const sheet = await openList(user);
    await user.click(await sheet.findByRole('button', { name: 'حذف عيد القيامة' }));
    expect(h.deleteOccasion).not.toHaveBeenCalled();
    await user.click(sheet.getByRole('button', { name: 'أكيد؟ امسح' }));
    await waitFor(() => expect(h.deleteOccasion).toHaveBeenCalledWith(expect.objectContaining({ id: 'عيد القيامة' })));
  });
});
