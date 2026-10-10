import { useEffect, type FC, type ReactNode } from 'react';

type SheetProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

/** Full-height sheet on a phone, centred dialog on a wide screen. */
export const Sheet: FC<SheetProps> = ({ title, onClose, children, footer }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="tw:fixed tw:inset-0 tw:z-[10010] tw:flex tw:items-end tw:justify-center tw:bg-black/60 tw:md:items-center" onClick={onClose}>
      <div role="dialog" aria-label={title} className="tw:flex tw:max-h-[92dvh] tw:w-full tw:max-w-lg tw:flex-col tw:rounded-t-card tw:border tw:border-line tw:bg-surface tw:md:rounded-card" onClick={(e) => e.stopPropagation()}>
        <div className="tw:flex tw:items-center tw:justify-between tw:border-b tw:border-line tw:px-4 tw:py-3">
          <h2 className="tw:text-base tw:font-bold">{title}</h2>
          <button type="button" aria-label="إغلاق" className="tw:size-10 tw:cursor-pointer tw:text-xl tw:text-dim" onClick={onClose}>✕</button>
        </div>
        <div className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:p-3">{children}</div>
        {footer && <div className="tw:border-t tw:border-line tw:p-3">{footer}</div>}
      </div>
    </div>
  );
};
