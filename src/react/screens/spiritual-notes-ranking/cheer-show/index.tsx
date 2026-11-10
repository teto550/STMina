import { useEffect, type FC } from 'react';
import { Case, Switch } from 'react-if';
import { CheerPhase, useCheerShow } from '@/react/hooks/useCheerShow';
import type { CheerStep } from '../cheer';
import { Backdrop } from '../podium-show/Backdrop';
import { CheerFinal } from './CheerFinal';
import { CheerIntro } from './CheerIntro';
import { CheerKidView } from './CheerKidView';

export type CheerShowProps = {
  /** the kids to show one by one, already in the order of the show (see cheerSteps) */
  steps: CheerStep[];
  onClose: () => void;
};

const SHAPES = {
  intro: ['⭐', '🎈', '✨', '🎉', '🌟'],
  kid: ['⭐', '🌟', '🎈', '🎉', '💪', '👏', '🚀', '🌈', '💛'],
  final: ['🏆', '🎉', '🌟', '🎈', '👏', '👑', '🎊', '💛'],
};

// the colours of each kid's screen (a different one for every kid, full class names so Tailwind finds them)
const SKIES = [
  'tw:from-[#0284c7] tw:via-[#6366f1] tw:to-[#4c1d95]',
  'tw:from-[#ea580c] tw:via-[#be185d] tw:to-[#4c1d95]',
  'tw:from-[#059669] tw:via-[#0891b2] tw:to-[#1e3a8a]',
  'tw:from-[#d97706] tw:via-[#c2410c] tw:to-[#9d174d]',
  'tw:from-[#7c3aed] tw:via-[#c026d3] tw:to-[#be185d]',
  'tw:from-[#0d9488] tw:via-[#2563eb] tw:to-[#6d28d9]',
];
const INTRO_SKY = 'tw:from-[#46178f] tw:via-[#5b21b6] tw:to-[#1e0b46]';
const FINAL_SKY = 'tw:from-[#c026d3] tw:via-[#7c3aed] tw:to-[#1d4ed8]';

const CONTROL = 'tw:h-10 tw:cursor-pointer tw:rounded-full tw:bg-white/15 tw:px-4 tw:text-sm tw:font-bold tw:text-white';

/**
 * Statistics > النوتة الروحية > عرض التشجيع: a full-screen fun show for every kid that has points. No places and no order: each kid comes on his own with his
 * picture, his name and a short rhyme, with confetti and happy music; at the end they are all on the screen together. It moves on by itself;
 * "التالي" jumps ahead, the pause button holds the kid on the screen, the speaker button mutes it.
 */
export const CheerShow: FC<CheerShowProps> = ({ steps, onClose }) => {
  const show = useCheerShow(steps);
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

  let sky = INTRO_SKY;
  let shapes = SHAPES.intro;
  if (phase === CheerPhase.Kid && step) {
    sky = SKIES[step.face % SKIES.length] ?? INTRO_SKY;
    shapes = SHAPES.kid;
  } else if (phase === CheerPhase.Final) {
    sky = FINAL_SKY;
    shapes = SHAPES.final;
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="عرض التشجيع" className={`tw:fixed tw:inset-0 tw:z-[10010] tw:flex tw:flex-col tw:overflow-hidden tw:bg-linear-to-b ${sky} tw:text-white`}>
      <Backdrop glyphs={shapes} />
      <header className="tw:relative tw:z-10 tw:flex tw:items-center tw:justify-between tw:gap-2 tw:p-3">
        <button type="button" aria-label="إغلاق" onClick={onClose} className={`${CONTROL} tw:w-10 tw:px-0 tw:text-lg`}>✕</button>
        <div className="tw:flex tw:items-center tw:gap-2">
          {phase === CheerPhase.Kid && (
            <>
              <span className="tw:text-sm tw:font-bold tw:text-white/80" aria-label="رقم البطل">{show.position.toLocaleString('ar-EG')} / {show.total.toLocaleString('ar-EG')}</span>
              <button type="button" aria-pressed={show.paused} aria-label={show.paused ? 'استئناف' : 'إيقاف مؤقت'} onClick={show.togglePause} className={CONTROL}>
                {show.paused ? '▶ كمّل' : '⏸ إيقاف'}
              </button>
              <button type="button" aria-label="التالي" onClick={show.skip} className={CONTROL}>⏭ التالي</button>
            </>
          )}
          <button type="button" aria-label={show.muted ? 'تشغيل الصوت' : 'كتم الصوت'} onClick={show.toggleMute} className={`${CONTROL} tw:w-10 tw:px-0 tw:text-lg`}>
            {show.muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>
      <main aria-live="polite" className="tw:relative tw:flex tw:min-h-0 tw:flex-1 tw:items-center tw:justify-center tw:overflow-y-auto tw:px-4 tw:pb-8">
        <Switch>
          <Case condition={phase === CheerPhase.Intro}>
            <CheerIntro onStart={show.start} total={steps.length} />
          </Case>
          <Case condition={phase === CheerPhase.Kid}>
            {step && <CheerKidView key={step.face} step={step} />}
          </Case>
          <Case condition={phase === CheerPhase.Final}>
            <CheerFinal steps={steps} onReplay={show.start} onClose={onClose} />
          </Case>
        </Switch>
      </main>
    </div>
  );
};
