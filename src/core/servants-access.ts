// May the signed-in person use the الخدام tab (servants attendance, list, profiles, join requests) in the section of THIS device?
// Admins always; others when one of their roles manages the servants of this section: خدام for the boys' account, خادمات for the girls'
// (docs/ROLES-DESIGN.md, "Servants block"). Reads the access loaded at sign-in; no Firestore.
import { canManageServants } from '@/core/access-config';
import { SECTION } from '@/core/section';
import { getUserManagedGrades } from '@/core/session';
import { state } from '@/core/state';

export function canUseServantsTab(): boolean {
  if (state.currentUserRole === 'admin') {
    return true;
  }
  return state.accessSource === 'roles' && !!state.access && canManageServants(state.access, SECTION === 'girls' ? 'girls' : 'boys');
}

/**
 * A manager of servants with NO class in this section (nothing in a class, only خدام / خادمات): the app has no class to show them, so it
 * opens straight on the الخدام tab and never offers the class tabs. Admins are never "classless": they can open any class.
 */
export function isClasslessManager(): boolean {
  return state.currentUserRole !== 'admin' && canUseServantsTab() && getUserManagedGrades().length === 0;
}

/**
 * Does this person start on the split home (cards "الفصول" and "الخدام") instead of straight inside one class? Everyone who can open
 * both the classes and the servants section: admins, and people whose roles manage the servants and also have a class. A manager
 * of servants with no class goes straight to الخدام (see above); everyone else is tied to their own class and sees no split.
 */
export function usesSplitHome(): boolean {
  return canUseServantsTab() && !isClasslessManager();
}
