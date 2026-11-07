import type { CSSProperties, FC } from 'react';
import { cheerOf, delayed, lookOf, shortName, type PodiumPlace, type PodiumStep } from '../podium';
import { Burst } from './Burst';
import { Confetti } from './Confetti';
import { KidPhoto } from './KidPhoto';

type ClimbPodiumProps = {
  /** the place of the kid (1, 2 or 3): the better the place, the taller the podium */
  place: PodiumPlace;
  /** how long the question mark climbs, in seconds (the wait before the kid) */
  seconds: number;
  /** another kid of the same place (a tie): the wait is short and he is told he is not alone */
  again?: boolean;
  /** the kid, once he is revealed; without him the name is still a mystery and a question mark climbs the stairs */
  step?: PodiumStep;
};

/** Everything is drawn in `u` units (1u = `--s`, a little more than a pixel, bigger on a wide screen), so the scene keeps its shape on any screen. */
const u = (n: number): string => `calc(var(--s) * ${n})`;

/** The stairs that lead up to the podium: always three. */
export const STAIRS = 3;
const STAIR_WIDTH = 18;
const PLATFORM_WIDTH = 96;
const SCENE_WIDTH = PLATFORM_WIDTH + STAIRS * STAIR_WIDTH;
const START_X = SCENE_WIDTH + 14; // where the question mark starts: on the ground, past the last stair
const HOP_SIZE = 28;
const TOP_SPACE = 92; // room above the podium for the picture (and the crown)

/** How tall the round podium is: the better the place, the taller. */
export const PODIUM_HEIGHT: Record<PodiumPlace, number> = { 3: 60, 2: 84, 1: 108 };
const COLORS: Record<PodiumPlace, [string, string]> = {
  3: ['#fdba74', '#c2410c'],
  2: ['#e2e8f0', '#64748b'],
  1: ['#fde047', '#d97706'],
};
const SPARKS = ['⭐', '✨', '🌟', '💫'];

/** The five spots the question mark stands on, from the ground: the three stairs, then the top of the podium (x from the left of the scene, y from the ground, in u). */
function spots(height: number): { x: number; y: number }[] {
  const stairs = Array.from({ length: STAIRS }, (_, i) => {
    const k = i + 1; // 1 = the lowest, the farthest from the podium
    return { x: PLATFORM_WIDTH + (STAIRS - k) * STAIR_WIDTH + STAIR_WIDTH / 2, y: (height * k) / (STAIRS + 1) };
  });
  return [{ x: START_X, y: 0 }, ...stairs, { x: PLATFORM_WIDTH / 2, y: height + 6 }];
}

/**
 * A big round podium with three stairs on its right side, and the words on its LEFT (so nothing hides behind the picture). Before the reveal a
 * question mark hops up the three stairs and onto the podium, for `seconds`; then (when `step` is given) the kid's picture lands on the top of
 * the podium, with his name, his points and the cheer written on the left, and the confetti.
 */
