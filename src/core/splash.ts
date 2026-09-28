// @ts-nocheck

// ===== شبكة أمان: لو الشاشة فضلت "جاري التحميل" أكتر من 7 ثواني لأي سبب،
// نجبرها تختفي بدل ما تفضل عالقة للأبد =====
// ملحوظة: الرقم ده لازم يكون أكبر من أطول وقت ممكن ياخده تحميل البيانات العادي
// (loadConfig + getDocFast اللي سقفها 3.5 ثانية) عشان ميطلعش رسالة خطأ حمرا
// غلط لمستخدم نته شوية بطيء بس التطبيق هيفتح عادي بعد لحظات.
window.__splashWatchdog = setTimeout(() => {
  const sp = document.getElementById('splash-screen');
  if (sp && sp.style.display !== 'none') {
    sp.style.display = 'none';
    const authV = document.getElementById('auth-screen');
    const appV  = document.getElementById('app-screen');
    if (appV && appV.style.display === 'flex') return; // already loaded fine
    if (authV) authV.style.display = 'flex';
    showToast('في مشكلة اتصال — حاول تفتح الموقع تاني لما النت يرجع', 'error');
  }
}, 7000);

// أي مسار بيقفل شاشة splash-screen عادي (دخول ناجح، حساب معلّق، بروفايل ناقص، تسجيل خروج...)
// لازم يلغي الـ watchdog عشان الرسالة الحمرا متظهرش غلط لو الرد جه بعد اللحظة اللي
// كانت الشاشة لسه فيها "جاري التحميل" وقت ما الـ watchdog اشتغل.
export function clearSplashWatchdog() {
  if (window.__splashWatchdog) { clearTimeout(window.__splashWatchdog); window.__splashWatchdog = null; }
}
