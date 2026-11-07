// The winners show: which part is on the screen (waiting to start, the drum roll before a kid, the kid revealed, the finished podium),
// the timers that move it on by itself, and the sounds that go with each part.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPodiumSounds } from '@/react/lib/podium-sounds';
import { isTop, type PodiumStep } from '@/react/screens/spiritual-notes-ranking/podium';

export enum ShowPhase {
  Intro = 'intro',
  Suspense = 'suspense',
  Reveal = 'reveal',
  Final = 'final',
}

type ShowState = { phase: ShowPhase; index: number };

/** How long each part lasts (ms): the drum roll before a place, then the place on the screen. The winner waits and stays the longest. */
export const PODIUM_TIMES = {
  suspense: { 3: 3200, 2: 3600, 1: 4800 },
  /** the drum roll before a kid that ties with the one just shown: short, the place is already known */
  tie: 2000,
  reveal: { 3: 4500, 2: 5000, 1: 7000 },
  /** the places under the third: a short drum roll and a short reveal, so a long list does not drag */
  other: { suspense: 2200, reveal: 3200 },
} as const;

/** How long the drum roll (for the top three: the climb of the question mark) before this kid lasts, in ms. */
export function suspenseMs(step: PodiumStep): number {
  if (step.again) {
    return PODIUM_TIMES.tie;
  }
  return isTop(step.place) ? PODIUM_TIMES.suspense[step.place] : PODIUM_TIMES.other.suspense;
}

/** How long this kid stays on the screen, in ms. */
export function revealMs(step: PodiumStep): number {
  return isTop(step.place) ? PODIUM_TIMES.reveal[step.place] : PODIUM_TIMES.other.reveal;
}

/** The part that follows `state` (the drum roll, the place, the next drum roll... then the finished podium). */
function after(state: ShowState, count: number): ShowState {
  if (state.phase === ShowPhase.Intro) {
    return { phase: ShowPhase.Suspense, index: 0 };
  }
  if (state.phase === ShowPhase.Suspense) {
    return { phase: ShowPhase.Reveal, index: state.index };
  }
  if (state.phase === ShowPhase.Reveal) {
    return state.index + 1 < count ? { phase: ShowPhase.Suspense, index: state.index + 1 } : { phase: ShowPhase.Final, index: state.index };
  }
  return state;
}

export function usePodiumShow(steps: PodiumStep[]) {
  const sounds = useMemo(() => createPodiumSounds(), []);
  const [state, setState] = useState<ShowState>({ phase: ShowPhase.Intro, index: 0 });
  const [muted, setMuted] = useState(false);
  const count = steps.length;
  const step = steps[state.index];

  useEffect(() => {
    sounds.stop();
    const variant = step?.face ?? 0;
    let wait = 0;
    if (state.phase === ShowPhase.Suspense && step) {
      wait = suspenseMs(step);
      sounds.music('tense', variant);
      sounds.drumroll(wait / 1000, variant);
    } else if (state.phase === ShowPhase.Reveal && step) {
      wait = revealMs(step);
      sounds.music('party', variant);
      sounds.reveal(isTop(step.place) ? step.place : 3, variant);
    } else if (state.phase === ShowPhase.Final) {
      sounds.music('finale', variant);
      sounds.jingle();
    }
    if (wait === 0) {
      return undefined;
    }
    const timer = window.setTimeout(() => setState((s) => after(s, count)), wait);
    return () => window.clearTimeout(timer);
  }, [state, step, count, sounds]);

  useEffect(() => () => sounds.shutdown(), [sounds]);

  /** The first tap: it also wakes the audio up (browsers keep it locked until a tap). Used again to play the show from the start. */
  const start = useCallback(() => {
    sounds.unlock();
    setState({ phase: ShowPhase.Suspense, index: 0 });
  }, [sounds]);

  /** Jumps to the next part now, without waiting for the timer. */
  const skip = useCallback(() => setState((s) => after(s, count)), [count]);

  const toggleMute = useCallback(() => {
    sounds.setMuted(!muted);
    setMuted(!muted);
  }, [sounds, muted]);

  return { phase: state.phase, step, muted, start, skip, toggleMute };
}
