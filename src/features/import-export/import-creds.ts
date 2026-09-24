// @ts-nocheck
import { getDocs, collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { state } from '@/core/state';
import { ensureXLSXLoaded, normalizeName } from '@/features/import-export/import-attendance';
import { db } from '@/core/firebase';
import { inCurrentSection } from '@/core/section';
import { logActivity } from '@/core/presence';
import { loadStudents } from '@/features/students/students';

// ===== رفع ID والباسورد (أدمن) — قيم بتتسجل مرة واحدة وبعد كده ثابتة =====
// ID  → students/{id}.kidId          (ظاهر لكل الخدام)
// الباسورد → student_secrets/{id}.password (collection منفصلة، قواعد Firestore بتحصر قراءتها في الأدمن ومسؤول المرحلة)
let credsCache = null;   // { rows, students, secretIds }

let credsPlan  = null;

let credsDecisions = new Map();   // studentId -> صف الشيت اللي قبلته (أو null = لا)

let credsReviewBase = [];         // قايمة القرار (من غير أي قبول)

const CREDS_GRADE_WORD = { 3: 'تالتة', 4: 'رابعة', 5: 'خامسة', 6: 'سادسة' };

export function credsEsc(v) { return String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function credsTokens(n) { return normalizeName(n).split(' ').filter(Boolean); }

function credsIsPrefix(a, b) { return a.length <= b.length && a.every((t, i) => t === b[i]); }

function credsSameGrade(sheetGrade, appGrade) {
  const m = String(sheetGrade || '').match(/\d+/);
  const w = m ? CREDS_GRADE_WORD[+m[0]] : null;
  return !!w && String(appGrade || '').includes(w);
}

window.openCredsImportModal = () => {
  if (state.currentUserRole !== 'admin') return;
  credsCache = null; credsPlan = null; credsDecisions = new Map(); credsReviewBase = [];
  document.getElementById('creds-review').style.display = 'none';
  document.getElementById('creds-file-input').value = '';
  document.getElementById('creds-export-btn').style.display = 'none';
  const st = document.getElementById('creds-status'); st.style.display = 'none'; st.textContent = '';
  const btn = document.getElementById('creds-commit-btn'); btn.disabled = true; btn.textContent = '🔒 تثبيت نهائي';
  document.getElementById('creds-import-modal').style.display = 'block';
  document.body.style.overflow = 'hidden';
};

window.closeCredsImportModal = () => {
  document.getElementById('creds-import-modal').style.display = 'none';
  document.body.style.overflow = '';
  credsCache = null; credsPlan = null;
};

// ===== أرقام التليفون: بنطلّع كل أرقام الموبايل المصرية من أي نص (أرقام هندي/عربي، مسافات، +20، رقم من غير صفر) =====
function credsPhoneKeys(...vals) {
  const out = new Set();
  vals.forEach(v => {
    if (v == null || v === '' || v instanceof Date) return;
    let s = typeof v === 'number' ? (Number.isFinite(v) ? String(Math.round(v)) : '') : String(v);
    s = s.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, ch => { const c = ch.charCodeAt(0); return String(c >= 0x06F0 ? c - 0x06F0 : c - 0x0660); });
    s = s.replace(/(\d)[\s\-.]+(?=\d)/g, '$1');            // "010 15 88 52 71" → "01015885271"
    const re = /(?:(?:\+|00)?20)?0?(1[0125]\d{8})/g;          // بنخزّن آخر 10 أرقام (بدون الصفر) للمقارنة
    let m;
    while ((m = re.exec(s))) out.add(m[1]);
  });
  return out;
}

const credsPhoneShow = k => '0' + k;

const credsPhonesText = set => (set && set.size) ? [...set].map(credsPhoneShow).join('، ') : 'مفيش رقم';

function credsShare(a, b) { for (const x of a) if (b.has(x)) return true; return false; }

function credsLev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

// بيقرا الشيت اللي فيه أعمدة id / name / password (بالاسم مش بالترتيب) + أعمدة التليفونات
function credsParseWorkbook(wb) {
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: null });
    const hi = rows.findIndex(r => (r || []).some(c => typeof c === 'string' && c.trim().toLowerCase() === 'password'));
    if (hi === -1) continue;
    const head = rows[hi].map(c => String(c ?? '').trim().toLowerCase());
    const cId = head.indexOf('id'), cName = head.indexOf('name'), cPw = head.indexOf('password'), cGrade = head.indexOf('grade');
    const cPhones = ['phone', 'phone_parents', 'whatsapp'].map(h => head.indexOf(h)).filter(i => i !== -1);
    if (cId === -1 || cName === -1) continue;
    const out = [];
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i]; if (!r) continue;
      const idRaw = r[cId];
      const kidId = typeof idRaw === 'number' ? String(idRaw) : (idRaw == null ? '' : String(idRaw).trim());
      const name  = r[cName] == null ? '' : String(r[cName]).trim();
      if (!kidId || !name) continue;
      const pv = r[cPw];
      let pw = { kind: 'none' };
      if (pv instanceof Date)                          pw = { kind: 'date' };      // Excel حوّل النص لتاريخ — الأصل ضاع
      else if (typeof pv === 'number')                 pw = { kind: 'numeric', value: String(pv) };
      else if (typeof pv === 'string' && pv.trim())    pw = /^HMAC_/i.test(pv.trim()) ? { kind: 'hashed' } : { kind: 'ok', value: pv.trim() };
      const phones = credsPhoneKeys(...cPhones.map(ci => r[ci]));
      out.push({ kidId, name, grade: cGrade === -1 ? '' : r[cGrade], pw, phones });
    }
    return { sheetName, rows: out };
  }
  return null;
}

