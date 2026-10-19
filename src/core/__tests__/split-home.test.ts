import { state } from '@/core/state';
import { usesSplitHome } from '@/core/servants-access';
import type { Access } from '@/types/access';

const access = (over: Partial<Access>): Access => ({ admin: false, cells: [], sections: ['boys'], servants: [], ...over });
const asRoles = (a: Access) => {
  state.currentUserRole = 'deacon';
  state.accessSource = 'roles';
  state.access = a;
};

afterEach(() => {
  state.currentUserRole = null;
  state.accessSource = null;
  state.access = null;
});

describe('usesSplitHome (who starts on the cards الفصول | الخدام)', () => {
  it('an admin does', () => {
    state.currentUserRole = 'admin';
    expect(usesSplitHome()).toBe(true);
  });

  it('a manager of the boys servants who also has a class does', () => {
    asRoles(access({ cells: ['male:3'], servants: ['male'] }));
    expect(usesSplitHome()).toBe(true);
  });

  it('a manager of servants with no class does not (they go straight to الخدام)', () => {
    asRoles(access({ cells: [], servants: ['male'] }));
    expect(usesSplitHome()).toBe(false);
  });

  it('a servant with a class but no servants section does not', () => {
    asRoles(access({ cells: ['male:4'], servants: [] }));
    expect(usesSplitHome()).toBe(false);
  });

  it('someone who is not signed in does not', () => {
    expect(usesSplitHome()).toBe(false);
  });
});
