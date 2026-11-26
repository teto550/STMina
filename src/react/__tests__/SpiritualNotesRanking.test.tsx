import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithQuery } from '@/test/render';

const h = vi.hoisted(() => ({
  fetchKidsMonthData: vi.fn(),
  fetchNotePoints: vi.fn(),
  // what a kid's file reads and writes (it opens in place of the list when a kid is tapped)
  fetchKidDay: vi.fn(),
  fetchKidDays: vi.fn(),
  fetchKidDaysBetween: vi.fn(),
  fetchConfession: vi.fn(),
  fetchKidStarWeeks: vi.fn(),
  saveNoteDay: vi.fn(),
}));
vi.mock('@/api/spiritual-notes', () => ({ ...h }));
vi.mock('@/react/lib/podium-sounds', () => ({
  createPodiumSounds: () => ({ unlock: vi.fn(), drumroll: vi.fn(), reveal: vi.fn(), jingle: vi.fn(), music: vi.fn(), stop: vi.fn(), shutdown: vi.fn(), setMuted: vi.fn() }),
}));

import SpiritualNotesRanking from '@/react/screens/spiritual-notes-ranking';

const PHOTO = 'data:image/png;base64,AAA';
const kids = [{ id: 'k1', name: 'بيتر' }, { id: 'k2', name: 'مارك' }, { id: 'k3', name: 'مينا سامح عادل', photo: PHOTO }, { id: 'k4', name: 'يوسف' }];

// Friday 18 October 2030: the last 4 weeks run from Friday 27/9 to Thursday 24/10
const mass = (day: string) => ({ day, mass: true });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2030, 9, 18, 12));
  h.fetchKidsMonthData.mockReset();
  h.fetchNotePoints.mockReset();
  h.fetchNotePoints.mockResolvedValue(null); // never set: the default points
  h.fetchKidDay.mockReset().mockResolvedValue(null);
  h.fetchKidDays.mockReset().mockResolvedValue([]);
  h.fetchKidDaysBetween.mockReset().mockResolvedValue([]);
  h.fetchConfession.mockReset().mockResolvedValue(false);
  h.fetchKidStarWeeks.mockReset().mockResolvedValue([]);
  h.saveNoteDay.mockReset().mockImplementation(async ({ day, values }: { day: string; values: object }) => ({ day, ...values }));
  h.fetchKidsMonthData.mockResolvedValue({
    k1: { days: [mass('2030-10-18'), mass('2030-10-17'), mass('2030-10-11')], confessed: false, starWeeks: [{ week: '2030-10-18', stars: 2 }, { week: '2030-10-04', stars: 1 }] }, // 60 points, 3 stars
    k2: { days: [mass('2030-10-18'), mass('2030-10-17')], confessed: false, starWeeks: [{ week: '2030-10-18', stars: 3 }, { week: '2030-10-11', stars: 2 }] }, // 40 points, 5 stars: the first place of the show
    k3: { days: [mass('2030-10-18')], confessed: false, starWeeks: [{ week: '2030-10-18', stars: 1.5 }] }, // 20 points, 1.5 stars
    k4: { days: [], confessed: false }, // nothing: not ranked
  });
});
afterEach(() => vi.useRealTimers());

