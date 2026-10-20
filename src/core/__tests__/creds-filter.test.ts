import { CredFilter, filterByCreds, hasKidId, hasPhotoLink } from '@/core/creds-filter';

describe('hasKidId', () => {
  it('is true only for a non-empty ID', () => {
    expect(hasKidId({ id: 'a', kidId: '123' })).toBe(true);
    expect(hasKidId({ id: 'a', kidId: 456 })).toBe(true);
    expect(hasKidId({ id: 'a', kidId: '' })).toBe(false);
    expect(hasKidId({ id: 'a', kidId: '  ' })).toBe(false);
    expect(hasKidId({ id: 'a', kidId: null })).toBe(false);
    expect(hasKidId({ id: 'a' })).toBe(false);
  });
});

describe('filterByCreds (admin ID / password filters of the students tab)', () => {
  const kids = [
    { id: 'both', kidId: '1' },
    { id: 'idOnly', kidId: '2' },
    { id: 'pwOnly', kidId: '' },
    { id: 'neither' },
  ];
  const pwIds = new Set(['both', 'pwOnly']);
  const ids = (list: { id: string }[]) => list.map((s) => s.id);

  it('shows everyone when both filters are off', () => {
    expect(ids(filterByCreds(kids, CredFilter.All, CredFilter.All, pwIds))).toEqual(['both', 'idOnly', 'pwOnly', 'neither']);
  });

  it('ID filter: has / missing', () => {
    expect(ids(filterByCreds(kids, CredFilter.Has, CredFilter.All, pwIds))).toEqual(['both', 'idOnly']);
    expect(ids(filterByCreds(kids, CredFilter.Missing, CredFilter.All, pwIds))).toEqual(['pwOnly', 'neither']);
  });

  it('password filter: has / missing', () => {
    expect(ids(filterByCreds(kids, CredFilter.All, CredFilter.Has, pwIds))).toEqual(['both', 'pwOnly']);
    expect(ids(filterByCreds(kids, CredFilter.All, CredFilter.Missing, pwIds))).toEqual(['idOnly', 'neither']);
  });

  it('combines: ID only, password only, both, neither', () => {
    expect(ids(filterByCreds(kids, CredFilter.Has, CredFilter.Missing, pwIds))).toEqual(['idOnly']);
    expect(ids(filterByCreds(kids, CredFilter.Missing, CredFilter.Has, pwIds))).toEqual(['pwOnly']);
    expect(ids(filterByCreds(kids, CredFilter.Has, CredFilter.Has, pwIds))).toEqual(['both']);
    expect(ids(filterByCreds(kids, CredFilter.Missing, CredFilter.Missing, pwIds))).toEqual(['neither']);
  });

  it('ignores the password filter while the passwords are not loaded', () => {
    expect(ids(filterByCreds(kids, CredFilter.All, CredFilter.Has, null))).toEqual(['both', 'idOnly', 'pwOnly', 'neither']);
    expect(ids(filterByCreds(kids, CredFilter.Has, CredFilter.Has, null))).toEqual(['both', 'idOnly']);
  });
});

describe('photo-link filter', () => {
  const kids = [{ id: 'a', photoLink: 'https://x/a.jpg' }, { id: 'b', photoLink: '' }, { id: 'c' }];
  it('hasPhotoLink is true only for a non-empty link', () => {
    expect(kids.map(hasPhotoLink)).toEqual([true, false, false]);
  });
  it('keeps who has / who lacks a link, and combines with the other filters', () => {
    expect(filterByCreds(kids, CredFilter.All, CredFilter.All, null, CredFilter.Has).map((k) => k.id)).toEqual(['a']);
    expect(filterByCreds(kids, CredFilter.All, CredFilter.All, null, CredFilter.Missing).map((k) => k.id)).toEqual(['b', 'c']);
    expect(filterByCreds(kids, CredFilter.All, CredFilter.All, null).length).toBe(3);
  });
});
