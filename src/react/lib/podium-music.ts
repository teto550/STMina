// The background music of the winners show: a groove that never stops while the show runs and changes with the part that is on the screen:
//   tense  - the wait before a kid: a minor key, a ticking pulse and an arpeggio that keeps climbing
//   party  - a kid revealed: a happy major groove with a bouncing bass, claps and a bright melody
//   finale - the finished podium: the party groove, faster, with bells and a cymbal on every fourth bar
// It is written note by note with the Web Audio API (no files). A timer schedules a few hundred milliseconds ahead, so a change of mood
// takes effect on the next beat and the music never has a gap. `key` moves everything up or down by that many semitones, so every kid
// gets his own key and the show does not repeat itself.
import type { Synth } from './podium-synth';

export type Mood = 'tense' | 'party' | 'finale';

export type PodiumMusic = {
  /** starts the music (or changes its mood, from the next bar); `key` is a number of semitones */
  play: (mood: Mood, key: number) => void;
  /** lowers the music for `seconds` so a sound effect on top of it can be heard, then brings it back (the music does not stop) */
  duck: (seconds: number) => void;
  /** fades out and stops the timer */
  stop: () => void;
  /** schedules the notes up to `horizon` seconds ahead (the timer calls it all the time; a test can call it with a longer horizon) */
  tick: (horizon?: number) => void;
};

const LOOKAHEAD = 0.45;
const LEVEL = 0.55;
const DUCKED = 0.22;
const TIMER_MS = 120;

type Groove = { bpm: number; roots: number[]; chords: number[][]; scale: number[] };

// roots: the bass note of each of the 4 bars; chords: what is played over it (Hz)
const GROOVES: Record<Mood, Groove> = {
  tense: {
    bpm: 118,
    roots: [110, 87.31, 73.42, 82.41], // A, F, D, E
    chords: [[220, 261.63, 329.63], [174.61, 220, 261.63], [146.83, 174.61, 220], [164.81, 207.65, 246.94]],
    scale: [440, 523.25, 659.25, 880, 1046.5],
  },
  party: {
    bpm: 126,
    roots: [130.81, 98, 110, 87.31], // C, G, A, F
    chords: [[261.63, 329.63, 392], [196, 246.94, 293.66], [220, 261.63, 329.63], [174.61, 220, 261.63]],
    scale: [523.25, 587.33, 659.25, 783.99, 880, 1046.5],
  },
  finale: {
    bpm: 134,
    roots: [130.81, 98, 110, 87.31],
    chords: [[261.63, 329.63, 392], [196, 246.94, 293.66], [220, 261.63, 329.63], [174.61, 220, 261.63]],
    scale: [659.25, 783.99, 880, 1046.5, 1174.66, 1318.5],
  },
};

const ratio = (semitones: number): number => 2 ** (semitones / 12);

