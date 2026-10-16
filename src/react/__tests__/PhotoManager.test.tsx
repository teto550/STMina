import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

const compressImage = vi.fn(async (..._a: unknown[]) => 'data:image/jpeg;base64,NEW');
vi.mock('@/core/image', () => ({ compressImage: (...a: unknown[]) => compressImage(...a) }));
vi.mock('@/core/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'u1' } } }));
vi.mock('firebase/firestore', () => ({ doc: () => 'doc', updateDoc: vi.fn(async () => undefined) }));

import { PhotoManager } from '@/react/components/photo/photo-manager';
import { loadPreferences } from '@/api/preferences';

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:photo');
  URL.revokeObjectURL = vi.fn();
});

beforeEach(() => {
  compressImage.mockClear();
  loadPreferences('u1', { cropPhotos: false });
});

const open = (props: Partial<React.ComponentProps<typeof PhotoManager>> = {}) => {
  const onSave = vi.fn(async (_p: string) => undefined);
  const onRemove = vi.fn(async () => undefined);
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PhotoManager name="مينا" editable onSave={onSave} onRemove={onRemove} onClose={onClose} {...props} />
    </QueryClientProvider>,
  );
  return { onSave, onRemove, onClose };
};

const pick = (label: string) => {
  const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });
  return file;
};

describe('PhotoManager without a photo', () => {
  it('asks camera or gallery', () => {
    open();
    expect(screen.getByRole('button', { name: 'من الكاميرا' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'من المعرض' })).toBeInTheDocument();
  });

  it('the camera button opens the camera input and the gallery button the gallery one', async () => {
    const user = userEvent.setup();
    open();
    const camera = screen.getByLabelText('كاميرا');
    const gallery = screen.getByLabelText('معرض الصور');
    expect(camera).toHaveAttribute('capture');
    expect(gallery).not.toHaveAttribute('capture');
    const cameraClick = vi.spyOn(camera, 'click');
    const galleryClick = vi.spyOn(gallery, 'click');
    await user.click(screen.getByRole('button', { name: 'من الكاميرا' }));
    await user.click(screen.getByRole('button', { name: 'من المعرض' }));
    expect(cameraClick).toHaveBeenCalledTimes(1);
    expect(galleryClick).toHaveBeenCalledTimes(1);
  });

  it('a picked photo is shrunk, saved, and the popup closes', async () => {
    const { onSave, onClose } = open();
    const file = pick('كاميرا');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(compressImage).toHaveBeenCalledWith(file, { crop: undefined });
    expect(onSave).toHaveBeenCalledWith('data:image/jpeg;base64,NEW');
  });

  it('shows the error and stays open when the photo cannot be saved', async () => {
    const { onClose } = open({ onSave: vi.fn(async () => { throw new Error('quota'); }) });
    pick('معرض الصور');
    expect(await screen.findByText(/معرفناش نحفظ الصورة/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('says so when the photo came out black', async () => {
    compressImage.mockRejectedValueOnce(new Error('photo-unreadable'));
    open();
    pick('كاميرا');
    expect(await screen.findByText(/الصورة طلعت سودا/)).toBeInTheDocument();
  });
});

describe('PhotoManager with a photo', () => {
  const photo = 'data:image/jpeg;base64,OLD';

  it('shows the photo with three icons on top: camera, gallery, delete', () => {
    open({ photo });
    expect(screen.getByRole('img', { name: 'مينا' })).toHaveAttribute('src', photo);
    expect(screen.getByRole('button', { name: 'صورة من الكاميرا' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'صورة من المعرض' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'حذف الصورة' })).toBeInTheDocument();
  });

  it('only shows the photo when it cannot be edited', () => {
    open({ photo, editable: false });
    expect(screen.queryByRole('button', { name: 'حذف الصورة' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'صورة من الكاميرا' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إغلاق' })).toBeInTheDocument();
  });

  it('the icons open the camera / gallery', async () => {
    const user = userEvent.setup();
    open({ photo });
    const camera = vi.spyOn(screen.getByLabelText('كاميرا'), 'click');
    await user.click(screen.getByRole('button', { name: 'صورة من الكاميرا' }));
    expect(camera).toHaveBeenCalled();
  });

  it('deleting asks once, then deletes and closes', async () => {
    const user = userEvent.setup();
    const { onRemove, onClose } = open({ photo });
    await user.click(screen.getByRole('button', { name: 'حذف الصورة' }));
    expect(onRemove).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'حذف' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('"cancel" in the delete question keeps the photo', async () => {
    const user = userEvent.setup();
    const { onRemove } = open({ photo });
    await user.click(screen.getByRole('button', { name: 'حذف الصورة' }));
    await user.click(screen.getByRole('button', { name: 'إلغاء' }));
    expect(screen.queryByText('تحذف الصورة؟')).not.toBeInTheDocument();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('closes with the X and with Escape', async () => {
    const user = userEvent.setup();
    const { onClose } = open({ photo });
    await user.click(screen.getByRole('button', { name: 'إغلاق' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('PhotoManager with cropping turned on', () => {
  const loadImage = (width: number, height: number) => {
    const img = screen.getByAltText('الصورة المختارة');
    Object.defineProperty(img, 'width', { value: width, configurable: true });
    Object.defineProperty(img, 'height', { value: height, configurable: true });
    fireEvent.load(img);
  };

  beforeEach(() => loadPreferences('u1', { cropPhotos: true }));

  it('shows the crop screen after picking and saves the chosen part with one tap on "تم"', async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = open();
    pick('كاميرا');
    expect(await screen.findByText('قص الصورة')).toBeInTheDocument();
    loadImage(400, 200);
    await user.click(screen.getByRole('button', { name: /تم/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const crop = (compressImage.mock.calls[0]![1] as { crop: { width: number; height: number } }).crop;
    expect(crop.width * 400).toBeCloseTo(crop.height * 200, 0); // a square
    expect(onSave).toHaveBeenCalled();
  });

  it('offers a free shape next to the square one', async () => {
    const user = userEvent.setup();
    open();
    pick('كاميرا');
    await screen.findByText('قص الصورة');
    loadImage(400, 200);
    expect(screen.getByRole('button', { name: 'مربع' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'حر' }));
    expect(screen.getByRole('button', { name: 'حر' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('cancel goes back without saving', async () => {
    const user = userEvent.setup();
    const { onSave } = open();
    pick('كاميرا');
    await screen.findByText('قص الصورة');
    await user.click(screen.getByRole('button', { name: 'إلغاء' }));
    expect(screen.getByRole('button', { name: 'من الكاميرا' })).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('when the photo cannot be shown it offers to continue without cropping', async () => {
    const user = userEvent.setup();
    const { onClose } = open();
    pick('كاميرا');
    await screen.findByText('قص الصورة');
    fireEvent.error(screen.getByAltText('الصورة المختارة'));
    await user.click(await screen.findByRole('button', { name: 'كمّل من غير قص' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(compressImage.mock.calls[0]![1]).toEqual({ crop: { x: 0, y: 0, width: 1, height: 1 } });
  });
});

describe('PhotoManager while saving', () => {
  it('shows a loader', async () => {
    let done: () => void = () => undefined;
    open({ onSave: () => new Promise<void>((r) => { done = r; }) });
    pick('كاميرا');
    expect(await screen.findByRole('status', { name: 'جاري الحفظ…' })).toBeInTheDocument();
    await act(async () => done());
  });
});
