import { useEffect, useRef, useState, type FC, type FocusEvent, type ReactNode } from 'react';

type SheetProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

type Visible = { height: number; top: number };

// the sheets that are open, the last one on top: Escape closes only that one
const openSheets: object[] = [];

/**
 * The part of the screen that is really visible. On a phone the on-screen keyboard does not shrink the page, it covers it, so a sheet
 * sized to the page would hide its buttons behind the keyboard. The visual viewport is what is left above the keyboard.
 */
function useVisibleArea(): Visible | null {
  const [area, setArea] = useState<Visible | null>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }
    const update = () => setArea({ height: viewport.height, top: viewport.offsetTop });
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);
  return area;
}

/** When a field gets focus (the keyboard is opening), scroll it to the middle of the sheet once the keyboard has slid up. */
function showFocusedField(e: FocusEvent<HTMLElement>): void {
  const field = e.target;
  if (field.matches('input, select, textarea')) {
    window.setTimeout(() => field.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 250);
  }
}

/**
 * Full-height sheet on a phone, centred dialog on a wide screen. Keyboard friendly: it always fits the area above the on-screen
 * keyboard (so the footer buttons stay reachable), and a field that gets focus scrolls into view.
 */
export const Sheet: FC<SheetProps> = ({ title, onClose, children, footer }) => {
  const area = useVisibleArea();
  const me = useRef({});
  useEffect(() => {
    const token = me.current;
    openSheets.push(token);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openSheets[openSheets.length - 1] === token) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      openSheets.splice(openSheets.indexOf(token), 1);
    };
  }, [onClose]);
  return (
    <div
      className={`tw:fixed tw:z-[10010] tw:flex tw:items-end tw:justify-center tw:bg-black/60 tw:md:items-center ${area ? 'tw:inset-x-0' : 'tw:inset-0'}`}
      style={area ? { top: area.top, height: area.height } : undefined}
      onClick={onClose}
    >
      <div role="dialog" aria-label={title} className="tw:flex tw:max-h-[92%] tw:w-full tw:max-w-lg tw:flex-col tw:rounded-t-card tw:border tw:border-line tw:bg-surface tw:md:rounded-card" onClick={(e) => e.stopPropagation()} onFocusCapture={showFocusedField}>
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
