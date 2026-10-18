import type { FC } from 'react';
import { Camera, Images } from 'lucide-react';
import { Button } from '@/react/components/ui/button';
import { Sheet } from '@/react/components/ui/sheet';

type PhotoChooserProps = {
  onCamera: () => void;
  onGallery: () => void;
  onClose: () => void;
};

/** "الصورة": the quick question for a person who has no photo yet: camera or gallery. */
export const PhotoChooser: FC<PhotoChooserProps> = ({ onCamera, onGallery, onClose }) => {
  return (
    <Sheet title="الصورة" onClose={onClose}>
      <div className="tw:grid tw:grid-cols-2 tw:gap-3">
        <Button variant="outline" className="tw:h-24 tw:flex-col" onClick={onCamera}>
          <Camera className="tw:size-6" aria-hidden="true" />
          من الكاميرا
        </Button>
        <Button variant="outline" className="tw:h-24 tw:flex-col" onClick={onGallery}>
          <Images className="tw:size-6" aria-hidden="true" />
          من المعرض
        </Button>
      </div>
    </Sheet>
  );
};
