import type { FC } from 'react';

type HomeCardsProps = {
  onOpenClasses: () => void;
  onOpenServants: () => void;
};

type CardProps = { icon: string; title: string; onClick: () => void };

const Card: FC<CardProps> = ({ icon, title, onClick }) => {
  return (
    <button type="button" onClick={onClick} className="tw:flex tw:min-h-36 tw:w-full tw:cursor-pointer tw:flex-col tw:items-center tw:justify-center tw:gap-2 tw:rounded-card tw:border tw:border-line tw:bg-surface tw:p-5 tw:text-fg tw:transition-colors tw:hover:border-accent">
      <span className="tw:text-5xl" aria-hidden="true">{icon}</span>
      <span className="tw:text-lg tw:font-black">{title}</span>
    </button>
  );
};

/** The first thing an admin sees: "الفصول" (all classes) and "الخدام" (all servants). Nothing is read from the backend here. */
export const HomeCards: FC<HomeCardsProps> = ({ onOpenClasses, onOpenServants }) => {
  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      <div className="tw:grid tw:grid-cols-2 tw:gap-3">
        <Card icon="🏫" title="الفصول" onClick={onOpenClasses} />
        <Card icon="🙏" title="الخدام" onClick={onOpenServants} />
      </div>
    </div>
  );
};
