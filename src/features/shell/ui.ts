// @ts-nocheck
import { waitForPendingWrites } from 'firebase/firestore';
import { db } from '@/core/firebase';

// ===== TOAST =====
let toastTimer;

window.showToast = (msg, type = 'info') => {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 2800);
};

// ===== ONLINE / OFFLINE MESSAGES =====
window.addEventListener('online', () => {
  showToast('🔄 رجع النت... جاري تثبيت الحضور', 'info');
  waitForPendingWrites(db).then(() => {
    showToast('✅ اتزامنت كل البيانات مع السيرفر', 'success');
  }).catch(() => {});
});

window.addEventListener('offline', () => {
  showToast('📴 النت مقطوع — هتقدر تسجل حضور عادي وهيتزامن لما النت يرجع', 'info');
});
