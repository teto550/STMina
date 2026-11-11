import type { FC } from 'react';
import { delayed, shortName } from '../podium';
import type { CheerStep } from '../cheer';
import { Burst } from '../podium-show/Burst';
import { Confetti } from '../podium-show/Confetti';
import { KidPhoto } from '../podium-show/KidPhoto';
import { StarRow } from './StarRow';

type CheerKidViewProps = {
  step: CheerStep;
};

const SPARKS = ['⭐', '✨', '🌟', '💫', '🎈'];

/** One kid on his own: his picture bursting with stars, his first two names and the six stars of his card, with the ones the servant gave him lighting up, with confetti. No place, no points, no sentence. */
export const CheerKidView: FC<CheerKidViewProps> = ({ step }) => {
  const name = shortName(step.kid.name);
  return (
    <div className="tw:flex tw:w-full tw:max-w-2xl tw:flex-col tw:items-center tw:gap-7 tw:text-center">
      <Confetti count={50} />
      <div className="rx-pop tw:relative" style={delayed(0.1)}>
        {[0, 0.7, 1.4].map((d) => (
          <span key={d} className="rx-ring tw:absolute tw:inset-0 tw:rounded-full tw:border-4 tw:border-white/60" style={delayed(d)} aria-hidden="true" />
        ))}
        <Burst glyphs={SPARKS} count={12} radius={170} />
        <div className="rx-glow tw:rounded-full">
          <KidPhoto name={name} photo={step.photo} face={step.face} size={190} />
        </div>
      </div>
      <span className="rx-pop tw:block tw:text-4xl tw:font-black tw:drop-shadow-lg tw:md:text-6xl" style={delayed(0.3)}>{name}</span>
      <StarRow stars={step.stars} />
    </div>
  );
};
