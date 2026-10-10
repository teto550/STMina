import { useEffect, type FC } from 'react';

/** The full-screen "loading" picture. The page shows a plain-HTML copy of it until React is ready; this one replaces it, so there is no jump. */
export const Splash: FC = () => {
  useEffect(() => { document.getElementById('splash-screen')?.remove(); }, []);
  return (
    <div role="status" aria-label="جاري التحميل" className="tw:fixed tw:inset-0 tw:z-[9999] tw:flex tw:flex-col tw:items-center tw:justify-center tw:gap-4 tw:bg-[#0f1420]">
      <img src="icon-512.png" alt="" className="tw:size-[150px] tw:rounded-2xl tw:object-contain" style={{ animation: 'splashPulse 1.6s ease-in-out infinite' }} />
      <p className="tw:text-sm tw:text-white/65">جاري التحميل…</p>
    </div>
  );
};
