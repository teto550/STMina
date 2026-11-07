// The sounds of the winners show (statistics > النوتة الروحية > عرض), made with the Web Audio API: there are no sound files to download,
// so it also works offline in the PWA. Browsers keep audio locked until the user taps, so `unlock()` is called from the "start" button.
// Where Web Audio does not exist (old browsers, the tests) every call does nothing, so the show still runs, silently.
//
// Two layers: the MUSIC never stops while the show runs (podium-music.ts, it only changes mood), and the EFFECTS of each part (timpani and a
// snare roll over a rising whoosh for the suspense; a cymbal, brass, marimba, bells, whistles, a crowd and applause for the reveals) play on top
// and are cut when the next part begins. `variant` (a number, different for every kid) picks one of several flourishes and a key, so no two kids sound alike.
// Everything goes through a small room reverb and a compressor so it sounds full and never clips.
import { createMusic, type Mood, type PodiumMusic } from './podium-music';
import { createSynth, type Synth } from './podium-synth';

type Place = 1 | 2 | 3;

export type PodiumSounds = {
  /** call it from a tap: it wakes the audio up */
  unlock: () => void;
  /** the suspense before a kid: timpani, a rising whoosh and a snare roll that speeds up, `seconds` long */
  drumroll: (seconds: number, variant?: number) => void;
  /** the cymbal, the fanfare and the crowd of a place (the winner's is the biggest) */
  reveal: (place: Place, variant?: number) => void;
  /** a short happy tune and applause for the finished podium */
  jingle: () => void;
  /** the background music: starts it, or changes its mood on the next bar; `variant` picks the key */
  music: (mood: Mood, variant?: number) => void;
  /** cuts the effects that are still playing (the music goes on) */
  stop: () => void;
  /** cuts everything, the music too (the show is closed) */
  shutdown: () => void;
  setMuted: (muted: boolean) => void;
};

const LEVEL = 0.85;

// notes (Hz)
const G4 = 392;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;
const E6 = 1318.5;
const G6 = 1568;
const PENTATONIC = [1046.5, 1174.66, 1318.5, 1568, 1760, 2093];

/** The key of each kid, in semitones: the show goes up and down a little from kid to kid. */
const KEYS = [0, 2, 4, -3, 5, 7, -1];
export const keyOf = (variant: number): number => KEYS[Math.abs(variant) % KEYS.length] ?? 0;
const ratio = (semitones: number): number => 2 ** (semitones / 12);

function audioContextClass(): typeof AudioContext | undefined {
  const g = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  return g.AudioContext ?? g.webkitAudioContext;
}

type Rig = { master: GainNode; send: GainNode; synth: Synth; music: PodiumMusic };

