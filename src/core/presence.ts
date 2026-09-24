// @ts-nocheck
import { setDoc, doc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { state } from '@/core/state';
import { auth, db } from '@/core/firebase';
import { sectionTag } from '@/core/section';

// ===== LAST ACTIVE =====
// One write each time the app is opened or reloaded (users/{uid}.lastActive). No heartbeat, no monitoring.
let lastActiveTouched = false;
export function touchLastActive(uid) {
  if (lastActiveTouched || !uid) return;
  lastActiveTouched = true;
  setDoc(doc(db, 'users', uid), { lastActive: serverTimestamp() }, { merge: true }).catch(() => {});
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
