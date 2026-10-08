// @ts-nocheck
import { writeBatch, doc, collection, serverTimestamp } from 'firebase/firestore';
import { state } from '@/core/state';
import { db } from '@/core/firebase';
import { sectionTag } from '@/core/section';
import { deaconIdOfName } from '@/core/servants-index';
import { ensureDeacons, ensureDeaconAttendance } from '@/core/data';
import { logActivity } from '@/core/presence';
import { buildColumnDateMap, ensureXLSXLoaded, normalizeName } from '@/features/import-export/import-attendance';
import {
  DEACON_ATTENDANCE, getCurrentUserScopedDeaconRows, renderDeaconAttDatesList
} from '@/features/servants/deacon-attendance';

// ===== رفع حضور الخدام القديم من إكسيل (أدمن بس) — بيكتب في deaconAttendance بنفس شكل التسجيل اليدوي =====
// الشيت: أسماء الخدام في عمود، وأعمدة التواريخ فيها TRUE/FALSE (أو 1 / ✓ / حاضر).
// بيتعرف على شكلين: (1) صف عناوين فيه تواريخ كاملة، (2) أول 3 صفوف = سنة/شهر/يوم (زي كشف مدارس الأحد).
// أي (خادم + يوم + نوع) متسجل قبل كده بيتخطى — فالاستيراد ممكن يتعاد من غير تكرار.

let plan = null; // { type, items: [{ name, date }], ... } — بتتبني في المعاينة وبتتكتب في "ابدأ الرفع"

const $ = (id) => document.getElementById(id);
const pad2 = (n) => String(n).padStart(2, '0');

function setStatus(text) {
  const el = $('import-deacon-att-status');
  el.style.display = text ? 'block' : 'none';
  el.textContent = text;
  el.scrollTop = el.scrollHeight;
}

window.openImportDeaconAttModal = () => {
  if (state.currentUserRole !== 'admin') { showToast('الاستيراد للأدمن بس', 'error'); return; }
  plan = null;
  $('import-deacon-att-file').value = '';
  $('import-deacon-att-cutoff').value = '';
  $('import-deacon-att-preview-btn').disabled = false;
  $('import-deacon-att-start-btn').disabled = true;
  $('import-deacon-att-start-btn').textContent = '▶ ابدأ الرفع';
  setStatus('');
  $('import-deacon-att-modal').style.display = 'block';
  document.body.style.overflow = 'hidden';
};

window.closeImportDeaconAttModal = () => {
  $('import-deacon-att-modal').style.display = 'none';
  document.body.style.overflow = '';
};

// أي تغيير في الملف/النوع/التاريخ بيلغي المعاينة القديمة
window.onImportDeaconAttInputChange = () => {
  plan = null;
  $('import-deacon-att-start-btn').disabled = true;
  $('import-deacon-att-start-btn').textContent = '▶ ابدأ الرفع';
};

// ---------- parsing ----------
function toIsoDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    if (v < 30000 || v > 80000) return null; // رقم عادي (يوم/عدد) مش تاريخ إكسيل
    return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  }
  const s = String(v).trim().replace(/[\u0660-\u0669]/g, (c) => c.charCodeAt(0) - 0x660);
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  return null;
}

function isPresentCell(v) {
  if (v === true || v === 1) return true;
  const s = String(v == null ? '' : v).trim().toLowerCase();
  return ['true', 'yes', 'y', '1', '✓', '✔', 'حاضر', 'حضر', 'present', 'p', 'ح'].includes(s);
}

// بيرجّع { dateCols: [{col, date}], firstDataRow, nameCol }
function detectLayout(rows) {
  // (1) صف عناوين فيه تواريخ كاملة
  let hdr = -1, best = 1;
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const cnt = (rows[r] || []).filter((c) => toIsoDate(c)).length;
    if (cnt > best) { best = cnt; hdr = r; }
  }
  if (hdr >= 0) {
    const dateCols = [];
    (rows[hdr] || []).forEach((c, i) => { const d = toIsoDate(c); if (d) dateCols.push({ col: i, date: d }); });
    const firstDateCol = dateCols[0].col;
    let nameCol = 0, bestTxt = -1;
    for (let c = 0; c < firstDateCol; c++) {
      let t = 0;
      for (let r = hdr + 1; r < rows.length; r++) { const v = (rows[r] || [])[c]; if (typeof v === 'string' && /[\u0621-\u064A]/.test(v)) t++; }
      if (t > bestTxt) { bestTxt = t; nameCol = c; }
    }
    return { dateCols, firstDataRow: hdr + 1, nameCol };
  }
  // (2) أول 3 صفوف سنة/شهر/يوم (نفس كشف مدارس الأحد)
  const map = buildColumnDateMap(rows);
  const dateCols = Object.entries(map).map(([c, date]) => ({ col: parseInt(c), date }));
  if (dateCols.length) return { dateCols, firstDataRow: 3, nameCol: 0 };
  throw new Error('مش لاقي تواريخ في الشيت (لا صف عناوين بتواريخ، ولا أول 3 صفوف سنة/شهر/يوم)');
}

