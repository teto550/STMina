// The instruments of the winners show: small Web Audio building blocks (notes, drums, bells, brass, crowd) shared by the sound effects
// (podium-sounds.ts) and the background music (podium-music.ts). Every `at` is "seconds from now"; every `dest` is where the sound is sent.

export type ToneOptions = { type?: OscillatorType; gain?: number; to?: number; bend?: number };
export type HissOptions = { type?: BiquadFilterType; q?: number; to?: number; swell?: number };

export type Synth = {
  /** a number between 0 and 1 that is the same every run (a small seeded generator), so the show always sounds the same */
  random: () => number;
  tone: (dest: AudioNode, at: number, freq: number, dur: number, opts?: ToneOptions) => void;
  hiss: (dest: AudioNode, at: number, dur: number, gain: number, freq: number, opts?: HissOptions) => void;
  /** a wooden "tok" (a marimba) */
  pluck: (dest: AudioNode, at: number, freq: number, gain?: number) => void;
  /** a bell / glockenspiel that rings out */
  bell: (dest: AudioNode, at: number, freq: number, dur?: number, gain?: number) => void;
  /** a trumpet-like note: it "blaats" at the start, then settles */
  brass: (dest: AudioNode, at: number, freq: number, dur: number, gain?: number) => void;
  /** a big drum with a falling pitch */
  timpani: (dest: AudioNode, at: number, freq: number, gain?: number) => void;
  snare: (dest: AudioNode, at: number, gain: number) => void;
  kick: (dest: AudioNode, at: number, gain?: number) => void;
  hat: (dest: AudioNode, at: number, gain?: number) => void;
  clap: (dest: AudioNode, at: number, gain?: number) => void;
  crash: (dest: AudioNode, at: number, dur: number, gain: number) => void;
  /** a crowd shouting "yaaay": noise that swells up and fades out */
  cheer: (dest: AudioNode, at: number, dur: number, gain: number) => void;
  /** hands clapping: many tiny bursts at uneven times */
  applause: (dest: AudioNode, at: number, dur: number, gain: number) => void;
  /** a slide whistle going up (or down when `from` is higher than `to`) */
  whistle: (dest: AudioNode, at: number, from: number, to: number, dur: number, gain?: number) => void;
  /** a cartoon "boing" */
  boing: (dest: AudioNode, at: number, gain?: number) => void;
  /** a bubble "pop" */
  pop: (dest: AudioNode, at: number, gain?: number) => void;
};

// the partials of a bell: [how many times the base pitch, how loud]
const BELL: [number, number][] = [[1, 1], [2.76, 0.35], [5.4, 0.15]];

