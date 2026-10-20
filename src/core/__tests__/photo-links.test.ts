import { buildPhotoPlan, parsePhotoSheet } from '@/core/photo-links';

const fb = (n: string) => `https://firebasestorage.googleapis.com/v0/b/x/o/${n}.jpg?alt=media&token=t`;
const row = (kidId: string, url: string, line = 2) => ({ line, kidId, url });

describe('parsePhotoSheet', () => {
  it('finds the columns by header name and turns numeric IDs into text', () => {
    const p = parsePhotoSheet([[['AVATAR_FULL_URL', 'SERIAL_NUMBER'], [fb('a'), 26076], [null, null]]]);
    expect(p?.rows).toEqual([{ line: 2, kidId: '26076', url: fb('a') }]);
  });
  it('returns null when there is no ID column', () => {
    expect(parsePhotoSheet([[['name', 'x'], ['a', 'b']]])).toBeNull();
  });
});

describe('buildPhotoPlan', () => {
  const kids = [{ id: 's1', name: 'A', kidId: '100' }, { id: 's2', name: 'B', kidId: '200', photoLink: fb('old') }, { id: 's3', name: 'C', kidId: '300', photoLink: fb('c') }];

  it('writes only to the kid with the same ID, never overwrites a stored link', () => {
    const p = buildPhotoPlan([row('100', fb('a')), row('200', fb('new')), row('300', fb('c')), row('999', fb('z'))], kids);
    expect(p.writes).toEqual([{ studentId: 's1', name: 'A', kidId: '100', url: fb('a') }]);
    expect(p.lockedDifferent.map((x) => x.kidId)).toEqual(['200']);
    expect(p.same).toBe(1);
    expect(p.notFound).toEqual(['999']);
  });
  it('reports bad rows instead of guessing', () => {
    const p = buildPhotoPlan([row('', fb('a')), row('100', ''), row('100', 'http://x.com/a.jpg')], kids);
    expect(p.badRows.map((b) => b.reason)).toEqual(['مفيش ID', 'مفيش لينك', 'اللينك مش https صالح']);
    expect(p.writes).toEqual([]);
  });
  it('holds back a link shared by several IDs until the admin accepts it', () => {
    const shared = 'https://i.imgur.com/o58tRVp.jpg';
    const two = [{ id: 's1', kidId: 'mk1' }, { id: 's2', kidId: 'mk2' }];
    const rows = [row('mk1', shared), row('mk2', shared)];
    expect(buildPhotoPlan(rows, two).doubtful.map((d) => d.reason)).toEqual(['sharedUrl', 'sharedUrl']);
    expect(buildPhotoPlan(rows, two).writes).toEqual([]);
    expect(buildPhotoPlan(rows, two, new Set(['mk1'])).writes.map((w) => w.kidId)).toEqual(['mk1']);
  });
  it('never writes an ID that has two different links in the sheet', () => {
    const p = buildPhotoPlan([row('100', fb('a')), row('100', fb('b'))], kids, new Set(['100']));
    expect(p.writes).toEqual([]);
    expect(p.doubtful[0]).toMatchObject({ reason: 'sameIdTwoUrls', approvable: false });
  });
  it('skips an ID that belongs to two kids', () => {
    const p = buildPhotoPlan([row('100', fb('a'))], [...kids, { id: 's9', name: 'Z', kidId: '100' }]);
    expect(p.duplicateKids).toHaveLength(1);
    expect(p.writes).toEqual([]);
  });
  it('flags an unknown host', () => {
    const p = buildPhotoPlan([row('100', 'https://example.org/a.jpg')], kids);
    expect(p.doubtful[0]?.reason).toBe('unknownHost');
  });
});
