// @ts-nocheck
// ===== PARSER لكشف الافتقاد (كل مخدوم = 3 صفوف) =====
// الشكل المتوقع:
//   صف عنوان الخادم:  "مستر / كيرلس سامي ونيس"  (فوق كل مجموعة أسماء)
//   صفين عناوين:      الاسم | الأب/الأم (تحت رقم ولي الأمر) | رقم الولد | رقم (غير محدد) | العنوان | يوم/شهر/سنة (تحت تاريخ الميلاد) | المدرسة | أب الاعتراف (لو موجود)
//   وبعدين لكل مخدوم 3 صفوف:
//     صف 1: الاسم (العمود B) + البيانات الشخصية
//     صف 2: تواريخ الحضور (تاريخ حقيقي أو نص عربي زي "٢٣-أكتوبر")
//     صف 3: TRUE / FALSE لكل تاريخ
// الدالة مفيهاش أي Firebase — بتقرا الـ rows بس وترجّع بيانات جاهزة للرفع.

const WEST = '0123456789';
export function toWesternDigits(s) {
  return (s ?? '').toString()
    .replace(/[٠-٩]/g, d => WEST['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
    .replace(/[۰-۹]/g, d => WEST['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)]);
}

// نفس منطق normalizeName في import-attendance بس من غير import عشان الملف يفضل pure
function norm(v) {
  if (v === undefined || v === null) return '';
  return v.toString()
    .replace(/[\u064B-\u0652\u0640]/g, '')   // تشكيل + تطويل
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[()\[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MONTHS = {
  'يناير': 1, 'فبراير': 2, 'مارس': 3, 'ابريل': 4, 'مايو': 5, 'يونيو': 6,
  'يوليو': 7, 'اغسطس': 8, 'سبتمبر': 9, 'اكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12,
  'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
  'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
};

function monthFromName(name) {
  const n = norm(name).toLowerCase();
  if (MONTHS[n]) return MONTHS[n];
  if (/^[a-z]{3,}$/.test(n) && MONTHS[n.slice(0, 3)]) return MONTHS[n.slice(0, 3)];
  return 0;
}

// بيحوّل خلية تاريخ حضور لـ { d, m, y? } (y ممكن تكون ناقصة في النص العربي)
function parseDateCell(val, XLSX) {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') {
    const p = XLSX && XLSX.SSF && XLSX.SSF.parse_date_code(val);
    if (!p || !p.y || p.y < 2000) return null;
    return { d: p.d, m: p.m, y: p.y, serial: true };
  }
  const s = toWesternDigits(norm(val));
  let m = s.match(/^(\d{1,2})\s*[-\/ ]\s*([A-Za-z\u0600-\u06FF]+)$/);
  if (m) {
    const mo = monthFromName(m[2]);
    const d = parseInt(m[1]);
    if (mo && d >= 1 && d <= 31) return { d, m: mo, y: undefined };
  }
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);   // dd/mm أو dd/mm/yyyy
  if (m) {
    const d = parseInt(m[1]), mo = parseInt(m[2]);
    let y = m[3] ? parseInt(m[3]) : undefined;
    if (y !== undefined && y < 100) y += 2000;
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) return { d, m: mo, y };
  }
  return null;
}

function normPhone(v) {
  if (v === undefined || v === null || v === '') return '';
  const parts = toWesternDigits(v).split(/[\n\r\/,،;؛]+/).map(p => {
    let digits = p.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 10 && digits[0] === '1') digits = '0' + digits;                 // الصفر الأول اتشال لأن الخلية كانت رقم
    if (digits.length === 12 && digits.startsWith('20')) digits = '0' + digits.slice(2);  // 20xxxxxxxxxx
    if (digits.length > 11) {                                                             // رقمين ملزوقين في خلية واحدة
      const found = digits.match(/01[0125]\d{8}/g);
      if (found && found.length >= 2) return found.join(' / ');
    }
    return digits;
  }).filter(Boolean);
  return parts.join(' / ');
}

function textCell(v) {
  if (v === undefined || v === null) return '';
  return v.toString().replace(/\s+/g, ' ').trim();
}

function buildDob(day, month, year) {
  const d = parseInt(toWesternDigits(day)), m = parseInt(toWesternDigits(month));
  let y = parseInt(toWesternDigits(year));
  if (!d || !m || !y) return '';
  if (y < 100) y += (y <= new Date().getFullYear() % 100 ? 2000 : 1900);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1980 || y > new Date().getFullYear()) return '';
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const isTrue = (v) => v === true || v === 1 || (typeof v === 'string' && /^(true|صح|نعم|✓|✔)$/i.test(v.trim()));
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const SERVANT_RE = /^\s*(?:مستر|ميس|مس|استاذ|استاذه)\s*[\/\\:]\s*(.+)$/;
const SERVANT_SPLIT_RE = /(?:مستر|ميس|مس|أستاذ|استاذ|استاذه)\s*[\/\\:]/;
const UNASSIGNED_RE = /(مش|غير|لسه)\s*متوزع|بدون خادم/;      // مجموعة "مش متوزعين" = من غير خادم افتقاد

// بيدوّر على عناوين الأعمدة في صفين (الصف الفرعي + اللي فوقه)
function detectHeader(rows, r) {
  const sub = rows[r] || [];
  const top = r > 0 ? (rows[r - 1] || []) : [];
  const h = {};
  const maxCol = Math.max(sub.length, top.length);
  for (let c = 0; c < maxCol; c++) {
    const ts = [norm(top[c]), norm(sub[c])];
    const tSub = ts[1];
    for (const t of ts) {
      if (!t) continue;
      if (t.includes('اعتراف'))                                   { h.confessor ??= c; continue; }
      if (t.includes('رقم الولد') || t.includes('رقم المخدوم'))     { h.phoneStudent ??= c; continue; }
      if (t.includes('غير محدد'))                                 { h.phoneOther ??= c; continue; }
      if (t.includes('عنوان'))                                    { h.address ??= c; continue; }
      if (t.includes('مدرس'))                                     { h.school ??= c; continue; }
      if (t.includes('اسم') && t.length <= 12)                    { h.name ??= c; continue; }
    }
    if (tSub === 'الاب') h.dad ??= c;
    else if (tSub === 'الام') h.mom ??= c;
    else if (tSub === 'يوم') h.dobD ??= c;
    else if (tSub === 'شهر') h.dobM ??= c;
    else if (tSub === 'سنه') h.dobY ??= c;
  }
  if (h.name === undefined) h.name = 1;   // الاسم في العمود B
  return h;
}

export function parseAftiqadSheet(rows, XLSX, opts = {}) {
  const res = {
    ok: false, students: [], servants: [], warnings: [],
    dateCount: 0, dateMin: '', dateMax: '', foundCols: [], missingCols: [],
  };
  if (!rows || !rows.length) return res;

  let servant = '';
  let hdr = null;
  const seenNames = new Set();
  const servants = new Set();
  const allDates = new Set();
  const serialYears = {};

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;

    // 1) صف عنوان المجموعة: "مستر / فلان" (أو "مش متوزعين" = من غير خادم)
    let isTitleRow = false;
    for (const cell of row) {
      if (typeof cell !== 'string') continue;
      const nc = norm(cell);
      if (UNASSIGNED_RE.test(nc) && nc.length < 30) {
        servant = '';
        hdr = null;
        isTitleRow = true;
        break;
      }
      if (SERVANT_RE.test(nc)) {
        const names = cell.replace(/\s+/g, ' ').split(SERVANT_SPLIT_RE)
          .map(x => x.replace(/^[\s\-–—،,&]+|[\s\-–—،,&]+$/g, '').trim()).filter(Boolean);
        servant = names[0] || '';
        if (names.length > 1) {
          // مجموعة فيها أكتر من خادم: ناخد اللي اتحدد في opts.preferServants، وإلا الأول
          const pref = (opts.preferServants || []).map(norm);
          servant = names.find(n => pref.includes(norm(n))) || servant;
          res.warnings.push(`مجموعة فيها ${names.length} خدام (${names.join(' و ')}) — اتربطت بـ: ${servant}`);
        }
        if (servant) servants.add(servant);
        hdr = null;               // المجموعة الجديدة هتجيب عناوينها بعده
        isTitleRow = true;
        break;
      }
    }
    if (isTitleRow) continue;

    // صف العناوين العلوي (الاسم / رقم ولي الأمر / الرقم) — مش مخدوم، ويقفل المجموعة اللي فاتت
    if (norm(row[1]) === 'الاسم' || row.some(c => typeof c === 'string' && /^(رقم ولي|الرقم$)/.test(norm(c)))) {
      hdr = null;
      continue;
    }

    // 2) صف العناوين الفرعي (فيه "الأب" و"الأم")
    const normed = row.map(norm);
    if (normed.includes('الاب') && normed.includes('الام')) {
      hdr = detectHeader(rows, r);
      continue;
    }
    if (!hdr) continue;

    // 3) صف مخدوم: الاسم نص في عمود الاسم
    const rawName = row[hdr.name];
    if (typeof rawName !== 'string' || !rawName.trim()) continue;
    const name = rawName.replace(/\s+/g, ' ').trim();

    const dateRow = rows[r + 1] || [];
    const boolRow = rows[r + 2] || [];
    const nextIsStudent = typeof dateRow[hdr.name] === 'string' && dateRow[hdr.name].trim();
    const entries = [];
    if (!nextIsStudent) {
      for (let c = 0; c < Math.max(dateRow.length, boolRow.length); c++) {
        if (c === hdr.name) continue;
        const dp = parseDateCell(dateRow[c], XLSX);
        if (!dp) continue;
        if (dp.serial) serialYears[dp.y] = (serialYears[dp.y] || 0) + 1;
        entries.push({ c, dp, present: isTrue(boolRow[c]) });
      }
    }

    const p = {
      name, servant, row: r + 1,
      phoneDad:     hdr.dad          !== undefined ? normPhone(row[hdr.dad])          : '',
      phoneMom:     hdr.mom          !== undefined ? normPhone(row[hdr.mom])          : '',
      phoneStudent: hdr.phoneStudent !== undefined ? normPhone(row[hdr.phoneStudent]) : '',
      phoneOther:   hdr.phoneOther   !== undefined ? normPhone(row[hdr.phoneOther])   : '',
      address:      hdr.address      !== undefined ? textCell(row[hdr.address])       : '',
      school:       hdr.school       !== undefined ? textCell(row[hdr.school])        : '',
      confessor:    hdr.confessor    !== undefined ? textCell(row[hdr.confessor])     : '',
      dob: (hdr.dobD !== undefined && hdr.dobM !== undefined && hdr.dobY !== undefined)
        ? buildDob(row[hdr.dobD], row[hdr.dobM], row[hdr.dobY]) : '',
      _entries: entries,
    };

    const key = norm(name);
    if (seenNames.has(key)) { res.warnings.push(`اسم متكرر اتجاهل (صف ${r + 1}): ${name}`); r += nextIsStudent ? 0 : 2; continue; }
    seenNames.add(key);
    res.students.push(p);
    r += nextIsStudent ? 0 : 2;   // نعدّي صفّي التواريخ والـ TRUE/FALSE
  }

  // السنة: أكتر سنة ظاهرة في التواريخ الحقيقية، وإلا السنة الحالية
  let baseYear = opts.defaultYear || new Date().getFullYear();
  const ys = Object.entries(serialYears).sort((a, b) => b[1] - a[1]);
  if (ys.length) baseYear = parseInt(ys[0][0]);

  for (const p of res.students) {
    p.attendance = [];
    let lastY = null, lastM = null;
    for (const e of p._entries.sort((a, b) => a.c - b.c)) {
      let { d, m, y } = e.dp;
      if (y === undefined) {
        y = lastY ?? baseYear;
        if (lastM !== null && lastM >= 9 && m <= 6) y = (lastY ?? baseYear) + 1;   // السنة الدراسية عدّت يناير
      }
      lastY = y; lastM = m;
      const date = iso(y, m, d);
      allDates.add(date);
      if (e.present) p.attendance.push(date);
    }
    delete p._entries;
  }

  const sorted = [...allDates].sort();
  res.dateCount = sorted.length;
  res.dateMin = sorted[0] || '';
  res.dateMax = sorted[sorted.length - 1] || '';
  res.servants = [...servants];

  const colLabels = {
    name: 'الاسم', dad: 'تليفون الأب', mom: 'تليفون الأم', phoneStudent: 'رقم الولد',
    phoneOther: 'رقم (غير محدد)', address: 'العنوان', school: 'المدرسة', confessor: 'أب الاعتراف',
  };
  const lastHdr = res.students.length ? hdrSnapshot(rows) : null;
  if (lastHdr) {
    Object.entries(colLabels).forEach(([k, label]) => (lastHdr[k] !== undefined ? res.foundCols : res.missingCols).push(label));
    (lastHdr.dobD !== undefined && lastHdr.dobM !== undefined && lastHdr.dobY !== undefined ? res.foundCols : res.missingCols).push('تاريخ الميلاد');
  }

  res.ok = res.students.length > 0;
  return res;
}

// أول مجموعة عناوين في الشيت (للمعاينة بس)
function hdrSnapshot(rows) {
  for (let r = 0; r < rows.length; r++) {
    const normed = (rows[r] || []).map(norm);
    if (normed.includes('الاب') && normed.includes('الام')) return detectHeader(rows, r);
  }
  return null;
}
