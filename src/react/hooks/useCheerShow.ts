// The cheer show: which part is on the screen (waiting to start, one kid, the finished picture of everyone), the timer that moves it on by itself,
// and the sounds that go with it. The sounds are the ones of the winners show (podium-sounds): happy music all the way, no drum roll.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPodiumSounds } from '@/react/lib/podium-sounds';
import type { CheerStep } from '@/react/screens/spiritual-notes-ranking/cheer';

export enum CheerPhase {
  Intro = 'intro',
  Kid = 'kid',
  Final = 'final',
}

type CheerState = { phase: CheerPhase; index: number };

/** How long each kid stays on the screen (ms). */
export const CHEER_KID_MS = 5000;

/** The part that follows `state`: the first kid, the next kid... then the picture of everyone. */
function after(state: CheerState, count: number): CheerState {
  if (state.phase === CheerPhase.Intro) {
    return count > 0 ? { phase: CheerPhase.Kid, index: 0 } : { phase: CheerPhase.Final, index: 0 };
  }
  if (state.phase === CheerPhase.Kid) {
    return state.index + 1 < count ? { phase: CheerPhase.Kid, index: state.index + 1 } : { phase: CheerPhase.Final, index: state.index };
  }
  return state;
}

export function useCheerShow(steps: CheerStep[]) {
  const sounds = useMemo(() => createPodiumSounds(), []);
  const [state, setState] = useState<CheerState>({ phase: CheerPhase.Intro, index: 0 });
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const count = steps.length;
  const step = steps[state.index];

  // the sounds of each part (they do not depend on `paused`, so pausing does not play a kid's sounds again)
  useEffect(() => {
    sounds.stop();
    if (state.phase === CheerPhase.Kid && step) {
      sounds.music('party', step.face);
      sounds.reveal(3, step.face);
    } else if (state.phase === CheerPhase.Final) {
      sounds.music('finale', 0);
      sounds.jingle();
    }
  }, [state, step, sounds]);

  // the time a kid stays: stopped while paused
  useEffect(() => {
    if (state.phase !== CheerPhase.Kid || paused) {
      return undefined;
    }
    const timer = window.setTimeout(() => setState((s) => after(s, count)), CHEER_KID_MS);
    return () => window.clearTimeout(timer);
  }, [state, paused, count]);

  useEffect(() => () => sounds.shutdown(), [sounds]);

  /** The first tap: it also wakes the audio up (browsers keep it locked until a tap). Used again to play the show from the start. */
  const start = useCallback(() => {
    sounds.unlock();
    setPaused(false);
    setState(count > 0 ? { phase: CheerPhase.Kid, index: 0 } : { phase: CheerPhase.Final, index: 0 });
  }, [sounds, count]);

  /** Jumps to the next kid now (or to the picture of everyone after the last one). */
  const skip = useCallback(() => {
    setPaused(false);
    setState((s) => after(s, count));
  }, [count]);

  const togglePause = useCallback(() => setPaused((p) => !p), []);

  const toggleMute = useCallback(() => {
    sounds.setMuted(!muted);
    setMuted(!muted);
  }, [sounds, muted]);

  return { phase: state.phase, step, muted, paused, start, skip, togglePause, toggleMute, position: state.index + 1, total: count };
}
