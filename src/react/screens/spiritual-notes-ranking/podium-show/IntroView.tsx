import type { FC } from 'react';

type IntroViewProps = {
  onStart: () => void;
  /** true = it moves on by itself, false = the servant taps for each kid */
  auto: boolean;
  onAutoChange: (auto: boolean) => void;
};

const CHOICE = 'tw:h-12 tw:flex-1 tw:cursor-pointer tw:rounded-full tw:px-4 tw:text-base tw:font-bold';

/** The first screen: nothing is revealed and no sound plays until the servant taps start (browsers need that tap to allow sound). */
export const IntroView: FC<IntroViewProps> = ({ onStart, auto, onAutoChange }) => (
  <div className="tw:flex tw:flex-col tw:items-center tw:gap-6 tw:text-center">
    <div className="rx-beat tw:text-8xl" aria-hidden="true">🏆</div>
    <h2 className="tw:text-4xl tw:font-black">جاهزين نعرف مين الأوائل؟</h2>
    <p className="tw:text-lg tw:text-white/80">النوتة الروحية — نقط آخر ٤ أسابيع</p>
    <div role="group" aria-label="طريقة العرض" className="tw:flex tw:w-full tw:max-w-sm tw:gap-2 tw:rounded-full tw:bg-white/10 tw:p-1">
      <button type="button" aria-pressed={auto} onClick={() => onAutoChange(true)} className={`${CHOICE} ${auto ? 'tw:bg-white tw:text-violet-900' : 'tw:text-white'}`}>⏱ أوتوماتيك</button>
      <button type="button" aria-pressed={!auto} onClick={() => onAutoChange(false)} className={`${CHOICE} ${auto ? 'tw:text-white' : 'tw:bg-white tw:text-violet-900'}`}>👆 يدوي</button>
    </div>
    <p className="tw:max-w-sm tw:text-sm tw:text-white/75">{auto ? 'العرض يمشي كله ورا بعض لوحده' : 'إنت اللي بتدوس عشان تجيب المركز اللي بعده'}</p>
    <button
      type="button"
      onClick={onStart}
      className="rx-beat tw:h-16 tw:cursor-pointer tw:rounded-full tw:bg-amber-400 tw:px-10 tw:text-2xl tw:font-black tw:text-amber-950 tw:shadow-2xl"
    >
      يلا نبدأ 🥁
    </button>
  </div>
);
