// @ts-nocheck
import { vi } from 'vitest';

vi.mock('@/core/firebase', () => ({ db: {}, auth: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({ id: 'doc-1' })),
  setDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => 'ts'),
}));
vi.mock('@/api/preferences', () => ({ getPreferences: () => ({ focusSearchAfterMark: false }) }));
vi.mock('@/core/presence', () => ({ logActivity: vi.fn() }));
vi.mock('@/core/firestore-helpers', () => ({ getDocsTtl: vi.fn() }));
vi.mock('@/core/servants-index', () => ({ deaconIdOfName: () => 'id' }));
vi.mock('@/features/servants/deacons', () => ({ DEACON_ADMIN_MAP: {} }));
vi.mock('@/features/import-export/import-attendance', () => ({ nameMatchesSearch: (n, q) => n.includes(q) }));
vi.mock('@/core/section', () => ({ GRADES: ['فصل أ', 'فصل ب'], inCurrentSection: () => true, sectionTag: () => 'boys' }));
vi.mock('@/core/session', () => ({ getUserManagedGrades: () => ['فصل أ', 'فصل ب'] }));
vi.mock('@/core/servants-access', () => ({ canUseServantsTab: () => false }));

import { state } from '@/core/state';

const DOM = `
  <div id="online-att-picker"></div><input id="online-att-search"><span id="online-att-count"></span>
  <span id="online-att-count-label"></span><span id="online-att-type-label"></span><span id="online-att-today-label"></span>
  <div id="sd-att-picker"></div><span id="sd-att-today-count"></span><span id="sd-att-count-label"></span>
  <div id="sd-type-tabs"><button class="tab active" id="sd-type-btn-sunday"></button><button class="tab" id="sd-type-btn-meeting"></button></div>
  <div id="online-type-tabs"><button class="tab active" id="online-type-btn-sunday"></button><button class="tab" id="online-type-btn-meeting"></button></div>
  <div id="deacon-att-dates-list"></div>`;

describe('attendance of the servants inside the متابعة tab', () => {
  beforeEach(async () => {
    document.body.innerHTML = DOM;
    window.showToast = vi.fn();
    state.currentUserRole = 'admin';
    state.activeGrade = 'فصل أ';
    state.ALL_DEACONS_RAW = [
      { name: 'مينا', grade: 'فصل أ' },
      { name: 'بيتر', grade: 'فصل أ' },
      { name: 'كيرلس', grade: 'فصل ب' },
    ];
    await import('@/features/servants/deacon-attendance');
  });

  it('lists only the servants of the class you are in', () => {
    window.renderOnlineAttPicker();
    const names = [...document.querySelectorAll('#online-att-picker .manual-result-name')].map(n => n.textContent);
    expect(names.sort()).toEqual(['بيتر', 'مينا'].sort());
  });

  it('marking one present updates the count here and the list of خانة الخدام too', async () => {
    window.renderOnlineAttPicker();
    await window.onlineDeaconToggleAttendance('مينا');
    expect(document.getElementById('online-att-count').textContent).toBe('1');
    // the other place shows the same servant as present
    expect(document.querySelector('#sd-att-picker .manual-result-item.already .manual-result-name').textContent).toBe('مينا');
    // and tapping again undoes it in both
    await window.onlineDeaconToggleAttendance('مينا');
    expect(document.getElementById('online-att-count').textContent).toBe('0');
    expect(document.querySelector('#sd-att-picker .manual-result-item.already')).toBeNull();
  });

  it('the type buttons stay in step in both places', () => {
    window.setDeaconAttType('meeting');
    expect(document.getElementById('online-type-btn-meeting').classList.contains('active')).toBe(true);
    expect(document.getElementById('sd-type-btn-meeting').classList.contains('active')).toBe(true);
    expect(document.getElementById('online-type-btn-sunday').classList.contains('active')).toBe(false);
  });
});
