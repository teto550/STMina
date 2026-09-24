// Classes, sections and the rules that turn roles into access (docs/ROLES-DESIGN.md). Pure functions, no Firestore, no DOM.
import type { Access, Cell, Gender, Grade, Person, Role, Section } from '@/types/access';

export const GRADES: readonly Grade[] = [1, 2, 3, 4, 5, 6];

/** Grades whose kids (boys and girls) are in ONE class in the girls' section, with female servants only. */
export const MIXED_GRADES: readonly Grade[] = [1, 2];

export const isMixedGrade = (grade: Grade): boolean => MIXED_GRADES.includes(grade);

export const cellOf = (gender: Gender, grade: Grade): Cell => `${gender}:${grade}`;

export function parseCell(cell: Cell): { gender: Gender; grade: Grade } {
  const [gender, grade] = cell.split(':');
  return { gender: gender as Gender, grade: Number(grade) as Grade };
}

export const sectionOfGender = (gender: Gender): Section => (gender === 'female' ? 'girls' : 'boys');
export const genderOfSection = (section: Section): Gender => (section === 'girls' ? 'female' : 'male');

/** Section of a class (a kid's cell, or a servant's role cell): grades 1-2 are always the girls' section. */
export function sectionOfCell(cell: Cell): Section {
  const { gender, grade } = parseCell(cell);
  return isMixedGrade(grade) ? 'girls' : sectionOfGender(gender);
}

/** The cells a section shows: girls = female 1-6 plus the boys of the mixed grades; boys = male 3-6. */
export function cellsOfSection(section: Section): Cell[] {
  return GRADES.flatMap((grade) => {
    if (isMixedGrade(grade)) return section === 'girls' ? [cellOf('female', grade), cellOf('male', grade)] : [];
    return [cellOf(genderOfSection(section), grade)];
  });
}

/** The two cells a role gets when the admin ticks the single "girls and boys" checkbox of a mixed grade. */
export const mixedGradeCells = (grade: Grade): Cell[] => [cellOf('female', grade), cellOf('male', grade)];

/**
 * A servant's cell must match the servant's gender, except the boys' cell of a mixed grade, which is the (female-served) class of
 * the little boys. Servants of a mixed grade must be female.
 */
export function isCellAllowedFor(gender: Gender, cell: Cell): boolean {
  const { gender: cellGender, grade } = parseCell(cell);
  if (isMixedGrade(grade)) return gender === 'female';
  return cellGender === gender;
}

/** Cells of the given roles that the person may not hold (empty = fine). Admin roles have no cells. */
export function invalidCellsFor(gender: Gender, roles: Role[]): Cell[] {
  return roles.flatMap((role) => role.cells).filter((cell) => !isCellAllowedFor(gender, cell));
}

/** Access of a person = the union of their roles. */
export function computeAccess(roles: Role[]): Access {
  const cells = [...new Set(roles.flatMap((role) => role.cells))].sort() as Cell[];
  const sections = [...new Set(cells.map(sectionOfCell))].sort() as Section[];
  return { admin: roles.some((role) => role.admin), cells, sections };
}

/** The roles of a person, looked up in the full list of roles (unknown ids are ignored). */
export const rolesOf = (person: Pick<Person, 'roleIds'>, allRoles: Role[]): Role[] =>
  allRoles.filter((role) => person.roleIds.includes(role.id));

/** The section a person starts in after login: by their gender (admins too). */
export const startSectionOf = (gender: Gender): Section => sectionOfGender(gender);

/** The "switch section" menu is for admins and for people whose roles span both sections (grades 1-2 do not count as mixed). */
export const canSwitchSection = (access: Access): boolean => access.admin || access.sections.length > 1;

/** May this person open the given section? Admins any; others only sections where they have a class. */
export const canOpenSection = (access: Access, section: Section): boolean => access.admin || access.sections.includes(section);

/** A person with no role at all sees the "no access yet" screen. */
export const hasNoAccess = (access: Access): boolean => !access.admin && access.cells.length === 0;
