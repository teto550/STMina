// @ts-nocheck
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { state } from '@/core/state';
import { loadDeaconsList } from '@/features/servants/deacons';
import { populateUniversitySelect } from '@/features/servants/servants';
import { auth, db } from '@/core/firebase';
import { SECTION, applySectionTheme } from '@/core/section';
import { notifyManagersPush } from '@/features/shell/push';
import { ADMIN_EMAIL, EMAILJS_PUBLIC, EMAILJS_SERVICE, EMAILJS_TEMPLATE, loadConfig } from '@/core/config';
import { logActivity, stopPresence } from '@/core/presence';
import { getDocFast, loadProfileCache } from '@/core/firestore-helpers';
import { getPhaseGradesForGrade, normalizePhaseGrades } from '@/core/session';
import { clearSplashWatchdog } from '@/core/splash';
import { isProfileIncomplete, openCompleteProfileScreen } from '@/features/auth/profile-complete';
import { enterApp } from '@/features/shell/app-shell';

// ===== AUTH TAB SWITCH =====
window.switchAuthTab = (tab) => {
  document.getElementById('auth-panel-login').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('auth-panel-register').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('auth-tab-login').classList.toggle('active',    tab === 'login');
  document.getElementById('auth-tab-register').classList.toggle('active', tab === 'register');
  if (tab === 'register') {
    loadDeaconsList(); // refresh names list every time the tab opens
    populateUniversitySelect('reg-university');
    toggleRegGradFields();
  }
};

// ===== LOGIN =====
window.doLogin = async () => {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const err   = document.getElementById('login-error');
  const btn   = document.getElementById('login-btn');
  btn.disabled = true; btn.textContent = 'جاري الدخول…';
  err.style.display = 'none';
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch(e) {
    console.error('login failed:', e.code, e.message);
    err.textContent = 'بيانات خاطئة، حاول تاني';
    err.style.display = 'block';
    btn.disabled = false; btn.textContent = 'دخول';
  }
};

// ===== REGISTER =====
window.doRegister = async () => {
  const grade   = document.getElementById('reg-grade').value;
  const name    = document.getElementById('reg-name').value.trim();
  const email   = document.getElementById('reg-email').value.trim();
  const phones  = getPhoneValues('reg-phones');
  const address = document.getElementById('reg-address').value.trim();
  const dob     = document.getElementById('reg-dob').value;
  const gradStatus = document.getElementById('reg-grad-status').value; // 'student' | 'graduated'
  const college    = document.getElementById('reg-college').value.trim();
  const university = document.getElementById('reg-university').value;
  const pass  = document.getElementById('reg-pass').value;
  const err   = document.getElementById('reg-error');
  const btn   = document.getElementById('reg-btn');
  const suc   = document.getElementById('reg-success');
  err.style.display = 'none'; suc.style.display = 'none';
  if (!grade) { err.textContent = 'اختار السنة الدراسية اللي هتخدم فيها'; err.style.display='block'; return; }
  if (!name)  { err.textContent = 'اختار اسمك من القايمة'; err.style.display='block'; return; }
  if (!email) { err.textContent = 'اكتب الإيميل'; err.style.display='block'; return; }
  if (!phones.length) { err.textContent = 'اكتب رقم التليفون'; err.style.display='block'; return; }
  if (pass.length < 6) { err.textContent = 'كلمة المرور 6 أحرف على الأقل'; err.style.display='block'; return; }
  btn.disabled = true; btn.textContent = 'جاري الإرسال…';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await setDoc(doc(db, 'users', cred.user.uid), {
      name, email, grade, role: 'deacon', status: 'pending', createdAt: serverTimestamp(),
      phones, phone: phones[0], address, dob, section: SECTION,
      graduated: gradStatus === 'graduated',
      college: gradStatus === 'student' ? college : '',
      university: gradStatus === 'student' ? university : ''
    });
    // Send email to admin via EmailJS
    await Promise.allSettled([
      sendAdminEmail(name, email, grade, cred.user.uid),
      notifyManagersPush(cred.user)
    ]);
    await signOut(auth);
    suc.style.display = 'block';
    btn.disabled = false; btn.textContent = '📨 طلب تسجيل';
    document.getElementById('reg-grade').value = '';
    document.getElementById('reg-name').value = '';
    document.getElementById('reg-email').value = '';
    renderPhoneRows('reg-phones', ['']);
    document.getElementById('reg-address').value = '';
    document.getElementById('reg-dob').value = '';
    document.getElementById('reg-grad-status').value = 'student';
    document.getElementById('reg-college').value = '';
    document.getElementById('reg-university').value = '';
    toggleRegGradFields();
    document.getElementById('reg-pass').value = '';
    populateRegDeaconSelect();
  } catch(e) {
    let msg = 'حدث خطأ، حاول تاني';
    if (e.code === 'auth/email-already-in-use') msg = 'الإيميل ده مسجل بالفعل';
    err.textContent = msg; err.style.display = 'block';
    btn.disabled = false; btn.textContent = '📨 طلب تسجيل';
  }
};

