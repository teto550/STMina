// @ts-nocheck
import { http } from '@/core/http';
import { updateDoc, doc } from 'firebase/firestore';
import { state } from '@/core/state';
import { bestVoiceMatch, normalizeArabicVoice, speakAr } from '@/features/assistant/voice';
import { todayKey } from '@/core/utils';
import { db } from '@/core/firebase';
import { logActivity } from '@/core/presence';
import { isDeaconPresentToday } from '@/features/servants/deacon-attendance';
import { doRemoveAttendance, markPresent } from '@/features/attendance/attendance';
import { DEACONS } from '@/features/servants/deacons';
import { attFilteredStudents } from '@/features/students/students';
import { ensureCoreData, ensureDeaconAttendance } from '@/core/data';

// ===== المساعد الذكي (Gemini) — بيتنادى عن طريق Cloudflare Worker مجاني
// علشان مفتاح الـ API يفضل مخبي وميظهرش خالص في كود الصفحة اللي ظاهر لأي حد.
// غيّر الرابط ده بعد ما تعمل الـ Worker وتاخد رابطه (خطوات في آخر الشات).
const ASSISTANT_WORKER_URL = import.meta.env.VITE_ASSISTANT_WORKER_URL || "https://REPLACE-WITH-YOUR-WORKER-URL.workers.dev";

const ASSISTANT_FILLER_WORDS = ['سجل','تسجيل','حضور','لل','رجاء','لو','سمحت','من','فضلك','كده','يا','ريت','ياريت','دلوقتي','هسجل','خلي','عايز','عاوز','ممكن'];

// بيشيل كلمات الحشو، وبيرجع نسختين من الاسم: الأصلية، وواحدة بعد ما نشيل حرف اللام المتصلة بأول كلمة (زي "لادم" → "ادم")
function extractAssistantNameVariants(transcript, extraFillers = []) {
  const norm = normalizeArabicVoice(transcript);
  const fillers = new Set([...ASSISTANT_FILLER_WORDS, ...extraFillers]);
  const words = norm.split(' ').filter(w => w && !fillers.has(w));
  const variant1 = words.join(' ');
  const variant2 = words.map(w => (w.length > 2 && w[0] === 'ل') ? w.slice(1) : w).join(' ');
  return [variant1, variant2].filter(Boolean);
}

// بيدور على أفضل تطابق لاسم في أكتر من نسخة/أكتر من قايمة، وبيرجع أول تطابق لاقيه
function matchAssistantName(variants, lists) {
  for (const list of lists) {
    for (const v of variants) {
      const match = bestVoiceMatch(v, list);
      if (match) return match;
    }
  }
  return null;
}

function asNameCandidates(names) {
  return names.map(n => ({ name: n, __isDeaconName: true }));
}

let assistantRecognition = null;

let assistantActive = false;

let assistantLastStudent = null;   // آخر مخدوم اتنطق اسمه، لتسهيل أوامر متابعة زي "مامته"

let assistantPending = null;       // { type:'visit-type', student }

let assistantMode = null;          // 'attendance' | 'open' | null — وضع مستمر: بيفضل شغال لحد ما تتقال حاجة تانية

const ASSISTANT_MODE_HINTS = {
  attendance: '✅ وضع تسجيل الحضور… قول أي اسم وهسجله حضور على طول',
  open:       '🗂 وضع فتح الملفات… قول أي اسم وهفتحله ملفه على طول'
};

function setAssistantMode(mode) {
  assistantMode = mode;
  setAssistantHint(mode ? ASSISTANT_MODE_HINTS[mode] : 'بيسمع دلوقتي… اتكلم براحتك');
}

function setAssistantHint(text) {
  const el = document.getElementById('assistant-hint');
  if (el) el.textContent = text;
}

function setAssistantHeard(text) {
  const el = document.getElementById('assistant-last-heard');
  if (el) el.textContent = text;
}

