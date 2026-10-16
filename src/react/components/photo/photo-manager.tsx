import { useRef, useState, type ChangeEvent, type FC } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { Switch, Case } from 'react-if';
import { Alert } from '@/react/components/ui/alert';
import { Spinner } from '@/react/components/ui/spinner';
import { compressImage, type CropFraction } from '@/core/image';
import { usePreferences } from '@/react/hooks/usePreferences';
import { PhotoChooser } from './photo-chooser';
import { PhotoCropStep } from './photo-crop-step';
import { PhotoViewer } from './photo-viewer';

enum PhotoView {
  Choose = 'choose',
  View = 'view',
  Crop = 'crop',
}

export type PhotoManagerProps = {
  /** whose photo (the accessible name, and the initials when there is none) */
  name: string;
  /** the current photo (a data URL); without one the manager starts as the camera / gallery question */
  photo?: string;
  /** can the photo be changed? (otherwise it is only shown) */
  editable: boolean;
  /** stores a new photo (a data URL); rejects when it cannot be saved */
  onSave: (photo: string) => Promise<void>;
  /** deletes the photo; rejects when it cannot be deleted */
  onRemove: () => Promise<void>;
  onClose: () => void;
};

type SaveInput = { file: Blob; crop?: CropFraction };

const errorText = (e: unknown): string => {
  if (e instanceof Error && e.message === 'photo-unreadable') {
    return 'الصورة طلعت سودا أو ناقصة، جرّب تصوّرها تاني أو اختارها من المعرض';
  }
  return 'معرفناش نحفظ الصورة، جرّب تاني.';
};

/**
 * EVERYTHING about a person's photo, in one component, for kids and servants alike:
 *  - no photo: the camera / gallery question;
 *  - a photo: the photo full screen (zoomable) with three icons on top: camera, gallery, delete;
 *  - after a photo is picked: the crop screen (only when "قص الصورة" is on in الإعدادات), then it is shrunk and saved.
 * The caller only says where to store the photo (`onSave` / `onRemove`) and what to do when it is done (`onClose`).
 */
export const PhotoManager: FC<PhotoManagerProps> = ({ name, photo, editable, onSave, onRemove, onClose }) => {
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Blob | null>(null);
  const { cropPhotos } = usePreferences();

  const save = useMutation({
    mutationFn: async ({ file, crop }: SaveInput) => onSave(await compressImage(file, { crop })),
    onSuccess: onClose,
    onError: () => setPicked(null),
  });
  const remove = useMutation({ mutationFn: onRemove, onSuccess: onClose });

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // the same file can be picked again
    if (!file) {
      return;
    }
    save.reset();
    if (cropPhotos) {
      setPicked(file);
    } else {
      save.mutate({ file });
    }
  };

  let view = photo ? PhotoView.View : PhotoView.Choose;
  if (picked) {
    view = PhotoView.Crop;
  }
  const busy = save.isPending || remove.isPending;
  const error = save.error ?? remove.error;

  return createPortal(
    <div className="rx-root">
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="tw:hidden" aria-label="كاميرا" onChange={onFile} />
      <input ref={galleryInput} type="file" accept="image/*" className="tw:hidden" aria-label="معرض الصور" onChange={onFile} />
      <Switch>
        <Case condition={view === PhotoView.Choose}>
          <PhotoChooser onCamera={() => cameraInput.current?.click()} onGallery={() => galleryInput.current?.click()} onClose={onClose} />
        </Case>
        <Case condition={view === PhotoView.View}>
          <PhotoViewer
            name={name}
            photo={photo ?? ''}
            editable={editable}
            onCamera={() => cameraInput.current?.click()}
            onGallery={() => galleryInput.current?.click()}
            onRemove={() => remove.mutate()}
            onClose={onClose}
          />
        </Case>
        <Case condition={view === PhotoView.Crop}>
          {picked && <PhotoCropStep file={picked} onCancel={() => setPicked(null)} onDone={(crop) => save.mutate({ file: picked, crop })} />}
        </Case>
      </Switch>
      {error && (
        <div className="tw:fixed tw:inset-x-3 tw:top-16 tw:z-[10020] tw:mx-auto tw:max-w-lg">
          <Alert onDismiss={() => { save.reset(); remove.reset(); }}>{errorText(error)}</Alert>
        </div>
      )}
      {busy && (
        <div className="tw:fixed tw:inset-0 tw:z-[10030] tw:flex tw:items-center tw:justify-center tw:bg-black/50">
          <Spinner label="جاري الحفظ…" className="tw:rounded-card tw:bg-surface tw:px-5 tw:py-3" />
        </div>
      )}
    </div>,
    document.body,
  );
};
