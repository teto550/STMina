import type { FC } from 'react';
import { delayed, PLACES, PODIUM_ORDER, type PodiumStep } from '../podium';
import { Confetti } from './Confetti';

type FinalViewProps = {
  steps: PodiumStep[];
  onReplay: () => void;
  onClose: () => void;
};

const BUTTON = 'tw:h-12 tw:cursor-pointer tw:rounded-full tw:px-6 tw:text-lg tw:font-bold';

/** The finished podium (second, first, third from left to right) with everyone's name, and the buttons to play it again or leave. */
export const FinalView: FC<FinalViewProps> = ({ steps, onReplay, onClose }) => {
  const shown = PODIUM_ORDER.map((place) => steps.find((s) => s.place === place)).filter((s): s is PodiumStep => !!s);
  return (
    <div className="tw:flex tw:w-full tw:max-w-2xl tw:flex-col tw:items-center tw:gap-8">
      <Confetti count={60} />
      <h2 className="rx-pop tw:text-4xl tw:font-black">🎉 مبروك للفائزين 🎉</h2>
      <div dir="ltr" className="tw:flex tw:w-full tw:items-end tw:justify-center tw:gap-2">
        {shown.map((s, i) => {
          const look = PLACES[s.place];
          return (
            <div key={s.place} dir="rtl" className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:items-center tw:gap-2 tw:text-center">
              <div className="rx-pop tw:flex tw:flex-col tw:gap-1" style={delayed(0.3 + i * 0.2)}>
                {s.kids.map((kid) => (
                  <span key={kid.id} className="tw:text-lg tw:font-black tw:break-words">{kid.name}</span>
                ))}
                <span className="tw:text-sm tw:font-bold tw:text-white/80">⭐ {s.points} نقطة</span>
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
