import type { FC } from 'react';

type CheerIntroProps = {
  onStart: () => void;
  /** how many kids the show is about */
  total: number;
};

/** The first screen: nothing plays until the servant taps start (browsers need that tap to allow sound). */
export const CheerIntro: FC<CheerIntroProps> = ({ onStart, total }) => (
  <div className="tw:flex tw:flex-col tw:items-center tw:gap-6 tw:text-center">
    <div className="rx-beat tw:text-8xl" aria-hidden="true">🎉</div>
    <h2 className="tw:text-4xl tw:font-black">يلا نشجّع أبطالنا!</h2>
    <p className="tw:text-lg tw:text-white/80">{total.toLocaleString('ar-EG')} بطل اجتهدوا في النوتة الروحية</p>
    <button
      type="button"
      onClick={onStart}
      className="rx-beat tw:h-16 tw:cursor-pointer tw:rounded-full tw:bg-amber-400 tw:px-10 tw:text-2xl tw:font-black tw:text-amber-950 tw:shadow-2xl"
    >
      يلا نبدأ 🎶
    </button>
  </div>
);
