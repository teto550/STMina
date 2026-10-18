import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Sheet } from '@/react/components/ui/sheet';

type Listener = () => void;
function fakeVisualViewport(height: number, offsetTop = 0) {
  const listeners = new Map<string, Set<Listener>>();
  const viewport = {
    height, offsetTop,
    addEventListener: (type: string, fn: Listener) => { listeners.set(type, (listeners.get(type) ?? new Set()).add(fn)); },
    removeEventListener: (type: string, fn: Listener) => { listeners.get(type)?.delete(fn); },
    emit: (type: string) => listeners.get(type)?.forEach((fn) => fn()),
  };
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  return viewport;
}
const backdrop = () => screen.getByRole('dialog').parentElement as HTMLElement;

afterEach(() => {
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
  vi.useRealTimers();
});

describe('Sheet and the on-screen keyboard', () => {
  it('without a visual viewport (a desktop, a test) it simply fills the screen', () => {
    render(<Sheet title="t" onClose={() => undefined}>x</Sheet>);
    expect(backdrop().style.height).toBe('');
  });

  it('fits the area above the keyboard, and follows it when the keyboard opens and closes', () => {
    const viewport = fakeVisualViewport(800);
    render(<Sheet title="t" onClose={() => undefined}>x</Sheet>);
    expect(backdrop().style.height).toBe('800px');
    viewport.height = 420; // the keyboard slides up
    act(() => viewport.emit('resize'));
    expect(backdrop().style.height).toBe('420px');
    viewport.height = 800;
    act(() => viewport.emit('resize'));
    expect(backdrop().style.height).toBe('800px');
  });

  it('follows the visual viewport when the page is scrolled under the keyboard (iOS)', () => {
    const viewport = fakeVisualViewport(420);
    render(<Sheet title="t" onClose={() => undefined}>x</Sheet>);
    viewport.offsetTop = 120;
    act(() => viewport.emit('scroll'));
    expect(backdrop().style.top).toBe('120px');
  });

  it('stops listening when it closes', () => {
    const viewport = fakeVisualViewport(800);
    const { unmount } = render(<Sheet title="t" onClose={() => undefined}>x</Sheet>);
    unmount();
    expect(() => viewport.emit('resize')).not.toThrow();
  });

  it('a field that gets focus is scrolled into view once the keyboard has slid up; a button is not', () => {
    vi.useFakeTimers();
    const scroll = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scroll;
    render(<Sheet title="t" onClose={() => undefined}><input aria-label="اسم" /><button type="button">زرار</button></Sheet>);
    fireEvent.focus(screen.getByRole('button', { name: 'زرار' }));
    vi.advanceTimersByTime(400);
    expect(scroll).not.toHaveBeenCalled();
    fireEvent.focus(screen.getByLabelText('اسم'));
    expect(scroll).not.toHaveBeenCalled(); // not at once: the keyboard is still moving
    vi.advanceTimersByTime(400);
    expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
  });
});

describe('Sheet and Escape', () => {
  it('Escape closes only the sheet on top (the one opened last)', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(<><Sheet title="outer" onClose={outer}>a</Sheet><Sheet title="inner" onClose={inner}>b</Sheet></>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });
});
