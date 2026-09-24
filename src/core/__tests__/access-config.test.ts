import {
  canOpenSection, canSwitchSection, cellsOfSection, computeAccess, hasNoAccess, invalidCellsFor,
  isCellAllowedFor, mixedGradeCells, parseCell, sectionOfCell, startSectionOf,
} from '@/core/access-config';
import type { Role } from '@/types/access';

const role = (id: string, cells: Role['cells'], admin = false): Role => ({ id, name: id, admin, cells });

describe('cells and sections', () => {
  it('parses a cell', () => expect(parseCell('male:3')).toEqual({ gender: 'male', grade: 3 }));
  it('puts grades 1-2 (boys too) in the girls section', () => {
    expect(sectionOfCell('male:1')).toBe('girls');
    expect(sectionOfCell('female:2')).toBe('girls');
  });
  it('puts boys from grade 3 in the boys section and girls in the girls section', () => {
    expect(sectionOfCell('male:3')).toBe('boys');
    expect(sectionOfCell('female:3')).toBe('girls');
  });
  it('lists the cells a section shows', () => {
    expect(cellsOfSection('boys')).toEqual(['male:3', 'male:4', 'male:5', 'male:6']);
    expect(cellsOfSection('girls')).toContain('male:1');
    expect(cellsOfSection('girls')).not.toContain('male:3');
    expect(cellsOfSection('girls')).toHaveLength(10);
  });
  it('gives the linked pair of a mixed grade', () => expect(mixedGradeCells(1)).toEqual(['female:1', 'male:1']));
});

describe('servant gender rules', () => {
  it('a servant may only hold cells of their own gender', () => {
    expect(isCellAllowedFor('male', 'male:4')).toBe(true);
    expect(isCellAllowedFor('male', 'female:4')).toBe(false);
  });
  it('servants of grades 1-2 must be female', () => {
    expect(isCellAllowedFor('female', 'male:1')).toBe(true);
    expect(isCellAllowedFor('male', 'female:1')).toBe(false);
    expect(isCellAllowedFor('male', 'male:2')).toBe(false);
  });
  it('lists the cells a person may not hold', () => {
    expect(invalidCellsFor('male', [role('a', ['male:3', 'female:4'])])).toEqual(['female:4']);
  });
});

describe('access', () => {
  it('is the union of the roles', () => {
    const a = computeAccess([role('a', ['male:3']), role('b', ['male:3', 'male:4'])]);
    expect(a).toEqual({ admin: false, cells: ['male:3', 'male:4'], sections: ['boys'] });
  });
  it('an admin role makes the person an admin', () => expect(computeAccess([role('x', [], true)]).admin).toBe(true));
  it('starts in the section of the gender', () => {
    expect(startSectionOf('male')).toBe('boys');
    expect(startSectionOf('female')).toBe('girls');
  });
  it('grades 1-2 do not count as mixed', () => {
    expect(canSwitchSection(computeAccess([role('a', ['female:1', 'male:1', 'female:3'])]))).toBe(false);
  });
  it('boys and girls classes together allow switching', () => {
    expect(canSwitchSection(computeAccess([role('a', ['male:3']), role('b', ['female:3'])]))).toBe(true);
  });
  it('admins can switch and open any section', () => {
    const a = computeAccess([role('admin', [], true)]);
    expect(canSwitchSection(a)).toBe(true);
    expect(canOpenSection(a, 'girls')).toBe(true);
  });
  it('a servant can open only their own section', () => {
    const a = computeAccess([role('a', ['male:3'])]);
    expect(canOpenSection(a, 'boys')).toBe(true);
    expect(canOpenSection(a, 'girls')).toBe(false);
  });
  it('no role = no access', () => {
    expect(hasNoAccess(computeAccess([]))).toBe(true);
    expect(hasNoAccess(computeAccess([role('a', ['male:3'])]))).toBe(false);
  });
});
