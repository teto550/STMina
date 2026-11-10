import type { FC } from 'react';
import { delayed } from '../podium';
import { Burst } from '../podium-show/Burst';

/** How many stars are on the row (the same six as on the kid's card). */
export const STAR_COUNT = 6;

type StarRowProps = {
  /** how long (seconds) the row waits, dim, before the star lights up */
  lightAfter?: number;
};

const SPARKS = ['✨', '💫', '🌟']; // not ⭐: that one is the star that lights up

/**
 * The six stars of the kid's card (see the profile: ⭐ earned, ☆ not yet), all dim, and then ONE of them lights up with a pop, a glow and sparkles.
 * It is all CSS (the delay of the animation), so there is no timer; the lit star is the first one, the same place the card fills first.
 */
export const StarRow: FC<StarRowProps> = ({ lightAfter = 1.1 }) => (
  <div role="img" aria-label={`نجمة واحدة من ${STAR_COUNT.toLocaleString('ar-EG')} نجوم`} className="tw:flex tw:items-center tw:justify-center tw:gap-2 tw:text-4xl">
    {Array.from({ length: STAR_COUNT }, (_, i) => (
      <span key={i} className="tw:relative tw:inline-flex tw:size-10 tw:items-center tw:justify-center" aria-hidden="true">
        <span className="tw:opacity-35 tw:grayscale">☆</span>
        {i === 0 && (
          <span className="rx-pop tw:absolute tw:inset-0 tw:flex tw:items-center tw:justify-center" style={delayed(lightAfter)}>
            <span className="rx-beat tw:drop-shadow-[0_0_14px_rgba(253,224,71,0.95)]">⭐</span>
            <Burst glyphs={SPARKS} count={8} radius={56} />
          </span>
        )}
      </span>
    ))}
  </div>
);
