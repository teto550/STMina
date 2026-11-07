import type { CSSProperties, FC } from 'react';
import { suspenseMs } from '@/react/hooks/usePodiumShow';
import { delayed, isTop, lookOf, type PodiumStep } from '../podium';
import { ClimbPodium } from './ClimbPodium';

type SuspenseViewProps = {
  step: PodiumStep;
};

const COUNTDOWN = ['٣', '٢', '١'];

/** The wait before a kid is revealed. The top three: a question mark hops up a round podium. The places under them: the drum roll, the place named and a 3-2-1. */
export const SuspenseView: FC<SuspenseViewProps> = ({ step }) => {
  const { place, again } = step;
  const seconds = suspenseMs(step) / 1000;
  if (isTop(place)) {
    return <ClimbPodium place={place} seconds={seconds} again={again} />;
  }
  const each = seconds / COUNTDOWN.length;
  return (
    <div className="tw:flex tw:flex-col tw:items-center tw:gap-6 tw:text-center">
      <div className="rx-wiggle tw:text-7xl" aria-hidden="true">🥁</div>
      <h2 className="rx-beat tw:text-5xl tw:font-black">{lookOf(place).label}</h2>
      <p className="tw:text-2xl tw:font-bold tw:text-white/85">{again ? 'ومعاه كمان واحد! 😮' : 'تتوقعوا مين؟ 🤔'}</p>
      <div className="tw:relative tw:box-border tw:flex tw:size-44 tw:items-center tw:justify-center tw:rounded-full tw:border-4 tw:border-dashed tw:border-white/60 tw:bg-white/10" aria-hidden="true">
        <span className="tw:text-8xl tw:font-black tw:text-white/25">؟</span>
        {COUNTDOWN.map((n, i) => (
          <span
            key={n}
            className="rx-count tw:absolute tw:inset-0 tw:flex tw:items-center tw:justify-center tw:text-9xl tw:font-black tw:text-amber-300"
            style={{ ...delayed(i * each), '--rx-step': `${each}s` } as CSSProperties}
          >
            {n}
          </span>
        ))}
      </div>
      <div className="tw:flex tw:gap-3 tw:text-3xl" aria-hidden="true">
        {[0, 0.15, 0.3].map((d) => (
          <span key={d} className="rx-dot" style={delayed(d)}>●</span>
        ))}
      </div>
    </div>
  );
};
