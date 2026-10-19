import { useState, type FC } from 'react';
import { Case, Default, Switch } from 'react-if';
import type { ScreenProps } from '../registry';
import { ClassList } from './ClassList';
import { HomeCards } from './HomeCards';
import { AdminHomeView } from './view';

export type AdminHomeProps = ScreenProps & {
  /** the classes the person may open, in order */
  grades: string[];
  /** the class that was open last */
  activeGrade?: string | null;
  /** which view to start on: the old code asks for the classes list when someone taps "الفصول" in the bar of a class */
  startView?: AdminHomeView;
  onOpenClass: (grade: string) => void;
  onOpenServants: () => void;
};

/**
 * The home of an admin (and of anyone who manages the servants as well as classes, so both cards always apply): two cards, "الفصول" and "الخدام".
 * "الفصول" lists every class; picking one opens that class with its tabs (the plain app takes over from there).
 * It reads nothing from the backend, so it opens at once.
 */
const AdminHome: FC<AdminHomeProps> = ({ grades, activeGrade, startView = AdminHomeView.Home, onOpenClass, onOpenServants }) => {
  const [view, setView] = useState<AdminHomeView>(startView);
  return (
    <Switch>
      <Case condition={view === AdminHomeView.Classes}>
        <ClassList grades={grades} activeGrade={activeGrade} onOpen={onOpenClass} onBack={() => setView(AdminHomeView.Home)} />
      </Case>
      <Default>
        <HomeCards onOpenClasses={() => setView(AdminHomeView.Classes)} onOpenServants={onOpenServants} />
      </Default>
    </Switch>
  );
};

export default AdminHome;
