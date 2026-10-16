// @ts-nocheck
import { doc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { avatarPlaceholder } from '@/features/students/photos';
import { state } from '@/core/state';
import { buildActiveGradeBar, showMainAppTabs, showServantsDirectorySection } from '@/features/shell/app-shell';
import { ensureDeacons, ensureDeaconUsers, ensureDeaconAttendance } from '@/core/data';
import { DEACONS, DEACON_ADMIN_MAP, applyActiveGradeDeacons, loadDeaconsList } from '@/features/servants/deacons';
import { sortRegisteredFirst, deaconAttendanceCount, deaconStatusOn, getCurrentUserScopedDeaconRows, loadDeaconAttendance, recentDeaconSessions, resetDeaconAttDay } from '@/features/servants/deacon-attendance';
import { loadPendingDeacons } from '@/features/servants/approvals';
import { formatAssignedGradesLabel } from '@/core/session';
import { auth, db } from '@/core/firebase';
import { getDocFast } from '@/core/firestore-helpers';
import { sectionTag, genderOfSection, ALL_GRADES } from '@/core/section';
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


// ===== خانة الخدام: تابين — الحضور + ملفات الخدام (من كل السنين الدراسية) =====

let currentServantsTab = 'att'; // 'att' | 'list' (the class filter above both tabs redraws the one that is open)

// فلتر تاب "الخدام": حضر/غاب في آخر 1-4 مرات من نوع معيّن (مدارس الأحد أو اجتماع الخدام)
let dirFilterStatus = 'all';   // 'all' | 'present' | 'absent' | 'excuse'
let dirFilterType = 'sunday';  // 'sunday' | 'meeting'
let dirFilterBirthday = false; // أعياد ميلاد الخدام في الشهر الحالي (من بيانات الخادم المسجلة)

function resetDirFilter() {
  dirFilterStatus = 'all';
  dirFilterType = 'sunday';
  dirFilterBirthday = false;
  document.getElementById('sd-flt-bday')?.classList.remove('active');
  document.querySelectorAll('#sd-flt-status-tabs .tab').forEach(b => b.classList.toggle('active', b.dataset.status === 'all'));
  document.querySelectorAll('#sd-flt-type-tabs .tab').forEach(b => b.classList.toggle('active', b.dataset.type === 'sunday'));
  const countEl = document.getElementById('sd-flt-count');
  if (countEl) countEl.value = '1';
  const extra = document.getElementById('sd-flt-extra');
  if (extra) extra.style.display = 'none';
}

window.setDirFilterStatus = (status, btn) => {
  dirFilterStatus = status;
  document.querySelectorAll('#sd-flt-status-tabs .tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const extra = document.getElementById('sd-flt-extra');
  if (extra) extra.style.display = status === 'all' ? 'none' : 'block';
  renderServantsDirectory();
};

window.toggleDirFilterBirthday = (btn) => {
  dirFilterBirthday = !dirFilterBirthday;
  if (btn) btn.classList.toggle('active', dirFilterBirthday);
  renderServantsDirectory();
};

// يوم وشهر الميلاد من dob (YYYY-MM-DD) — بيرجع null لو مش مكتوب أو الصيغة غلط
function dobMonthDay(dob) {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(dob || '');
  return m ? { month: parseInt(m[1], 10), day: parseInt(m[2], 10) } : null;
}

window.setDirFilterType = (type, btn) => {
  dirFilterType = type === 'meeting' ? 'meeting' : 'sunday';
  document.querySelectorAll('#sd-flt-type-tabs .tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderServantsDirectory();
};

window.openServantsDirectory = async () => {
  if (state.currentUserRole !== 'admin') { showToast('دليل الخدام للأدمن بس', 'error'); return; }
  state.servantsDirectoryOpen = true;
  resetDeaconAttDay(); // التحضير بيبدأ على اليوم اللي اتفتحت فيه الخانة
  showServantsDirectorySection();
  buildActiveGradeBar();
  const searchEl = document.getElementById('servants-directory-search');
  if (searchEl) searchEl.value = '';
  const attSearchEl = document.getElementById('sd-att-search');
  if (attSearchEl) attSearchEl.value = '';
  resetDirFilter();
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
  updateServantsDashStats();
  loadPendingDeacons().then(updateServantsDashStats).catch(e => console.warn('join requests count:', e)); // all classes, not just the active one
  state.servantsGradeFilter = '';
  mountServantsClassFilter();
  // كل مرة تتفتح الخانة: تابع الحضور → حضور مدارس الأحد (مهما كان اللي اتفتح قبل كده)
  window.setServantsTab('att', document.getElementById('sd-tab-btn-att'));
  window.setDeaconAttType('sunday', document.getElementById('sd-type-btn-sunday'));
  renderServantsDirectory();
};

// كروت أرقام لوحة الخدام: عدد الخدام (نفس عدد قائمة الخدام) وطلبات الانضمام المعلّقة (من غير قراءة جديدة من Firestore)
export function updateServantsDashStats() {
  const servantsEl = document.getElementById('sd-stat-servants');
  const pendingEl  = document.getElementById('sd-stat-pending');
  if (servantsEl) servantsEl.textContent = String(getCurrentUserScopedDeaconRows().length);
  if (pendingEl)  pendingEl.textContent  = String(state.pendingDeaconsCount || 0);
}
window.updateServantsDashStats = updateServantsDashStats;

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
  let all = sortRegisteredFirst(getCurrentUserScopedDeaconRows(), x => x.name);
  if (state.servantsGradeFilter) {
    all = all.filter(x => (x.grade || '').trim() === state.servantsGradeFilter);
  }

  if (term) {
    const norm = s => (s || '').replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase();
    all = all.filter(x => norm(x.name).includes(norm(term)));
  }

  // فلتر الحضور/الغياب: الخادم لازم يكون حضر (أو غاب) في كل واحدة من آخر N مرات متسجلة للنوع المختار
  const filtering = dirFilterStatus !== 'all';
  let sessions = [];
  const hintEl = document.getElementById('sd-flt-hint');
  if (filtering) {
    const wantN = parseInt(document.getElementById('sd-flt-count')?.value || '1') || 1;
    sessions = recentDeaconSessions(dirFilterType, wantN);
    const want = dirFilterStatus === 'present' ? 'present' : dirFilterStatus === 'excuse' ? 'excuse' : 'absent';
    all = sessions.length ? all.filter(x => sessions.every(d => deaconStatusOn(x.name, dirFilterType, d) === want)) : [];
    if (hintEl) {
      const lbl = d => { const [, m, dd] = d.split('-'); return `${dd}/${m}`; };
      hintEl.textContent = !sessions.length ? 'مفيش أيام متسجلة للنوع ده لسه'
        : (sessions.length < wantN ? `المتسجل ${sessions.length} أيام بس، فالفلتر على الأيام دي: ` : 'الأيام المحسوبة: ') + sessions.map(lbl).join(' · ');
    }
  } else if (hintEl) hintEl.textContent = '';

  // فلتر أعياد الميلاد: الخدام اللي ميلادهم في الشهر الحالي، مترتبين باليوم (اللي لسه ماسجلش بياناته مالوش تاريخ ميلاد)
  const bdayMap = {};
  if (dirFilterBirthday) {
    const curMonth = new Date().getMonth() + 1;
    all = all.filter(x => {
      const md = dobMonthDay((DEACON_ADMIN_MAP[x.name] || {}).dob);
      if (md && md.month === curMonth) { bdayMap[x.name] = md; return true; }
      return false;
    }).sort((a, b) => bdayMap[a.name].day - bdayMap[b.name].day);
  }

  document.getElementById('servants-directory-count').textContent = `${all.length} خادم`;
  const histIcon = { present: '✅', excuse: '📝', absent: '❌' };
  // لما فلتر حضر/غاب/اعتذر يكون شغال: العدّادين جنب كل خادم بيعدّوا الحالة دي (مش الحضور بس) في كل مرات النوع ده
  const metric = filtering ? (dirFilterStatus === 'present' ? 'present' : dirFilterStatus === 'excuse' ? 'excuse' : 'absent') : 'present';
  const metricLbl = { present: 'حضر', excuse: 'اعتذر', absent: 'غاب' }[metric];
  const allSessions = filtering ? { sunday: recentDeaconSessions('sunday'), meeting: recentDeaconSessions('meeting') } : null;
  const metricCount = (name, type) => filtering
    ? allSessions[type].filter(d => deaconStatusOn(name, type, d) === metric).length
    : deaconAttendanceCount(name, type);
  const rows = all.map(x => ({
    name: x.name,
    grade: x.grade || '',
    registered: !!DEACON_ADMIN_MAP[x.name],
    photo: (DEACON_ADMIN_MAP[x.name] && DEACON_ADMIN_MAP[x.name].photo) || '',
    // عدد مرات الحضور لكل الخادم ده، في كل السنين الدراسية مش سنة معينة بس (أو عدد الحالة المختارة لما الفلتر شغال)
    sunday: metricCount(x.name, 'sunday'),
    meeting: metricCount(x.name, 'meeting'),
    birthday: bdayMap[x.name] ? `${bdayMap[x.name].day}/${bdayMap[x.name].month}` : '',
    history: filtering ? sessions.map(d => histIcon[deaconStatusOn(x.name, dirFilterType, d)]).join(' ') : '',
    metric: filtering ? { label: metricLbl, tone: metric } : null
  }));
  window.openReactScreen('servants-list', document.getElementById('servants-directory-list'), {
    rows,
    emptyIcon: filtering || dirFilterBirthday ? '🔍' : '🙏',
    emptyText: dirFilterBirthday ? 'مفيش خدام أعياد ميلادهم الشهر ده (أو لسه ماسجلوش تاريخ الميلاد)' : filtering ? 'مفيش خدام بالشرط ده' : 'مفيش خدام مطابقين',
    onOpen: (name) => window.openDeaconProfile(name)
  });
};

// الفلتر بالفصل فوق تابي الخدام (الحضور والخدام): بيتعمل بالـReact، والاختيار محفوظ في state عشان التابين يشاركوه
function mountServantsClassFilter() {
  const el = document.getElementById('sd-class-filter');
  if (!el) return;
  window.openReactScreen('servants-filter', el, {
    grades: ALL_GRADES,
    value: state.servantsGradeFilter,
    onChange: (grade) => {
      state.servantsGradeFilter = grade;
      mountServantsClassFilter();
      if (currentServantsTab === 'att') renderDeaconAttPicker(); else renderServantsDirectory();
    }
  });
}

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

  mountDeaconAvatar(name);
  document.getElementById('deacon-profile-modal').style.display = 'block';
};

// the picture in the profile header is the same React <Avatar> as everywhere (via the 'avatar-host'): tap = see the photo; the servant
// themselves, or an admin, can also change or delete it (the photo manager)
function mountDeaconAvatar(name) {
  const u = DEACON_ADMIN_MAP[name];
  const mine = !!(u && auth.currentUser && u.uid === auth.currentUser.uid);
  const editable = !!u && (mine || state.currentUserRole === 'admin');
  document.getElementById('dprof-avatar').innerHTML = avatarPlaceholder(name, (u && u.photo) || '', 56, {
    accent: true,
    photoTarget: editable ? `servant:${u.uid}` : ''
  });
}

// a servant's photo was saved or deleted (by the photo manager): keep the data in memory in step
document.addEventListener('photo-changed', (e) => {
  const { kind, id, photo } = e.detail || {};
  if (kind !== 'servant') return;
  const entry = Object.entries(DEACON_ADMIN_MAP).find(([, u]) => u.uid === id);
  if (!entry) return;
  entry[1].photo = photo;
  if (window.renderServantsDirectory && state.servantsDirectoryOpen) window.renderServantsDirectory();
});

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
          graduated: !!u.graduated, college: u.college || '', university: u.university || '', photo: u.photo || ''
        };
      }
    } catch(e) { console.error('openMyProfile error:', e.code || e.message || e); }
  }
  await loadDeaconAttendance();
  openDeaconProfile(name);
};

// "✏️ تعديل بيانات الخادم" is a React screen (src/react/screens/edit-servant/index.tsx); this only prepares its data and applies the result
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