// ===== الصفوف: رقم السنة (الشيت قديم: سنة 3 في الشيت = سنة 4 في البرنامج) =====
function credsGradeNum(g) {
  const str = String(g ?? '');
  const d = str.match(/\d+/); if (d) return +d[0];
  if (/(اول|أول)/.test(str)) return 1;
  if (/(تاني|ثاني)/.test(str)) return 2;
  if (/(تالت|ثالث)/.test(str)) return 3;
  if (/رابع/.test(str)) return 4;
  if (/خامس/.test(str)) return 5;
  if (/سادس/.test(str)) return 6;
  return null;
}

// الفرق بين صف التطبيق وصف الشيت (المتوقع +1 لأن الشيت قديم، و0 لو الشيت اتحدّث)
function credsGradeDelta(sheetG, appG) {
  const a = credsGradeNum(appG), s = credsGradeNum(sheetG);
  return (a == null || s == null) ? null : a - s;
}

const credsGradeNote = (sheetG, appG) => {
  const s = credsGradeNum(sheetG), a = credsGradeNum(appG);
  return (s == null || a == null) ? '' : `سنة ${s} في الشيت ← سنة ${a} في التطبيق`;
};

// ===== تشابه الأسماء (بيستحمل غلطات الكتابة: مرسيلينو/مارسلينو، اباددير/ابادير، سامي/سامح) =====
function credsSkel(t) {                       // هيكل الحروف الساكنة: بيشيل حروف العلة والحروف المكررة والمتشابهة نطقًا
  let x = t.replace(/[صطذثظ]/g, c => ({ 'ص': 'س', 'ط': 'ت', 'ذ': 'ز', 'ث': 'س', 'ظ': 'ز' }[c]));
  x = x.replace(/(.)\1+/g, '$1');
  return x.charAt(0) + x.slice(1).replace(/[اويىءئؤ]/g, '');
}

const credsTokCache = new Map();

function credsTokSim(a, b) {
  if (a === b) return 1;
  const key = a < b ? a + '|' + b : b + '|' + a;
  let v = credsTokCache.get(key);
  if (v !== undefined) return v;
  const L = Math.max(a.length, b.length);
  if (L <= 3) v = 0.3;                        // كلمات قصيرة (علي / عمر / عمرو): مفيش تساهل
  else {
    v = 1 - credsLev(a, b) / L;
    if (v >= 0.6) {
      const sa = credsSkel(a), sb = credsSkel(b);
      if (sa.length >= 2 && sb.length >= 2) v = Math.max(v, 1 - credsLev(sa, sb) / Math.max(sa.length, sb.length) - 0.03);
    }
  }
  credsTokCache.set(key, v);
  return v;
}

function credsCmpTokens(name) {               // عبد + الملاك = عبدالملاك
  const t = credsTokens(name), out = [];
  for (let i = 0; i < t.length; i++) {
    if (['عبد', 'ابو', 'ابن'].includes(t[i]) && i + 1 < t.length) { out.push(t[i] + t[i + 1]); i++; }
    else out.push(t[i]);
  }
  return out;
}

// 0..1 — محاذاة كلمة بكلمة، والكلمات الزيادة في الآخر (اسم العيلة مثلًا) بتتخصم خصم صغير
function credsNameSim(ta, tb) {
  const n = ta.length, m = tb.length; if (!n || !m) return 0;
  const TRAIL = 0.4;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(Infinity));
  dp[0][0] = 0;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
    const c = dp[i][j]; if (c === Infinity) continue;
    if (i < n && j < m) dp[i + 1][j + 1] = Math.min(dp[i + 1][j + 1], c + (1 - credsTokSim(ta[i], tb[j])));
    if (i < n) dp[i + 1][j] = Math.min(dp[i + 1][j], c + 1);
    if (j < m) dp[i][j + 1] = Math.min(dp[i][j + 1], c + 1);
  }
  let best = Infinity;
  for (let j = 0; j <= m; j++) best = Math.min(best, dp[n][j] + TRAIL * (m - j));
  for (let i = 0; i <= n; i++) best = Math.min(best, dp[i][m] + TRAIL * (n - i));
  return Math.max(0, 1 - best / Math.max(n, m));
}

