// The admin's ID / password filters of the students tab (قايمة المخدومين): who has an ID, who has a password.
// Pure logic (no backend, no DOM) so it is tested on its own; the screen only calls it.

export enum CredFilter {
  All = 'all',
  Has = 'has',
  Missing = 'missing',
}

type KidLike = { id: string; kidId?: unknown; photoLink?: unknown };

/** A kid "has an ID" when `kidId` is a non-empty value (the import writes it once, it never changes). */
export function hasKidId(s: KidLike): boolean {
  return s.kidId != null && String(s.kidId).trim() !== '';
}

/** A kid "has a photo link" when `photoLink` (imported from the photo sheet, never changes) is a non-empty value. */
export function hasPhotoLink(s: KidLike): boolean {
  return s.photoLink != null && String(s.photoLink).trim() !== '';
}

/**
 * Keeps the kids that match the filters (ID, password, and the imported photo link).
 * `pwIds` = the ids of the kids that have a password (from `student_secrets`); `null` when it is not loaded,
 * and then the password filter is ignored (the screen loads it first, so this is only a safety net).
 * Combine them to answer: only ID (ID = has, password = missing), only password, both, neither.
 */
export function filterByCreds<T extends KidLike>(list: T[], idFilter: CredFilter, pwFilter: CredFilter, pwIds: Set<string> | null, photoFilter: CredFilter = CredFilter.All): T[] {
  return list.filter((s) => {
    if (photoFilter === CredFilter.Has && !hasPhotoLink(s)) {
      return false;
    }
    if (photoFilter === CredFilter.Missing && hasPhotoLink(s)) {
      return false;
    }
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
