import type { FC } from 'react';
import { delayed, PLACES, type PodiumPlace } from '../podium';

type SuspenseViewProps = {
  place: PodiumPlace;
};

/** The wait before a place is revealed: the drum roll plays, the place is named, the name is still a question mark. */
export const SuspenseView: FC<SuspenseViewProps> = ({ place }) => (
  <div className="tw:flex tw:flex-col tw:items-center tw:gap-6 tw:text-center">
    <div className="rx-beat tw:text-8xl" aria-hidden="true">🥁</div>
    <h2 className="rx-beat tw:text-5xl tw:font-black">{PLACES[place].label}</h2>
    <p className="tw:text-2xl tw:font-bold tw:text-white/80">تتوقعوا مين؟</p>
    <p className="tw:text-6xl tw:font-black tw:text-amber-300" aria-hidden="true">؟؟؟</p>
    <div className="tw:flex tw:gap-3 tw:text-3xl" aria-hidden="true">
      {[0, 0.15, 0.3].map((d) => (
        <span key={d} className="rx-dot" style={delayed(d)}>●</span>
      ))}
    </div>
  </div>
);
