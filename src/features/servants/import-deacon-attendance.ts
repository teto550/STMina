// @ts-nocheck
import { writeBatch, doc, collection, serverTimestamp } from 'firebase/firestore';
import { state } from '@/core/state';
import { db } from '@/core/firebase';
import { sectionTag } from '@/core/section';
import { deaconIdOfName } from '@/core/servants-index';
import { ensureDeacons, ensureDeaconAttendance } from '@/core/data';
import { logActivity } from '@/core/presence';
import { todayKey } from '@/core/utils';
import { buildColumnDateMap, ensureXLSXLoaded, normalizeName } from '@/features/import-export/import-attendance';
import {
  DEACON_ATTENDANCE, DEACON_EXCUSES, getCurrentUserScopedDeaconRows, renderDeaconAttDatesList
} from '@/features/servants/deacon-attendance';

// ===== رفع حضور الخدام القديم من إكسيل (أدمن بس) — بيكتب في deaconAttendance بنفس شكل التسجيل اليدوي =====
// بيكتب مباشرة بعد المطابقة (زرار "ابدأ الرفع")؛ "معاينة بس" بتعرض التقرير من غير حفظ.
// الشيت: أسماء الخدام في عمود، وأعمدة التواريخ فيها TRUE/FALSE (أو 1 / ✓ / حاضر).
// بيتعرف على شكلين: (1) صف عناوين فيه تواريخ كاملة، (2) أول 3 صفوف = سنة/شهر/يوم (زي كشف مدارس الأحد).
// أي (خادم + يوم + نوع) متسجل قبل كده بيتخطى — فالاستيراد ممكن يتعاد من غير تكرار.

let plan = null; // { type, items: [{ name, date }] } — بتتبني من الملف (معاينة أو أول ما تدوس ابدأ) وبتتكتب في "ابدأ الرفع"

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
  $('import-deacon-att-start-btn').disabled = false;
  $('import-deacon-att-start-btn').textContent = '▶ ابدأ الرفع';
  setStatus('');
  $('import-deacon-att-modal').style.display = 'block';
  document.body.style.overflow = 'hidden';
};

window.closeImportDeaconAttModal = () => {
  $('import-deacon-att-modal').style.display = 'none';
  document.body.style.overflow = '';
};

