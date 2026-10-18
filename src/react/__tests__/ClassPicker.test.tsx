import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ClassPicker from '@/react/screens/class-picker';

const grades = ['سنة تالتة ابتدائي', 'سنة رابعة ابتدائي', 'سنة خامسة ابتدائي'];

describe('ClassPicker', () => {
  it('lists the classes and marks the last one used', () => {
    render(<ClassPicker grades={grades} current="سنة رابعة ابتدائي" onPick={() => undefined} />);
    expect(screen.getAllByRole('button', { pressed: undefined }).filter((b) => b.hasAttribute('aria-pressed'))).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'سنة رابعة' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('picking a class reports its full name', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<ClassPicker grades={grades} current="سنة رابعة ابتدائي" onPick={onPick} />);
    await user.click(screen.getByRole('button', { name: 'سنة خامسة' }));
    expect(onPick).toHaveBeenCalledWith('سنة خامسة ابتدائي');
  });

  it('closing without choosing reports null', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<ClassPicker grades={grades} current="سنة رابعة ابتدائي" onPick={onPick} />);
    await user.click(screen.getByRole('button', { name: 'إغلاق' }));
    expect(onPick).toHaveBeenCalledWith(null);
  });
});
