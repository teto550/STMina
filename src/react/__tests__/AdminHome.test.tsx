import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import AdminHome from '@/react/screens/admin-home';
import { AdminHomeView } from '@/react/screens/admin-home/view';

const GRADES: string[] = ['سنة تالتة ابتدائي', 'سنة رابعة ابتدائي', 'سنة خامسة ابتدائي', 'سنة سادسة ابتدائي'];
const [THIRD = '', FOURTH = '', FIFTH = ''] = GRADES;

const setup = (props: Partial<React.ComponentProps<typeof AdminHome>> = {}) => {
  const onOpenClass = vi.fn();
  const onOpenServants = vi.fn();
  render(<AdminHome grades={GRADES} onOpenClass={onOpenClass} onOpenServants={onOpenServants} {...props} />);
  return { onOpenClass, onOpenServants, user: userEvent.setup() };
};

describe('AdminHome (the two cards: الفصول and الخدام)', () => {
  it('starts on two cards, الفصول and الخدام, and shows no class yet', () => {
    setup();
    expect(screen.getByRole('button', { name: /الفصول/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /الخدام/ })).toBeInTheDocument();
    expect(screen.queryByText(THIRD)).not.toBeInTheDocument();
  });

  it('"الخدام" opens the servants section', async () => {
    const { user, onOpenServants, onOpenClass } = setup();
    await user.click(screen.getByRole('button', { name: /الخدام/ }));
    expect(onOpenServants).toHaveBeenCalledTimes(1);
    expect(onOpenClass).not.toHaveBeenCalled();
  });

  it('"الفصول" lists every class', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /الفصول/ }));
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('button')).toHaveLength(GRADES.length);
    GRADES.forEach((g) => expect(within(list).getByText(g)).toBeInTheDocument());
  });

  it('picking a class opens it', async () => {
    const { user, onOpenClass } = setup();
    await user.click(screen.getByRole('button', { name: /الفصول/ }));
    await user.click(screen.getByRole('button', { name: new RegExp(FOURTH) }));
    expect(onOpenClass).toHaveBeenCalledWith(FOURTH);
  });

  it('the back button of the list returns to the two cards', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /الفصول/ }));
    await user.click(screen.getByRole('button', { name: 'رجوع' }));
    expect(screen.getByRole('button', { name: /الخدام/ })).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('can start straight on the list of classes (coming back from a class)', () => {
    setup({ startView: AdminHomeView.Classes });
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /الخدام/ })).not.toBeInTheDocument();
  });

  it('marks the class that was open last', () => {
    setup({ startView: AdminHomeView.Classes, activeGrade: FIFTH });
    expect(screen.getByRole('button', { name: new RegExp(FIFTH) })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: new RegExp(THIRD) })).not.toHaveAttribute('aria-current');
    expect(screen.getByText('آخر فصل')).toBeInTheDocument();
  });

  it('says so when there is no class to open', () => {
    setup({ startView: AdminHomeView.Classes, grades: [] });
    expect(screen.getByText('مفيش فصول متاحة ليك')).toBeInTheDocument();
  });
});
