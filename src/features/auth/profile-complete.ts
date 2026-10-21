// @ts-nocheck
import { saveBasicProfile } from '@/api/account';
import { currentUser } from '@/api/auth';
import { errorCode, profileSaveErrorMessage } from '@/api/errors';
import { state } from '@/core/state';
import { populateUniversitySelect } from '@/features/servants/servants';
import { getPhaseGradesForGrade, normalizePhaseGrades } from '@/core/session';
import { enterApp } from '@/features/shell/app-shell';

// (the check "is the basic data missing?" is `isProfileIncomplete` in src/api/account.ts)

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
  const input = {
    phones, address, dob,
    graduated: gradStatus === 'graduated',
    college: gradStatus === 'student' ? college : '',
    university: gradStatus === 'student' ? university : ''
  };
  try {
    // only ever updates the person's own account document (a login without one is told so, see profileSaveErrorMessage)
    const snapData = await saveBasicProfile(uid, input);
    const user = currentUser();
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
    // show WHY (the code), so a report from a phone says what happened: e.g. permission-denied = the Firestore rules refused the save
    console.error('saveCompleteProfile error:', e);
    const code = errorCode(e);
    err.textContent = profileSaveErrorMessage(e) + (code ? ` (${code})` : '');
    err.style.display = 'block';
    btn.disabled = false; btn.textContent = '✅ حفظ ومتابعة';
  }
};
