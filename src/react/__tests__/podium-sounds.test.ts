import { vi } from 'vitest';
import { createPodiumSounds, keyOf } from '@/react/lib/podium-sounds';

// A pretend Web Audio: every node remembers what it was asked, nothing makes a sound.
const param = () => ({
  value: 0,
  setValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  cancelScheduledValues: vi.fn(),
  setTargetAtTime: vi.fn(),
});
const node = () => ({ connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), gain: param(), frequency: param(), detune: param(), Q: param(), threshold: param(), ratio: param(), attack: param(), release: param(), type: '', buffer: null, loop: false });

class FakeContext {
  static last: FakeContext | null = null;
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  destination = node();
  resume = vi.fn(() => Promise.resolve());
  createGain = vi.fn(node);
  createOscillator = vi.fn(node);
  createBufferSource = vi.fn(node);
  createBiquadFilter = vi.fn(node);
  createDynamicsCompressor = vi.fn(node);
  createConvolver = vi.fn(node);
  createBuffer = vi.fn((_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }));
  constructor() {
    FakeContext.last = this;
  }
}

const scope = globalThis as unknown as { AudioContext?: unknown };
const notes = () => FakeContext.last?.createOscillator.mock.calls.length ?? 0;
const masterOf = () => {
  // the first gain made is the master volume (the mute button)
  const results = FakeContext.last?.createGain.mock.results ?? [];
  return results[0]?.value as ReturnType<typeof node>;
};

beforeEach(() => {
  vi.useFakeTimers();
  FakeContext.last = null;
  scope.AudioContext = FakeContext;
});
afterEach(() => {
  vi.useRealTimers();
  delete scope.AudioContext;
});

describe('podium sounds without Web Audio', () => {
  it('does nothing and never throws (old browsers)', () => {
    delete scope.AudioContext;
    const s = createPodiumSounds();
    expect(() => {
      s.unlock();
      s.drumroll(3, 1);
      s.reveal(1, 2);
      s.jingle();
      s.music('party', 3);
      s.stop();
      s.setMuted(true);
      s.shutdown();
    }).not.toThrow();
    expect(FakeContext.last).toBeNull();
  });
});

describe('podium sounds', () => {
  it('makes every effect, of every place and variant, without throwing', () => {
    const s = createPodiumSounds();
    s.unlock();
    for (const variant of [0, 1, 2, 3, 7]) {
      s.drumroll(3.2, variant);
      for (const place of [1, 2, 3] as const) {
        s.reveal(place, variant);
      }
    }
    s.jingle();
    expect(notes()).toBeGreaterThan(100);
  });

  it('wakes a suspended audio context (browsers keep it locked until a tap)', () => {
    const s = createPodiumSounds();
    s.unlock();
    const first = FakeContext.last as FakeContext;
    first.state = 'suspended';
    s.drumroll(3);
    expect(first.resume).toHaveBeenCalled();
  });

  it('every variant is a different key, and the same variant is always the same key', () => {
    const keys = [0, 1, 2, 3, 4, 5, 6].map(keyOf);
    expect(new Set(keys).size).toBe(7);
    expect(keyOf(7)).toBe(keyOf(0));
    expect(keyOf(-1)).toBe(keyOf(1));
  });

  it('the mute button turns the master volume down and up', () => {
    const s = createPodiumSounds();
    s.music('tense', 0);
    s.setMuted(true);
    expect(masterOf().gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.02);
    s.setMuted(false);
    expect(masterOf().gain.setTargetAtTime).toHaveBeenLastCalledWith(0.85, 0, 0.02);
  });
});

describe('podium music', () => {
  it('starts right away and keeps scheduling notes as time passes (it never runs out)', () => {
    const s = createPodiumSounds();
    s.music('tense', 0);
    const atStart = notes();
    expect(atStart).toBeGreaterThan(0);

    const ctx = FakeContext.last as FakeContext;
    for (let t = 1; t <= 10; t += 1) {
      ctx.currentTime = t; // the audio clock moves on
      vi.advanceTimersByTime(1000);
    }
    expect(notes()).toBeGreaterThan(atStart * 5);
  });

  it('changes mood without a gap: the same timer goes on, and the same mood again does nothing', () => {
    const s = createPodiumSounds();
    s.music('tense', 0);
    const ctx = FakeContext.last as FakeContext;
    s.music('tense', 0);
    const same = notes();
    s.music('tense', 0);
    expect(notes()).toBe(same);

    // the new mood carries on from the last scheduled beat (no gap, no restart), so its first notes come as the clock moves on
    s.music('party', 1);
    ctx.currentTime = 2;
    const beforeTimer = notes();
    vi.advanceTimersByTime(500);
    expect(notes()).toBeGreaterThan(beforeTimer);
  });

  it('the effects stop() cuts the effects, not the music', () => {
    const s = createPodiumSounds();
    s.music('party', 0);
    s.reveal(1, 0);
    s.stop();
    const ctx = FakeContext.last as FakeContext;
    const before = notes();
    ctx.currentTime = 1;
    vi.advanceTimersByTime(1000);
    expect(notes()).toBeGreaterThan(before); // the music goes on
  });

  it('a reveal lowers the music for a moment so the effect can be heard', () => {
    const s = createPodiumSounds();
    s.music('party', 0);
    const ctx = FakeContext.last as FakeContext;
    // the music's own volume knob is the second gain made (after the master)
    const musicGain = ctx.createGain.mock.results.map((r) => r.value as ReturnType<typeof node>).find((g) => g.gain.linearRampToValueAtTime.mock.calls.length > 0);
    s.reveal(1, 0);
    expect(musicGain?.gain.setTargetAtTime).toHaveBeenCalled();
  });

  it('shutdown (the show is closed) stops the music for good', () => {
    const s = createPodiumSounds();
    s.music('finale', 2);
    s.shutdown();
    const ctx = FakeContext.last as FakeContext;
    const before = notes();
    ctx.currentTime = 5;
    vi.advanceTimersByTime(5000);
    expect(notes()).toBe(before);
  });

  it('plays all three moods', () => {
    for (const mood of ['tense', 'party', 'finale'] as const) {
      const s = createPodiumSounds();
      s.music(mood, 0);
      expect(notes()).toBeGreaterThan(5);
      s.shutdown();
    }
  });
});
