// @ts-nocheck
import { doc, collection, serverTimestamp, writeBatch } from 'firebase/firestore';
import { state } from '@/core/state';
import { buildColumnDateMap, ensureXLSXLoaded, normalizeName } from '@/features/import-export/import-attendance';
import { db } from '@/core/firebase';
import { sectionTag } from '@/core/section';
import { loadStudents } from '@/features/students/students';
import { loadAllAttendance, renderTodayList } from '@/features/attendance/attendance';
import { logActivity } from '@/core/presence';
import { ensureAttendance } from '@/core/data';

// ===== IMPORT STUDENTS DATA (+ optional attendance) FROM ONE EXCEL SHEET — للسنة الدراسية النشطة (activeGrade) بس =====
// الشيت فيه كل حاجة سوا: بيانات المخدوم + أعمدة حضور بعدها (أول 3 صفوف سنة/شهر/يوم، والبيانات تبدأ من الصف الرابع)
// أسماء الأعمدة مش موحدة بين الشيتات، فالأدمن هو اللي بيحدد كل عمود بيمثل إيه بعد ما يرفع الملف.
let importStudentsWB = null;

let importStudentsSheetRows = null;

const IMPORT_STUDENT_FIELDS = [
  { key: 'name',         label: 'الاسم',           required: true  },
  { key: 'deacon',       label: 'خادم الافتقاد',    required: false },
  { key: 'phoneDad',     label: 'تليفون الأب',      required: false },
  { key: 'phoneMom',     label: 'تليفون الأم',      required: false },
  { key: 'phoneStudent', label: 'تليفون المخدوم',   required: false },
  { key: 'address',      label: 'العنوان',          required: false },
  { key: 'dob',          label: 'تاريخ الميلاد',     required: false },
];

window.openImportStudentsModal = () => {
  if (state.currentUserRole !== 'admin') return;
  if (!state.activeGrade) { showToast('اختار السنة الدراسية الأول من الشريط فوق', 'error'); return; }
  document.getElementById('import-students-file-input').value = '';
  document.getElementById('import-students-sheet-wrap').style.display = 'none';
  document.getElementById('import-students-mapping').style.display = 'none';
  document.getElementById('import-students-mapping-fields').innerHTML = '';
  importStudentsWB = null; importStudentsSheetRows = null;
  const status = document.getElementById('import-students-status');
  status.style.display = 'none';
  status.textContent = '';
  const btn = document.getElementById('import-students-start-btn');
  btn.disabled = true; btn.textContent = '▶ ابدأ الرفع';
  document.getElementById('import-students-modal').style.display = 'block';
  document.body.style.overflow = 'hidden';
};

window.closeImportStudentsModal = () => {
  document.getElementById('import-students-modal').style.display = 'none';
  document.body.style.overflow = '';
};

// بيحوّل خلية تاريخ ميلاد (رقم تسلسلي إكسيل أو نص dd/mm/yyyy أو yyyy-mm-dd) لصيغة 'YYYY-MM-DD' زي حقل <input type=date>
function parseExcelDobCell(val) {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (!d) return '';
    return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  const s = val.toString().trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/); // dd/mm/yyyy أو dd-mm-yyyy
  if (m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
  return '';
}

// معاينة قصيرة لعمود معين (بتجمع أول 3 صفوف: عنوان نصي أو سنة/شهر/يوم) عشان الأدمن يقدر يميّز كل عمود وهو بيختار
function importColPreview(rows, c) {
  const cell = (r) => (rows[r] && rows[r][c] !== undefined && rows[r][c] !== null) ? rows[r][c].toString().trim() : '';
  const parts = [cell(0), cell(1), cell(2)].filter(Boolean);
  return parts.length ? parts.join(' / ') : '(بدون عنوان)';
}

window.onImportStudentsFileChange = async () => {
  const fileInput = document.getElementById('import-students-file-input');
  document.getElementById('import-students-start-btn').disabled = true;
  document.getElementById('import-students-sheet-wrap').style.display = 'none';
  document.getElementById('import-students-mapping').style.display = 'none';
  importStudentsWB = null; importStudentsSheetRows = null;
  if (!fileInput.files.length) return;
  try {
    await ensureXLSXLoaded();
    const buf = await fileInput.files[0].arrayBuffer();
    importStudentsWB = XLSX.read(buf, { type: 'array', cellDates: false });
    const sheetSel = document.getElementById('import-students-sheet-select');
    sheetSel.innerHTML = importStudentsWB.SheetNames.map(n => `<option value="${n}">${n}</option>`).join('');
    document.getElementById('import-students-sheet-wrap').style.display = importStudentsWB.SheetNames.length > 1 ? 'block' : 'none';
    onImportStudentsSheetChange();
  } catch (e) {
    console.error('read file error:', e);
    showToast('تعذّرت قراءة الملف', 'error');
  }
};

window.onImportStudentsSheetChange = () => {
  if (!importStudentsWB) return;
  const sheetSel = document.getElementById('import-students-sheet-select');
  const sheetName = sheetSel.value || importStudentsWB.SheetNames[0];
  const ws = importStudentsWB.Sheets[sheetName];
  importStudentsSheetRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  renderImportStudentsMapping();
};

