// @ts-nocheck
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { state } from '@/core/state';
import { buildActiveGradeBar, showMainAppTabs, showServantsDirectorySection } from '@/features/shell/app-shell';
import { ensureDeacons, ensureDeaconUsers, ensureDeaconAttendance } from '@/core/data';
import { DEACONS, DEACON_ADMIN_MAP, applyActiveGradeDeacons, loadDeaconUsersMap, loadDeaconsList } from '@/features/servants/deacons';
import { deaconAttendanceCount, getCurrentUserScopedDeaconRows, loadDeaconAttendance, renderDeaconAttDatesList } from '@/features/servants/deacon-attendance';
import { formatAssignedGradesLabel } from '@/core/session';
import { auth, db } from '@/core/firebase';
import { getDocFast } from '@/core/firestore-helpers';
import { sectionTag, genderOfSection } from '@/core/section';
import { logActivity } from '@/core/presence';
import { EGYPT_UNIVERSITIES } from '@/core/universities';

// ===== قائمة الجامعات المصرية (لفورم التسجيل وتعديل بيانات الخادم) =====


export function populateUniversitySelect(selectId) {
  const sel = document.getElementById(selectId || 'reg-university');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">اختر الجامعة</option>' +
    EGYPT_UNIVERSITIES.map(u => `<option${cur === u ? ' selected' : ''}>${u}</option>`).join('');
}

window.toggleRegGradFields = function() {
  const status = document.getElementById('reg-grad-status').value;
  const wrap = document.getElementById('reg-grad-fields-wrap');
  if (wrap) wrap.style.display = status === 'student' ? 'block' : 'none';
};

// ===== خانة الخدام: تابين — الحضور + ملفات الخدام (من كل السنين الدراسية) =====
let currentServantsTab = 'att'; // 'att' | 'list'

window.openServantsDirectory = async () => {
  if (state.currentUserRole !== 'admin') { showToast('دليل الخدام للأدمن بس', 'error'); return; }
  state.servantsDirectoryOpen = true;
  showServantsDirectorySection();
  buildActiveGradeBar();
  const searchEl = document.getElementById('servants-directory-search');
  if (searchEl) searchEl.value = '';
  const attSearchEl = document.getElementById('sd-att-search');
  if (attSearchEl) attSearchEl.value = '';
  const listEl = document.getElementById('servants-directory-list');
  listEl.innerHTML = '<div class="loading"><div class="spinner"></div>جاري التحميل…</div>';
  try {
    // the servants list (all classes), their accounts and their attendance: nothing is loaded at start-up any more,
    // so this screen asks for what it shows (each one is cached for a few minutes)
    await Promise.all([
      ensureDeacons(),          // كل الخدام في كل الفصول
      ensureDeaconUsers(),      // بيانات كل الخدام اللي عندهم حساب معتمد (من كل السنين)
      ensureDeaconAttendance()  // سجل حضور الخدام بنوعيه
    ]);
  } catch(e) {
    console.error('openServantsDirectory error:', e.code || e.message || e);
  }
  const sub = document.getElementById('sd-subtitle');
  if (sub) sub.textContent = `${state.activeGrade || 'كل السنوات'} · ${DEACONS.length} خادم`;
  renderDeaconAttPicker();
  renderDeaconAttDatesList();
  renderServantsDirectory();
};

window.closeServantsDirectory = () => {
  state.servantsDirectoryOpen = false;
  showMainAppTabs();
  buildActiveGradeBar();
};

