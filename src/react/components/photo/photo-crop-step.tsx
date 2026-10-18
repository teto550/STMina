import { useEffect, useMemo, useState, type FC, type SyntheticEvent } from 'react';
import { Switch, Case } from 'react-if';
import ReactCrop, { centerCrop, makeAspectCrop, type PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Alert } from '@/react/components/ui/alert';
import { Button } from '@/react/components/ui/button';
import { Sheet } from '@/react/components/ui/sheet';
import { cn } from '@/react/lib/utils';
import type { CropFraction } from '@/core/image';

enum CropView {
  Image = 'image',
  Unreadable = 'unreadable',
}

enum CropShape {
  Square = 'square',
  Free = 'free',
}

type PhotoCropStepProps = {
  /** the photo that was just taken or picked */
  file: Blob;
  /** the part to keep (as fractions of the picture) */
  onDone: (crop: CropFraction) => void;
  onCancel: () => void;
};

const WHOLE: CropFraction = { x: 0, y: 0, width: 1, height: 1 };

const squareOf = (width: number, height: number): PercentCrop => centerCrop(makeAspectCrop({ unit: '%', width: 90 }, 1, width, height), width, height);

/** "قص الصورة": the photo with a square already selected (drag to move, pull the corners to resize); one tap on "تم" keeps it. */
export const PhotoCropStep: FC<PhotoCropStepProps> = ({ file, onDone, onCancel }) => {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const [crop, setCrop] = useState<PercentCrop>();
  const [shape, setShape] = useState<CropShape>(CropShape.Square);
  const [unreadable, setUnreadable] = useState(false);
  const [box, setBox] = useState<{ width: number; height: number }>();

  const onLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setBox({ width, height });
    setCrop(squareOf(width, height));
  };

  const pick = (next: CropShape) => {
    setShape(next);
    if (next === CropShape.Square && box) {
      setCrop(squareOf(box.width, box.height));
    }
  };

  const confirm = () => {
    if (!crop || !crop.width || !crop.height) {
      onDone(WHOLE);
      return;
    }
    onDone({ x: crop.x / 100, y: crop.y / 100, width: crop.width / 100, height: crop.height / 100 });
  };

  const view = unreadable ? CropView.Unreadable : CropView.Image;

  return (
    <Sheet
      title="قص الصورة"
      onClose={onCancel}
      footer={
        <div className="tw:flex tw:gap-2">
          <Button variant="secondary" className="tw:flex-1" onClick={onCancel}>إلغاء</Button>
          <Button className="tw:flex-[2]" disabled={view === CropView.Image && !crop} onClick={view === CropView.Image ? confirm : () => onDone(WHOLE)}>
            {view === CropView.Image ? '✓ تم' : 'كمّل من غير قص'}
          </Button>
        </div>
      }
    >
      <Switch>
        <Case condition={view === CropView.Image}>
          <div className="tw:flex tw:flex-col tw:items-center tw:gap-3">
            <div role="group" aria-label="شكل القص" className="tw:flex tw:gap-2">
              {[
                { key: CropShape.Square, label: 'مربع' },
                { key: CropShape.Free, label: 'حر' },
              ].map((o) => (
                <button
                  key={o.key}
                  type="button"
                  aria-pressed={shape === o.key}
                  onClick={() => pick(o.key)}
                  className={cn('tw:cursor-pointer tw:rounded-full tw:border tw:px-4 tw:py-1.5 tw:text-xs tw:font-bold', shape === o.key ? 'tw:border-accent tw:bg-accent tw:text-white' : 'tw:border-line tw:bg-surface-2 tw:text-dim')}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <ReactCrop crop={crop} onChange={(_, percent) => setCrop(percent)} aspect={shape === CropShape.Square ? 1 : undefined} keepSelection minWidth={40} minHeight={40}>
              <img src={url} alt="الصورة المختارة" onLoad={onLoad} onError={() => setUnreadable(true)} style={{ maxHeight: '55dvh', maxWidth: '100%' }} />
            </ReactCrop>
          </div>
        </Case>
        <Case condition={view === CropView.Unreadable}>
          <Alert tone="warning">معرفناش نعرض الصورة للقص. تقدر تكمّل من غير قص.</Alert>
        </Case>
      </Switch>
    </Sheet>
  );
};