// بيبني خطة الكتابة من غير ما يكتب أي حاجة
// التلقائي: الاسم مطابق + رقم تليفون مشترك. أي حاجة تانية فيها شك (اسم متشابه، رقم مختلف، مفيش رقم…) بتتعرض عليك تقرر.
function credsBuildPlan(cache, opts) {
  const { rows, students, secretIds } = cache;
  const approvals = (opts && opts.approvals) || new Map();      // studentId -> صف الشيت اللي انت قبلته
  const plan = {
    ops: [], sheetTotal: rows.length, appTotal: students.length,
    matched: 0, auto: 0, manual: 0, newIds: 0, newPws: 0, idKept: 0, pwKept: 0, idConflict: 0,
    pwSkip: { hashed: 0, date: 0, none: 0 }, pwSkipList: [],
    confirmed: [], review: [], approvalConflicts: [], idConflictList: [],
    sheetNotInApp: [], sheetOutOfRange: [], appNotInSheet: []
  };
  const sC = new Map(rows.map(r => [r, credsCmpTokens(r.name)]));
  const aC = new Map(students.map(s => [s, credsCmpTokens(s.name)]));
  const aP = new Map(students.map(s => [s, credsPhoneKeys(s.phoneDad, s.phoneMom, s.phoneStudent)]));

  // 1) كل الأزواج (مخدوم، صف شيت) المتشابهة
  const pairs = [];
  students.forEach(s => {
    const ta = aC.get(s), ap = aP.get(s); if (!ta.length) return;
    rows.forEach(r => {
      const tb = sC.get(r); if (!tb.length) return;
      const first = credsTokSim(ta[0], tb[0]);
      if (first < 0.75) return;                       // اسم الولد نفسه لازم يكون متشابه (عشان الإخوات مايتلخبطوش)
      const sim = credsNameSim(ta, tb);
      if (sim < 0.5) return;
      const exact = sim >= 0.999;
      const phone = credsShare(ap, r.phones);
      const comparable = ap.size > 0 && r.phones.size > 0;
      const delta = credsGradeDelta(r.grade, s.grade);
      const gradeOk = delta == null || delta === 0 || delta === 1;
      pairs.push({
        s, r, sim, first, phone, comparable, delta, gradeOk, exact,
        cand: sim >= 0.72 || (phone && sim >= 0.6),
        verified: phone && exact,
        score: sim + (delta === 1 ? 0.03 : 0) + (phone ? 0.05 : 0)
      });
    });
  });

  // 2) التلقائي: اسم مطابق + رقم مشترك. لو فيه لبس (نفس الدرجة لأكتر من احتمال) بيروح للقرار بتاعك
  const qual = pairs.filter(p => p.verified);
  const ambiguous = new Set();
  const markTies = (keyOf) => {
    const g = new Map();
    qual.forEach(p => { const k = keyOf(p); (g.get(k) || g.set(k, []).get(k)).push(p); });
    g.forEach(list => {
      if (list.length < 2) return;
      list.sort((a, b) => b.score - a.score);
      if (Math.abs(list[0].score - list[1].score) < 0.01) list.forEach(p => ambiguous.add(p.s));
    });
  };
  markTies(p => p.s); markTies(p => p.r);
  const assignedRow = new Map(), assignedStu = new Map();
  qual.filter(p => !ambiguous.has(p.s)).sort((a, b) => b.score - a.score).forEach(p => {
    if (assignedStu.has(p.s) || assignedRow.has(p.r)) return;
    assignedStu.set(p.s, p); assignedRow.set(p.r, p);
  });

  // 3) اللي فيه شك → قايمة القرار
  const candByStu = new Map();
  pairs.forEach(p => { if (p.cand && !assignedRow.has(p.r)) (candByStu.get(p.s) || candByStu.set(p.s, []).get(p.s)).push(p); });
  const reviewRows = new Set();
  students.forEach(s => {
    if (assignedStu.has(s)) return;
    const cands = (candByStu.get(s) || []).sort((a, b) => b.score - a.score);
    if (!cands.length) { plan.appNotInSheet.push(s); return; }
    const best = cands[0];
    let reason;
    if (ambiguous.has(s)) reason = 'ambiguous';
    else if (best.phone) reason = !best.gradeOk ? 'gradeOff' : ((best.sim >= 0.82 && best.first >= 0.8) ? 'fuzzyPhone' : 'lowSim');
    else reason = best.comparable ? 'phoneMismatch' : 'noPhones';
    // اقتراحي (متعلّم ✔ من الأول): اسم متشابه ورقم مشترك، أو اسم مطابق (3 كلمات+) ومفيش أرقام تناقضه ومفيش غيره
    const okNoPhone = reason === 'noPhones' && best.exact && best.gradeOk && cands.length === 1 && aC.get(s).length >= 3 && sC.get(best.r).length >= 3;
    plan.review.push({ s, reason, cands: cands.slice(0, 3), appPhones: aP.get(s), suggested: (reason === 'fuzzyPhone' || okNoPhone) ? 0 : -1, accepted: null });
    cands.forEach(c => reviewRows.add(c.r));
  });

  // 4) اللي قبلتهم إنت
  const finals = [];
  assignedStu.forEach((p, s) => finals.push({ s, r: p.r, level: 'auto', sim: p.sim }));
  const taken = new Map(); finals.forEach(f => taken.set(f.r, f.s));
  plan.review.forEach(item => {
    const r = approvals.get(item.s.id);
    const c = r && item.cands.find(x => x.r === r);
    if (!c) return;
    if (taken.has(c.r)) { plan.approvalConflicts.push({ s: item.s, r: c.r, other: taken.get(c.r) }); return; }
    taken.set(c.r, item.s); item.accepted = c.r;
    finals.push({ s: item.s, r: c.r, level: 'manual', sim: c.sim });
  });

  // 5) الكتابة: الـ ID والباسورد زي ما هما بالظبط في الشيت
  const usedKidIds = new Map();
  students.forEach(s => { if (s.kidId != null && s.kidId !== '') usedKidIds.set(String(s.kidId), s.id); });
  const order = new Map(students.map((s, i) => [s, i]));
  const matchedRows = new Set();
  finals.sort((a, b) => order.get(a.s) - order.get(b.s)).forEach(f => {
    const { s, r } = f;
    plan.matched++; plan[f.level]++;
    matchedRows.add(r);
    const entry = { s, r, level: f.level, sim: f.sim, status: '' };
    plan.confirmed.push(entry);

    let writeId = false;
    if (s.kidId != null && s.kidId !== '') {
      if (String(s.kidId) !== r.kidId) { plan.idConflict++; plan.idConflictList.push({ s, r }); entry.status = 'ID مختلف عن اللي متسجل — اتسابوا'; return; }
      plan.idKept++; entry.status = 'ID متسجل قبل كده';
    } else {
      const owner = usedKidIds.get(r.kidId);
      if (owner && owner !== s.id) { plan.idConflict++; plan.idConflictList.push({ s, r }); entry.status = 'الـ ID ده متسجل لمخدوم تاني — اتسابوا'; return; }
      writeId = true; usedKidIds.set(r.kidId, s.id); entry.status = 'ID جديد';
    }

    let pwValue = null;
    if (secretIds.has(s.id)) plan.pwKept++;
    else if (r.pw.kind === 'ok' || r.pw.kind === 'numeric') pwValue = r.pw.value;    // زي ما هو بالظبط
    else { plan.pwSkip[r.pw.kind]++; plan.pwSkipList.push({ s, r, kind: r.pw.kind }); }

    if (writeId)          { plan.ops.push({ kind: 'id', studentId: s.id, kidId: r.kidId }); plan.newIds++; }
    if (pwValue !== null) { plan.ops.push({ kind: 'pw', studentId: s.id, password: pwValue }); plan.newPws++; entry.status += ' + باسورد'; }
  });

  // 6) أسماء في الشيت مالهاش مقابل في البرنامج (+ تلميح لو نفس الرقم عند مخدوم)
  const hintPairs = new Map();
  pairs.forEach(p => { if (p.phone && !assignedStu.has(p.s)) (hintPairs.get(p.r) || hintPairs.set(p.r, []).get(p.r)).push(p.s); });
  rows.forEach(r => {
    if (matchedRows.has(r) || reviewRows.has(r)) return;
    const n = credsGradeNum(r.grade);
    const item = { r, hints: [...new Set(hintPairs.get(r) || [])] };
    // الشيت قديم: سنة 1 بقت سنة 2 (مش في البرنامج) وسنة 6 اتخرجت — فمش "ناقصين"
    if (n != null && (n + 1 < 3 || n + 1 > 6)) plan.sheetOutOfRange.push(item); else plan.sheetNotInApp.push(item);
  });
  return plan;
}

