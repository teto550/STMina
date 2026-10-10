import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from '@/react/components/ui/password-input';

describe('PasswordInput', () => {
  it('hides what is typed at first, and the eye shows it and hides it again', async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="كلمة المرور" defaultValue="secret1" />);
    const input = screen.getByLabelText('كلمة المرور');
    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'إظهار كلمة المرور' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('secret1');
    const hide = screen.getByRole('button', { name: 'إخفاء كلمة المرور' });
    expect(hide).toHaveAttribute('aria-pressed', 'true');
    await user.click(hide);
    expect(input).toHaveAttribute('type', 'password');
  });

  it('the eye is a plain button: it never submits the form and keeps what was typed', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(<form onSubmit={onSubmit}><PasswordInput aria-label="p" /></form>);
    await user.type(screen.getByLabelText('p'), 'abc');
    await user.click(screen.getByRole('button', { name: 'إظهار كلمة المرور' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('p')).toHaveValue('abc');
  });

  it('behaves like an input: forwards its ref and props, and can be disabled together with the eye', () => {
    const ref = createRef<HTMLInputElement>();
    render(<PasswordInput ref={ref} aria-label="p" placeholder="••••" autoComplete="new-password" disabled />);
    expect(ref.current).toBe(screen.getByLabelText('p'));
    expect(screen.getByLabelText('p')).toHaveAttribute('placeholder', '••••');
    expect(screen.getByLabelText('p')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText('p')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'إظهار كلمة المرور' })).toBeDisabled();
  });

  it('the button names can be translated or changed', () => {
    render(<PasswordInput aria-label="p" showLabel="Show" hideLabel="Hide" />);
    expect(screen.getByRole('button', { name: 'Show' })).toBeInTheDocument();
  });
});