export const ClimbPodium: FC<ClimbPodiumProps> = ({ place, seconds, again = false, step }) => {
  const look = lookOf(place);
  const [light, dark] = COLORS[place];
  const winner = place === 1;
  const height = PODIUM_HEIGHT[place];
  const name = step ? shortName(step.kid.name) : '';
  const photoSize = winner ? 104 : 92;

  const scene = { '--s': 'clamp(1.35px, 0.42vw, 2.1px)' } as CSSProperties;
  const climb = { '--rx-dur': `${seconds}s`, '--rx-hop': `${seconds * 0.2}s` } as CSSProperties;
  spots(height).forEach((p, i) => {
    (climb as Record<string, string>)[`--x${i}`] = u(p.x);
    (climb as Record<string, string>)[`--y${i}`] = u(-p.y);
  });

  return (
    <div dir="ltr" className="tw:flex tw:w-full tw:max-w-xl tw:items-center tw:gap-2" style={scene}>
      {step && <Confetti count={winner ? 90 : 50} />}
      {/* the words, on the left */}
      <div dir="rtl" data-testid="climb-text" className="tw:min-w-0 tw:flex-1" style={{ textAlign: 'left' }}>
        <h2 className="rx-beat tw:inline-block tw:text-2xl tw:font-black tw:md:text-4xl">
          <span aria-hidden="true">{look.medal} </span>
          <span>{look.label}</span>
        </h2>
        <p className="tw:mt-2 tw:text-base tw:font-bold tw:text-white/85 tw:md:text-xl">{step ? cheerOf(place, step.face) : again ? 'ومعاه كمان واحد! 😮' : 'تتوقعوا مين هيوصل فوق؟ 🤔'}</p>
        {step && (
          <div className={`rx-pop tw:mt-3 tw:box-border tw:rounded-2xl tw:bg-linear-to-b ${look.card} ${look.ink} tw:px-3 tw:py-2 tw:shadow-2xl`} style={delayed(0.35)}>
            <span className="tw:block tw:text-2xl tw:leading-tight tw:font-black tw:md:text-4xl">{name}</span>
            <span className="tw:block tw:text-base tw:font-bold">⭐ {step.kid.month} نقطة</span>
          </div>
        )}
      </div>

      {/* the scene: the podium on the left of it, the three stairs on its right */}
      <div className="tw:relative tw:shrink-0" style={{ width: u(SCENE_WIDTH), height: u(height + TOP_SPACE) }} data-testid="climb-podium">
        {Array.from({ length: STAIRS }, (_, i) => {
          const k = i + 1;
          return (
            <div
              key={k}
              data-testid="stair"
              aria-hidden="true"
              className={step ? undefined : 'rx-grow'}
              style={{
                ...delayed(0.1 * k),
                position: 'absolute',
                bottom: 0,
                left: u(PLATFORM_WIDTH + (STAIRS - k) * STAIR_WIDTH),
                width: u(STAIR_WIDTH),
                height: u((height * k) / (STAIRS + 1)),
                borderRadius: `${u(5)} ${u(5)} 0 0`,
                background: `linear-gradient(180deg, ${light}, ${dark})`,
                boxShadow: 'inset 0 4px 0 rgba(255,255,255,0.4), 0 3px 8px rgba(0,0,0,0.3)',
              }}
            />
          );
        })}
        {/* the round podium: a body with an oval top */}
        <div className={step ? undefined : 'rx-grow'} aria-hidden="true" style={{ position: 'absolute', bottom: 0, left: 0, width: u(PLATFORM_WIDTH), height: u(height) }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: `0 0 ${u(48)} ${u(48)} / 0 0 ${u(14)} ${u(14)}`,
              background: `linear-gradient(180deg, ${light}, ${dark})`,
              boxShadow: '0 6px 14px rgba(0,0,0,0.35)',
            }}
          />
          <div style={{ position: 'absolute', top: u(-11), left: 0, width: '100%', height: u(22), borderRadius: '50%', background: `linear-gradient(180deg, #fff8, ${light})`, boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.12)' }} />
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: u(30) }}>{look.medal}</span>
        </div>
        {/* before the reveal: the question mark hopping up the three stairs and onto the podium */}
        {!step && (
          <div className="rx-climb" style={{ ...climb, position: 'absolute', zIndex: 10, bottom: 0, left: 0, marginLeft: u(-HOP_SIZE / 2) }} aria-hidden="true">
            <span className="rx-hop tw:flex tw:items-center tw:justify-center tw:rounded-full tw:bg-amber-300 tw:font-black tw:text-amber-950 tw:shadow-xl" style={{ width: u(HOP_SIZE), height: u(HOP_SIZE), fontSize: u(20) }}>؟</span>
          </div>
        )}
        {/* after it: the picture lands on the top of the podium */}
        {step && (
          <div className="rx-pop" style={{ ...delayed(0.1), position: 'absolute', zIndex: 10, left: u(PLATFORM_WIDTH / 2), marginLeft: -photoSize / 2, bottom: `calc(var(--s) * ${height + 8})`, width: photoSize }}>
            <Burst glyphs={SPARKS} count={winner ? 14 : 10} radius={winner ? 150 : 110} />
            {winner && <div className="rx-wiggle tw:absolute tw:inset-x-0 tw:-top-10 tw:z-10 tw:flex tw:justify-center tw:text-5xl" aria-hidden="true">👑</div>}
            <div className={winner ? 'rx-glow tw:rounded-full' : undefined}>
              <KidPhoto name={name} photo={step.photo} face={step.face} size={photoSize} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
