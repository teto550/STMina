// @ts-nocheck
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { state } from '@/core/state';
import { auth } from '@/core/firebase';
import { logActivity } from '@/core/presence';
import { refreshAllData } from '@/core/data';

// The sign-in is a React screen (src/react/screens/auth/): the login and "new servant" forms, the account checks and the decision to
// let the person in. This file keeps the two things the old app still needs: signing out from its menu, and forgetting the person's
// data when they are signed out.

window.doLogout = async () => {
  if (state.partNotifUnsub) { state.partNotifUnsub(); state.partNotifUnsub = null; }
  await logActivity('خرج من التطبيق');
  await signOut(auth);
};

onAuthStateChanged(auth, (user) => {
  if (user) return;
  state.currentUserRole = null;
  state.access = null;
  state.accessSource = null;
  state.currentUserGrade = null;
  state.currentUserPhaseGrades = [];
  state.currentUserIsLead = false;
  state.currentUserIsPhaseLead = false;
  state.activeGrade = null;
  window.__loginLogged = false;
  refreshAllData(); // forget the short-lived read cache so the next person on this device starts clean
  if (state.todayAttendanceUnsub) { state.todayAttendanceUnsub(); state.todayAttendanceUnsub = null; }
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('complete-profile-screen').style.display = 'none';
});

// Mounted at start-up (src/main.ts), behind the plain-HTML splash screen.
export function mountAuthScreen() {
  window.openReactScreen('auth', document.getElementById('auth-screen')).catch((e) => {
    console.error('could not load the login screen:', e);
    document.getElementById('splash-screen')?.remove();
    document.getElementById('auth-screen').innerHTML = '<div style="text-align:center;padding:24px;line-height:2">تعذّر تحميل شاشة الدخول.<br><button onclick="location.reload()" class="btn-primary" style="max-width:220px;margin-top:12px">إعادة المحاولة</button></div>';
  });
}
