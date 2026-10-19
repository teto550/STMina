// @ts-nocheck
import { state } from '@/core/state';
import { canSwitchSection } from '@/core/access-config';
import { GRADES, SECTION, applySectionTheme, setupGenderObserver } from '@/core/section';
import { canManageGrade, formatAssignedGradesLabel, getUserManagedGrades, isGradeManagerOf } from '@/core/session';
import { saveProfileCache } from '@/core/firestore-helpers';
import { logActivity, touchLastActive } from '@/core/presence';
import { approveDeacon, loadPendingDeacons } from '@/features/servants/approvals';
import { setupPushBell } from '@/features/shell/push';
import { auth } from '@/core/firebase';
import { applyActiveGradeDeacons } from '@/features/servants/deacons';
import { reloadOpenTab } from '@/features/shell/tabs';
import { canUseServantsTab, isClasslessManager, usesSplitHome } from '@/core/servants-access';
import { AdminHomeView } from '@/react/screens/admin-home/view';

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
      // a manager of servants with no class has no class to open: the app shows them the الخدام tab only
      if (isClasslessManager()) state.activeGrade = null;
    }

    saveProfileCache(user.uid, { access: snapData && snapData.access, gender: snapData && snapData.gender, section: (snapData && snapData.section) || 'boys', role: state.currentUserRole, name: state.currentUserName, status: 'approved', grade: state.currentUserGrade, isLead: state.currentUserIsLead, isPhaseLead: state.currentUserIsPhaseLead, phaseGrades: state.currentUserPhaseGrades });

    document.getElementById('complete-profile-screen').style.display = 'none';
    document.getElementById('app-screen').style.display     = 'flex';
    document.getElementById('user-email-display').textContent = state.currentUserName;

    // القسم النشط على الجهاز ده (بنين/بنات) — بيتحكم في تصفية المخدومين/الخدام وتأنيث الكلام
    const secBtn = document.getElementById('section-toggle-btn');
    if (secBtn) {
      secBtn.innerHTML = SECTION === 'girls' ? '🔄 حساب بنين' : '🔄 حساب بنات';
      secBtn.style.display = (state.currentUserRole === 'admin' || (state.access && canSwitchSection(state.access))) ? 'flex' : 'none'; // admins, and people whose roles span both sections
    }
    const adminWrap = document.getElementById('admin-settings-wrap');
    if (adminWrap) adminWrap.style.display = state.currentUserRole === 'admin' ? 'block' : 'none'; // roles/users screen: admins only
    setupGenderObserver();
    applySectionTheme(true);

    // nothing is given to this person yet (no role / no class): no tabs and no data, only "no access yet". They can still open their
    // profile and the settings from the ⚙️ menu, and sign out. Same page, so an admin giving them a role shows after a refresh.
    if (state.noAccess) {
      showNoAccessScreen();
      touchLastActive(user.uid);
      if (!window.__loginLogged) { window.__loginLogged = true; logActivity('دخل التطبيق'); }
      window.openReactScreen('avatar-host', document.getElementById('avatar-host'));
      return;
    }

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

    // draws the React avatars (kids' and servants' pictures) into the placeholders of the lists
    window.openReactScreen('avatar-host', document.getElementById('avatar-host'));

    initApp();
}

function applyRoleUI() {
  const isAdmin = state.currentUserRole === 'admin';
  // "مسؤول" السنة أو مسؤول المرحلة عنده كل صلاحيات الأدمن على خدام/مخدومين الفصول المسموح لها بس
  const isGradeManager = isAdmin || state.currentUserIsLead || state.currentUserIsPhaseLead;
  // المخدومين tab: visible to all
  document.getElementById('tab-btn-students').style.display = '';
  // pending deacons: admin (كل السنين) أو مسؤول سنة/مرحلة (طلبات الفصول المسموح لها بس)
  if (isGradeManager || canUseServantsTab()) loadPendingDeacons();
  // 🔔 إشعارات الموبايل: زرار تفعيل الإشعارات ظاهر لكل خادم معتمد (مش بس المسؤولين) عشان يقدر ياخد Push لما يتوزع عليه فقرة
  setupPushBell(true);
  // add deacon button: admin أو مسؤول السنة أو مسؤول المرحلة
  document.getElementById('add-deacon-btn-wrap').style.display = isGradeManager ? 'block' : 'none';
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
}

