import { useState, type FC } from 'react';
import { Button } from '@/react/components/ui/button';
import { Chip } from '@/react/components/ui/chip';
import type { JoinRequest } from '@/api/join-requests';

type RequestCardProps = {
  request: JoinRequest;
  /** true while a decision about THIS request is being saved */
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
};

const Row: FC<{ label: string; value?: string }> = ({ label, value }) => {
  if (!value) {
    return null;
  }
  return (
    <div className="tw:flex tw:gap-2 tw:text-sm">
      <dt className="tw:shrink-0 tw:text-dim">{label}</dt>
      <dd className="tw:min-w-0 tw:break-words">{value}</dd>
    </div>
  );
};

/** One request with its details and the approve / reject buttons (rejecting asks for a second tap, instead of a browser confirm). */
export const RequestCard: FC<RequestCardProps> = ({ request: r, busy, onApprove, onReject }) => {
  const [confirmingReject, setConfirmingReject] = useState(false);
  const phones = (r.phones && r.phones.length ? r.phones : r.phone ? [r.phone] : []).join(' - ');
  const study = r.graduated ? 'متخرج' : [r.college, r.university].filter(Boolean).join(' - ');
  const sent = r.createdAt ? new Date(r.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : '';
  return (
    <li className="tw:flex tw:flex-col tw:gap-3 tw:rounded-card tw:border tw:border-warn tw:bg-surface-2 tw:p-3">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <h3 className="tw:text-base tw:font-bold">{r.name || 'بدون اسم'}</h3>
        {r.grade && <Chip tone="girls">{r.grade}</Chip>}
      </div>
      <dl className="tw:flex tw:flex-col tw:gap-1">
        <Row label="الإيميل" value={r.email} />
        <Row label="التليفون" value={phones} />
        <Row label="العنوان" value={r.address} />
        <Row label="تاريخ الميلاد" value={r.dob} />
        <Row label="الدراسة" value={study} />
        <Row label="تاريخ الطلب" value={sent} />
      </dl>
      <div className="tw:flex tw:gap-2">
        <Button size="sm" className="tw:flex-1" disabled={busy} onClick={onApprove}>✓ قبول</Button>
        {confirmingReject ? (
          <Button size="sm" variant="destructive" className="tw:flex-1" disabled={busy} onClick={onReject}>أكيد؟ اضغط للرفض</Button>
        ) : (
          <Button size="sm" variant="outline" className="tw:flex-1" disabled={busy} onClick={() => setConfirmingReject(true)}>✕ رفض</Button>
        )}
      </div>
    </li>
  );
};