async function assistantMarkVisit(student, type) {
  const field = type === 'phone' ? 'lastVisitPhone' : 'lastVisitHome';
  const key   = todayKey();
  try {
    await updateDoc(doc(db, 'students', student.id), { [field]: key });
    const idx = state.allStudents.findIndex(s => s.id === student.id);
    if (idx !== -1) state.allStudents[idx][field] = key;
    const typeLabel = type === 'phone' ? 'تليفوني' : 'منزلي';
    showToast(`✅ اتسجل افتقاد ${typeLabel} لـ ${student.name}`, 'success');
    navigator.vibrate && navigator.vibrate([60, 30, 60]);
    speakAr(`تم تسجيل افتقاد ${typeLabel} لـ ${student.name}`);
    if (typeof logActivity === 'function') logActivity('سجّل افتقاد بالصوت', `${student.name} (${typeLabel})`);
    if (typeof renderDeaconList === 'function') renderDeaconList();
  } catch (e) {
    console.warn('assistantMarkVisit error:', e);
    showToast('حصل خطأ في تسجيل الافتقاد، جرب تاني', 'error');
  }
}

// بيسجل حضور أي حد (مخدوم أو خادم) من نتيجة matchAssistantName جاهزة
function assistantMarkAttendanceByMatch(match) {
  if (match.__isDeaconName) {
    if (isDeaconPresentToday(match.name, 'sunday')) {
      showToast(`${match.name} — متسجل حضوره خالص`, 'info');
      return;
    }
    markDeaconAttendance(match.name, 'sunday');
    speakAr(`تم تسجيل حضور ${match.name}`);
  } else {
    assistantLastStudent = match;
    if (state.todayAttendance[match.id]) {
      showToast(`${match.name} — متسجل حضوره خالص`, 'info');
      return;
    }
    markPresent(match.id).then(ok => {
      if (ok) {
        showToast(`✅ ${match.name} — تم التسجيل`, 'success');
        navigator.vibrate && navigator.vibrate([60, 30, 60]);
        speakAr(`تم تسجيل حضور ${match.name}`);
      }
    });
  }
}

// بيفتح ملف خادم: يودّي لتاب الخدام ويختاره تلقائي
function assistantOpenDeaconProfile(name) {
  const tabBtn = document.getElementById('tab-btn-deacons');
  if (tabBtn) window.switchTab('deacons', tabBtn);
  setTimeout(() => {
    const chip = document.querySelector(`#deacon-chips .deacon-row[data-deacon="${CSS.escape(name)}"]`);
    if (chip) window.setDeacon(name, chip);
  }, 60);
  showToast(`📂 فتحت ملف الخادم ${name}`, 'success');
  speakAr(`اتفتح ملف ${name}`);
}

// بيفتح ملف أي حد (مخدوم أو خادم) من نتيجة matchAssistantName جاهزة
function assistantOpenByMatch(match) {
  if (match.__isDeaconName) {
    assistantOpenDeaconProfile(match.name);
  } else {
    window.openProfile(match.id);
    showToast(`📂 فتحت ملف ${match.name}`, 'success');
    speakAr(`اتفتح ملف ${match.name}`);
  }
}

// ===== المساعد الذكي (Gemini) =====
// بيلخص بيانات الخدام والمخدومين النهاردة، ويبعتها مع سؤال المستخدم لـ Gemini،
// وبيرجع رد قصير بالعامية المصرية يتقال بالصوت.
function buildAssistantDataSummary() {
  const todayStr = todayKey();
  const deaconsSummary = DEACONS.map(d => {
    const mine = state.allStudents.filter(s => s.deacon === d);
    const notVisited = mine.filter(s => !isVisitedThisMonth(s));
    return {
      اسم_الخادم: d,
      عدد_المخدومين: mine.length,
      عدد_اللي_متفتقدوش_الشهر_ده: notVisited.length,
      اسماء_اللي_متفتقدوش_الشهر_ده: notVisited.map(s => s.name),
      حضر_اليوم: isDeaconPresentToday(d)
    };
  });
  const studentsSummary = state.allStudents.map(s => ({
    الاسم: s.name,
    الصف: s.grade || '',
    الخادم: s.deacon || 'بدون خادم',
    عدد_مرات_الحضور: s.attendanceCount || 0,
    اتفتقد_الشهر_ده: isVisitedThisMonth(s),
    حضر_اليوم: !!state.todayAttendance[s.id]
  }));
  return { اليوم: todayStr, الخدام: deaconsSummary, المخدومين: studentsSummary };
}

