vi.mock('@/core/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ collection: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(), query: vi.fn(), where: vi.fn() }));
import { approvalPatch, pickPerson } from '@/core/access-link';

const people = [
  { id: 'p1', name: 'مينا باسم', email: 'mina@x.com', section: 'boys', roleIds: ['b3'] },
  { id: 'p2', name: 'ماريا', section: 'girls' },
  { id: 'p3', name: 'ماريا', section: 'boys' },
];

describe('pickPerson', () => {
  it('uses the recorded link first', () => expect(pickPerson({ deaconId: 'p2', name: 'x' }, people)?.id).toBe('p2'));
  it('matches the email (case-insensitive)', () => expect(pickPerson({ email: 'MINA@x.com' }, people)?.id).toBe('p1'));
  it('matches the name within the same section, only when unique', () => {
    expect(pickPerson({ name: ' ماريا ', section: 'girls' }, people)?.id).toBe('p2');
    expect(pickPerson({ name: 'ماريا' }, people)?.id).toBe('p3');
  });
  it('finds nobody rather than guessing', () => {
    expect(pickPerson({ name: 'غير موجود' }, people)).toBeNull();
    expect(pickPerson({ name: 'ماريا', section: 'girls' }, [...people, { id: 'p4', name: 'ماريا', section: 'girls' }])).toBeNull();
  });
});

describe('approvalPatch', () => {
  it('nothing without a person', () => expect(approvalPatch(null, [])).toEqual({}));
  it('only the link when the person has no roles yet', () => expect(approvalPatch(people[0]!, [])).toEqual({ deaconId: 'p1' }));
  it('link + access snapshot from the roles', () => {
    expect(approvalPatch(people[0]!, [{ admin: false, cells: ['male:3'] }])).toEqual({ deaconId: 'p1', access: { admin: false, cells: ['male:3'], sections: ['boys'] } });
  });
  it('an admin role also makes the account an admin (what the security rules read)', () => {
    expect(approvalPatch(people[0]!, [{ admin: true, cells: [] }])).toMatchObject({ role: 'admin', access: { admin: true } });
  });
});