export function createSynth(c: AudioContext): Synth {
  let seed = 7;
  let noise: AudioBuffer | null = null;

  const random = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  const noiseBuffer = (): AudioBuffer => {
    if (!noise) {
      noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = random() * 2 - 1;
      }
    }
    return noise;
  };

  const tone: Synth['tone'] = (dest, at, freq, dur, opts = {}) => {
    const t = c.currentTime + at;
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = opts.type ?? 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    if (opts.to) {
      osc.frequency.exponentialRampToValueAtTime(opts.to, t + (opts.bend ?? dur));
    }
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(opts.gain ?? 0.25, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env);
    env.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  };

  const hiss: Synth['hiss'] = (dest, at, dur, gain, freq, opts = {}) => {
    const t = c.currentTime + at;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer();
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = opts.type ?? 'bandpass';
    filter.Q.value = opts.q ?? 0.8;
    filter.frequency.setValueAtTime(freq, t);
    if (opts.to) {
      filter.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    }
    const env = c.createGain();
    if (opts.swell) {
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(gain, t + opts.swell);
    } else {
      env.gain.setValueAtTime(gain, t);
    }
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(env);
    env.connect(dest);
    src.start(t);
    src.stop(t + dur + 0.05);
  };

  const pluck: Synth['pluck'] = (dest, at, freq, gain = 0.22) => {
    tone(dest, at, freq, 0.4, { type: 'sine', gain });
    tone(dest, at, freq * 4, 0.1, { type: 'sine', gain: gain * 0.3 });
  };

  const bell: Synth['bell'] = (dest, at, freq, dur = 1, gain = 0.15) => {
    for (const [ratio, level] of BELL) {
      tone(dest, at, freq * ratio, ratio === 1 ? dur : dur * 0.5, { type: 'sine', gain: gain * level });
    }
  };

  const brass: Synth['brass'] = (dest, at, freq, dur, gain = 0.1) => {
    const t = c.currentTime + at;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 2;
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.exponentialRampToValueAtTime(3200, t + 0.09);
    filter.frequency.exponentialRampToValueAtTime(1400, t + dur);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.05);
    env.gain.setValueAtTime(gain, t + Math.max(0.06, dur - 0.15));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    filter.connect(env);
    env.connect(dest);
    for (const cents of [-7, 7]) {
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = cents;
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  };

  const timpani: Synth['timpani'] = (dest, at, freq, gain = 0.5) => {
    tone(dest, at, freq * 1.7, 0.7, { type: 'sine', gain, to: freq, bend: 0.09 });
  };

  const snare: Synth['snare'] = (dest, at, gain) => {
    hiss(dest, at, 0.13, gain, 3200, { q: 0.6 });
    tone(dest, at, 220, 0.09, { type: 'triangle', gain: gain * 0.5, to: 140 });
  };

  const kick: Synth['kick'] = (dest, at, gain = 0.5) => {
    tone(dest, at, 150, 0.22, { type: 'sine', gain, to: 42, bend: 0.12 });
  };

  const hat: Synth['hat'] = (dest, at, gain = 0.06) => {
    hiss(dest, at, 0.04, gain, 8000, { type: 'highpass', q: 0.5 });
  };

  const clap: Synth['clap'] = (dest, at, gain = 0.2) => {
    for (const d of [0, 0.012, 0.026]) {
      hiss(dest, at + d, 0.07, gain, 1500, { q: 1 });
    }
  };

  const crash: Synth['crash'] = (dest, at, dur, gain) => {
    hiss(dest, at, dur, gain, 5500, { type: 'highpass', q: 0.5 });
    hiss(dest, at, dur * 0.7, gain * 0.6, 9000, { q: 0.4 });
  };

  const cheer: Synth['cheer'] = (dest, at, dur, gain) => {
    hiss(dest, at, dur, gain, 1100, { q: 0.5, swell: dur * 0.25 });
    hiss(dest, at, dur, gain * 0.7, 2300, { q: 0.4, swell: dur * 0.25 });
  };

  const applause: Synth['applause'] = (dest, at, dur, gain) => {
    for (let t = 0; t < dur; t += 0.04 + random() * 0.07) {
      hiss(dest, at + t, 0.05, gain * (0.5 + random() * 0.5), 1600 + random() * 900, { q: 1.2 });
    }
  };

  const whistle: Synth['whistle'] = (dest, at, from, to, dur, gain = 0.1) => {
    tone(dest, at, from, dur, { type: 'sine', gain, to, bend: dur });
    // a little wobble, like a real slide whistle
    tone(dest, at, from * 1.01, dur, { type: 'sine', gain: gain * 0.4, to: to * 1.01, bend: dur });
  };

  const boing: Synth['boing'] = (dest, at, gain = 0.2) => {
    tone(dest, at, 180, 0.35, { type: 'sine', gain, to: 520, bend: 0.12 });
    tone(dest, at + 0.12, 520, 0.3, { type: 'sine', gain: gain * 0.7, to: 240, bend: 0.3 });
  };

  const pop: Synth['pop'] = (dest, at, gain = 0.2) => {
    tone(dest, at, 900, 0.07, { type: 'sine', gain, to: 280, bend: 0.06 });
  };

  return { random, tone, hiss, pluck, bell, brass, timpani, snare, kick, hat, clap, crash, cheer, applause, whistle, boing, pop };
}
