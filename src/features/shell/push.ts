// @ts-nocheck
import { updateDoc, doc } from 'firebase/firestore';
import { app, auth, db } from '@/core/firebase';

// ===== إشعارات الموبايل (Push) لطلبات تسجيل الخدام الجداد =====
// 1) FCM_VAPID_KEY: Firebase Console → Project settings → Cloud Messaging → Web Push certificates → Generate key pair (انسخ الـ Key العام)
// 2) PUSH_WORKER_URL: رابط الـ Cloudflare Worker المجاني (ملف push-worker.js)
const FCM_VAPID_KEY   = import.meta.env.VITE_FCM_VAPID_KEY || '';

const PUSH_WORKER_URL = import.meta.env.VITE_PUSH_WORKER_URL || '';

const isPushKeyReady    = () => !!FCM_VAPID_KEY && !FCM_VAPID_KEY.includes('REPLACE');

const isPushWorkerReady = () => !!PUSH_WORKER_URL && !PUSH_WORKER_URL.includes('REPLACE');

const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// بيسجّل جهاز المسؤول في FCM ويحفظ الـ token في users/{uid}.fcmTokens (الـ Worker بيقراه من هناك)
async function savePushToken(user, askPermission) {
  if (!pushSupported()) throw new Error('unsupported');
  if (Notification.permission === 'denied') throw new Error('denied');
  if (Notification.permission !== 'granted') {
    if (!askPermission) return null;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('denied');
  }
  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) throw new Error('unsupported');
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, rej) => setTimeout(() => rej(new Error('no-sw')), 8000))
  ]);
  const token = await getToken(getMessaging(app), { vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: reg });
  if (!token) throw new Error('no-token');
  const cacheKey = 'fcmTokenSaved:' + user.uid;
  try { if (localStorage.getItem(cacheKey) === token) return token; } catch (e) {}
  const { arrayUnion } = await import("firebase/firestore");
  await updateDoc(doc(db, 'users', user.uid), { fcmTokens: arrayUnion(token) });
  try { localStorage.setItem(cacheKey, token); } catch (e) {}
  return token;
}

// بيشيل الـ token المحفوظ بتاع الجهاز ده من Firestore، فالـ Worker يبطّل يبعتله إشعارات
async function removePushToken(user) {
  const cacheKey = 'fcmTokenSaved:' + user.uid;
  let token = null;
  try { token = localStorage.getItem(cacheKey); } catch (e) {}
  if (token) {
    const { arrayRemove } = await import("firebase/firestore");
    try { await updateDoc(doc(db, 'users', user.uid), { fcmTokens: arrayRemove(token) }); } catch (e) { console.warn('remove token:', e); }
  }
  try { localStorage.removeItem(cacheKey); } catch (e) {}
}

// علم محلي على الجهاز ده بس: قفل الإشعارات يدويًا من غير ما نلمس إذن المتصفح (اللي محدش غير المستخدم يقدر يسحبه)
const pushDisabledKey = (uid) => 'pushDisabled:' + uid;

const isPushDisabledHere = (uid) => { try { return localStorage.getItem(pushDisabledKey(uid)) === '1'; } catch (e) { return false; } };

function isPushOnHere(uid) {
  return pushSupported() && Notification.permission === 'granted' && !isPushDisabledHere(uid);
}

function updatePushBell() {
  const b = document.getElementById('push-bell-btn');
  if (!b || !auth.currentUser) return;
  const on = isPushOnHere(auth.currentUser.uid);
  b.innerHTML = on ? '🔔 قفل الإشعارات' : '🔕 شغّل الإشعارات';
  b.title = on ? 'الإشعارات شغّالة على الجهاز ده — دوس تقفلها' : 'شغّل إشعارات الموبايل (فقرات وطلبات تسجيل)';
}

// بيتنادى من applyRoleUI: الجرس بيظهر لكل مستخدم معتمد (مش بس المسؤولين) عشان أي خادم يقدر ياخد إشعار فقرة على موبايله
export function setupPushBell(show) {
  const b = document.getElementById('push-bell-btn');
  if (!b) return;
  b.style.display = show ? 'flex' : 'none';
  if (!show) return;
  updatePushBell();
  if (isPushKeyReady() && auth.currentUser && isPushOnHere(auth.currentUser.uid)) {
    savePushToken(auth.currentUser, false).catch(e => console.warn('push token refresh:', e));
  }
}

window.enablePushNotifications = async () => {
  const user = auth.currentUser;
  if (!user) return;

  // الجرس شغّال بالفعل على الجهاز ده → دوسة تانية تقفله
  if (isPushOnHere(user.uid)) {
    try { localStorage.setItem(pushDisabledKey(user.uid), '1'); } catch (e) {}
    await removePushToken(user).catch(e => console.warn('remove push token:', e));
    updatePushBell();
    showToast('🔕 الإشعارات اتقفلت على الجهاز ده', 'info');
    return;
  }

  if (!isPushKeyReady()) { showToast('حط FCM_VAPID_KEY في الكود الأول', 'error'); return; }
  if (!pushSupported()) {
    const iosBrowser = /iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone;
    showToast(iosBrowser ? 'ضيف التطبيق للشاشة الرئيسية الأول' : 'الجهاز ده مش بيدعم الإشعارات', 'error');
    return;
  }
  try {
    await savePushToken(user, true);
    try { localStorage.removeItem(pushDisabledKey(user.uid)); } catch (e) {}
    updatePushBell();
    showToast('✅ الإشعارات اشتغلت', 'success');
  } catch (e) {
    console.warn('enable push error:', e);
    updatePushBell();
    let msg = 'مقدرتش أشغّل الإشعارات';
    if (e.message === 'denied') msg = 'الإشعارات متقفلة من إعدادات الجهاز';
    else if (e.message === 'no-sw') msg = 'اعمل ريفريش وجرب تاني';
    else if (e.code === 'permission-denied') msg = 'قواعد Firestore مانعة حفظ الـ token';
    showToast(msg, 'error');
  }
};

// بيتنادى وقت تسجيل خادم جديد: بيبعت الـ ID token للـ Worker، والـ Worker بيتحقق منه ويبعت Push للمسؤولين
export async function notifyManagersPush(user) {
  if (!isPushWorkerReady()) return;
  try {
    const idToken = await user.getIdToken();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    await fetch(PUSH_WORKER_URL.replace(/\/+$/, '') + '/new-deacon', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + idToken },
      signal: ctrl.signal
    });
    clearTimeout(timer);
  } catch (e) { console.warn('push notify error:', e); }
}

// بيتنادى وقت توزيع فقرة: بيبعت اسم الخادم وتفاصيل الفقرة للـ Worker على route جديد (/new-part)،
// والـ Worker المفروض يدوّر على fcmTokens بتاعت الخادم ده في users ويبعتله Push فيها نوع وتفاصيل الفقرة
export async function notifyDeaconPush(deaconName, part) {
  if (!isPushWorkerReady()) return;
  try {
    const idToken = await auth.currentUser.getIdToken();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    await fetch(PUSH_WORKER_URL.replace(/\/+$/, '') + '/new-part', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + idToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ deaconName, type: part.type, title: part.title, date: part.date, grade: part.grade }),
      signal: ctrl.signal
    });
    clearTimeout(timer);
  } catch (e) { console.warn('part push notify error:', e); }
}
