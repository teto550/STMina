// Who may add, edit and delete the parts of a class (توزيع الفقرات): an admin any class, and ANY servant of the class they are assigned to
// (by their roles' cells, or, for an old account without roles, by their own class). This is `canManageGrade`, the same rule the Firestore
// rules apply (`worksOnClass`, tools/rules-tests/parts-edit.mjs).
import { state } from '@/core/state';
import { canManageGrade } from '@/core/session';

const C4 = 'سنة رابعة ابتدائي';
const C5 = 'سنة خامسة ابتدائي';

const setState = (over: Record<string, unknown>) => Object.assign(state, {
  currentUserRole: 'deacon', accessSource: 'legacy', access: null, currentUserGrade: null,
  currentUserIsLead: false, currentUserIsPhaseLead: false, currentUserPhaseGrades: [], ...over,
});

afterEach(() => setState({}));

describe('who may work on the parts of a class', () => {
  it('an admin: any class', () => {
    setState({ currentUserRole: 'admin' });
    expect(canManageGrade(C4)).toBe(true);
    expect(canManageGrade(C5)).toBe(true);
  });

  it('a servant whose roles give them a class: that class, no other (not only a lead)', () => {
    setState({ accessSource: 'roles', access: { admin: false, cells: ['male:4'], sections: ['boys'], servants: [] } });
    expect(canManageGrade(C4)).toBe(true);
    expect(canManageGrade(C5)).toBe(false);
  });

  it('roles win over the old class field: a servant moved to class 5 by their roles cannot work on class 4 any more', () => {
    setState({ accessSource: 'roles', currentUserGrade: C4, access: { admin: false, cells: ['male:5'], sections: ['boys'], servants: [] } });
    expect(canManageGrade(C4)).toBe(false);
    expect(canManageGrade(C5)).toBe(true);
  });

  it('roles with no class yet: nothing', () => {
    setState({ accessSource: 'roles', access: { admin: false, cells: [], sections: ['boys'], servants: [] } });
    expect(canManageGrade(C4)).toBe(false);
  });

  it('an old account without roles: its own class (a lead or not)', () => {
    setState({ currentUserGrade: C4 });
    expect(canManageGrade(C4)).toBe(true);
    expect(canManageGrade(C5)).toBe(false);
  });

  it('no class open: nothing', () => {
    setState({ currentUserRole: 'admin' });
    expect(canManageGrade(null)).toBe(false);
  });
});
