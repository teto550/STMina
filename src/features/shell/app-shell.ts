// @ts-nocheck
import { state } from '@/core/state';
import { GRADES, SECTION, applySectionTheme, setupGenderObserver } from '@/core/section';
import { canManageGrade, formatAssignedGradesLabel, getUserManagedGrades, isGradeManagerOf } from '@/core/session';
import { saveProfileCache } from '@/core/firestore-helpers';
import { clearSplashWatchdog } from '@/core/splash';
import { logActivity, touchLastActive } from '@/core/presence';
import { approveDeacon, loadPendingDeacons } from '@/features/servants/approvals';
import { setupPushBell } from '@/features/shell/push';
import { setupPartNotifications } from '@/features/servants/parts';
import { CLEANED_ATTENDANCE_GRADES } from '@/core/config';
import { auth } from '@/core/firebase';
import { applyActiveGradeDeacons } from '@/features/servants/deacons';
import { reloadOpenTab } from '@/features/shell/tabs';

// بعد التأكد إن الحساب معتمد وبياناته كاملة: يدخل التطبيق فعليًا
export async function enterApp(user, snapData) {
    // تحديد السنة الدراسية النشطة: الأدمن يقدر يتنقل بين كل السنين (وبيبدأ بآخر سنة
    // فتحها أو بسنته لو هو مسؤول عليها)، أما الخادم/المسؤول العادي فبيتقفل على سنته بس
    if (state.currentUserRole === 'admin') {
      let lastGrade = null;
      try { lastGrade = localStorage.getItem('activeGrade_' + user.uid); } catch(e) {}
      state.activeGrade = (lastGrade && GRADES.includes(lastGrade)) ? lastGrade : (state.currentUserGrade || GRADES[0]);
    } else {
      const allowedGrades = getUserManagedGrades();
      const preferred = state.currentUserGrade || (allowedGrades[0] || GRADES[0]);
      state.activeGrade = allowedGrades.includes(preferred) ? preferred : (allowedGrades[0] || GRADES[0]);
    }

    saveProfileCache(user.uid, { role: state.currentUserRole, name: state.currentUserName, status: 'approved', grade: state.currentUserGrade, isLead: state.currentUserIsLead, isPhaseLead: state.currentUserIsPhaseLead, phaseGrades: state.currentUserPhaseGrades });

    clearSplashWatchdog();
        document.getElementById('splash-screen').style.display  = 'none';
    document.getElementById('auth-screen').style.display    = 'none';
    document.getElementById('pending-screen').style.display = 'none';
    document.getElementById('complete-profile-screen').style.display = 'none';
    document.getElementById('app-screen').style.display     = 'flex';
    document.getElementById('user-email-display').textContent = state.currentUserName;

    // القسم النشط على الجهاز ده (بنين/بنات) — بيتحكم في تصفية المخدومين/الخدام وتأنيث الكلام
    const secBtn = document.getElementById('section-toggle-btn');
    if (secBtn) secBtn.innerHTML = SECTION === 'girls' ? '🔄 حساب بنين' : '🔄 حساب بنات';
    setupGenderObserver();
    applySectionTheme(true);

    // Show/hide tabs based on role
    applyRoleUI();

    // remember when the app was last opened (one write per page load) + log the login (once per session)
    touchLastActive(user.uid);
    if (!window.__loginLogged) { window.__loginLogged = true; logActivity('دخل التطبيق'); }

    // Check for approve query param (admin link from email)
    const urlParams = new URLSearchParams(location.search);
    const approveUid = urlParams.get('approve');
    if (approveUid && state.currentUserRole === 'admin') {
      await approveDeacon(approveUid);
      history.replaceState({}, '', location.pathname);
    }

    initApp();
}

