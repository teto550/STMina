export interface Rule {
  title: string;
  /** a fixed day of the Coptic calendar: [month 1-13, day] */
  coptic?: [number, number];
  /** days after Easter (negative = before) */
  easter?: number;
  /** the same Gregorian day every year: [month 1-12, day] */
  gregorian?: [number, number];
}
export interface GeneratedOccasion {
  title: string;
  date: string;
  note: string;
}
export const RULES: Rule[];
export function copticToGregorian(year: number, month: number, day: number): Date;
export function orthodoxEaster(year: number): Date;
export function occasionsForYear(year: number, rules?: Rule[]): GeneratedOccasion[];
export function occasionsForYears(years: number[], options?: { from?: string }): GeneratedOccasion[];
