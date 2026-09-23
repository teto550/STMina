// Horizontal chip/tab rows (grade bar, main tabs, grade filters): a mouse can't scroll them by default
// (the wheel only scrolls vertically and there's no drag). This adds wheel -> horizontal scroll and
// click-and-drag for mouse users. Touch and pen are left alone: the browser's native swipe scrolling
// is already smooth there, and handling it in JS would only fight it.
// Uses document-level delegation, so rows that are rebuilt with innerHTML keep working.

const SCROLLERS = '#active-grade-bar, #main-tabs, .grade-filter';
const DRAG_THRESHOLD_PX = 5;

const scrollerOf = (target: EventTarget | null): HTMLElement | null =>
  target instanceof Element ? (target.closest(SCROLLERS) as HTMLElement | null) : null;
const canScrollX = (el: HTMLElement) => el.scrollWidth > el.clientWidth + 1;
const isRtl = (el: HTMLElement) => getComputedStyle(el).direction === 'rtl';

// ----- mouse wheel: vertical wheel scrolls the row sideways -----
document.addEventListener('wheel', (e) => {
  const el = scrollerOf(e.target);
  if (!el || e.ctrlKey || !canScrollX(el)) return;
  if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return; // already horizontal (trackpad / shift+wheel): native handles it
  const max = el.scrollWidth - el.clientWidth;
  const pos = Math.abs(el.scrollLeft); // scrollLeft is 0 -> negative in RTL, so use the magnitude
  const forward = e.deltaY > 0;
  if ((forward && pos >= max - 1) || (!forward && pos <= 0)) return; // at an end: let the page scroll
  e.preventDefault();
  const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; // deltaMode 1 = lines
  el.scrollLeft += (isRtl(el) ? -1 : 1) * delta;
}, { passive: false });

// ----- mouse drag -----
let drag: { el: HTMLElement; startX: number; startLeft: number; moved: boolean } | null = null;

document.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'mouse' || e.button !== 0) return;
  const el = scrollerOf(e.target);
  if (!el || !canScrollX(el)) return;
  drag = { el, startX: e.clientX, startLeft: el.scrollLeft, moved: false };
});

document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.startX;
  if (!drag.moved) {
    if (Math.abs(dx) < DRAG_THRESHOLD_PX) return; // still a click, not a drag
    drag.moved = true;
    drag.el.classList.add('is-dragging');
  }
  drag.el.scrollLeft = drag.startLeft - dx; // content follows the cursor in both LTR and RTL
});

function endDrag() {
  if (!drag) return;
  const { el, moved } = drag;
  drag = null;
  el.classList.remove('is-dragging');
  if (moved) {
    // a drag that ends over a chip must not also "click" it
    const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 50);
  }
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);