// ===== شريط تبديل السنة الدراسية (أدمن بس) =====
export function buildActiveGradeBar() {
  const bar = document.getElementById('active-grade-bar');
  if (!bar) return;
  // the split home (cards الفصول | الخدام): no chip per class any more. Inside a class or the servants section the bar is a way back
  // (🏠 the two cards, 🏫 the list of classes) plus a label of where you are; on the home itself there is nothing to show
  if (usesSplitHome()) {
    if (state.adminHomeOpen) {
      bar.style.display = 'none';
      return;
    }
    bar.style.display = 'flex';
    const here = state.servantsDirectoryOpen ? '🙏 الخدام' : '📚 ' + (state.activeGrade || '');
    bar.innerHTML = `<button class="grade-chip" onclick="showAdminHome('${AdminHomeView.Home}')">🏠 الرئيسية</button>`
      + `<button class="grade-chip" onclick="showAdminHome('${AdminHomeView.Classes}')">🏫 الفصول</button>`
      + (state.servantsDirectoryOpen ? `<button class="grade-chip" onclick="showServantsHome()">🙏 كروت الخدام</button>` : '')
      + `<button class="grade-chip active" aria-current="page">${here}</button>`;
    return;
  }
  // a person with role-based access and several classes also switches between them
  const isManager = state.currentUserRole === 'admin' || state.currentUserIsLead || state.currentUserIsPhaseLead || canUseServantsTab() || (state.accessSource === 'roles' && getUserManagedGrades().length > 1);
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
  if (canUseServantsTab()) html += `<button class="grade-chip ${state.servantsDirectoryOpen ? 'active' : ''}" style="border-color:rgba(46,204,113,0.4);color:var(--success)" onclick="openServantsDirectory()">🙏 الخدام</button>`;
  bar.innerHTML = html;
}

// "no access yet": hides every tab and class screen and shows the React panel 'no-access' instead
export function showNoAccessScreen() {
  state.activeGrade = null;
  ['active-grade-bar', 'main-tabs', 'servants-directory-modal', 'admin-home-screen', ...['home', 'attendance', 'students', 'deacons', 'parts', 'stats', 'online'].map(t => 'tab-' + t)].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const panel = document.getElementById('no-access-screen');
  panel.style.display = 'block';
  window.openReactScreen('no-access', panel);
}

// بيرجّع الواجهة من خانة "الخدام" لتابات الفصل العادية (الحضور/المخدومين/الخدام/إحصائيات/متابعة)
export function showMainAppTabs() {
  if (isClasslessManager()) return; // nothing but the الخدام tab for them
  document.getElementById('servants-directory-modal').style.display = 'none';
  hideAdminHome();
  document.getElementById('main-tabs').style.display = '';
  const btn = document.getElementById('tab-btn-' + state.lastActiveMainTab) || document.getElementById('tab-btn-attendance');
  window.switchTab(btn.id.replace('tab-btn-', ''), btn);
}

// بيخفي تابات الفصل العادية ويظهر خانة "الخدام" بدالها، في نفس مكان الصفحة (مش أوفرلاي منفصل)
export function showServantsDirectorySection() {
  hideAdminHome();
  document.getElementById('main-tabs').style.display = 'none';
  ['home', 'attendance', 'students', 'deacons', 'parts', 'stats', 'online'].forEach(t => {
    const el = document.getElementById('tab-' + t);
    if (el) el.style.display = 'none';
  });
  document.getElementById('servants-directory-modal').style.display = 'block';
}

// makes `g` the class the app works on: remembers it, refreshes the labels and the servants of that class. Reads nothing by itself.
function applyActiveGrade(g) {
  state.activeGrade = g;
  state.servantsDirectoryOpen = false;
  try {
    if (auth.currentUser) {
      localStorage.setItem('activeGrade_' + auth.currentUser.uid, g);
    }
  } catch (e) {}
  buildActiveGradeBar();
  buildGradeFilters();
  const gradeLabelEl = document.getElementById('deacon-tab-grade-label');
  if (gradeLabelEl) {
    gradeLabelEl.textContent = `📚 بتتعامل دلوقتي مع خدام: ${state.activeGrade}`;
  }
  document.getElementById('user-email-display').textContent =
    `${state.currentUserRole === 'admin' ? '👑' : '🙏'} ${state.currentUserName} — ${state.activeGrade}`;
  const homeClass = document.getElementById('home-class');
  if (homeClass) {
    homeClass.textContent = '📚 ' + state.activeGrade;
  }
  state.currentDeacon = null;
  // Switching class reads nothing by itself. The servants of all classes are already in memory once loaded, and the
  // students/parts of the new class are fetched only if a screen that shows them is open (otherwise when it opens).
  if (state.ALL_DEACONS_RAW.length) {
    applyActiveGradeDeacons();
  }
  backToDeaconList();
  updateDeaconsTabLabel();
}

