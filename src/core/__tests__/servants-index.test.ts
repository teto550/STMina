import { state } from '@/core/state';
import { deaconIdOfName, deaconNameOf, isDeaconOf } from '@/core/servants-index';

beforeEach(() => {
  state.ALL_DEACONS_RAW = [
    { id: 'p1', name: 'مينا عادل', section: 'boys' },
    { id: 'p2', name: 'ماريا', section: 'girls' },
    { id: 'p3', name: 'ماريا', section: 'boys' },
  ];
});

describe('servants index', () => {
  it('shows the current name of the servant an id points to (even if the stored name is old)', () => {
    expect(deaconNameOf({ deaconId: 'p1', deacon: 'مينا باسم' })).toBe('مينا عادل');
  });
  it('falls back to the stored name without an id, or when the id is unknown', () => {
    expect(deaconNameOf({ deacon: 'رويس' })).toBe('رويس');
    expect(deaconNameOf({ deaconId: 'zzz', deacon: 'رويس' })).toBe('رويس');
    expect(deaconNameOf(null)).toBe('');
  });
  it('isDeaconOf compares the resolved name', () => {
    expect(isDeaconOf({ deaconId: 'p1', deacon: 'مينا باسم' }, 'مينا عادل')).toBe(true);
    expect(isDeaconOf({ deacon: 'رويس' }, '')).toBe(false);
  });
  it('finds the id of a name within a section, only when unique', () => {
    expect(deaconIdOfName(' مينا  عادل ', 'boys')).toBe('p1');
    expect(deaconIdOfName('ماريا', 'girls')).toBe('p2');
    expect(deaconIdOfName('غير موجود', 'boys')).toBeNull();
    state.ALL_DEACONS_RAW.push({ id: 'p4', name: 'ماريا', section: 'girls' });
    expect(deaconIdOfName('ماريا', 'girls')).toBeNull();
  });
  it('picks up a rename of the roster entry in memory', () => {
    state.ALL_DEACONS_RAW[0]!.name = 'مينا سامي';
    expect(deaconNameOf({ deaconId: 'p1' })).toBe('مينا سامي');
  });
});