const CREDS_REASON = {
  fuzzyPhone:    'الاسم متشابه (مش مطابق) ورقم التليفون مشترك',
  phoneMismatch: 'الاسم متشابه بس الأرقام مختلفة',
  noPhones:      'الاسم متشابه بس مفيش أرقام نقارن بيها',
  gradeOff:      'الاسم متشابه ورقم مشترك بس الصف مش متوقع',
  lowSim:        'رقم مشترك بس الاسم مش متشابه كفاية',
  ambiguous:     'أكتر من احتمال'
};

const credsPct = v => Math.round(v * 100) + '%';

const credsPhoneFlag = p => p.phone ? 'رقم مشترك ✔' : (p.comparable ? 'أرقام مختلفة ✖' : 'مفيش أرقام للمقارنة');

function credsReportText(plan) {
  const L = [];
  const MAX = 40;
  L.push(`📄 صفوف الشيت: ${plan.sheetTotal}   |   👥 مخدومين في التطبيق: ${plan.appTotal}`);
  L.push('');
  L.push(`✅ هيتكتب لهم: ${plan.matched}`);
  L.push(`   • اسم مطابق + رقم تليفون مشترك (تلقائي): ${plan.auto}`);
  L.push(`   • قبلتهم انت من قايمة القرار: ${plan.manual}`);
  L.push(`   • ID جديد: ${plan.newIds}   |   باسورد جديد: ${plan.newPws}`);
  if (plan.idKept) L.push(`   • ID متسجل قبل كده (مش هيتغير): ${plan.idKept}`);
  if (plan.pwKept) L.push(`   • باسورد متسجل قبل كده (مش هيتغير): ${plan.pwKept}`);
  const sk = plan.pwSkip;
  if (sk.hashed || sk.date || sk.none) {
    L.push('   🔒 باسوردات مش هتتسجل (مش ينفع تتقرا من الشيت):');
    const names = k => plan.pwSkipList.filter(x => x.kind === k).slice(0, 15).map(x => x.s.name);
    if (sk.hashed) L.push(`      – مشفّرة (HMAC) لأن الولد غيّرها: ${sk.hashed}\n         ${names('hashed').join(' / ')}`);
    if (sk.date)   L.push(`      – Excel حوّلها لتاريخ: ${sk.date}\n         ${names('date').join(' / ')}`);
    if (sk.none)   L.push(`      – فاضية في الشيت: ${sk.none}`);
  }
  if (plan.idConflict) {
    L.push('');
    L.push(`⛔ ID مختلف عن المتسجل أو مستخدم لمخدوم تاني (اتسابوا من غير كتابة): ${plan.idConflict}`);
    plan.idConflictList.slice(0, 15).forEach(x => L.push(`   • ${x.s.name}  (ID في الشيت: ${x.r.kidId})`));
  }
  if (plan.approvalConflicts.length) {
    L.push('');
    L.push(`⛔ قبلت صف شيت واحد لأكتر من مخدوم (اتلغى القبول): ${plan.approvalConflicts.length}`);
    plan.approvalConflicts.slice(0, 15).forEach(x => L.push(`   • ${x.s.name}  ↔  ${x.r.name}   (الصف ده مربوط بـ ${x.other.name})`));
  }
  const pending = plan.review.filter(x => !x.accepted).length;
  if (plan.review.length) {
    L.push('');
    L.push(`⚠️ في قايمة القرار: ${plan.review.length}  (مقبول ${plan.review.length - pending} | مش مقبول ${pending} ← مش هيتكتب لهم حاجة)`);
  }

  L.push('');
  if (plan.sheetNotInApp.length) {
    L.push(`❌ أسماء في الشيت ومش موجودة في البرنامج: ${plan.sheetNotInApp.length}`);
    const groups = new Map();
    plan.sheetNotInApp.forEach(x => { const g = String(x.r.grade || 'من غير صف'); (groups.get(g) || groups.set(g, []).get(g)).push(x); });
    let shown = 0;
    [...groups.keys()].sort().forEach(g => {
      const items = groups.get(g);
      L.push(`  ◦ ${g}: ${items.length}`);
      items.forEach(x => {
        if (shown >= MAX * 2) return;
        shown++;
        L.push(`     • ${x.r.name}`);
        if (x.hints.length) L.push(`        💡 نفس الرقم عند: ${x.hints.map(h => h.name).join(' / ')}`);
      });
    });
    if (plan.sheetNotInApp.length > MAX * 2) L.push(`   … والباقي (${plan.sheetNotInApp.length - MAX * 2}) في تقرير الإكسيل`);
  } else {
    L.push('❌ أسماء في الشيت ومش موجودة في البرنامج: مفيش ✔');
  }
  if (plan.sheetOutOfRange.length) {
    L.push('');
    L.push(`ℹ️ ${plan.sheetOutOfRange.length} صف في الشيت من سنة 1 أو سنة 6 — لأن الشيت قديم بقوا سنة 2 أو خرجوا من الابتدائي، فمش متوقع يكونوا في البرنامج (أسماءهم في تقرير الإكسيل).`);
  }
  if (plan.appNotInSheet.length) {
    L.push('');
    L.push(`❓ مخدومين في التطبيق ملقيناش ليهم صف في الشيت: ${plan.appNotInSheet.length}`);
    plan.appNotInSheet.slice(0, MAX).forEach(s => L.push('   • ' + s.name));
    if (plan.appNotInSheet.length > MAX) L.push(`   … و${plan.appNotInSheet.length - MAX} كمان (كلهم في تقرير الإكسيل)`);
  }
  return L.join('\n');
}

