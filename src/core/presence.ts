// @ts-nocheck
import { setDoc, doc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { state } from '@/core/state';
import { auth, db } from '@/core/firebase';
import { sectionTag } from '@/core/section';

// ===== PRESENCE ("online now") =====
let presenceInterval = null;

export async function startPresence(uid) {
  const ping = () => setDoc(doc(db, 'users', uid), {
    lastActive: serverTimestamp(),
    lastActiveTab: document.hidden ? 'background' : 'active'
  }, { merge: true }).catch(() => {});
  ping();
  if (presenceInterval) clearInterval(presenceInterval);
  presenceInterval = setInterval(ping, 25000); // heartbeat كل 25 ثانية
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ping(); });
}

export function stopPresence() {
  if (presenceInterval) { clearInterval(presenceInterval); presenceInterval = null; }
}

// ===== ACTIVITY LOG (what deacons are doing) =====
export async function logActivity(action, details = '') {
  try {
    await addDoc(collection(db, 'activity_log'), {
      uid:  auth.currentUser?.uid  || '',
      name: state.currentUserName || state.currentUserEmail || 'غير معروف',
      role: state.currentUserRole || '',
      grade: state.activeGrade || null,
      section: sectionTag(),
      action, details,
      timestamp: serverTimestamp()
    });
  } catch (e) { console.warn('logActivity error:', e); }
}
