import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

const sounds = vi.hoisted(() => ({
  unlock: vi.fn(),
  drumroll: vi.fn(),
  reveal: vi.fn(),
  jingle: vi.fn(),
  music: vi.fn(),
  stop: vi.fn(),
  shutdown: vi.fn(),
  setMuted: vi.fn(),
}));
vi.mock('@/react/lib/podium-sounds', () => ({ createPodiumSounds: () => sounds }));

import { PODIUM_TIMES } from '@/react/hooks/usePodiumShow';
import { tiersOf } from '@/react/screens/spiritual-notes-ranking/podium-show/ClimbPodium';
import { PodiumShow } from '@/react/screens/spiritual-notes-ranking/podium-show';
import { faceOf, type PodiumStep } from '@/react/screens/spiritual-notes-ranking/podium';

/** One step of the show: one kid in his place (`face` is also the number of his step). */
const step = (place: number, face: number, id: string, name: string, month: number, extra: Partial<PodiumStep> = {}): PodiumStep => ({
  place,
  kid: { id, name, rank: place, month, week: 0 },
  photo: '',
  again: false,
  face,
  ...extra,
});

const full: PodiumStep[] = [
  step(3, 0, 'c', 'مينا سامح عادل', 50),
  step(2, 1, 'b', 'مارك عادل فوزي', 70),
  step(1, 2, 'a', 'بيتر ماهر جرجس', 90, { photo: 'data:image/png;base64,AAA' }),
];

const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
// each part sets the timer of the next one only after React has rendered it, so the parts are waited for one by one
const waitEach = (...times: number[]) => times.forEach(wait);
// the timers are fake, so the taps are plain synchronous events
const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const start = () => tap(/يلا نبدأ/);

function setup(steps: PodiumStep[] = full) {
  const onClose = vi.fn();
  const view = render(<PodiumShow steps={steps} onClose={onClose} />);
  return { onClose, ...view };
}

const WHOLE_SHOW = [PODIUM_TIMES.suspense[3], PODIUM_TIMES.reveal[3], PODIUM_TIMES.suspense[2], PODIUM_TIMES.reveal[2], PODIUM_TIMES.suspense[1], PODIUM_TIMES.reveal[1]];

beforeEach(() => {
  vi.useFakeTimers();
  Object.values(sounds).forEach((m) => m.mockReset());
});
afterEach(() => vi.useRealTimers());

describe('PodiumShow: the places under the third, and the round podium', () => {
  const longShow: PodiumStep[] = [step(5, 0, 'e', 'يوسف مراد حنا', 20), step(4, 1, 'd', 'كيرلس أمير نبيل', 30, { photo: 'data:image/png;base64,BBB' }), ...full.map((st, i) => ({ ...st, face: i + 2 }))];

  it('starts from the last place, with his picture, and goes up place by place to the first', () => {
    setup(longShow);
    start();
    expect(screen.getByText('المركز ٥')).toBeInTheDocument();
    expect(screen.queryByText('يوسف مراد')).not.toBeInTheDocument();
    wait(PODIUM_TIMES.other.suspense);
    expect(screen.getByText('يوسف مراد')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'يوسف مراد' })).toBeInTheDocument();
    expect(screen.queryByTestId('climb-podium')).not.toBeInTheDocument(); // no podium under the third place

    wait(PODIUM_TIMES.other.reveal);
    expect(screen.getByText('المركز ٤')).toBeInTheDocument();
    wait(PODIUM_TIMES.other.suspense);
    expect(screen.getByRole('img', { name: 'كيرلس أمير' }).querySelector('img')).toHaveAttribute('src', 'data:image/png;base64,BBB');
  });

  it('from the third place a question mark climbs a round podium; the name appears on top when it arrives', () => {
    setup(longShow);
    start();
    waitEach(PODIUM_TIMES.other.suspense, PODIUM_TIMES.other.reveal, PODIUM_TIMES.other.suspense, PODIUM_TIMES.other.reveal);
    expect(screen.getByText('المركز التالت')).toBeInTheDocument();
    expect(screen.getByTestId('climb-podium')).toBeInTheDocument();
    expect(screen.getByText('؟')).toBeInTheDocument(); // the question mark on the stairs
    expect(screen.queryByText('مينا سامح')).not.toBeInTheDocument();

    wait(PODIUM_TIMES.suspense[3]);
    expect(screen.getByTestId('climb-podium')).toBeInTheDocument();
    expect(screen.queryByText('؟')).not.toBeInTheDocument(); // the question mark is replaced by the kid
    expect(screen.getByText('مينا سامح')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'مينا سامح' })).toBeInTheDocument();
  });

  it('the better the place, the taller the podium', () => {
    expect([3, 2, 1].map((p) => tiersOf(p as 1 | 2 | 3))).toEqual([2, 3, 4]);
  });

  it('the places under the third are shorter than the top three, so a long list does not drag', () => {
    expect(PODIUM_TIMES.other.suspense).toBeLessThan(PODIUM_TIMES.suspense[3]);
    expect(PODIUM_TIMES.other.reveal).toBeLessThan(PODIUM_TIMES.reveal[3]);
  });
});

