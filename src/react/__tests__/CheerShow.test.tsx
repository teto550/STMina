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

import { CHEER_KID_MS } from '@/react/hooks/useCheerShow';
import { CHEER_CLOSING, type CheerStep } from '@/react/screens/spiritual-notes-ranking/cheer';
import { CheerShow } from '@/react/screens/spiritual-notes-ranking/cheer-show';

const step = (id: string, name: string, face: number, line: string, photo = ''): CheerStep => ({ kid: { id, name }, photo, face, line });

const steps: CheerStep[] = [
  step('a', 'بيتر ماهر جرجس', 0, 'بيتر ماهر شاطر ومثابر 💪', 'data:image/png;base64,AAA'),
  step('b', 'مارك عادل فوزي', 1, 'مارك عادل نجم ساطع 🌟'),
  step('c', 'مينا سامح عادل', 2, 'مينا سامح قلبه نضيف ✨'),
];

const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const start = () => tap(/يلا نبدأ/);

function setup(list: CheerStep[] = steps) {
  const onClose = vi.fn();
  const view = render(<CheerShow steps={list} onClose={onClose} />);
  return { onClose, ...view };
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.values(sounds).forEach((m) => m.mockReset());
});
afterEach(() => vi.useRealTimers());

describe('CheerShow', () => {
  it('waits on the start screen: no kid, no music until the tap', () => {
    setup();
    expect(screen.getByRole('button', { name: /يلا نبدأ/ })).toBeInTheDocument();
    expect(screen.queryByText(/بيتر/)).not.toBeInTheDocument();
    expect(sounds.music).not.toHaveBeenCalled();
    wait(CHEER_KID_MS * 3);
    expect(screen.queryByText(/بيتر/)).not.toBeInTheDocument();
  });

  it('the tap wakes the audio, starts the happy music and shows the first kid on his own: first two names, photo and his rhyme', () => {
    setup();
    start();
    expect(sounds.unlock).toHaveBeenCalledTimes(1);
    expect(sounds.music).toHaveBeenCalledWith('party', 0);
    expect(sounds.drumroll).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'عرض التشجيع' });
    expect(dialog).toHaveTextContent('بيتر ماهر');
    expect(dialog).not.toHaveTextContent('جرجس');
    expect(dialog).toHaveTextContent('بيتر ماهر شاطر ومثابر 💪');
    expect(dialog).not.toHaveTextContent('مارك');
    expect(screen.getByRole('img', { name: 'بيتر ماهر' }).querySelector('img')).toHaveAttribute('src', 'data:image/png;base64,AAA');
  });

  it('shows no place and no points for a kid', () => {
    setup();
    start();
    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toHaveTextContent('نقطة');
    expect(dialog).not.toHaveTextContent('المركز');
    expect(dialog).not.toHaveTextContent('🥇');
  });

  it('moves on by itself, kid after kid, then to everyone together with the closing line', () => {
    setup();
    start();
    wait(CHEER_KID_MS);
    expect(screen.getByRole('dialog')).toHaveTextContent('مارك عادل نجم ساطع');
    expect(sounds.music).toHaveBeenLastCalledWith('party', 1);
    wait(CHEER_KID_MS);
    expect(screen.getByRole('dialog')).toHaveTextContent('مينا سامح قلبه نضيف');
    wait(CHEER_KID_MS);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(CHEER_CLOSING);
    ['بيتر ماهر', 'مارك عادل', 'مينا سامح'].forEach((n) => expect(dialog).toHaveTextContent(n));
    expect(sounds.music).toHaveBeenLastCalledWith('finale', 0);
    expect(sounds.jingle).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /إعادة العرض/ })).toBeInTheDocument();
  });

  it('"التالي" jumps ahead without waiting', () => {
    setup();
    start();
    tap('التالي');
    expect(screen.getByRole('dialog')).toHaveTextContent('مارك عادل');
    tap('التالي');
    tap('التالي');
    expect(screen.getByRole('dialog')).toHaveTextContent(CHEER_CLOSING);
  });

  it('pause holds the kid on the screen, resume lets the time run again, and pausing does not play his sounds again', () => {
    setup();
    start();
    const reveals = sounds.reveal.mock.calls.length;
    tap('إيقاف مؤقت');
    wait(CHEER_KID_MS * 3);
    expect(screen.getByRole('dialog')).toHaveTextContent('بيتر ماهر');
    expect(sounds.reveal.mock.calls.length).toBe(reveals);
    tap('استئناف');
    wait(CHEER_KID_MS);
    expect(screen.getByRole('dialog')).toHaveTextContent('مارك عادل');
  });

  it('the speaker button mutes and unmutes', () => {
    setup();
    tap('كتم الصوت');
    expect(sounds.setMuted).toHaveBeenLastCalledWith(true);
    tap('تشغيل الصوت');
    expect(sounds.setMuted).toHaveBeenLastCalledWith(false);
  });

  it('the replay button plays it again from the first kid', () => {
    setup();
    start();
    tap('التالي');
    tap('التالي');
    tap('التالي');
    tap(/إعادة العرض/);
    expect(screen.getByRole('dialog')).toHaveTextContent('بيتر ماهر شاطر');
  });

  it('closes with the ✕ button, with Escape, and from the end screen; it cuts the sounds when closed', () => {
    const { onClose, unmount } = setup();
    tap('إغلاق');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
    start();
    tap('التالي');
    tap('التالي');
    tap('التالي');
    fireEvent.click(screen.getAllByRole('button', { name: 'إغلاق' }).at(-1)!);
    expect(onClose).toHaveBeenCalledTimes(3);
    unmount();
    expect(sounds.shutdown).toHaveBeenCalled();
  });

  it('a long list: every kid is on the end screen', () => {
    const many = Array.from({ length: 20 }, (_, i) => step(`k${i}`, `بطل${i}`, i, `بطل${i} جميل`));
    setup(many);
    start();
    // each kid sets the timer of the next one only after React has rendered him, so the kids are waited for one by one
    many.forEach(() => wait(CHEER_KID_MS));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(CHEER_CLOSING);
    many.forEach((m) => expect(dialog).toHaveTextContent(m.kid.name));
  });
});
