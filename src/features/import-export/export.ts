// @ts-nocheck
import { collection, updateDoc, doc, increment } from 'firebase/firestore';
import { state } from '@/core/state';
import { db } from '@/core/firebase';
import { GRADES, inCurrentSection } from '@/core/section';
import { todayKey } from '@/core/utils';
import { renderTodayList, updateStats } from '@/features/attendance/attendance';
import { logActivity } from '@/core/presence';

// ===== EXPORT MODAL =====
window.openExportModal = () => {
  const dates   = Object.keys(state.allAttendance).sort().reverse();
  const cont    = document.getElementById('date-chips-container');
  state.selectedDates = [];
  if (!dates.length) { showToast('لا يوجد بيانات حضور بعد', 'info'); return; }
  cont.innerHTML =
    `<button class="date-chip all" onclick="toggleDateAll(this)">كل التواريخ</button>` +
    dates.map(d => {
      const parts = d.split('-');
      const label = `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
      return `<div class="date-chip-wrap">
        <button class="date-chip" data-date="${d}" onclick="toggleDate(this)">${label}</button>
        <button class="date-chip-del" onclick="event.stopPropagation(); deleteDateAttendance('${d}','${label}')" title="حذف هذا التاريخ نهائيًا">✕</button>
      </div>`;
    }).join('');
  document.getElementById('export-modal').style.display = 'flex';
};

window.closeExportModal = () => { document.getElementById('export-modal').style.display = 'none'; };

window.closeModalOutside = (e) => { if (e.target.id === 'export-modal') closeExportModal(); };

window.toggleDateAll = (btn) => {
  const all = document.querySelectorAll('#date-chips-container .date-chip:not(.all)');
  const isActive = btn.classList.contains('active');
  btn.classList.toggle('active');
  all.forEach(b => { b.classList.toggle('active', !isActive); });
  state.selectedDates = isActive ? [] : Array.from(all).map(b => b.dataset.date);
};

window.toggleDate = (btn) => {
  const date = btn.dataset.date;
  btn.classList.toggle('active');
  document.querySelector('.date-chip.all')?.classList.remove('active');
  if (btn.classList.contains('active')) {
    if (!state.selectedDates.includes(date)) state.selectedDates.push(date);
  } else {
    state.selectedDates = state.selectedDates.filter(d => d !== date);
  }
};

window.deleteDateAttendance = async (date, label) => {
  if (!confirm(`هتحذف كل سجلات الحضور بتاريخ ${label} نهائيًا من قاعدة البيانات؟\nده مش هينفع يترجع تاني.`)) return;
  const { query: q3, where: w3, getDocs: gd3, deleteDoc: dd3, doc: docRef3 } =
    await import("firebase/firestore");
  const snap = await gd3(q3(collection(db,'attendance'), w3('date','==',date)));
  for (const d of snap.docs) {
    if (!inCurrentSection(d.data())) continue; // ماتمسحش حضور القسم التاني
    const studentId = d.data().studentId;
    await dd3(docRef3(db,'attendance',d.id));
    await updateDoc(doc(db,'students',studentId), { attendanceCount: increment(-1) }).catch(() => {});
    const stu = state.allStudents.find(s => s.id === studentId);
    if (stu) stu.attendanceCount = Math.max(0, (stu.attendanceCount || 1) - 1);
  }
  delete state.allAttendance[date];
  if (date === todayKey()) state.todayAttendance = {};
  updateStats();
  renderTodayList();
  logActivity('حذف تاريخ حضور', label);
  showToast(`تم حذف تاريخ ${label} نهائيًا ✓`, 'success');
  openExportModal(); // refresh chips list
};

// ===== EXPORT EXCEL (ExcelJS - supports real cell styling) =====
window.doExport = async () => {
  if (!state.selectedDates.length) { showToast('اختر تاريخ واحد على الأقل', 'error'); return; }

  if (!window.ExcelJS) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  const selectedSortedDates = [...state.selectedDates].sort();
  const workbook = new ExcelJS.Workbook();

  // Group students by grade
  const gradeGroups = {};
  GRADES.forEach(g => {
    const studs = state.allStudents.filter(s => s.grade === g);
    if (studs.length) gradeGroups[g] = studs;
  });
  const noGrade = state.allStudents.filter(s => !s.grade || !GRADES.includes(s.grade));
  if (noGrade.length) gradeGroups['بدون صف'] = noGrade;

  const thinGray = { style: 'thin', color: { argb: 'FFCCCCCC' } };
  const borderAll = { top: thinGray, bottom: thinGray, left: thinGray, right: thinGray };

  Object.entries(gradeGroups).forEach(([grade, students]) => {
    // كل فصل منفصل عن التاني وممكن أيام حضوره تختلف — فبنعرض من التواريخ المختارة
    // بس الأيام اللي فعلاً فيها سجل حضور لطالب واحد على الأقل من الفصل ده، عشان
    // منضيفش عمود فاضي/مضلل لتاريخ الفصل ده أصلاً مكانش فيه حصة.
    const dates = selectedSortedDates.filter(d => students.some(s => state.allAttendance[d]?.[s.id]));

    const dateLabels = dates.map(d => {
      const p = d.split('-');
      return 'حضور ' + p[2] + '/' + p[1];
    });

    const sheetName = grade.slice(0, 31).replace(/[*?:\\/\[\]]/g, '');
    const ws = workbook.addWorksheet(sheetName, {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
    });

    // Columns: م / اسم المخدوم / حضور...
    ws.columns = [
      { width: 6 },
      { width: 32 },
      ...dateLabels.map(() => ({ width: 14 }))
    ];

    // Header row
    const headerRow = ws.addRow(['م', 'اسم المخدوم', ...dateLabels]);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2ECC71' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = borderAll;
    });

    // Data rows
    students.forEach((s, idx) => {
      const rowData = [idx + 1, s.name];
      dates.forEach(d => rowData.push(state.allAttendance[d]?.[s.id] ? '✓' : ''));
      const row = ws.addRow(rowData);

      row.eachCell((cell, colNumber) => {
        const isName  = colNumber === 2;
        const isCheck = cell.value === '✓';
        cell.font = {
          bold: isCheck,
          size: isCheck ? 12 : 11,
          color: { argb: 'FF000000' },
          name: 'Arial'
        };
        cell.alignment = { horizontal: isName ? 'right' : 'center', vertical: 'middle' };
        cell.border = borderAll;
        if (isCheck) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9F2E3' } };
        }
      });
    });
  });

  const today = new Date().toLocaleDateString('ar-EG');
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `حضور-${today}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  closeExportModal();
  showToast('تم التصدير ✓', 'success');
};
