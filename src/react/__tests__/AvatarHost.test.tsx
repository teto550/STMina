import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

const updateDoc = vi.fn(async (..._a: unknown[]) => undefined);
vi.mock('@/core/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'u1' } } }));
vi.mock('firebase/firestore', () => ({ doc: (_d: unknown, c: string, id: string) => `${c}/${id}`, updateDoc: (...a: unknown[]) => updateDoc(...a) }));

import AvatarHost from '@/react/screens/avatar-host';

const host = () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AvatarHost />
    </QueryClientProvider>,
  );
};

// the "old page": a div with the placeholders the old screens write, next to the React test container
let pageEl: HTMLElement;
const page = (html: string) => {
  pageEl = document.createElement('div');
  pageEl.innerHTML = html;
  document.body.appendChild(pageEl);
};

beforeEach(() => updateDoc.mockClear());
afterEach(() => pageEl?.remove());

describe('AvatarHost', () => {
  it('draws an avatar into every placeholder, also ones added later, and forgets removed ones', async () => {
    page('<div id="list"><span data-avatar data-name="مينا باسم" data-src="" data-size="42"><span>م</span></span></div>');
    host();
    await waitFor(() => expect(screen.getByRole('img', { name: 'مينا باسم' })).toBeInTheDocument());
    await act(async () => {
      document.getElementById('list')!.insertAdjacentHTML('beforeend', '<span data-avatar data-name="مارك" data-src="data:image/jpeg;base64,AAAA" data-size="36"></span>');
    });
    await waitFor(() => expect(document.querySelector('img[src="data:image/jpeg;base64,AAAA"]')).not.toBeNull());
    await act(async () => {
      document.getElementById('list')!.innerHTML = '';
    });
    await waitFor(() => expect(screen.queryByRole('img', { name: 'مينا باسم' })).not.toBeInTheDocument());
  });

  it('a kid without a photo opens the camera / gallery question; one without a way to change it does nothing', async () => {
    page(
      '<span data-avatar data-name="بيشوي" data-src="" data-size="42" data-photo-target="student:s1"></span>' +
        '<span data-avatar data-name="مارك" data-src="" data-size="42"></span>',
    );
    host();
    expect(screen.queryByRole('button', { name: 'مارك' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'بيشوي' }));
    expect(await screen.findByRole('button', { name: 'من الكاميرا' })).toBeInTheDocument();
  });

  it('a photo opens full screen; with a target it can be changed, without one it is only shown', async () => {
    page(
      '<span data-avatar data-name="بيشوي" data-src="data:image/jpeg;base64,AAAA" data-size="42" data-photo-target="student:s1"></span>' +
        '<span data-avatar data-name="مارك" data-src="data:image/jpeg;base64,BBBB" data-size="42"></span>',
    );
    host();
    fireEvent.click(await screen.findByRole('button', { name: 'مارك' }));
    expect(await screen.findByRole('dialog', { name: 'مارك' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'حذف الصورة' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'إغلاق' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'بيشوي' }));
    expect(await screen.findByRole('button', { name: 'حذف الصورة' })).toBeInTheDocument();
  });

  it('deleting writes once, updates the avatar in place and tells the old page', async () => {
    page('<span data-avatar data-name="بيشوي" data-src="data:image/jpeg;base64,AAAA" data-size="42" data-photo-target="student:s1"></span>');
    host();
    const changed = vi.fn();
    document.addEventListener('photo-changed', changed);
    fireEvent.click(await screen.findByRole('button', { name: 'بيشوي' }));
    fireEvent.click(await screen.findByRole('button', { name: 'حذف الصورة' }));
    fireEvent.click(screen.getByRole('button', { name: 'حذف' }));
    await waitFor(() => expect(changed).toHaveBeenCalled());
    document.removeEventListener('photo-changed', changed);
    expect(updateDoc).toHaveBeenCalledTimes(1);
    expect(updateDoc).toHaveBeenCalledWith('students/s1', { photo: '' });
    expect((changed.mock.calls[0]![0] as CustomEvent).detail).toEqual({ kind: 'student', id: 's1', photo: '' });
    // the avatar shows the initials now, and nothing else was read or written
    await waitFor(() => expect(document.querySelector('[data-avatar] img')).toBeNull());
    expect(updateDoc).toHaveBeenCalledTimes(1);
  });
});
