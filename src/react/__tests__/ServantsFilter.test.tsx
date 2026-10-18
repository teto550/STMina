import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ClassFilter, shortGrade } from '@/react/components/class-filter';
import ServantsList from '@/react/screens/servants-list';

const girls = ['سنة أولى ابتدائي', 'سنة تانية ابتدائي', 'سنة تالتة ابتدائي'];

describe('ClassFilter', () => {
  it('shows "all" and a chip per class (girls have the 1st and 2nd grade), the chosen one is pressed', () => {
    render(<ClassFilter grades={girls} value="سنة تانية ابتدائي" onChange={() => undefined} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['الكل', 'سنة أولى', 'سنة تانية', 'سنة تالتة']);
    expect(screen.getByRole('button', { name: 'سنة تانية' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'الكل' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the full class name, and "" for all', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ClassFilter grades={girls} value="" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'سنة أولى' }));
    expect(onChange).toHaveBeenCalledWith('سنة أولى ابتدائي');
    await user.click(screen.getByRole('button', { name: 'الكل' }));
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('shortGrade drops the common word only at the end', () => {
    expect(shortGrade('سنة رابعة ابتدائي')).toBe('سنة رابعة');
    expect(shortGrade('كلمة')).toBe('كلمة');
  });
});

describe('ServantsList', () => {
  const rows = [
    { name: 'مينا', grade: 'سنة رابعة ابتدائي', registered: true, sunday: 3, meeting: 0 },
    { name: 'مارك', grade: '', registered: false, sunday: 0, meeting: 1 },
  ];

  it('lists the servants with class, counts and "not registered" note', () => {
    render(<ServantsList rows={rows} onOpen={() => undefined} />);
    expect(screen.getByText('مينا')).toBeInTheDocument();
    expect(screen.getByText('سنة رابعة ابتدائي')).toBeInTheDocument();
    expect(screen.getByText(/لسه ماسجلش بياناته/)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('opens the profile of the tapped servant', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<ServantsList rows={rows} onOpen={onOpen} />);
    await user.click(screen.getByText('مارك'));
    expect(onOpen).toHaveBeenCalledWith('مارك');
  });

  it('shows the empty state', () => {
    render(<ServantsList rows={[]} onOpen={() => undefined} />);
    expect(screen.getByText(/مفيش خدام مطابقين/)).toBeInTheDocument();
  });
});