describe('PodiumShow', () => {
  it('waits for a tap: nothing is revealed and no sound or music plays before start', () => {
    setup();
    expect(screen.getByRole('button', { name: /يلا نبدأ/ })).toBeInTheDocument();
    expect(screen.queryByText('المركز التالت')).not.toBeInTheDocument();
    expect(sounds.drumroll).not.toHaveBeenCalled();
    expect(sounds.music).not.toHaveBeenCalled();
  });

  it('reveals third, then second, then first, each after a drum roll, with only the first two names', () => {
    setup();
    start();
    expect(sounds.unlock).toHaveBeenCalled();

    // third: the drum roll, the place is named but the kid is hidden
    expect(screen.getByText('المركز التالت')).toBeInTheDocument();
    expect(screen.queryByText('مينا سامح')).not.toBeInTheDocument();
    expect(sounds.drumroll).toHaveBeenLastCalledWith(PODIUM_TIMES.suspense[3] / 1000, 0);
    wait(PODIUM_TIMES.suspense[3]);
    expect(screen.getByText('مينا سامح')).toBeInTheDocument();
    expect(screen.queryByText(/عادل/)).not.toBeInTheDocument(); // the third name is never shown
    expect(screen.getByText('⭐ 50 نقطة')).toBeInTheDocument();
    expect(sounds.reveal).toHaveBeenLastCalledWith(3, 0);

    // second
    wait(PODIUM_TIMES.reveal[3]);
    expect(screen.queryByText('مينا سامح')).not.toBeInTheDocument();
    expect(screen.getByText('المركز التاني')).toBeInTheDocument();
    expect(screen.queryByText('مارك عادل')).not.toBeInTheDocument();
    wait(PODIUM_TIMES.suspense[2]);
    expect(screen.getByText('مارك عادل')).toBeInTheDocument();
    expect(sounds.reveal).toHaveBeenLastCalledWith(2, 1);

    // first, the longest wait
    wait(PODIUM_TIMES.reveal[2]);
    expect(screen.getByText('المركز الأول')).toBeInTheDocument();
    expect(sounds.drumroll).toHaveBeenLastCalledWith(PODIUM_TIMES.suspense[1] / 1000, 2);
    expect(screen.queryByText('بيتر ماهر')).not.toBeInTheDocument();
    wait(PODIUM_TIMES.suspense[1]);
    expect(screen.getByText('بيتر ماهر')).toBeInTheDocument();
    expect(screen.getByText('👑')).toBeInTheDocument();
    expect(sounds.reveal).toHaveBeenLastCalledWith(1, 2);
  });

  it('shows the kid\'s photo from his card, or a cartoon face when he has none (a different one for every kid)', () => {
    setup();
    start();
    wait(PODIUM_TIMES.suspense[3]);
    // no photo: the cartoon face of his step
    const third = screen.getByRole('img', { name: 'مينا سامح' });
    expect(third).toHaveTextContent(faceOf(0).emoji);
    expect(third.querySelector('img')).toBeNull();

    waitEach(PODIUM_TIMES.reveal[3], PODIUM_TIMES.suspense[2]);
    const second = screen.getByRole('img', { name: 'مارك عادل' });
    expect(second).toHaveTextContent(faceOf(1).emoji);
    expect(faceOf(0).emoji).not.toBe(faceOf(1).emoji);

    waitEach(PODIUM_TIMES.reveal[2], PODIUM_TIMES.suspense[1]);
    const winner = screen.getByRole('img', { name: 'بيتر ماهر' });
    expect(winner.querySelector('img')).toHaveAttribute('src', 'data:image/png;base64,AAA');
  });

  it('draws the cartoon face when the photo does not load', () => {
    setup([step(1, 4, 'a', 'بيتر ماهر', 90, { photo: 'https://example.invalid/broken.png' })]);
    start();
    wait(PODIUM_TIMES.suspense[1]);
    const photo = screen.getByRole('img', { name: 'بيتر ماهر' });
    fireEvent.error(photo.querySelector('img') as HTMLImageElement);
    expect(photo.querySelector('img')).toBeNull();
    expect(photo).toHaveTextContent(faceOf(4).emoji);
  });

  it('plays the music from the start tap to the end, changing its mood: tense, party, tense, party... finale', () => {
    setup();
    start();
    expect(sounds.music).toHaveBeenLastCalledWith('tense', 0);
    wait(PODIUM_TIMES.suspense[3]);
    expect(sounds.music).toHaveBeenLastCalledWith('party', 0);
    wait(PODIUM_TIMES.reveal[3]);
    expect(sounds.music).toHaveBeenLastCalledWith('tense', 1);
    wait(PODIUM_TIMES.suspense[2]);
    expect(sounds.music).toHaveBeenLastCalledWith('party', 1);
    waitEach(PODIUM_TIMES.reveal[2], PODIUM_TIMES.suspense[1], PODIUM_TIMES.reveal[1]);
    expect(sounds.music).toHaveBeenLastCalledWith('finale', 2);
    // it was never shut down along the way: the music has no gap
    expect(sounds.shutdown).not.toHaveBeenCalled();
  });

  it('every kid gets his own variant of the sounds', () => {
    setup();
    start();
    waitEach(...WHOLE_SHOW);
    const variants = sounds.drumroll.mock.calls.map((call) => call[1]);
    expect(variants).toEqual([0, 1, 2]);
  });

  it('ends on the finished podium with everyone\'s picture and first two names, and can play again', () => {
    setup();
    start();
    waitEach(...WHOLE_SHOW);
    expect(screen.getByText(/مبروك للفائزين/)).toBeInTheDocument();
    for (const name of ['مينا سامح', 'مارك عادل', 'بيتر ماهر']) {
      expect(screen.getByText(name)).toBeInTheDocument();
      expect(screen.getByRole('img', { name })).toBeInTheDocument();
    }
    expect(sounds.jingle).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'التالي' })).not.toBeInTheDocument();

    tap(/إعادة العرض/);
    expect(screen.getByText('المركز التالت')).toBeInTheDocument();
    expect(screen.queryByText('مينا سامح')).not.toBeInTheDocument();
    expect(sounds.music).toHaveBeenLastCalledWith('tense', 0);
  });

  it('"التالي" jumps ahead without waiting for the timer', () => {
    setup();
    start();
    tap('التالي');
    expect(screen.getByText('مينا سامح')).toBeInTheDocument();
    tap('التالي');
    expect(screen.getByText('المركز التاني')).toBeInTheDocument();
  });

  it('cuts the effects of a part when the next one begins, and everything when the show closes', () => {
    const { unmount } = setup();
    start();
    sounds.stop.mockClear();
    tap('التالي');
    expect(sounds.stop).toHaveBeenCalled();
    expect(sounds.shutdown).not.toHaveBeenCalled();
    unmount();
    expect(sounds.shutdown).toHaveBeenCalled();
  });

  it('the close button closes it', () => {
    const { onClose } = setup();
    tap('إغلاق');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('the speaker button mutes and unmutes', () => {
    setup();
    tap('كتم الصوت');
    expect(sounds.setMuted).toHaveBeenLastCalledWith(true);
    tap('تشغيل الصوت');
    expect(sounds.setMuted).toHaveBeenLastCalledWith(false);
  });

  it('Escape closes it', () => {
    const { onClose } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the kids of a tie one after the other, each with his own picture, in the same place', () => {
    const tie = [step(1, 0, 'a', 'بيتر ماهر', 90), step(1, 1, 'b', 'مارك عادل', 90, { again: true })];
    setup(tie);
    start();
    expect(screen.getByText('المركز الأول')).toBeInTheDocument();
    wait(PODIUM_TIMES.suspense[1]);
    expect(screen.getByText('بيتر ماهر')).toBeInTheDocument();
    expect(screen.queryByText('مارك عادل')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'بيتر ماهر' })).toHaveTextContent(faceOf(0).emoji);

    // the second kid of the tie: the same place again, a short drum roll, and he is told he is not alone
    wait(PODIUM_TIMES.reveal[1]);
    expect(screen.getByText('المركز الأول')).toBeInTheDocument();
    expect(screen.getByText(/ومعاه كمان واحد/)).toBeInTheDocument();
    expect(sounds.drumroll).toHaveBeenLastCalledWith(PODIUM_TIMES.tie / 1000, 1);
    expect(screen.queryByText('بيتر ماهر')).not.toBeInTheDocument();
    wait(PODIUM_TIMES.tie);
    expect(screen.getByText('مارك عادل')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'مارك عادل' })).toHaveTextContent(faceOf(1).emoji);
    expect(screen.getByText('⭐ 90 نقطة')).toBeInTheDocument();
  });

  it('the finished podium of a tie shows both kids side by side under the same place', () => {
    const tie = [step(1, 0, 'a', 'بيتر ماهر', 90), step(1, 1, 'b', 'مارك عادل', 90, { again: true })];
    setup(tie);
    start();
    waitEach(PODIUM_TIMES.suspense[1], PODIUM_TIMES.reveal[1], PODIUM_TIMES.tie, PODIUM_TIMES.reveal[1]);
    expect(screen.getByText(/مبروك للفائزين/)).toBeInTheDocument();
    expect(screen.getByText('بيتر ماهر')).toBeInTheDocument();
    expect(screen.getByText('مارك عادل')).toBeInTheDocument();
    expect(screen.getAllByLabelText('المركز الأول')).toHaveLength(1);
  });

  it('with only the first place there is a single reveal, then the podium', () => {
    setup([full[2] as PodiumStep]);
    start();
    waitEach(PODIUM_TIMES.suspense[1], PODIUM_TIMES.reveal[1]);
    expect(screen.getByText(/مبروك للفائزين/)).toBeInTheDocument();
    expect(screen.getByText('بيتر ماهر')).toBeInTheDocument();
  });

  it('stops the timers and the sound when it is removed', () => {
    const { unmount } = setup();
    start();
    sounds.shutdown.mockClear();
    unmount();
    expect(sounds.shutdown).toHaveBeenCalled();
    wait(60000);
    expect(sounds.reveal).not.toHaveBeenCalled();
  });
});
