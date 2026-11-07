import type { FC } from 'react';
import { delayed, PLACES, type PodiumStep } from '../podium';
import { Confetti } from './Confetti';

type RevealViewProps = {
  step: PodiumStep;
};

/** A place revealed: the medal, the name (or the names of a tie) and the points, with confetti. The winner gets a crown, a glow and more confetti. */
export const RevealView: FC<RevealViewProps> = ({ step }) => {
  const look = PLACES[step.place];
  const winner = step.place === 1;
  const many = step.kids.length > 1;
  return (
    <div className="tw:flex tw:w-full tw:max-w-xl tw:flex-col tw:items-center tw:gap-4 tw:text-center">
      <Confetti count={winner ? 90 : 36} />
      {winner && (
        <div className="rx-pop tw:text-7xl" aria-hidden="true">👑</div>
      )}
      <div className="rx-pop tw:text-8xl" aria-hidden="true" style={delayed(0.1)}>{look.medal}</div>
      <p className="rx-pop tw:rounded-full tw:bg-white/15 tw:px-6 tw:py-1 tw:text-2xl tw:font-bold" style={delayed(0.2)}>{look.label}</p>
      <ul className="tw:flex tw:w-full tw:flex-col tw:gap-3">
        {step.kids.map((kid, i) => (
          <li key={kid.id} className="rx-pop" style={delayed(0.4 + i * 0.3)}>
            <div className={`${winner ? 'rx-glow ' : ''}tw:rounded-3xl tw:bg-linear-to-b ${look.card} ${look.ink} tw:px-6 tw:py-5 tw:shadow-2xl`}>
              <span className={`tw:block tw:font-black ${many ? 'tw:text-3xl' : 'tw:text-4xl tw:md:text-6xl'}`}>{kid.name}</span>
              <span className="tw:mt-1 tw:block tw:text-xl tw:font-bold">⭐ {kid.month} نقطة</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
