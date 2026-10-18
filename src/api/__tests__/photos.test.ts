import { vi } from 'vitest';

const updateDoc = vi.fn(async (..._a: unknown[]) => undefined);
vi.mock('@/core/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: (_d: unknown, c: string, id: string) => `${c}/${id}`, updateDoc: (...a: unknown[]) => updateDoc(...a) }));

import { parsePhotoTarget, savePhoto } from '@/api/photos';

describe('parsePhotoTarget', () => {
  it('reads kind and id (the id may contain colons)', () => {
    expect(parsePhotoTarget('student:abc')).toEqual({ kind: 'student', id: 'abc' });
    expect(parsePhotoTarget('servant:u:1')).toEqual({ kind: 'servant', id: 'u:1' });
  });

  it('rejects anything else', () => {
    expect(parsePhotoTarget(undefined)).toBeNull();
    expect(parsePhotoTarget('')).toBeNull();
    expect(parsePhotoTarget('teacher:1')).toBeNull();
    expect(parsePhotoTarget('student:')).toBeNull();
    expect(parsePhotoTarget('nocolon')).toBeNull();
  });
});

describe('savePhoto', () => {
  beforeEach(() => updateDoc.mockClear());

  it('writes the photo of a kid to students/{id}: one write', async () => {
    await savePhoto({ kind: 'student', id: 's1' }, 'data:image/jpeg;base64,AA');
    expect(updateDoc).toHaveBeenCalledTimes(1);
    expect(updateDoc).toHaveBeenCalledWith('students/s1', { photo: 'data:image/jpeg;base64,AA' });
  });

  it('writes the photo of a servant to users/{uid}, and "" deletes it', async () => {
    await savePhoto({ kind: 'servant', id: 'u9' }, '');
    expect(updateDoc).toHaveBeenCalledWith('users/u9', { photo: '' });
  });
});
