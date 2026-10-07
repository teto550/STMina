// @ts-nocheck
import { doc, collection, serverTimestamp, writeBatch } from 'firebase/firestore';
import { deaconIdOfName } from '@/core/servants-index';
import { state } from '@/core/state';
import { newKidFields } from '@/core/access';
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

// أول صف فيه بيانات مخدومين (index من 0): بيتحدد من صف العناوين لو لقيناه، وإلا الشكل القديم (الصف الرابع)
let importStudentsDataStart = 3;

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
  importStudentsWB = null; importStudentsSheetRows = null; importStudentsKashf = null;
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

// بيشيل التطويل (ـ) والتشكيل من العناوين زي "الإســـــــــم"
function stripTatweel(t) { return t.toString().replace(/[\u0640\u064B-\u0652]/g, ''); }
// تطبيع عربي للمقارنة: من غير تطويل/تشكيل، وأ/إ/آ = ا، ى = ي، ة = ه
function normAr(t) { return stripTatweel(t).replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه'); }

// أرقام الموبايل في الإكسيل بتتخزن كأرقام فبيضيع الصفر اللي في الأول (1012345678 بدل 01012345678)
function phoneCellText(val) {
  const s = val.toString().trim();
  return (typeof val === 'number' && /^1[0125]\d{8}$/.test(s)) ? '0' + s : s;
}

// أول صف (في أول 8 صفوف) فيه عنوان عمود "اسم" = صف العناوين
function findImportHeaderRow(rows) {
  for (let r = 0; r < Math.min(rows.length, 8); r++) {
    if ((rows[r] || []).some(v => typeof v === 'string' && /اسم/.test(normAr(v)))) return r;
  }
  return -1;
}

// تخمين العمود المناسب لكل حقل من عنوانه (الأدمن يقدر يعدّله بعد كده من القوايم)
function guessImportColumns(headerRow) {
  const norm = (t) => normAr(t).trim();
  const out = {};
  const put = (key, c) => { if (out[key] === undefined) out[key] = c; };
  (headerRow || []).forEach((v, c) => {
    if (typeof v !== 'string' || !v.trim()) return;
    const h = norm(v);
    const isPhone = /تليفون|تلفون|موبايل|هاتف|محمول|واتس|رقم/.test(h);
    const isDad = /(^|\s)(ال)?اب(\s|$)|بابا|والد(\s|$)/.test(h);
    const isMom = /(^|\s)(ال)?ام(\s|$)|ماما|والده/.test(h);
    if (isPhone) {
      if (isDad) put('phoneDad', c);
      else if (isMom) put('phoneMom', c);
      else if (/مخدوم|طالب|ولد|طفل|شخصي/.test(h)) put('phoneStudent', c);
      else put('phoneDad', c);
    } else if (/عنوان|سكن|منطقه/.test(h)) put('address', c);
    else if (/ميلاد/.test(h)) put('dob', c);
    else if (/افتقاد|خادم/.test(h)) put('deacon', c);
    else if (/اسم/.test(h) && !isDad && !isMom && !/والد|اعتراف|كاهن/.test(h)) put('name', c);
  });
  return out;
}

// ===== شكل كشف "البيانات + غياب" (كل مخدوم في 3 صفوف + عنوان خادم قبل كل مجموعة) =====
//  صف 1: رقم | الاسم | تليفون الأب | الأم | الولد | رقم غير محدد صاحبه | العنوان | يوم/شهر/سنة الميلاد | المدرسة | أب الاعتراف | الرسامة
//  صف 2: تواريخ الحضور (من العمود C)    صف 3: true/false لكل تاريخ
//  وقبل كل مجموعة صف عنوان "مستر/ اسم الخادم" (ومجموعات "كنائس أخرى" و"مش متوزعين")
let importStudentsKashf = null; // الناتج بعد التحليل لو الشيت بالشكل ده

function isKashfLayout(rows) {
  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const row = rows[r] || [];
    const txt = row.map(v => (typeof v === 'string' ? normAr(v) : '')).join('|');
    if (/اسم/.test(txt) && /ولي/.test(txt) && /ميلاد/.test(txt)) return true;
  }
  return false;
}

// تاريخ خلية الحضور (رقم تسلسلي إكسيل أو Date أو نص) → 'YYYY-MM-DD'
function kashfDateCell(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
  if (typeof v === 'number') { const d = XLSX.SSF.parse_date_code(v); return d ? `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}` : ''; }
  return parseExcelDobCell(v);
}