async function assistantAskGemini(question) {
  const data = buildAssistantDataSummary();
  // الطلب بيروح للـ Cloudflare Worker (مجاني بالكامل) اللي هو اللي بيكلم Gemini فعليًا
  // ومعاه مفتاح الـ API المخبي هناك — الصفحة نفسها متعرفش المفتاح خالص.
  const res = await http.post(ASSISTANT_WORKER_URL, { question, data }, { validateStatus: () => true });
  const json = (res.data && typeof res.data === 'object') ? res.data : {};
  if (res.status < 200 || res.status >= 300) {
    throw new Error(json.error || `خطأ من السيرفر (${res.status})`);
  }
  return json.answer || null;
}

function assistantAskAI(question) {
  // لو لسه محدش ربط المساعد الذكي (Gemini) بمفتاح فعلي، منستناش نت نجرب، وبنرجع رسالة تساعد بدل خطأ غامض
  if (!ASSISTANT_WORKER_URL || ASSISTANT_WORKER_URL.includes('REPLACE-WITH-YOUR-WORKER-URL')) {
    const msg = 'معرفتش الأمر ده. جرب تقول مثلاً: سجل حضور فلان، سجل افتقاد لفلان، افتح ملف فلان، اتصل بفلان، كام واحد حضر النهاردة، كام غايب، زود نجمة لفلان، أو افتح تاب الإحصائيات';
    showToast('❓ ' + msg, 'info');
    speakAr('معرفتش الأمر ده، جرب تقول سجل حضور، أو افتح ملف، أو كام حضر النهاردة');
    if (!assistantMode) setAssistantHint('بيسمع دلوقتي… اتكلم براحتك');
    return;
  }
  setAssistantHint('🤔 بفكر…');
  assistantAskGemini(question).then(answer => {
    if (answer) {
      showToast('💬 ' + answer, 'success');
      speakAr(answer);
    } else {
      showToast('❓ معرفتش أجاوب على السؤال ده', 'error');
      speakAr('معرفتش أجاوب على السؤال ده');
    }
    if (!assistantMode) setAssistantHint('بيسمع دلوقتي… اتكلم براحتك');
  }).catch(e => {
    console.warn('assistantAskAI error:', e);
    showToast('حصل خطأ في المساعد الذكي: ' + (e.message || ''), 'error');
    speakAr('حصل خطأ، جرب تاني');
    if (!assistantMode) setAssistantHint('بيسمع دلوقتي… اتكلم براحتك');
  });
}

function assistantCallNumber(number, label) {
  if (!number) {
    showToast(`مفيش رقم تليفون متسجل ${label}`, 'error');
    speakAr(`معنديش رقم تليفون متسجل ${label}`);
    return;
  }
  showToast(`📲 بيتصل بـ ${label}…`, 'info');
  window.location.href = `tel:${number}`;
}

