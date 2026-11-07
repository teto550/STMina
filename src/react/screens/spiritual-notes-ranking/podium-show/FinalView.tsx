import type { FC } from 'react';
import { delayed, PLACES, PODIUM_ORDER, shortName, type PodiumStep } from '../podium';
import { Confetti } from './Confetti';
import { KidPhoto } from './KidPhoto';

type FinalViewProps = {
  steps: PodiumStep[];
  onReplay: () => void;
  onClose: () => void;
};

const BUTTON = 'tw:h-12 tw:cursor-pointer tw:rounded-full tw:px-6 tw:text-lg tw:font-bold';

/** The finished podium (second, first, third from left to right) with the picture and the first two names of everyone, and the buttons to play it again or leave. */
export const FinalView: FC<FinalViewProps> = ({ steps, onReplay, onClose }) => {
  const groups = PODIUM_ORDER.map((place) => ({ place, kids: steps.filter((s) => s.place === place) })).filter((g) => g.kids.length > 0);
  return (
    <div className="tw:flex tw:w-full tw:max-w-2xl tw:flex-col tw:items-center tw:gap-8">
      <Confetti count={60} />
      <div className="tw:flex tw:flex-col tw:items-center tw:gap-1 tw:text-center">
        <h2 className="rx-pop tw:text-4xl tw:font-black">🎉 مبروك للفائزين 🎉</h2>
        <p className="rx-pop rx-wiggle tw:text-xl tw:font-bold tw:text-amber-200" style={delayed(0.5)}>🌟 وكلكم أبطال.. كمّلوا كده! 🌟</p>
      </div>
      <div dir="ltr" className="tw:flex tw:w-full tw:items-end tw:justify-center tw:gap-2">
        {groups.map((g, i) => {
          const look = PLACES[g.place];
          const size = g.kids.length > 2 ? 44 : 64;
          return (
            <div key={g.place} dir="rtl" className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:items-center tw:gap-2 tw:text-center">
              <div className="rx-pop tw:flex tw:flex-col tw:items-center tw:gap-1" style={delayed(0.3 + i * 0.2)}>
                <div className="tw:flex tw:flex-wrap tw:justify-center tw:gap-2">
                  {g.kids.map((s) => (
                    <div key={s.kid.id} className="tw:flex tw:flex-col tw:items-center tw:gap-1">
                      <KidPhoto name={shortName(s.kid.name)} photo={s.photo} face={s.face} size={size} />
                      <span className="tw:text-sm tw:font-black tw:break-words">{shortName(s.kid.name)}</span>
                    </div>
                  ))}
                </div>
                <span className="tw:text-sm tw:font-bold tw:text-white/80">⭐ {g.kids[0]?.kid.month} نقطة</span>
              </div>
              <div className={`rx-grow tw:flex tw:w-full tw:items-center tw:justify-center tw:rounded-t-2xl tw:bg-linear-to-b ${look.card} ${look.block} tw:text-5xl`} style={delayed(i * 0.2)} aria-label={look.label}>
                {look.medal}
              </div>
            </div>
          );
        })}
      </div>
      <div className="tw:relative tw:flex tw:flex-wrap tw:justify-center tw:gap-3">
        <button type="button" onClick={onReplay} className={`${BUTTON} tw:bg-amber-400 tw:text-amber-950`}>🔁 إعادة العرض</button>
        <button type="button" onClick={onClose} className={`${BUTTON} tw:bg-white/20 tw:text-white`}>إغلاق</button>
      </div>
    </div>
  );
};
