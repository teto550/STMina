import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithQuery } from '@/test/render';

const { signIn } = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock('@/api/auth', () => ({ signIn, signOutUser: vi.fn(), registerServant: vi.fn(), subscribeAuth: vi.fn() }));
vi.mock('@/api/account', () => ({ loadAccountDecision: vi.fn(), ensureAdminAccount: vi.fn() }));

import { LoginForm } from '@/react/screens/auth/login';

const fb = (code: string) => Object.assign(new Error(code), { code });

function setup() {
  renderWithQuery(<LoginForm />);
  return { user: userEvent.setup() };
}
const fill = async (user: ReturnType<typeof userEvent.setup>, email = 'a@x.com', pass = 'secret1') => {
  await user.type(screen.getByLabelText('البريد الإلكتروني'), email);
  await user.type(screen.getByLabelText('كلمة المرور'), pass);
};

beforeEach(() => { signIn.mockReset(); vi.spyOn(console, 'error').mockImplementation(() => undefined); });

describe('LoginForm: validation (zod schema)', () => {
  it('both fields are required, each with its own message, and nothing is sent', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'دخول' }));
    expect(await screen.findByText('اكتب الإيميل')).toBeInTheDocument();
    expect(screen.getByText('اكتب كلمة المرور')).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });
});

describe('LoginForm: signing in (React Query mutation)', () => {
  it('sends the trimmed email and the password', async () => {
    signIn.mockResolvedValue(undefined);
    const { user } = setup();
    await fill(user, '  a@x.com ');
    await user.click(screen.getByRole('button', { name: 'دخول' }));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('a@x.com', 'secret1'));
  });

  it('shows a loader on the button while it runs, and stays busy after success (the app is taking over)', async () => {
    let finish: () => void = () => undefined;
    signIn.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { user } = setup();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'دخول' }));
    const busy = await screen.findByRole('button', { name: 'جاري الدخول…' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    finish();
    await waitFor(() => expect(screen.getByRole('button', { name: 'جاري الدخول…' })).toBeDisabled());
  });

  it('a wrong password shows a visible, dismissible error and the button works again', async () => {
    signIn.mockRejectedValue(fb('auth/wrong-password'));
    const { user } = setup();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'دخول' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('بيانات خاطئة، حاول تاني');
    expect(screen.getByRole('button', { name: 'دخول' })).toBeEnabled();
    await user.click(within(alert).getByRole('button', { name: 'إغلاق' }));
    expect(screen.queryByText('بيانات خاطئة، حاول تاني')).not.toBeInTheDocument();
  });

  it('says so when there is no connection, or too many attempts', async () => {
    signIn.mockRejectedValueOnce(fb('auth/network-request-failed'));
    const { user } = setup();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'دخول' }));
    expect(await screen.findByText('مفيش اتصال بالنت، جرّب تاني')).toBeInTheDocument();
    signIn.mockRejectedValueOnce(fb('auth/too-many-requests'));
    await user.click(screen.getByRole('button', { name: 'دخول' }));
    expect(await screen.findByText('محاولات كتير، استنى شوية وجرّب تاني')).toBeInTheDocument();
  });

  it('a second attempt clears the old error', async () => {
    signIn.mockRejectedValueOnce(fb('auth/wrong-password')).mockResolvedValueOnce(undefined);
    const { user } = setup();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'دخول' }));
    await screen.findByText('بيانات خاطئة، حاول تاني');
    await user.click(screen.getByRole('button', { name: 'دخول' }));
    await waitFor(() => expect(screen.queryByText('بيانات خاطئة، حاول تاني')).not.toBeInTheDocument());
  });
});

describe('LoginForm: the password field', () => {
  it('the password has an eye that shows and hides it', async () => {
    const { user } = setup();
    const pass = screen.getByLabelText('كلمة المرور');
    await user.type(pass, 'secret1');
    expect(pass).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'إظهار كلمة المرور' }));
    expect(pass).toHaveAttribute('type', 'text');
    expect(pass).toHaveValue('secret1');
  });
});
