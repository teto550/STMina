import { BAD_FIELDS, badKeysOf, badLabelsOf, badValueOf, hasBadData } from '@/core/bad-data';

describe('badKeysOf', () => {
  it('keeps only valid keys, in the order of BAD_FIELDS', () => {
    expect(badKeysOf({ badFields: ['mother', 'name', 'nonsense'] })).toEqual(['name', 'mother']);
  });

  it('is empty when nothing is marked or the value is malformed', () => {
    expect(badKeysOf({})).toEqual([]);
    expect(badKeysOf(null)).toEqual([]);
    expect(badKeysOf({ badFields: 'name' })).toEqual([]);
    expect(badKeysOf({ badFields: [] })).toEqual([]);
  });
});

describe('badLabelsOf / hasBadData', () => {
  it('gives the Arabic labels of the marked fields', () => {
    expect(badLabelsOf({ badFields: ['father', 'address'] })).toEqual(['العنوان', 'تليفون الأب']);
  });

  it('flags a student only when at least one valid field is marked', () => {
    expect(hasBadData({ badFields: ['dob'] })).toBe(true);
    expect(hasBadData({ badFields: ['x'] })).toBe(false);
    expect(hasBadData(undefined)).toBe(false);
  });
});

describe('badValueOf', () => {
  const s = { name: 'مينا', dob: '2016-05-01', address: 'شارع ١', phoneDad: '0100', phoneMom: '0111', phoneStudent: '', confessor: 'أبونا' };

  it('reads each key from the matching property of the student', () => {
    expect(badValueOf(s, 'name')).toBe('مينا');
    expect(badValueOf(s, 'father')).toBe('0100');
    expect(badValueOf(s, 'mother')).toBe('0111');
    expect(badValueOf(s, 'student')).toBe('');
    expect(badValueOf(s, 'confessor')).toBe('أبونا');
  });

  it('returns an empty string when the property is missing', () => {
    expect(badValueOf({}, 'dob')).toBe('');
  });

  it('covers every field in BAD_FIELDS with a unique key', () => {
    expect(new Set(BAD_FIELDS.map((f) => f.key)).size).toBe(BAD_FIELDS.length);
  });
});
