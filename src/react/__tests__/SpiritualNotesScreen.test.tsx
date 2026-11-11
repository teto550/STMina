import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithQuery } from '@/test/render';

const h = vi.hoisted(() => ({ fetchKidDay: vi.fn(), fetchKidDays: vi.fn(), fetchKidDaysBetween: vi.fn(), fetchConfession: vi.fn(), saveNoteDay: vi.fn(), saveConfession: vi.fn(), fetchNotePoints: vi.fn(), saveNotePoints: vi.fn(), fetchKidStarWeeks: vi.fn(), saveWeekStars: vi.fn() }));
vi.mock('@/api/spiritual-notes', () => ({ fetchKidDay: h.fetchKidDay, fetchKidDays: h.fetchKidDays, fetchKidDaysBetween: h.fetchKidDaysBetween, fetchConfession: h.fetchConfession, saveNoteDay: h.saveNoteDay, saveConfession: h.saveConfession, fetchNotePoints: h.fetchNotePoints, saveNotePoints: h.saveNotePoints, fetchKidStarWeeks: h.fetchKidStarWeeks, saveWeekStars: h.saveWeekStars }));

import SpiritualNotesScreen from '@/react/screens/spiritual-notes';

const kids = [{ id: 'k1', name: 'إبراهيم سامح' }, { id: 'k2', name: 'مينا' }, { id: 'k3', name: 'أنطونيوس' }];

function setup(over: Partial<React.ComponentProps<typeof SpiritualNotesScreen>> = {}) {
  renderWithQuery(<SpiritualNotesScreen grade="سنة رابعة ابتدائي" kids={kids} canEdit user={{ name: 'الخادم' }} {...over} />);
  return { user: userEvent.setup() };
}

beforeEach(() => {
  // Friday 18 October 2030, so the fasting box is there
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2030, 9, 18, 12));
  Object.values(h).forEach((m) => m.mockReset());
  h.fetchKidDay.mockResolvedValue(null);
  h.fetchKidDays.mockResolvedValue([]);
  h.fetchKidDaysBetween.mockResolvedValue([]);
  h.fetchConfession.mockResolvedValue(false);
  h.saveNoteDay.mockImplementation(async ({ day, values }: { day: string; values: object }) => ({ day, ...values }));
  h.saveConfession.mockResolvedValue(undefined);
  h.fetchNotePoints.mockResolvedValue(null); // never set: the default points
  h.saveNotePoints.mockImplementation(async ({ points }: { points: object }) => points);
  h.fetchKidStarWeeks.mockResolvedValue([]);
  h.saveWeekStars.mockImplementation(async ({ week, stars }: { week: string; stars: number }) => ({ week, stars }));
});
afterEach(() => vi.useRealTimers());

const openKid = async (user: ReturnType<typeof userEvent.setup>, name = /مينا/) => {
  await user.click(screen.getByRole('button', { name }));
  return screen.findByRole('button', { name: 'حفظ اليوم' });
};

describe('SpiritualNotesScreen: the list of kids', () => {
  it('shows every kid and reads nothing until a kid is opened', () => {
    setup();
    expect(screen.getByText('3 مخدوم')).toBeInTheDocument();
    for (const k of kids) expect(screen.getByRole('button', { name: new RegExp(k.name) })).toBeInTheDocument();
    expect(h.fetchKidDay).not.toHaveBeenCalled();
    expect(h.fetchKidDays).not.toHaveBeenCalled();
  });

  it('the search finds a kid whatever the spelling of the alef', async () => {
    const { user } = setup();
    await user.type(screen.getByRole('searchbox', { name: 'ابحث باسم الولد' }), 'ابراهيم');
    expect(screen.getByRole('button', { name: /إبراهيم سامح/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /مينا/ })).not.toBeInTheDocument();
    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'زززز');
    expect(screen.getByText('مفيش ولد بالاسم ده')).toBeInTheDocument();
  });

  it('says so when the class has no kids', () => {
    setup({ kids: [] });
    expect(screen.getByText('مفيش مخدومين في الفصل ده')).toBeInTheDocument();
  });
});

