import type { FC } from 'react';

type IntroViewProps = {
  /** how many places will be revealed */
  places: number;
  onStart: () => void;
};

/** The first screen: nothing is revealed and no sound plays until the servant taps start (browsers need that tap to allow sound). */
export const IntroView: FC<IntroViewProps> = ({ places, onStart }) => (
  <div className="tw:flex tw:flex-col tw:items-center tw:gap-6 tw:text-center">
    <div className="rx-beat tw:text-8xl" aria-hidden="true">🏆</div>
    <h2 className="tw:text-4xl tw:font-black">جاهزين نعرف مين الأوائل؟</h2>
    <p className="tw:text-lg tw:text-white/80">النوتة الروحية — نقط آخر ٤ أسابيع{places > 1 ? ` · ${places} مراكز` : ''}</p>
    <button
      type="button"
      onClick={onStart}
      className="rx-beat tw:h-16 tw:cursor-pointer tw:rounded-full tw:bg-amber-400 tw:px-10 tw:text-2xl tw:font-black tw:text-amber-950 tw:shadow-2xl"
    >
      يلا نبدأ 🥁
    </button>
  </div>
);
