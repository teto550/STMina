import { useState, type FC } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/react/components/ui/button';
import { reloadApp, useAppUpdate } from '@/react/hooks/useAppUpdate';

/**
 * "فيه تحديث جديد": a small bar at the bottom of the app that shows when a newer build is on the server. It never reloads by
 * itself (the person may be in the middle of marking attendance); "✕" hides it for that build.
 */
const UpdateBanner: FC = () => {
  const { latest, updateAvailable } = useAppUpdate();
  const [dismissed, setDismissed] = useState('');
  if (!updateAvailable || !latest || dismissed === latest.build) {
    return null;
  }
  return (
    <div role="status" className="tw:fixed tw:inset-x-3 tw:bottom-3 tw:z-[10005] tw:mx-auto tw:flex tw:max-w-lg tw:items-center tw:gap-3 tw:rounded-card tw:border tw:border-accent tw:bg-surface tw:p-3 tw:shadow-lg">
      <span className="tw:flex-1 tw:text-sm tw:font-bold">🆕 فيه تحديث جديد للتطبيق{latest.version ? ` (${latest.version})` : ''}</span>
      <Button size="sm" onClick={reloadApp}>تحديث الآن</Button>
      <button type="button" aria-label="إخفاء" onClick={() => setDismissed(latest.build)} className="tw:flex tw:size-8 tw:cursor-pointer tw:items-center tw:justify-center tw:text-dim">
        <X className="tw:size-4" aria-hidden="true" />
      </button>
    </div>
  );
};

export default UpdateBanner;
