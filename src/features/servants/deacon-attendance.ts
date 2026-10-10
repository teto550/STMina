// @ts-nocheck
import { getDocs, collection, doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { deaconIdOfName } from '@/core/servants-index';
import { state } from '@/core/state';
import { db } from '@/core/firebase';
import { todayKey } from '@/core/utils';
import { GRADES, inCurrentSection, sectionTag } from '@/core/section';
import { getUserManagedGrades } from '@/core/session';
import { nameMatchesSearch } from '@/features/import-export/import-attendance';
import { logActivity } from '@/core/presence';
import { getDocsTtl } from '@/core/firestore-helpers';
import { sessionDates, statusOn } from '@/features/servants/attendance-stats';

// ===== DEACON ATTENDANCE (حضور الخدام أنفسهم) — نوعين: مدارس الأحد + اجتماع الخدام =====
const DEACON_ATT_TYPES = {
  sunday:  { label: '⛪ مدارس الأحد',   short: 'مدارس الأحد' },
  meeting: { label: '👥 اجتماع الخدام', short: 'اجتماع الخدام' }
};

export let DEACON_ATTENDANCE = { sunday: {}, meeting: {} };      // type -> { 'YYYY-MM-DD': { deaconName: docId } }

// الاعتذارات: نفس كوليكشن deaconAttendance بس السجل فيه status: 'excuse' (السجلات القديمة من غير status = حضور)
export let DEACON_EXCUSES = { sunday: {}, meeting: {} };         // type -> { 'YYYY-MM-DD': { deaconName: docId } }

let todayDeaconAttendance = { sunday: {}, meeting: {} };  // type -> { deaconName: true } — انهارده بس

let currentDeaconAttType = 'sunday';   // 'sunday' | 'meeting'

let currentDeaconAttMode = 'present';  // 'present' | 'excuse' | 'absent'

let selectedDeaconAttDate = null;

// اليوم اللي بيتحضّر فيه من خانة التحضير: null = النهاردة (بيتحسب كل مرة، فلو التطبيق فضل مفتوح لبكرة يبقى بكرة)
let attDaySelected = null;
const attDay = () => attDaySelected || todayKey();

// السجلات القديمة اللي اتسجلت قبل ما نفصل النوعين بتتحسب "مدارس أحد"
const normAttType = t => (t === 'meeting' ? 'meeting' : 'sunday');

const attMap      = t => DEACON_ATTENDANCE[normAttType(t)];

const attTodayMap = t => todayDeaconAttendance[normAttType(t)];

const excMap     = t => DEACON_EXCUSES[normAttType(t)];

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

// آخر n أيام متسجل فيها حضور أو اعتذار لنوع معيّن، الأحدث أولاً (نفس تعريف "أيام الحضور" في القائمة) — بتغذّي فلتر آخر مرات حضور/غياب الخدام
export function recentDeaconSessions(type, n) {
  const t = normAttType(type);
  return sessionDates(DEACON_ATTENDANCE[t], DEACON_EXCUSES[t], new Set(allDeaconNames()), n);
}

// حالة خادم في يوم معيّن: 'present' | 'excuse' | 'absent' (غياب = مش حاضر ومش معتذر، زي تاب "غياب" في تفاصيل اليوم)
export function deaconStatusOn(name, type, dateKey) {
  const t = normAttType(type);
  return statusOn(DEACON_ATTENDANCE[t], DEACON_EXCUSES[t], name, dateKey);
}

export async function loadDeaconAttendance() {
  try {
    const snap = await getDocsTtl(collection(db, 'deaconAttendance'), 'deaconAttendance:' + sectionTag());
    DEACON_ATTENDANCE = { sunday: {}, meeting: {} };
    DEACON_EXCUSES = { sunday: {}, meeting: {} };
    todayDeaconAttendance = { sunday: {}, meeting: {} };
    const today = todayKey();
    snap.docs.forEach(d => {
      const data = d.data();
      if (!data.date || !data.name) return;
      if (!inCurrentSection(data)) return; // حضور خدام القسم التاني مايظهرش
      const t = normAttType(data.type);
      if (data.status === 'excuse') { // اعتذار مش حضور
        if (!DEACON_EXCUSES[t][data.date]) DEACON_EXCUSES[t][data.date] = {};
        DEACON_EXCUSES[t][data.date][data.name] = d.id;
        return;
      }
      if (!DEACON_ATTENDANCE[t][data.date]) DEACON_ATTENDANCE[t][data.date] = {};
      DEACON_ATTENDANCE[t][data.date][data.name] = d.id;
      if (data.date === today) todayDeaconAttendance[t][data.name] = true;
    });
  } catch(e) {
    console.error('loadDeaconAttendance error:', e.code || e.message || e);
    DEACON_ATTENDANCE = { sunday: {}, meeting: {} };
    DEACON_EXCUSES = { sunday: {}, meeting: {} };
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
  const dayKey = attDay();
  const todayMap = attMap(type)[dayKey] || {};
  const excuseMap = excMap(type)[dayKey] || {};
  const allNames = allDeaconNames();

  const typeLbl = document.getElementById('sd-att-type-label');
  if (typeLbl) typeLbl.textContent = info.label;
  const todayLbl = document.getElementById('sd-att-today-label');
  if (todayLbl) todayLbl.textContent = new Date(dayKey + 'T12:00:00').toLocaleDateString('ar-EG', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const dateEl = document.getElementById('sd-att-date');
  if (dateEl) { dateEl.max = todayKey(); if (dateEl.value !== dayKey) dateEl.value = dayKey; }
  const cntLbl = document.getElementById('sd-att-count-label');
  const excCount = allNames.filter(n => excuseMap[n]).length;
  if (cntLbl) cntLbl.textContent = (dayKey === todayKey() ? 'حاضر النهاردة' : 'حاضر في اليوم ده') + (excCount ? ` · ${excCount} اعتذار` : '');
  const cntEl = document.getElementById('sd-att-today-count');
  if (cntEl) cntEl.textContent = allNames.filter(n => todayMap[n]).length;

  const q = (document.getElementById('sd-att-search')?.value || '').trim();
  let list = allNames.slice().sort((a, b) => a.localeCompare(b, 'ar'));
  if (q) list = list.filter(n => nameMatchesSearch(n, q));

  if (!list.length) {
    cont.innerHTML = `<div style="color:var(--text-dim);font-size:13px;padding:10px 4px;text-align:center">مفيش خادم بالاسم ده</div>`;
    return;
  }
  const boxStyle = (on, color, rgb) =>
    `min-width:68px;height:34px;padding:0 8px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;cursor:pointer;` +
    `border:1px solid ${on ? color : 'var(--border)'};background:${on ? `rgba(${rgb},0.15)` : 'var(--surface2)'};color:${on ? color : 'var(--text-dim)'}`;
  cont.innerHTML = list.map(name => {
    const already = !!todayMap[name];
    const excused = !!excuseMap[name];
    const safe = name.replace(/'/g, "\\'");
    // الضغط على الصف أو مربع "حضور" = حضور، ومربع "اعتذار" = اعتذار (واحد بس منهم في اليوم)
    return `<div class="manual-result-item ${already ? 'already' : ''}" onclick="deaconToggleAttendance('${safe}')">
      <div style="flex:1"><div class="manual-result-name">${name}</div></div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <div style="${boxStyle(already, 'var(--success)', '46,204,113')}">${already ? '✓ ' : ''}حضور</div>
        <div style="${boxStyle(excused, 'var(--warning)', '243,156,18')}" onclick="event.stopPropagation();deaconToggleExcuse('${safe}')">${excused ? '✓ ' : ''}اعتذار</div>
      </div>
    </div>`;
  }).join('');
};

// اسم قديم لسه متستخدم في أماكن تانية
window.onDeaconAttSearch = () => renderDeaconAttPicker();

window.deaconToggleAttendance = async (name) => {
  const type = currentDeaconAttType;
  const key = attDay();
  if (attMap(type)[key] && attMap(type)[key][name]) {
    await doRemoveDeaconAttendance(name, key, type);
    showToast(`تم إلغاء تسجيل ${name}`, 'info');
  } else {
    await markDeaconAttendance(name, type, key);
  }
};

window.deaconToggleExcuse = async (name) => {
  const type = currentDeaconAttType;
  const key = attDay();
  if (excMap(type)[key] && excMap(type)[key][name]) {
    await doRemoveDeaconExcuse(name, key, type);
    showToast(`تم إلغاء اعتذار ${name}`, 'info');
  } else {
    await markDeaconExcuse(name, type, key);
  }
};

// اختيار يوم معيّن من التقويم للتحضير فيه (النهاردة هو الافتراضي)
window.setDeaconAttDay = (value) => {
  attDaySelected = value && value !== todayKey() ? value : null;
  renderDeaconAttPicker();
};
window.resetDeaconAttDay = () => {
  attDaySelected = null;
  renderDeaconAttPicker();
};
// كل مرة تتفتح خانة الخدام بنرجع للنهاردة
export function resetDeaconAttDay() { attDaySelected = null; }

window.markDeaconAttendance = async (name, type, dateKey) => {
  const t = normAttType(type || currentDeaconAttType);
  const key = dateKey || todayKey(); // من غير تاريخ = النهاردة (المساعد الصوتي وغيره)
  if (attMap(t)[key] && attMap(t)[key][name]) return;
  if (excMap(t)[key] && excMap(t)[key][name]) await doRemoveDeaconExcuse(name, key, t); // حضر بدل ما يعتذر
  const dayNote = key === todayKey() ? '' : ` (${dateKeyLabel(key)})`;
  // بنولّد الـ ID محلي فورًا (مش محتاج نت) عشان الواجهة تتحدث فورًا حتى لو أوفلاين
  const ref = doc(collection(db, 'deaconAttendance'));

  if (key === todayKey()) attTodayMap(t)[name] = true;
  if (!attMap(t)[key]) attMap(t)[key] = {};
  attMap(t)[key][name] = ref.id;
  showToast(`✅ ${name} — ${DEACON_ATT_TYPES[t].short}${dayNote}`, 'success');
  navigator.vibrate && navigator.vibrate([60,30,60]);
  // نفضّي خانة البحث بعد كل تسجيل عشان يكتب اسم الخادم اللي بعده على طول
  const searchEl = document.getElementById('sd-att-search');
  if (searchEl) searchEl.value = '';
  renderDeaconAttPicker();
  renderDeaconAttDatesList();
  if (selectedDeaconAttDate === key) renderDeaconAttDayDetail();
  if (searchEl) searchEl.focus();

  setDoc(ref, { name, deaconId: deaconIdOfName(name, sectionTag()), date: key, type: t, section: sectionTag(), ts: serverTimestamp() })
    .catch(e => console.warn('markDeaconAttendance sync error (هيتزامن لما النت يرجع):', e));
  if (typeof logActivity === 'function') logActivity('سجّل حضور خادم', `${name} — ${DEACON_ATT_TYPES[t].short}${dayNote}`);
};

window.markDeaconExcuse = async (name, type, dateKey) => {
  const t = normAttType(type || currentDeaconAttType);
  const key = dateKey || todayKey();
  if (excMap(t)[key] && excMap(t)[key][name]) return;
  // اعتذار بدل حضور: لو كان متحضّر في اليوم ده بنشيل الحضور (الاتنين مايجوش مع بعض)
  if (attMap(t)[key] && attMap(t)[key][name]) await doRemoveDeaconAttendance(name, key, t);
  const dayNote = key === todayKey() ? '' : ` (${dateKeyLabel(key)})`;
  const ref = doc(collection(db, 'deaconAttendance'));
  if (!excMap(t)[key]) excMap(t)[key] = {};
  excMap(t)[key][name] = ref.id;
  showToast(`📝 اعتذار ${name} — ${DEACON_ATT_TYPES[t].short}${dayNote}`, 'info');
  renderDeaconAttPicker();
  renderDeaconAttDatesList();
  if (selectedDeaconAttDate === key) renderDeaconAttDayDetail();
  setDoc(ref, { name, deaconId: deaconIdOfName(name, sectionTag()), date: key, type: t, status: 'excuse', section: sectionTag(), ts: serverTimestamp() })
    .catch(e => console.warn('markDeaconExcuse sync error (هيتزامن لما النت يرجع):', e));
  if (typeof logActivity === 'function') logActivity('سجّل اعتذار خادم', `${name} — ${DEACON_ATT_TYPES[t].short}${dayNote}`);
};

async function doRemoveDeaconExcuse(name, dateKey, type) {
  const t = normAttType(type || currentDeaconAttType);
  const map = excMap(t);
  const docId = map[dateKey] && map[dateKey][name];
  if (!docId) return;
  delete map[dateKey][name];
  if (!Object.keys(map[dateKey]).length) delete map[dateKey];
  renderDeaconAttPicker();
  renderDeaconAttDatesList();
  if (selectedDeaconAttDate === dateKey) renderDeaconAttDayDetail();
  deleteDoc(doc(db, 'deaconAttendance', docId))
    .catch(e => console.warn('removeDeaconExcuse sync error:', e));
}

window.removeDeaconExcuse = async (name, dateKey) => {
  await doRemoveDeaconExcuse(name, dateKey, currentDeaconAttType);
  showToast(`تم إلغاء اعتذار ${name}`, 'info');
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
  const eMap = excMap(currentDeaconAttType);
  const allNames = new Set(allDeaconNames());
  // كل الأيام اللي فيها حضور أو اعتذار لأي خادم في أي سنة دراسية — مش بس خدام activeGrade
  const keys = new Set([...Object.keys(map), ...Object.keys(eMap)]);
  const dates = [...keys]
    .filter(key => Object.keys(map[key] || {}).some(n => allNames.has(n)) || Object.keys(eMap[key] || {}).some(n => allNames.has(n)))
    .sort((a,b) => b.localeCompare(a));
  if (!dates.length) {
    cont.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div>لا يوجد سجلات ${DEACON_ATT_TYPES[currentDeaconAttType].short} بعد</div>`;
    selectedDeaconAttDate = null;
    const detail = document.getElementById('deacon-att-day-detail');
    if (detail) detail.style.display = 'none';
    return;
  }
  cont.innerHTML = dates.map(key => {
    const presentCount = Object.keys(map[key] || {}).filter(n => allNames.has(n)).length;
    const excuseCount = Object.keys(eMap[key] || {}).filter(n => allNames.has(n)).length;
    const active = selectedDeaconAttDate === key;
    return `<div class="manual-result-item${active ? ' already' : ''}" style="cursor:pointer" onclick="selectDeaconAttDate('${key}')">
      <div style="flex:1">
        <div class="manual-result-name">${dateKeyLabel(key)}</div>
        <div class="manual-result-grade">${presentCount} خادم حضروا${excuseCount ? ` · ${excuseCount} اعتذار` : ''}</div>
      </div>
      <span style="color:var(--accent);font-size:13px;font-weight:700">${active ? '✓ محدد' : 'عرض ←'}</span>
    </div>`;
  }).join('');
};

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
  const excuseSet = excMap(currentDeaconAttType)[selectedDeaconAttDate] || {};
  const allNames = allDeaconNames();
  const mode = currentDeaconAttMode;
  let list;
  if (mode === 'present') {
    list = Object.keys(presentSet).filter(n => allNames.includes(n)).sort((a,b) => a.localeCompare(b,'ar'));
  } else if (mode === 'excuse') {
    list = Object.keys(excuseSet).filter(n => allNames.includes(n)).sort((a,b) => a.localeCompare(b,'ar'));
  } else { // غياب = مش حاضر ومش معتذر
    list = allNames.filter(n => !presentSet[n] && !excuseSet[n]).sort((a,b) => a.localeCompare(b,'ar'));
  }
  const title = mode === 'present' ? '✅ الخدام الحاضرين' : mode === 'excuse' ? '📝 الخدام المعتذرين' : '📋 الخدام الغائبين';
  const emptyMsg = mode === 'present' ? 'لا يوجد حضور في هذا اليوم' : mode === 'excuse' ? 'لا يوجد اعتذار في هذا اليوم' : 'لا يوجد غياب في هذا اليوم';
  const emptyIcon = mode === 'present' ? '✅' : mode === 'excuse' ? '📝' : '📋';
  const dateKey = selectedDeaconAttDate;
  const delBtn = (fn, safe) => `<button onclick="${fn}('${safe}','${dateKey}')" style="background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.25);border-radius:8px;color:var(--danger);font-size:12px;padding:4px 8px;cursor:pointer">🗑 إلغاء</button>`;
  wrap.innerHTML = `
    <p class="section-title" style="margin:0 0 10px 0">${title} — ${DEACON_ATT_TYPES[currentDeaconAttType].short} — ${dateKeyLabel(dateKey)}</p>
    ${list.length ? list.map(name => {
        const safe = name.replace(/'/g, "\\'");
        return `<div class="manual-result-item">
        <div style="flex:1"><div class="manual-result-name">${name}</div></div>
        ${mode === 'present' ? delBtn('removeDeaconAttendance', safe) : mode === 'excuse' ? delBtn('removeDeaconExcuse', safe) : ''}
      </div>`;
      }).join('') : `<div class="empty-state"><div class="empty-icon">${emptyIcon}</div>${emptyMsg}</div>`}
  `;
}