window.setServantsTab = (tab, btn) => {
  currentServantsTab = tab;
  document.querySelectorAll('#sd-main-tabs .tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('sd-tab-att').style.display  = tab === 'att'  ? 'block' : 'none';
  document.getElementById('sd-tab-list').style.display = tab === 'list' ? 'block' : 'none';
  if (tab === 'att') renderDeaconAttPicker();
  else renderServantsDirectory();
};

// تاب "الخدام": ملف كل خادم وجنب اسمه عدد مرات حضوره
window.renderServantsDirectory = () => {
  const searchEl = document.getElementById('servants-directory-search');
  if (!searchEl) return;
  const term = (searchEl.value || '').trim();
  // أسماء فريدة من الخدام المسموح لهم في النظام الحالي فقط — مسؤول المرحلة يشوف فصله فقط، والأدمن يشوف الكل
  const seen = new Set();
  let all = getCurrentUserScopedDeaconRows().sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  if (term) {
    const norm = s => (s || '').replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase();
    all = all.filter(x => norm(x.name).includes(norm(term)));
  }

  document.getElementById('servants-directory-count').textContent = `${all.length} خادم`;
  const listEl = document.getElementById('servants-directory-list');
  if (!all.length) {
    listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">🙏</div>مفيش خدام مطابقين</div>';
    return;
  }
  listEl.innerHTML = all.map(x => {
    const u = DEACON_ADMIN_MAP[x.name];
    const safeName = x.name.replace(/'/g, "\\'");
    // عدد مرات الحضور لكل الخادم ده، في كل السنين الدراسية مش سنة معينة بس (ALL_DEACONS_RAW ومصدر الحضور شاملين كل السنين أصلاً)
    const sundayCount  = deaconAttendanceCount(x.name, 'sunday');
    const meetingCount = deaconAttendanceCount(x.name, 'meeting');
    return `
      <div class="deacon-row" onclick="openDeaconProfile('${safeName}')" style="display:flex;align-items:center;gap:12px;cursor:pointer">
        <div class="student-avatar" style="flex-shrink:0">${x.name.trim().charAt(0)}</div>
        <div style="flex:1;min-width:0">
          <div class="deacon-row-name">${x.name}</div>
          <div style="font-size:12px;color:var(--text-dim);margin-top:2px">${x.grade || '—'}${u ? '' : ' · لسه ماسجلش بياناته'}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <div style="text-align:center;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:6px 10px">
            <div style="font-size:17px;font-weight:900;color:${sundayCount ? 'var(--success)' : 'var(--text-dim)'}">${sundayCount}</div>
            <div style="font-size:9px;color:var(--text-dim)">⛪ مدارس أحد</div>
          </div>
          <div style="text-align:center;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:6px 10px">
            <div style="font-size:17px;font-weight:900;color:${meetingCount ? 'var(--success)' : 'var(--text-dim)'}">${meetingCount}</div>
            <div style="font-size:9px;color:var(--text-dim)">👥 اجتماع خدام</div>
          </div>
        </div>
      </div>`;
  }).join('');
};

function formatDobDisplay(dob) {
  try {
    const d = new Date(dob + 'T00:00:00');
    return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch(e) { return dob; }
}

window.openDeaconProfile = (name) => {
  const raw = state.ALL_DEACONS_RAW.find(x => x.name === name);
  const u = DEACON_ADMIN_MAP[name];
  document.getElementById('dprof-name').textContent = name;
  document.getElementById('dprof-avatar').textContent = name.trim().charAt(0);
  document.getElementById('dprof-grade').textContent = (raw && raw.grade) ? raw.grade : '';

  const canEdit = state.currentUserRole === 'admin' || state.currentUserIsLead || state.currentUserName === name;
  const editBtn = document.getElementById('dprof-edit-btn');
  const safeName = name.replace(/'/g, "\\'");
  // a servant who has not registered yet can still be renamed (by an admin)
  editBtn.style.display = ((canEdit && u) || (state.currentUserRole === 'admin' && raw)) ? 'inline-block' : 'none';
  editBtn.setAttribute('onclick', `openEditDeaconProfile('${safeName}')`);

  const rows = [];
  rows.push({ icon: '⛪', key: 'حضور مدارس الأحد', val: `${deaconAttendanceCount(name, 'sunday')} مرة` });
  rows.push({ icon: '👥', key: 'حضور اجتماع الخدام', val: `${deaconAttendanceCount(name, 'meeting')} مرة` });
  if (!u) {
    rows.push({ icon: '⏳', key: 'الحالة', val: 'لسه ماسجلش بياناته في التطبيق' });
  } else {
    if (u.isPhaseLead && u.phaseGrades && u.phaseGrades.length) {
      rows.push({ icon: '🟣', key: 'الفصول المسموح بها', val: formatAssignedGradesLabel(u.phaseGrades) });
    }
    const phones = (u.phones && u.phones.length) ? u.phones : (u.phone ? [u.phone] : []);
    phones.forEach((p, i) => rows.push({ icon: '📞', key: phones.length > 1 ? `رقم التليفون ${i + 1}` : 'رقم التليفون', val: p, isPhone: true }));
    if (u.email)   rows.push({ icon: '📧', key: 'البريد الإلكتروني', val: u.email, isEmail: true });
    if (u.address) rows.push({ icon: '🏠', key: 'العنوان', val: u.address });
    if (u.dob)     rows.push({ icon: '🎂', key: 'تاريخ الميلاد', val: formatDobDisplay(u.dob) });
    rows.push({ icon: '🎓', key: 'الحالة الدراسية', val: u.graduated ? 'متخرج' : 'لسه بيدرس' });
    if (!u.graduated) {
      if (u.college)    rows.push({ icon: '🏫', key: 'الكلية', val: u.college });
      if (u.university) rows.push({ icon: '🏛', key: 'الجامعة', val: u.university });
    }
  }

  document.getElementById('dprof-details').innerHTML = rows.map(f => `
    <div class="prof-row">
      <div class="prof-icon">${f.icon}</div>
      <div style="flex:1">
        <div class="prof-key">${f.key}</div>
        ${f.isPhone ? `<a href="tel:${f.val}" class="prof-val phone-link">${f.val}</a>`
          : f.isEmail ? `<a href="mailto:${f.val}" class="prof-val phone-link">${f.val}</a>`
          : `<div class="prof-val">${f.val}</div>`}
      </div>
    </div>`).join('');

  document.getElementById('deacon-profile-modal').style.display = 'block';
};

window.closeDeaconProfile = () => {
  document.getElementById('deacon-profile-modal').style.display = 'none';
};

// بيفتح ملف الخادم اللي مسجل دخول بيه دلوقتي (زرار 👤 جنب الخروج) — بيجيب بياناته مباشرة لو لسه مش محمّلة
window.openMyProfile = async () => {
  const name = state.currentUserName;
  if (!name) return;
  if (!state.ALL_DEACONS_RAW.length) await loadDeaconsList();
  if (!DEACON_ADMIN_MAP[name] && auth.currentUser) {
    try {
      const snap = await getDocFast(doc(db, 'users', auth.currentUser.uid));
      const u = (snap && snap.exists && snap.exists()) ? snap.data() : null;
      if (u) {
        DEACON_ADMIN_MAP[name] = {
          uid: auth.currentUser.uid, role: u.role || 'deacon', email: u.email || '', grade: u.grade || '', isLead: !!u.isLead,
          phones: (u.phones && u.phones.length) ? u.phones : (u.phone ? [u.phone] : []), phone: u.phone || '',
          address: u.address || '', dob: u.dob || '',
          graduated: !!u.graduated, college: u.college || '', university: u.university || ''
        };
      }
    } catch(e) { console.error('openMyProfile error:', e.code || e.message || e); }
  }
  await loadDeaconAttendance();
  openDeaconProfile(name);
};

// "✏️ تعديل بيانات الخادم" is a React screen (src/react/screens/EditServant.tsx); this only prepares its data and applies the result
window.openEditDeaconProfile = (name) => {
  const nm = name || document.getElementById('dprof-name').textContent;
  const u = DEACON_ADMIN_MAP[nm];
  const raw = state.ALL_DEACONS_RAW.find(x => x.name === nm);
  if (!u && !(state.currentUserRole === 'admin' && raw)) { showToast('الخادم ده لسه ماسجلش حساب، مينفعش نعدل بياناته', 'error'); return; }
  const p = u || {};
  window.openReactScreen('edit-servant', undefined, {
    servant: {
      name: nm, uid: u ? u.uid : null, personId: raw ? raw.id : null,
      phones: (p.phones && p.phones.length) ? p.phones : (p.phone ? [p.phone] : []),
      address: p.address || '', dob: p.dob || '', graduated: !!p.graduated, college: p.college || '', university: p.university || ''
    },
    canRename: state.currentUserRole === 'admin',
    onSaved: ({ name: newName, data, renamed }) => {
      if (DEACON_ADMIN_MAP[nm]) Object.assign(DEACON_ADMIN_MAP[nm], data);
      if (renamed) {
        const entry = state.ALL_DEACONS_RAW.find(x => x.name === nm);
        if (entry) entry.name = newName;
        if (DEACON_ADMIN_MAP[nm]) { DEACON_ADMIN_MAP[newName] = DEACON_ADMIN_MAP[nm]; delete DEACON_ADMIN_MAP[nm]; }
        (state.allStudents || []).forEach(s => { if (s.deacon === nm) s.deacon = newName; });
        if (state.currentDeacon === nm) state.currentDeacon = newName;
        if (state.currentUserName === nm) state.currentUserName = newName;
        applyActiveGradeDeacons();
        logActivity('عدّل اسم خادم', `${nm} → ${newName}`);
      }
      openDeaconProfile(newName);
      if (window.renderServantsDirectory && state.servantsDirectoryOpen) window.renderServantsDirectory();
      showToast(renamed ? `تم حفظ البيانات والاسم ✓ (اتحدّث ${renamed.counts.students} مخدوم)${renamed.partsFailed ? ' — توزيع الفقرات لسه بالاسم القديم' : ''}` : 'تم حفظ بيانات الخادم ✓', 'success');
    }
  });
};

window.openAddDeaconModal = () => {
  document.getElementById('new-deacon-name').value = '';
  document.getElementById('add-deacon-modal').style.display = 'block';
  document.body.style.overflow = 'hidden';
};

window.closeAddDeaconModal = () => {
  document.getElementById('add-deacon-modal').style.display = 'none';
  document.body.style.overflow = '';
};

window.saveNewDeacon = async () => {
  if (state.currentUserRole !== 'admin' && !state.currentUserIsLead && !state.currentUserIsPhaseLead) { showToast('الأدمن أو مسؤول السنة أو مسؤول المرحلة بس يقدروا يعملوا كده', 'error'); return; }
  const name = document.getElementById('new-deacon-name').value.trim();
  if (!state.activeGrade) { showToast('اختر السنة الدراسية الأول', 'error'); return; }
  if (!name) { showToast('اكتب اسم الخادم', 'error'); return; }
  if (DEACONS.includes(name)) { showToast('الخادم ده موجود بالفعل في السنة دي', 'error'); return; }
  try {
    const docRef = await addDoc(collection(db, 'deacons'), { name, grade: state.activeGrade, section: sectionTag(), gender: genderOfSection(sectionTag()), roleIds: [], createdAt: serverTimestamp() });
    state.ALL_DEACONS_RAW.push({ id: docRef.id, name, grade: state.activeGrade, section: sectionTag() });
    applyActiveGradeDeacons();
    closeAddDeaconModal();
    showToast(`تمت إضافة الخادم "${name}" لسنة ${state.activeGrade} ✓`, 'success');
    logActivity('أضاف خادم جديد', `${name} — ${state.activeGrade}`);
  } catch(e) {
    showToast('حدث خطأ، حاول تاني', 'error');
  }
};