// أي تغيير في الملف/النوع/التاريخ بيلغي الخطة القديمة
window.onImportDeaconAttInputChange = () => {
  plan = null;
  $('import-deacon-att-start-btn').disabled = false;
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

const TYPE_LABEL = { sunday: '⛪ مدارس الأحد', meeting: '👥 اجتماع الخدام' };

// بيرجّع { dateCols: [{col, date, cols: {sunday, meeting}}], firstDataRow, nameCol, dual }
// dual = كل أسبوع فيه عمودين حضور (مدارس الأحد ثم اجتماع الخدام، وبينهم أعمدة "إعتذار" بتتتجاهل)
function detectLayout(rows) {
  // (1) صف عناوين فيه تواريخ كاملة
  let hdr = -1, best = 1;
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const cnt = (rows[r] || []).filter((c) => toIsoDate(c)).length;
    if (cnt > best) { best = cnt; hdr = r; }
  }
  if (hdr >= 0) {
    const dateCols = [];
    (rows[hdr] || []).forEach((c, i) => { const d = toIsoDate(c); if (d) dateCols.push({ col: i, date: d, cols: { sunday: i, meeting: i, sundayExcuse: null, meetingExcuse: null } }); });
    const firstDateCol = dateCols[0].col;

    // صف عناوين "حضور / إعتذار": أول عمود حضور في كل مجموعة = مدارس الأحد، التاني = اجتماع الخدام
    let ph = -1, phBest = 1;
    for (let r = 0; r < Math.min(rows.length, 8); r++) {
      const cnt = (rows[r] || []).filter((c) => /^\s*حضور/.test(String(c || ''))).length;
      if (cnt > phBest) { phBest = cnt; ph = r; }
    }
    let dual = false;
    if (ph >= 0) {
      dateCols.forEach((d, i) => {
        const end = i + 1 < dateCols.length ? dateCols[i + 1].col : (rows[ph] || []).length;
        const pc = [], ec = [];
        for (let c = d.col; c < end; c++) {
          const h = String((rows[ph] || [])[c] || '');
          if (/^\s*حضور/.test(h)) pc.push(c);
          else if (/^\s*[إاأ]عتذار/.test(h)) ec.push(c);
        }
        if (pc.length) {
          d.cols = { sunday: pc[0], meeting: pc.length > 1 ? pc[1] : null, sundayExcuse: ec[0] ?? null, meetingExcuse: ec[1] ?? null };
          if (pc.length > 1) dual = true;
        }
      });
    }
    let nameCol = 0, bestTxt = -1;
    for (let c = 0; c < firstDateCol; c++) {
      let t = 0;
      for (let r = hdr + 1; r < rows.length; r++) { const v = (rows[r] || [])[c]; if (typeof v === 'string' && /[\u0621-\u064A]/.test(v)) t++; }
      if (t > bestTxt) { bestTxt = t; nameCol = c; }
    }
    return { dateCols, firstDataRow: Math.max(hdr, ph) + 1, nameCol, dual };
  }
  // (2) أول 3 صفوف سنة/شهر/يوم (نفس كشف مدارس الأحد)
  const map = buildColumnDateMap(rows);
  const dateCols = Object.entries(map).map(([c, date]) => ({ col: parseInt(c), date, cols: { sunday: parseInt(c), meeting: parseInt(c), sundayExcuse: null, meetingExcuse: null } }));
  if (dateCols.length) return { dateCols, firstDataRow: 3, nameCol: 0, dual: false };
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

// أقرب اسم مسجل (بعدد الكلمات المشتركة) — تلميح في التقرير بس، مش بيتكتب بيه حاجة
function closestHint(rawName, roster) {
  const toks = cleanServantName(rawName).split(' ');
  let best = null, bestScore = 0;
  roster.forEach((r) => {
    const st = r._n.split(' ');
    const score = toks.filter((t) => st.includes(t)).length;
    if (score > bestScore) { bestScore = score; best = r; }
  });
  return best ? `  ← أقرب اسم مسجل: ${best.name}` : '  ← مفيش اسم قريب في البرنامج';
}

// ---------- step 1: قراءة الملف ومطابقة الأسماء (من غير ما يكتب أي حاجة) ----------
// بيرجّع الخطة { type, items } أو null لو مفيش حاجة تتكتب
async function buildImportPlan() {
  const fileInput = $('import-deacon-att-file');
  if (!fileInput.files.length) { showToast('اختار ملف الإكسيل الأول', 'error'); return null; }
  const typeSel = $('import-deacon-att-type').value; // 'sunday' | 'meeting' | 'both'
  const types = typeSel === 'both' ? ['sunday', 'meeting'] : [typeSel === 'meeting' ? 'meeting' : 'sunday'];
  const cutoff = $('import-deacon-att-cutoff').value; // اختياري
  const btn = $('import-deacon-att-preview-btn');
  btn.disabled = true;
  plan = null;
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
    if (types.length > 1 && !layout.dual) throw new Error('الشيت ده مفيهوش عمودين حضور لكل أسبوع (مدارس الأحد + اجتماع الخدام) — اختار نوع واحد من القايمة.');
    const dateCols = layout.dateCols.filter((d) => !cutoff || d.date <= cutoff);
    const allDates = layout.dateCols.map((d) => d.date).sort();
    log(`📅 تواريخ في الملف: ${allDates.length} (من ${allDates[0]} إلى ${allDates[allDates.length - 1]})${cutoff ? ` — هيتستورد ${dateCols.length} لحد ${cutoff}` : ''}`);
    log(`   أول 5 تواريخ كما اتقرت: ${layout.dateCols.slice(0, 5).map((d) => d.date).join(' ، ')}`);
    const future = layout.dateCols.filter((d) => d.date > todayKey()).length;
    if (future) log(`⚠️ ${future} تاريخ في المستقبل (بعد النهاردة) — غالبًا اتقرت غلط (يوم/شهر أو السنة). راجع أول 5 تواريخ فوق.`);

    const roster = getCurrentUserScopedDeaconRows().map((r) => ({ name: r.name, _n: cleanServantName(r.name) }));
    const stats = {};
    types.forEach((t) => { stats[t] = { present: 0, pSkipped: 0, pAdded: 0, excuse: 0, eSkipped: 0, eAdded: 0, conflicts: 0 }; });
    const marksIn = (row) => types.reduce((n, t) => n + dateCols.reduce((m, d) =>
      m + (d.cols[t] != null && isPresentCell(row[d.cols[t]]) ? 1 : 0) + (d.cols[t + 'Excuse'] != null && isPresentCell(row[d.cols[t + 'Excuse']]) ? 1 : 0), 0), 0);

    const items = [];
    const unmatched = [], ambiguous = [];
    let matched = 0, nameRows = 0;
    const seenPairs = new Set();

    for (let r = layout.firstDataRow; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const rawName = row[layout.nameCol];
      if (!rawName || typeof rawName !== 'string' || !/[\u0621-\u064A]/.test(rawName)) continue;
      if (/^\s*(ال)?[اإأ]سم\s*$/.test(rawName)) continue; // خانة عنوان العمود مش خادم
      nameRows++;
      const res = matchServant(rawName, roster);
      if (res.ambiguous) { ambiguous.push(`${rawName.trim()} (${marksIn(row)} حضور مش هيترفع)`); continue; }
      if (!res.servant) { unmatched.push(`${rawName.trim()} (${marksIn(row)} حضور مش هيترفع)` + closestHint(rawName, roster)); continue; }
      matched++;
      const name = res.servant.name; // اسم الخادم المسجل في البرنامج (مش اسم الشيت)
      types.forEach((t) => {
        const existingP = DEACON_ATTENDANCE[t] || {};
        const existingE = DEACON_EXCUSES[t] || {};
        dateCols.forEach((d) => {
          const pCol = d.cols[t], eCol = d.cols[t + 'Excuse'];
          const isP = pCol != null && isPresentCell(row[pCol]);
          const isE = eCol != null && isPresentCell(row[eCol]);
          const key = t + '|' + name + '|' + d.date;
          if (!isP && !isE) return;
          if (seenPairs.has(key)) return;
          seenPairs.add(key);
          if (isP) { // الحضور له الأولوية لو الاتنين متعلّمين
            stats[t].present++;
            if (isE) stats[t].conflicts++;
            if (existingP[d.date] && existingP[d.date][name]) { stats[t].pSkipped++; return; }
            const replaceId = existingE[d.date] && existingE[d.date][name]; // كان معتذر وبقى حاضر
            items.push({ name, date: d.date, type: t, status: 'present', replaceId: replaceId || null });
            stats[t].pAdded++;
            return;
          }
          stats[t].excuse++;
          if (existingP[d.date] && existingP[d.date][name]) { stats[t].conflicts++; return; } // حاضر في البرنامج
          if (existingE[d.date] && existingE[d.date][name]) { stats[t].eSkipped++; return; }
          items.push({ name, date: d.date, type: t, status: 'excuse' });
          stats[t].eAdded++;
        });
      });
    }

    log(`👥 أسماء في الملف: ${nameRows} — اتطابق منهم: ${matched} (عدد الخدام المسجلين في البرنامج: ${roster.length})`);
    const presentCells = types.reduce((n, t) => n + stats[t].present + stats[t].excuse, 0);
    types.forEach((t) => {
      const x = stats[t];
      log(`${TYPE_LABEL[t]}:`);
      log(`   ✓ حضور: ${x.present} في الشيت — 🆕 جديد ${x.pAdded} — ⏭ متسجل قبل كده ${x.pSkipped}`);
      log(`   📝 اعتذار: ${x.excuse} في الشيت — 🆕 جديد ${x.eAdded} — ⏭ متسجل قبل كده ${x.eSkipped}`);
      if (x.conflicts) log(`   ⚠️ ${x.conflicts} خادم متعلّم حضور واعتذار (أو حاضر في البرنامج) في نفس اليوم — الحضور هو اللي اتاخد`);
    });
    if (ambiguous.length) {
      log(`⚠️ أسماء ليها أكتر من تطابق (مش هتتكتب) (${ambiguous.length}):`);
      ambiguous.forEach((n) => log('   • ' + n));
    }
    if (unmatched.length) {
      log(`⚠️ أسماء مش مسجلة في البرنامج (مش هتتكتب) (${unmatched.length}):`);
      unmatched.forEach((n) => log('   • ' + n));
    }

    if (!items.length) {
      log(matched === 0
        ? '❌ مفيش ولا اسم اتطابق مع الخدام المسجلين — راجع الأسماء في الشيت.'
        : presentCells === 0
          ? '❌ لقيت الأسماء بس مفيش ولا خانة حضور — راجع شكل الشيت.'
          : '✅ مفيش سجلات جديدة تتضاف (كلها متسجلة قبل كده).');
      return null;
    }
    const dates = [...new Set(items.map((i) => i.date))].sort();
    log(`📆 من ${dates[0]} إلى ${dates[dates.length - 1]} (${dates.length} يوم)`);
    plan = { items };
    return plan;
  } catch (e) {
    console.error('import deacon attendance preview error:', e);
    log('❌ ' + (e.message || e));
    showToast('حصل خطأ في قراءة الملف', 'error');
    return null;
  } finally {
    btn.disabled = false;
  }
}

