import type { FC } from 'react';
import { Switch, Case } from 'react-if';
import { ServantRow, type ServantRowData } from './ServantRow';

enum ListView {
  Empty = 'empty',
  Data = 'data',
}

export type ServantsListProps = {
  rows: ServantRowData[];
  onOpen: (name: string) => void;
};

/** The servants tab: one row per servant with the class and the attendance counts (the data is read by the old page). */
const ServantsList: FC<ServantsListProps> = ({ rows, onOpen }) => {
  const view = rows.length === 0 ? ListView.Empty : ListView.Data;
  return (
    <Switch>
      <Case condition={view === ListView.Empty}>
        <p className="tw:py-8 tw:text-center tw:text-sm tw:text-dim">🙏 مفيش خدام مطابقين</p>
      </Case>
      <Case condition={view === ListView.Data}>
        <ul className="tw:flex tw:flex-col tw:gap-2">
          {rows.map((r) => (
            <ServantRow key={r.name} row={r} onOpen={onOpen} />
          ))}
        </ul>
      </Case>
    </Switch>
  );
};

export default ServantsList;
