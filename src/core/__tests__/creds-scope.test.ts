import { gradeNum, scopeSheetRows } from '@/core/creds-scope';

describe('gradeNum', () => {
  it('reads digits and words', () => {
    expect(gradeNum('سنة 4')).toBe(4);
    expect(gradeNum('سنة رابعة ابتدائي')).toBe(4);
    expect(gradeNum('سنة تالتة ابتدائي')).toBe(3);
    expect(gradeNum('')).toBeNull();
  });
});

describe('scopeSheetRows (the rows that can belong to the open class)', () => {
  const rows = [
    { name: 'a', gender: 'ولد', grade: 'سنة 4' },
    { name: 'b', gender: 'بنت', grade: 'سنة 4' },
    { name: 'c', gender: 'ولد', grade: 'سنة 3' }, // an older sheet has everyone one year behind
    { name: 'd', gender: 'ولد', grade: 'سنة 6' },
    { name: 'e', gender: 'ولد', grade: 'سنة 2' },
    { name: 'f', gender: '', grade: '' },          // says nothing: the names decide
  ];

  it('keeps boys of the same or the previous year in the boys section', () => {
    expect(scopeSheetRows(rows, 'سنة رابعة ابتدائي', 'boys').map(r => r.name)).toEqual(['a', 'c', 'f']);
  });

  it('keeps girls in the girls section', () => {
    expect(scopeSheetRows(rows, 'سنة رابعة ابتدائي', 'girls').map(r => r.name)).toEqual(['b', 'f']);
  });

  it('a class with no year number keeps every year', () => {
    expect(scopeSheetRows(rows, 'غير معروف', 'boys').map(r => r.name)).toEqual(['a', 'c', 'd', 'e', 'f']);
  });
});
