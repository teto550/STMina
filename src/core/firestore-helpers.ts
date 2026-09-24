// @ts-nocheck
import { getDocFromCache, getDoc, getDocsFromCache, getDocs } from 'firebase/firestore';

// Dev only (`npm run dev`): counts documents fetched from the SERVER, which is what Firestore bills as reads.
// Open the console and run `__reads` to see the total and a breakdown, e.g. after loading a screen.
const DEV_READS = import.meta.env.DEV ? (window.__reads = { total: 0, byPath: {} }) : null;
export function countReads(label, n) {
  if (!DEV_READS || !n) return;
  DEV_READS.total += n; DEV_READS.byPath[label] = (DEV_READS.byPath[label] || 0) + n;
  console.debug(`[reads] +${n} ${label} (total ${DEV_READS.total})`);
}
const pathOf = q => { try { return q.path || q._query.path.canonicalString(); } catch (e) { return 'query'; } };
export const countSnapshot = (label, snap) => { if (snap && !(snap.metadata && snap.metadata.fromCache)) countReads(label, snap.docChanges ? Math.max(snap.docChanges().length, 1) : Math.max((snap.docs || []).length, 1)); };

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
    const snap = await Promise.race([
      getDocs(q),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
    ]);
    countSnapshot(pathOf(q), snap);
    return snap;
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

// ===== Short-lived read cache =====
// Serves a query from Firestore's local cache when the same query was fetched from the server less than `ttlMs`
// ago (default 5 minutes): that costs no reads. The "when" is kept in MEMORY only, so it lives as long as the page is
// open: a page load or reload always fetches from the server first. Changes made on OTHER devices show up after the
// TTL; changes made on this device are always in the local cache. `force` skips the cache (imports, refresh button).
const READ_TTL_MS = 5 * 60 * 1000;
const fetchedAt = new Map();
export async function getDocsTtl(q, key, { force = false, ttlMs = READ_TTL_MS } = {}) {
  if (!force) {
    const t = fetchedAt.get(key) || 0;
    if (t && Date.now() - t < ttlMs) {
      try { const cached = await getDocsFromCache(q); if (cached.docs.length) return cached; } catch (e) { /* not cached: fall through */ }
    }
  }
  const snap = await getDocsFast(q);
  if (snap && snap.metadata && !snap.metadata.fromCache) fetchedAt.set(key, Date.now());
  return snap;
}
export function clearReadCache() { fetchedAt.clear(); }