window.switchActiveGrade = async (g) => {
  if (!GRADES.includes(g)) return;
  if (state.currentUserRole !== 'admin' && !canManageGrade(g)) {
    showToast('ده الفصل مش مسموح لك التعامل فيه', 'error');
    return;
  }
  const cameFromServants = state.servantsDirectoryOpen;
  if (g === state.activeGrade && !cameFromServants) return;
  if (cameFromServants) showMainAppTabs();
  applyActiveGrade(g);
  await reloadOpenTab();
  showToast('السنة الدراسية النشطة: ' + g, 'success');
};

// ===== الرئيسية المقسومة: 🏫 الفصول | 🙏 الخدام (للأدمن ولمسؤول الخدام اللي معاه فصول) =====
// Same split as the Hdour app: the home has two cards. الفصول lists every class, picking one opens that class with its own tabs
// (the home tiles + the tab bar); الخدام opens the servants section of the whole app. A bar above ("🏠 الرئيسية / 🏫 الفصول") leads back.
function hideAdminHome() {
  state.adminHomeOpen = false;
  const host = document.getElementById('admin-home-screen');
  if (host) {
    host.style.display = 'none';
  }
}

export function showAdminHome(view) {
  state.adminHomeOpen = true;
  state.servantsDirectoryOpen = false;
  document.getElementById('main-tabs').style.display = 'none';
  document.getElementById('servants-directory-modal').style.display = 'none';
  ['home', 'attendance', 'students', 'deacons', 'parts', 'stats', 'online'].forEach(t => {
    const el = document.getElementById('tab-' + t);
    if (el) {
      el.style.display = 'none';
    }
  });
  document.getElementById('user-email-display').textContent = `${state.currentUserRole === 'admin' ? '👑' : '🙏'} ${state.currentUserName}`;
  const host = document.getElementById('admin-home-screen');
  host.style.display = 'block';
  window.openReactScreen('admin-home', host, {
    grades: state.currentUserRole === 'admin' ? GRADES.slice() : GRADES.filter(g => getUserManagedGrades().includes(g)),
    activeGrade: state.activeGrade,
    startView: view === AdminHomeView.Classes ? AdminHomeView.Classes : AdminHomeView.Home,
    onOpenClass: openClassFromAdminHome,
    onOpenServants: () => showServantsHome()
  });
  buildActiveGradeBar();
}
window.showAdminHome = showAdminHome;

// the servants section opens on cards first (الحضور / الخدام / الأدوار), like Hdour; a card then opens that part of the servants section
export function showServantsHome() {
  state.adminHomeOpen = true;
  state.servantsDirectoryOpen = false;
  document.getElementById('main-tabs').style.display = 'none';
  document.getElementById('servants-directory-modal').style.display = 'none';
  ['home', 'attendance', 'students', 'deacons', 'parts', 'stats', 'online'].forEach(t => {
    const el = document.getElementById('tab-' + t);
    if (el) {
      el.style.display = 'none';
    }
  });
  const host = document.getElementById('admin-home-screen');
  host.style.display = 'block';
  window.openReactScreen('servants-home', host, {
    showRoles: state.currentUserRole === 'admin',
    onOpenSection: (section) => window.openServantsDirectory(section),
    onOpenRoles: () => window.openReactScreen('admin-roles'),
    onBack: () => showAdminHome(AdminHomeView.Home)
  });
  buildActiveGradeBar();
}
window.showServantsHome = showServantsHome;

function openClassFromAdminHome(g) {
  if (!GRADES.includes(g)) {
    return;
  }
  if (state.currentUserRole !== 'admin' && !canManageGrade(g)) {
    showToast('ده الفصل مش مسموح لك التعامل فيه', 'error');
    return;
  }
  hideAdminHome();
  applyActiveGrade(g);
  document.getElementById('main-tabs').style.display = '';
  window.switchTab('home', document.getElementById('tab-btn-home'));
}

// ===== INIT =====
async function initApp() {
  setDateDisplay();
  buildGradeFilters();
  updateDeaconsTabLabel();
  // Nothing is read from Firestore here: the user lands on the home screen and every screen loads its own data when it
  // is opened (see core/data.ts and shell/tabs.ts).
  // someone with no class (only manages servants) lands on the الخدام tab; there is no home / class screen for them
  if (isClasslessManager()) {
    window.openServantsDirectory();
    return;
  }
  // admins (and managers of servants who also have classes) start on the two cards الفصول | الخدام; everyone else goes into their class
  if (usesSplitHome()) {
    showAdminHome(AdminHomeView.Home);
    return;
  }
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
  if (newGradeSel)  { newGradeSel.innerHTML  = gradeOptions; if (state.activeGrade) newGradeSel.value  = state.activeGrade; if (window.updateNewGenderVisibility) window.updateNewGenderVisibility(); }
  if (editGradeSel) editGradeSel.innerHTML = gradeOptions;
}
