import { useEffect, type FC } from 'react';
import { Case, Switch } from 'react-if';
import { ShowPhase, usePodiumShow } from '@/react/hooks/usePodiumShow';
import type { PodiumStep } from '../podium';
import { FinalView } from './FinalView';
import { IntroView } from './IntroView';
import { RevealView } from './RevealView';
import { SuspenseView } from './SuspenseView';

export type PodiumShowProps = {
  /** the places to reveal, third first and first last (see podiumSteps) */
  steps: PodiumStep[];
  onClose: () => void;
};

const CONTROL = 'tw:h-10 tw:cursor-pointer tw:rounded-full tw:bg-white/15 tw:px-4 tw:text-sm tw:font-bold tw:text-white';

/**
 * Statistics > النوتة الروحية > عرض: a full-screen show for the kids, like a quiz game's podium. Tap start, then the third place is announced
 * with a drum roll, then the second, then the winner with confetti and a fanfare, and the finished podium stays on the screen. It moves on by
 * itself; "التالي" jumps ahead, the speaker button mutes it.
 */
export const PodiumShow: FC<PodiumShowProps> = ({ steps, onClose }) => {
  const show = usePodiumShow(steps);
  const { phase, step } = show;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="عرض الفائزين" className="tw:fixed tw:inset-0 tw:z-[10010] tw:flex tw:flex-col tw:overflow-hidden tw:bg-linear-to-b tw:from-[#46178f] tw:via-[#5b21b6] tw:to-[#1e0b46] tw:text-white">
      <header className="tw:relative tw:z-10 tw:flex tw:items-center tw:justify-between tw:gap-2 tw:p-3">
        <button type="button" aria-label="إغلاق" onClick={onClose} className={`${CONTROL} tw:w-10 tw:px-0 tw:text-lg`}>✕</button>
        <div className="tw:flex tw:gap-2">
          {(phase === ShowPhase.Suspense || phase === ShowPhase.Reveal) && (
            <button type="button" aria-label="التالي" onClick={show.skip} className={CONTROL}>⏭ التالي</button>
          )}
          <button type="button" aria-label={show.muted ? 'تشغيل الصوت' : 'كتم الصوت'} onClick={show.toggleMute} className={`${CONTROL} tw:w-10 tw:px-0 tw:text-lg`}>
            {show.muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>
      <main aria-live="polite" className="tw:relative tw:flex tw:min-h-0 tw:flex-1 tw:items-center tw:justify-center tw:overflow-y-auto tw:px-4 tw:pb-8">
        <Switch>
          <Case condition={phase === ShowPhase.Intro}>
            <IntroView places={steps.length} onStart={show.start} />
          </Case>
          <Case condition={phase === ShowPhase.Suspense}>
            {step && <SuspenseView key={step.place} place={step.place} />}
          </Case>
          <Case condition={phase === ShowPhase.Reveal}>
            {step && <RevealView key={step.place} step={step} />}
          </Case>
          <Case condition={phase === ShowPhase.Final}>
            <FinalView steps={steps} onReplay={show.start} onClose={onClose} />
          </Case>
        </Switch>
      </main>
    </div>
  );
};
