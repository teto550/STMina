// @ts-nocheck
import { query, collection, orderBy, serverTimestamp, addDoc } from 'firebase/firestore';
import { state } from '@/core/state';
import { getDocsFast } from '@/core/firestore-helpers';
import { db } from '@/core/firebase';
import { inCurrentSection, sectionTag } from '@/core/section';
import { renderTodayList, updateStats } from '@/features/attendance/attendance';
import { logActivity } from '@/core/presence';
import { avatarBox } from '@/features/students/photos';
import { todayKey } from '@/core/utils';
import { nameMatchesSearch } from '@/features/import-export/import-attendance';

// ===== STUDENTS =====
export async function loadStudents() {
  const snap = await getDocsFast(query(collection(db,'students'), orderBy('name')));
  const all  = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(inCurrentSection);
  state.allStudents = state.activeGrade ? all.filter(s => s.grade === state.activeGrade) : all;
  updateStats();
  renderStudentsList();
}

window.toggleAddStudentForm = () => {
  const fields = document.getElementById('add-student-fields');
  const btn    = document.getElementById('add-student-toggle-btn');
  const isOpen = fields.style.display !== 'none';
  fields.style.display = isOpen ? 'none' : 'block';
  btn.textContent = isOpen ? '➕ إضافة مخدوم' : '✕ إغلاق';
  if (!isOpen) clearNewPhoto(); // فورم بيتفتح جديد، امسح أي صورة كانت متحطة قبل كده
};

window.addStudent = async () => {
  const name    = document.getElementById('new-name').value.trim();
  const grade   = document.getElementById('new-grade').value;
  if (!name)  { showToast('اكتب اسم المخدوم', 'error'); return; }
  if (!grade) { showToast('اختر الصف الدراسي', 'error'); return; }
  const sid = 'STU-' + Date.now().toString(36).toUpperCase();
  const data = {
    name, grade, sid,
    dob:             document.getElementById('new-dob').value || '',
    address:         document.getElementById('new-address').value.trim() || '',
    phoneDad:        document.getElementById('new-phone-dad').value.trim() || '',
    phoneMom:        document.getElementById('new-phone-mom').value.trim() || '',
    phoneStudent:    document.getElementById('new-phone-student').value.trim() || '',
    confessor:       document.getElementById('new-confessor').value.trim() || '',
    deacon:          document.getElementById('new-deacon').value.trim() || '',
    attendanceCount: parseInt(document.getElementById('new-att-count').value) || 0,
    starCount:       0,
    photo:           state.newPhotoData || '',
    section:         sectionTag(),
    createdAt:       serverTimestamp()
  };
  await addDoc(collection(db,'students'), data);
  // clear only name and extra fields, keep grade
  ['new-name','new-dob','new-address','new-phone-dad','new-phone-mom','new-phone-student','new-confessor','new-deacon','new-att-count']
    .forEach(id => document.getElementById(id).value = '');
  clearNewPhoto();
  showToast('تمت الإضافة ✓', 'success');
  logActivity('أضاف مخدوم جديد', name);
  await loadStudents();
  toggleAddStudentForm(); // اقفل الفورم تلقائي بعد الإضافة
};

window.setAttGrade = (g, btn) => {
  state.currentAttGrade = g;
  document.querySelectorAll('#att-grade-filter .grade-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updateStats();
  renderTodayList();
};

window.setStuGrade = (g, btn) => {
  state.currentStuGrade = g;
  document.querySelectorAll('#stu-grade-filter .grade-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderStudentsList();
};

function filteredStudents(grade) {
  if (grade === 'الكل') return state.allStudents;
  if (grade === 'بدون خادم') return state.allStudents.filter(s => !s.deacon);
  return state.allStudents.filter(s => s.grade === grade);
}

// آخر تاريخ حضور متسجل قبل النهارده (يعني "المرة الي فاتت"، مش الحضور الي بيتسجل دلوقتي)
function lastSessionDate() {
  const today = todayKey();
  const dates = Object.keys(state.allAttendance).filter(d => d !== today).sort().reverse();
  return dates[0] || null;
}

// فلاتر تاب الحضور: الكل / غاب آخر مرة / أعياد ميلاد الشهر
export function attFilteredStudents(filter) {
  if (filter === 'غاب آخر مرة') {
    const lastDate = lastSessionDate();
    if (!lastDate) return [];
    return state.allStudents.filter(s => !state.allAttendance[lastDate]?.[s.id]);
  }
  if (filter === 'أعياد ميلاد الشهر') {
    const month = new Date().getMonth() + 1;
    return state.allStudents.filter(s => {
      if (!s.dob) return false;
      const d = new Date(s.dob + 'T00:00:00');
      return (d.getMonth() + 1) === month;
    });
  }
  return state.allStudents; // 'الكل'
}

window.renderStudentsList = () => {
  const q    = document.getElementById('student-search').value.trim();
  let list   = filteredStudents(state.currentStuGrade);
  if (q) {
    const qDigits = q.replace(/[^0-9]/g, '');
    list = list.filter(s =>
      nameMatchesSearch(s.name, q) ||
      (qDigits && [s.phoneDad, s.phoneMom, s.phoneStudent].some(p => p && p.includes(qDigits)))
    );
  }
  const cont = document.getElementById('students-list');
  if (!list.length) {
    cont.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div>لا يوجد مخدومين</div>`;
    return;
  }
  cont.innerHTML = list.map(s =>
    `<div class="stu-card">
      ${avatarBox(s, 64)}
      <div class="stu-info">
        <div class="stu-name">${s.name}</div>
        <div class="stu-grade">${s.deacon || 'بدون خادم'}</div>
        <div style="font-size:12px;color:var(--accent);margin-top:4px;font-weight:700">✅ حضر ${s.attendanceCount || 0} مرة</div>
      </div>
      <div class="stu-actions">
        <button class="action-btn" onclick="openProfile('${s.id}')">👤 ملف</button>
        <button class="action-btn green" onclick="printOneCard('${s.id}')">🪪 كارت</button>
        <button class="action-btn red" onclick="deleteStudent('${s.id}','${s.name}')">🗑 حذف</button>
      </div>
    </div>`
  ).join('');
};

// ===== DELETE STUDENT =====
window.deleteStudent = async (id, name) => {
  if (!confirm(`هتحذف "${name}" من القائمة؟\nده مش هيحذف سجلات حضوره القديمة.`)) return;
  const { doc, deleteDoc } = await import("firebase/firestore");
  await deleteDoc(doc(db, 'students', id));
  state.allStudents = state.allStudents.filter(s => s.id !== id);
  delete state.todayAttendance[id];
  updateStats();
  renderTodayList();
  renderStudentsList();
  showToast(`تم حذف ${name}`, 'success');
  logActivity('حذف مخدوم', name);
};

// ===== DEACONS DASHBOARD (داشبورد الخدام) =====
export function studentPhonesLabel(s) {
  const phones = [s.phoneDad, s.phoneMom, s.phoneStudent].filter(p => p && p.trim());
  return phones.length ? phones.join(' — ') : 'لا يوجد رقم هاتف';
}