export function createMusic(c: AudioContext, dest: AudioNode, synth: Synth): PodiumMusic {
  const bus = c.createGain();
  bus.gain.value = LEVEL;
  bus.connect(dest);

  let mood: Mood | null = null;
  let key = 0;
  let step = 0; // 16th notes since the start; a bar is 16 of them
  let next = 0; // the time (in the context's clock) of the next 16th
  let timer: number | undefined;

  const playStep = (m: Mood, s: number, at: number): void => {
    const g = GROOVES[m];
    const k = ratio(key);
    const bar = Math.floor(s / 16);
    const i = s % 16;
    const root = (g.roots[bar % 4] ?? 110) * k;
    const chord = (g.chords[bar % 4] ?? []).map((f) => f * k);

    if (m === 'tense') {
      // a soft thump on the beat and a tick on every 16th, louder in the last two bars of the phrase
      if (i % 8 === 0) {
        synth.kick(bus, at, 0.28);
      }
      synth.hat(bus, at, i % 4 === 0 ? 0.07 : 0.03);
      if (i % 2 === 0) {
        synth.tone(bus, at, root, 0.2, { type: 'triangle', gain: 0.17 });
      }
      // the arpeggio climbs through the bar and starts again
      const arp = chord[i % chord.length];
      if (arp && i % 2 === 1) {
        synth.pluck(bus, at, arp * 2, 0.06 + (i / 16) * 0.05);
      }
      if (i === 0) {
        chord.forEach((f) => synth.tone(bus, at, f, 0.9, { type: 'sawtooth', gain: 0.025 }));
      }
      return;
    }

    // party and finale: four on the floor, claps, a bouncing bass, stabs and a melody
    const finale = m === 'finale';
    if (i % 4 === 0) {
      synth.kick(bus, at, 0.38);
    }
    if (i === 4 || i === 12) {
      synth.clap(bus, at, 0.13);
    }
    if (i % 4 === 2) {
      synth.hat(bus, at, 0.07);
    }
    if ([0, 3, 6, 8, 11, 14].includes(i)) {
      synth.tone(bus, at, root, 0.18, { type: 'triangle', gain: 0.2 });
    }
    if (i === 0 || i === 6 || i === 10) {
      chord.forEach((f) => synth.tone(bus, at, f, i === 0 ? 0.5 : 0.16, { type: 'square', gain: 0.03 }));
    }
    if (i % 2 === 0 || finale) {
      // the melody walks up and down the scale; the seeded generator makes it a little different every bar, but always the same show
      const note = g.scale[Math.floor(synth.random() * g.scale.length)];
      if (note && synth.random() > 0.25) {
        synth.pluck(bus, at, note * k, finale ? 0.09 : 0.07);
      }
    }
    if (finale && i % 4 === 0) {
      synth.bell(bus, at, (chord[0] ?? 523.25) * 4, 0.8, 0.05);
    }
    if (finale && i === 0 && bar % 4 === 0) {
      synth.crash(bus, at, 1.4, 0.12);
    }
    if (i === 15 && bar % 4 === 3) {
      // the end of a phrase: a short roll into the next bar
      [0, 0.03, 0.06, 0.09].forEach((d) => synth.snare(bus, at + d, 0.08 + d));
    }
  };

  const tick = (horizon = LOOKAHEAD): void => {
    if (!mood) {
      return;
    }
    const stepDuration = 60 / (GROOVES[mood].bpm * 4);
    if (next < c.currentTime) {
      next = c.currentTime + 0.05; // the timer was late (a busy tab): carry on from now instead of playing a burst of old notes
    }
    while (next < c.currentTime + horizon) {
      playStep(mood, step, Math.max(0, next - c.currentTime));
      next += stepDuration;
      step += 1;
    }
  };

  return {
    play: (to, semitones) => {
      const wasPlaying = mood !== null;
      if (wasPlaying && to === mood && semitones === key) {
        return;
      }
      mood = to;
      key = semitones;
      step = wasPlaying ? Math.ceil(step / 16) * 16 : 0; // a new mood starts on a bar line
      if (!wasPlaying) {
        next = c.currentTime + 0.05;
        bus.gain.cancelScheduledValues(c.currentTime);
        bus.gain.setValueAtTime(0.0001, c.currentTime);
        bus.gain.linearRampToValueAtTime(LEVEL, c.currentTime + 0.4);
      }
      if (timer === undefined) {
        timer = window.setInterval(() => tick(), TIMER_MS);
      }
      tick();
    },

    duck: (seconds) => {
      if (mood === null) {
        return;
      }
      const now = c.currentTime;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setTargetAtTime(DUCKED, now, 0.05);
      bus.gain.setTargetAtTime(LEVEL, now + seconds, 0.35);
    },

    stop: () => {
      mood = null;
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
      bus.gain.cancelScheduledValues(c.currentTime);
      bus.gain.setTargetAtTime(0, c.currentTime, 0.12);
    },

    tick,
  };
}