async function sendAdminEmail(name, email, grade, uid) {
  try {
    if (!window.emailjs) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
      emailjs.init(EMAILJS_PUBLIC);
    }
    await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
      admin_email: ADMIN_EMAIL,
      deacon_name: name,
      deacon_email: email,
      deacon_grade: grade,
      deacon_uid: uid,
      approve_link: `${location.origin}${location.pathname}?approve=${uid}`,
    });
  } catch(e) {
    console.warn('EmailJS error:', e);
  }
}

// تنبيه أمني للأدمن: حد سجّل دخول بحساب Firebase من غير ما يعدي على فورم "خادم جديد"
// بتاعنا خالص (يبقى مالوش سجل في users). بنستخدم نفس قالب الإيميل، بس بنحط تحذير
// واضح في اسم "الخادم" واللينك فاضي عشان محدش يوافق عليه بالغلط.
async function sendUnauthorizedAttemptAlert(email, uid) {
  if (!ADMIN_EMAIL) return; // مفيش إيميل أدمن متسجل أصلاً، منقدرش نبعت
  try {
    if (!window.emailjs) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
      emailjs.init(EMAILJS_PUBLIC);
    }
    await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
      admin_email: ADMIN_EMAIL,
      deacon_name: '⚠️ تنبيه أمني: حساب مش مسجل حاول يدخل البرنامج',
      deacon_email: email,
      deacon_grade: '—',
      deacon_uid: uid,
      approve_link: '(محدش يوافق على الحساب ده — راجعه في Firebase Console → Authentication)',
    });
  } catch(e) {
    console.warn('sendUnauthorizedAttemptAlert error:', e);
  }
}

window.doLogout = async () => {
  if (state.partNotifUnsub) { state.partNotifUnsub(); state.partNotifUnsub = null; }
  await logActivity('خرج من التطبيق');
  stopPresence();
  await signOut(auth);
};

