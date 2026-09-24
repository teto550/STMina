import { gradeNumber, legacyAccess, resolveAccess, storedAccess } from '@/core/access';

describe('gradeNumber', () => {
  it('reads the grade from the class name', () => {
    expect(gradeNumber('سنة تالتة ابتدائي')).toBe(3);
    expect(gradeNumber('سنة أولى ابتدائي')).toBe(1);
    expect(gradeNumber('سنة سادسة ابتدائي')).toBe(6);
  });
  it('is null for anything else', () => {
    expect(gradeNumber(undefined)).toBeNull();
    expect(gradeNumber('غير معروف')).toBeNull();
  });
});

describe('legacyAccess (today\'s fields)', () => {
  it('gives a male servant the male cell of his class', () => {
    expect(legacyAccess({ role: 'deacon', gender: 'male', grade: 'سنة رابعة ابتدائي' })).toEqual({ admin: false, cells: ['male:4'], sections: ['boys'] });
  });
  it('adds the phase grades', () => {
    const a = legacyAccess({ role: 'deacon', gender: 'male', grade: 'سنة تالتة ابتدائي', phaseGrades: ['سنة رابعة ابتدائي'] });
    expect(a.cells).toEqual(['male:3', 'male:4']);
  });
  it('a servant of grade 1-2 gets both cells of the class and the girls section', () => {
    const a = legacyAccess({ role: 'deacon', gender: 'female', grade: 'سنة أولى ابتدائي' });
    expect(a).toEqual({ admin: false, cells: ['female:1', 'male:1'], sections: ['girls'] });
  });
  it('keeps admins as admins', () => expect(legacyAccess({ role: 'admin' }).admin).toBe(true));
  it('a servant with no class has no cells', () => expect(legacyAccess({ role: 'deacon' }).cells).toEqual([]));
});

describe('resolveAccess', () => {
  it('uses the stored snapshot when there is one', () => {
    const r = resolveAccess({ role: 'deacon', grade: 'سنة رابعة ابتدائي', access: { admin: false, cells: ['male:5'] } });
    expect(r.source).toBe('roles');
    expect(r.access.cells).toEqual(['male:5']);
  });
  it('ignores unusable cells in a snapshot', () => {
    expect(storedAccess({ access: { cells: ['male:9', 'nonsense', 'male:3'] } })?.cells).toEqual(['male:3']);
  });
  it('falls back to today\'s fields without a snapshot', () => {
    const r = resolveAccess({ role: 'deacon', gender: 'male', grade: 'سنة رابعة ابتدائي' });
    expect(r.source).toBe('legacy');
    expect(r.access.cells).toEqual(['male:4']);
  });
});
