import type { FC } from 'react';
import { cheerOf, delayed, isTop, lookOf, shortName, type PodiumStep } from '../podium';
import { Burst } from './Burst';
import { ClimbPodium } from './ClimbPodium';
import { Confetti } from './Confetti';
import { KidPhoto } from './KidPhoto';

type RevealViewProps = {
  step: PodiumStep;
};

const SPARKS = ['⭐', '✨', '🌟', '💫'];

/**
 * One kid revealed (the top three: his picture lands on the round podium, see ClimbPodium; the others: the card below). The card: his picture with the medal, rings and stars bursting around it, his place, his first two names, his points and a cheer,
 * with confetti. The winner gets a crown, a glow and more of everything.
 */
export const RevealView: FC<RevealViewProps> = ({ step }) => {
  if (isTop(step.place)) {
    return <ClimbPodium place={step.place} seconds={0} step={step} />;
  }
  const look = lookOf(step.place);
  const winner = step.place === 1;
  const name = shortName(step.kid.name);
  return (
    <div className="tw:flex tw:w-full tw:max-w-xl tw:flex-col tw:items-center tw:gap-5 tw:text-center">
      <Confetti count={winner ? 90 : 40} />
      <div className="rx-pop tw:relative" style={delayed(0.1)}>
        {[0, 0.7, 1.4].map((d) => (
          <span key={d} className="rx-ring tw:absolute tw:inset-0 tw:rounded-full tw:border-4 tw:border-white/60" style={delayed(d)} aria-hidden="true" />
        ))}
        <Burst glyphs={SPARKS} count={winner ? 14 : 10} radius={winner ? 190 : 150} />
        {winner && (
          <div className="rx-wiggle tw:absolute tw:inset-x-0 tw:-top-12 tw:z-10 tw:flex tw:justify-center tw:text-6xl" aria-hidden="true">👑</div>
        )}
        <div className={winner ? 'rx-glow tw:rounded-full' : undefined}>
          <KidPhoto name={name} photo={step.photo} face={step.face} size={170} />
        </div>
        <span className="tw:absolute tw:-bottom-3 tw:-end-3 tw:text-6xl" aria-hidden="true">{look.medal}</span>
      </div>
      <p className="rx-pop tw:mt-2 tw:rounded-full tw:bg-white/15 tw:px-6 tw:py-1 tw:text-2xl tw:font-bold" style={delayed(0.25)}>{look.label}</p>
      <div className={`rx-pop tw:box-border tw:w-full tw:rounded-3xl tw:bg-linear-to-b ${look.card} ${look.ink} tw:px-6 tw:py-5 tw:shadow-2xl`} style={delayed(0.4)}>
        <span className="tw:block tw:text-4xl tw:font-black tw:md:text-6xl">{name}</span>
        <span className="tw:mt-1 tw:block tw:text-xl tw:font-bold">⭐ {step.kid.month} نقطة</span>
      </div>
      <p className="rx-pop rx-wiggle tw:text-3xl tw:font-black tw:text-amber-200 tw:drop-shadow-lg" style={delayed(0.7)}>{cheerOf(step.place, step.face)}</p>
    </div>
  );
};