function parseKashfSheet(rows) {
  const out = { students: [], dates: new Set(), notes: [] };
  let curDeacon = '';
  const seen = new Set();
  const str = (v) => (v === null || v === undefined) ? '' : v.toString().trim();
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    const a = row[0], b = row[1];
    // صف عنوان مجموعة: نص في أول عمود ومفيش اسم
    if (typeof a === 'string' && a.trim() && !str(b) && !/^الرقم/.test(normAr(a).trim())) {
      const t = a.trim();
      if (t === 'كنائس أخرى') continue; // نفس الخادم
      if (t === 'مش متوزعين') { curDeacon = ''; continue; }
      const names = t.split(/\s*[-–]\s*/).map(x => x.replace(/^\s*مستر\s*\/?\s*/, '').trim()).filter(Boolean);
      curDeacon = names[0] || '';
      if (names.length > 1) out.notes.push(`ℹ️ المجموعة "${t}" فيها أكتر من خادم — اتحطت على الأول (${curDeacon}).`);
      continue;
    }
    // صف مخدوم: رقم + اسم
    if (typeof a === 'number' && typeof b === 'string' && b.trim()) {
      const name = b.trim().replace(/\s+/g, ' ');
      const key = normalizeName(name);
      if (seen.has(key)) { out.notes.push(`⚠️ الاسم "${name}" مكرر في الشيت — اتجاهل التكرار الثاني.`); continue; }
      seen.add(key);
      const f = {};
      if (curDeacon) f.deacon = curDeacon;
      const dad = str(row[2]) && phoneCellText(row[2]), mom = str(row[3]) && phoneCellText(row[3]);
      const kid = str(row[4]) && phoneCellText(row[4]), unk = str(row[5]) && phoneCellText(row[5]);
      if (dad) f.phoneDad = dad;
      if (mom) f.phoneMom = mom;
      if (kid) f.phoneStudent = kid;
      // "رقم غير محدد صاحبه": بيتحط في أول خانة فاضية من (الأب، الأم) لأنه غالبًا رقم ولي الأمر
      if (unk) { if (!f.phoneDad) f.phoneDad = unk; else if (!f.phoneMom) f.phoneMom = unk; }
      if (str(row[6])) f.address = str(row[6]);
      const [dd, mm, yy] = [row[10], row[11], row[12]].map(x => parseInt(x));
      if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 1990) f.dob = `${yy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
      if (str(row[14])) f.confessor = str(row[14]);
      // الحضور: الصف اللي بعده تواريخ (من العمود C) والتالي true/false
      const dateRow = rows[r + 1] || [], markRow = rows[r + 2] || [];
      const present = [];
      for (let c = 2; c < dateRow.length; c++) {
        const d = kashfDateCell(dateRow[c]);
        if (!d) continue;
        out.dates.add(d);
        if (markRow[c] === true || markRow[c] === 'TRUE' || markRow[c] === 1) present.push(d);
      }
      out.students.push({ name, fields: f, present, row: r });
    }
  }
  out.dates = [...out.dates].sort();
  return out;
}

window.onImportStudentsFileChange = async () => {
  const fileInput = document.getElementById('import-students-file-input');
  document.getElementById('import-students-start-btn').disabled = true;
  document.getElementById('import-students-sheet-wrap').style.display = 'none';
  document.getElementById('import-students-mapping').style.display = 'none';
  importStudentsWB = null; importStudentsSheetRows = null; importStudentsKashf = null;
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

  // شكل كشف "البيانات + غياب": بيتعرّف عليه لوحده من غير ما تحدد أعمدة
  importStudentsKashf = isKashfLayout(rows) ? parseKashfSheet(rows) : null;
  if (importStudentsKashf) {
    const k = importStudentsKashf;
    const deacons = new Set(k.students.map(x => x.fields.deacon).filter(Boolean));
    document.getElementById('import-students-mapping-fields').innerHTML = `
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;font-size:13px;line-height:1.9;margin-bottom:10px">
        ✅ اتعرّف على شكل كشف "البيانات + غياب" — مفيش داعي تحدد أعمدة.<br>
        👤 ${k.students.length} مخدوم · 🙏 ${deacons.size} خادم · 📅 ${k.dates.length} تاريخ حضور${k.dates.length ? ` (${k.dates[0]} → ${k.dates[k.dates.length - 1]})` : ''}<br>
        اللي هيتاخد: الاسم، الخادم (من عنوان المجموعة)، التليفونات، العنوان، تاريخ الميلاد، أب الاعتراف.
      </div>`;
    document.getElementById('import-students-att-start-col').innerHTML =
      '<option value="all">استورد الحضور من الشيت (لحد التاريخ اللي تحت)</option><option value="">من غير حضور — بيانات المخدومين بس</option>';
    const today = new Date();
    document.getElementById('import-students-cutoff-date').value =
      `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    document.getElementById('import-students-mapping').style.display = 'block';
    document.getElementById('import-students-start-btn').disabled = false;
    return;
  }
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

  // تخمين مبدئي من صف العناوين (لو الشيت فيه عمود "الاسم")، وإلا الشكل القديم: البيانات من الصف الرابع
  const hdrRow = findImportHeaderRow(rows);
  importStudentsDataStart = hdrRow === -1 ? 3 : hdrRow + 1;
  if (hdrRow !== -1) {
    Object.entries(guessImportColumns(rows[hdrRow])).forEach(([key, c]) => {
      const el = document.getElementById('import-map-' + key);
      if (el) el.value = String(c);
    });
  }
  // لو لسه عمود الاسم مش متحدد: أول عمود فيه نص (مش رقم) في صفوف البيانات
  if (document.getElementById('import-map-name').value === '') {
    let guessNameCol = -1;
    for (let c = 0; c < maxCol && guessNameCol === -1; c++) {
      for (let r = importStudentsDataStart; r < Math.min(rows.length, importStudentsDataStart + 7); r++) {
        if (rows[r] && typeof rows[r][c] === 'string' && rows[r][c].trim()) { guessNameCol = c; break; }
      }
    }
    if (guessNameCol !== -1) document.getElementById('import-map-name').value = String(guessNameCol);
  }

  document.getElementById('import-students-att-start-col').innerHTML =
    optionsFor('<option value="">مفيش أعمدة حضور في الشيت ده</option>');

  document.getElementById('import-students-mapping').style.display = 'block';
  document.getElementById('import-students-start-btn').disabled = false;
}

