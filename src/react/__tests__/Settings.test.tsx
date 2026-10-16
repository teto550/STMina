import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

const updateDoc = vi.fn(async (..._a: unknown[]) => undefined);
vi.mock('@/core/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'u1' } } }));
vi.mock('firebase/firestore', () => ({ doc: (_d: unknown, c: string, id: string) => `${c}/${id}`, updateDoc: (...a: unknown[]) => updateDoc(...a) }));

import Settings from '@/react/screens/settings';
import { getPreferences, loadPreferences, savePreferences } from '@/api/preferences';

const close = vi.fn();
const open = () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Settings close={close} />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  localStorage.clear();
  updateDoc.mockClear();
  loadPreferences('u1', null);
});

describe('Settings screen', () => {
  it('is a screen with a title and a back arrow that closes it', async () => {
    const user = userEvent.setup();
    open();
    expect(screen.getByRole('heading', { name: 'الإعدادات' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'الصور' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'رجوع' }));
    expect(close).toHaveBeenCalled();
  });

  it('has the crop option, off by default', () => {
    open();
    expect(screen.getByLabelText(/قص الصورة بعد اختيارها/)).not.toBeChecked();
  });

  it('turning it on saves it on the account (one write) and applies it', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByLabelText(/قص الصورة بعد اختيارها/));
    await waitFor(() => expect(screen.getByLabelText(/قص الصورة بعد اختيارها/)).toBeChecked());
    expect(updateDoc).toHaveBeenCalledTimes(1);
    expect(updateDoc).toHaveBeenCalledWith('users/u1', { preferences: { cropPhotos: true, focusSearchAfterMark: true } });
    expect(getPreferences().cropPhotos).toBe(true);
  });

  it('shows an error and keeps the old value when it cannot be saved', async () => {
    updateDoc.mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    open();
    await user.click(screen.getByLabelText(/قص الصورة بعد اختيارها/));
    expect(await screen.findByText(/معرفناش نحفظ الإعدادات/)).toBeInTheDocument();
    expect(screen.getByLabelText(/قص الصورة بعد اختيارها/)).not.toBeChecked();
  });
});

describe('Settings: attendance', () => {
  const FOCUS = /الرجوع لخانة البحث بعد تسجيل الحضور/;

  it('"back to the search box after marking" is on by default', () => {
    open();
    expect(screen.getByLabelText(FOCUS)).toBeChecked();
  });

  it('turning it off saves it on the account and applies it', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByLabelText(FOCUS));
    await waitFor(() => expect(screen.getByLabelText(FOCUS)).not.toBeChecked());
    expect(updateDoc).toHaveBeenCalledWith('users/u1', { preferences: { cropPhotos: false, focusSearchAfterMark: false } });
    expect(getPreferences().focusSearchAfterMark).toBe(false);
  });

  it('keeps the crop choice when this one changes', async () => {
    const user = userEvent.setup();
    loadPreferences('u1', { cropPhotos: true, focusSearchAfterMark: true });
    open();
    await user.click(screen.getByLabelText(FOCUS));
    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    expect(getPreferences()).toEqual({ cropPhotos: true, focusSearchAfterMark: false });
  });
});

describe('preferences store', () => {
  it('takes the account value, else the copy kept in this browser, else the defaults', () => {
    loadPreferences('u1', { cropPhotos: true });
    expect(getPreferences().cropPhotos).toBe(true);
    loadPreferences('u1', undefined); // offline / older account: the copy saved just before
    expect(getPreferences().cropPhotos).toBe(true);
    localStorage.clear();
    loadPreferences('u2', undefined);
    expect(getPreferences()).toEqual({ cropPhotos: false, focusSearchAfterMark: true });
  });

  it('ignores garbage, and an older account without the new option gets its default (on)', () => {
    loadPreferences('u1', { cropPhotos: 'yes' });
    expect(getPreferences().cropPhotos).toBe(false);
    expect(getPreferences().focusSearchAfterMark).toBe(true);
    loadPreferences('u1', { cropPhotos: true });
    expect(getPreferences().focusSearchAfterMark).toBe(true);
  });

  it('keeps the other preferences when one is saved', async () => {
    loadPreferences('u1', { cropPhotos: true });
    await savePreferences({});
    expect(getPreferences().cropPhotos).toBe(true);
  });
});
