// @ts-nocheck
import { state } from '@/core/state';
import { loadPendingDeacons } from '@/features/servants/approvals';
import { loadParts } from '@/features/servants/parts';
import { initStatsTab } from '@/features/dashboard/stats';
import { initOnlineTab } from '@/features/servants/online';
import { logActivity } from '@/core/presence';

// ===== TABS =====
window.switchTab = (tab, btn) => {
  state.lastActiveMainTab = tab;
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-attendance').style.display  = tab === 'attendance'  ? 'block' : 'none';
  document.getElementById('tab-students').style.display    = tab === 'students'    ? 'block' : 'none';
  document.getElementById('tab-deacons').style.display      = tab === 'deacons'     ? 'block' : 'none';
  document.getElementById('tab-parts').style.display        = tab === 'parts'       ? 'block' : 'none';
  document.getElementById('tab-stats').style.display        = tab === 'stats'       ? 'block' : 'none';
  document.getElementById('tab-online').style.display       = tab === 'online'      ? 'block' : 'none';
  if (tab === 'deacons') buildDeaconChips();
  if (tab === 'deacons' && (state.currentUserRole === 'admin' || state.currentUserIsLead || state.currentUserIsPhaseLead)) loadPendingDeacons();
  if (tab === 'parts') loadParts();
  if (tab === 'stats') initStatsTab();
  if (tab === 'online' && (state.currentUserRole === 'admin' || state.currentUserIsLead || state.currentUserIsPhaseLead)) initOnlineTab();

  const TAB_LABELS = {
    attendance: 'خانة الحضور',
    students:   'خانة المخدومين',
    deacons:    'خانة الخدام',
    parts:      'خانة توزيع الفقرات',
    stats:      'خانة الإحصائيات'
  };
  if (TAB_LABELS[tab]) logActivity('فتح ' + TAB_LABELS[tab]);
};
