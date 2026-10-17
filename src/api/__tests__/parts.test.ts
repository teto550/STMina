import { vi } from 'vitest';

const addDoc = vi.fn(async (..._a: unknown[]) => ({ id: 'new1' }));
const updateDoc = vi.fn(async (..._a: unknown[]) => undefined);
const deleteDoc = vi.fn(async (..._a: unknown[]) => undefined);
const post = vi.fn(async (..._a: unknown[]) => ({}));
const getDocsFast = vi.fn();
vi.hoisted(() => vi.stubEnv('VITE_PUSH_WORKER_URL', 'https://push.example.test')); // read when the module loads
vi.mock('@/core/firebase', () => ({ db: {}, auth: { currentUser: { getIdToken: async () => 'tok' } } }));
vi.mock('@/core/firestore-helpers', () => ({ getDocsFast: (...a: unknown[]) => getDocsFast(...a) }));
vi.mock('@/core/http', () => ({ http: { post: (...a: unknown[]) => post(...a) }, workerUrl: (b: string, p: string) => b + p }));
vi.mock('@/core/servants-index', () => ({ deaconIdOfName: (name: string) => (name === 'مينا' ? 'p1' : null) }));
vi.mock('firebase/firestore', () => ({
  addDoc: (...a: unknown[]) => addDoc(...a), updateDoc: (...a: unknown[]) => updateDoc(...a), deleteDoc: (...a: unknown[]) => deleteDoc(...a),
  collection: (_d: unknown, n: string) => n, doc: (_d: unknown, n: string, id: string) => `${n}/${id}`, query: (...a: unknown[]) => a, where: (...a: unknown[]) => a,
  serverTimestamp: () => 'TS',
}));

import { createPart, deletePart, fetchParts, updatePart, type Part } from '@/api/parts';

beforeEach(() => {
  addDoc.mockClear(); updateDoc.mockClear(); deleteDoc.mockClear(); post.mockClear(); getDocsFast.mockReset();
});
const by = { uid: 'u1', name: 'المسؤول' };
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('fetchParts', () => {
  it('keeps this section (old documents without a section are boys) and sorts newest first', async () => {
    const doc = (id: string, d: Record<string, unknown>) => ({ id, data: () => d });
    getDocsFast.mockResolvedValue({ docs: [doc('a', { section: 'boys', createdAt: { seconds: 1 } }), doc('b', { section: 'girls' }), doc('c', { createdAt: { seconds: 5 } })] });
    expect((await fetchParts('g', 'boys')).map((p) => p.id)).toEqual(['c', 'a']);
  });
});

describe('createPart', () => {
  it('a part with only a title and a day: no type, no servant, nobody is told', async () => {
    const part = await createPart({ grade: 'g4', section: 'boys', input: { type: '', title: 'ترنيمة', date: '2026-10-19', deaconName: '' }, by });
    expect(addDoc.mock.calls[0]![1]).toMatchObject({ grade: 'g4', type: '', deaconName: '', deaconId: null, title: 'ترنيمة', date: '2026-10-19', section: 'boys', createdByUid: 'u1' });
    expect(part).toMatchObject({ id: 'new1', title: 'ترنيمة', date: '2026-10-19' });
    await tick();
    expect(post).not.toHaveBeenCalled();
  });

  it('with a servant: the id of the servant is stored and they get a push (a part without a type is announced as "فقرة")', async () => {
    await createPart({ grade: 'g4', section: 'boys', input: { type: '', title: 'درس', date: '2026-10-19', deaconName: 'مينا' }, by });
    expect(addDoc.mock.calls[0]![1]).toMatchObject({ deaconName: 'مينا', deaconId: 'p1' });
    await tick();
    expect(post).toHaveBeenCalledWith('https://push.example.test/new-part', { deaconName: 'مينا', type: 'فقرة', title: 'درس', date: '2026-10-19', grade: 'g4' }, expect.anything());
  });

  it('a failing push never fails the save', async () => {
    post.mockRejectedValueOnce(new Error('worker down'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(createPart({ grade: 'g4', section: 'boys', input: { type: 'الدرس', title: 'x', date: '2026-10-19', deaconName: 'مينا' }, by })).resolves.toBeTruthy();
  });
});

describe('updatePart', () => {
  const before: Part = { id: 'p9', grade: 'g4', type: '', title: 'ترنيمة', date: '2026-10-19', deaconName: '' };

  it('gives a part its type and servant later: only those fields are written, and the new servant is told', async () => {
    const saved = await updatePart({ before, section: 'boys', input: { type: 'الترانيم', title: 'ترنيمة', date: '2026-10-19', deaconName: 'مينا' } });
    expect(updateDoc.mock.calls[0]![0]).toBe('parts_distribution/p9');
    expect(Object.keys(updateDoc.mock.calls[0]![1] as object).sort()).toEqual(['date', 'deaconId', 'deaconName', 'title', 'type', 'updatedAt']);
    expect(saved).toMatchObject({ type: 'الترانيم', deaconName: 'مينا', deaconId: 'p1', grade: 'g4' });
    await tick();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('nobody is told again when the servant stays the same, or is taken off', async () => {
    await updatePart({ before: { ...before, deaconName: 'مينا' }, section: 'boys', input: { type: 'الدرس', title: 'ترنيمة', date: '2026-10-19', deaconName: 'مينا' } });
    await updatePart({ before: { ...before, deaconName: 'مينا' }, section: 'boys', input: { type: '', title: 'ترنيمة', date: '2026-10-19', deaconName: '' } });
    await tick();
    expect(post).not.toHaveBeenCalled();
  });
});

describe('deletePart', () => {
  it('deletes the document', async () => {
    await deletePart('p9');
    expect(deleteDoc).toHaveBeenCalledWith('parts_distribution/p9');
  });
});