// تقرير Excel كامل (الباسوردات مش بتتكتب فيه)
window.credsExportReport = async () => {
  const plan = credsPlan; if (!plan) return;
  try {
    await ensureXLSXLoaded();
    const wb = XLSX.utils.book_new();
    const add = (name, aoa) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = aoa[0].map(() => ({ wch: 28 })); XLSX.utils.book_append_sheet(wb, ws, name); };
    add('هيتكتب لهم', [['اسم التطبيق', 'اسم الشيت', 'تشابه الاسم', 'ID', 'الصف في الشيت', 'الصف في التطبيق', 'إزاي اتأكدنا', 'الحالة']].concat(
      plan.confirmed.map(x => [x.s.name, x.r.name, credsPct(x.sim), x.r.kidId, x.r.grade || '', x.s.grade || '', x.level === 'auto' ? 'اسم مطابق + تليفون' : 'قبلته انت', x.status])));
    const rv = [['اسم التطبيق', 'صف التطبيق', 'تليفونات التطبيق', 'الاسم في الشيت (احتمال)', 'صف الشيت', 'تليفونات الشيت', 'تشابه', 'التليفون', 'السبب', 'قرارك']];
    plan.review.forEach(x => x.cands.forEach(c => rv.push([x.s.name, x.s.grade || '', credsPhonesText(x.appPhones), c.r.name, c.r.grade || '', credsPhonesText(c.r.phones), credsPct(c.sim), credsPhoneFlag(c), CREDS_REASON[x.reason] || '', x.accepted === c.r ? 'مقبول' : 'لا'])));
    add('قايمة القرار', rv);
    const sh = it => [it.r.name, it.r.kidId, it.r.grade || '', credsPhonesText(it.r.phones), it.hints.map(h => h.name).join(' / ')];
    const shHead = ['الاسم في الشيت', 'ID', 'الصف في الشيت', 'تليفونات الشيت', 'نفس الرقم عند (في البرنامج)'];
    add('في الشيت مش في البرنامج', [shHead].concat(plan.sheetNotInApp.map(sh)));
    add('خارج سنين البرنامج', [shHead].concat(plan.sheetOutOfRange.map(sh)));
    add('في البرنامج مش في الشيت', [['الاسم', 'الصف', 'تليفون الأب', 'تليفون الأم', 'تليفون المخدوم']].concat(
      plan.appNotInSheet.map(s => [s.name, s.grade || '', s.phoneDad || '', s.phoneMom || '', s.phoneStudent || ''])));
    add('باسوردات مش هتتسجل', [['اسم التطبيق', 'ID في الشيت', 'السبب']].concat(
      plan.pwSkipList.map(x => [x.s.name, x.r.kidId, x.kind === 'hashed' ? 'مشفّرة (الولد غيّرها)' : 'Excel حوّلها لتاريخ'])));
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.writeFile(wb, 'تقرير_مطابقة_الـID_والباسورد.xlsx');
  } catch (e) {
    console.error(e);
    showToast('معرفتش أطلّع التقرير', 'error');
  }
};

