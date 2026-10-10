// The sign-in screen end to end, with the network and the old app faked: Firebase says who is signed in, the account check gives a
// decision (src/api/account.ts, tested on its own), and we check what the screen does about it.
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { state } from '@/core/state';
import { renderWithQuery } from '@/test/render';
import type { AccountDecision, BlockedReason, SessionPatch } from '@/types/account';

const h = vi.hoisted(() => ({
  listeners: new Set<(user: unknown) => void>(),
  signIn: vi.fn(),
  registerServant: vi.fn(),
  signOutUser: vi.fn(),
  loadAccountDecision: vi.fn(),
  fetchRoster: vi.fn(),
  enterApp: vi.fn(),
  openCompleteProfileScreen: vi.fn(),
  applySectionTheme: vi.fn(),
}));
vi.mock('@/api/auth', () => ({
  subscribeAuth: (cb: (user: unknown) => void) => { h.listeners.add(cb); return () => { h.listeners.delete(cb); }; },
  signIn: h.signIn, registerServant: h.registerServant, signOutUser: h.signOutUser,
}));
vi.mock('@/api/account', () => ({ loadAccountDecision: h.loadAccountDecision }));
vi.mock('@/api/roster', () => ({ fetchRoster: h.fetchRoster }));
vi.mock('@/features/shell/app-shell', () => ({ enterApp: h.enterApp }));
vi.mock('@/features/auth/profile-complete', () => ({ openCompleteProfileScreen: h.openCompleteProfileScreen }));
vi.mock('@/core/section', () => ({
  SECTION: 'boys', GRADES: ['سنة تالتة ابتدائي', 'سنة رابعة ابتدائي'], changeRegGender: vi.fn(),
  applySectionTheme: h.applySectionTheme,
}));

import AuthScreen from '@/react/screens/auth';

const person = { uid: 'u1', email: 'm@x.com' };
const session = { currentUserRole: 'deacon', currentUserName: 'مينا', currentUserEmail: 'm@x.com', currentUserGrade: 'سنة رابعة ابتدائي', accessSource: 'legacy' } as unknown as SessionPatch;
const profile = { name: 'مينا' };
const enter: AccountDecision = { kind: 'enter', session, profile };

/** what Firebase does: tells everyone who is signed in now (null = nobody) */
const emitAuth = (user: unknown) => act(async () => { h.listeners.forEach((fn) => fn(user)); });

function setup() {
  document.body.insertAdjacentHTML('beforeend', '<div id="splash-screen"></div>'); // the plain-HTML splash of the page
  const { container } = renderWithQuery(<AuthScreen />);
  return { container, user: userEvent.setup() };
}

beforeEach(() => {
  h.listeners.clear();
  for (const fn of [h.signIn, h.registerServant, h.loadAccountDecision, h.enterApp, h.openCompleteProfileScreen, h.applySectionTheme, h.fetchRoster]) fn.mockReset();
  h.fetchRoster.mockResolvedValue([{ name: 'يوسف', grade: 'سنة رابعة ابتدائي' }]);
  // signing out really signs out: everyone is told nobody is signed in
  h.signOutUser.mockReset();
  h.signOutUser.mockImplementation(async () => { h.listeners.forEach((fn) => fn(null)); });
  sessionStorage.clear();
  document.getElementById('splash-screen')?.remove();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('finding out who is signed in', () => {
  it('shows a visible loading picture first, and removes the plain-HTML splash of the page (no jump)', async () => {
    setup();
    expect(screen.getByRole('status', { name: 'جاري التحميل' })).toBeInTheDocument();
    expect(document.getElementById('splash-screen')).toBeNull();
    expect(screen.queryByRole('button', { name: 'دخول' })).not.toBeInTheDocument();
  });

  it('nobody signed in: the login form, in the default (blue) theme', async () => {
    setup();
    await emitAuth(null);
    expect(await screen.findByRole('button', { name: 'دخول' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'جاري التحميل' })).not.toBeInTheDocument();
    expect(h.applySectionTheme).toHaveBeenCalledWith(false);
    expect(h.loadAccountDecision).not.toHaveBeenCalled();
  });

  it('while the signed-in account is checked, the loading picture stays', async () => {
    h.loadAccountDecision.mockImplementation(() => new Promise(() => undefined));
    setup();
    await emitAuth(person);
    expect(screen.getByRole('status', { name: 'جاري التحميل' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'دخول' })).not.toBeInTheDocument();
  });

  it('if this takes too long, the login form is shown anyway, with a connection warning', async () => {
    vi.useFakeTimers();
    window.showToast = vi.fn();
    try {
      setup();
      await act(async () => { vi.advanceTimersByTime(7000); });
      expect(screen.getByRole('button', { name: 'دخول' })).toBeInTheDocument();
      expect(window.showToast).toHaveBeenCalledWith(expect.stringContaining('مشكلة اتصال'), 'error');
    } finally {
      vi.useRealTimers();
      delete window.showToast;
    }
  });
});

describe('an account that may enter', () => {
  it('is checked once; the old app gets its data and starts; the screen shows nothing more', async () => {
    h.loadAccountDecision.mockResolvedValue(enter);
    const { container } = setup();
    await emitAuth(person);
    await waitFor(() => expect(h.enterApp).toHaveBeenCalledTimes(1));
    expect(h.enterApp).toHaveBeenCalledWith(person, profile);
    expect(state.currentUserName).toBe('مينا');
    expect(state.currentUserGrade).toBe('سنة رابعة ابتدائي');
    expect(h.loadAccountDecision).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('someone who still has to finish their data goes to that screen instead', async () => {
    h.loadAccountDecision.mockResolvedValue({ kind: 'incomplete-profile', session, profile });
    const { container } = setup();
    await emitAuth(person);
    await waitFor(() => expect(h.openCompleteProfileScreen).toHaveBeenCalledWith(person, profile));
    expect(h.enterApp).not.toHaveBeenCalled();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('letting someone in forgets the "already tried to switch section" mark', async () => {
    sessionStorage.setItem('sectionRedirect', 'girls');
    h.loadAccountDecision.mockResolvedValue(enter);
    setup();
    await emitAuth(person);
    await waitFor(() => expect(h.enterApp).toHaveBeenCalled());
    expect(sessionStorage.getItem('sectionRedirect')).toBeNull();
  });
});

describe('an account that cannot come in', () => {
  const reasons: [BlockedReason, string][] = [
    ['pending', 'في انتظار الموافقة'],
    ['no-access', 'لسه مفيش صلاحيات'],
    ['rejected', 'تم رفض حسابك'],
    ['unregistered', 'الحساب ده مش مسجل'],
    ['unverifiable', 'مش قادرين نتأكد من حسابك'],
    ['wrong-section', 'حسابك تابع لقسم تاني'],
    ['no-class', 'لسه مفيش فصل'],
  ];
  it.each(reasons)('"%s": the reason is shown, with a way to sign out; nobody is signed out for them and the app does not start', async (reason, title) => {
    h.loadAccountDecision.mockResolvedValue({ kind: 'blocked', reason });
    setup();
    await emitAuth(person);
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /خروج/ })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'دخول' })).not.toBeInTheDocument();
    expect(h.signOutUser).not.toHaveBeenCalled();
    expect(h.enterApp).not.toHaveBeenCalled();
    expect(h.applySectionTheme).toHaveBeenCalledWith(false);
  });

  it('signing out from that screen goes back to the login form, with an empty form', async () => {
    h.loadAccountDecision.mockResolvedValue({ kind: 'blocked', reason: 'rejected' });
    const { user } = setup();
    await emitAuth(person);
    await user.click(await screen.findByRole('button', { name: /خروج/ }));
    expect(h.signOutUser).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'دخول' })).toBeInTheDocument();
    expect(screen.getByLabelText('كلمة المرور')).toHaveValue('');
  });

  it('"no access yet" explains that an admin has to give them a class', async () => {
    h.loadAccountDecision.mockResolvedValue({ kind: 'blocked', reason: 'no-access' });
    setup();
    await emitAuth(person);
    expect(await screen.findByText(/لسه محدش حدد لك فصل/)).toBeInTheDocument();
  });
});

