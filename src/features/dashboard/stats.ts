// @ts-nocheck
import { updateDoc, doc } from 'firebase/firestore';
import { state } from '@/core/state';
import { DEACONS } from '@/features/servants/deacons';
import { avatarBox } from '@/features/students/photos';
import { db } from '@/core/firebase';
import { logActivity } from '@/core/presence';

// ===== STATS TAB =====
let currentStatsSubtab = 'attendance';

export function initStatsTab() {
  const sel = document.getElementById('stats-deacon-filter');
  const cur = sel.value;
  sel.innerHTML = '<option value="">كل الخدام</option>' +
    DEACONS.map(d => `<option${cur===d?' selected':''}>${d}</option>`).join('');
  renderStats();
}

window.switchStatsSubtab = (subtab, btn) => {
  currentStatsSubtab = subtab;
  document.querySelectorAll('#tab-stats > .tabs .tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('stats-panel-attendance').style.display = subtab === 'attendance' ? 'block' : 'none';
  document.getElementById('stats-panel-birthdays').style.display  = subtab === 'birthdays'  ? 'block' : 'none';
  document.getElementById('stats-panel-absence').style.display    = subtab === 'absence'    ? 'block' : 'none';
  document.getElementById('stats-panel-stars').style.display      = subtab === 'stars'       ? 'block' : 'none';
  renderStats();
};

window.renderStats = () => {
  if (currentStatsSubtab === 'attendance') renderAttendanceStats();
  else if (currentStatsSubtab === 'birthdays') renderBirthdayStats();
  else if (currentStatsSubtab === 'stars') renderStarStats();
  else renderAbsenceStats();
};

function renderAttendanceStats() {
  const deacon         = document.getElementById('stats-deacon-filter').value;
  const attendanceCount = parseInt(document.getElementById('stats-attendance-count').value);
  const cont            = document.getElementById('stats-attendance-list');
  const countEl         = document.getElementById('stats-attendance-count-label');

  // كل تواريخ الحضور المسجلة في النظام، مرتبة تنازليًا (الأحدث أولاً)
  const allDates = Object.keys(state.allAttendance).sort().reverse();
  const lastNDates = allDates.slice(0, attendanceCount);

  let list = deacon ? state.allStudents.filter(s => s.deacon === deacon) : [...state.allStudents];

  // اللي حضر آخر N مرة متسجلة كلها
  const result = list.filter(s => lastNDates.length === attendanceCount && lastNDates.every(d => !!state.allAttendance[d]?.[s.id]))
    .map(s => {
      let lastDate = null;
      Object.entries(state.allAttendance).forEach(([date, rec]) => {
        if (rec[s.id] && (!lastDate || date > lastDate)) lastDate = date;
      });
      return { ...s, lastAttendDate: lastDate };
    });

  countEl.textContent = `${result.length} مخدوم`;

  if (!result.length) {
    cont.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div>لا يوجد مخدومين بهذا الشرط' + (deacon ? ' لهذا الخادم' : '') + '</div>';
    return;
  }

  cont.innerHTML = result.map(s => {
    const lastLabel = s.lastAttendDate
      ? new Date(s.lastAttendDate + 'T00:00:00').toLocaleDateString('ar-EG', { day:'numeric', month:'long', year:'numeric' })
      : '';
    return `<div class="student-item" onclick="openProfile('${s.id}')" style="cursor:pointer">
      ${avatarBox(s, 42)}
      <div class="student-info">
        <div class="student-name">${s.name}</div>
        <div class="student-id">🙏 ${s.deacon || 'بدون خادم'}${lastLabel ? ' · آخر حضور: '+lastLabel : ''}</div>
      </div>
      <div style="background:rgba(46,204,113,0.12);border:1px solid rgba(46,204,113,0.3);color:var(--success);border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;white-space:nowrap">✅ آخر ${attendanceCount} مرة</div>
    </div>`;
  }).join('');
}

function renderStarStats() {
  const deacon  = document.getElementById('stats-deacon-filter').value;
  const cont    = document.getElementById('stats-stars-list');
  const countEl = document.getElementById('stats-stars-count-label');

  let list = deacon ? state.allStudents.filter(s => s.deacon === deacon) : [...state.allStudents];

  // ترتيب تنازلي: الأكتر نجوم الأول، وعند التساوي الأبجدي بالاسم
  list.sort((a, b) => (b.starCount || 0) - (a.starCount || 0) || a.name.localeCompare(b.name, 'ar'));

  countEl.textContent = `${list.length} مخدوم`;

  if (!list.length) {
    cont.innerHTML = '<div class="empty-state"><div class="empty-icon">⭐</div>لا يوجد مخدومين' + (deacon ? ' لهذا الخادم' : '') + '</div>';
    return;
  }

  cont.innerHTML = list.map((s, i) => {
    const count = s.starCount || 0;
    return `<div class="student-item" onclick="openProfile('${s.id}')" style="cursor:pointer">
      ${avatarBox(s, 42)}
      <div class="student-info">
        <div class="student-name">${i < 3 && count > 0 ? ['🥇','🥈','🥉'][i]+' ' : ''}${s.name}</div>
        <div class="student-id">🙏 ${s.deacon || 'بدون خادم'}</div>
      </div>
      <div style="background:rgba(241,196,15,0.15);border:1px solid rgba(241,196,15,0.35);color:#f1c40f;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;white-space:nowrap">⭐ ${count} / 6</div>
    </div>`;
  }).join('');
}

function renderBirthdayStats() {
  const deacon = document.getElementById('stats-deacon-filter').value;
  const month  = document.getElementById('stats-birthday-month').value;
  const cont   = document.getElementById('stats-birthday-list');
  const countEl = document.getElementById('stats-birthday-count');

  if (!month) {
    cont.innerHTML = '<div class="empty-state"><div class="empty-icon">🎂</div>اختر شهر لعرض المواليد</div>';
    countEl.textContent = '';
    return;
  }

  let list = state.allStudents.filter(s => {
    if (!s.dob) return false;
    const d = new Date(s.dob + 'T00:00:00');
    if (isNaN(d.getTime())) return false;
    return (d.getMonth() + 1) === parseInt(month);
  });
  if (deacon) list = list.filter(s => s.deacon === deacon);

  // ترتيب حسب يوم الميلاد
  list.sort((a, b) => new Date(a.dob).getDate() - new Date(b.dob).getDate());

  countEl.textContent = `${list.length} مخدوم`;

  if (!list.length) {
    cont.innerHTML = '<div class="empty-state"><div class="empty-icon">🎂</div>لا يوجد مواليد في هذا الشهر' + (deacon ? ' لهذا الخادم' : '') + '</div>';
    return;
  }

  cont.innerHTML = list.map(s => {
    const d = new Date(s.dob + 'T00:00:00');
    const dayLabel = d.toLocaleDateString('ar-EG', { day:'numeric', month:'long' });
    const currentYear = new Date().getFullYear();
    const given = s.giftYear === currentYear;
    return `<div class="student-item" style="cursor:pointer">
      <div onclick="openProfile('${s.id}')" style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
        ${avatarBox(s, 42)}
        <div class="student-info">
          <div class="student-name">${s.name}</div>
          <div class="student-id">🙏 ${s.deacon || 'بدون خادم'}</div>
        </div>
      </div>
      <div style="background:rgba(243,156,18,0.15);border:1px solid rgba(243,156,18,0.3);color:var(--warning);border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;white-space:nowrap">🎂 ${dayLabel}</div>
      <button onclick="event.stopPropagation();toggleBirthdayGift('${s.id}')" title="${given ? 'إلغاء' : 'خد الهدية'}" style="flex-shrink:0;width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:16px;font-weight:700;
        background:${given ? 'rgba(46,204,113,0.15)' : 'var(--surface2)'};
        border:1px solid ${given ? 'rgba(46,204,113,0.4)' : 'var(--border)'};
        color:${given ? 'var(--success)' : 'var(--text-dim)'}">${given ? '✓' : ''}</button>
    </div>`;
  }).join('');
}

// تسجيل/إلغاء إن الطفل خد هدية عيد ميلاده — بيتخزن السنة بس، فبيترشح تلقائي كل سنة جديدة
window.toggleBirthdayGift = async (id) => {
  const s = state.allStudents.find(x => x.id === id);
  if (!s) return;
  const currentYear = new Date().getFullYear();
  const alreadyGiven = s.giftYear === currentYear;
  const newValue = alreadyGiven ? 0 : currentYear;
  try {
    await updateDoc(doc(db, 'students', id), { giftYear: newValue });
    s.giftYear = newValue;
    renderBirthdayStats();
    showToast(alreadyGiven ? 'اتلغى ✓' : `🎁 اتسجل إن ${s.name} خد الهدية`, alreadyGiven ? 'info' : 'success');
    logActivity(alreadyGiven ? 'ألغى هدية عيد ميلاد' : 'سجّل هدية عيد ميلاد', s.name);
  } catch (e) {
    showToast('حصل خطأ، حاول تاني', 'error');
  }
};

function renderAbsenceStats() {
  const deacon       = document.getElementById('stats-deacon-filter').value;
  const absenceCount = parseInt(document.getElementById('stats-absence-count').value);
  const cont         = document.getElementById('stats-absence-list');
  const countEl      = document.getElementById('stats-absence-count-label');

  // كل تواريخ الحضور المسجلة في النظام، مرتبة تنازليًا (الأحدث أولاً)
  const allDates = Object.keys(state.allAttendance).sort().reverse();

  let list = deacon ? state.allStudents.filter(s => s.deacon === deacon) : [...state.allStudents];

  const result = list.filter(s => {
    // آخر N تواريخ حضور مسجلة — هل كان غايب في كل التواريخ دي؟
    const lastNDates = allDates.slice(0, absenceCount);
    if (!lastNDates.length) return false;
    return lastNDates.every(d => !state.allAttendance[d]?.[s.id]);
  }).map(s => {
    // آخر مرة حضر فيها (لو حضر قبل كده)
    let lastDate = null;
    Object.entries(state.allAttendance).forEach(([date, rec]) => {
      if (rec[s.id] && (!lastDate || date > lastDate)) lastDate = date;
    });
    return { ...s, lastAttendDate: lastDate };
  });

  countEl.textContent = `${result.length} مخدوم`;

  if (!result.length) {
    cont.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div>لا يوجد غياب بهذا الشرط' + (deacon ? ' لهذا الخادم' : '') + '</div>';
    return;
  }

  cont.innerHTML = result.map(s => {
    const lastLabel = s.lastAttendDate
      ? new Date(s.lastAttendDate + 'T00:00:00').toLocaleDateString('ar-EG', { day:'numeric', month:'long', year:'numeric' })
      : 'لم يحضر أبداً';
    return `<div class="student-item" onclick="openProfile('${s.id}')" style="cursor:pointer">
      ${avatarBox(s, 42)}
      <div class="student-info">
        <div class="student-name">${s.name}</div>
        <div class="student-id">🙏 ${s.deacon || 'بدون خادم'}</div>
      </div>
      <div style="background:rgba(231,76,60,0.12);border:1px solid rgba(231,76,60,0.3);color:var(--danger);border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;white-space:nowrap;text-align:center">آخر حضور:<br>${lastLabel}</div>
    </div>`;
  }).join('');
}