window.onCredsFileChange = async () => {
  const input = document.getElementById('creds-file-input');
  const st  = document.getElementById('creds-status');
  const btn = document.getElementById('creds-commit-btn');
  credsCache = null; credsPlan = null; credsDecisions = new Map(); credsReviewBase = []; btn.disabled = true; btn.textContent = '🔒 تثبيت نهائي';
  document.getElementById('creds-review').style.display = 'none';
  if (!input.files.length) return;
  if (!navigator.onLine) { showToast('محتاج نت عشان تحلل الملف', 'error'); return; }
  st.style.display = 'block'; st.textContent = '⏳ بقرا الملف وبحمّل المخدومين…';
  try {
    await ensureXLSXLoaded();
    const wb = XLSX.read(await input.files[0].arrayBuffer(), { type: 'array', cellDates: true });
    const parsed = credsParseWorkbook(wb);
    if (!parsed || !parsed.rows.length) { st.textContent = '❌ مالقيتش أعمدة id / name / password في الملف ده.'; return; }
    const stSnap = await getDocs(collection(db, 'students'));
    let secretIds;
    try {
      secretIds = new Set((await getDocs(collection(db, 'student_secrets'))).docs.map(d => d.id));
    } catch (e) {
      console.error(e);
      st.textContent = '⛔ مش قادر أقرا student_secrets. لازم تضيف قواعد Firestore الخاصة بيها الأول (ادّيتك الكود في الرد)، وبعدها جرب تاني.';
      return;
    }
    credsCache = { rows: parsed.rows, students: stSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(inCurrentSection), secretIds };
    credsAnalyze();
  } catch (e) {
    console.error(e);
    st.textContent = '❌ تعذّرت قراءة الملف أو تحميل البيانات: ' + (e.message || e);
  }
};

