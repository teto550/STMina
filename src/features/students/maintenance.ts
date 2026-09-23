// @ts-nocheck
import { getDocs, query, collection, where, writeBatch, doc, setDoc } from 'firebase/firestore';
import { state } from '@/core/state';
import { db } from '@/core/firebase';
import { GRADES, GRADE_SEQUENCE, SECTION } from '@/core/section';
import { buildGradeFilters, updateAttendanceCleanupVisibility } from '@/features/shell/app-shell';
import { renderTodayList, updateStats } from '@/features/attendance/attendance';
import { logActivity } from '@/core/presence';
import { CLEANED_ATTENDANCE_GRADES } from '@/core/config';

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
      showToast('الترقية تمت، بس حصل خطأ أثناء تنظيف الحضور القديم — استخدم زرار "تنظيف حضور قديم"', 'error');
    }
  } catch (e) {
    console.error(e);
    showToast('حصل خطأ أثناء الترقية، حاول تاني', 'error');
  }
};

// تنظيف يدوي لمرة واحدة: شيل حضور قديم (قبل تاريخ معيّن) لمخدومين الفصل النشط دلوقتي (activeGrade)
// — بيستخدم لتصحيح ترقيات سنة اتعملت قبل إضافة التنظيف التلقائي (زي ترقية 11/9/2026)، أو أي
// تنظيف يدوي تاني. بيشتغل على الفصل اللي واقف فيه بس (نفس اللي شغال بيه من شريط الفصول فوق)،
// عشان allStudents أصلاً بيحمل مخدومين الفصل النشط بس. عدد مرات الحضور (attendanceCount) بيفضل
// محفوظ في ملف كل مخدوم زي ما هو، وبعد أول تنظيف ناجح للفصل ده الزرار بيختفي تلقائي.
window.cleanupOldAttendanceManual = async () => {
  if (state.currentUserRole !== 'admin') { showToast('الأدمن بس يقدر يعمل التنظيف ده', 'error'); return; }
  if (!state.activeGrade) { showToast('اختار الفصل الأول من شريط الفصول فوق', 'error'); return; }

  const cutoff = prompt(`هيتشال كل حضور "${state.activeGrade}" *قبل* التاريخ ده (يعني اليوم ده نفسه مش هيتشال). اكتب التاريخ بصيغة YYYY-MM-DD، مثلاً 2026-09-11:`);
  if (!cutoff || !/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) { showToast('صيغة التاريخ لازم تكون YYYY-MM-DD', 'error'); return; }

  const targetStudents = state.allStudents.filter(s => s.grade === state.activeGrade);
  if (!targetStudents.length) { showToast('مفيش مخدومين في الفصل النشط ده', 'error'); return; }

  if (!confirm(`هيتشال كل حضور ${targetStudents.length} مخدوم (${state.activeGrade}) قبل ${cutoff}.\nعدد مرات الحضور المحفوظ في ملف كل واحد هيفضل زي ما هو، بس التواريخ التفصيلية القديمة هتتشال نهائي.\nمتأكد؟`)) return;

  try {
    const ids = targetStudents.map(s => s.id);
    let deletedCount = 0;
    for (let i = 0; i < ids.length; i += 10) {
      const chunk = ids.slice(i, i + 10);
      const snap = await getDocs(query(collection(db, 'attendance'), where('studentId', 'in', chunk)));
      let batch = writeBatch(db);
      let opCount = 0;
      for (const d of snap.docs) {
        const data = d.data();
        if (data.date < cutoff) {
          batch.delete(doc(db, 'attendance', d.id));
          deletedCount++;
          opCount++;
          if (state.allAttendance[data.date]) delete state.allAttendance[data.date][data.studentId];
          if (opCount === 450) { await batch.commit(); batch = writeBatch(db); opCount = 0; }
        }
      }
      if (opCount > 0) await batch.commit();
    }
    updateStats();
    renderTodayList();
    showToast(`✅ اتشال ${deletedCount} سجل حضور قديم من "${state.activeGrade}"`, 'success');
    logActivity('تنظيف حضور قديم', `${state.activeGrade} قبل ${cutoff} (${deletedCount} سجل)`);

    // سجّل إن الفصل ده اتنضف عشان الزرار يختفي ليه (محفوظ في Firestore فيبان لكل الأدمنية بنفس الشكل)
    if (!CLEANED_ATTENDANCE_GRADES.includes(state.activeGrade)) {
      CLEANED_ATTENDANCE_GRADES.push(state.activeGrade);
      setDoc(doc(db, 'config', 'settings'), { [SECTION === 'girls' ? 'cleanedAttendanceGradesGirls' : 'cleanedAttendanceGrades']: CLEANED_ATTENDANCE_GRADES }, { merge: true }).catch(() => {});
    }
    updateAttendanceCleanupVisibility();
  } catch (e) {
    console.error(e);
    showToast('حصل خطأ أثناء التنظيف، حاول تاني', 'error');
  }
};
