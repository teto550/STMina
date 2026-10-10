import type { FC } from 'react';
import { cn } from '@/react/lib/utils';

export type ServantRowData = {
  name: string;
  grade: string;
  /** false = has not registered in the app yet */
  registered: boolean;
  sunday: number;
  meeting: number;
};

type ServantRowProps = {
  row: ServantRowData;
  onOpen: (name: string) => void;
};

const Count: FC<{ value: number; label: string }> = ({ value, label }) => {
  return (
    <div className="tw:rounded-field tw:border tw:border-line tw:bg-surface-2 tw:px-2.5 tw:py-1.5 tw:text-center">
      <div className={cn('tw:text-base tw:font-black', value ? 'tw:text-ok' : 'tw:text-dim')}>{value}</div>
      <div className="tw:text-[9px] tw:text-dim">{label}</div>
    </div>
  );
};

export const ServantRow: FC<ServantRowProps> = ({ row, onOpen }) => {
  return (
    <li>
      <button type="button" onClick={() => onOpen(row.name)} className="tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:gap-3 tw:rounded-card tw:border tw:border-line tw:bg-surface tw:p-3 tw:text-start">
        <span aria-hidden="true" className="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-field tw:bg-surface-2 tw:font-bold">{row.name.trim().charAt(0)}</span>
        <span className="tw:min-w-0 tw:flex-1">
          <span className="tw:block tw:truncate tw:text-sm tw:font-bold">{row.name}</span>
          <span className="tw:mt-0.5 tw:block tw:text-xs tw:text-dim">{row.grade || '—'}{row.registered ? '' : ' · لسه ماسجلش بياناته'}</span>
        </span>
        <span className="tw:flex tw:shrink-0 tw:gap-1.5">
          <Count value={row.sunday} label="⛪ مدارس أحد" />
          <Count value={row.meeting} label="👥 اجتماع خدام" />
        </span>
      </button>
    </li>
  );
};
