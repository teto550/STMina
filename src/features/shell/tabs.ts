// @ts-nocheck
import { state } from '@/core/state';
import { loadPendingDeacons } from '@/features/servants/approvals';
import { DEACONS } from '@/features/servants/deacons';
import { auth } from '@/core/firebase';
import { isGradeManagerOf } from '@/core/session';
import { sectionTag } from '@/core/section';
import { initStatsTab } from '@/features/dashboard/stats';
import { initOnlineTab } from '@/features/servants/online';
import { renderTodayList, updateStats } from '@/features/attendance/attendance';
import { classEmoji } from '@/core/class-settings';
import { ensureClassSettings } from '@/features/classes/class-settings';
import { ensureStudents, ensureDeacons, ensureAttendance, ensureTodayListener, refreshAllData } from '@/core/data';

// ===== TABS =====
// The app opens on the HOME screen and reads nothing. Each screen loads only what it needs, when it is opened.
const isManager = () => state.currentUserRole === 'admin' || state.currentUserIsLead || state.currentUserIsPhaseLead;
let loadToken = 0;

async function loadTabData(tab) {
  const mine = ++loadToken;
  try {
    if (tab === 'attendance')  { ensureClassSettings(); /* in the background: a slow network must never hold the list */ await ensureStudents(); ensureTodayListener(); if (state.currentAttGrade === 'غاب آخر مرة') await ensureAttendance('recent'); }
    else if (tab === 'students') { await Promise.all([ensureStudents(), ensureDeacons()]); }
    else if (tab === 'deacons')  { await Promise.all([ensureDeacons(), ensureStudents()]); }
    else if (tab === 'parts')    { await ensureDeacons(); }
    else if (tab === 'stats')    { await Promise.all([ensureStudents(), ensureDeacons(), ensureAttendance('recent')]); }
    else if (tab === 'online')   { await ensureDeacons(); }
  } catch (e) { console.error('loading data for', tab, e); }
  if (mine !== loadToken || state.lastActiveMainTab !== tab) return; // the user already went somewhere else
  if (tab === 'attendance') { updateStats(); renderTodayList(); }
  else if (tab === 'students') window.renderStudentsList();
  else if (tab === 'deacons') { window.buildDeaconChips(); if (isManager()) loadPendingDeacons(); }
  else if (tab === 'parts') showParts();
  else if (tab === 'stats') initStatsTab();
  else if (tab === 'online' && isManager()) initOnlineTab();
}

// "توزيع الفقرات" is the React screen 'parts' (src/react/screens/parts); it loads its own data and is drawn again each time the tab opens
function showParts() {
  window.openReactScreen('parts', document.getElementById('parts-screen'), {
    grade: state.activeGrade,
    section: sectionTag(),
    canManage: isGradeManagerOf(state.activeGrade),
    servants: DEACONS.slice(),
    isAdmin: state.currentUserRole === 'admin',
    user: { uid: auth.currentUser ? auth.currentUser.uid : '', name: state.currentUserName }
  });
}

// after the active class changed: reload the screen that is open (nothing on the home screen)
export async function reloadOpenTab() {
  const tab = state.lastActiveMainTab;
  if (tab && tab !== 'home') await loadTabData(tab);
}

window.openTab = (tab) => window.switchTab(tab, document.getElementById('tab-btn-' + tab));

window.switchTab = (tab, btn) => {
  state.lastActiveMainTab = tab;
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  ['home', 'attendance', 'students', 'deacons', 'parts', 'stats', 'online'].forEach(t => {
    document.getElementById('tab-' + t).style.display = t === tab ? 'block' : 'none';
  });
  // Hdour way: the class home is the cards; inside a section there is a 🏠 button and the title of the section (no row of tabs)
  const bar = document.getElementById('main-tabs');
  if (bar) { bar.style.display = tab === 'home' ? 'none' : ''; }
  const title = document.getElementById('section-title');
  if (title) {
    const names = { attendance: '✅ الحضور', students: '👥 المخدومين', deacons: '🙏 الخدام', parts: '📖 توزيع الفقرات', stats: '📊 إحصائيات', online: '👁 متابعة' };
    title.textContent = (state.activeGrade ? classEmoji(state.activeGrade) + ' ' + state.activeGrade + ' — ' : '') + (names[tab] || '');
    title.style.display = tab === 'home' ? 'none' : 'block';
  }
  if (tab === 'home') { const c = document.getElementById('home-class'); if (c) c.textContent = state.activeGrade ? classEmoji(state.activeGrade) + ' ' + state.activeGrade : ''; }
  else loadTabData(tab);
};

// "refresh data" button on the home screen: forget the short-lived cache so the next screen reads from the server
window.refreshData = () => {
  refreshAllData();
  showToast('اتمسحت البيانات المخزنة — هتتحمل من جديد لما تفتح أي خانة', 'success');
};