const IMPORT_CHUNK = 400;

// بيكتب سجلات الحضور [{studentId, date}] ويحدّث attendanceCount لكل مخدوم اتأثر
async function writeImportedAttendance(toWrite, log) {
  if (!toWrite.length) return;
  let written = 0;
  for (let i = 0; i < toWrite.length; i += IMPORT_CHUNK) {
    const chunk = toWrite.slice(i, i + IMPORT_CHUNK);
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
  for (let i = 0; i < affectedIds.length; i += IMPORT_CHUNK) {
    const chunk = affectedIds.slice(i, i + IMPORT_CHUNK);
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

// رفع شيت كشف "البيانات + غياب" المتعرّف عليه (بيضيف الجديد ويحدّث الموجود في الفصل النشط + الحضور اختياريًا)
async function runKashfImport(k, cutoff, status, btn, log) {
  const withAtt = document.getElementById('import-students-att-start-col').value === 'all';
  status.style.display = 'block';
  status.textContent = '';
  btn.disabled = true; btn.textContent = 'جاري المعالجة…';
  try {
    log(`📚 هيتم الرفع للفصل النشط: ${state.activeGrade}`);
    k.notes.forEach(log);
    const nameToStudent = {};
    state.allStudents.filter(s => s.grade === state.activeGrade).forEach(s => { nameToStudent[normalizeName(s.name)] = s; });

    let toCreate = 0, toUpdate = 0;
    const batchOps = [];
    k.students.forEach((st, i) => {
      const fields = { ...st.fields };
      if (fields.deacon) fields.deaconId = deaconIdOfName(fields.deacon, sectionTag());
      const existing = nameToStudent[normalizeName(st.name)];
      if (existing) {
        if (Object.keys(fields).length) { batchOps.push({ type: 'update', ref: doc(db, 'students', existing.id), data: fields }); toUpdate++; }
      } else {
        const sid = 'STU-' + Date.now().toString(36).toUpperCase() + '-' + st.row;
        batchOps.push({ type: 'set', ref: doc(collection(db, 'students')), data: {
          name: st.name, grade: state.activeGrade, sid,
          dob: '', address: '', phoneDad: '', phoneMom: '', phoneStudent: '', confessor: '', deacon: '', deaconId: null,
          attendanceCount: 0, starCount: 0, photo: '', section: sectionTag(), createdAt: serverTimestamp(),
          ...(newKidFields(sectionTag(), state.activeGrade) || {}),
          ...fields
        }});
        toCreate++;
      }
    });
    log(`👤 هيتم إضافة ${toCreate} مخدوم جديد، وتحديث بيانات ${toUpdate} مخدوم موجود`);

    for (let i = 0; i < batchOps.length; i += IMPORT_CHUNK) {
      const chunk = batchOps.slice(i, i + IMPORT_CHUNK);
      const batch = writeBatch(db);
      chunk.forEach(op => { if (op.type === 'set') batch.set(op.ref, op.data); else batch.update(op.ref, op.data); });
      await batch.commit();
      log(`   ✓ اتحفظ بيانات ${Math.min(i + IMPORT_CHUNK, batchOps.length)}/${batchOps.length}`);
    }

    log('⏳ تحديث قائمة المخدومين…');
    await loadStudents({ force: true });

    if (withAtt && cutoff) {
      await ensureAttendance('full');
      const byName = {};
      state.allStudents.filter(s => s.grade === state.activeGrade).forEach(s => { byName[normalizeName(s.name)] = s; });
      const toWrite = [];
      k.students.forEach(st => {
        const student = byName[normalizeName(st.name)];
        if (!student) return;
        st.present.forEach(date => {
          if (date > cutoff) return;
          if (state.allAttendance[date] && state.allAttendance[date][student.id]) return;
          toWrite.push({ studentId: student.id, date });
        });
      });
      log(`📅 سجلات الحضور الجديدة (لحد ${cutoff}): ${toWrite.length}`);
      await writeImportedAttendance(toWrite, log);
    } else {
      log('ℹ️ اتحدّثت بيانات المخدومين بس من غير حضور.');
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
    console.error('import students (kashf) error:', e);
    log('❌ حدث خطأ أثناء الرفع: ' + (e.message || e));
    showToast('حدث خطأ أثناء الرفع', 'error');
    btn.disabled = false; btn.textContent = '▶ ابدأ الرفع';
  }
}

window.startImportStudentsData = async () => {
  await ensureAttendance('full'); // duplicates are skipped by comparing with the existing history
  const cutoff = document.getElementById('import-students-cutoff-date').value;
  const status = document.getElementById('import-students-status');
  const btn    = document.getElementById('import-students-start-btn');
  const log = (line) => { status.textContent += line + '\n'; status.scrollTop = status.scrollHeight; };

  if (!importStudentsSheetRows) { showToast('اختار ملف الإكسيل الأول', 'error'); return; }
  if (!state.activeGrade) { showToast('اختار السنة الدراسية الأول من الشريط فوق', 'error'); return; }

  if (importStudentsKashf) { await runKashfImport(importStudentsKashf, cutoff, status, btn, log); return; }

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

    for (let r = importStudentsDataStart; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const rawName = row[colMap.name];
      if (!rawName || typeof rawName !== 'string' || !rawName.trim()) { skipped++; continue; }
      const name = rawName.trim();
      const fields = {};
      if (colMap.deacon !== -1 && row[colMap.deacon])             { fields.deacon = row[colMap.deacon].toString().trim(); fields.deaconId = deaconIdOfName(fields.deacon, sectionTag()); }
      if (colMap.phoneDad !== -1 && row[colMap.phoneDad])         fields.phoneDad     = phoneCellText(row[colMap.phoneDad]);
      if (colMap.phoneMom !== -1 && row[colMap.phoneMom])         fields.phoneMom     = phoneCellText(row[colMap.phoneMom]);
      if (colMap.phoneStudent !== -1 && row[colMap.phoneStudent]) fields.phoneStudent = phoneCellText(row[colMap.phoneStudent]);
      if (colMap.address !== -1 && row[colMap.address])           fields.address      = row[colMap.address].toString().trim();
      if (colMap.dob !== -1 && row[colMap.dob]) { const dob = parseExcelDobCell(row[colMap.dob]); if (dob) fields.dob = dob; }

      const existing = nameToStudent[normalizeName(name)];
      if (existing) {
        if (Object.keys(fields).length) { // مفيش داعي لتحديث فاضي
          batchOps.push({ type: 'update', ref: doc(db, 'students', existing.id), data: fields });
          toUpdate++;
        }
      } else {
        const sid = 'STU-' + Date.now().toString(36).toUpperCase() + '-' + r;
        const ref = doc(collection(db, 'students'));
        batchOps.push({ type: 'set', ref, data: {
          name, grade: state.activeGrade, sid,
          dob: '', address: '', phoneDad: '', phoneMom: '', phoneStudent: '', confessor: '', deacon: '', deaconId: null,
          attendanceCount: 0, starCount: 0, photo: '', section: sectionTag(), createdAt: serverTimestamp(),
          ...(newKidFields(sectionTag(), state.activeGrade) || {}), // gender + cell when they can be told (not for grades 1-2 of the girls' section)
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
      for (let r = importStudentsDataStart; r < rows.length; r++) {
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
      await writeImportedAttendance(toWrite, log);
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