export function createPodiumSounds(): PodiumSounds {
  let ctx: AudioContext | null = null;
  let rig: Rig | null = null;
  let bus: GainNode | null = null;
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

  /** A made-up room: noise that fades out over 1.6 seconds. */
  const room = (c: AudioContext, synth: Synth): AudioBuffer => {
    const length = Math.floor(c.sampleRate * 1.6);
    const buffer = c.createBuffer(2, length, c.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        data[i] = (synth.random() * 2 - 1) * (1 - i / length) ** 2.5;
      }
    }
    return buffer;
  };

  /** The things that stay while the show runs: the volume (the mute button), the compressor, the room reverb and the music. */
  const rigOf = (c: AudioContext): Rig => {
    if (!rig) {
      const synth = createSynth(c);
      const master = c.createGain();
      master.gain.value = muted ? 0 : LEVEL;
      const compressor = c.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.2;
      master.connect(compressor);
      compressor.connect(c.destination);
      const reverb = c.createConvolver();
      reverb.buffer = room(c, synth);
      const send = c.createGain();
      send.gain.value = 0.3;
      send.connect(reverb);
      reverb.connect(master);
      rig = { master, send, synth, music: createMusic(c, master, synth) };
    }
    return rig;
  };

  /** Everything of one part plays through its own knob, so stop() can fade it out without touching the next part. */
  const out = (c: AudioContext): GainNode => {
    const { master, send } = rigOf(c);
    if (!bus) {
      bus = c.createGain();
      bus.connect(master);
      bus.connect(send);
    }
    return bus;
  };

  /** The common start of every effect: the context, the instruments, where to send the sound. */
  const stage = (): { c: AudioContext; s: Synth; dest: GainNode } | null => {
    const c = context();
    if (!c) {
      return null;
    }
    return { c, s: rigOf(c).synth, dest: out(c) };
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

    drumroll: (seconds, variant = 0) => {
      const st = stage();
      if (!st) {
        return;
      }
      const { s, dest } = st;
      const k = ratio(keyOf(variant));
      // the heartbeat: timpani thumps that get stronger
      for (let t = 0, n = 0; t < seconds * 0.6; t += 0.55, n += 1) {
        s.timpani(dest, t, 70 * k, 0.3 + n * 0.05);
      }
      // the whoosh and the pitch that climb the whole time
      s.hiss(dest, 0, seconds - 0.05, 0.22, 300, { type: 'lowpass', q: 4, to: 7000, swell: seconds - 0.1 });
      s.tone(dest, 0, 330 * k, seconds, { type: 'sine', gain: 0.05, to: 1320 * k });
      // the snare roll: faster and louder towards the end
      const begin = seconds * 0.3;
      let gap = 0.15;
      for (let t = begin; t < seconds - 0.1; t += gap) {
        s.snare(dest, t, 0.12 + ((t - begin) / (seconds - begin)) * 0.3);
        gap = Math.max(0.04, gap * 0.94);
      }
      // a different joke for every kid
      const joke = Math.abs(variant) % 3;
      if (joke === 0) {
        s.whistle(dest, seconds * 0.55, 500, 2200, seconds * 0.4, 0.07);
      } else if (joke === 1) {
        [0.5, 0.62, 0.74].forEach((f, n) => s.pop(dest, seconds * f, 0.12 + n * 0.04));
      } else {
        s.boing(dest, seconds * 0.6, 0.12);
      }
    },

    reveal: (place, variant = 0) => {
      const st = stage();
      if (!st) {
        return;
      }
      const { c, s, dest } = st;
      rigOf(c).music.duck(place === 1 ? 3.2 : 1.8); // the music goes down for a moment, so the fanfare and the crowd are heard over it
      const k = ratio(keyOf(variant));
      const flourish = Math.abs(variant) % 3;
      const chord = (at: number, freqs: number[], dur: number, gain: number) => freqs.forEach((f) => s.brass(dest, at, f * k, dur, gain));

      if (place === 3) {
        s.crash(dest, 0, 0.9, 0.22);
        if (flourish === 0) {
          [C5, E5, G5, C6].forEach((f, i) => s.pluck(dest, i * 0.09, f * k));
        } else if (flourish === 1) {
          [C6, G5, E5, C5].forEach((f, i) => s.bell(dest, i * 0.1, f * k, 0.8, 0.12));
        } else {
          s.boing(dest, 0, 0.2);
          chord(0.25, [C5, G5], 0.5, 0.08);
        }
        s.bell(dest, 0.4, C6 * k, 1, 0.16);
        s.cheer(dest, 0, 1.4, 0.12);
        s.applause(dest, 0.1, 1.2, 0.1);
      } else if (place === 2) {
        s.crash(dest, 0, 1.3, 0.3);
        chord(0, [C5, E5, G5], 0.9, 0.08);
        if (flourish === 0) {
          [C5, E5, G5, C6, E6].forEach((f, i) => s.pluck(dest, 0.1 + i * 0.08, f * k));
        } else if (flourish === 1) {
          s.whistle(dest, 0.05, 600, 2600, 0.5, 0.09);
          [E6, G6].forEach((f, i) => s.bell(dest, 0.55 + i * 0.12, f * k, 1, 0.14));
        } else {
          [0, 0.15, 0.3].forEach((at) => s.pop(dest, at, 0.2));
          [C6, E6, G6].forEach((f, i) => s.pluck(dest, 0.4 + i * 0.07, f * k));
        }
        [C6, E6, G6].forEach((f, i) => s.bell(dest, 0.5 + i * 0.1, f * k, 1, 0.14));
        s.cheer(dest, 0, 2, 0.16);
        s.applause(dest, 0.15, 1.8, 0.12);
      } else {
        s.crash(dest, 0, 2.4, 0.4);
        [0, 0.25, 0.5].forEach((at) => s.timpani(dest, at, 98 * k, 0.5));
        [0, 0.17, 0.34].forEach((at) => s.brass(dest, at, G4 * k, 0.16, 0.12));
        chord(0.54, [C5, E5, G5, C6], 1.7, 0.09);
        for (let i = 0; i < 14; i += 1) {
          s.bell(dest, 0.9 + i * 0.08, (PENTATONIC[i % PENTATONIC.length] ?? C6) * k, 0.9, 0.12);
        }
        s.whistle(dest, 0.6, 700, 3000, 0.6, 0.08);
        s.cheer(dest, 0, 3.2, 0.22);
        s.applause(dest, 0.2, 3, 0.14);
      }
    },

    jingle: () => {
      const st = stage();
      if (!st) {
        return;
      }
      const { s, dest } = st;
      [C5, E5, G5, C6, G5, C6].forEach((f, i) => s.pluck(dest, i * 0.12, f, 0.2));
      s.bell(dest, 0.8, C6, 1, 0.16);
      s.crash(dest, 0.8, 1.6, 0.25);
      s.cheer(dest, 0.5, 2.4, 0.18);
      s.applause(dest, 0, 2.4, 0.1);
    },

    music: (mood, variant = 0) => {
      const c = context();
      if (!c) {
        return;
      }
      rigOf(c).music.play(mood, keyOf(variant));
    },

    stop: () => {
      if (!bus || !ctx) {
        return;
      }
      const old = bus;
      old.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      window.setTimeout(() => old.disconnect(), 500);
      bus = null;
    },

    shutdown: () => {
      rig?.music.stop();
      if (!bus || !ctx) {
        return;
      }
      const old = bus;
      old.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      window.setTimeout(() => old.disconnect(), 500);
      bus = null;
    },

    setMuted: (value) => {
      muted = value;
      if (rig && ctx) {
        rig.master.gain.setTargetAtTime(value ? 0 : LEVEL, ctx.currentTime, 0.02);
      }
    },
  };
}