// بيتنادى أول ما الملف يتحلل: بيبني قايمة القرار (الاختيارات الافتراضية: بس الأسماء المتشابهة اللي رقمها مشترك)
window.credsAnalyze = () => {
  if (!credsCache) return;
  credsReviewBase = credsBuildPlan(credsCache, {}).review;                   // من غير أي قبول
  const ids = new Set(credsReviewBase.map(x => x.s.id));
  [...credsDecisions.keys()].forEach(k => { if (!ids.has(k)) credsDecisions.delete(k); });
  credsReviewBase.forEach(x => { if (!credsDecisions.has(x.s.id)) credsDecisions.set(x.s.id, x.suggested >= 0 ? x.cands[x.suggested].r : null); });
  credsRenderReview();
  credsRecompute();
};

// بيتنادى لما قراراتك تتغير: بيحدّث المعاينة وزرار التثبيت من غير ما يلمس القايمة
window.credsRecompute = () => {
  if (!credsCache) return;
  const st  = document.getElementById('creds-status');
  const btn = document.getElementById('creds-commit-btn');
  const approvals = new Map([...credsDecisions].filter(([, r]) => r));
  credsPlan = credsBuildPlan(credsCache, { approvals });
  st.style.display = 'block';
  st.textContent = '🔍 معاينة (لسه مفيش حاجة اتكتبت):\n\n' + credsReportText(credsPlan);
  document.getElementById('creds-export-btn').style.display = 'block';
  const cnt = document.getElementById('creds-review-count');
  if (cnt) cnt.textContent = `مقبول: ${credsPlan.review.filter(x => x.accepted).length} من ${credsReviewBase.length}`;
  btn.disabled = credsPlan.ops.length === 0;
  btn.textContent = credsPlan.ops.length ? `🔒 تثبيت نهائي (${credsPlan.newIds} ID + ${credsPlan.newPws} باسورد)` : 'مفيش حاجة جديدة تتثبت';
};