// ---------- matching servants ----------
const cleanServantName = (n) => normalizeName(
  String(n || '').replace(/^\s*(مستر|ميس|الخادم|الخادمه|خادم|خادمه)\s*[/:\-]?\s*/i, '')
);

function levenshtein(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// بيرجّع { servant } لو في تطابق واحد بس، أو { ambiguous: true } أو {} لو مفيش. مفيش تخمين.
function matchServant(rawName, roster) {
  const n = cleanServantName(rawName);
  if (!n) return {};
  const exact = roster.filter((s) => s._n === n);
  if (exact.length === 1) return { servant: exact[0] };
  if (exact.length > 1) return { ambiguous: true };
  const toks = n.split(' ');
  const sub = roster.filter((s) => {
    const st = s._n.split(' ');
    const [short, long] = toks.length <= st.length ? [toks, st] : [st, toks];
    return short.length >= 2 && short.every((t) => long.includes(t));
  });
  if (sub.length === 1) return { servant: sub[0] };
  if (sub.length > 1) return { ambiguous: true };
  const near = roster
    .map((s) => ({ s, d: levenshtein(n, s._n) }))
    .filter((x) => x.d <= (n.length > 12 ? 2 : 1))
    .sort((a, b) => a.d - b.d);
  if (near.length === 1 || (near.length > 1 && near[0].d < near[1].d)) return { servant: near[0].s };
  if (near.length > 1) return { ambiguous: true };
  return {};
}

// ---------- step 1: preview (بيقرأ ويطابق من غير ما يكتب أي حاجة) ----------
window.previewImportDeaconAtt = async () => {
  const fileInput = $('import-deacon-att-file');
  if (!fileInput.files.length) { showToast('اختار ملف الإكسيل الأول', 'error'); return; }
  const type = $('import-deacon-att-type').value === 'meeting' ? 'meeting' : 'sunday';
  const cutoff = $('import-deacon-att-cutoff').value; // اختياري
  const btn = $('import-deacon-att-preview-btn');
  btn.disabled = true;
  plan = null;
  $('import-deacon-att-start-btn').disabled = true;
  let text = '';
  const log = (line) => { text += line + '\n'; setStatus(text); };
  setStatus('');
  try {
    log('⏳ تحميل بيانات الخدام والحضور الحالي…');
    await Promise.all([ensureDeacons(), ensureDeaconAttendance()]); // قراءة مرة واحدة (متخزنة 5 دقايق)
    await ensureXLSXLoaded();

    log('⏳ قراءة الملف…');
    const wb = XLSX.read(await fileInput.files[0].arrayBuffer(), { type: 'array', cellDates: false });
    const sheetName = wb.SheetNames.find((n) => /حضور|الكشف|خدام/.test(n)) || wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: null });
    log(`📄 الشيت: ${sheetName}`);

    const layout = detectLayout(rows);
    const dateCols = layout.dateCols.filter((d) => !cutoff || d.date <= cutoff);
    log(`📅 تواريخ في الملف: ${layout.dateCols.length}${cutoff ? ` (هيتستورد ${dateCols.length} لحد ${cutoff})` : ''}`);

    const roster = getCurrentUserScopedDeaconRows().map((r) => ({ name: r.name, _n: cleanServantName(r.name) }));
    const existing = DEACON_ATTENDANCE[type] || {};

    const items = [];
    const unmatched = [], ambiguous = [];
    let matched = 0, skippedExisting = 0;
    const seenPairs = new Set();

    for (let r = layout.firstDataRow; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const rawName = row[layout.nameCol];
      if (!rawName || typeof rawName !== 'string' || !/[\u0621-\u064A]/.test(rawName)) continue;
      const res = matchServant(rawName, roster);
      if (res.ambiguous) { ambiguous.push(rawName.trim()); continue; }
      if (!res.servant) { unmatched.push(rawName.trim()); continue; }
      matched++;
      const name = res.servant.name; // اسم الخادم المسجل في البرنامج (مش اسم الشيت)
      dateCols.forEach(({ col, date }) => {
        if (!isPresentCell(row[col])) return;
        const key = name + '|' + date;
        if (seenPairs.has(key)) return;
        seenPairs.add(key);
        if (existing[date] && existing[date][name]) { skippedExisting++; return; }
        items.push({ name, date });
      });
    }

    log(`🙏 اتطابق ${matched} خادم من الملف`);
    log(`🆕 سجلات حضور جديدة هتتضاف: ${items.length}`);
    if (skippedExisting) log(`⏭ متسجلة قبل كده وهتتخطى: ${skippedExisting}`);
    if (ambiguous.length) {
      log(`⚠️ أسماء ليها أكتر من تطابق (مش هتتكتب) (${ambiguous.length}):`);
      ambiguous.forEach((n) => log('   • ' + n));
    }
    if (unmatched.length) {
      log(`⚠️ أسماء مش مسجلة في البرنامج (مش هتتكتب) (${unmatched.length}):`);
      unmatched.forEach((n) => log('   • ' + n));
    }

    if (!items.length) {
      log('✅ مفيش سجلات جديدة تتضاف.');
    } else {
      const dates = [...new Set(items.map((i) => i.date))].sort();
      log(`📆 من ${dates[0]} إلى ${dates[dates.length - 1]} (${dates.length} يوم)`);
      log('👆 راجع التقرير، ولو تمام دوس "ابدأ الرفع".');
      plan = { type, items };
      $('import-deacon-att-start-btn').disabled = false;
    }
  } catch (e) {
    console.error('import deacon attendance preview error:', e);
    log('❌ ' + (e.message || e));
    showToast('حصل خطأ في قراءة الملف', 'error');
  } finally {
    btn.disabled = false;
  }
};

