// @ts-nocheck
import { state } from '@/core/state';
import { saveStudentBadData } from '@/api/student-flags';
import { BAD_FIELDS, badKeysOf, badValueOf } from '@/core/bad-data';
import { logActivity } from '@/core/presence';
import { renderTodayList, updateStats } from '@/features/attendance/attendance';

// ===== بيانات خاطئة: علامة حمرا على المخدوم + أي خادم يصلّح الخانات الغلط بس من الحضور =====
// 1) from the student file, 🚩 picks the wrong fields; 2) from the red name in the attendance tab, only those fields open to be corrected.

const fieldOf = (key) => BAD_FIELDS.find((f) => f.key === key);
const labelsText = (keys) => keys.map((k) => fieldOf(k).label).join('، ');

function refreshAfterBadChange(id) {
  renderStudentsList();
  renderTodayList();
  updateStats();
  try { onManualSearch(); } catch (e) { /* the search box may be empty */ }
  const pm = document.getElementById('profile-modal');
  if (pm.style.display === 'block' && document.getElementById('prof-edit-id').value === id) {
    openProfile(id);
  }
}

// writes the corrections + the list of fields still wrong, and keeps the in-memory copy in step
async function persistBadData(id, patch, keys) {
  await saveStudentBadData(id, patch, keys);
  const s = state.allStudents.find((x) => x.id === id);
  if (s) { Object.assign(s, patch, { badFields: keys }); }
}

// ----- 1) choose the wrong fields (from the student file) -----
window.openBadFlag = () => {
  const s = state.allStudents.find((x) => x.id === document.getElementById('prof-edit-id').value);
  if (!s) { return; }
  const cur = new Set(badKeysOf(s));
  document.getElementById('bad-flag-id').value = s.id;
  document.getElementById('bad-flag-sub').textContent = s.name;
  document.getElementById('bad-flag-list').innerHTML = BAD_FIELDS.map((f) =>
    `<label class="bad-opt"><input type="checkbox" value="${f.key}"${cur.has(f.key) ? ' checked' : ''}> ${f.icon} ${f.label}</label>`
  ).join('');
  document.getElementById('bad-flag-modal').style.display = 'block';
};

window.closeBadFlag = () => { document.getElementById('bad-flag-modal').style.display = 'none'; };

async function applyBadFlag(keys) {
  const id = document.getElementById('bad-flag-id').value;
  const s = state.allStudents.find((x) => x.id === id);
  if (!s) { return; }
  try {
    await persistBadData(id, {}, keys);
    closeBadFlag();
    refreshAfterBadChange(id);
    showToast(keys.length ? '🚩 اتسجلت بيانات خاطئة: ' + labelsText(keys) : '✓ العلامة اتشالت', 'success');
    logActivity(keys.length ? 'بيانات خاطئة' : 'شيل علامة بيانات خاطئة', s.name + (keys.length ? ' — ' + labelsText(keys) : ''));
  } catch (e) {
    console.error(e);
    showToast('حصل خطأ أثناء الحفظ', 'error');
  }
}

window.saveBadFlag = () => applyBadFlag([...document.querySelectorAll('#bad-flag-list input:checked')].map((i) => i.value));
window.clearBadFlag = () => applyBadFlag([]);

// ----- 2) correct only the wrong fields (from the red name in the attendance tab) -----
let badFixId = null;

function renderBadFix() {
  const s = state.allStudents.find((x) => x.id === badFixId);
  if (!s) { return; }
  document.getElementById('bad-fix-title').textContent = s.name;
  document.getElementById('bad-fix-list').innerHTML = badKeysOf(s).map((k) => {
    const f = fieldOf(k);
    const id = 'bad-fix-' + k;
    const input = k === 'dob' ? `<input type="date" id="${id}" class="field-input">`
      : (k === 'father' || k === 'mother' || k === 'student') ? `<input type="tel" id="${id}" class="field-input" dir="ltr">`
      : `<input type="text" id="${id}" class="field-input">`;
    return `<label class="field-label">${f.icon} ${f.label}</label>${input}`;
  }).join('');
  badKeysOf(s).forEach((k) => { document.getElementById('bad-fix-' + k).value = badValueOf(s, k); });
  document.getElementById('bad-fix-modal').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

window.openBadFix = (id) => {
  const s = state.allStudents.find((x) => x.id === id);
  if (!s) { return; }
  if (!badKeysOf(s).length) { openProfile(id); return; }
  badFixId = id;
  renderBadFix();
};

window.closeBadFix = () => {
  document.getElementById('bad-fix-modal').style.display = 'none';
  if (document.getElementById('profile-modal').style.display !== 'block') { document.body.style.overflow = ''; }
  badFixId = null;
};

window.openBadFixProfile = () => {
  const id = badFixId;
  closeBadFix();
  if (id) { openProfile(id); }
};

window.clearBadFix = async () => {
  const id = badFixId;
  const s = state.allStudents.find((x) => x.id === id);
  if (!s) { return; }
  try {
    await persistBadData(id, {}, []);
    closeBadFix();
    refreshAfterBadChange(id);
    showToast('✓ العلامة اتشالت', 'success');
    logActivity('شيل علامة بيانات خاطئة', s.name);
  } catch (e) {
    console.error(e);
    showToast('حصل خطأ أثناء الحفظ', 'error');
  }
};

window.saveBadFix = async () => {
  const id = badFixId;
  const s = state.allStudents.find((x) => x.id === id);
  if (!s) { return; }
  const keys = badKeysOf(s);
  const patch = {};
  const fixed = [];
  for (const k of keys) {
    const f = fieldOf(k);
    let v = document.getElementById('bad-fix-' + k).value.trim();
    if (k === 'name' && !v) { showToast('اكتب اسم المخدوم', 'error'); return; }
    if (k === 'dob' && !v) { showToast('لازم تكتب تاريخ الميلاد', 'error'); return; }
    if (k === 'address' && !v) { showToast('لازم تكتب العنوان', 'error'); return; }
    if (k === 'father' || k === 'mother' || k === 'student') {
      v = v.replace(/[\s-]/g, '');
      if (v && !/^\+?\d{8,15}$/.test(v)) { showToast('رقم ' + f.label + ' مش صحيح', 'error'); return; }
    }
    if (v !== badValueOf(s, k)) { patch[f.prop] = v; fixed.push(k); }
  }
  if (!fixed.length) { showToast('مغيّرتش حاجة — لو البيانات سليمة دوس "✓ سليمة"', 'info'); return; }
  const remaining = keys.filter((k) => !fixed.includes(k));
  try {
    await persistBadData(id, patch, remaining);
    refreshAfterBadChange(id);
    logActivity('تصحيح بيانات خاطئة', (patch.name || s.name) + ' — ' + labelsText(fixed));
    if (remaining.length) {
      showToast('✓ اتصلّح — فاضل: ' + labelsText(remaining), 'success');
      renderBadFix();
    } else {
      closeBadFix();
      showToast('✓ اتصلّحت كل البيانات الخاطئة', 'success');
    }
  } catch (e) {
    console.error(e);
    showToast('حصل خطأ أثناء الحفظ', 'error');
  }
};
