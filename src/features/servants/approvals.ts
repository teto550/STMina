// @ts-nocheck
import { isDeaconOf } from '@/core/servants-index';
import { fetchJoinRequests, approveJoinRequest } from '@/api/join-requests';
import { state } from '@/core/state';
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
      .filter(s => isDeaconOf(s, state.currentUserName) && !isVisitedThisMonth(s)).length;
    badge.innerHTML = `<span style="background:rgba(231,76,60,0.85);color:#fff;font-size:10px;font-weight:700;border-radius:10px;padding:1px 6px;margin-inline-start:5px">${notVisitedCount}</span>`;
  }
};

// ===== JOIN REQUESTS =====
// The list, the details and approve / reject are a React popup (src/react/screens/join-requests); this keeps the counters
// of the old screens in step with it.

// the classes the reader decides on: the servants screen covers every class the reader manages; elsewhere the admin sees the active class
function requestGrades() {
  const onlyActive = state.currentUserRole === 'admin' && state.activeGrade && !state.servantsDirectoryOpen;
  const grades = state.currentUserRole === 'admin' ? (onlyActive ? [state.activeGrade] : GRADES.slice()) : getUserManagedGrades();
  return grades.length ? grades : [];
}

function setPendingCount(count) {
  state.pendingDeaconsCount = count;
  updateDeaconsTabLabel();
  if (typeof window.updateServantsDashStats === 'function') window.updateServantsDashStats();
}

// approval from the link in the admin email (?approve=uid)
export async function approveDeacon(uid) {
  await approveJoinRequest(uid, state.currentUserRole === 'admin');
  showToast('✅ تم قبول الخادم', 'success');
  loadPendingDeacons();
}

export async function loadPendingDeacons() {
  const isGradeManager = state.currentUserRole === 'admin' || state.currentUserIsLead || state.currentUserIsPhaseLead;
  if (!isGradeManager) return;
  const list = await fetchJoinRequests({ section: SECTION, grades: requestGrades() });
  setPendingCount(list.length);
}

window.openJoinRequests = () => {
  const isGradeManager = state.currentUserRole === 'admin' || state.currentUserIsLead || state.currentUserIsPhaseLead;
  if (!isGradeManager) return;
  window.openReactScreen('join-requests', undefined, {
    section: SECTION,
    grades: requestGrades(),
    isAdmin: state.currentUserRole === 'admin',
    onCount: setPendingCount,
  });
};
