// The admin's ID / password filters of the students tab (قايمة المخدومين): who has an ID, who has a password.
// Pure logic (no backend, no DOM) so it is tested on its own; the screen only calls it.

export enum CredFilter {
  All = 'all',
  Has = 'has',
  Missing = 'missing',
}

type KidLike = { id: string; kidId?: unknown };

/** A kid "has an ID" when `kidId` is a non-empty value (the import writes it once, it never changes). */
export function hasKidId(s: KidLike): boolean {
  return s.kidId != null && String(s.kidId).trim() !== '';
}

/**
 * Keeps the kids that match both filters.
 * `pwIds` = the ids of the kids that have a password (from `student_secrets`); `null` when it is not loaded,
 * and then the password filter is ignored (the screen loads it first, so this is only a safety net).
 * Combine them to answer: only ID (ID = has, password = missing), only password, both, neither.
 */
export function filterByCreds<T extends KidLike>(list: T[], idFilter: CredFilter, pwFilter: CredFilter, pwIds: Set<string> | null): T[] {
  return list.filter((s) => {
    if (idFilter === CredFilter.Has && !hasKidId(s)) {
      return false;
    }
    if (idFilter === CredFilter.Missing && hasKidId(s)) {
      return false;
    }
    if (pwIds) {
      const hasPw = pwIds.has(s.id);
      if (pwFilter === CredFilter.Has && !hasPw) {
        return false;
      }
      if (pwFilter === CredFilter.Missing && hasPw) {
        return false;
      }
    }
    return true;
  });
}
