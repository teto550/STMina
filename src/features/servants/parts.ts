// @ts-nocheck
import { query, collection, where, addDoc, serverTimestamp, deleteDoc, doc, onSnapshot, writeBatch } from 'firebase/firestore';
import { state } from '@/core/state';
import { getDocsFast } from '@/core/firestore-helpers';
import { auth, db } from '@/core/firebase';
import { inCurrentSection, sectionTag } from '@/core/section';
import { isGradeManagerOf } from '@/core/session';
import { DEACONS } from '@/features/servants/deacons';
import { notifyDeaconPush } from '@/features/shell/push';

// ===== PARTS DISTRIBUTION (توزيع الفقرات) =====
// كل الخدام يقدروا يشوفوا الفقرات الموزعة على فصلهم، ومسؤول الفصل بس يقدر يضيف/يمسح
const PART_TYPES = ['المقدمة', 'الدرس', 'الصلاة', 'الترانيم', 'أخرى'];

const PART_TYPE_ICONS = { 'المقدمة': '🎤', 'الدرس': '📖', 'الصلاة': '🙏', 'الترانيم': '🎵', 'أخرى': '📌' };

let PARTS_LIST = [];

function escapePartText(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ===== تواريخ الفقرات: كل فقرة ليها يوم مختار (غالبًا جمعة)، بنلوّنها حسب قربها =====
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function dateToStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// أقرب جمعة جايه (لو النهاردة جمعة نفسها بترجع النهاردة)
function nextFridayStr() {
  const d = new Date();
  const diff = (5 - d.getDay() + 7) % 7; // Friday = 5
  d.setDate(d.getDate() + diff);
  return dateToStr(d);
}

const PART_WEEKDAY_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function formatPartDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  return `${PART_WEEKDAY_AR[d.getDay()]}، ${day}/${m}`;
}

// شكل عنوان المجموعة المطلوب: "الجمعة 25-9"
function formatPartDateHeader(dateStr) {
  if (!dateStr) return '';
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  return `${PART_WEEKDAY_AR[d.getDay()]} ${day}-${m}`;
}

window.updatePartDateHint = () => {
  const val = document.getElementById('part-date-input').value;
  const hint = document.getElementById('part-date-hint');
  if (!val) { hint.textContent = ''; return; }
  const [y, m, day] = val.split('-').map(Number);
  hint.textContent = `📅 ${PART_WEEKDAY_AR[new Date(y, m - 1, day).getDay()]}`;
};

