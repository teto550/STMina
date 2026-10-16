import { useEffect, useState, type FC } from 'react';
import { Camera, Images, Trash2, X } from 'lucide-react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { Button } from '@/react/components/ui/button';

type PhotoViewerProps = {
  name: string;
  photo: string;
  /** shows the three icons on top: camera, gallery, delete */
  editable: boolean;
  onCamera: () => void;
  onGallery: () => void;
  onRemove: () => void;
  onClose: () => void;
};

const IconButton: FC<{ label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }> = ({ label, onClick, danger = false, children }) => {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`tw:flex tw:size-11 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-full tw:bg-white/15 tw:text-white tw:backdrop-blur ${danger ? 'tw:text-red-300' : ''}`}
    >
      {children}
    </button>
  );
};

/** The photo, full screen: pinch / double-tap / wheel to zoom, drag to move; for an editable one, three icons on top (camera, gallery, delete). */
export const PhotoViewer: FC<PhotoViewerProps> = ({ name, photo, editable, onCamera, onGallery, onRemove, onClose }) => {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-label={name} className="tw:fixed tw:inset-0 tw:z-[10010] tw:bg-black/95">
      <div className="tw:absolute tw:inset-x-0 tw:top-0 tw:z-10 tw:flex tw:items-center tw:justify-between tw:gap-2 tw:p-3">
        <div className="tw:flex tw:gap-2">
          {editable && (
            <>
              <IconButton label="صورة من الكاميرا" onClick={onCamera}>
                <Camera className="tw:size-5" aria-hidden="true" />
              </IconButton>
              <IconButton label="صورة من المعرض" onClick={onGallery}>
                <Images className="tw:size-5" aria-hidden="true" />
              </IconButton>
              <IconButton label="حذف الصورة" danger onClick={() => setConfirming(true)}>
                <Trash2 className="tw:size-5" aria-hidden="true" />
              </IconButton>
            </>
          )}
        </div>
        <IconButton label="إغلاق" onClick={onClose}>
          <X className="tw:size-5" aria-hidden="true" />
        </IconButton>
      </div>
      <TransformWrapper minScale={1} maxScale={6} doubleClick={{ mode: 'toggle', step: 2 }} centerOnInit>
        <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={photo} alt={name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </TransformComponent>
      </TransformWrapper>
      {confirming && (
        <div className="tw:absolute tw:inset-x-0 tw:bottom-0 tw:z-10 tw:flex tw:flex-col tw:gap-3 tw:bg-surface tw:p-4">
          <p className="tw:text-center tw:text-sm tw:font-bold">تحذف الصورة؟</p>
          <div className="tw:flex tw:gap-2">
            <Button variant="secondary" className="tw:flex-1" onClick={() => setConfirming(false)}>إلغاء</Button>
            <Button variant="destructive" className="tw:flex-1" onClick={onRemove}>حذف</Button>
          </div>
        </div>
      )}
    </div>
  );
};
