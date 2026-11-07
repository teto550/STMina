import { useEffect, type FC } from 'react';
import { Case, Switch } from 'react-if';
import { ShowPhase, usePodiumShow } from '@/react/hooks/usePodiumShow';
import type { PodiumStep } from '../podium';
import { Backdrop } from './Backdrop';
import { FinalView } from './FinalView';
import { IntroView } from './IntroView';
import { RevealView } from './RevealView';
import { SuspenseView } from './SuspenseView';

export type PodiumShowProps = {
  /** the kids to reveal one by one, third place first and first place last (see podiumSteps) */
  steps: PodiumStep[];
  onClose: () => void;
};

// The background of each part: its colours (full class names, so Tailwind finds them) and the shapes floating up the screen.
const SHAPES = {
  intro: ['⭐', '🏆', '🎈', '✨', '🎉'],
  suspense: ['❓', '🥁', '✨', '⭐', '🔥', '🤔'],
  reveal: ['⭐', '🌟', '🎈', '🎉', '🏅', '💪', '👏', '🚀', '🔥'],
  final: ['🏆', '🎉', '🥇', '🌟', '🎈', '👏', '👑', '🎊'],
};
const SKY: Record<'intro' | 'suspense' | 'final' | 'third' | 'second' | 'first', string> = {
  intro: 'tw:from-[#46178f] tw:via-[#5b21b6] tw:to-[#1e0b46]',
  suspense: 'tw:from-[#0f172a] tw:via-[#1e1b4b] tw:to-[#312e81]',
  third: 'tw:from-[#ea580c] tw:via-[#be185d] tw:to-[#4c1d95]',
  second: 'tw:from-[#0284c7] tw:via-[#6366f1] tw:to-[#4c1d95]',
  first: 'tw:from-[#d97706] tw:via-[#c2410c] tw:to-[#9d174d]',
  final: 'tw:from-[#c026d3] tw:via-[#7c3aed] tw:to-[#1d4ed8]',
};
const REVEAL_SKY = { 3: SKY.third, 2: SKY.second, 1: SKY.first } as const;

const CONTROL = 'tw:h-10 tw:cursor-pointer tw:rounded-full tw:bg-white/15 tw:px-4 tw:text-sm tw:font-bold tw:text-white';

/**
 * Statistics > النوتة الروحية > عرض: a full-screen show for the kids, like a quiz game's podium. Tap start, then the third place is announced
 * with a drum roll, then the second, then the winner with confetti and a fanfare, and the finished podium stays on the screen. Every kid comes on
 * his own with his picture (kids that tie come one after the other, in the same place). It moves on by itself; "التالي" jumps ahead, the speaker
 * button mutes it.
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

  let sky = SKY.intro;
  let shapes = SHAPES.intro;
  if (phase === ShowPhase.Suspense) {
    sky = SKY.suspense;
    shapes = SHAPES.suspense;
  } else if (phase === ShowPhase.Reveal && step) {
    sky = REVEAL_SKY[step.place];
    shapes = SHAPES.reveal;
  } else if (phase === ShowPhase.Final) {
    sky = SKY.final;
    shapes = SHAPES.final;
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="عرض الفائزين" className={`tw:fixed tw:inset-0 tw:z-[10010] tw:flex tw:flex-col tw:overflow-hidden tw:bg-linear-to-b ${sky} tw:text-white`}>
      <Backdrop glyphs={shapes} />
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
            <IntroView onStart={show.start} />
          </Case>
          <Case condition={phase === ShowPhase.Suspense}>
            {step && <SuspenseView key={step.face} place={step.place} again={step.again} />}
          </Case>
          <Case condition={phase === ShowPhase.Reveal}>
            {step && <RevealView key={step.face} step={step} />}
          </Case>
          <Case condition={phase === ShowPhase.Final}>
            <FinalView steps={steps} onReplay={show.start} onClose={onClose} />
          </Case>
        </Switch>
      </main>
    </div>
  );
};
