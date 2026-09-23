// @ts-nocheck
import { doc } from 'firebase/firestore';
import { state } from '@/core/state';
import { getDocFast } from '@/core/firestore-helpers';
import { db } from '@/core/firebase';
import { SECTION } from '@/core/section';

// يتجيبوا من Firestore → config/settings
export let ADMIN_EMAIL        = 'hdour@gmail.com'; // fallback لو مفيش config في Firestore

export let EMAILJS_SERVICE    = '';

export let EMAILJS_TEMPLATE   = '';

export let EMAILJS_PUBLIC     = '';

export let CLEANED_ATTENDANCE_GRADES = []; // أسماء الفصول اللي اتعمللها تنظيف حضور قديم يدوي بالفعل (فبيختفي زرارها)

export async function loadConfig() {
  try {
    const snap = await getDocFast(doc(db, 'config', 'settings'));
    if (snap && snap.exists()) {
      const d = snap.data();
      ADMIN_EMAIL      = d.adminEmail      || ADMIN_EMAIL;
      EMAILJS_SERVICE  = d.emailjsService  || '';
      EMAILJS_TEMPLATE = d.emailjsTemplate || '';
      EMAILJS_PUBLIC   = d.emailjsPublic   || '';
      state.LEGACY_MIGRATED  = !!d.legacyMigrated;
      { const k = SECTION === 'girls' ? 'cleanedAttendanceGradesGirls' : 'cleanedAttendanceGrades'; CLEANED_ATTENDANCE_GRADES = Array.isArray(d[k]) ? d[k] : []; }
    }
  } catch(e) { console.warn('loadConfig error:', e); }
}