function credsRenderReview() {
  const box = document.getElementById('creds-review'), list = document.getElementById('creds-review-list');
  if (!credsReviewBase.length) { box.style.display = 'none'; list.innerHTML = ''; return; }
  box.style.display = 'block';
  const card = (x, i) => {
    const chosen = credsDecisions.get(x.s.id) || null;
    const appPh = credsPhonesText(x.appPhones);
    const cands = x.cands.map((c, k) => {
      const flagColor = c.phone ? 'var(--success,#2ecc71)' : (c.comparable ? 'var(--danger,#e74c3c)' : 'var(--text-dim)');
      const note = credsGradeNote(c.r.grade, x.s.grade);
      return `<label style="display:block;border:1px solid var(--border);border-radius:8px;padding:8px;margin-top:6px;cursor:pointer">
        <div style="display:flex;gap:8px;align-items:flex-start">
          <input type="radio" name="cr-${i}" value="${k}" ${chosen === c.r ? 'checked' : ''} onchange="credsPickReview(${i}, ${k})" style="margin-top:4px">
          <div style="flex:1;min-width:0">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;line-height:1.7">
              <div><div style="color:var(--text-dim);font-size:11px">البرنامج</div><b>${credsEsc(x.s.name)}</b><br>${credsEsc(x.s.grade || '')}<br>📞 ${credsEsc(appPh)}</div>
              <div><div style="color:var(--text-dim);font-size:11px">الشيت — تشابه ${credsPct(c.sim)}</div><b>${credsEsc(c.r.name)}</b><br>${credsEsc(c.r.grade || '')}<br>📞 ${credsEsc(credsPhonesText(c.r.phones))}</div>
            </div>
            <div style="font-size:11px;margin-top:4px;color:${flagColor}">${credsPhoneFlag(c)}${note ? ' — ' + credsEsc(note) : ''}</div>
            <div style="font-size:12px;font-weight:700;margin-top:2px">✔ اقبله</div>
          </div>
        </div>
      </label>`;
    }).join('');
    return `<div style="border-top:1px solid var(--border);padding:10px 0">
      <div style="font-size:11px;color:var(--warning)">${credsEsc(CREDS_REASON[x.reason] || '')}</div>
      ${cands}
      <label style="display:flex;gap:8px;align-items:center;margin-top:6px;cursor:pointer;font-size:12px;font-weight:700">
        <input type="radio" name="cr-${i}" value="-1" ${chosen ? '' : 'checked'} onchange="credsPickReview(${i}, -1)"> ✖ لا، مش هو
      </label>
    </div>`;
  };
  const idx = credsReviewBase.map((x, i) => i);
  const need = idx.filter(i => credsReviewBase[i].suggested < 0), sug = idx.filter(i => credsReviewBase[i].suggested >= 0);
  list.innerHTML =
    (need.length ? `<div style="font-weight:700;font-size:13px;margin:6px 0 0">⚠️ مش متأكدين — محتاجين قرارك (${need.length})</div>` + need.map(i => card(credsReviewBase[i], i)).join('') : '') +
    (sug.length ? `<div style="font-weight:700;font-size:13px;margin:14px 0 0">🔎 اقتراحي أقبلهم (متعلّمين ✔) — راجعهم وغيّر لو غلط (${sug.length})</div>` + sug.map(i => card(credsReviewBase[i], i)).join('') : '');
}

window.credsPickReview = (i, k) => {
  const x = credsReviewBase[i]; if (!x) return;
  credsDecisions.set(x.s.id, k >= 0 ? x.cands[k].r : null);
  credsRecompute();
};

window.credsReviewBulk = (mode) => {                 // 'default' = الاختيارات الافتراضية | 'none' = ارفض الكل
  credsReviewBase.forEach(x => credsDecisions.set(x.s.id, mode === 'default' && x.suggested >= 0 ? x.cands[x.suggested].r : null));
  credsRenderReview(); credsRecompute();
};

window.commitCredsImport = async () => {
  const plan = credsPlan;
  if (state.currentUserRole !== 'admin' || !plan || !plan.ops.length) return;
  if (!navigator.onLine) { showToast('محتاج نت للتثبيت', 'error'); return; }
  if (!confirm(`هيتم تثبيت ${plan.newIds} ID و ${plan.newPws} باسورد.\n\nالقيم دي هتبقى ثابتة ومش هينفع تتعدل من التطبيق بعد كده.\nمتأكد إن المعاينة سليمة؟`)) return;
  const st  = document.getElementById('creds-status');
  const btn = document.getElementById('creds-commit-btn');
  const log = (t) => { st.textContent += '\n' + t; st.scrollTop = st.scrollHeight; };
  btn.disabled = true; btn.textContent = 'جاري التثبيت…';
  try {
    const CHUNK = 400;
    for (let i = 0; i < plan.ops.length; i += CHUNK) {
      const batch = writeBatch(db);
      plan.ops.slice(i, i + CHUNK).forEach(op => {
        if (op.kind === 'id') batch.update(doc(db, 'students', op.studentId), { kidId: op.kidId });
        else batch.set(doc(db, 'student_secrets', op.studentId), { password: op.password, createdAt: serverTimestamp() });
      });
      await batch.commit();
      log(`   ✓ اتثبّت ${Math.min(i + CHUNK, plan.ops.length)}/${plan.ops.length}`);
    }
    logActivity('رفع ID وباسوردات المخدومين', `${plan.newIds} ID / ${plan.newPws} باسورد`);
    log('⏳ تحديث قائمة المخدومين…');
    await loadStudents({ force: true });
    credsCache = null; credsPlan = null;
    log('🎉 تمّ. الـ ID والباسورد بقوا ثابتين.');
    btn.textContent = '✔ تم';
  } catch (e) {
    console.error(e);
    log(e && e.code === 'permission-denied'
      ? '⛔ Firestore رفض الكتابة. اتأكد إن قواعد student_secrets اتضافت وإنك أدمن.'
      : '❌ حصل خطأ: ' + (e.message || e));
    log('لو حصل خطأ في النص، ارفع الملف تاني — اللي اتثبّت قبل كده مش هيتكرر.');
    btn.textContent = '🔒 تثبيت نهائي';
  }
};