function applyRoleUI() {
  const isAdmin = state.currentUserRole === 'admin';
  // "مسؤول" السنة أو مسؤول المرحلة عنده كل صلاحيات الأدمن على خدام/مخدومين الفصول المسموح لها بس
  const isGradeManager = isAdmin || state.currentUserIsLead || state.currentUserIsPhaseLead;
  // المخدومين tab: visible to all
  document.getElementById('tab-btn-students').style.display = '';
  // pending deacons: admin (كل السنين) أو مسؤول سنة/مرحلة (طلبات الفصول المسموح لها بس)
  if (isGradeManager) loadPendingDeacons();
  // 🔔 إشعارات الموبايل: زرار تفعيل الإشعارات ظاهر لكل خادم معتمد (مش بس المسؤولين) عشان يقدر ياخد Push لما يتوزع عليه فقرة
  setupPushBell(true);
  // 🔔 إشعارات توزيع الفقرات: لأي خادم اتوزعت عليه فقرة (كل المستخدمين المعتمدين)
  setupPartNotifications();
  // add deacon button: admin أو مسؤول السنة أو مسؤول المرحلة
  document.getElementById('add-deacon-btn-wrap').style.display = isGradeManager ? 'block' : 'none';
  // add part button (توزيع الفقرات): بس مسؤول الفصل النشط ده تحديدًا (أو الأدمن)
  document.getElementById('add-part-btn-wrap').style.display = isGradeManagerOf(state.activeGrade) ? 'block' : 'none';
  // promote grade year button: admin أو مسؤول السنة أو مسؤول المرحلة
  document.getElementById('promote-grade-btn').style.display = isGradeManager ? 'block' : 'none';
  // upload students-from-excel button: admin بس (بيرفع بيانات لكل السنة الدراسية النشطة activeGrade)
  document.getElementById('import-students-btn').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('creds-import-wrap').style.display = isAdmin ? 'block' : 'none';
  // add star button: any signed-in approved user (admin + deacons)
  document.getElementById('add-star-btn').style.display = 'inline-block';
  // online/activity tab: admin (كل السنين) أو مسؤول سنة/مرحلة (نشاط وحضور الفصول المسموح لها بس)
  document.getElementById('tab-btn-online').style.display = isGradeManager ? '' : 'none';
  const onlineTile = document.getElementById('home-tile-online'); if (onlineTile) onlineTile.style.display = isGradeManager ? '' : 'none';
  const studentsTile = document.getElementById('home-tile-students'); if (studentsTile) studentsTile.style.display = '';
  // top bar subtitle: شارة حسب الدور + السنة الدراسية النشطة أو فصول المرحلة
  const roleIcon = isAdmin ? '👑' : (state.currentUserIsPhaseLead ? '🟣' : (state.currentUserIsLead ? '⭐' : '🙏'));
  const gradeText = state.currentUserIsPhaseLead && state.currentUserPhaseGrades.length
    ? ` — ${formatAssignedGradesLabel(state.currentUserPhaseGrades)}`
    : (state.activeGrade ? ` — ${state.activeGrade}` : '');
  document.getElementById('user-email-display').textContent = `${roleIcon} ${state.currentUserName}${gradeText}`;
  const gradeLabelEl = document.getElementById('deacon-tab-grade-label');
  if (gradeLabelEl) gradeLabelEl.textContent = state.activeGrade ? `📚 بتتعامل دلوقتي مع خدام: ${state.activeGrade}` : '';
  buildActiveGradeBar();
  updateDeaconsTabLabel();
  const migrateWrap = document.getElementById('legacy-migrate-wrap');
  if (migrateWrap) migrateWrap.style.display = (isAdmin && !state.LEGACY_MIGRATED) ? 'block' : 'none';
  updateAttendanceCleanupVisibility();
}

// زرار "تنظيف حضور قديم" بيظهر للأدمن بس، وبس لو فيه فصل نشط (activeGrade) لسه
// معملوش تنظيف قبل كده — بمجرد ما يتنضف الفصل الزرار بيختفي ليه تلقائي
export function updateAttendanceCleanupVisibility() {
  const cleanupWrap = document.getElementById('attendance-cleanup-wrap');
  if (!cleanupWrap) return;
  const isAdmin = state.currentUserRole === 'admin';
  cleanupWrap.style.display = (isAdmin && state.activeGrade && !CLEANED_ATTENDANCE_GRADES.includes(state.activeGrade)) ? 'block' : 'none';
}

// ===== شريط تبديل السنة الدراسية (أدمن بس) =====
export function buildActiveGradeBar() {
  const bar = document.getElementById('active-grade-bar');
  if (!bar) return;
  const isManager = state.currentUserRole === 'admin' || state.currentUserIsLead || state.currentUserIsPhaseLead;
  if (!isManager) { bar.style.display = 'none'; return; }
  const allowedGrades = state.currentUserRole === 'admin' ? GRADES.slice() : getUserManagedGrades();
  bar.style.display = 'flex';
  let html = GRADES.filter(g => allowedGrades.includes(g)).map(g => {
    const isLeadHere = (state.currentUserIsLead && state.currentUserGrade === g) || (state.currentUserIsPhaseLead && state.currentUserPhaseGrades.includes(g));
    const isActive = !state.servantsDirectoryOpen && g === state.activeGrade;
    const roleTag = state.currentUserIsPhaseLead && state.currentUserPhaseGrades.includes(g) ? ' 🟣' : (isLeadHere ? ' ⭐' : '');
    return `<button class="grade-chip ${isActive ? 'active' : ''}" onclick="switchActiveGrade('${g}')">${g}${roleTag}</button>`;
  }).join('');
  // شريحة ثابتة بتفتح دليل كل الخدام في البرنامج كله (كل السنين مع بعض) — للأدمن/المسؤولين فقط
  html += `<button class="grade-chip ${state.servantsDirectoryOpen ? 'active' : ''}" style="border-color:rgba(46,204,113,0.4);color:var(--success)" onclick="openServantsDirectory()">🙏 الخدام</button>`;
  bar.innerHTML = html;
}

