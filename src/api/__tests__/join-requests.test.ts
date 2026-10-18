import { vi } from 'vitest';

const queryCalls: unknown[][] = [];
const docs = [
  { id: 'a', data: () => ({ name: 'A', status: 'pending', section: 'boys', grade: 'سنة رابعة ابتدائي' }) },
  { id: 'b', data: () => ({ name: 'B', status: 'pending', section: 'boys', grade: 'سنة خامسة ابتدائي' }) },
  { id: 'c', data: () => ({ name: 'C (no class)', status: 'pending', section: 'boys', grade: '' }) },
  { id: 'd', data: () => ({ name: 'D (girl)', status: 'pending', section: 'girls', grade: 'سنة رابعة ابتدائي' }) },
  { id: 'e', data: () => ({ name: 'E (old, no section)', status: 'pending', grade: 'سنة رابعة ابتدائي' }) },
];
vi.mock('@/core/firebase', () => ({ db: {} }));
vi.mock('@/core/access-link', () => ({ findApprovalPatch: vi.fn() }));
vi.mock('@/core/presence', () => ({ logActivity: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => name,
  where: (...a: unknown[]) => ['where', ...a],
  query: (...a: unknown[]) => { queryCalls.push(a); return 'q'; },
  getDocs: vi.fn(async () => ({ docs })),
  getDoc: vi.fn(), doc: vi.fn(), updateDoc: vi.fn(),
}));

import { fetchJoinRequests } from '@/api/join-requests';

beforeEach(() => { queryCalls.length = 0; });

const names = async (scope: Parameters<typeof fetchJoinRequests>[0]) => (await fetchJoinRequests(scope)).map((r) => r.id);

describe('fetchJoinRequests', () => {
  it('keeps the section, and the classes the reader manages (an old account without a section counts as boys)', async () => {
    expect(await names({ section: 'boys', grades: ['سنة رابعة ابتدائي'] })).toEqual(['a', 'e']);
    expect(await names({ section: 'girls', grades: [] })).toEqual(['d']);
  });

  it('requests that chose "no class" are only listed when asked for (admins and managers of servants)', async () => {
    expect(await names({ section: 'boys', grades: [] })).not.toContain('c');
    expect(await names({ section: 'boys', grades: ['سنة رابعة ابتدائي'], includeClassless: true })).toEqual(['a', 'c', 'e']);
  });

  it('a manager of servants limits the query itself to the section (the Firestore rules require it)', async () => {
    await fetchJoinRequests({ section: 'boys', grades: [], onlySection: true });
    expect(queryCalls[0]).toEqual(['users', ['where', 'status', '==', 'pending'], ['where', 'section', '==', 'boys']]);
    await fetchJoinRequests({ section: 'boys', grades: [] });
    expect(queryCalls[1]).toEqual(['users', ['where', 'status', '==', 'pending']]);
  });
});
