// @ts-nocheck
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, updateDoc, doc, increment } from 'firebase/firestore';
import { deaconNameOf } from '@/core/servants-index';
import { state } from '@/core/state';
import { getDocsTtl, countSnapshot } from '@/core/firestore-helpers';
import { db } from '@/core/firebase';
import { todayKey } from '@/core/utils';
import { inCurrentSection, sectionTag } from '@/core/section';
import { logActivity } from '@/core/presence';
import { attFilteredStudents } from '@/features/students/students';
import { avatarBox } from '@/features/students/photos';
import { nameMatchesSearch } from '@/features/import-export/import-attendance';

// ===== SYNC ATTENDANCE COUNTS =====
// ===== ATTENDANCE =====
// Attendance history is NOT loaded at start. 'recent' = the last 90 days (enough for "absent last time", the
// statistics and the servant lists), 'full' = the whole collection (export, import, cleanup). Both go through the
// short-lived read cache; `force` reads from the server.
const RECENT_DAYS = 90;
export async function loadAttendance(level = 'recent', { force = false } = {}) {
  const col = collection(db, 'attendance');
  const cutoff = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString().slice(0, 10);
  const q = level === 'full' ? col : query(col, where('date', '>=', cutoff));
  const snap = await getDocsTtl(q, `attendance-${level}:${sectionTag()}`, { force });
  state.allAttendance = {};
  const today = todayKey();
  snap.docs.forEach(d => {
    const data = d.data();
    if (!inCurrentSection(data)) return; // حضور القسم التاني مايظهرش هنا
    if (!state.allAttendance[data.date]) state.allAttendance[data.date] = {};
    state.allAttendance[data.date][data.studentId] = true;
  });
  if (Object.keys(state.todayAttendance).length) state.allAttendance[today] = { ...state.todayAttendance }; // keep what the live listener already knows
  state.attendanceLevel = level;
  updateStats();
}
// after imports / cleanups: read everything again from the server
export const loadAllAttendance = () => loadAttendance('full', { force: true });

// حضور النهارده بس، بث لحظي: أي خادم يسجل أو يشيل حضور، كل الخدام التانيين
// اللي فاتحين الموقع في نفس اللحظة يشوفوا التحديث فوراً من غير ما يعملوا reload
export function listenTodayAttendance() {
  if (state.todayAttendanceUnsub) { state.todayAttendanceUnsub(); state.todayAttendanceUnsub = null; }
  const today = todayKey();
  state.todayAttendanceUnsub = onSnapshot(
    query(collection(db,'attendance'), where('date','==', today)),
    snap => {
      countSnapshot('attendance today (live)', snap);
      state.todayAttendance = {};
      snap.docs.forEach(d => { if (inCurrentSection(d.data())) state.todayAttendance[d.data().studentId] = true; });
      if (!state.allAttendance[today]) state.allAttendance[today] = {};
      state.allAttendance[today] = { ...state.todayAttendance };
      updateStats();
      renderTodayList();
    },
    err => console.error('today attendance listener error:', err)
  );
}

export async function markPresent(studentId) {
  if (state.todayAttendance[studentId]) return false;
  const key = todayKey();
  const stu = state.allStudents.find(s => s.id === studentId);

  // تحديث فوري للواجهة (optimistic) — من غير ما ننتظر رد السيرفر.
  // ده اللي بيخلي التسجيل يحس إنه فوري حتى لو النت مقطوع؛ Firestore بيحفظ
  // الكتابة محلي (بسبب persistentLocalCache) وهيبعتها للسيرفر لوحده لما النت يرجع.
  if (stu) stu.attendanceCount = (stu.attendanceCount || 0) + 1;
  state.todayAttendance[studentId] = true;
  if (!state.allAttendance[key]) state.allAttendance[key] = {};
  state.allAttendance[key][studentId] = true;
  updateStats();
  renderTodayList();

  addDoc(collection(db,'attendance'), { studentId, date: key, section: sectionTag(), timestamp: serverTimestamp() })
    .then(() => updateDoc(doc(db,'students',studentId), { attendanceCount: increment(1) }))
    .then(() => logActivity('سجّل حضور', stu?.name || studentId))
    .catch(e => console.warn('markPresent sync error (هيتحاول يتزامن تاني لما النت يرجع):', e));

  return true;
}