export async function loadParts() {
  const grade = state.activeGrade;
  const labelEl = document.getElementById('parts-grade-label');
  if (labelEl) labelEl.textContent = grade || '';
  const listEl = document.getElementById('parts-list');
  if (!grade) { listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div>اختر السنة الدراسية الأول</div>'; return; }
  try {
    const snap = await getDocsFast(query(collection(db, 'parts_distribution'), where('grade', '==', grade)));
    PARTS_LIST = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(inCurrentSection)
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  } catch (e) {
    console.error('loadParts error:', e.code || e.message || e);
    listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div>مقدرناش نجيب الفقرات، جرب تاني</div>';
    return;
  }
  renderParts();
}

function renderParts() {
  const listEl = document.getElementById('parts-list');
  const canManage = isGradeManagerOf(state.activeGrade);
  if (!PARTS_LIST.length) {
    listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div>لسه مفيش فقرات متوزعة</div>';
    return;
  }
  const upcoming = nextFridayStr();
  const today = todayStr();
  // ترتيب: الأقرب تاريخًا الأول
  const sorted = PARTS_LIST.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  // تجميع كل الفقرات تحت يومها (مش كل فقرة سطر لوحدها)
  const groups = [];
  const byDate = new Map();
  sorted.forEach(p => {
    const key = p.date || '';
    if (!byDate.has(key)) { const g = { date: key, items: [] }; byDate.set(key, g); groups.push(g); }
    byDate.get(key).items.push(p);
  });

  listEl.innerHTML = groups.map(g => {
    const isUpcoming = g.date === upcoming;                 // الجمعة الجايه → أخضر
    const isPast = g.date && g.date < today && !isUpcoming; // اتعدى → أزرق عادي
    const color = isUpcoming ? 'var(--success)' : 'var(--accent)';
    const border = isUpcoming ? 'rgba(46,204,113,0.4)' : 'var(--border)';
    const groupKey = state.activeGrade + '|' + g.date;
    const isOpen = partDateGroupState[groupKey] === true; // كل الأيام مقفولة افتراضيًا، غير اللي انت دوست تفتحه بنفسك
    const headerLabel = g.date ? `📅 يوم ${formatPartDateHeader(g.date)}` : '📌 بدون تاريخ محدد';
    const itemsHtml = g.items.map(p => `
      <div style="background:var(--surface2);border-radius:var(--radius-sm);padding:12px 14px;margin-top:8px;display:flex;align-items:center;gap:12px">
        <div style="width:36px;height:36px;border-radius:10px;background:${isUpcoming ? 'rgba(46,204,113,0.12)' : 'rgba(var(--accent-rgb),0.12)'};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${PART_TYPE_ICONS[p.type] || '📌'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;color:${color};font-weight:700">${escapePartText(p.type)}</div>
          <div style="font-size:15px;font-weight:700;margin-top:2px">${escapePartText(p.title)}</div>
          <div style="font-size:12px;color:var(--text-dim);margin-top:2px">👤 ${escapePartText(p.deaconName)}</div>
        </div>
        ${canManage ? `<button onclick="deletePart('${p.id}')" style="background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.25);border-radius:8px;color:var(--danger);font-size:16px;width:36px;height:36px;cursor:pointer;flex-shrink:0">🗑</button>` : ''}
      </div>`).join('');
    return `
    <div style="background:var(--surface);border:1px solid ${border};border-radius:var(--radius-sm);margin-bottom:10px;overflow:hidden;${isPast ? 'opacity:0.8' : ''}">
      <button onclick="togglePartDateGroup('${escapePartText(g.date)}')" style="width:100%;background:${isUpcoming ? 'rgba(46,204,113,0.10)' : 'rgba(var(--accent-rgb),0.10)'};border:none;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;font-family:'Cairo',sans-serif">
        <span style="color:${color};font-weight:700;font-size:15px">${headerLabel}</span>
        <span style="display:flex;align-items:center;gap:8px">
          <span style="background:${isUpcoming ? 'rgba(46,204,113,0.2)' : 'rgba(var(--accent-rgb),0.2)'};color:${color};font-size:12px;font-weight:700;border-radius:20px;padding:2px 9px">${g.items.length}</span>
          <span style="color:var(--text-dim);font-size:13px;transition:transform 0.2s;display:inline-block;transform:rotate(${isOpen ? '180deg' : '0deg'})">▾</span>
        </span>
      </button>
      <div style="padding:${isOpen ? '0 16px 14px' : '0'};display:${isOpen ? 'block' : 'none'}">${itemsHtml}</div>
    </div>`;
  }).join('');
}

// ===== حالة فتح/قفل كل مجموعة يوم في توزيع الفقرات (بتفضل زي ما هي لحد ما اليوزر يدوس تاني) =====
let partDateGroupState = {};

window.togglePartDateGroup = (date) => {
  const key = state.activeGrade + '|' + date;
  partDateGroupState[key] = partDateGroupState[key] !== true;
  renderParts();
};

window.openAddPartModal = () => {
  if (!isGradeManagerOf(state.activeGrade)) { showToast('مسموح بس لمسؤول الفصل ده', 'error'); return; }
  const sel = document.getElementById('part-deacon-select');
  sel.innerHTML = '<option value="">اختر الخادم</option>' + DEACONS.map(d => `<option>${escapePartText(d)}</option>`).join('');
  document.getElementById('part-type-select').value = PART_TYPES[0];
  document.getElementById('part-title-input').value = '';
  document.getElementById('part-date-input').value = nextFridayStr(); // افتراضيًا أقرب جمعة، وقابل للتغيير
  updatePartDateHint();
  document.getElementById('add-part-modal').style.display = 'block';
};

window.closeAddPartModal = () => { document.getElementById('add-part-modal').style.display = 'none'; };

window.saveNewPart = async () => {
  if (!isGradeManagerOf(state.activeGrade)) { showToast('مسموح بس لمسؤول الفصل ده', 'error'); return; }
  const type = document.getElementById('part-type-select').value;
  const deaconName = document.getElementById('part-deacon-select').value;
  const title = document.getElementById('part-title-input').value.trim();
  const date = document.getElementById('part-date-input').value;
  if (!PART_TYPES.includes(type)) { showToast('اختر نوع الفقرة', 'error'); return; }
  if (!deaconName) { showToast('اختر اسم الخادم', 'error'); return; }
  if (!title) { showToast('اكتب تفاصيل الفقرة', 'error'); return; }
  if (!date) { showToast('اختر ميعاد الفقرة', 'error'); return; }
  try {
    await addDoc(collection(db, 'parts_distribution'), {
      grade: state.activeGrade, type, deaconName, title, date, section: sectionTag(),
      createdByUid: auth.currentUser.uid, createdByName: state.currentUserName,
      createdAt: serverTimestamp()
    });
    // إشعار للخادم اللي اتوزعت عليه الفقرة: توست جوه التطبيق + Push حقيقي على موبايله لو مفعّل الإشعارات
    notifyDeaconOfPart(deaconName, { type, title, date, grade: state.activeGrade }).catch(e => console.warn('part notify:', e));
    notifyDeaconPush(deaconName, { type, title, date, grade: state.activeGrade });
    closeAddPartModal();
    showToast('تم إضافة الفقرة ✓', 'success');
    loadParts();
  } catch (e) {
    console.error('saveNewPart error:', e.code || e.message || e);
    showToast('مقدرناش نحفظ الفقرة، جرب تاني', 'error');
  }
};

window.deletePart = async (id) => {
  if (!isGradeManagerOf(state.activeGrade)) return;
  if (!confirm('تمسح الفقرة دي؟')) return;
  try {
    await deleteDoc(doc(db, 'parts_distribution', id));
    loadParts();
  } catch (e) {
    console.error('deletePart error:', e.code || e.message || e);
    showToast('مقدرناش نمسح الفقرة', 'error');
  }
};

// ===== إشعارات توزيع الفقرات (part_notifications) =====
// لما مسؤول الفصل يوزع فقرة، الخادم اللي اتوزعت عليه ياخد إشعار (جرس 🔔 + توست) أول ما يفتح التطبيق

async function notifyDeaconOfPart(deaconName, part) {
  await addDoc(collection(db, 'part_notifications'), {
    deaconName, grade: part.grade, type: part.type, title: part.title, date: part.date,
    section: sectionTag(), read: false, createdAt: serverTimestamp()
  });
}

// مفيش زرار أو جرس يتحكم فيها — أول ما الخادم يفتح التطبيق، أي فقرة اتوزعت عليه بتظهر
// كتوست تلقائي فورًا وبتتعلّم "مقروءة" على طول، فمفيش وسيلة إنه يمنعها أو يأجلها
export function setupPartNotifications() {
  if (state.partNotifUnsub) { state.partNotifUnsub(); state.partNotifUnsub = null; }
  if (!state.currentUserName) return;
  const q = query(collection(db, 'part_notifications'), where('deaconName', '==', state.currentUserName), where('read', '==', false));
  state.partNotifUnsub = onSnapshot(q, snap => {
    const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(inCurrentSection)
      .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    if (!notifs.length) return;
    notifs.forEach((p, i) => {
      setTimeout(() => showToast(`🔔 اتوزعت عليك فقرة: ${p.type} — ${p.title}`, 'info'), i * 3200);
    });
    const batch = writeBatch(db);
    notifs.forEach(p => batch.update(doc(db, 'part_notifications', p.id), { read: true }));
    batch.commit().catch(e => console.warn('mark part notif read:', e));
  }, e => console.warn('part notif listen error:', e));
}
