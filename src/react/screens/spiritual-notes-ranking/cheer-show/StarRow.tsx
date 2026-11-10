import type { FC } from 'react';
import { MAX_STARS, starsText } from '../../spiritual-notes/logic';
import { delayed } from '../podium';
import { Burst } from '../podium-show/Burst';

type StarRowProps = {
  /** the stars the servant gave the kid, in halves (0 to 6): that many of the six stars light up */
  stars: number;
  /** how long (seconds) the row waits, dim, before the first star lights up */
  lightAfter?: number;
};

const SPARKS = ['✨', '💫', '🌟']; // not ⭐: that one is the star that lights up
const GAP = 0.5; // seconds between one star lighting up and the next

/** How much of star number `index` (0 = the first) is lit: all of it, half of it, or none. */
export const litPart = (stars: number, index: number): number => Math.min(1, Math.max(0, stars - index));

/**
 * The six stars of the kid's card (⭐ earned, ☆ not yet), all dim; then the stars the servant gave him light up one after the other, a half star
 * only on its first half (the card fills from the start side). A kid without stars keeps the six dim ones. It is all CSS (the delay of the
 * animation), so there is no timer.
 */
export const StarRow: FC<StarRowProps> = ({ stars, lightAfter = 1.1 }) => {
  const label = stars > 0 ? `${starsText(stars)} من ${starsText(MAX_STARS)} نجوم` : 'النجوم لسه مطفية';
  return (
    <div role="img" aria-label={label} className="tw:flex tw:items-center tw:justify-center tw:gap-2 tw:text-4xl">
      {Array.from({ length: MAX_STARS }, (_, i) => {
        const part = litPart(stars, i);
        return (
          <span key={i} className="tw:relative tw:inline-flex tw:size-10 tw:items-center tw:justify-center" aria-hidden="true">
            <span className="tw:opacity-35 tw:grayscale">☆</span>
            {part > 0 && (
              <span className="tw:absolute tw:inset-y-0 tw:start-0 tw:overflow-hidden" style={{ width: `${part * 100}%` }}>
                <span className="rx-pop tw:absolute tw:inset-y-0 tw:start-0 tw:flex tw:w-10 tw:items-center tw:justify-center" style={delayed(lightAfter + i * GAP)}>
                  <span className="rx-beat tw:drop-shadow-[0_0_14px_rgba(253,224,71,0.95)]">⭐</span>
                </span>
              </span>
            )}
            {part > 0 && (
              <span className="tw:absolute tw:inset-0" style={delayed(lightAfter + i * GAP)}>
                <Burst glyphs={SPARKS} count={6} radius={46} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
};