export async function doRemoveAttendance(studentId) {
  const student = state.allStudents.find(s => s.id === studentId);
  const key = todayKey();

  // تحديث فوري للواجهة (optimistic)، من غير ما ننتظر رد السيرفر
  if (student) student.attendanceCount = Math.max(0, (student.attendanceCount || 1) - 1);
  delete state.todayAttendance[studentId];
  if (state.allAttendance[key]) delete state.allAttendance[key][studentId];
  updateStats();
  renderTodayList();

  // شيل السجل الفعلي من Firestore في الخلفية (هيتنفذ فورًا لو أونلاين،
  // أو يتقيّد في طابور Firestore المحلي ويتنفذ لوحده لما النت يرجع)
  (async () => {
    try {
      const { query: q2, where: w2, getDocs: gd2, deleteDoc, doc: docRef } =
        await import("firebase/firestore");
      const snap = await gd2(q2(collection(db,'attendance'), w2('studentId','==',studentId), w2('date','==',key)));
      for (const d of snap.docs) await deleteDoc(docRef(db,'attendance',d.id));
      await updateDoc(doc(db,'students',studentId), { attendanceCount: increment(-1) });
      logActivity('ألغى حضور', student?.name || studentId);
    } catch (e) {
      console.warn('doRemoveAttendance sync error (هيتحاول يتزامن تاني لما النت يرجع):', e);
    }
  })();
}

window.removeAttendance = async (studentId) => {
  const student = state.allStudents.find(s => s.id === studentId);
  if (!confirm(`هتشيل حضور "${student?.name}" من النهارده؟`)) return;
  await doRemoveAttendance(studentId);
  showToast('تم حذف الحضور ✓', 'success');
};

export function renderTodayList() {
  const cont = document.getElementById('today-list');
  let list   = attFilteredStudents(state.currentAttGrade);
  if (!list.length) {
    cont.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div>لا يوجد مخدومين</div>`;
    return;
  }
  const sorted = [...list].sort((a,b) => (!!state.todayAttendance[b.id]) - (!!state.todayAttendance[a.id]));
  const isBirthdayFilter = state.currentAttGrade === 'أعياد ميلاد الشهر';
  cont.innerHTML = sorted.map(s => {
    const present = !!state.todayAttendance[s.id];
    const bdayStr = s.dob ? new Date(s.dob + 'T00:00:00').toLocaleDateString('ar-EG',{day:'numeric',month:'long'}) : '';
    const subLine = isBirthdayFilter
      ? `${deaconNameOf(s) || 'بدون خادم'} <span style="font-size:10px;opacity:0.8">• 🎂 ${bdayStr || 'بدون تاريخ ميلاد'}</span>`
      : `${deaconNameOf(s) || 'بدون خادم'} <span style="font-size:10px;opacity:0.8">• حضر ${s.attendanceCount || 0} مرة</span>`;
    return `<div class="student-item ${present?'present':''}">
      ${avatarBox(s, 42)}
      <div class="student-info">
        <div class="student-name">${s.name}</div>
        <div class="student-id">${subLine}</div>
      </div>
      <div class="manual-check-box ${present ? 'checked' : ''}" onclick="manualToggleAttendance('${s.id}')">✓</div>
    </div>`;
  }).join('');
}

export function updateStats() {
  const list    = attFilteredStudents(state.currentAttGrade);
  const present = list.filter(s => !!state.todayAttendance[s.id]).length;
  document.getElementById('stat-total').textContent   = list.length;
  document.getElementById('stat-present').textContent = present;
  document.getElementById('stat-absent').textContent  = list.length - present;
}

// ===== MANUAL SEARCH =====
window.onManualSearch = () => {
  const q    = document.getElementById('manual-search').value.trim();
  const cont = document.getElementById('manual-results');
  if (!q) { cont.innerHTML = ''; return; }

  let list = attFilteredStudents(state.currentAttGrade).filter(s => nameMatchesSearch(s.name, q));
  list = list.slice(0, 6);

  if (!list.length) {
    cont.innerHTML = `<div style="color:var(--text-dim);font-size:13px;padding:10px 4px">لا يوجد مخدوم بهذا الاسم</div>`;
    return;
  }

  cont.innerHTML = list.map(s => {
    const already = !!state.todayAttendance[s.id];
    return `<div class="manual-result-item ${already ? 'already' : ''}" onclick="manualToggleAttendance('${s.id}')">
      ${avatarBox(s, 36)}
      <div style="flex:1">
        <div class="manual-result-name">${s.name}</div>
        <div class="manual-result-grade">${s.grade||''}</div>
      </div>
      <div class="manual-check-box ${already ? 'checked' : ''}">✓</div>
    </div>`;
  }).join('');
};

window.manualToggleAttendance = async (id) => {
  const student = state.allStudents.find(s => s.id === id);
  if (state.todayAttendance[id]) {
    await doRemoveAttendance(id);
    showToast(`تم إلغاء تسجيل ${student?.name || ''}`, 'info');
  } else {
    const ok = await markPresent(id);
    if (ok) {
      showToast(`✅ ${student?.name} — تم التسجيل`, 'success');
      navigator.vibrate && navigator.vibrate([60,30,60]);
    }
  }
  // clear the search box so the next name can be typed right away — only
  // if it's the field currently being used (avoid stealing focus/scroll
  // when the toggle was tapped from elsewhere, like today's list)
  const input = document.getElementById('manual-search');
  if (document.activeElement === input || input.value.trim()) {
    input.value = '';
    document.getElementById('manual-results').innerHTML = '';
    input.focus();
  }
};
