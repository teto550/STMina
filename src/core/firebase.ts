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
// On localhost the reCAPTCHA key isn't valid, so in `npm run dev` we use an App Check
// debug token instead (see .env.example). Must be set before initializeAppCheck().
if (env.DEV) {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = env.VITE_APPCHECK_DEBUG_TOKEN || true;
}
initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(env.VITE_RECAPTCHA_SITE_KEY),
  isTokenAutoRefreshEnabled: true
});

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