describe('an account of the other section', () => {
  it('shows the loading picture while the page reloads into its section (not the login form, not the app)', async () => {
    h.loadAccountDecision.mockResolvedValue({ kind: 'redirect-section', target: 'girls' });
    setup();
    await emitAuth(person);
    await waitFor(() => expect(h.loadAccountDecision).toHaveBeenCalled());
    expect(screen.getByRole('status', { name: 'جاري التحميل' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'دخول' })).not.toBeInTheDocument();
    expect(h.enterApp).not.toHaveBeenCalled();
  });
});

describe('when the account cannot be read', () => {
  it('shows a visible error with a retry button (and a way out), and retrying can succeed', async () => {
    h.loadAccountDecision.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(enter);
    const { user } = setup();
    await emitAuth(person);
    expect(await screen.findByText(/مقدرناش نتأكد من حسابك/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'خروج' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'حاول تاني' }));
    await waitFor(() => expect(h.enterApp).toHaveBeenCalledTimes(1));
    expect(h.loadAccountDecision).toHaveBeenCalledTimes(2);
  });
});

describe('registering a new servant', () => {
  it('the new account is signed in for a moment: it is NOT checked as a login (it has no record yet)', async () => {
    let finish: () => void = () => undefined;
    h.registerServant.mockImplementation(async () => {
      h.listeners.forEach((fn) => fn(person)); // Firebase signs the new account in
      await new Promise<void>((resolve) => { finish = resolve; });
      h.listeners.forEach((fn) => fn(null)); // ...and the app signs it out again
    });
    sessionStorage.setItem('openRegisterTab', '1');
    const { user } = setup();
    await emitAuth(null);
    await user.selectOptions(await screen.findByLabelText(/السنة الدراسية اللي هتخدم فيها/), 'سنة رابعة ابتدائي');
    const name = await screen.findByLabelText(/الاسم الكامل/);
    await waitFor(() => expect(name).toBeEnabled());
    await user.selectOptions(name, 'يوسف');
    await user.type(screen.getByLabelText('البريد الإلكتروني *'), 'y@x.com');
    await user.type(screen.getByLabelText('رقم التليفون 1'), '010');
    await user.type(screen.getByLabelText('كلمة المرور *'), 'secret1');
    await user.click(screen.getByRole('button', { name: /طلب تسجيل/ }));
    await screen.findByRole('button', { name: 'جاري الإرسال…' });
    expect(h.loadAccountDecision).not.toHaveBeenCalled();
    expect(h.enterApp).not.toHaveBeenCalled();
    expect(screen.queryByRole('status', { name: 'جاري التحميل' })).not.toBeInTheDocument(); // no loading picture over the form
    await act(async () => { finish(); });
    expect(await screen.findByText(/تم إرسال طلبك للأدمن/)).toBeInTheDocument();
    expect(h.loadAccountDecision).not.toHaveBeenCalled();
  });
});
