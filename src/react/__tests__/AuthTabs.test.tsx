import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';

// the real forms need the sign-in hooks and Firebase; they have their own tests (LoginForm / RegisterForm)
vi.mock('@/react/screens/auth/login', () => ({ LoginForm: () => <p>نموذج الدخول</p> }));
vi.mock('@/react/screens/auth/register', () => ({ RegisterForm: () => <p>نموذج التسجيل</p> }));

import { AuthTabs } from '@/react/screens/auth/components/AuthTabs';

afterEach(() => sessionStorage.clear());

describe('AuthTabs', () => {
  it('starts on the login tab, with only its form', () => {
    render(<AuthTabs />);
    expect(screen.getByText('نموذج الدخول')).toBeInTheDocument();
    expect(screen.queryByText('نموذج التسجيل')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تسجيل دخول' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('is the whole sign-in card: the app name and the tagline above the forms', () => {
    render(<AuthTabs />);
    expect(screen.getByRole('heading', { name: 'خدمة ابتدائي' })).toBeInTheDocument();
    expect(screen.getByText('تسجيل الحضور بسرعة وسهولة')).toBeInTheDocument();
  });

  it('switches the form with the tab buttons', async () => {
    const user = userEvent.setup();
    render(<AuthTabs />);
    await user.click(screen.getByRole('button', { name: 'خادم جديد' }));
    expect(screen.getByText('نموذج التسجيل')).toBeInTheDocument();
    expect(screen.queryByText('نموذج الدخول')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'تسجيل دخول' }));
    expect(screen.getByText('نموذج الدخول')).toBeInTheDocument();
  });

  it('opens on the registration tab when the page was reloaded by the gender choice, and uses the mark up', () => {
    sessionStorage.setItem('openRegisterTab', '1');
    render(<AuthTabs />);
    expect(screen.getByText('نموذج التسجيل')).toBeInTheDocument();
    expect(screen.queryByText('نموذج الدخول')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('openRegisterTab')).toBeNull();
  });
});
