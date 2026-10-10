// @ts-nocheck
import { query, collection, orderBy, where, serverTimestamp, addDoc, getDocs, writeBatch, doc } from 'firebase/firestore';
import { deaconIdOfName, deaconNameOf } from '@/core/servants-index';
import { state } from '@/core/state';
import { getDocsTtl } from '@/core/firestore-helpers';
import { ensureAttendance } from '@/core/data';
import { db } from '@/core/firebase';
import { SECTION, inCurrentSection, sectionTag } from '@/core/section';
import { newKidFields } from '@/core/access';
import { renderTodayList, updateStats } from '@/features/attendance/attendance';
import { logActivity } from '@/core/presence';
import { avatarBox } from '@/features/students/photos';
import { todayKey } from '@/core/utils';
import { nameMatchesSearch } from '@/features/import-export/import-attendance';

// ===== STUDENTS =====
export async function loadStudents({ force = false } = {}) {
  // Only the active class is kept in memory, so ask the server for just that class instead of every student
  // (was: read all students, then throw the other classes away). Equality on one field needs no extra index;
  // the name sort (same order Firestore's orderBy('name') gave) is done here.
  const grade = state.activeGrade; // the class this load is for: a class switch while loading must not mix data
  const students = collection(db, 'students');
  const snap = await getDocsTtl(grade ? query(students, where('grade', '==', grade)) : query(students, orderBy('name')), `students:${sectionTag()}:${grade || '*'}`, { force });
  if (grade !== state.activeGrade) return; // the user switched class meanwhile: the newer load owns the data
  const all  = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(inCurrentSection);
  if (grade) all.sort((a, b) => ((a.name || '') < (b.name || '') ? -1 : (a.name || '') > (b.name || '') ? 1 : 0));
  state.allStudents = grade ? all.filter(s => s.grade === grade) : all;
  updateStats();
  renderStudentsList();
}

window.toggleAddStudentForm = () => {
  const fields = document.getElementById('add-student-fields');
  const btn    = document.getElementById('add-student-toggle-btn');
  const isOpen = fields.style.display !== 'none';
  fields.style.display = isOpen ? 'none' : 'block';
  btn.textContent = isOpen ? '➕ إضافة مخدوم' : '✕ إغلاق';
  updateNewGenderVisibility();
  if (!isOpen) clearNewPhoto(); // فورم بيتفتح جديد، امسح أي صورة كانت متحطة قبل كده
};

// grades 1-2 in the girls' section hold boys and girls together: then (and only then) the servant picks the kid's gender
window.updateNewGenderVisibility = () => {
  const wrap = document.getElementById('new-gender-wrap');
  if (!wrap) return;
  const g = document.getElementById('new-grade').value;
  wrap.style.display = (SECTION === 'girls' && (g === 'سنة أولى ابتدائي' || g === 'سنة تانية ابتدائي')) ? 'block' : 'none';
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
    deaconId:        deaconIdOfName(document.getElementById('new-deacon').value, sectionTag()), // link by id (name kept for compatibility)
    attendanceCount: parseInt(document.getElementById('new-att-count').value) || 0,
    starCount:       0,
    photo:           state.newPhotoData || '',
    section:         sectionTag(),
    ...(newKidFields(sectionTag(), grade, document.getElementById('new-gender').value) || {}), // gender + cell (roles design)
    createdAt:       serverTimestamp()
  };
  if (SECTION === 'girls' && !data.gender) { showToast('اختر النوع (بنت أو ولد)', 'error'); return; }
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

