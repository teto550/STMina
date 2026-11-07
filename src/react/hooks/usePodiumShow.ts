// The winners show: which part is on the screen (waiting to start, the drum roll before a place, the place revealed, the finished podium),
// the timers that move it on by itself, and the sounds that go with each part.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPodiumSounds } from '@/react/lib/podium-sounds';
import type { PodiumStep } from '@/react/screens/spiritual-notes-ranking/podium';

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
  reveal: { 3: 4500, 2: 5000, 1: 7000 },
} as const;

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
    let wait = 0;
    if (state.phase === ShowPhase.Suspense && step) {
      wait = PODIUM_TIMES.suspense[step.place];
      sounds.drumroll(wait / 1000);
    } else if (state.phase === ShowPhase.Reveal && step) {
      wait = PODIUM_TIMES.reveal[step.place];
      sounds.reveal(step.place);
    } else if (state.phase === ShowPhase.Final) {
      sounds.jingle();
    }
    if (wait === 0) {
      return undefined;
    }
    const timer = window.setTimeout(() => setState((s) => after(s, count)), wait);
    return () => window.clearTimeout(timer);
  }, [state, step, count, sounds]);

  useEffect(() => () => sounds.stop(), [sounds]);

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