window.previewImportDeaconAtt = async () => {
  const p = await buildImportPlan();
  if (p) setStatus($('import-deacon-att-status').textContent + '\n👆 دي معاينة بس — دوس "ابدأ الرفع" عشان تتحفظ.');
};

// ---------- step 2: الكتابة ----------
window.startImportDeaconAtt = async () => {
  if (state.currentUserRole !== 'admin') { showToast('الاستيراد للأدمن بس', 'error'); return; }
  const startBtn = $('import-deacon-att-start-btn');
  const previewBtn = $('import-deacon-att-preview-btn');
  startBtn.disabled = true; previewBtn.disabled = true; startBtn.textContent = 'جاري القراءة…';
  if (!plan) await buildImportPlan(); // لو مفيش معاينة قبل كده بنقرأ الملف الأول
  if (!plan || !plan.items.length) {
    startBtn.disabled = false; previewBtn.disabled = false; startBtn.textContent = '▶ ابدأ الرفع';
    return;
  }
  startBtn.textContent = 'جاري الحفظ…';
  const { items } = plan;
  let text = $('import-deacon-att-status').textContent + '\n';
  const log = (line) => { text += line + '\n'; setStatus(text); };

  try {
    log('⏳ جاري الحفظ على قاعدة البيانات…');
    const CHUNK = 200; // كل عنصر ممكن يبقى عمليتين (إضافة + حذف اعتذار قديم) والحد 500 عملية في الباتش
    const section = sectionTag();
    let written = 0;
    for (let i = 0; i < items.length; i += CHUNK) {
      const chunk = items.slice(i, i + CHUNK);
      const batch = writeBatch(db);
      const refs = chunk.map((it) => {
        const ref = doc(collection(db, 'deaconAttendance'));
        // نفس الحقول اللي بيكتبها التسجيل اليدوي (markDeaconAttendance)
        const data = { name: it.name, deaconId: deaconIdOfName(it.name, section), date: it.date, type: it.type, section, ts: serverTimestamp() };
        if (it.status === 'excuse') data.status = 'excuse'; // الاعتذار في نفس الكوليكشن بعلامة status
        batch.set(ref, data);
        if (it.replaceId) batch.delete(doc(db, 'deaconAttendance', it.replaceId)); // كان معتذر وبقى حاضر
        return ref;
      });
      await batch.commit();
      // تحديث الذاكرة فورًا من غير قراءة تانية من السيرفر
      chunk.forEach((it, k) => {
        const target = it.status === 'excuse' ? DEACON_EXCUSES : DEACON_ATTENDANCE;
        if (!target[it.type][it.date]) target[it.type][it.date] = {};
        target[it.type][it.date][it.name] = refs[k].id;
        if (it.replaceId && DEACON_EXCUSES[it.type][it.date]) {
          delete DEACON_EXCUSES[it.type][it.date][it.name];
          if (!Object.keys(DEACON_EXCUSES[it.type][it.date]).length) delete DEACON_EXCUSES[it.type][it.date];
        }
      });
      written += chunk.length;
      log(`   ✓ اتحفظ ${written}/${items.length}`);
    }
    if (window.renderDeaconAttPicker) window.renderDeaconAttPicker();
    renderDeaconAttDatesList();
    if (window.renderServantsDirectory && state.servantsDirectoryOpen) window.renderServantsDirectory();

    log(`🎉 تم استيراد ${written} سجل (حضور + اعتذار) بنجاح!`);
    showToast('تم الاستيراد بنجاح ✓', 'success');
    logActivity('استيراد حضور خدام من إكسيل', `${written} سجل`);
    plan = null;
    startBtn.textContent = '✓ تم';
  } catch (e) {
    console.error('import deacon attendance error:', e);
    log('❌ حدث خطأ أثناء الحفظ: ' + (e.message || e));
    log('ممكن تعيد الرفع: اللي اتحفظ بالفعل هيتخطى ومش هيتكرر.');
    showToast('حدث خطأ أثناء الاستيراد', 'error');
    startBtn.disabled = false; startBtn.textContent = '▶ ابدأ الرفع';
  } finally {
    previewBtn.disabled = false;
  }
};
