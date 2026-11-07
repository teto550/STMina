// The sounds of the winners show (statistics > النوتة الروحية > عرض), made with the Web Audio API: there are no sound files to download,
// so it also works offline in the PWA. Browsers keep audio locked until the user taps, so `unlock()` is called from the "start" button.
// Where Web Audio does not exist (old browsers, the tests) every call does nothing, so the show still runs, silently.

type Place = 1 | 2 | 3;

export type PodiumSounds = {
  /** call it from a tap: it wakes the audio up */
  unlock: () => void;
  /** the suspense before a name: a heartbeat and a snare roll that speeds up, `seconds` long */
  drumroll: (seconds: number) => void;
  /** the cymbal and the fanfare of a place (the winner's is the biggest) */
  reveal: (place: Place) => void;
  /** a short happy tune for the finished podium */
  jingle: () => void;
  /** cuts whatever is still playing */
  stop: () => void;
  setMuted: (muted: boolean) => void;
};

const LEVEL = 0.8;

// notes (Hz)
const G4 = 392;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;
const E6 = 1318.5;

function audioContextClass(): typeof AudioContext | undefined {
  const g = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  return g.AudioContext ?? g.webkitAudioContext;
}

type ToneOptions = { type?: OscillatorType; gain?: number; to?: number };

export function createPodiumSounds(): PodiumSounds {
  let ctx: AudioContext | null = null;
  let bus: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let muted = false;

  const context = (): AudioContext | null => {
    if (!ctx) {
      const Ctor = audioContextClass();
      if (!Ctor) {
        return null;
      }
      try {
        ctx = new Ctor();
      } catch {
        return null;
      }
    }
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined);
    }
    return ctx;
  };

  /** Everything that plays goes through one volume knob, so stop() and the mute button can act on all of it at once. */
  const out = (c: AudioContext): GainNode => {
    if (!bus) {
      bus = c.createGain();
      bus.gain.value = muted ? 0 : LEVEL;
      bus.connect(c.destination);
    }
    return bus;
  };

  const noiseBuffer = (c: AudioContext): AudioBuffer => {
    if (!noise) {
      noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const data = noise.getChannelData(0);
      let seed = 7;
      for (let i = 0; i < data.length; i += 1) {
        seed = (seed * 16807) % 2147483647;
        data[i] = (seed / 2147483647) * 2 - 1;
      }
    }
    return noise;
  };

  /** One note: `at` seconds from now, lasting `dur`, optionally sliding to the frequency `to`. */
  const tone = (c: AudioContext, dest: AudioNode, at: number, freq: number, dur: number, opts: ToneOptions = {}): void => {
    const t = c.currentTime + at;
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = opts.type ?? 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    if (opts.to) {
      osc.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    }
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(opts.gain ?? 0.25, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env);
    env.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  };

  /** A burst of filtered noise: a snare hit (bandpass) or a cymbal (highpass). */
  const hiss = (c: AudioContext, dest: AudioNode, at: number, dur: number, gain: number, freq: number, type: BiquadFilterType = 'bandpass'): void => {
    const t = c.currentTime + at;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const env = c.createGain();
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(env);
    env.connect(dest);
    src.start(t);
    src.stop(t + dur + 0.05);
  };

  const chord = (c: AudioContext, dest: AudioNode, at: number, freqs: number[], dur: number, type: OscillatorType, gain: number): void => {
    for (const f of freqs) {
      tone(c, dest, at, f, dur, { type, gain });
    }
  };

  return {
    unlock: () => {
      const c = context();
      if (!c) {
        return;
      }
      // iOS wants something played inside the tap itself
      const silent = c.createBufferSource();
      silent.buffer = c.createBuffer(1, 1, 22050);
      silent.connect(c.destination);
      silent.start(0);
    },

    drumroll: (seconds) => {
      const c = context();
      if (!c) {
        return;
      }
      const dest = out(c);
      for (let t = 0; t < seconds - 0.4; t += 0.5) {
        tone(c, dest, t, 140, 0.2, { type: 'sine', gain: 0.5, to: 50 });
      }
      tone(c, dest, 0, 330, seconds, { type: 'sine', gain: 0.06, to: 1320 });
      let t = seconds * 0.25;
      let gap = 0.17;
      while (t < seconds - 0.12) {
        const progress = t / seconds;
        hiss(c, dest, t, 0.07, 0.18 + progress * 0.35, 1800);
        tone(c, dest, t, 190, 0.06, { gain: 0.12 + progress * 0.1, to: 120 });
        gap = Math.max(0.045, gap * 0.93);
        t += gap;
      }
    },

    reveal: (place) => {
      const c = context();
      if (!c) {
        return;
      }
      const dest = out(c);
      hiss(c, dest, 0, place === 1 ? 1.6 : 0.8, place === 1 ? 0.5 : 0.35, 6000, 'highpass');
      if (place === 3) {
        [C5, E5, G5, C6].forEach((f, i) => tone(c, dest, i * 0.11, f, 0.25, { type: 'square', gain: 0.12 }));
        chord(c, dest, 0.5, [C5, E5, G5], 0.7, 'triangle', 0.18);
      } else if (place === 2) {
        [C5, E5, G5, C6, E6].forEach((f, i) => tone(c, dest, i * 0.1, f, 0.25, { type: 'square', gain: 0.12 }));
        chord(c, dest, 0.55, [C5, E5, G5, C6], 0.9, 'triangle', 0.18);
      } else {
        [0, 0.18, 0.36].forEach((at) => tone(c, dest, at, G4, 0.15, { type: 'sawtooth', gain: 0.14 }));
        chord(c, dest, 0.54, [C5, E5, G5, C6], 1.4, 'sawtooth', 0.12);
        for (let i = 0; i < 10; i += 1) {
          tone(c, dest, 0.9 + i * 0.09, 1000 + i * 180, 0.18, { type: 'sine', gain: 0.1 });
        }
      }
    },

    jingle: () => {
      const c = context();
      if (!c) {
        return;
      }
      const dest = out(c);
      [C5, E5, G5, C6, G5, C6].forEach((f, i) => tone(c, dest, i * 0.12, f, 0.22, { type: 'square', gain: 0.1 }));
      chord(c, dest, 0.8, [C5, E5, G5, C6], 0.8, 'triangle', 0.16);
    },

    stop: () => {
      if (!bus || !ctx) {
        return;
      }
      const old = bus;
      old.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      window.setTimeout(() => old.disconnect(), 400);
      bus = null;
    },

    setMuted: (value) => {
      muted = value;
      if (bus && ctx) {
        bus.gain.setTargetAtTime(value ? 0 : LEVEL, ctx.currentTime, 0.02);
      }
    },
  };
}
