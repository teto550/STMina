import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import NoAccess from '@/react/screens/no-access';

describe('NoAccess (a person with no role yet)', () => {
  it('says there is no access yet and points to the profile and settings', () => {
    render(<NoAccess />);
    expect(screen.getByRole('heading', { name: 'لسه مفيش صلاحيات' })).toBeInTheDocument();
    expect(screen.getByText(/محدش حدد لك دور/)).toBeInTheDocument();
    expect(screen.getByText(/ملفك الشخصي والإعدادات/)).toBeInTheDocument();
  });

  it('"تحديث" reloads the app, so a role given in the meantime shows', async () => {
    const reload = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } });
    const user = userEvent.setup();
    render(<NoAccess />);
    await user.click(screen.getByRole('button', { name: /تحديث/ }));
    expect(reload).toHaveBeenCalledTimes(1);
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });
});