// ---------- step 2: write ----------
window.startImportDeaconAtt = async () => {
  if (state.currentUserRole !== 'admin') { showToast('الاستيراد للأدمن بس', 'error'); return; }
  if (!plan || !plan.items.length) { showToast('اعمل معاينة الأول', 'error'); return; }
  const { type, items } = plan;
  const startBtn = $('import-deacon-att-start-btn');
  const previewBtn = $('import-deacon-att-preview-btn');
  startBtn.disabled = true; previewBtn.disabled = true; startBtn.textContent = 'جاري الحفظ…';
  let text = $('import-deacon-att-status').textContent + '\n';
  const log = (line) => { text += line + '\n'; setStatus(text); };

  try {
    log('⏳ جاري الحفظ على قاعدة البيانات…');
    const CHUNK = 400;
    const section = sectionTag();
    let written = 0;
    for (let i = 0; i < items.length; i += CHUNK) {
      const chunk = items.slice(i, i + CHUNK);
      const batch = writeBatch(db);
      const refs = chunk.map((it) => {
        const ref = doc(collection(db, 'deaconAttendance'));
        // نفس الحقول اللي بيكتبها التسجيل اليدوي (markDeaconAttendance)
        batch.set(ref, { name: it.name, deaconId: deaconIdOfName(it.name, section), date: it.date, type, section, ts: serverTimestamp() });
        return ref;
      });
      await batch.commit();
      // تحديث الذاكرة فورًا من غير قراءة تانية من السيرفر
      chunk.forEach((it, k) => {
        if (!DEACON_ATTENDANCE[type][it.date]) DEACON_ATTENDANCE[type][it.date] = {};
        DEACON_ATTENDANCE[type][it.date][it.name] = refs[k].id;
      });
      written += chunk.length;
      log(`   ✓ اتحفظ ${written}/${items.length}`);
    }
    if (window.renderDeaconAttPicker) window.renderDeaconAttPicker();
    renderDeaconAttDatesList();
    if (window.renderServantsDirectory && state.servantsDirectoryOpen) window.renderServantsDirectory();

    log(`🎉 تم استيراد ${written} سجل حضور خدام بنجاح!`);
    showToast('تم الاستيراد بنجاح ✓', 'success');
    logActivity('استيراد حضور خدام من إكسيل', `${written} سجل`);
    plan = null;
    startBtn.textContent = '✓ تم';
  } catch (e) {
    console.error('import deacon attendance error:', e);
    log('❌ حدث خطأ أثناء الحفظ: ' + (e.message || e));
    log('ممكن تعيد: اللي اتحفظ هيتخطى لو عملت معاينة تاني (بعد تحديث البيانات).');
    showToast('حدث خطأ أثناء الاستيراد', 'error');
    startBtn.disabled = false; startBtn.textContent = '▶ ابدأ الرفع';
  } finally {
    previewBtn.disabled = false;
  }
};
