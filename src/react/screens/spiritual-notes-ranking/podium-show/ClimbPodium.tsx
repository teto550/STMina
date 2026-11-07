import type { CSSProperties, FC } from 'react';
import { cheerOf, delayed, lookOf, shortName, type PodiumPlace, type PodiumStep } from '../podium';
import { Burst } from './Burst';
import { Confetti } from './Confetti';
import { KidPhoto } from './KidPhoto';

type ClimbPodiumProps = {
  /** the place of the kid (1, 2 or 3): the better the place, the taller the podium (4, 3 or 2 round tiers) */
  place: PodiumPlace;
  /** how long the question mark climbs, in seconds (the wait before the kid) */
  seconds: number;
  /** another kid of the same place (a tie): the wait is short and he is told he is not alone */
  again?: boolean;
  /** the kid, once he is revealed; without him the name is still a mystery and a question mark climbs the stairs */
  step?: PodiumStep;
};

const TIER_HEIGHT = 44;
const BOTTOM_WIDTH = 250;
const SHRINK = 46;
const HOP_SIDES = [-1, 1];
const SPARKS = ['⭐', '✨', '🌟', '💫'];
const TIER_COLORS: Record<PodiumPlace, [string, string]> = {
  3: ['#fdba74', '#c2410c'],
  2: ['#e2e8f0', '#64748b'],
  1: ['#fde047', '#d97706'],
};

/** How many round tiers a place has: 3rd = 2, 2nd = 3, 1st = 4. */
export const tiersOf = (place: PodiumPlace): number => 5 - place;

/** The spot (from the middle of the podium, from the ground) the question mark stands on after `hops` hops: 0 = the ground, the last one = the top. */
function spot(hops: number, tiers: number): { x: number; y: number } {
  const hop = Math.min(hops, tiers);
  if (hop === 0) {
    return { x: -(BOTTOM_WIDTH / 2 + 10), y: 0 };
  }
  const last = hop === tiers;
  return { x: last ? 0 : (HOP_SIDES[hop % 2] ?? 1) * (BOTTOM_WIDTH / 2 - SHRINK * hop), y: hop * TIER_HEIGHT };
}

/**
 * A round podium made of stacked round tiers (like the steps of a stage). Before the reveal a question mark hops up the tiers, from the ground to
 * the top, for `seconds`; then (when `step` is given) the kid's picture lands on the top with his name above it, his points and the confetti.
 */
export const ClimbPodium: FC<ClimbPodiumProps> = ({ place, seconds, again = false, step }) => {
  const tiers = tiersOf(place);
  const look = lookOf(place);
  const [light, dark] = TIER_COLORS[place];
  const winner = place === 1;
  const topY = tiers * TIER_HEIGHT;
  const waypoints = [0, 1, 2, 3, 4].map((i) => spot(i, tiers));
  const climb = { '--rx-dur': `${seconds}s`, '--rx-hop': `${(seconds * 0.8) / tiers / 2}s` } as CSSProperties;
  waypoints.forEach((w, i) => {
    (climb as Record<string, string>)[`--x${i}`] = `${w.x}px`;
    (climb as Record<string, string>)[`--y${i}`] = `${-w.y}px`;
  });
  const name = step ? shortName(step.kid.name) : '';

  return (
    <div className="tw:flex tw:w-full tw:max-w-xl tw:flex-col tw:items-center tw:gap-2 tw:text-center">
      {step && <Confetti count={winner ? 90 : 50} />}
      <h2 className="rx-beat tw:flex tw:items-center tw:gap-2 tw:text-4xl tw:font-black">
        <span aria-hidden="true">{look.medal}</span>
        <span>{look.label}</span>
      </h2>
      <p className="tw:text-xl tw:font-bold tw:text-white/85">{step ? cheerOf(place, step.face) : again ? 'ومعاه كمان واحد! 😮' : 'تتوقعوا مين هيوصل فوق؟ 🤔'}</p>
      <div className="tw:relative" style={{ width: BOTTOM_WIDTH + 40, height: topY + 250 }} data-testid="climb-podium">
        {/* the round tiers, the widest at the bottom */}
        {Array.from({ length: tiers }, (_, k) => (
          <div
            key={k}
            aria-hidden="true"
            className={`${step ? '' : 'rx-grow '}tw:absolute tw:flex tw:items-center tw:justify-center tw:text-3xl`}
            style={{
              ...delayed(k * 0.12),
              bottom: k * TIER_HEIGHT,
              left: '50%',
              width: BOTTOM_WIDTH - k * SHRINK,
              height: TIER_HEIGHT,
              marginLeft: -(BOTTOM_WIDTH - k * SHRINK) / 2,
              borderRadius: '50% 50% 14px 14px / 40% 40% 14px 14px',
              background: `linear-gradient(180deg, ${light}, ${dark})`,
              boxShadow: 'inset 0 6px 0 rgba(255,255,255,0.35), 0 4px 10px rgba(0,0,0,0.3)',
            }}
          >
            {k === tiers - 1 ? look.medal : ''}
          </div>
        ))}
        {/* before the reveal: the question mark hopping up the tiers */}
        {!step && (
          <div className="rx-climb tw:absolute tw:z-10" style={{ ...climb, bottom: 0, left: '50%', marginLeft: -28 }} aria-hidden="true">
            <span className="rx-hop tw:flex tw:size-14 tw:items-center tw:justify-center tw:rounded-full tw:bg-amber-300 tw:text-4xl tw:font-black tw:text-amber-950 tw:shadow-xl">؟</span>
          </div>
        )}
        {/* after it: the picture lands on the top, the name appears above it */}
        {step && (
          <div className="tw:absolute tw:inset-x-0 tw:flex tw:flex-col tw:items-center tw:gap-2" style={{ bottom: topY + 6 }}>
            <div className="rx-pop tw:relative" style={delayed(0.1)}>
              <Burst glyphs={SPARKS} count={winner ? 14 : 10} radius={winner ? 170 : 130} />
              {winner && <div className="rx-wiggle tw:absolute tw:inset-x-0 tw:-top-10 tw:z-10 tw:flex tw:justify-center tw:text-5xl" aria-hidden="true">👑</div>}
              <div className={winner ? 'rx-glow tw:rounded-full' : undefined}>
                <KidPhoto name={name} photo={step.photo} face={step.face} size={winner ? 130 : 110} />
              </div>
            </div>
            <div className={`rx-pop tw:box-border tw:w-full tw:rounded-3xl tw:bg-linear-to-b ${look.card} ${look.ink} tw:px-5 tw:py-3 tw:shadow-2xl`} style={delayed(0.35)}>
              <span className="tw:block tw:text-3xl tw:font-black tw:md:text-5xl">{name}</span>
              <span className="tw:block tw:text-lg tw:font-bold">⭐ {step.kid.month} نقطة</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
