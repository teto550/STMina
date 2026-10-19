import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import AdminHome from '@/react/screens/admin-home';
import { AdminHomeView } from '@/react/screens/admin-home/view';

const GRADES = ['سنة تالتة ابتدائي', 'سنة رابعة ابتدائي'];
const [THIRD = '', FOURTH = ''] = GRADES;

const setup = (props: Partial<React.ComponentProps<typeof AdminHome>> = {}) => {
  const onSaveSettings = vi.fn().mockResolvedValue(undefined);
  render(<AdminHome grades={GRADES} startView={AdminHomeView.Classes} onOpenClass={vi.fn()} onOpenServants={vi.fn()} canEditClasses onSaveSettings={onSaveSettings} {...props} />);
  return { onSaveSettings, user: userEvent.setup() };
};

describe('editing the fixed classes (emoji + attendance day, never delete)', () => {
  it('shows تعديل only when the person may edit', () => {
    setup({ canEditClasses: false });
    expect(screen.queryByRole('button', { name: /تعديل/ })).not.toBeInTheDocument();
  });

  it('has no delete button anywhere', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /تعديل/ }));
    expect(screen.queryByRole('button', { name: /حذف|🗑/ })).not.toBeInTheDocument();
  });

  it('saves the emoji and the day of a class', async () => {
    const { user, onSaveSettings } = setup();
    await user.click(screen.getByRole('button', { name: /تعديل/ }));
    await user.type(screen.getByLabelText(`إيموجي ${THIRD}`), '🌟');
    const row = screen.getByLabelText(`إيموجي ${THIRD}`).closest('li') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'الخميس' }));
    await user.click(screen.getByRole('button', { name: /حفظ/ }));
    expect(onSaveSettings).toHaveBeenCalledWith({ [THIRD]: { emoji: '🌟', serviceDay: 4 } });
  });

  it('tapping the chosen day again clears it, and the list shows the saved emoji and day', async () => {
    const { user, onSaveSettings } = setup({ settings: { [FOURTH]: { serviceDay: 5 } } });
    expect(screen.getByText('الجمعة')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /تعديل/ }));
    const row = screen.getByLabelText(`إيموجي ${FOURTH}`).closest('li') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'الجمعة' }));
    await user.click(screen.getByRole('button', { name: /حفظ/ }));
    expect(onSaveSettings).toHaveBeenCalledWith({ [FOURTH]: { serviceDay: undefined } });
    expect(screen.queryByText('الجمعة')).not.toBeInTheDocument();
  });
});
