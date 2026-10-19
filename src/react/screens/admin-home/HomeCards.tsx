import type { FC } from 'react';

type HomeCardsProps = {
  onOpenClasses: () => void;
  onOpenServants: () => void;
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

/** The first thing an admin sees: "الفصول" (all classes) and "الخدام" (all servants). Nothing is read from the backend here. */
export const HomeCards: FC<HomeCardsProps> = ({ onOpenClasses, onOpenServants }) => {
  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      <p className="tw:text-center tw:text-sm tw:text-dim">اختار الخانة اللي عايز تفتحها</p>
      <div className="tw:grid tw:grid-cols-2 tw:gap-3">
        <Card icon="🏫" title="الفصول" hint="كل الفصول وتاباتها" onClick={onOpenClasses} />
        <Card icon="🙏" title="الخدام" hint="الحضور والقايمة والطلبات" onClick={onOpenServants} />
      </div>
    </div>
  );
};