function renderImportStudentsMapping() {
  const rows = importStudentsSheetRows;
  if (!rows || !rows.length) { showToast('الشيت ده فاضي', 'error'); return; }
  const maxCol = Math.max(0, ...rows.slice(0, 8).map(r => (r || []).length));
  const optionsFor = (extraFirst) => [extraFirst].concat(
    Array.from({ length: maxCol }, (_, c) => `<option value="${c}">العمود ${c + 1}: ${importColPreview(rows, c)}</option>`)
  ).join('');

  const fieldsEl = document.getElementById('import-students-mapping-fields');
  fieldsEl.innerHTML = IMPORT_STUDENT_FIELDS.map(f => `
    <div style="margin-bottom:10px">
      <label class="field-label">${f.label}${f.required ? ' *' : ''}</label>
      <select id="import-map-${f.key}" class="field-select">${optionsFor('<option value="">— بدون —</option>')}</select>
    </div>`).join('');

  // تخمين مبدئي لعمود الاسم: أول عمود فيه نص (مش رقم) في صفوف البيانات (من الصف الرابع)
  let guessNameCol = -1;
  for (let c = 0; c < maxCol && guessNameCol === -1; c++) {
    for (let r = 3; r < Math.min(rows.length, 10); r++) {
      if (rows[r] && typeof rows[r][c] === 'string' && rows[r][c].trim()) { guessNameCol = c; break; }
    }
  }
  if (guessNameCol !== -1) document.getElementById('import-map-name').value = String(guessNameCol);

  document.getElementById('import-students-att-start-col').innerHTML =
    optionsFor('<option value="">مفيش أعمدة حضور في الشيت ده</option>');

  document.getElementById('import-students-mapping').style.display = 'block';
  document.getElementById('import-students-start-btn').disabled = false;
}

