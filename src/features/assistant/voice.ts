// @ts-nocheck

// ===== VOICE ATTENDANCE =====
export function normalizeArabicVoice(str) {
  return (str || '')
    .normalize('NFKC')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // تشكيل وتطويل
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\u0600-\u06FF\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDist(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[n];
}

function strSimilarity(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  return 1 - levenshteinDist(a, b) / Math.max(a.length, b.length);
}

export function bestVoiceMatch(transcript, candidates) {
  const norm = normalizeArabicVoice(transcript);
  if (!norm) return null;
  const tWords = norm.split(' ').filter(Boolean);
  if (!tWords.length) return null;

  let best = null, bestScore = 0;
  for (const s of candidates) {
    const sn = normalizeArabicVoice(s.name);
    if (!sn) continue;
    const sWords = sn.split(' ').filter(Boolean);

    // كل كلمة اتقالت لازم تلاقي كلمة قريبة منها في اسم المخدوم (مش بس أقرب كلمة واحدة تكسب الدرجة كلها)
    let totalSim = 0;
    for (const tw of tWords) {
      let wBest = 0;
      for (const sw of sWords) wBest = Math.max(wBest, strSimilarity(tw, sw));
      totalSim += wBest;
    }
    let score = totalSim / tWords.length;

    // لو أول اسمين (أو أكتر) من اللي اتقال بالظبط جزء من اسم المخدوم، ادّي وزن أعلى؛
    // وبين أكتر من مخدوم بنفس الجزء ده، الأقرب طولًا لللي اتقال يكسب (مش أطول اسم)
    if (norm.includes(sn) || sn.includes(norm)) {
      const coverage = Math.min(norm.length, sn.length) / Math.max(norm.length, sn.length);
      score = Math.max(score, 0.9 + coverage * 0.1);
    }

    if (score > bestScore) { bestScore = score; best = s; }
  }
  return bestScore >= 0.6 ? best : null;
}

function findStudentByVoice(transcript, candidates) {
  return bestVoiceMatch(transcript, candidates);
}

// ===== GLOBAL VOICE ASSISTANT (مساعد صوتي عام) =====
// أوامر مدعومة (بالمصري، تقولها كلها في جملة واحدة):
//  - "سجل حضور ليوسف باسم"                → تسجيل حضور مخدوم انهارده
//  - "سجل حضور لمستر يوسف كامل"            → تسجيل حضور خادم انهارده
//  - "سجل افتقاد في البيت لآدم ماركو"      → تسجيل افتقاد منزلي انهارده
//  - "سجل افتقاد تليفوني لآدم ماركو"       → تسجيل افتقاد تليفوني انهارده
//  - "رن على آدم ماركو" / "اتصل بآدم ماركو" → مكالمة تليفون المخدوم
//  - "رن على مامة آدم ماركو" / "بابا آدم ماركو" → مكالمة تليفون الأب/الأم

export function speakAr(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ar-SA';
    window.speechSynthesis.speak(u);
  } catch (e) {}
}