function handleAssistantCommand(rawTranscript) {
  const norm = normalizeArabicVoice(rawTranscript);
  setAssistantHeard(`سمعت: "${rawTranscript}"`);
  if (!norm) return;

  // كلمة توقف عامة — بتقفل أي وضع مستمر (تسجيل حضور / فتح ملفات)
  if (/^(خلاص|كفايه|كفاية|وقف|قف|قفل|الغاء|إلغاء|بس كده|اوقف)$/.test(norm)) {
    if (assistantMode) {
      setAssistantMode(null);
      speakAr('تمام، وقفت');
    }
    return;
  }

  // لو في سؤال معلّق (نوع الافتقاد) بننتظر الرد عليه الأول
  if (assistantPending && assistantPending.type === 'visit-type') {
    const isPhone = /تليفون|تلفون|موبايل|فون|اتصال/.test(norm);
    const isHome  = /بيت|منزل|زياره|زيارة/.test(norm);
    if (isPhone && !isHome) {
      assistantMarkVisit(assistantPending.student, 'phone');
      assistantPending = null;
      setAssistantHint('بيسمع دلوقتي… اتكلم براحتك');
    } else if (isHome && !isPhone) {
      assistantMarkVisit(assistantPending.student, 'home');
      assistantPending = null;
      setAssistantHint('بيسمع دلوقتي… اتكلم براحتك');
    } else {
      speakAr('معرفتش، قول تليفون ولا في البيت؟');
      setAssistantHint(`${assistantPending.student.name} — قول: تليفون ولا في البيت؟`);
    }
    return;
  }

  // ===== التنقل بين التابات بالصوت (لازم يتقال معاها "تاب"/"خانة"/"صفحة" عشان متتلخبطش مع أوامر تانية) =====
  if (/تاب|خانه|خانة|صفحه|صفحة|شاشه|شاشة/.test(norm) &&
      /روح|افتح|هات|وري|ورين|ورني|عايز|عاوز|يلا|رجع|ارجع/.test(norm)) {
    const NAV_SECTIONS = [
      { tab: 'attendance', re: /حضور/ },
      { tab: 'students',   re: /مخدوم/ },
      { tab: 'deacons',    re: /خدام|خادم/ },
      { tab: 'stats',      re: /احصاء|إحصاء|احصائي|إحصائي/ },
      { tab: 'online',     re: /متابعه|متابعة|نشاط/ },
    ];
    for (const { tab, re } of NAV_SECTIONS) {
      if (re.test(norm)) {
        const btn = document.getElementById('tab-btn-' + tab);
        if (btn && btn.style.display !== 'none') {
          setAssistantMode(null);
          window.switchTab(tab, btn);
          showToast('📂 اتفتح ' + btn.textContent.trim(), 'success');
          speakAr('تمام');
          return;
        }
      }
    }
  }

  // ===== أمر حذف/إلغاء حضور مسجّل =====
  if (/(شيل|امسح|احذف|الغ[يى]) حضور/.test(norm)) {
    setAssistantMode(null);
    const variants = extractAssistantNameVariants(rawTranscript,
      ['شيل','امسح','احذف','الغي','الغى','حضور','مستر','الخادم','خادم']);
    const match = matchAssistantName(variants, [state.allStudents]);
    if (!match) {
      showToast('❓ مالقتش مخدوم بالاسم ده', 'error');
      speakAr('معرفتش المخدوم ده، قول الاسم تاني');
      return;
    }
    if (!state.todayAttendance[match.id]) {
      showToast(`${match.name} مش مسجل حضور أصلاً النهاردة`, 'info');
      speakAr(`${match.name} مش مسجل حضور أصلاً`);
      return;
    }
    doRemoveAttendance(match.id);
    showToast(`تم حذف حضور ${match.name}`, 'success');
    speakAr(`تم حذف حضور ${match.name}`);
    return;
  }

  // ===== أمر إضافة نجمة =====
  if (/نجم(ه|ة)/.test(norm)) {
    setAssistantMode(null);
    const variants = extractAssistantNameVariants(rawTranscript, ['زود','ضيف','هات','اضف','نجمه','نجمة']);
    const match = matchAssistantName(variants, [state.allStudents]);
    if (!match) {
      showToast('❓ مالقتش مخدوم بالاسم ده', 'error');
      speakAr('معرفتش المخدوم ده، قول الاسم تاني');
      return;
    }
    addStar(match.id);
    return;
  }

  // ===== أسئلة إحصائية سريعة (بيتم الرد عليها محليًا من غير ما نحتاج نت) =====
  if (/كام (واحد |حد )?حضر|عدد الحاضرين|كام حاضر/.test(norm)) {
    const list = attFilteredStudents(state.currentAttGrade);
    const present = list.filter(s => !!state.todayAttendance[s.id]).length;
    const msg = `حضر النهاردة ${present} من أصل ${list.length}`;
    showToast('📊 ' + msg, 'success');
    speakAr(msg);
    return;
  }
  if (/كام (واحد |حد )?غاب|عدد الغايبين|كام غايب/.test(norm)) {
    const list = attFilteredStudents(state.currentAttGrade);
    const absent = list.filter(s => !state.todayAttendance[s.id]);
    if (!absent.length) {
      showToast('📊 محدش غايب النهاردة، الكل حاضر ✅', 'success');
      speakAr('محدش غايب النهاردة، الكل حاضر');
    } else {
      const names = absent.slice(0, 8).map(s => s.name).join('، ');
      showToast(`📊 غاب النهاردة ${absent.length}: ${names}${absent.length > 8 ? '…' : ''}`, 'info');
      speakAr(`غاب النهاردة ${absent.length}`);
    }
    return;
  }
  if (/كام مخدوم عند|كام مخدوم تحت|عدد مخدومين عند/.test(norm)) {
    const variants = extractAssistantNameVariants(rawTranscript, ['كام','مخدوم','عند','تحت','عدد','مخدومين','مستر','الخادم','خادم']);
    const dMatch = matchAssistantName(variants, [asNameCandidates(DEACONS)]);
    if (dMatch) {
      const count = state.allStudents.filter(s => s.deacon === dMatch.name).length;
      const msg = `عند ${dMatch.name} ${count} مخدوم`;
      showToast('📊 ' + msg, 'success');
      speakAr(msg);
      return;
    }
  }
  if (/كام مخدوم|عدد المخدومين/.test(norm)) {
    const msg = `عدد المخدومين كله ${state.allStudents.length}`;
    showToast('📊 ' + msg, 'success');
    speakAr(msg);
    return;
  }
  if (/كام خادم|عدد الخدام/.test(norm)) {
    const msg = `عدد الخدام ${DEACONS.length}`;
    showToast('📊 ' + msg, 'success');
    speakAr(msg);
    return;
  }

  // ===== طلب مساعدة/تعليمات =====
  if (/ساعدني|مساعده|مساعدة|ايه الاوامر|الاوامر|تعليمات|ايه المفروض اقول/.test(norm)) {
    const msg = 'تقدر تقول: سجل حضور فلان، سجل افتقاد لفلان، افتح ملف فلان، اتصل بفلان، شيل حضور فلان، زود نجمة لفلان، كام حضر النهاردة، كام غايب، أو افتح تاب الإحصائيات';
    showToast('💡 ' + msg, 'info');
    speakAr('تقدر تقول سجل حضور، سجل افتقاد، افتح ملف، اتصل، زود نجمة، أو كام حضر النهاردة');
    return;
  }

  // ===== أمر فتح الملف (تنقّل بالصوت) =====
  if (/افتح|فتح ملف|هات ملف|وريني ملف|ورني ملف|عايز ملف|عاوز ملف/.test(norm)) {
    setAssistantMode(null); // أمر صريح جديد بيقفل أي وضع سابق قبل ما نبدأ ده
    const variants = extractAssistantNameVariants(rawTranscript,
      ['افتح','فتح','هات','وريني','ورني','عايز','عاوز','ملف','ملفه','خانه','خانة','مستر','الخادم','خادم','المخدوم']);
    const target = matchAssistantName(variants, [asNameCandidates(DEACONS), state.allStudents]);
    if (!target) {
      showToast('❓ مالقتش حد بالاسم ده', 'error');
      speakAr('معرفتش الاسم ده، قول تاني');
      return;
    }
    assistantOpenByMatch(target);
    setAssistantMode('open');
    return;
  }

  // ===== أمر الافتقاد =====
  if (/افتقاد/.test(norm)) {
    setAssistantMode(null); // أمر صريح جديد بيقفل أي وضع مستمر سابق
    const isPhone = /تليفون|تلفون|موبايل|فون|اتصال/.test(norm);
    const isHome  = /بيت|منزل|زياره|زيارة/.test(norm);
    const variants = extractAssistantNameVariants(rawTranscript,
      ['افتقاد','في','البيت','بالبيت','بيت','منزل','منزلي','تليفون','تليفوني','تلفون','موبايل','فون','اتصال']);
    const match = matchAssistantName(variants, [state.allStudents]);
    if (!match) {
      showToast(`❓ مالقتش مخدوم بالاسم ده`, 'error');
      speakAr('معرفتش المخدوم ده، قول الاسم تاني');
      return;
    }
    assistantLastStudent = match;
    if (isPhone && !isHome) {
      assistantMarkVisit(match, 'phone');
    } else if (isHome && !isPhone) {
      assistantMarkVisit(match, 'home');
    } else {
      assistantPending = { type: 'visit-type', student: match };
      setAssistantHint(`${match.name} — قول: تليفون ولا في البيت؟`);
      speakAr(`${match.name}، الافتقاد ده كان تليفون ولا في البيت؟`);
    }
    return;
  }

  // ===== أمر الحضور =====
  if (/حضور/.test(norm)) {
    const isDeaconHint = /مستر|الخادم|خادم/.test(norm);
    const variants = extractAssistantNameVariants(rawTranscript, ['مستر','الخادم','خادم','المخدوم']);
    const hasName = variants.some(v => v.trim().length > 0);

    // قال "سجل حضور" لوحدها من غير اسم → يدخل وضع تسجيل حضور مستمر
    if (!hasName) {
      setAssistantMode('attendance');
      speakAr('تمام، قول الأسماء وهسجلهم حضور واحد واحد');
      return;
    }

    if (isDeaconHint) {
      const dMatch = matchAssistantName(variants, [asNameCandidates(DEACONS)]);
      if (dMatch) {
        assistantMarkAttendanceByMatch(dMatch);
        setAssistantMode('attendance');
        return;
      }
    }

    const sMatch = matchAssistantName(variants, [attFilteredStudents(state.currentAttGrade), state.allStudents]);
    if (sMatch) {
      assistantMarkAttendanceByMatch(sMatch);
      setAssistantMode('attendance');
      return;
    }

    // مفيش تطابق مخدوم؛ نجرب الخدام كخيار أخير حتى لو من غير كلمة "مستر"
    const dMatch2 = matchAssistantName(variants, [asNameCandidates(DEACONS)]);
    if (dMatch2) {
      assistantMarkAttendanceByMatch(dMatch2);
      setAssistantMode('attendance');
      return;
    }

    showToast(`❓ مالقتش حد بالاسم ده`, 'error');
    speakAr('معرفتش الاسم ده، قول تاني');
    setAssistantMode('attendance'); // نفضل في وضع الحضور حتى لو الاسم ده مش لاقيه، عشان يكمل يقول أسامي
    return;
  }

  // ===== أمر المكالمة =====
  if (/اتصل|ارن|رن علي|رن على|كلمه|كلميه|مكالمه|مكالمة/.test(norm)) {
    setAssistantMode(null); // أمر صريح جديد بيقفل أي وضع مستمر سابق
    const isMom = /مامته|مامتها|ماما|امه|أمه|والدته/.test(norm);
    const isDad = /بابا|ابوه|أبوه|والده/.test(norm);
    const variants = extractAssistantNameVariants(rawTranscript,
      ['اتصل','ارن','رن','علي','على','رقم','مامته','مامتها','ماما','امه','أمه','والدته','بابا','ابوه','أبوه','والده','بيه','بيها']);

    let target = null;
    // لو الاسم اللي فضل فاضي، يبقى المقصود آخر مخدوم اتسجل معاه أمر
    const hasNameLeft = variants.some(v => v.trim().length > 0);
    if (hasNameLeft) {
      target = matchAssistantName(variants, [state.allStudents]);
    }
    if (!target) target = assistantLastStudent;

    if (!target) {
      showToast('❓ مالقتش مخدوم بالاسم ده', 'error');
      speakAr('معرفتش المخدوم ده، قول الاسم تاني');
      return;
    }
    assistantLastStudent = target;

    if (isMom) {
      assistantCallNumber(target.phoneMom, `أم ${target.name}`);
    } else if (isDad) {
      assistantCallNumber(target.phoneDad, `أبو ${target.name}`);
    } else {
      assistantCallNumber(target.phoneStudent || target.phoneMom || target.phoneDad,
        target.phoneStudent ? target.name : (target.phoneMom ? `أم ${target.name}` : `أبو ${target.name}`));
    }
    return;
  }

  // ===== مفيش كلمة أمر واضحة — لو إحنا في وضع مستمر، نتعامل مع اللي اتقال كاسم =====
  if (assistantMode === 'attendance') {
    const variants = extractAssistantNameVariants(rawTranscript);
    const match = matchAssistantName(variants, [attFilteredStudents(state.currentAttGrade), state.allStudents, asNameCandidates(DEACONS)]);
    if (match) {
      assistantMarkAttendanceByMatch(match);
    } else {
      showToast('❓ مالقتش حد بالاسم ده', 'error');
      speakAr('معرفتش الاسم ده، قول تاني');
    }
    return; // نفضل في وضع الحضور لحد ما تتقال كلمة توقف أو أمر تاني
  }

  if (assistantMode === 'open') {
    const variants = extractAssistantNameVariants(rawTranscript);
    const target = matchAssistantName(variants, [asNameCandidates(DEACONS), state.allStudents]);
    if (target) {
      assistantOpenByMatch(target);
    } else {
      showToast('❓ مالقتش حد بالاسم ده', 'error');
      speakAr('معرفتش الاسم ده، قول تاني');
    }
    return; // نفضل في وضع فتح الملفات لحد ما تتقال كلمة توقف أو أمر تاني
  }

  // مفيش أمر معروف ومفيش وضع مستمر شغال → نبعت السؤال للمساعد الذكي (Gemini)
  assistantAskAI(rawTranscript);
}

function initAssistantRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('المتصفح ده مش بيدعم التسجيل الصوتي، جرّب Chrome', 'error'); return null; }
  const rec = new SR();
  rec.lang = 'ar-EG';
  rec.continuous = true;
  rec.interimResults = false;

  rec.onresult = (e) => {
    const res = e.results[e.results.length - 1];
    if (!res.isFinal) return;
    handleAssistantCommand(res[0].transcript.trim());
  };

  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      showToast('محتاج تسمح باستخدام الميكروفون', 'error');
      window.toggleVoiceAssistant(true);
    }
    // no-speech / aborted بيتم تجاهلها وبيكمل يسمع تاني
  };

  rec.onend = () => {
    if (assistantActive) { try { rec.start(); } catch (e) {} } // يكمل يسمع تلقائي طول ما لسه شغال
  };

  return rec;
}

window.toggleVoiceAssistant = (forceStop) => {
  const btn    = document.getElementById('assistant-mic-btn');
  const status = document.getElementById('assistant-status');

  if (assistantActive || forceStop) {
    assistantActive = false;
    assistantRecognition && assistantRecognition.stop();
    if (btn) { btn.textContent = '🎤'; btn.style.background = ''; }
    if (status) status.style.display = 'none';
    assistantPending = null;
    assistantMode = null;
    return;
  }

  assistantRecognition = assistantRecognition || initAssistantRecognition();
  if (!assistantRecognition) return;
  assistantActive = true;
  // the assistant works on the students, the servants and today's attendance: load them now if the screens didn't
  ensureCoreData().catch(() => {}); ensureDeaconAttendance().catch(() => {});
  try { assistantRecognition.start(); } catch (e) {}
  if (btn) { btn.textContent = '⏹'; btn.style.background = 'linear-gradient(135deg,#e74c3c,#c0392b)'; }
  if (status) status.style.display = 'block';
  assistantPending = null;
  assistantMode = null;
  setAssistantHint('بيسمع دلوقتي… اتكلم براحتك');
  setAssistantHeard('');
};
