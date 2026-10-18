import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

vi.mock('@/core/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'u1' } } }));
vi.mock('firebase/firestore', () => ({ doc: () => 'doc', updateDoc: vi.fn() }));
vi.mock('@/core/image', () => ({ compressImage: async () => 'data:image/jpeg;base64,NEW' }));

import PhotoField from '@/react/screens/photo-field';

const field = (props: { photo?: string; onChange: (p: string) => void }) => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PhotoField {...props} />
    </QueryClientProvider>,
  );
};

describe('PhotoField (the photo of the kid forms)', () => {
  it('adds a photo and reports it to the form, without saving anything itself', async () => {
    const onChange = vi.fn();
    field({ onChange });
    fireEvent.click(screen.getByRole('button', { name: 'صورة المخدوم' }));
    fireEvent.change(await screen.findByLabelText('كاميرا'), { target: { files: [new File(['x'], 'p.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('data:image/jpeg;base64,NEW'));
    expect(await screen.findByAltText('صورة المخدوم')).toHaveAttribute('src', 'data:image/jpeg;base64,NEW');
  });

  it('deletes the existing photo and reports an empty one', async () => {
    const onChange = vi.fn();
    field({ photo: 'data:image/jpeg;base64,OLD', onChange });
    fireEvent.click(screen.getByRole('button', { name: 'صورة المخدوم' }));
    fireEvent.click(await screen.findByRole('button', { name: 'حذف الصورة' }));
    fireEvent.click(screen.getByRole('button', { name: 'حذف' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(''));
  });
});