window.setAttGrade = async (g, btn) => {
  state.currentAttGrade = g;
  document.querySelectorAll('#att-grade-filter .grade-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (g === 'غاب آخر مرة') await ensureAttendance('recent'); // this filter needs the recent attendance history
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
  if (grade === 'بدون خادم') return state.allStudents.filter(s => !deaconNameOf(s));
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

// المخدومين المعروضين دلوقتي (حسب فلتر السنة/الخادم + البحث)
function currentStudentsList() {
  const q    = document.getElementById('student-search').value.trim();
  let list   = filteredStudents(state.currentStuGrade);
  if (q) {
    const qDigits = q.replace(/[^0-9]/g, '');
    list = list.filter(s =>
      nameMatchesSearch(s.name, q) ||
      (qDigits && [s.phoneDad, s.phoneMom, s.phoneStudent].some(p => p && p.includes(qDigits)))
    );
  }
  return list;
}

window.renderStudentsList = () => {
  const bulkWrap = document.getElementById('bulk-delete-wrap');
  if (bulkWrap) bulkWrap.style.display = state.currentUserRole === 'admin' ? 'block' : 'none';
  const list = currentStudentsList();
  const cont = document.getElementById('students-list');
  if (!list.length) {
    cont.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div>لا يوجد مخدومين</div>`;
    return;
  }
  cont.innerHTML = list.map(s =>
    `<div class="stu-card"${selectMode ? ` onclick="toggleSel('${s.id}')" style="cursor:pointer"` : ''}>
      ${selectMode ? `<input type="checkbox" data-sid="${s.id}" ${selectedIds.has(s.id) ? 'checked' : ''} style="width:22px;height:22px;flex-shrink:0;pointer-events:none">` : ''}
      ${avatarBox(s, 64)}
      <div class="stu-info">
        <div class="stu-name">${s.name}</div>
        <div class="stu-grade">${deaconNameOf(s) || 'بدون خادم'}</div>
        <div style="font-size:12px;color:var(--accent);margin-top:4px;font-weight:700">✅ حضر ${s.attendanceCount || 0} مرة</div>
      </div>
      ${selectMode ? '' : `<div class="stu-actions">
        <button class="action-btn" onclick="openProfile('${s.id}')">👤 ملف</button>
        <button class="action-btn green" onclick="printOneCard('${s.id}')">🪪 كارت</button>
        <button class="action-btn red" onclick="deleteStudent('${s.id}','${s.name}')">🗑 حذف</button>
      </div>`}
    </div>`
  ).join('');
};

// ===== DELETE STUDENT(S) =====
// حذف نهائي (أدمن بس): ملف المخدوم + باسورده (student_secrets) + كل سجلات حضوره من Firestore.
// بيشتغل على دفعات من 30 مخدوم، والترتيب جوه كل دفعة (الباسورد -> الحضور -> ملف المخدوم) بيخلي أي توقف في النص
// آمن: المخدوم اللي ماخلّصش لسه موجود وتقدر تعيد الحذف تاني ويكمل من حيث وقف.
const PURGE_CHUNK = 30; // حد "in" في Firestore
async function purgeStudents(ids, backup, onProgress) {
  let attDeleted = 0, done = 0;
  for (let i = 0; i < ids.length; i += PURGE_CHUNK) {
    const chunk = ids.slice(i, i + PURGE_CHUNK);

    // 1) باسوردات المخدومين (لو القواعد لسه ماتنشرتش هيفشل هنا قبل ما يتمسح أي حاجة)
    const sb = writeBatch(db);
    chunk.forEach(id => sb.delete(doc(db, 'student_secrets', id)));
    try { await sb.commit(); }
    catch (e) { if (e && e.code === 'permission-denied') throw new Error('RULES'); throw e; }

    // 2) سجلات الحضور
    const snap = await getDocs(query(collection(db, 'attendance'), where('studentId', 'in', chunk)));
    for (let j = 0; j < snap.docs.length; j += 450) {
      const ab = writeBatch(db);
      snap.docs.slice(j, j + 450).forEach(d => ab.delete(d.ref));
      await ab.commit();
    }
    snap.docs.forEach(d => { const x = d.data(); backup.attendance.push({ studentId: x.studentId, date: x.date, section: x.section || '' }); });
    attDeleted += snap.docs.length;

    // 3) ملفات المخدومين نفسها
    const kb = writeBatch(db);
    chunk.forEach(id => kb.delete(doc(db, 'students', id)));
    await kb.commit();

    // 4) نضّف اللي في الذاكرة
    const gone = new Set(chunk);
    state.allStudents = state.allStudents.filter(s => !gone.has(s.id));
    chunk.forEach(id => {
      delete state.todayAttendance[id];
      Object.keys(state.allAttendance).forEach(d => { if (state.allAttendance[d]) delete state.allAttendance[d][id]; });
      selectedIds.delete(id);
    });
    done += chunk.length;
    if (onProgress) onProgress(done, ids.length);
  }
  return { students: done, attendance: attDeleted };
}

function downloadBackupJson(backup) {
  try {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backup-deleted-students-${todayKey()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (e) { console.error(e); }
}

// ===== تحديد المخدومين للحذف =====
let selectMode = false;
const selectedIds = new Set();
function updateBulkCount() {
  const el = document.getElementById('bulk-count');
  if (el) el.textContent = selectedIds.size + ' محدد';
}
window.toggleSelectMode = () => {
  if (state.currentUserRole !== 'admin') return;
  selectMode = !selectMode;
  selectedIds.clear();
  document.getElementById('bulk-bar').style.display = selectMode ? 'flex' : 'none';
  document.getElementById('select-mode-btn').textContent = selectMode ? '✖ خروج من التحديد' : '☑️ تحديد مخدومين للحذف';
  updateBulkCount();
  renderStudentsList();
};
window.toggleSel = id => {
  selectedIds.has(id) ? selectedIds.delete(id) : selectedIds.add(id);
  const cb = document.querySelector(`#students-list input[data-sid="${id}"]`);
  if (cb) cb.checked = selectedIds.has(id);
  updateBulkCount();
};
// بيحدد (أو بيلغي) كل المخدومين المعروضين دلوقتي حسب فلتر السنة والبحث — "الكل" + تحديد الكل = كل مخدومين الفصل
window.selectAllVisibleStudents = on => {
  selectedIds.clear();
  if (on) currentStudentsList().forEach(s => selectedIds.add(s.id));
  updateBulkCount();
  renderStudentsList();
};

window.deleteSelectedStudents = async () => {
  if (state.currentUserRole !== 'admin') { showToast('الأدمن بس يقدر يحذف مخدومين', 'error'); return; }
  const ids = [...selectedIds];
  if (!ids.length) { showToast('اختار مخدومين الأول', 'error'); return; }
  const picked = ids.map(id => state.allStudents.find(s => s.id === id)).filter(Boolean);
  const sample = picked.slice(0, 5).map(s => s.name).join('، ') + (picked.length > 5 ? '…' : '');
  if (!confirm(`هتحذف ${ids.length} مخدوم نهائيًا من البرنامج ومن الداتا بيز: ملفاتهم وكل سجلات حضورهم وباسورداتهم.\n(${sample})\n\nهينزل ملف نسخة احتياطية بالبيانات قبل ما تخلص. مفيش رجوع بعد كده. متأكد؟`)) return;
  if (ids.length >= 10 && prompt('للتأكيد اكتب كلمة: حذف') !== 'حذف') { showToast('اتلغى الحذف', 'error'); return; }

  const btn = document.getElementById('bulk-delete-btn');
  btn.disabled = true;
  // نسخة احتياطية: ملفات المخدومين (من غير الصور الكبيرة) + سجلات الحضور اللي هتتمسح
  const backup = { deletedAt: new Date().toISOString(), section: sectionTag(), students: picked.map(({ photo, ...rest }) => rest), attendance: [] };
  let result = null, failed = null;
  try {
    result = await purgeStudents(ids, backup, (d, n) => { btn.textContent = `⏳ ${d}/${n}`; });
  } catch (e) {
    console.error(e);
    failed = e;
  }
  downloadBackupJson(backup);
  btn.disabled = false; btn.textContent = '🗑 حذف المحدد';
  updateBulkCount(); updateStats(); renderTodayList(); renderStudentsList();
  if (failed) {
    if (failed.message === 'RULES') showToast('⛔ Firestore رفض الحذف. انشر قواعد Firestore الجديدة الأول (firebase deploy --only firestore:rules)', 'error');
    else if (failed.code === 'resource-exhausted') showToast('⛔ خلصت حصة Firestore النهارده. اللي اتحذف اتحذف، كمّل الباقي بكرة', 'error');
    else showToast('حصل خطأ أثناء الحذف. اللي ماتحذفش لسه موجود، حاول تاني', 'error');
    return;
  }
  selectMode = false; selectedIds.clear();
  document.getElementById('bulk-bar').style.display = 'none';
  document.getElementById('select-mode-btn').textContent = '☑️ تحديد مخدومين للحذف';
  renderStudentsList();
  showToast(`✅ اتحذف ${result.students} مخدوم و${result.attendance} سجل حضور`, 'success');
  logActivity('حذف جماعي للمخدومين', `${result.students} مخدوم (${sample})`);
};

window.deleteStudent = async (id, name) => {
  const isAdmin = state.currentUserRole === 'admin';
  if (!confirm(isAdmin
    ? `هتحذف "${name}" نهائيًا من البرنامج ومن الداتا بيز، هو وكل سجلات حضوره وباسورده. متأكد؟`
    : `هتحذف "${name}" من القائمة؟\nده مش هيحذف سجلات حضوره القديمة.`)) return;
  if (isAdmin) {
    const backup = { deletedAt: new Date().toISOString(), section: sectionTag(), students: state.allStudents.filter(s => s.id === id).map(({ photo, ...rest }) => rest), attendance: [] };
    try { await purgeStudents([id], backup); }
    catch (e) {
      console.error(e);
      showToast(e.message === 'RULES' ? '⛔ انشر قواعد Firestore الجديدة الأول' : 'حصل خطأ أثناء الحذف، حاول تاني', 'error');
      return;
    }
    downloadBackupJson(backup);
  } else {
    const { deleteDoc } = await import("firebase/firestore");
    await deleteDoc(doc(db, 'students', id));
    state.allStudents = state.allStudents.filter(s => s.id !== id);
    delete state.todayAttendance[id];
  }
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