// بيرجّع الواجهة من خانة "الخدام" لتابات الفصل العادية (الحضور/المخدومين/الخدام/إحصائيات/متابعة)
export function showMainAppTabs() {
  document.getElementById('servants-directory-modal').style.display = 'none';
  document.getElementById('main-tabs').style.display = '';
  const btn = document.getElementById('tab-btn-' + state.lastActiveMainTab) || document.getElementById('tab-btn-attendance');
  window.switchTab(btn.id.replace('tab-btn-', ''), btn);
}

// بيخفي تابات الفصل العادية ويظهر خانة "الخدام" بدالها، في نفس مكان الصفحة (مش أوفرلاي منفصل)
export function showServantsDirectorySection() {
  document.getElementById('main-tabs').style.display = 'none';
  ['attendance', 'students', 'deacons', 'stats', 'online'].forEach(t => {
    const el = document.getElementById('tab-' + t);
    if (el) el.style.display = 'none';
  });
  document.getElementById('servants-directory-modal').style.display = 'block';
}

window.switchActiveGrade = async (g) => {
  if (!GRADES.includes(g)) return;
  if (state.currentUserRole !== 'admin' && !canManageGrade(g)) {
    showToast('ده الفصل مش مسموح لك التعامل فيه', 'error');
    return;
  }
  const cameFromServants = state.servantsDirectoryOpen;
  if (g === state.activeGrade && !cameFromServants) return;
  state.activeGrade = g;
  state.servantsDirectoryOpen = false;
  if (cameFromServants) showMainAppTabs();
  try { if (auth.currentUser) localStorage.setItem('activeGrade_' + auth.currentUser.uid, g); } catch(e) {}
  buildActiveGradeBar();
  buildGradeFilters();
  const gradeLabelEl = document.getElementById('deacon-tab-grade-label');
  if (gradeLabelEl) gradeLabelEl.textContent = `📚 بتتعامل دلوقتي مع خدام: ${state.activeGrade}`;
  document.getElementById('user-email-display').textContent =
    `👑 ${state.currentUserName} — ${state.activeGrade}`;
  const homeClass = document.getElementById('home-class'); if (homeClass) homeClass.textContent = '📚 ' + state.activeGrade;
  updateAttendanceCleanupVisibility();
  state.currentDeacon = null;
  // Switching class reads nothing by itself. The servants of all classes are already in memory once loaded, and the
  // students/parts of the new class are fetched only if a screen that shows them is open (otherwise when it opens).
  if (state.ALL_DEACONS_RAW.length) applyActiveGradeDeacons();
  backToDeaconList();
  updateDeaconsTabLabel();
  document.getElementById('add-part-btn-wrap').style.display = isGradeManagerOf(state.activeGrade) ? 'block' : 'none';
  await reloadOpenTab();
  showToast('السنة الدراسية النشطة: ' + g, 'success');
};

// ===== INIT =====
async function initApp() {
  setDateDisplay();
  buildGradeFilters();
  updateDeaconsTabLabel();
  // Nothing is read from Firestore here: the user lands on the home screen and every screen loads its own data when it
  // is opened (see core/data.ts and shell/tabs.ts).
  window.switchTab('home', document.getElementById('tab-btn-home'));
}

function setDateDisplay() {
  const now  = new Date();
  const days = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  document.getElementById('today-date').textContent =
    now.toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' });
  document.getElementById('today-day').textContent = days[now.getDay()];
}

export function buildGradeFilters() {
  const attChips = ['الكل', 'غاب آخر مرة', 'أعياد ميلاد الشهر'];
  document.getElementById('att-grade-filter').innerHTML = attChips.map((g,i) =>
    `<button class="grade-chip ${i===0?'active':''}" onclick="setAttGrade('${g}',this)">${g}</button>`
  ).join('');

  const stuChips = ['الكل', 'بدون خادم'];
  document.getElementById('stu-grade-filter').innerHTML = stuChips.map((g,i) =>
    `<button class="grade-chip ${i===0?'active':''}" onclick="setStuGrade('${g}',this)">${g}</button>`
  ).join('');

  // ادّي فورم الإضافة والتعديل خيارات السنة الدراسية الحالية (بعد أي ترقية سنة)
  const gradeOptions = GRADES.map(g => `<option value="${g}">${g}</option>`).join('');
  const newGradeSel  = document.getElementById('new-grade');
  const editGradeSel = document.getElementById('edit-grade');
  if (newGradeSel)  { newGradeSel.innerHTML  = gradeOptions; if (state.activeGrade) newGradeSel.value  = state.activeGrade; }
  if (editGradeSel) editGradeSel.innerHTML = gradeOptions;
}
