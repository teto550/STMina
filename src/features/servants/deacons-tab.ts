// @ts-nocheck
import { deleteDoc, doc, setDoc, writeBatch } from 'firebase/firestore';
import { isDeaconOf } from '@/core/servants-index';
import { state } from '@/core/state';
import { DEACONS, DEACON_ADMIN_MAP, DEACON_DOC_IDS, applyActiveGradeDeacons, loadDeaconUsersMap } from '@/features/servants/deacons';
import { formatAssignedGradesLabel } from '@/core/session';
import { auth, db } from '@/core/firebase';
import { logActivity } from '@/core/presence';
import { loadPendingDeacons } from '@/features/servants/approvals';
import { renderTodayList } from '@/features/attendance/attendance';
import { ensureAttendance } from '@/core/data';
import { avatarBox } from '@/features/students/photos';

window.buildDeaconChips = async function() {
  const isAdmin = state.currentUserRole === 'admin';
  // "مسؤول" السنة بيشوف كل خدام سنته زي الأدمن بالظبط، بس من غير صلاحية تعيين أدمن/مسؤول
  // roles design: every servant of a class (role-based access) sees the class's servants, like a lead does (without the admin/lead buttons)
  const isGradeManager = isAdmin || state.currentUserIsLead || state.accessSource === 'roles';
  const pickerWrap = document.getElementById('deacon-picker-wrap');
  const resultsTitle = document.getElementById('deacon-results-title');

  if (isGradeManager) {
    // أدمن/مسؤول سنة: يشوف كل خدام السنة النشطة عمودي، مع عدد المتأخرين وزرار تعيين/إلغاء أدمن أو مسؤول (أدمن بس)
    // لو فاتح دلوقتي صفحة خادم معين (currentDeacon)، سيب القايمة مقفولة ومتفتحهاش تاني —
    // غير كده أي تحديث بيني (حفظ مخدوم، تعيين أدمن، تبديل تاب) كان بيفتح القايمة فوق صفحة الخادم فتبان الاتنين مع بعض
    if (pickerWrap) pickerWrap.style.display = state.currentDeacon ? 'none' : '';
    if (resultsTitle) resultsTitle.textContent = 'النتائج';
    await loadDeaconUsersMap();

    // احسب إحصائيات كل خادم (عدد المخدومين اللي كلمهم تليفونيًا وعدد اللي زارهم في بيتهم)
    const deaconStats = {};
    DEACONS.forEach(d => {
      const mine = state.allStudents.filter(s => isDeaconOf(s, d));
      deaconStats[d] = {
        notCalledThisMonth: mine.filter(s => !isVisitedThisMonth(s)).length,
        neverContacted: mine.filter(s => !s.lastVisitPhone && !s.lastVisitHome).length,
        calledCount: mine.filter(s => !!s.lastVisitPhone).length,
        visitedCount: mine.filter(s => !!s.lastVisitHome).length
      };
    });

    // رتّب قائمة الخدام حسب الاختيار في select الترتيب
    const sortSel = document.getElementById('deacon-sort');
    const sortMode = sortSel ? sortSel.value : 'default';
    let orderedDeacons = DEACONS.slice();
    if (sortMode === 'calls-desc') orderedDeacons.sort((a, b) => deaconStats[b].calledCount - deaconStats[a].calledCount);
    else if (sortMode === 'calls-asc') orderedDeacons.sort((a, b) => deaconStats[a].calledCount - deaconStats[b].calledCount);
    else if (sortMode === 'visits-desc') orderedDeacons.sort((a, b) => deaconStats[b].visitedCount - deaconStats[a].visitedCount);
    else if (sortMode === 'visits-asc') orderedDeacons.sort((a, b) => deaconStats[a].visitedCount - deaconStats[b].visitedCount);

    document.getElementById('deacon-chips').innerHTML = orderedDeacons.map(d => {
      const { notCalledThisMonth, neverContacted, calledCount, visitedCount } = deaconStats[d];
      const u = DEACON_ADMIN_MAP[d];
      const isDeaconAdmin = u && u.role === 'admin';
      const isDeaconLead  = u && u.isLead;
      const isDeaconPhaseLead = u && u.isPhaseLead;
      const phaseLabel = u && u.phaseGrades && u.phaseGrades.length ? ` 🟣 ${formatAssignedGradesLabel(u.phaseGrades)}` : '';
      const safeName = d.replace(/'/g, "\\'");
      // Access is given with roles now (admin screen "المستخدمين والأدوار"); the old admin / lead / phase-lead toggles were removed.
      // Accounts that still carry the old flags keep working and show their badges here.
      let adminBtn = '';
      if (!u) adminBtn = `<span class="deacon-no-account">لسه ماسجلش حساب</span>`;
      else if (isAdmin) adminBtn = `<button class="deacon-admin-btn not-admin" onclick="event.stopPropagation();openReactScreen('admin-roles')">👥 الأدوار</button>`;
      else if (isDeaconLead || isDeaconPhaseLead) adminBtn = `<span class="deacon-no-account">${isDeaconLead ? '⭐ مسؤول السنة' : ''}${isDeaconPhaseLead ? ' 🟣 مسؤول المرحلة' : ''}</span>`;
      return `
        <div class="deacon-row" data-deacon="${d}" onclick="setDeacon('${d}',this)">
          <div class="deacon-row-top">
            <div class="deacon-row-name">${d}${isDeaconLead ? ' ⭐' : ''}${isDeaconPhaseLead ? ' 🟣' : ''}${phaseLabel}</div>
            ${adminBtn}
          </div>
          <div class="deacon-row-stats">
            <span class="deacon-stat deacon-stat-month">📞 كلم ${calledCount}</span>
            <span class="deacon-stat deacon-stat-month">🏠 زار ${visitedCount}</span>
            <span class="deacon-stat deacon-stat-month">⏳ ${notCalledThisMonth} لسه مكلمهومش الشهر ده</span>
            <span class="deacon-stat deacon-stat-never">🚫 ${neverContacted} مكلمهمش/زارهمش خالص</span>
          </div>
        </div>`;
    }).join('');
    // Re-mark active row if a deacon is already selected
    if (state.currentDeacon) {
      document.querySelectorAll('#deacon-chips .deacon-row').forEach(b => {
        if (b.dataset.deacon === state.currentDeacon) b.classList.add('active');
      });
    }
  } else {
    // Deacon: no picker at all — shows only his own served children automatically
    if (pickerWrap) pickerWrap.style.display = 'none';
    if (resultsTitle) resultsTitle.textContent = '🙏 مخدومينك';
    document.getElementById('deacon-chips').innerHTML = '';
    if (state.currentUserName && state.currentDeacon !== state.currentUserName) {
      state.currentDeacon = state.currentUserName;
    }
  }
  renderDeaconList();
}

window.deleteDeacon = async (name) => {
  if (state.currentUserRole !== 'admin' && !state.currentUserIsLead && !state.currentUserIsPhaseLead) { showToast('الأدمن أو مسؤول السنة أو مسؤول المرحلة بس يقدروا يعملوا كده', 'error'); return; }
  const linkedUser = DEACON_ADMIN_MAP[name];
  const confirmMsg = linkedUser
    ? `هتحذف الخادم "${name}" نهائي، بما فيه حسابه وإيميله (${linkedUser.email || 'بدون إيميل'}) من البرنامج. مخدوميه مش هيتحذفوا. متأكد؟`
    : `هتحذف الخادم "${name}" من القائمة؟\nمخدوميه مش هيتحذفوا بس الخادم مش هيبان تاني.`;
  if (!confirm(confirmMsg)) return;
  const docId = DEACON_DOC_IDS[name];
  if (!docId) { showToast('مش لاقي الخادم في القاعدة', 'error'); return; }
  try {
    await deleteDoc(doc(db, 'deacons', docId));
    // شيل حساب تسجيل الدخول بتاعه (users/{uid}) لو عنده واحد — ده بيقفل دخوله على
    // البرنامج تمامًا (البرنامج بيرفض أي حساب مالوش سجل في users)، وبيشيل إيميله
    // وبياناته من قاعدة البيانات. ملحوظة: حساب الـ Firebase Auth الخام (الإيميل/الباسورد)
    // بيفضل موجود في تبويب Authentication نفسه — ده مينفعش يتشال من الأبلكيشن، لازم
    // يتشال يدوي من Firebase Console أو عن طريق Cloud Function بصلاحيات Admin SDK.
    if (linkedUser?.uid) {
      await deleteDoc(doc(db, 'users', linkedUser.uid));
      delete DEACON_ADMIN_MAP[name];
    }
    state.ALL_DEACONS_RAW = state.ALL_DEACONS_RAW.filter(x => x.id !== docId);
    if (state.currentDeacon === name) state.currentDeacon = null;
    applyActiveGradeDeacons();
    renderDeaconList();
    showToast(`تم حذف "${name}" ${linkedUser ? 'وحسابه' : ''} ✓`, 'success');
    logActivity('حذف خادم', linkedUser ? `${name} (${linkedUser.email || ''})` : name);
  } catch(e) {
    console.error(e);
    showToast('حدث خطأ، حاول تاني', 'error');
  }
};

window.setDeacon = (d, btn) => {
  state.currentDeacon = d;
  document.querySelectorAll('#deacon-chips .deacon-row').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (state.currentUserRole === 'admin' || state.currentUserIsLead || state.currentUserIsPhaseLead) showDeaconDetailView(d);
  renderDeaconList();
};

// يبدّل من قائمة كل الخدام لصفحة خادم واحد (بالفلاتر ونتايجه بس)
window.showDeaconDetailView = (d) => {
  const addBtnWrap = document.getElementById('add-deacon-btn-wrap');
  const pickerWrap = document.getElementById('deacon-picker-wrap');
  const pendingSection = document.getElementById('pending-deacons-section');
  const detailHeader = document.getElementById('deacon-detail-header');
  const detailName = document.getElementById('deacon-detail-name');
  if (addBtnWrap) addBtnWrap.style.display = 'none';
  if (pickerWrap) pickerWrap.style.display = 'none';
  if (pendingSection) pendingSection.style.display = 'none';
  if (detailHeader) detailHeader.style.display = 'flex';
  if (detailName) detailName.textContent = '🙏 ' + d;
};

// يرجع من صفحة الخادم لقائمة كل الخدام تاني
window.backToDeaconList = () => {
  state.currentDeacon = null;
  const detailHeader = document.getElementById('deacon-detail-header');
  if (detailHeader) detailHeader.style.display = 'none';
  if (state.currentUserRole === 'admin' || state.currentUserIsLead || state.currentUserIsPhaseLead) {
    const addBtnWrap = document.getElementById('add-deacon-btn-wrap');
    const pickerWrap = document.getElementById('deacon-picker-wrap');
    if (addBtnWrap) addBtnWrap.style.display = 'block';
    if (pickerWrap) pickerWrap.style.display = '';
    if (typeof loadPendingDeacons === 'function') loadPendingDeacons();
  }
  document.querySelectorAll('#deacon-chips .deacon-row').forEach(b => b.classList.remove('active'));
  renderDeaconList();
};

window.setDeaconFilter = (f, btn) => {
  state.currentDeaconFilter = f;
  document.querySelectorAll('#deacon-filter-tabs .tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('deacon-filter-attendance-ctrl').style.display = f === 'attendance' ? 'block' : 'none';
  document.getElementById('deacon-filter-absence-ctrl').style.display   = f === 'absence'    ? 'block' : 'none';
  document.getElementById('deacon-filter-visit-ctrl').style.display     = f === 'visit'      ? 'block' : 'none';
  document.getElementById('deacon-filter-birthday-ctrl').style.display  = f === 'birthday'   ? 'block' : 'none';
  renderDeaconList();
};

// هل تم افتقاد المخدوم تليفونيًا الشهر ده؟
window.isVisitedThisMonth = (s) => {
  if (!s.lastVisitPhone) return false;
  const d = new Date(s.lastVisitPhone);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const m = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  return m === 0;
};

// هل تم افتقاد المخدوم تليفونيًا الأسبوع ده؟ (الأسبوع من السبت للجمعة)
window.isVisitedThisWeek = (s) => {
  if (!s.lastVisitPhone) return false;
  const d = new Date(s.lastVisitPhone + 'T00:00:00');
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const day = now.getDay(); // 0=أحد .. 6=سبت
  const diffToSaturday = (day + 1) % 7; // بداية الأسبوع = السبت
  const weekStart = new Date(now); weekStart.setHours(0,0,0,0); weekStart.setDate(now.getDate() - diffToSaturday);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);
  return d >= weekStart && d < weekEnd;
};

// ===== حذف خادم عبر مودال اختيار =====
window.openDeleteDeaconModal = () => {
  if (!DEACONS.length) { showToast('مفيش خدام لحذفهم', 'error'); return; }
  document.getElementById('delete-deacon-select').innerHTML =
    DEACONS.map(d => `<option value="${d}">${d}</option>`).join('');
  document.getElementById('delete-deacon-modal').style.display = 'block';
};

window.closeDeleteDeaconModal = () => {
  document.getElementById('delete-deacon-modal').style.display = 'none';
};

window.confirmDeleteDeacon = () => {
  const name = document.getElementById('delete-deacon-select').value;
  if (!name) return;
  closeDeleteDeaconModal();
  deleteDeacon(name);
};

window.renderDeaconList = () => {
  const cont = document.getElementById('deacon-list');
  const filterTabs = document.getElementById('deacon-filter-tabs');

  if (!state.currentDeacon) {
    cont.innerHTML = `<div class="empty-state"><div class="empty-icon">🙏</div>اختر خادم الافتقاد</div>`;
    document.getElementById('deacon-count').textContent = '';
    if (filterTabs) filterTabs.style.display = 'none';
    document.getElementById('deacon-filter-attendance-ctrl').style.display = 'none';
    document.getElementById('deacon-filter-absence-ctrl').style.display   = 'none';
    document.getElementById('deacon-filter-visit-ctrl').style.display     = 'none';
    document.getElementById('deacon-filter-birthday-ctrl').style.display  = 'none';
    return;
  }
  if (filterTabs) filterTabs.style.display = '';

  // this page shows "attended / absent last time", which needs the recent attendance history: loaded on demand
  if (!state.attendanceLevel) {
    cont.innerHTML = '<div class="loading"><div class="spinner"></div>جاري التحميل…</div>';
    ensureAttendance('recent').then(() => window.renderDeaconList());
    return;
  }

  const base = state.allStudents.filter(s => isDeaconOf(s, state.currentDeacon));
  let list = base;
  let itemLine = null; // custom function(s) -> secondary line html, null = default

  if (state.currentDeaconFilter === 'attendance') {
    const wantCount = parseInt(document.getElementById('deacon-filter-attendance-count').value);
    const allDates = Object.keys(state.allAttendance).sort().reverse();
    const lastNDates = allDates.slice(0, wantCount);
    list = base.filter(s => lastNDates.length === wantCount && lastNDates.every(d => !!state.allAttendance[d]?.[s.id]))
      .map(s => {
        let lastDate = null;
        Object.entries(state.allAttendance).forEach(([date, rec]) => { if (rec[s.id] && (!lastDate || date > lastDate)) lastDate = date; });
        return { ...s, lastAttendDate: lastDate };
      });
    itemLine = s => s.lastAttendDate
      ? '✅ آخر حضور: ' + new Date(s.lastAttendDate + 'T00:00:00').toLocaleDateString('ar-EG',{day:'numeric',month:'long'})
      : '✅ لم يحضر أبداً';
  } else if (state.currentDeaconFilter === 'absence') {
    const wantCount = parseInt(document.getElementById('deacon-filter-absence-count').value);
    const allDates = Object.keys(state.allAttendance).sort().reverse();
    const lastNDates = allDates.slice(0, wantCount);
    list = base.filter(s => lastNDates.length && lastNDates.every(d => !state.allAttendance[d]?.[s.id]))
      .map(s => {
        let lastDate = null;
        Object.entries(state.allAttendance).forEach(([date, rec]) => { if (rec[s.id] && (!lastDate || date > lastDate)) lastDate = date; });
        return { ...s, lastAttendDate: lastDate };
      });
    itemLine = s => s.lastAttendDate
      ? '📋 آخر حضور: ' + new Date(s.lastAttendDate + 'T00:00:00').toLocaleDateString('ar-EG',{day:'numeric',month:'long'})
      : '📋 لم يحضر أبداً';
  } else if (state.currentDeaconFilter === 'visit') {
    const status = document.getElementById('deacon-filter-visit-status').value; // 'visited' | 'notvisited'
    list = base.filter(s => isVisitedThisMonth(s) === (status === 'visited'));
    itemLine = s => s.lastVisitPhone
      ? '📞 آخر افتقاد: ' + new Date(s.lastVisitPhone).toLocaleDateString('ar-EG',{day:'numeric',month:'long',year:'numeric'})
      : '📞 لم يتم الافتقاد أبداً';
  } else if (state.currentDeaconFilter === 'birthday') {
    const month = document.getElementById('deacon-filter-birthday-month').value;
    if (!month) {
      document.getElementById('deacon-count').textContent = '';
      cont.innerHTML = `<div class="empty-state"><div class="empty-icon">🎂</div>اختر شهر لعرض المواليد</div>`;
      return;
    }
    list = base.filter(s => {
      if (!s.dob) return false;
      const d = new Date(s.dob + 'T00:00:00');
      return !isNaN(d.getTime()) && (d.getMonth() + 1) === parseInt(month);
    }).sort((a, b) => new Date(a.dob).getDate() - new Date(b.dob).getDate());
    itemLine = s => '🎂 ' + new Date(s.dob + 'T00:00:00').toLocaleDateString('ar-EG',{day:'numeric',month:'long'});
  }

  document.getElementById('deacon-count').textContent = `${list.length} مخدوم`;

  if (!list.length) {
    const msgs = { all: 'لا يوجد مخدومين عند هذا الخادم', attendance: 'لا يوجد مخدومين بهذا الشرط', absence: 'لا يوجد غياب بهذا الشرط', visit: 'لا يوجد مخدومين بهذه الحالة', birthday: 'لا يوجد مواليد في هذا الشهر' };
    cont.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div>${msgs[state.currentDeaconFilter] || msgs.all}</div>`;
    return;
  }

  // آخر تاريخ حضور متسجل في النظام — بنستخدمه عشان نوري "حضر/غاب آخر مرة" بدل عدد المرات الإجمالي
  const lastAttDate = Object.keys(state.allAttendance).sort().reverse()[0] || null;

  cont.innerHTML = list.map(s => {
    const bdayStr = s.dob ? new Date(s.dob).toLocaleDateString('ar-EG',{day:'numeric',month:'long'}) : '';
    let lastTimeLine;
    if (!lastAttDate) lastTimeLine = 'لا يوجد سجلات حضور بعد';
    else lastTimeLine = state.allAttendance[lastAttDate]?.[s.id] ? '✅ حضر آخر مرة' : '📋 غاب آخر مرة';
    const line = itemLine ? itemLine(s) : `${bdayStr ? '🎂 ' + bdayStr + ' · ' : ''}${lastTimeLine}`;

    return `<div class="student-item">
      ${avatarBox(s, 42)}
      <div class="student-info">
        <div class="student-name">${s.name}</div>
        <div class="student-id">${line}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="action-btn" onclick="openProfile('${s.id}')">👤 ملف</button>
        <button class="action-btn" onclick="openEdit('${s.id}')">✏️ تعديل</button>
      </div>
    </div>`;
  }).join('');
};
