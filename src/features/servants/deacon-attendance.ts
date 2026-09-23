// @ts-nocheck
import { getDocs, collection, doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { state } from '@/core/state';
import { db } from '@/core/firebase';
import { todayKey } from '@/core/utils';
import { GRADES, inCurrentSection, sectionTag } from '@/core/section';
import { getUserManagedGrades } from '@/core/session';
import { nameMatchesSearch } from '@/features/import-export/import-attendance';
import { logActivity } from '@/core/presence';

// ===== DEACON ATTENDANCE (حضور الخدام أنفسهم) — نوعين: مدارس الأحد + اجتماع الخدام =====
const DEACON_ATT_TYPES = {
  sunday:  { label: '⛪ مدارس الأحد',   short: 'مدارس الأحد' },
  meeting: { label: '👥 اجتماع الخدام', short: 'اجتماع الخدام' }
};

export let DEACON_ATTENDANCE = { sunday: {}, meeting: {} };      // type -> { 'YYYY-MM-DD': { deaconName: docId } }

let todayDeaconAttendance = { sunday: {}, meeting: {} };  // type -> { deaconName: true } — انهارده بس

let currentDeaconAttType = 'sunday';   // 'sunday' | 'meeting'

let currentDeaconAttMode = 'present';  // 'present' | 'absent'

let selectedDeaconAttDate = null;

// السجلات القديمة اللي اتسجلت قبل ما نفصل النوعين بتتحسب "مدارس أحد"
const normAttType = t => (t === 'meeting' ? 'meeting' : 'sunday');

const attMap      = t => DEACON_ATTENDANCE[normAttType(t)];

const attTodayMap = t => todayDeaconAttendance[normAttType(t)];

// هل الخادم حاضر انهارده في نوع معيّن؟ (لو مش محدد النوع → أي نوع)
export function isDeaconPresentToday(name, type) {
  if (type) return !!attTodayMap(type)[name];
  return !!todayDeaconAttendance.sunday[name] || !!todayDeaconAttendance.meeting[name];
}

// إجمالي مرات حضور خادم (كل الأنواع أو نوع واحد)
export function deaconAttendanceCount(name, type) {
  const types = type ? [normAttType(type)] : ['sunday', 'meeting'];
  return types.reduce((sum, t) =>
    sum + Object.keys(DEACON_ATTENDANCE[t]).filter(d => DEACON_ATTENDANCE[t][d][name]).length, 0);
}

export async function loadDeaconAttendance() {
  try {
    const snap = await getDocs(collection(db, 'deaconAttendance'));
    DEACON_ATTENDANCE = { sunday: {}, meeting: {} };
    todayDeaconAttendance = { sunday: {}, meeting: {} };
    const today = todayKey();
    snap.docs.forEach(d => {
      const data = d.data();
      if (!data.date || !data.name) return;
      if (!inCurrentSection(data)) return; // حضور خدام القسم التاني مايظهرش
      const t = normAttType(data.type);
      if (!DEACON_ATTENDANCE[t][data.date]) DEACON_ATTENDANCE[t][data.date] = {};
      DEACON_ATTENDANCE[t][data.date][data.name] = d.id;
      if (data.date === today) todayDeaconAttendance[t][data.name] = true;
    });
  } catch(e) {
    console.error('loadDeaconAttendance error:', e.code || e.message || e);
    DEACON_ATTENDANCE = { sunday: {}, meeting: {} };
    todayDeaconAttendance = { sunday: {}, meeting: {} };
  }
  renderDeaconAttPicker();
  renderDeaconAttDatesList();
}

window.setDeaconAttType = (type, btn) => {
  currentDeaconAttType = normAttType(type);
  document.querySelectorAll('#sd-type-tabs .tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  selectedDeaconAttDate = null;
  const detail = document.getElementById('deacon-att-day-detail');
  if (detail) detail.style.display = 'none';
  renderDeaconAttPicker();
  renderDeaconAttDatesList();
};

export function getCurrentUserScopedDeaconRows() {
  const managedGrades = state.currentUserRole === 'admin' ? GRADES.slice() : getUserManagedGrades();
  const managedSet = new Set(managedGrades);
  const seen = new Set();
  return state.ALL_DEACONS_RAW.filter(row => {
    if (!row || !row.name) return false;
    if (seen.has(row.name)) return false;
    seen.add(row.name);
    if (state.currentUserRole === 'admin') return true;
    const grade = (row.grade || '').trim();
    return !!grade && managedSet.has(grade);
  });
}

// ليستة كل خدام السنة النشطة مع زرار تحضير/إلغاء لكل واحد
// أسماء كل الخدام في كل السنين الدراسية مع بعض (من غير تكرار) — مش بس سنة activeGrade
function allDeaconNames() {
  const rows = getCurrentUserScopedDeaconRows();
  const scoreMap = new Map();
  const managedGrades = state.currentUserRole === 'admin' ? new Set(GRADES) : new Set(getUserManagedGrades());
  rows.forEach(row => {
    const grade = (row.grade || '').trim();
    scoreMap.set(row.name, grade && managedGrades.has(grade) ? 0 : 1);
  });
  return rows
    .map(row => row.name)
    .sort((a, b) => {
      const aScore = scoreMap.get(a) ?? 1;
      const bScore = scoreMap.get(b) ?? 1;
      if (aScore !== bScore) return aScore - bScore;
      return a.localeCompare(b, 'ar');
    });
}

window.renderDeaconAttPicker = () => {
  const cont = document.getElementById('sd-att-picker');
  if (!cont) return;
  const type = currentDeaconAttType;
  const info = DEACON_ATT_TYPES[type];
  const todayMap = attTodayMap(type);
  const allNames = allDeaconNames();

  const typeLbl = document.getElementById('sd-att-type-label');
  if (typeLbl) typeLbl.textContent = info.label;
  const todayLbl = document.getElementById('sd-att-today-label');
  if (todayLbl) todayLbl.textContent = new Date().toLocaleDateString('ar-EG', { weekday:'long', day:'numeric', month:'long' });
  const cntEl = document.getElementById('sd-att-today-count');
  if (cntEl) cntEl.textContent = allNames.filter(n => todayMap[n]).length;

  const q = (document.getElementById('sd-att-search')?.value || '').trim();
  let list = allNames.slice().sort((a, b) => a.localeCompare(b, 'ar'));
  if (q) list = list.filter(n => nameMatchesSearch(n, q));

  if (!list.length) {
    cont.innerHTML = `<div style="color:var(--text-dim);font-size:13px;padding:10px 4px;text-align:center">مفيش خادم بالاسم ده</div>`;
    return;
  }
  cont.innerHTML = list.map(name => {
    const already = !!todayMap[name];
    const safe = name.replace(/'/g, "\\'");
    return `<div class="manual-result-item ${already ? 'already' : ''}" onclick="deaconToggleAttendance('${safe}')">
      <div style="flex:1"><div class="manual-result-name">${name}</div></div>
      <div class="manual-check-box ${already ? 'checked' : ''}">✓</div>
    </div>`;
  }).join('');
};

// اسم قديم لسه متستخدم في أماكن تانية
window.onDeaconAttSearch = () => renderDeaconAttPicker();

window.deaconToggleAttendance = async (name) => {
  const type = currentDeaconAttType;
  if (attTodayMap(type)[name]) {
    await doRemoveDeaconAttendance(name, todayKey(), type);
    showToast(`تم إلغاء تسجيل ${name}`, 'info');
  } else {
    await markDeaconAttendance(name, type);
  }
};

window.markDeaconAttendance = async (name, type) => {
  const t = normAttType(type || currentDeaconAttType);
  if (attTodayMap(t)[name]) return;
  const key = todayKey();
  // بنولّد الـ ID محلي فورًا (مش محتاج نت) عشان الواجهة تتحدث فورًا حتى لو أوفلاين
  const ref = doc(collection(db, 'deaconAttendance'));

  attTodayMap(t)[name] = true;
  if (!attMap(t)[key]) attMap(t)[key] = {};
  attMap(t)[key][name] = ref.id;
  showToast(`✅ ${name} — ${DEACON_ATT_TYPES[t].short}`, 'success');
  navigator.vibrate && navigator.vibrate([60,30,60]);
  // نفضّي خانة البحث بعد كل تسجيل عشان يكتب اسم الخادم اللي بعده على طول
  const searchEl = document.getElementById('sd-att-search');
  if (searchEl) searchEl.value = '';
  renderDeaconAttPicker();
  renderDeaconAttDatesList();
  if (selectedDeaconAttDate === key) renderDeaconAttDayDetail();
  if (searchEl) searchEl.focus();

  setDoc(ref, { name, date: key, type: t, section: sectionTag(), ts: serverTimestamp() })
    .catch(e => console.warn('markDeaconAttendance sync error (هيتزامن لما النت يرجع):', e));
  if (typeof logActivity === 'function') logActivity('سجّل حضور خادم', `${name} — ${DEACON_ATT_TYPES[t].short}`);
};

async function doRemoveDeaconAttendance(name, dateKey, type) {
  const t = normAttType(type || currentDeaconAttType);
  const map = attMap(t);
  const docId = map[dateKey] && map[dateKey][name];
  if (!docId) return;

  delete map[dateKey][name];
  if (!Object.keys(map[dateKey]).length) delete map[dateKey];
  if (dateKey === todayKey()) delete attTodayMap(t)[name];
  renderDeaconAttPicker();
  renderDeaconAttDatesList();
  if (selectedDeaconAttDate === dateKey) renderDeaconAttDayDetail();

  deleteDoc(doc(db, 'deaconAttendance', docId))
    .catch(e => console.warn('removeDeaconAttendance sync error:', e));
}

window.removeDeaconAttendance = async (name, dateKey) => {
  await doRemoveDeaconAttendance(name, dateKey, currentDeaconAttType);
  showToast(`تم إلغاء تسجيل ${name}`, 'info');
};

window.setDeaconAttMode = (mode, btn) => {
  currentDeaconAttMode = mode;
  document.querySelectorAll('#deacon-att-mode-tabs .tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (selectedDeaconAttDate) renderDeaconAttDayDetail();
};

window.toggleDeaconAttDatesList = () => {
  const wrap = document.getElementById('deacon-att-dates-wrap');
  const btn  = document.getElementById('sd-att-dates-btn');
  if (!wrap) return;
  const opening = wrap.style.display === 'none';
  wrap.style.display = opening ? 'block' : 'none';
  if (btn) btn.textContent = opening ? '📅 إخفاء أيام الحضور' : '📅 عرض أيام الحضور';
  if (opening) renderDeaconAttDatesList();
};

function dateKeyLabel(key) {
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

export function renderDeaconAttDatesList() {
  const cont = document.getElementById('deacon-att-dates-list');
  if (!cont) return;
  const map = attMap(currentDeaconAttType);
  const allNames = new Set(allDeaconNames());
  // كل الأيام اللي فيها حضور لأي خادم في أي سنة دراسية — مش بس خدام activeGrade
  const dates = Object.keys(map)
    .filter(key => Object.keys(map[key]).some(n => allNames.has(n)))
    .sort((a,b) => b.localeCompare(a));
  if (!dates.length) {
    cont.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div>لا يوجد سجلات ${DEACON_ATT_TYPES[currentDeaconAttType].short} بعد</div>`;
    selectedDeaconAttDate = null;
    const detail = document.getElementById('deacon-att-day-detail');
    if (detail) detail.style.display = 'none';
    return;
  }
  cont.innerHTML = dates.map(key => {
    const presentCount = Object.keys(map[key]).filter(n => allNames.has(n)).length;
    const active = selectedDeaconAttDate === key;
    return `<div class="manual-result-item${active ? ' already' : ''}" style="cursor:pointer" onclick="selectDeaconAttDate('${key}')">
      <div style="flex:1">
        <div class="manual-result-name">${dateKeyLabel(key)}</div>
        <div class="manual-result-grade">${presentCount} خادم حضروا</div>
      </div>
      <span style="color:var(--accent);font-size:13px;font-weight:700">${active ? '✓ محدد' : 'عرض ←'}</span>
    </div>`;
  }).join('');
}

window.selectDeaconAttDate = (key) => {
  selectedDeaconAttDate = key;
  renderDeaconAttDatesList();
  renderDeaconAttDayDetail();
};

function renderDeaconAttDayDetail() {
  const wrap = document.getElementById('deacon-att-day-detail');
  if (!wrap || !selectedDeaconAttDate) return;
  wrap.style.display = 'block';
  const presentSet = attMap(currentDeaconAttType)[selectedDeaconAttDate] || {};
  const allNames = allDeaconNames();
  let list;
  if (currentDeaconAttMode === 'present') {
    list = Object.keys(presentSet).filter(n => allNames.includes(n)).sort((a,b) => a.localeCompare(b,'ar'));
  } else {
    list = allNames.filter(n => !presentSet[n]).sort((a,b) => a.localeCompare(b,'ar'));
  }
  const title = currentDeaconAttMode === 'present' ? '✅ الخدام الحاضرين' : '📋 الخدام الغائبين';
  const emptyMsg = currentDeaconAttMode === 'present' ? 'لا يوجد حضور في هذا اليوم' : 'لا يوجد غياب في هذا اليوم';
  const dateKey = selectedDeaconAttDate;
  wrap.innerHTML = `
    <p class="section-title" style="margin:0 0 10px 0">${title} — ${DEACON_ATT_TYPES[currentDeaconAttType].short} — ${dateKeyLabel(dateKey)}</p>
    ${list.length ? list.map(name => {
        const safe = name.replace(/'/g, "\\'");
        return `<div class="manual-result-item">
        <div style="flex:1"><div class="manual-result-name">${name}</div></div>
        ${currentDeaconAttMode === 'present' ? `<button onclick="removeDeaconAttendance('${safe}','${dateKey}')" style="background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.25);border-radius:8px;color:var(--danger);font-size:12px;padding:4px 8px;cursor:pointer">🗑 إلغاء</button>` : ''}
      </div>`;
      }).join('') : `<div class="empty-state"><div class="empty-icon">${currentDeaconAttMode==='present'?'✅':'📋'}</div>${emptyMsg}</div>`}
  `;
}
