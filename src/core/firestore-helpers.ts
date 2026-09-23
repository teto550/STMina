// @ts-nocheck
import { getDocFromCache, getDoc, getDocsFromCache, getDocs } from 'firebase/firestore';

// ===== قراءة آمنة من Firestore ما بتعلّقش الشاشة =====
// لو النت بطيء/مقطوع، getDoc العادي ممكن يفضل معلّق فترة طويلة قبل ما يرجع
// من الكاش المحلي. هنا بنحط سقف زمني (3.5 ثانية)، ولو عدّى بندوّر في
// الكاش المحلي مباشرة، ولو برضه مفيش حاجة بنرجع null بدل ما نعلّق الشاشة.
export async function getDocFast(ref, timeoutMs = 3500) {
  if (!navigator.onLine) {
    try { return await getDocFromCache(ref); } catch (e) { return null; }
  }
  try {
    return await Promise.race([
      getDoc(ref),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
    ]);
  } catch (e) {
    try { return await getDocFromCache(ref); } catch (e2) { return null; }
  }
}

// نفس الفكرة بس لقوائم كاملة (getDocs) — لو النت بطيء/مقطوع منستناش للأبد،
// بنرجع أقرب نسخة متخزنة محلي بدل ما القايمة تفضل "جاري التحميل" للأبد
export async function getDocsFast(q, timeoutMs = 3500) {
  if (!navigator.onLine) {
    try { return await getDocsFromCache(q); } catch (e) { return { docs: [] }; }
  }
  try {
    return await Promise.race([
      getDocs(q),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
    ]);
  } catch (e) {
    try { return await getDocsFromCache(q); } catch (e2) { return { docs: [] }; }
  }
}

// كاش بسيط لدور المستخدم في localStorage عشان لو مفيش نت ومفيش كاش
// Firestore متاح، نقدر برضه ندخّله على آخر دور معروف له
export function saveProfileCache(uid, data) {
  try { localStorage.setItem('profile_' + uid, JSON.stringify(data)); } catch (e) {}
}

export function loadProfileCache(uid) {
  try { return JSON.parse(localStorage.getItem('profile_' + uid) || 'null'); } catch (e) { return null; }
}
