// @ts-nocheck
import { setDoc, doc } from 'firebase/firestore';
import { state } from '@/core/state';
import { populateUniversitySelect } from '@/features/servants/servants';
import { auth, db } from '@/core/firebase';
import { getDocFast } from '@/core/firestore-helpers';
import { getPhaseGradesForGrade, normalizePhaseGrades } from '@/core/session';
import { enterApp } from '@/features/shell/app-shell';

// ===== بيانات الخادم الأساسية ناقصة؟ (بيتاخد منه مرة واحدة بس أول ما يدخل) =====
export function isProfileIncomplete(data) {
  if (!data) return true;
  const hasPhone = (data.phones && data.phones.length) || data.phone;
  if (!hasPhone || !data.dob || !data.address) return true;
  if (typeof data.graduated !== 'boolean') return true;
  if (data.graduated === false && (!data.college || !data.university)) return true;
  return false;
}

let COMPLETE_PROFILE_UID = null;

export function openCompleteProfileScreen(user, snapData) {
  COMPLETE_PROFILE_UID = user.uid;
  renderPhoneRows('cp-phones', (snapData?.phones && snapData.phones.length) ? snapData.phones : (snapData?.phone ? [snapData.phone] : ['']));
  document.getElementById('cp-address').value = snapData?.address || '';
  document.getElementById('cp-dob').value = snapData?.dob || '';
  document.getElementById('cp-grad-status').value = (snapData && snapData.graduated) ? 'graduated' : 'student';
  populateUniversitySelect('cp-university');
  document.getElementById('cp-college').value = snapData?.college || '';
  document.getElementById('cp-university').value = snapData?.university || '';
  toggleCpGradFields();
  document.getElementById('cp-error').style.display = 'none';
  document.getElementById('complete-profile-screen').style.display = 'flex';
}

window.toggleCpGradFields = function() {
  const status = document.getElementById('cp-grad-status').value;
  const wrap = document.getElementById('cp-grad-fields-wrap');
  if (wrap) wrap.style.display = status === 'student' ? 'block' : 'none';
};

window.saveCompleteProfile = async function() {
  const phones     = getPhoneValues('cp-phones');
  const address    = document.getElementById('cp-address').value.trim();
  const dob        = document.getElementById('cp-dob').value;
  const gradStatus = document.getElementById('cp-grad-status').value;
  const college    = document.getElementById('cp-college').value.trim();
  const university = document.getElementById('cp-university').value;
  const err = document.getElementById('cp-error');
  const btn = document.getElementById('cp-save-btn');
  err.style.display = 'none';
  if (!phones.length) { err.textContent = 'اكتب رقم التليفون'; err.style.display = 'block'; return; }
  if (!address) { err.textContent = 'اكتب العنوان'; err.style.display = 'block'; return; }
  if (!dob)     { err.textContent = 'اختار تاريخ الميلاد'; err.style.display = 'block'; return; }
  if (gradStatus === 'student' && (!college || !university)) { err.textContent = 'اكتب الكلية واختار الجامعة'; err.style.display = 'block'; return; }
  const uid = COMPLETE_PROFILE_UID;
  if (!uid) { err.textContent = 'حدث خطأ، حاول تسجل دخول تاني'; err.style.display = 'block'; return; }
  btn.disabled = true; btn.textContent = 'جاري الحفظ…';
  const data = {
    phones, phone: phones[0], address, dob,
    graduated: gradStatus === 'graduated',
    college: gradStatus === 'student' ? college : '',
    university: gradStatus === 'student' ? university : ''
  };
  try {
    await setDoc(doc(db, 'users', uid), data, { merge: true });
    const user = auth.currentUser;
    const snap = await getDocFast(doc(db, 'users', uid));
    const snapData = (snap && snap.exists && snap.exists()) ? snap.data() : data;
    state.currentUserRole   = snapData.role || 'deacon';
    state.currentUserName   = snapData.name || (user ? user.email : '');
    state.currentUserEmail  = user ? user.email : state.currentUserEmail;
    state.currentUserGrade  = snapData.grade || null;
    state.currentUserIsLead = !!snapData.isLead;
    state.currentUserIsPhaseLead = !!snapData.isPhaseLead || normalizePhaseGrades(snapData.phaseGrades).length > 0;
    state.currentUserPhaseGrades = normalizePhaseGrades(snapData.phaseGrades || (snapData.isPhaseLead && snapData.grade ? getPhaseGradesForGrade(snapData.grade) : []));
    btn.disabled = false; btn.textContent = '✅ حفظ ومتابعة';
    await enterApp(user, snapData);
  } catch(e) {
    err.textContent = 'حدث خطأ، حاول تاني';
    err.style.display = 'block';
    btn.disabled = false; btn.textContent = '✅ حفظ ومتابعة';
  }
};
