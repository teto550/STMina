import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

const sounds = vi.hoisted(() => ({ unlock: vi.fn(), drumroll: vi.fn(), reveal: vi.fn(), jingle: vi.fn(), stop: vi.fn(), setMuted: vi.fn() }));
vi.mock('@/react/lib/podium-sounds', () => ({ createPodiumSounds: () => sounds }));

import { PODIUM_TIMES } from '@/react/hooks/usePodiumShow';
import { PodiumShow } from '@/react/screens/spiritual-notes-ranking/podium-show';
import type { PodiumStep } from '@/react/screens/spiritual-notes-ranking/podium';

const kid = (id: string, name: string, rank: number, month: number) => ({ id, name, rank, month, week: 0 });
const full: PodiumStep[] = [
  { place: 3, kids: [kid('c', 'مينا', 3, 50)], points: 50 },
  { place: 2, kids: [kid('b', 'مارك', 2, 70)], points: 70 },
  { place: 1, kids: [kid('a', 'بيتر', 1, 90)], points: 90 },
];

const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
// each part sets the timer of the next one only after React has rendered it, so the parts are waited for one by one
const waitEach = (...times: number[]) => times.forEach(wait);
// the timers are fake, so the taps are plain synchronous events
const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

function setup(steps: PodiumStep[] = full) {
  const onClose = vi.fn();
  render(<PodiumShow steps={steps} onClose={onClose} />);
  return { onClose };
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.values(sounds).forEach((m) => m.mockReset());
});
afterEach(() => vi.useRealTimers());

describe('PodiumShow', () => {
  it('waits for a tap: nothing is revealed and no sound plays before start', () => {
    setup();
    expect(screen.getByRole('button', { name: /يلا نبدأ/ })).toBeInTheDocument();
    expect(screen.queryByText('المركز التالت')).not.toBeInTheDocument();
    expect(sounds.drumroll).not.toHaveBeenCalled();
  });

  it('reveals third, then second, then first, each after a drum roll', () => {
    setup();
    tap(/يلا نبدأ/);
    expect(sounds.unlock).toHaveBeenCalled();

    // third: the drum roll, the place is named but the name is hidden
    expect(screen.getByText('المركز التالت')).toBeInTheDocument();
    expect(screen.queryByText('مينا')).not.toBeInTheDocument();
    expect(sounds.drumroll).toHaveBeenLastCalledWith(PODIUM_TIMES.suspense[3] / 1000);
    wait(PODIUM_TIMES.suspense[3]);
    expect(screen.getByText('مينا')).toBeInTheDocument();
    expect(screen.getByText('⭐ 50 نقطة')).toBeInTheDocument();
    expect(sounds.reveal).toHaveBeenLastCalledWith(3);

    // second
    wait(PODIUM_TIMES.reveal[3]);
    expect(screen.queryByText('مينا')).not.toBeInTheDocument();
    expect(screen.getByText('المركز التاني')).toBeInTheDocument();
    expect(screen.queryByText('مارك')).not.toBeInTheDocument();
    wait(PODIUM_TIMES.suspense[2]);
    expect(screen.getByText('مارك')).toBeInTheDocument();
    expect(sounds.reveal).toHaveBeenLastCalledWith(2);

    // first, the longest wait
    wait(PODIUM_TIMES.reveal[2]);
    expect(screen.getByText('المركز الأول')).toBeInTheDocument();
    expect(sounds.drumroll).toHaveBeenLastCalledWith(PODIUM_TIMES.suspense[1] / 1000);
    expect(screen.queryByText('بيتر')).not.toBeInTheDocument();
    wait(PODIUM_TIMES.suspense[1]);
    expect(screen.getByText('بيتر')).toBeInTheDocument();
    expect(screen.getByText('👑')).toBeInTheDocument();
    expect(sounds.reveal).toHaveBeenLastCalledWith(1);
  });

  it('ends on the finished podium with every name, and can play again', () => {
    setup();
    tap(/يلا نبدأ/);
    waitEach(PODIUM_TIMES.suspense[3], PODIUM_TIMES.reveal[3], PODIUM_TIMES.suspense[2], PODIUM_TIMES.reveal[2], PODIUM_TIMES.suspense[1], PODIUM_TIMES.reveal[1]);
    expect(screen.getByText(/مبروك للفائزين/)).toBeInTheDocument();
    for (const name of ['مينا', 'مارك', 'بيتر']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(sounds.jingle).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'التالي' })).not.toBeInTheDocument();

    tap(/إعادة العرض/);
    expect(screen.getByText('المركز التالت')).toBeInTheDocument();
    expect(screen.queryByText('مينا')).not.toBeInTheDocument();
  });

  it('"التالي" jumps ahead without waiting for the timer', () => {
    setup();
    tap(/يلا نبدأ/);
    tap('التالي');
    expect(screen.getByText('مينا')).toBeInTheDocument();
    tap('التالي');
    expect(screen.getByText('المركز التاني')).toBeInTheDocument();
  });

  it('stops the sound of a part when the next one begins, and when the show closes', () => {
    const { onClose } = setup();
    tap(/يلا نبدأ/);
    sounds.stop.mockClear();
    tap('التالي');
    expect(sounds.stop).toHaveBeenCalled();
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

  it('shows the kids of a tie together in their place', () => {
    const tie: PodiumStep[] = [{ place: 1, kids: [kid('a', 'بيتر', 1, 90), kid('b', 'مارك', 1, 90)], points: 90 }];
    setup(tie);
    tap(/يلا نبدأ/);
    wait(PODIUM_TIMES.suspense[1]);
    expect(screen.getByText('بيتر')).toBeInTheDocument();
    expect(screen.getByText('مارك')).toBeInTheDocument();
    expect(screen.getAllByText('⭐ 90 نقطة')).toHaveLength(2);
  });

  it('with only the first place there is a single reveal, then the podium', () => {
    setup([full[2] as PodiumStep]);
    tap(/يلا نبدأ/);
    waitEach(PODIUM_TIMES.suspense[1], PODIUM_TIMES.reveal[1]);
    expect(screen.getByText(/مبروك للفائزين/)).toBeInTheDocument();
    expect(screen.getByText('بيتر')).toBeInTheDocument();
  });

  it('stops the timers and the sound when it is removed', () => {
    const onClose = vi.fn();
    const { unmount } = render(<PodiumShow steps={full} onClose={onClose} />);
    tap(/يلا نبدأ/);
    sounds.stop.mockClear();
    unmount();
    expect(sounds.stop).toHaveBeenCalled();
    wait(60000);
    expect(sounds.reveal).not.toHaveBeenCalled();
  });
});
