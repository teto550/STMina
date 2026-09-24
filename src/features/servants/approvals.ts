// @ts-nocheck
import { updateDoc, doc, getDoc, getDocs, query, collection, where } from 'firebase/firestore';
import { findApprovalPatch } from '@/core/access-link';
import { state } from '@/core/state';
import { db } from '@/core/firebase';
import { logActivity } from '@/core/presence';
import { GRADES, SECTION } from '@/core/section';
import { getUserManagedGrades } from '@/core/session';

// تسمية تاب الخدام: "الخدام" + شارة عدد طلبات التسجيل المعلّقة للسنة الحالية (أدمن/مسؤول سنة)، أو "افتقاد" + عدد اللي ما تمش افتقادهم الشهر ده (خادم عادي)
window.updateDeaconsTabLabel = function() {
  const isAdmin = state.currentUserRole === 'admin';
  const isGradeManager = isAdmin || state.currentUserIsLead || state.currentUserIsPhaseLead;
  const label = document.getElementById('deacons-tab-label');
  const badge = document.getElementById('deacons-tab-badge');
  if (!label || !badge) return;
  if (isGradeManager) {
    label.textContent = 'الخدام';
    badge.innerHTML = state.pendingDeaconsCount > 0
      ? `<span style="background:rgba(243,156,18,0.9);color:#fff;font-size:10px;font-weight:700;border-radius:10px;padding:1px 6px;margin-inline-start:5px">${state.pendingDeaconsCount}</span>`
      : '';
  } else {
    label.textContent = 'افتقاد';
    const notVisitedCount = (typeof state.allStudents !== 'undefined' ? state.allStudents : [])
      .filter(s => s.deacon === state.currentUserName && !isVisitedThisMonth(s)).length;
    badge.innerHTML = `<span style="background:rgba(231,76,60,0.85);color:#fff;font-size:10px;font-weight:700;border-radius:10px;padding:1px 6px;margin-inline-start:5px">${notVisitedCount}</span>`;
  }
};

// ===== APPROVE / REJECT DEACON =====
export async function approveDeacon(uid) {
  // link the account to its person of the servants list and give it the access of that person's roles (never blocks the approval)
  let link = {};
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) link = await findApprovalPatch(snap.data());
    // only an admin may change the access snapshot and the admin flag; a class lead approving just records the link
    if (state.currentUserRole !== 'admin') link = link.deaconId ? { deaconId: link.deaconId } : {};
  } catch (e) { console.warn('could not link the account to its person:', e); }
  await updateDoc(doc(db, 'users', uid), { status: 'approved', ...link });
  showToast('✅ تم قبول الخادم', 'success');
  logActivity('وافق على طلب خادم', uid);
  loadPendingDeacons();
}

window.rejectDeacon = async (uid) => {
  if (!confirm('هتحذف الطلب ده؟')) return;
  await updateDoc(doc(db, 'users', uid), { status: 'rejected' });
  showToast('تم الرفض', 'error');
  logActivity('رفض طلب خادم', uid);
  loadPendingDeacons();
};

window.approveDeaconBtn = async (uid) => {
  await approveDeacon(uid);
};

export async function loadPendingDeacons() {
  const section = document.getElementById('pending-deacons-section');
  const isGradeManager = state.currentUserRole === 'admin' || state.currentUserIsLead || state.currentUserIsPhaseLead;
  if (!isGradeManager) { section.style.display = 'none'; return; }
  const snap = await getDocs(query(collection(db, 'users'), where('status','==','pending')));
  let list  = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => (u.section || 'boys') === SECTION);
  // الأدمن يشوف بس طلبات السنة الدراسية النشطة (activeGrade)، ومسؤول السنة/المرحلة يشوف طلبات الفصول المسموح لها
  const managedGrades = state.currentUserRole === 'admin' ? (state.activeGrade ? [state.activeGrade] : GRADES.slice()) : getUserManagedGrades();
  if (managedGrades.length) list = list.filter(u => managedGrades.includes(u.grade));
  state.pendingDeaconsCount = list.length;
  updateDeaconsTabLabel();
  const el    = document.getElementById('pending-list');
  const cnt   = document.getElementById('pending-count');
  if (!list.length) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  cnt.textContent = `${list.length} طلب جديد`;
  el.innerHTML = list.map(u => `
    <div style="background:var(--surface);border:1px solid rgba(243,156,18,0.3);border-radius:var(--radius-sm);padding:14px 16px;margin-bottom:8px;display:flex;align-items:center;gap:12px">
      <div style="width:40px;height:40px;border-radius:12px;background:rgba(243,156,18,0.15);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">🙋</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:15px;font-weight:700">${u.name||'بدون اسم'}</div>
        <div style="font-size:12px;color:var(--text-dim);margin-top:2px">${u.email||''}</div>
        ${u.grade ? `<div style="font-size:12px;color:var(--accent);margin-top:2px">📚 ${u.grade}</div>` : ''}
      </div>
      <button onclick="approveDeaconBtn('${u.id}')" style="background:rgba(46,204,113,0.15);border:1px solid rgba(46,204,113,0.3);border-radius:8px;color:var(--success);font-family:Cairo,sans-serif;font-size:12px;font-weight:700;padding:8px 12px;cursor:pointer">✓ قبول</button>
      <button onclick="rejectDeacon('${u.id}')" style="background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.25);border-radius:8px;color:var(--danger);font-family:Cairo,sans-serif;font-size:12px;font-weight:700;padding:8px 12px;cursor:pointer">✕ رفض</button>
    </div>`).join('');
}
