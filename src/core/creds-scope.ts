// Which rows of the credentials sheet belong to the class being filled: the rules of the "رفع ID والباسورد" screen, kept here so they can be tested.
// The IDs and passwords it writes are PERMANENT, so the screen only looks at the class that is open and at the sheet rows that can be its kids.

export interface SheetRowLike {
  grade?: unknown;
  gender?: unknown;
}

/** The year number of a grade written either as digits ("سنة 4") or in words ("سنة رابعة ابتدائي"); null when it says none. */
export function gradeNum(g: unknown): number | null {
  const str = String(g ?? '');
  const d = str.match(/\d+/);
  if (d) {
    return +d[0];
  }
  if (/(اول|أول)/.test(str)) {
    return 1;
  }
  if (/(تاني|ثاني)/.test(str)) {
    return 2;
  }
  if (/(تالت|ثالث)/.test(str)) {
    return 3;
  }
  if (/رابع/.test(str)) {
    return 4;
  }
  if (/خامس/.test(str)) {
    return 5;
  }
  if (/سادس/.test(str)) {
    return 6;
  }
  return null;
}

/** The sheet's gender word of each section: the boys' section is "ولد", the girls' is "بنت". */
export const SECTION_GENDER: Record<string, string> = { boys: 'ولد', girls: 'بنت' };

/**
 * Keeps the sheet rows that can belong to this class of this section: the same gender (when the sheet says it), and the same year number
 * or the one before it (an older sheet has everyone one year behind). A row that says no year or no gender is kept: the names decide.
 */
export function scopeSheetRows<T extends SheetRowLike>(rows: T[], appGrade: string, section: string): T[] {
  const appNum = gradeNum(appGrade);
  const gender = SECTION_GENDER[section];
  return rows.filter((r) => {
    const rowGender = String(r.gender ?? '').trim();
    if (gender && rowGender && rowGender !== gender) {
      return false;
    }
    const n = gradeNum(r.grade);
    return appNum == null || n == null || n === appNum || n === appNum - 1;
  });
}
