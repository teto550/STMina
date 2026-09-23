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

// ===== ONLINE / OFFLINE STATUS =====
// كلمة صغيرة جنب زرار الخروج توضح حالة الاتصال، أخضر = أونلاين / أحمر = أوفلاين
function updateOnlineBanner() {
  const el = document.getElementById('net-status');
  if (!el) return;
  if (navigator.onLine) {
    el.innerHTML = '<span style="width:7px;height:7px;border-radius:50%;background:var(--success);display:inline-block"></span><span style="color:var(--success)">أونلاين</span>';
  } else {
    el.innerHTML = '<span style="width:7px;height:7px;border-radius:50%;background:var(--danger);display:inline-block"></span><span style="color:var(--danger)">أوفلاين</span>';
  }
}

window.addEventListener('load', updateOnlineBanner);

window.addEventListener('online', () => {
  updateOnlineBanner();
  showToast('🔄 رجع النت... جاري تثبيت الحضور', 'info');
  waitForPendingWrites(db).then(() => {
    showToast('✅ اتزامنت كل البيانات مع السيرفر', 'success');
  }).catch(() => {});
});

window.addEventListener('offline', () => {
  updateOnlineBanner();
  showToast('📴 النت مقطوع — هتقدر تسجل حضور عادي وهيتزامن لما النت يرجع', 'info');
});
