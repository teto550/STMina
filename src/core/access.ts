// Turns what the account document says into an `Access` (docs/ROLES-DESIGN.md). Dual mode until the clean-up:
//  - the account has a role-based snapshot (`users.access`, written by the admin screen when a role is saved) -> use it;
//  - otherwise derive it from today's fields (admin flag, class, phase grades, gender), so nobody loses access.
// Pure functions: no Firestore, no DOM. Wiring into login is in features/auth/auth.ts.
import { cellOf, computeAccess, isMixedGrade, mixedGradeCells } from '@/core/access-config';
import type { Access, Cell, Gender, Grade, Role } from '@/types/access';

const GRADE_WORDS: ReadonlyArray<readonly [string, Grade]> = [
  ['أولى', 1], ['تانية', 2], ['ثانية', 2], ['تالتة', 3], ['ثالثة', 3], ['رابعة', 4], ['خامسة', 5], ['سادسة', 6],
];

/** 'سنة رابعة ابتدائي' -> 4 (null when the text is not a known grade). */
export function gradeNumber(name: string | null | undefined): Grade | null {
  const hit = GRADE_WORDS.find(([word]) => (name ?? '').includes(word));
  return hit ? hit[1] : null;
}

export interface AccountData {
  role?: string;
  gender?: string;
  grade?: string | null;
  phaseGrades?: string[] | null;
  isPhaseLead?: boolean;
  access?: { admin?: boolean; cells?: string[]; sections?: string[] } | null;
}

const asGender = (value: unknown): Gender => (value === 'female' ? 'female' : 'male');

function isCell(value: unknown): value is Cell {
  return typeof value === 'string' && /^(male|female):[1-6]$/.test(value);
}

/** The snapshot stored on the account by the admin screen, or null when there is none (or it is unusable). */
export function storedAccess(data: AccountData | null | undefined): Access | null {
  const snapshot = data?.access;
  if (!snapshot || !Array.isArray(snapshot.cells)) return null;
  const role: Role = { id: 'snapshot', name: 'snapshot', admin: snapshot.admin === true, cells: snapshot.cells.filter(isCell) };
  return computeAccess([role]);
}

/**
 * Access from today's fields: admin stays admin; a servant gets the cell(s) of their class (and of their phase's classes) in their
 * own gender; servants of grades 1-2 are female, so they also get the boys' cell of that mixed grade.
 */
export function legacyAccess(data: AccountData | null | undefined): Access {
  const gender = asGender(data?.gender);
  const grades = new Set<Grade>();
  const own = gradeNumber(data?.grade);
  if (own) grades.add(own);
  (data?.phaseGrades ?? []).forEach((name) => { const g = gradeNumber(name); if (g) grades.add(g); });
  const cells = [...grades].flatMap((grade) => (isMixedGrade(grade) ? mixedGradeCells(grade) : [cellOf(gender, grade)]));
  return computeAccess([{ id: 'legacy', name: 'legacy', admin: data?.role === 'admin', cells }]);
}

export type AccessSource = 'roles' | 'legacy';

/** The access to use for this account, and where it came from. */
export function resolveAccess(data: AccountData | null | undefined): { access: Access; source: AccessSource } {
  const stored = storedAccess(data);
  // an account that is an admin today stays an admin until the legacy flag is removed (no lock-out while both worlds exist)
  if (stored) return { access: { ...stored, admin: stored.admin || data?.role === 'admin' }, source: 'roles' };
  return { access: legacyAccess(data), source: 'legacy' };
}
