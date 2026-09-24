// @ts-nocheck
import { collection, query, where } from 'firebase/firestore';
import { state } from '@/core/state';
import { getDocsFast, getDocsTtl } from '@/core/firestore-helpers';
import { db } from '@/core/firebase';
import { SECTION } from '@/core/section';
import { getPhaseGradesForGrade, normalizePhaseGrades } from '@/core/session';

// ===== DEACONS TAB =====
export let DEACONS = [];           // array of names — بس خدام السنة الدراسية النشطة (activeGrade)

export let DEACON_DOC_IDS = {};    // { name: firestoreDocId } for deletion — للسنة النشطة بس

export let DEACON_ADMIN_MAP = {};  // { name: { uid, role, email, grade, isLead } } — approved accounts only

// Load ALL deacons (كل السنين) from Firestore — single source of truth for everyone
export async function loadDeaconsList() {
  try {
    const snap = await getDocsTtl(collection(db, 'deacons'), 'deacons:' + SECTION);
    state.ALL_DEACONS_RAW = snap.docs
      .map(d => ({ id: d.id, name: d.data().name, grade: d.data().grade || '', section: d.data().section || 'boys' }))
      .filter(x => x.name && x.section === SECTION);
  } catch(e) { console.error('loadDeaconsList error:', e.code || e.message || e); state.ALL_DEACONS_RAW = []; }
  applyActiveGradeDeacons();
  populateRegDeaconSelect();
}

// يحدد DEACONS/DEACON_DOC_IDS بناءً على السنة الدراسية النشطة (activeGrade) والقسم النشط (بنين/بنات) بس
export function applyActiveGradeDeacons() {
  DEACONS = [];
  DEACON_DOC_IDS = {};
  state.ALL_DEACONS_RAW
    .filter(x => (!state.activeGrade || x.grade === state.activeGrade) && x.section === SECTION)
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
    .forEach(x => { DEACONS.push(x.name); DEACON_DOC_IDS[x.name] = x.id; });
  if (document.getElementById('tab-deacons')?.style.display !== 'none') buildDeaconChips(); // only when that screen is open (it reads the accounts)
  refreshDeaconDropdowns();
}

// بيجيب كل الحسابات المعتمدة (users) عشان نعرف مين أدمن/مسؤول ومين لأ، ونربطهم بالاسم
export async function loadDeaconUsersMap() {
  try {
    const snap = await getDocsTtl(query(collection(db, 'users'), where('status', '==', 'approved')), 'users-approved:' + SECTION);
    const map = {};
    snap.docs.forEach(d => {
      const u = d.data();
      if ((u.section || 'boys') !== SECTION) return;
      const phaseGrades = normalizePhaseGrades(u.phaseGrades || (u.isPhaseLead && u.grade ? getPhaseGradesForGrade(u.grade) : []));
      if (u.name) map[u.name] = {
        uid: d.id, role: u.role || 'deacon', email: u.email || '', grade: u.grade || '', isLead: !!u.isLead,
        isPhaseLead: !!u.isPhaseLead || phaseGrades.length > 0, phaseGrades,
        phones: (u.phones && u.phones.length) ? u.phones : (u.phone ? [u.phone] : []), phone: u.phone || '',
        address: u.address || '', dob: u.dob || '',
        graduated: !!u.graduated, college: u.college || '', university: u.university || ''
      };
    });
    DEACON_ADMIN_MAP = map;
  } catch(e) { console.error('loadDeaconUsersMap error:', e.code || e.message || e); }
}

// Fill the "register as new deacon" name dropdown — بيتفلتر حسب السنة المختارة في فورم التسجيل
window.populateRegDeaconSelect = function() {
  const sel = document.getElementById('reg-name');
  const gradeSel = document.getElementById('reg-grade');
  if (!sel) return;
  const grade = gradeSel ? gradeSel.value : '';
  const cur = sel.value;
  if (!grade) {
    sel.innerHTML = `<option value="">اختر السنة الدراسية الأول</option>`;
    return;
  }
  const names = state.ALL_DEACONS_RAW
    .filter(x => x.grade === grade)
    .map(x => x.name)
    .sort((a, b) => a.localeCompare(b, 'ar'));
  if (!names.length) {
    sel.innerHTML = `<option value="">لا يوجد خدام مسجلين في السنة دي — كلم الأدمن</option>`;
    return;
  }
  sel.innerHTML = `<option value="">اختر اسمك من القائمة</option>` +
    names.map(d => `<option${cur===d?' selected':''}>${d}</option>`).join('');
};

function refreshDeaconDropdowns() {
  // Update new-deacon select in add student form
  const newDn = document.getElementById('new-deacon');
  if (newDn) {
    const cur = newDn.value;
    newDn.innerHTML = `<option value="">اختر خادم الافتقاد</option>` +
      DEACONS.map(d => `<option${cur===d?' selected':''}>${d}</option>`).join('');
  }
  // Update edit-deacon select
  const editDn = document.getElementById('edit-deacon');
  if (editDn) {
    const cur2 = editDn.value;
    editDn.innerHTML = `<option value="">اختر خادم الافتقاد</option>` +
      DEACONS.map(d => `<option${cur2===d?' selected':''}>${d}</option>`).join('');
  }
}