onAuthStateChanged(auth, async user => {
  if (user) {
    // Load config first (so ADMIN_EMAIL is ready) — ما بيعلقش لو مفيش نت
    await loadConfig();
    // Load user profile — قراءة آمنة بسقف زمني، ولو فشلت تمامًا نستخدم آخر
    // بيانات معروفة عن المستخدم ده كانت متخزنة محلي (offline fallback)
    const snap = await getDocFast(doc(db, 'users', user.uid));
    let snapData = (snap && snap.exists && snap.exists()) ? snap.data() : null;
    const cachedProfile = loadProfileCache(user.uid);
    if (!snapData && cachedProfile) snapData = cachedProfile;

    // Admin check: email matches config OR Firestore role=admin
    const isAdminByEmail = ADMIN_EMAIL && user.email === ADMIN_EMAIL;
    const isAdminByRole  = snapData && snapData.role === 'admin';

    if (isAdminByEmail || isAdminByRole) {
      state.currentUserRole  = 'admin';
      state.currentUserName  = snapData?.name || 'الأدمن';
      state.currentUserEmail = user.email;
      state.currentUserGrade = snapData?.grade || null;
      state.currentUserIsLead = !!snapData?.isLead;
      state.currentUserIsPhaseLead = !!snapData?.isPhaseLead || normalizePhaseGrades(snapData?.phaseGrades).length > 0;
      state.currentUserPhaseGrades = normalizePhaseGrades(snapData?.phaseGrades || (snapData?.isPhaseLead && snapData?.grade ? getPhaseGradesForGrade(snapData.grade) : []));
      // Always ensure admin doc is correct (في الخلفية، من غير ما نستنى)
      setDoc(doc(db, 'users', user.uid), {
        name: snapData?.name || 'الأدمن',
        email: user.email, role: 'admin', status: 'approved', createdAt: serverTimestamp()
      }, { merge: true }).catch(() => {});
    } else if (snapData) {
      if (snapData.status === 'pending') {
        applySectionTheme(false);
        clearSplashWatchdog();
        document.getElementById('splash-screen').style.display  = 'none';
        document.getElementById('auth-screen').style.display    = 'none';
        document.getElementById('app-screen').style.display     = 'none';
        document.getElementById('pending-screen').style.display = 'flex';
        return;
      }
      if (snapData.status === 'rejected') {
        clearSplashWatchdog();
        await signOut(auth);
        const err = document.getElementById('login-error');
        err.textContent = 'تم رفض حسابك من الأدمن';
        err.style.display = 'block';
        return;
      }
      state.currentUserRole  = snapData.role || 'deacon';
      state.currentUserName  = snapData.name || user.email;
      state.currentUserEmail = user.email;
      state.currentUserGrade = snapData.grade || null;
      state.currentUserIsLead = !!snapData.isLead;
      state.currentUserIsPhaseLead = !!snapData.isPhaseLead || normalizePhaseGrades(snapData.phaseGrades).length > 0;
      state.currentUserPhaseGrades = normalizePhaseGrades(snapData.phaseGrades || (snapData.isPhaseLead && snapData.grade ? getPhaseGradesForGrade(snapData.grade) : []));
    } else {
      // مفيش أي سجل في Firestore ولا في الكاش المحلي للحساب ده — يبقى إما (أ) حساب
      // اتعمل من بره شاشة التسجيل بتاعت البرنامج (تجاوز أمني حقيقي)، أو (ب) مشكلة
      // اتصال حقيقية مع جهاز مادخلش بيه قبل كده. في الحالتين الصح إننا منديش دخول
      // تلقائي بافتراض إنه "خادم عادي" — ده كان الثغرة اللي بتسمح لأي حد يعمل حساب
      // في Firebase مباشرة (من غير ما يعدي على فورم التسجيل) ويدخل البرنامج كخادم.
      applySectionTheme(false);
      clearSplashWatchdog();
      document.getElementById('splash-screen').style.display  = 'none';
      document.getElementById('app-screen').style.display     = 'none';
      document.getElementById('pending-screen').style.display = 'none';
      document.getElementById('complete-profile-screen').style.display = 'none';
      document.getElementById('auth-screen').style.display    = 'flex';
      try { await signOut(auth); } catch (e) {}
      const err = document.getElementById('login-error');
      if (err) {
        err.textContent = navigator.onLine
          ? 'الحساب ده مش مسجل في البرنامج. سجّل الأول من "خادم جديد" واستنى موافقة الأدمن.'
          : 'مش قادرين نتأكد من حسابك (مفيش نت). جرب تاني لما النت يرجع.';
        err.style.display = 'block';
      }
      // نبّه الأدمن بإيميل — بس لو متأكدين إننا فعلاً أونلاين وقرينا من السيرفر (مش
      // مجرد مشكلة نت مؤقتة)، عشان مانبعتش تنبيهات كاذبة لمستخدم حقيقي نته بايظ
      if (navigator.onLine) {
        sendUnauthorizedAttemptAlert(user.email || '(بدون إيميل)', user.uid).catch(() => {});
      }
      return;
    }

    // خادم/أدمن لسه بياناته الأساسية (تليفون/عنوان/ميلاد/حالة دراسية) ناقصة؟ يتاخد منه أول حاجة قبل ما يكمل
    if (isProfileIncomplete(snapData)) {
      applySectionTheme(false);
      clearSplashWatchdog();
        document.getElementById('splash-screen').style.display  = 'none';
      document.getElementById('auth-screen').style.display    = 'none';
      document.getElementById('pending-screen').style.display = 'none';
      document.getElementById('app-screen').style.display     = 'none';
      openCompleteProfileScreen(user, snapData);
      return;
    }

    await enterApp(user, snapData);
  } else {
    state.currentUserRole = null;
    state.currentUserGrade = null;
    state.currentUserPhaseGrades = [];
    state.currentUserIsLead = false;
    state.currentUserIsPhaseLead = false;
    state.activeGrade = null;
    window.__loginLogged = false;
    applySectionTheme(false);
    stopPresence();
    if (state.todayAttendanceUnsub) { state.todayAttendanceUnsub(); state.todayAttendanceUnsub = null; }
    clearSplashWatchdog();
        document.getElementById('splash-screen').style.display  = 'none';
    document.getElementById('auth-screen').style.display    = 'flex';
    document.getElementById('app-screen').style.display     = 'none';
    document.getElementById('pending-screen').style.display = 'none';
    document.getElementById('complete-profile-screen').style.display = 'none';
    document.getElementById('login-btn').disabled    = false;
    document.getElementById('login-btn').textContent = 'دخول';
  }
});
