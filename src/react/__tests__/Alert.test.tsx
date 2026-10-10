import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Alert } from '@/react/components/ui/alert';

describe('Alert', () => {
  it('is an error by default, announced at once (role alert)', () => {
    render(<Alert>حصل خطأ</Alert>);
    expect(screen.getByRole('alert')).toHaveTextContent('حصل خطأ');
  });

  it('the other tones are announced politely (role status)', () => {
    render(<><Alert tone="success">تم</Alert><Alert tone="info">معلومة</Alert><Alert tone="warning">تنبيه</Alert></>);
    expect(screen.getAllByRole('status')).toHaveLength(3);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows an optional title above the message', () => {
    render(<Alert tone="warning" title="انتبه">المحتوى</Alert>);
    expect(screen.getByText('انتبه')).toBeInTheDocument();
    expect(screen.getByText('المحتوى')).toBeInTheDocument();
  });

  it('has no close button unless onDismiss is given', () => {
    render(<Alert>x</Alert>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('the close button calls onDismiss and has a name that can be changed', async () => {
    const onDismiss = vi.fn();
    render(<Alert onDismiss={onDismiss} dismissLabel="اقفل">x</Alert>);
    await userEvent.setup().click(screen.getByRole('button', { name: 'اقفل' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('the default icon is decorative, and the icon can be replaced or removed', () => {
    const { container, rerender } = render(<Alert>x</Alert>);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    rerender(<Alert icon={<b data-testid="mine">!</b>}>x</Alert>);
    expect(screen.getByTestId('mine')).toBeInTheDocument();
    rerender(<Alert icon={false}>x</Alert>);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('closes itself (calls onDismiss) after autoDismissMs, and not before', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Alert tone="info" autoDismissMs={3000} onDismiss={onDismiss}>x</Alert>);
    act(() => { vi.advanceTimersByTime(2999); });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('shows an action (such as a retry button) under the message', async () => {
    const retry = vi.fn();
    render(<Alert action={<button onClick={retry}>حاول تاني</button>}>فشل التحميل</Alert>);
    await userEvent.setup().click(screen.getByRole('button', { name: 'حاول تاني' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('passes other attributes through (id, data-*, className)', () => {
    render(<Alert id="a1" data-x="y" className="mine">x</Alert>);
    const el = screen.getByRole('alert');
    expect(el).toHaveAttribute('id', 'a1');
    expect(el).toHaveAttribute('data-x', 'y');
    expect(el.className).toContain('mine');
  });
});
