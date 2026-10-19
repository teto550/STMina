import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ServantsHome from '@/react/screens/servants-home';

const setup = (showRoles: boolean) => {
  const onOpenSection = vi.fn();
  const onOpenRoles = vi.fn();
  const onBack = vi.fn();
  render(<ServantsHome showRoles={showRoles} onOpenSection={onOpenSection} onOpenRoles={onOpenRoles} onBack={onBack} />);
  return { onOpenSection, onOpenRoles, onBack, user: userEvent.setup() };
};

describe('ServantsHome (the cards of the servants section)', () => {
  it('shows الحضور and الخدام, and الأدوار only for admins', () => {
    setup(true);
    expect(screen.getByRole('button', { name: /الحضور/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^الخدام/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /الأدوار/ })).toBeInTheDocument();
  });

  it('hides الأدوار when the person is not an admin', () => {
    setup(false);
    expect(screen.queryByRole('button', { name: /الأدوار/ })).not.toBeInTheDocument();
  });

  it('each card opens its part', async () => {
    const { user, onOpenSection, onOpenRoles } = setup(true);
    await user.click(screen.getByRole('button', { name: /الحضور/ }));
    expect(onOpenSection).toHaveBeenLastCalledWith('att');
    await user.click(screen.getByRole('button', { name: /^الخدام/ }));
    expect(onOpenSection).toHaveBeenLastCalledWith('list');
    await user.click(screen.getByRole('button', { name: /الأدوار/ }));
    expect(onOpenRoles).toHaveBeenCalledTimes(1);
  });

  it('the back button returns', async () => {
    const { user, onBack } = setup(true);
    await user.click(screen.getByRole('button', { name: 'رجوع' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
