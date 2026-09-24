// @ts-nocheck
import { writeBatch, doc, collection, serverTimestamp } from 'firebase/firestore';
import { state } from '@/core/state';
import { db } from '@/core/firebase';
import { sectionTag } from '@/core/section';
import { loadAllAttendance, renderTodayList } from '@/features/attendance/attendance';
import { loadStudents } from '@/features/students/students';
import { logActivity } from '@/core/presence';
import { ensureAttendance } from '@/core/data';

// ===== IMPORT ATTENDANCE FROM EXCEL =====
export async function ensureXLSXLoaded() {
  if (window.XLSX) return;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

window.openImportModal = () => {
  document.getElementById('import-file-input').value = '';
  const status = document.getElementById('import-status');
  status.style.display = 'none';
  status.textContent = '';
  document.getElementById('import-start-btn').disabled = false;
  document.getElementById('import-start-btn').textContent = '▶ ابدأ الاستيراد';
  document.getElementById('import-attendance-modal').style.display = 'block';
  document.body.style.overflow = 'hidden';
};

window.closeImportModal = () => {
  document.getElementById('import-attendance-modal').style.display = 'none';
  document.body.style.overflow = '';
};

export function normalizeName(n) {
  return (n || '').toString()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u064B-\u0652\u0640]/g, '')   // remove Arabic diacritics (tashkeel) and tatweel
    .replace(/[أإآٱ]/g, 'ا')                  // unify alef variants (أ إ آ ٱ) -> ا
    .replace(/ى/g, 'ي')                       // unify alef maksura -> ya
    .replace(/ة/g, 'ه')                       // unify ta marbuta -> ha
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
}

// بحث متسامح مع اختلاف كتابة الحروف العربية (أ/إ/آ = ا، ى = ي، ة = ه...) — يستخدم في كل خانات البحث بالاسم
export function nameMatchesSearch(name, q) {
  return normalizeName(name).includes(normalizeName(q));
}

// Normalize Excel date-header rows (year/month per merged group, day per column)
// into an ISO date string 'YYYY-MM-DD' for every column, forward-filling merged values.
export function buildColumnDateMap(rows) {
  const yearRow  = rows[0] || [];
  const monthRow = rows[1] || [];
  const dayRow   = rows[2] || [];
  const maxCol = Math.max(yearRow.length, monthRow.length, dayRow.length);
  let lastYear = null, lastMonth = null;
  const map = {};
  for (let c = 1; c < maxCol; c++) {
    if (yearRow[c]  !== undefined && yearRow[c]  !== null && yearRow[c]  !== '') lastYear  = yearRow[c];
    if (monthRow[c] !== undefined && monthRow[c] !== null && monthRow[c] !== '') lastMonth = monthRow[c];
    const day = dayRow[c];
    if (!lastYear || !lastMonth || day === undefined || day === null || day === '') continue;
    const y = parseInt(lastYear), m = parseInt(lastMonth), d = parseInt(day);
    if (!y || !m || !d) continue;
    map[c] = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  return map;
}

window.startImportAttendance = async () => {
  await ensureAttendance('full'); // duplicates are skipped by comparing with the existing history
  const fileInput = document.getElementById('import-file-input');
  const cutoff    = document.getElementById('import-cutoff-date').value;
  const status    = document.getElementById('import-status');
  const btn       = document.getElementById('import-start-btn');
  const log = (line) => { status.textContent += line + '\n'; status.scrollTop = status.scrollHeight; };

  if (!fileInput.files.length) { showToast('اختار ملف الإكسيل الأول', 'error'); return; }
  if (!cutoff) { showToast('اختار تاريخ آخر يوم للاستيراد', 'error'); return; }

  status.style.display = 'block';
  status.textContent = '';
  btn.disabled = true; btn.textContent = 'جاري المعالجة…';

  try {
    log('⏳ تحميل مكتبة قراءة الإكسيل…');
    await ensureXLSXLoaded();

    log('⏳ قراءة الملف…');
    const buf = await fileInput.files[0].arrayBuffer();
    const wb  = XLSX.read(buf, { type: 'array', cellDates: false });
    const sheetName = wb.SheetNames.includes('الكشف') ? 'الكشف' : wb.SheetNames[0];
    const ws  = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

    const colDateMap = buildColumnDateMap(rows);
    const dateCols = Object.entries(colDateMap).filter(([c, date]) => date <= cutoff);
    log(`📅 هيتم استيراد ${dateCols.length} تاريخ (من الملف) لحد ${cutoff}`);

    // Build a lookup of existing students by normalized name
    const nameToStudent = {};
    state.allStudents.forEach(s => { nameToStudent[normalizeName(s.name)] = s; });

    const unmatched = new Set();
    const toWrite = []; // { studentId, date }
    let matchedStudents = 0;

    for (let r = 3; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const rawName = row[0];
      if (!rawName || typeof rawName !== 'string') continue;
      const name = normalizeName(rawName);
      const student = nameToStudent[name];
      if (!student) { unmatched.add(rawName.trim()); continue; }
      matchedStudents++;
      dateCols.forEach(([c, date]) => {
        const val = row[parseInt(c)];
        const present = val === true || val === 'TRUE' || val === 1;
        if (!present) return;
        if (state.allAttendance[date] && state.allAttendance[date][student.id]) return; // already recorded — skip
        toWrite.push({ studentId: student.id, date });
      });
    }

    log(`👤 اتطابق ${matchedStudents} مخدوم من الملف مع مخدومين مسجلين`);
    log(`🆕 عدد سجلات الحضور الجديدة اللي هتتضاف: ${toWrite.length}`);
    if (unmatched.size) {
      log(`⚠️ أسماء موجودة في الملف بس مش مسجلة في التطبيق (${unmatched.size}):`);
      [...unmatched].forEach(n => log('   • ' + n));
    }

    if (!toWrite.length) {
      log('✅ مفيش سجلات جديدة تتضاف (يمكن كلها متسجلة بالفعل).');
      btn.disabled = false; btn.textContent = '▶ ابدأ الاستيراد';
      return;
    }

    log('⏳ جاري الحفظ على قاعدة البيانات…');
    const CHUNK = 400;
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
      log(`   ✓ اتحفظ ${written}/${toWrite.length}`);
    }

    // Refresh local attendance cache + any visible lists
    await loadAllAttendance();

    // Sync the displayed "attendanceCount" field for affected students so it matches real records
    const affectedIds = [...new Set(toWrite.map(t => t.studentId))];
    if (affectedIds.length) {
      log('⏳ تحديث عدد مرات الحضور المعروض لكل مخدوم…');
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

    if (typeof renderTodayList === 'function') renderTodayList();
    if (typeof renderDeaconList === 'function') renderDeaconList();
    if (typeof renderStats === 'function') renderStats();
    if (typeof renderStudentsList === 'function') renderStudentsList();

    log(`🎉 تم استيراد ${written} سجل حضور بنجاح!`);
    showToast('تم الاستيراد بنجاح ✓', 'success');
    logActivity('استيراد حضور من إكسيل', `${written} سجل`);
    btn.disabled = false; btn.textContent = '✓ تم';
  } catch (e) {
    console.error('import error:', e);
    log('❌ حدث خطأ أثناء الاستيراد: ' + (e.message || e));
    showToast('حدث خطأ أثناء الاستيراد', 'error');
    btn.disabled = false; btn.textContent = '▶ ابدأ الاستيراد';
  }
};
