// @ts-nocheck
import { collection, writeBatch, doc, setDoc } from 'firebase/firestore';
import { state } from '@/core/state';
import { getDocsFast } from '@/core/firestore-helpers';
import { auth, db } from '@/core/firebase';
import { ALL_GRADES, SECTION } from '@/core/section';
import { buildActiveGradeBar, buildGradeFilters } from '@/features/shell/app-shell';
import { loadDeaconsList } from '@/features/servants/deacons';
import { loadStudents } from '@/features/students/students';
import { loadAllAttendance, renderTodayList } from '@/features/attendance/attendance';
import { logActivity } from '@/core/presence';

// ===== ترحيل بيانات ما قبل نظام السنين المتعددة (مرة واحدة بس) =====
// بينقل أي خادم/مخدوم/حساب معندوش سنة دراسية محددة (أو سنة مش من الأربعة الرسمية) لسنة رابعة ابتدائي
window.migrateLegacyData = async () => {
  if (state.currentUserRole !== 'admin') return;
  const targetGrade = 'سنة رابعة ابتدائي';
  if (!confirm(`هيتم نقل كل الخدام والمخدومين والحسابات اللي معندهاش سنة دراسية محددة لسنة "${targetGrade}". العملية دي بتتعمل مرة واحدة بس. متأكد؟`)) return;
  try {
    showToast('جاري الترحيل، لحظات...', 'success');

    // 1) خدام بدون سنة صحيحة (قسم الجهاز النشط بس)
    const deaconsSnap = await getDocsFast(collection(db, 'deacons'));
    let deaconsBatch = writeBatch(db);
    let deaconsCount = 0;
    deaconsSnap.docs.forEach(d => {
      const data = d.data();
      if ((data.section || 'boys') !== SECTION) return;
      const grade = data.grade;
      if (!grade || !ALL_GRADES.includes(grade)) {
        deaconsBatch.update(doc(db, 'deacons', d.id), { grade: targetGrade });
        deaconsCount++;
      }
    });
    if (deaconsCount) await deaconsBatch.commit();

    // 2) مخدومين بدون سنة صحيحة (قسم الجهاز النشط بس، على دفعات تحسبًا لأعداد كبيرة)
    const studentsSnap = await getDocsFast(collection(db, 'students'));
    let studentsBatch = writeBatch(db);
    let studentsCount = 0, opCount = 0;
    for (const d of studentsSnap.docs) {
      const data = d.data();
      if ((data.section || 'boys') !== SECTION) continue;
      const grade = data.grade;
      if (!grade || !ALL_GRADES.includes(grade)) {
        studentsBatch.update(doc(db, 'students', d.id), { grade: targetGrade });
        studentsCount++; opCount++;
        if (opCount === 450) { await studentsBatch.commit(); studentsBatch = writeBatch(db); opCount = 0; }
      }
    }
    if (opCount > 0) await studentsBatch.commit();

    // 3) حسابات الخدام (users) بدون سنة صحيحة — الأدمن مش محتاج سنة، بنسيبه زي ما هو
    const usersSnap = await getDocsFast(collection(db, 'users'));
    let usersCount = 0;
    for (const d of usersSnap.docs) {
      const u = d.data();
      if ((u.section || 'boys') !== SECTION) continue;
      if (u.role !== 'admin' && (!u.grade || !ALL_GRADES.includes(u.grade))) {
        await setDoc(doc(db, 'users', d.id), { grade: targetGrade }, { merge: true });
        usersCount++;
      }
    }

    // سجّل إن الترحيل خلص عشان الزرار يختفي من بعد كده
    await setDoc(doc(db, 'config', 'settings'), { legacyMigrated: true }, { merge: true });
    state.LEGACY_MIGRATED = true;
    const migrateWrap = document.getElementById('legacy-migrate-wrap');
    if (migrateWrap) migrateWrap.style.display = 'none';

    // بدّل السنة النشطة للسنة اللي رحّلنا لها عشان تشوف النتيجة على طول (حتى لو كانت هي نفسها المفتوحة)
    state.activeGrade = targetGrade;
    try { if (auth.currentUser) localStorage.setItem('activeGrade_' + auth.currentUser.uid, targetGrade); } catch(e) {}
    buildActiveGradeBar();
    buildGradeFilters();
    state.currentDeacon = null;
    await loadDeaconsList();
    await loadStudents();
    await loadAllAttendance();
    renderTodayList();
    backToDeaconList();
    updateDeaconsTabLabel();

    showToast(`تم الترحيل ✓ (${deaconsCount} خادم، ${studentsCount} مخدوم، ${usersCount} حساب)`, 'success');
    logActivity('ترحيل بيانات قديمة', `${targetGrade}: ${deaconsCount} خادم / ${studentsCount} مخدوم / ${usersCount} حساب`);
  } catch(e) {
    console.error(e);
    showToast('حصل خطأ أثناء الترحيل، حاول تاني', 'error');
  }
};
