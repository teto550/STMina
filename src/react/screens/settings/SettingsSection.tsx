import type { FC, ReactNode } from 'react';

type SettingsSectionProps = {
  title: string;
  children: ReactNode;
};

/** A titled group of settings in a card. Every future group of settings is one of these. */
export const SettingsSection: FC<SettingsSectionProps> = ({ title, children }) => {
  return (
    <section className="tw:flex tw:flex-col tw:gap-2">
      <h2 className="tw:px-1 tw:text-sm tw:font-bold tw:text-dim">{title}</h2>
      <div className="tw:flex tw:flex-col tw:gap-1 tw:rounded-card tw:border tw:border-line tw:bg-surface tw:p-2">{children}</div>
    </section>
  );
};