describe('SpiritualNotesRanking: the عرض button', () => {
  it('appears once the points are loaded, and opens the show on its start screen', async () => {
    renderWithQuery(<SpiritualNotesRanking kids={kids} />);
    const button = await screen.findByRole('button', { name: /^🏆/ });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(button);
    expect(screen.getByRole('dialog', { name: 'عرض الفائزين' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /يلا نبدأ/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'إغلاق' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('the show goes by the STARS, from the first place down: مارك (5 stars) comes first even though بيتر has more points', async () => {
    renderWithQuery(<SpiritualNotesRanking kids={kids} />);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(await screen.findByRole('button', { name: /^🏆/ }));
    await user.click(screen.getByRole('button', { name: /يلا نبدأ/ }));
    await user.click(screen.getByRole('button', { name: 'التالي' }));
    const dialog = screen.getByRole('dialog', { name: 'عرض الفائزين' });
    expect(dialog).toHaveTextContent('المركز الأول');
    expect(dialog).toHaveTextContent('مارك');
    expect(within(dialog).getByRole('img', { name: '٥ من ٦ نجوم' })).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent('نقطة');
  });

  it('then the second place (بيتر, 3 stars) and the third (مينا, 1.5 stars, with his first two names and the photo of his card)', async () => {
    renderWithQuery(<SpiritualNotesRanking kids={kids} />);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(await screen.findByRole('button', { name: /^🏆/ }));
    await user.click(screen.getByRole('button', { name: /يلا نبدأ/ }));
    const next = () => user.click(screen.getByRole('button', { name: 'التالي' }));
    await next(); // the first place
    await next(); // the drum roll before the second
    await next();
    const dialog = screen.getByRole('dialog', { name: 'عرض الفائزين' });
    expect(dialog).toHaveTextContent('المركز التاني');
    expect(dialog).toHaveTextContent('بيتر');
    expect(within(dialog).getByRole('img', { name: '٣ من ٦ نجوم' })).toBeInTheDocument();
    await next();
    await next();
    expect(dialog).toHaveTextContent('المركز التالت');
    expect(dialog).toHaveTextContent('مينا سامح');
    expect(dialog).not.toHaveTextContent('عادل');
    expect(within(dialog).getByRole('img', { name: '١٫٥ من ٦ نجوم' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'مينا سامح' }).querySelector('img')).toHaveAttribute('src', PHOTO);
  });

  it('is not there while loading, or when nobody has points', async () => {
    h.fetchKidsMonthData.mockResolvedValue({ k1: { days: [], confessed: false } });
    renderWithQuery(<SpiritualNotesRanking kids={kids} />);
    expect(screen.queryByRole('button', { name: /عرض/ })).not.toBeInTheDocument();
    expect(await screen.findByText('لسه مفيش حد عنده نجوم في آخر ٤ أسابيع')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /عرض/ })).not.toBeInTheDocument();
  });

  it('is not there when the class has no kids', () => {
    renderWithQuery(<SpiritualNotesRanking kids={[]} />);
    expect(screen.queryByRole('button', { name: /عرض/ })).not.toBeInTheDocument();
  });
});

describe('SpiritualNotesRanking: one show only', () => {
  it('has no عرض التشجيع button any more', async () => {
    renderWithQuery(<SpiritualNotesRanking kids={kids} />);
    await screen.findByRole('button', { name: /^🏆/ });
    expect(screen.queryByRole('button', { name: /عرض التشجيع/ })).not.toBeInTheDocument();
  });

  it('there is no show while nobody has stars, even if kids have points', async () => {
    h.fetchKidsMonthData.mockResolvedValue({ k1: { days: [mass('2030-10-18')], confessed: false, starWeeks: [] } });
    renderWithQuery(<SpiritualNotesRanking kids={kids} />);
    expect(await screen.findByText('لسه مفيش حد عنده نجوم في آخر ٤ أسابيع')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^🏆/ })).not.toBeInTheDocument();
  });

  it('the list has the same ranking as the show: by stars, the same places, the next place not skipped', async () => {
    h.fetchKidsMonthData.mockResolvedValue({
      k1: { days: [], confessed: false, starWeeks: [{ week: '2030-10-18', stars: 4 }] },
      k2: { days: [mass('2030-10-18')], confessed: false, starWeeks: [{ week: '2030-10-18', stars: 4 }] },
      k3: { days: [mass('2030-10-18'), mass('2030-10-17')], confessed: false, starWeeks: [{ week: '2030-10-18', stars: 3.5 }] },
      k4: { days: [mass('2030-10-18')], confessed: false, starWeeks: [{ week: '2030-10-18', stars: 3 }] },
    });
    renderWithQuery(<SpiritualNotesRanking kids={kids} />);
    const items = await screen.findAllByRole('listitem');
    expect(items.map((li) => li.querySelector('[aria-label^="المركز"]')?.getAttribute('aria-label'))).toEqual(['المركز 1', 'المركز 1', 'المركز 2', 'المركز 3']);
    expect(items[0]).toHaveTextContent('⭐ ٤ نجمة');
    expect(items[2]).toHaveTextContent('⭐ ٣٫٥ نجمة');
  });
});

describe('SpiritualNotesRanking: tapping a kid', () => {
  it('opens his file of the النوتة الروحية in place of the list (not his profile)', async () => {
    renderWithQuery(<SpiritualNotesRanking kids={kids} canEdit user={{ name: 'الخادم' }} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /بيتر/ }));
    expect(await screen.findByRole('region', { name: 'ملف بيتر' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'بيتر — النوتة الروحية' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'حفظ اليوم' })).toBeInTheDocument();
    expect(h.fetchKidDay).toHaveBeenCalledWith('k1', '2030-10-18');
    expect(screen.queryByRole('region', { name: 'ترتيب النوتة الروحية' })).not.toBeInTheDocument(); // the ranking is not on the screen while the file is open
  });

  it('the back arrow returns to the ranking and reads the points again (what was written changes them)', async () => {
    renderWithQuery(<SpiritualNotesRanking kids={kids} canEdit user={{ name: 'الخادم' }} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /مارك/ }));
    await screen.findByRole('region', { name: 'ملف مارك' });
    const reads = h.fetchKidsMonthData.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'رجوع' }));
    expect(await screen.findByRole('region', { name: 'ترتيب النوتة الروحية' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^🏆/ })).toBeInTheDocument();
    await waitFor(() => expect(h.fetchKidsMonthData.mock.calls.length).toBeGreaterThan(reads));
  });

  it('the servant who writes is the one of the screen, and a day is saved from here like in the tab', async () => {
    renderWithQuery(<SpiritualNotesRanking kids={kids} canEdit user={{ name: 'الخادم' }} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /مينا/ }));
    await user.click(await screen.findByRole('button', { name: 'الصبح' }));
    await user.click(screen.getByRole('button', { name: 'حفظ اليوم' }));
    await waitFor(() => expect(h.saveNoteDay).toHaveBeenCalledTimes(1));
    expect(h.saveNoteDay.mock.calls[0]?.[0]).toMatchObject({ childId: 'k3', day: '2030-10-18', by: 'الخادم' });
  });

  it('without the right to write the file is only read: there is no save button', async () => {
    renderWithQuery(<SpiritualNotesRanking kids={kids} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /بيتر/ }));
    await screen.findByRole('region', { name: 'ملف بيتر' });
    await waitFor(() => expect(h.fetchKidDay).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'حفظ اليوم' })).not.toBeInTheDocument();
  });
});