window.startImportStudentsData = async () => {
  await ensureAttendance('full'); // duplicates are skipped by comparing with the existing history
  const cutoff = document.getElementById('import-students-cutoff-date').value;
  const status = document.getElementById('import-students-status');
  const btn    = document.getElementById('import-students-start-btn');
  const log = (line) => { status.textContent += line + '\n'; status.scrollTop = status.scrollHeight; };

  if (!importStudentsSheetRows) { showToast('اختار ملف الإكسيل الأول', 'error'); return; }
  if (!state.activeGrade) { showToast('اختار السنة الدراسية الأول من الشريط فوق', 'error'); return; }

  const nameColVal = document.getElementById('import-map-name').value;
  if (nameColVal === '') { showToast('لازم تحدد عمود الاسم', 'error'); return; }

  const colMap = {};
  IMPORT_STUDENT_FIELDS.forEach(f => {
    const v = document.getElementById('import-map-' + f.key).value;
    colMap[f.key] = v === '' ? -1 : parseInt(v);
  });
  const attStartVal = document.getElementById('import-students-att-start-col').value;
  const attStartCol = attStartVal === '' ? -1 : parseInt(attStartVal);

  status.style.display = 'block';
  status.textContent = '';
  btn.disabled = true; btn.textContent = 'جاري المعالجة…';

  try {
    const rows = importStudentsSheetRows;
    log(`📚 هيتم الرفع للسنة الدراسية النشطة: ${state.activeGrade}`);

    // خدام السنة النشطة بس (زي ما اتظهر في المتابعة)
    const scoped = state.allStudents.filter(s => s.grade === state.activeGrade);
    const nameToStudent = {};
    scoped.forEach(s => { nameToStudent[normalizeName(s.name)] = s; });

    let toCreate = 0, toUpdate = 0, skipped = 0;
    const batchOps = []; // { type:'set'|'update', ref, data }

    for (let r = 3; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const rawName = row[colMap.name];
      if (!rawName || typeof rawName !== 'string' || !rawName.trim()) { skipped++; continue; }
      const name = rawName.trim();
      const fields = {};
      if (colMap.deacon !== -1 && row[colMap.deacon])             fields.deacon       = row[colMap.deacon].toString().trim();
      if (colMap.phoneDad !== -1 && row[colMap.phoneDad])         fields.phoneDad     = row[colMap.phoneDad].toString().trim();
      if (colMap.phoneMom !== -1 && row[colMap.phoneMom])         fields.phoneMom     = row[colMap.phoneMom].toString().trim();
      if (colMap.phoneStudent !== -1 && row[colMap.phoneStudent]) fields.phoneStudent = row[colMap.phoneStudent].toString().trim();
      if (colMap.address !== -1 && row[colMap.address])           fields.address      = row[colMap.address].toString().trim();
      if (colMap.dob !== -1 && row[colMap.dob]) { const dob = parseExcelDobCell(row[colMap.dob]); if (dob) fields.dob = dob; }

      const existing = nameToStudent[normalizeName(name)];
      if (existing) {
        batchOps.push({ type: 'update', ref: doc(db, 'students', existing.id), data: fields });
        toUpdate++;
      } else {
        const sid = 'STU-' + Date.now().toString(36).toUpperCase() + '-' + r;
        const ref = doc(collection(db, 'students'));
        batchOps.push({ type: 'set', ref, data: {
          name, grade: state.activeGrade, sid,
          dob: '', address: '', phoneDad: '', phoneMom: '', phoneStudent: '', confessor: '', deacon: '',
          attendanceCount: 0, starCount: 0, photo: '', section: sectionTag(), createdAt: serverTimestamp(),
          ...fields
        }});
        toCreate++;
      }
    }

    log(`👤 هيتم إضافة ${toCreate} مخدوم جديد، وتحديث بيانات ${toUpdate} مخدوم موجود${skipped ? ` (اتجاهل ${skipped} صف من غير اسم)` : ''}`);

    const CHUNK = 400;
    for (let i = 0; i < batchOps.length; i += CHUNK) {
      const chunk = batchOps.slice(i, i + CHUNK);
      const batch = writeBatch(db);
      chunk.forEach(op => { if (op.type === 'set') batch.set(op.ref, op.data); else batch.update(op.ref, op.data); });
      await batch.commit();
      log(`   ✓ اتحفظ بيانات ${Math.min(i + CHUNK, batchOps.length)}/${batchOps.length}`);
    }

    log('⏳ تحديث قائمة المخدومين…');
    await loadStudents({ force: true });

    // ===== أعمدة الحضور (اختياري) — بتبدأ من العمود اللي الأدمن حدده =====
    if (attStartCol !== -1 && cutoff) {
      log('📅 هيتم استيراد الحضور كمان…');
      const colDateMapFull = buildColumnDateMap(rows);
      const dateCols = Object.entries(colDateMapFull).filter(([c, date]) => parseInt(c) >= attStartCol && date <= cutoff);
      log(`📅 هيتم استيراد ${dateCols.length} تاريخ لحد ${cutoff}`);

      const scoped2 = state.allStudents.filter(s => s.grade === state.activeGrade);
      const nameToStudent2 = {};
      scoped2.forEach(s => { nameToStudent2[normalizeName(s.name)] = s; });

      const unmatched = new Set();
      const toWrite = [];
      for (let r = 3; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        const rawName = row[colMap.name];
        if (!rawName || typeof rawName !== 'string') continue;
        const student = nameToStudent2[normalizeName(rawName)];
        if (!student) { unmatched.add(rawName.trim()); continue; }
        dateCols.forEach(([c, date]) => {
          const val = row[parseInt(c)];
          const present = val === true || val === 'TRUE' || val === 1;
          if (!present) return;
          if (state.allAttendance[date] && state.allAttendance[date][student.id]) return;
          toWrite.push({ studentId: student.id, date });
        });
      }
      log(`🆕 عدد سجلات الحضور الجديدة: ${toWrite.length}`);
      if (unmatched.size) {
        log(`⚠️ أسماء عندها حضور بس مش متطابقة (${unmatched.size}):`);
        [...unmatched].forEach(n => log('   • ' + n));
      }
      if (toWrite.length) {
        let written = 0;
        for (let i = 0; i < toWrite.length; i += CHUNK) {
          const chunk = toWrite.slice(i, i + CHUNK);
          const batch = writeBatch(db);
          chunk.forEach(item => {
            const ref = doc(collection(db, 'attendance'));
            batch.set(ref, { studentId: item.studentId, date: item.date, section: sectionTag(), timestamp: serverTimestamp() });
          });
          await batch.commit();
          written += chunk.length;
          log(`   ✓ اتحفظ حضور ${written}/${toWrite.length}`);
        }
        await loadAllAttendance();
        const affectedIds = [...new Set(toWrite.map(t => t.studentId))];
        for (let i = 0; i < affectedIds.length; i += CHUNK) {
          const chunk = affectedIds.slice(i, i + CHUNK);
          const batch2 = writeBatch(db);
          chunk.forEach(sid => {
            let count = 0;
            Object.values(state.allAttendance).forEach(rec => { if (rec[sid]) count++; });
            batch2.update(doc(db, 'students', sid), { attendanceCount: count });
          });
          await batch2.commit();
        }
        await loadStudents({ force: true });
      }
    } else {
      log('ℹ️ مفيش أعمدة حضور محددة — اتحدّثت بيانات المخدومين بس من غير حضور.');
    }

    if (typeof renderTodayList === 'function') renderTodayList();
    if (typeof renderDeaconList === 'function') renderDeaconList();
    if (typeof renderStats === 'function') renderStats();
    if (typeof renderStudentsList === 'function') renderStudentsList();

    log('🎉 تم رفع البيانات بنجاح!');
    showToast('تم الرفع بنجاح ✓', 'success');
    logActivity('رفع بيانات مخدومين من إكسيل', `${state.activeGrade} — ${toCreate} جديد / ${toUpdate} تحديث`);
    btn.disabled = false; btn.textContent = '✓ تم';
  } catch (e) {
    console.error('import students error:', e);
    log('❌ حدث خطأ أثناء الرفع: ' + (e.message || e));
    showToast('حدث خطأ أثناء الرفع', 'error');
    btn.disabled = false; btn.textContent = '▶ ابدأ الرفع';
  }
};
