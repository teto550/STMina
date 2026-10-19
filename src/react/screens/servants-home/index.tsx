import type { FC } from 'react';
import { ArrowRight } from 'lucide-react';
import type { ScreenProps } from '../registry';

export type ServantsSection = 'att' | 'list';

export type ServantsHomeProps = ScreenProps & {
  /** the roles screen is for admins only */
  showRoles: boolean;
  onOpenSection: (section: ServantsSection) => void;
  onOpenRoles: () => void;
  onBack: () => void;
};

type CardProps = { icon: string; title: string; hint: string; onClick: () => void };

const Card: FC<CardProps> = ({ icon, title, hint, onClick }) => {
  return (
    <button type="button" onClick={onClick} className="tw:flex tw:min-h-36 tw:w-full tw:cursor-pointer tw:flex-col tw:items-center tw:justify-center tw:gap-2 tw:rounded-card tw:border tw:border-line tw:bg-surface tw:p-5 tw:text-fg tw:transition-colors tw:hover:border-accent">
      <span className="tw:text-5xl" aria-hidden="true">{icon}</span>
      <span className="tw:text-lg tw:font-black">{title}</span>
      <span className="tw:text-xs tw:text-dim">{hint}</span>
    </button>
  );
};

/** The servants section opens on cards (like Hdour): الحضور, الخدام and, for admins, الأدوار. Reads nothing from the backend. */
const ServantsHome: FC<ServantsHomeProps> = ({ showRoles, onOpenSection, onOpenRoles, onBack }) => {
  return (
    <section aria-label="الخدام" className="tw:flex tw:flex-col tw:gap-3">
      <div className="tw:flex tw:items-center tw:gap-3">
        <button type="button" onClick={onBack} aria-label="رجوع" className="tw:flex tw:size-11 tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-field tw:border tw:border-line tw:bg-surface-2 tw:text-fg">
          <ArrowRight className="tw:size-5" aria-hidden="true" />
        </button>
        <h1 className="tw:text-lg tw:font-black">🙏 الخدام</h1>
      </div>
      <div className="tw:grid tw:grid-cols-2 tw:gap-3">
        <Card icon="✅" title="الحضور" hint="مدارس الأحد واجتماع الخدام" onClick={() => onOpenSection('att')} />
        <Card icon="🙏" title="الخدام" hint="القايمة والملفات والطلبات" onClick={() => onOpenSection('list')} />
        {showRoles && <Card icon="🗂" title="الأدوار" hint="المستخدمين وصلاحياتهم" onClick={onOpenRoles} />}
      </div>
    </section>
  );
};

export default ServantsHome;
