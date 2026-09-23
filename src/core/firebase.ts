// @ts-nocheck
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from 'firebase/firestore';

const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

export const app  = initializeApp(firebaseConfig);

// ===== APP CHECK (reCAPTCHA Enterprise) =====
// Production always uses reCAPTCHA. In `npm run dev` the reCAPTCHA key can't be used, and an
// unregistered debug token makes Auth fail before the request is even sent. So in dev App Check
// is skipped unless VITE_APPCHECK_DEBUG_TOKEN is set (needed only if enforcement is turned on
// in the Firebase console; register the token under App Check -> Manage debug tokens).
if (!env.DEV || env.VITE_APPCHECK_DEBUG_TOKEN) {
  if (env.DEV) self.FIREBASE_APPCHECK_DEBUG_TOKEN = env.VITE_APPCHECK_DEBUG_TOKEN;
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(env.VITE_RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true
  });
}

export const auth = getAuth(app);

// ===== OFFLINE PERSISTENCE =====
// بيخلي Firestore يخزّن نسخة من البيانات على الجهاز (IndexedDB)، فتقدر تفتح
// الموقع وتسجّل حضور وانت أوفلاين عادي، ولما النت يرجع بيزامن كل حاجة تلقائي.
export let db;

try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  // لو المتصفح مش بيدعم IndexedDB (متصفح خاص/قديم) أو حصل خطأ، نرجع للوضع العادي
  console.warn('offline persistence unavailable, falling back to memory cache:', e);
  db = getFirestore(app);
}
