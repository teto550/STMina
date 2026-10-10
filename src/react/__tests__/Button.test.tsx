import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Button } from '@/react/components/ui/button';

describe('Button', () => {
  it('is a normal button that can be clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>حفظ</Button>);
    await userEvent.setup().click(screen.getByRole('button', { name: 'حفظ' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it('while loading it is disabled, marked busy, and shows a turning circle', async () => {
    const onClick = vi.fn();
    const { container } = render(<Button loading onClick={onClick}>جاري الحفظ…</Button>);
    const button = screen.getByRole('button', { name: 'جاري الحفظ…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('svg')).toBeInTheDocument();
    await userEvent.setup().click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
  it('is not marked busy when it is not loading', () => {
    render(<Button>x</Button>);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy');
  });
  it('still supports asChild (renders its child instead of a button)', () => {
    render(<Button asChild><a href="/x">رابط</a></Button>);
    expect(screen.getByRole('link', { name: 'رابط' })).toBeInTheDocument();
  });
});
