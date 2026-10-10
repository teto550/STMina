// @ts-nocheck
import { getDocs, query, collection, where, writeBatch, doc } from 'firebase/firestore';
import { state } from '@/core/state';
import { db } from '@/core/firebase';
import { GRADES, GRADE_SEQUENCE } from '@/core/section';
import { buildGradeFilters } from '@/features/shell/app-shell';
import { renderTodayList, updateStats } from '@/features/attendance/attendance';
import { logActivity } from '@/core/presence';

// شيل كل سجلات الحضور (كل التواريخ) الخاصة بمجموعة مخدومين معيّنين من فايرستور،
// من غير ما نلمس attendanceCount المحفوظ في ملف كل واحد — فيفضل عدد مرات الحضور
// مكتوب في ملفه حتى بعد ما تواريخ الحضور التفصيلية تتشال
async function purgeAttendanceForStudents(studentIds) {
  let deletedCount = 0;
  for (let i = 0; i < studentIds.length; i += 10) {
    const chunk = studentIds.slice(i, i + 10);
    const snap = await getDocs(query(collection(db, 'attendance'), where('studentId', 'in', chunk)));
    if (snap.empty) continue;
    let batch = writeBatch(db);
    let opCount = 0;
    for (const d of snap.docs) {
      const data = d.data();
      batch.delete(doc(db, 'attendance', d.id));
      deletedCount++;
      opCount++;
      if (state.allAttendance[data.date]) delete state.allAttendance[data.date][data.studentId];
      if (opCount === 450) { await batch.commit(); batch = writeBatch(db); opCount = 0; }
    }
    if (opCount > 0) await batch.commit();
  }
  return deletedCount;
}

// ترقية كل المخدومين سنة دراسية كاملة (مثلاً من تالتة ابتدائي لرابعة ابتدائي) — أدمن بس
window.promoteGradeYear = async () => {
  if (state.currentUserRole !== 'admin' && !state.currentUserIsLead && !state.currentUserIsPhaseLead) { showToast('الأدمن أو مسؤول السنة أو مسؤول المرحلة بس يقدروا يعملوا كده', 'error'); return; }
  const oldGrade = state.activeGrade || GRADES[0];
  const idx      = GRADE_SEQUENCE.indexOf(oldGrade);
  const newGrade = (idx !== -1 && idx < GRADE_SEQUENCE.length - 1) ? GRADE_SEQUENCE[idx + 1] : null;

  if (!newGrade || !GRADES.includes(newGrade)) {
    showToast('السنة دي آخر سنة في الابتدائي عندنا، مش هينفع ترقّي أكتر', 'error');
    return;
  }

  const affected = state.allStudents.filter(s => s.grade === oldGrade);
  if (!confirm(`هيتم نقل ${affected.length} مخدوم من "${oldGrade}" لـ "${newGrade}" (هيندمجوا مع مخدومين "${newGrade}" الحاليين). الإجراء ده هيتطبق على كل مخدومين السنة دي. متأكد؟`)) return;

  try {
    const batch = writeBatch(db);
    affected.forEach(s => batch.update(doc(db, 'students', s.id), { grade: newGrade }));
    await batch.commit();

    // بعد الترقية دول بقوا في سنة تانية، فمش هيظهروا في السنة النشطة دلوقتي
    state.allStudents = state.allStudents.filter(s => s.grade !== oldGrade);
    if (state.currentStuGrade === oldGrade) state.currentStuGrade = 'الكل';

    buildGradeFilters();
    renderStudentsList();
    updateStats();
    renderTodayList();

    showToast(`✅ اتنقل ${affected.length} مخدوم من "${oldGrade}" لـ "${newGrade}"`, 'success');
    logActivity('ترقية سنة دراسية', `${oldGrade} → ${newGrade} (${affected.length} مخدوم)`);

    // شيل كل تواريخ الحضور القديمة الخاصة بالمخدومين اللي اتنقلوا دلوقتي — عدد مرات
    // الحضور بتاعهم (attendanceCount) بيفضل محفوظ في ملفهم زي ما هو، بس التواريخ التفصيلية بتتشال
    // عشان كل سنة دراسية تبدأ حضورها من الصفر بعد الترقية (سنة تالتة غير رابعة غير خامسة غير سادسة)
    try {
      const purged = await purgeAttendanceForStudents(affected.map(s => s.id));
      updateStats();
      renderTodayList();
      if (purged > 0) showToast(`🧹 اتشال ${purged} سجل حضور قديم من السنة اللي فاتت`, 'success');
    } catch (e) {
      console.error(e);
      showToast('الترقية تمت، بس حصل خطأ أثناء تنظيف الحضور القديم — حاول تاني أو كلّم الأدمن', 'error');
    }
  } catch (e) {
    console.error(e);
    showToast('حصل خطأ أثناء الترقية، حاول تاني', 'error');
  }
};