describe('SpiritualNotesScreen: the file of a kid', () => {

  it('opens on today, with the fasting box (Friday), and goes back to the list', async () => {
    const { user } = setup();
    await openKid(user);
    expect(screen.getByRole('heading', { name: 'الجمعة 18-10' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'صام' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'رجوع' }));
    expect(screen.getByText('3 مخدوم')).toBeInTheDocument();
  });

  it('shows the week from Friday to Thursday; the days after today and the next week cannot be picked', async () => {
    const { user } = setup();
    await openKid(user);
    expect(screen.getByText(/من الجمعة 18-10 لـ الخميس 24-10/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'الجمعة 18-10' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'السبت 19-10' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'الأسبوع الجاي' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'الأسبوع اللي فات' }));
    expect(await screen.findByText(/من الجمعة 11-10 لـ الخميس 17-10/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'الأسبوع الجاي' })).toBeEnabled();
  });

  it('the fasting box is hidden on a day that is not Wednesday or Friday', async () => {
    const { user } = setup();
    await openKid(user);
    await user.click(screen.getByRole('button', { name: 'الأسبوع اللي فات' })); // Thursday 17 is the last day of the week before
    await user.click(await screen.findByRole('button', { name: 'الخميس 17-10' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'الخميس 17-10' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'صام' })).not.toBeInTheDocument();
  });

  it('saves what the servant ticked, with the servant name, and says it was saved', async () => {
    const { user } = setup();
    await openKid(user);
    await user.click(screen.getByRole('button', { name: 'الصبح' }));
    await user.click(screen.getByRole('button', { name: 'حضر' }));
    await user.click(screen.getByRole('button', { name: 'صام' }));
    await user.click(screen.getByRole('button', { name: 'قرأ' }));
    await user.click(screen.getByRole('button', { name: 'حفظ اليوم' }));
    expect(await screen.findByText('اتحفظ ✓')).toBeInTheDocument();
    expect(h.saveNoteDay).toHaveBeenCalledWith({
      childId: 'k2',
      day: '2030-10-18',
      values: { prayerMorning: true, prayerNight: false, mass: true, gospel: true, fast: true },
      by: 'الخادم',
    });
    expect(h.saveConfession).not.toHaveBeenCalled(); // the confession did not change
  });

  it('the confession is saved for the month only when it changed', async () => {
    const { user } = setup();
    await openKid(user);
    await user.click(screen.getByRole('button', { name: 'اعترف' }));
    await user.click(screen.getByRole('button', { name: 'حفظ اليوم' }));
    await screen.findByText('اتحفظ ✓');
    expect(h.saveConfession).toHaveBeenCalledWith({ childId: 'k2', month: '2030-10', value: true, by: 'الخادم' });
  });

  it('shows what is already saved for the day, and the last days below', async () => {
    h.fetchKidDay.mockResolvedValue({ day: '2030-10-18', prayerNight: true, gospel: 'متى 5' });
    h.fetchKidDays.mockResolvedValue([{ day: '2030-10-16', prayerMorning: true, mass: true }]);
    const { user } = setup();
    await openKid(user);
    expect(screen.getByRole('button', { name: 'بليل' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'قرأ' })).toHaveAttribute('aria-pressed', 'true'); // an old note holding text counts as read
    expect(await screen.findByText('الصبح · القداس')).toBeInTheDocument();
  });

  it('shows the points of the day, the week and the month above the file', async () => {
    // Friday 18/10/2030 (today): morning 5 + night 5 + gospel 15 + mass 20 + fast 10 = 55. Thursday 24 is in the same week. Earlier in the last 4 weeks: 20. Confession: 25.
    h.fetchKidDay.mockResolvedValue({ day: '2030-10-18', prayerMorning: true, prayerNight: true, gospel: true, mass: true, fast: true });
    h.fetchKidDaysBetween.mockResolvedValue([
      { day: '2030-10-18', prayerMorning: true, prayerNight: true, gospel: true, mass: true, fast: true },
      { day: '2030-10-20', mass: true },
      { day: '2030-10-05', mass: true },
    ]);
    h.fetchConfession.mockResolvedValue(true);
    const { user } = setup();
    await openKid(user);
    const box = (label: string) => screen.getByText(label).parentElement as HTMLElement;
    await waitFor(() => expect(box('نقط الأسبوع')).toHaveTextContent('75'));
    expect(box('نقط اليوم')).toHaveTextContent('55');
    expect(box('نقط الشهر')).toHaveTextContent('120'); // 55 + 20 + 20 + the confession 25
    expect(h.fetchKidDaysBetween).toHaveBeenCalledWith('k2', '2030-09-27', '2030-10-24'); // the last 4 weeks
  });

  it('a failed save shows a message and keeps what was ticked', async () => {
    h.saveNoteDay.mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    const { user } = setup();
    await openKid(user);
    await user.click(screen.getByRole('button', { name: 'بليل' }));
    await user.click(screen.getByRole('button', { name: 'حفظ اليوم' }));
    expect(await screen.findByText(/مش مسموح بالنوتة الروحية/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'بليل' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('without the right to write the file is only read: no save button, the boxes are off', async () => {
    const { user } = setup({ canEdit: false });
    await user.click(screen.getByRole('button', { name: /مينا/ }));
    await screen.findByRole('button', { name: 'الصبح' });
    expect(screen.queryByRole('button', { name: 'حفظ اليوم' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'الصبح' })).toBeDisabled();
  });
});

describe('SpiritualNotesScreen: the extra stars of a kid (for the whole week)', () => {
  // Friday 18/10/2030 is today: its week runs from Friday 18/10 to Thursday 24/10, the last 4 weeks from Friday 27/9
  const stars = () => screen.findByRole('status', { name: 'نجوم الأسبوع' });
  const plus = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'زوّد نص نجمة' }));
  const openStars = async (user: ReturnType<typeof userEvent.setup>) => {
    await openKid(user);
    return stars();
  };

  it('gives a star or half a star at a time, from nothing up to six, and takes them back', async () => {
    const { user } = setup();
    expect(await openStars(user)).toHaveTextContent('⭐ ٠');
    expect(screen.getByRole('button', { name: 'ناقص نص نجمة' })).toBeDisabled();
    await plus(user);
    expect(await stars()).toHaveTextContent('⭐ ٠٫٥');
    await plus(user);
    await plus(user);
    expect(await stars()).toHaveTextContent('⭐ ١٫٥');
    await user.click(screen.getByRole('button', { name: 'ناقص نص نجمة' }));
    expect(await stars()).toHaveTextContent('⭐ ١');
    for (let i = 0; i < 12; i += 1) {
      await plus(user);
    }
    expect(await stars()).toHaveTextContent('⭐ ٦');
    expect(screen.getByRole('button', { name: 'زوّد نص نجمة' })).toBeDisabled();
  });

  it('saves the stars for the WEEK (its Friday is the id), not for the day, with the servant name', async () => {
    const { user } = setup();
    await openStars(user);
    await plus(user);
    await plus(user);
    await plus(user);
    await user.click(screen.getByRole('button', { name: 'حفظ نجوم الأسبوع' }));
    await waitFor(() => expect(h.saveWeekStars).toHaveBeenCalledTimes(1));
    expect(h.saveWeekStars).toHaveBeenCalledWith({ childId: 'k2', week: '2030-10-18', stars: 1.5, by: 'الخادم' });
    expect(h.saveNoteDay).not.toHaveBeenCalled(); // the day was not saved: the stars are not a thing of the day
  });

  it('the same stars are there on every day of the week, and the saved day carries no stars', async () => {
    h.fetchKidStarWeeks.mockResolvedValue([{ week: '2030-10-18', stars: 2 }]);
    const { user } = setup();
    expect(await openStars(user)).toHaveTextContent('⭐ ٢');
    await user.click(screen.getByRole('button', { name: /الخميس 24-10/ }).closest('button') ?? screen.getByRole('button', { name: /الخميس 24-10/ }));
    expect(await stars()).toHaveTextContent('⭐ ٢');
    await user.click(screen.getByRole('button', { name: 'الأسبوع اللي فات' })); // the week before has none
    expect(await stars()).toHaveTextContent('⭐ ٠');
    await user.click(screen.getByRole('button', { name: 'الصبح' }));
    await user.click(screen.getByRole('button', { name: 'حفظ اليوم' }));
    await waitFor(() => expect(h.saveNoteDay).toHaveBeenCalled());
    expect(h.saveNoteDay.mock.calls[0]?.[0].values).not.toHaveProperty('stars');
  });

  it('takes all the stars back: 0 is saved, so the old ones do not stay', async () => {
    h.fetchKidStarWeeks.mockResolvedValue([{ week: '2030-10-18', stars: 1 }]);
    const { user } = setup();
    await openStars(user);
    await user.click(screen.getByRole('button', { name: 'ناقص نص نجمة' }));
    await user.click(screen.getByRole('button', { name: 'ناقص نص نجمة' }));
    await user.click(screen.getByRole('button', { name: 'حفظ نجوم الأسبوع' }));
    await waitFor(() => expect(h.saveWeekStars).toHaveBeenCalledWith({ childId: 'k2', week: '2030-10-18', stars: 0, by: 'الخادم' }));
  });

  it('shows the stars of the last 4 weeks above the file, at most six', async () => {
    h.fetchKidStarWeeks.mockResolvedValue([
      { week: '2030-10-18', stars: 2 },
      { week: '2030-10-04', stars: 1.5 },
      { week: '2030-09-27', stars: 3 },
    ]);
    const { user } = setup();
    await openStars(user);
    expect(await screen.findByLabelText('نجوم الشهر')).toHaveTextContent('٦ من ٦'); // 6.5 added up, the card has six
    expect(h.fetchKidStarWeeks).toHaveBeenCalledWith('k2', '2030-09-27', '2030-10-24');
  });

  it('a failed save shows a message and keeps the stars', async () => {
    h.saveWeekStars.mockRejectedValue(new Error('x'));
    const { user } = setup();
    await openStars(user);
    await plus(user);
    await user.click(screen.getByRole('button', { name: 'حفظ نجوم الأسبوع' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(await stars()).toHaveTextContent('⭐ ٠٫٥');
  });

  it('without the right to write the buttons are off and there is no save button', async () => {
    h.fetchKidStarWeeks.mockResolvedValue([{ week: '2030-10-18', stars: 1 }]);
    const { user } = setup({ canEdit: false });
    await user.click(screen.getByRole('button', { name: /مينا/ }));
    expect(await stars()).toHaveTextContent('⭐ ١');
    expect(screen.getByRole('button', { name: 'زوّد نص نجمة' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'ناقص نص نجمة' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'حفظ نجوم الأسبوع' })).not.toBeInTheDocument();
  });
});

describe('SpiritualNotesScreen: نقاط النوتة (the points of each thing)', () => {
  it('shows the points of each thing to everybody, but the button only to who may set them', () => {
    setup();
    expect(screen.getByLabelText('نقاط كل حاجة')).toHaveTextContent('الصبح 5');
    expect(screen.queryByRole('button', { name: /نقاط النوتة/ })).not.toBeInTheDocument();
  });

  it('the admin opens the sheet, changes the points and saves them', async () => {
    h.fetchNotePoints.mockResolvedValue({ mass: 30 });
    const { user } = setup({ canSetPoints: true });
    await user.click(screen.getByRole('button', { name: /نقاط النوتة/ }));
    const dialog = await screen.findByRole('dialog', { name: /نقاط النوتة/ });
    expect(dialog).toBeInTheDocument();
    const mass = screen.getByLabelText('القداس');
    await waitFor(() => expect(mass).toHaveValue(30)); // what he set before
    expect(screen.getByLabelText('صلاة الصبح')).toHaveValue(5);

    const morning = screen.getByLabelText('صلاة الصبح'); // held, because its label gains the error text while the box is empty
    await user.clear(morning);
    await user.type(morning, '8');
    await user.click(screen.getByRole('button', { name: 'حفظ النقاط' }));
    await waitFor(() => expect(h.saveNotePoints).toHaveBeenCalledTimes(1));
    expect(h.saveNotePoints).toHaveBeenCalledWith({ points: { prayerMorning: 8, prayerNight: 5, gospel: 15, mass: 30, fast: 10, confession: 25 }, by: 'الخادم' });
    expect(await screen.findByText('اتحفظ ✓')).toBeInTheDocument();
    expect(screen.getByLabelText('نقاط كل حاجة')).toHaveTextContent('الصبح 8'); // the list shows the new points at once
  });

  it('refuses a wrong number and does not save', async () => {
    const { user } = setup({ canSetPoints: true });
    await user.click(screen.getByRole('button', { name: /نقاط النوتة/ }));
    await screen.findByRole('dialog', { name: /نقاط النوتة/ });
    const mass = screen.getByLabelText('القداس');
    await user.clear(mass);
    expect(screen.getByRole('button', { name: 'حفظ النقاط' })).toBeDisabled();
    await user.type(mass, '5000');
    expect(screen.getByRole('button', { name: 'حفظ النقاط' })).toBeDisabled();
    expect(h.saveNotePoints).not.toHaveBeenCalled();
  });

  it('"الأصلية" puts the starting points back in the boxes', async () => {
    h.fetchNotePoints.mockResolvedValue({ gospel: 50 });
    const { user } = setup({ canSetPoints: true });
    await user.click(screen.getByRole('button', { name: /نقاط النوتة/ }));
    await waitFor(() => expect(screen.getByLabelText('الإنجيل (قرأ)')).toHaveValue(50));
    await user.click(screen.getByRole('button', { name: 'الأصلية' }));
    expect(screen.getByLabelText('الإنجيل (قرأ)')).toHaveValue(15);
  });

  it('a kid\'s file counts with the points the admin set', async () => {
    h.fetchNotePoints.mockResolvedValue({ mass: 40 });
    h.fetchKidDay.mockResolvedValue({ day: '2030-10-18', mass: true });
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /مينا/ }));
    await waitFor(() => expect(screen.getByText('نقط اليوم').nextSibling).toHaveTextContent('40'));
  });
});
