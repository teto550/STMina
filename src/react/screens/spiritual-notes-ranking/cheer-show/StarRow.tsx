import type { FC } from 'react';
import { MAX_STARS, starsText } from '../../spiritual-notes/logic';
import { delayed } from '../podium';

type StarRowProps = {
  /** the stars the servant gave the kid, in halves (0 to 6): that many of the six stars light up */
  stars: number;
  /** how long (seconds) the row waits, dim, before the first star lights up */
  lightAfter?: number;
};

const GAP = 0.6; // seconds between one star lighting up and the next

/** How much of star number `index` (0 = the first) is lit: all of it, half of it, or none. */
export const litPart = (stars: number, index: number): number => Math.min(1, Math.max(0, stars - index));

/**
 * The six stars of the kid's card (⭐ earned, ☆ not yet), big, all dim; then the stars the servant gave him light up one after the other, each with ONE entrance
 * (it spins and grows in with a flash) and then it stays a plain star: no beat, no glow, no sparks after it. A half star shows only its first half (the card
 * fills from the start side; the app is right to left, so that is the right half). It is all CSS (the delay of the animation), so there is no timer.
 */
export const StarRow: FC<StarRowProps> = ({ stars, lightAfter = 1.1 }) => {
  const label = stars > 0 ? `${starsText(stars)} من ${starsText(MAX_STARS)} نجوم` : 'النجوم لسه مطفية';
  return (
    <div role="img" aria-label={label} className="tw:flex tw:items-center tw:justify-center tw:gap-1.5 tw:text-5xl tw:md:gap-3 tw:md:text-7xl">
      {Array.from({ length: MAX_STARS }, (_, i) => {
        const part = litPart(stars, i);
        return (
          <span key={i} className="tw:relative tw:inline-flex tw:size-12 tw:items-center tw:justify-center tw:md:size-[4.5rem]" aria-hidden="true">
            <span className="tw:opacity-35 tw:grayscale">☆</span>
            {part > 0 && (
              <span
                className="rx-star-in tw:absolute tw:inset-0 tw:flex tw:items-center tw:justify-center"
                style={{ ...delayed(lightAfter + i * GAP), ...(part < 1 ? { clipPath: 'inset(0 0 0 50%)' } : {}) }}
              >
                ⭐
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
};
