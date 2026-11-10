import type { FC } from 'react';
import { delayed, shortName } from '../podium';
import { CHEER_CLOSING, type CheerStep } from '../cheer';
import { Confetti } from '../podium-show/Confetti';
import { KidPhoto } from '../podium-show/KidPhoto';

type CheerFinalProps = {
  steps: CheerStep[];
  onReplay: () => void;
  onClose: () => void;
};

const BUTTON = 'tw:h-12 tw:cursor-pointer tw:rounded-full tw:px-6 tw:text-lg tw:font-bold';

/** The end: every kid together (picture and name, in no order and with no points) under a closing line, and the buttons to play it again or leave. */
export const CheerFinal: FC<CheerFinalProps> = ({ steps, onReplay, onClose }) => {
  const size = steps.length > 12 ? 52 : 72;
  return (
    <div className="tw:flex tw:w-full tw:max-w-3xl tw:flex-col tw:items-center tw:gap-6 tw:py-4">
      <Confetti count={70} />
      <div className="tw:flex tw:flex-col tw:items-center tw:gap-1 tw:text-center">
        <h2 className="rx-pop tw:text-4xl tw:font-black">🎉 مبروك لكل الأبطال 🎉</h2>
        <p className="rx-pop rx-wiggle tw:text-xl tw:font-bold tw:text-amber-200" style={delayed(0.5)}>{CHEER_CLOSING}</p>
      </div>
      <ul className="tw:flex tw:w-full tw:flex-wrap tw:justify-center tw:gap-x-4 tw:gap-y-3">
        {steps.map((s, i) => (
          <li key={s.kid.id} className="rx-pop tw:flex tw:w-24 tw:flex-col tw:items-center tw:gap-1 tw:text-center" style={delayed(Math.min(0.3 + i * 0.08, 2.5))}>
            <KidPhoto name={shortName(s.kid.name)} photo={s.photo} face={s.face} size={size} />
            <span className="tw:text-sm tw:font-black tw:break-words">{shortName(s.kid.name)}</span>
          </li>
        ))}
      </ul>
      <div className="tw:relative tw:flex tw:flex-wrap tw:justify-center tw:gap-3">
        <button type="button" onClick={onReplay} className={`${BUTTON} tw:bg-amber-400 tw:text-amber-950`}>🔁 إعادة العرض</button>
        <button type="button" onClick={onClose} className={`${BUTTON} tw:bg-white/20 tw:text-white`}>إغلاق</button>
      </div>
    </div>
  );
};
