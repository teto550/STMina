// @ts-nocheck
import { onSnapshot, query, collection, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { state } from '@/core/state';
import { DEACONS } from '@/features/servants/deacons';
import { db } from '@/core/firebase';
import { inCurrentSection } from '@/core/section';
import { loadDeaconAttendance } from '@/features/servants/deacon-attendance';

// ===== ONLINE / ACTIVITY TAB (admin only) =====
let onlineUnsub   = null;

let activityUnsub = null;

let onlineUsersCache   = []; // deacons only (admin excluded)

let activityItemsCache = [];

function fullDateTime(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('ar-EG', { weekday:'long', day:'numeric', month:'long' }) +
    ' — ' + d.toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' });
}

function timeAgo(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 45)   return 'الآن';
  if (sec < 90)   return 'من دقيقة';
  if (sec < 3600) return `من ${Math.floor(sec/60)} دقيقة`;
  if (sec < 86400)return `من ${Math.floor(sec/3600)} ساعة`;
  return d.toLocaleDateString('ar-EG', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

// لو الاسم المسجل شكله إيميل (فيه @) اعتبره زي ما لو مفيش اسم خالص
function displayName(name) {
  return (name && !/@/.test(name)) ? name : 'بدون اسم';
}

// أسماء مستبعدة تمامًا من تبويب "المتصلين" (مش هتظهر في الليست ولا الفلتر ولا الأنشطة)
const EXCLUDED_NAMES = ['سوتي'];

function isExcludedName(name) {
  return !!name && EXCLUDED_NAMES.some(x => name.includes(x));
}

// لو نفس الاسم مسجل أكتر من مرة (حسابين مختلفين)، خليه يظهر مرة واحدة بس
function dedupeByName(users) {
  const map = new Map();
  for (const u of users) {
    const key = (u.name || u.id).trim();
    const existing = map.get(key);
    if (!existing) { map.set(key, u); continue; }
    const uTime = u.lastActive?.seconds || 0;
    const eTime = existing.lastActive?.seconds || 0;
    if (uTime > eTime) map.set(key, u); // خلي الأحدث نشاطًا هو اللي يظهر
  }
  return Array.from(map.values());
}

export function initOnlineTab() {
  // Filter dropdown — from the registered deacons list (خانة الخدام), not user accounts
  if (onlineUnsub) { onlineUnsub(); onlineUnsub = null; }
  const sel = document.getElementById('online-deacon-filter');
  const cur = sel.value;
  sel.innerHTML = '<option value="">كل الخدام</option>' +
    DEACONS.filter(d => !isExcludedName(d))
      .map(d => `<option value="${d}"${cur===d?' selected':''}>${d}</option>`).join('');

  // Live activity feed (latest 100, admin's own actions excluded, و"مسؤول السنة" يشوف نشاط سنته بس)
  if (activityUnsub) activityUnsub();
  activityUnsub = onSnapshot(
    query(collection(db, 'activity_log'), orderBy('timestamp', 'desc')),
    snap => {
      let items = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => inCurrentSection(a) && a.role !== 'admin' && !isExcludedName(a.name));
      // أدمن: يشوف نشاط السنة الدراسية النشطة (activeGrade) بس — مسؤول سنة: يشوف نشاط سنته بس
      if (state.currentUserRole === 'admin') { if (state.activeGrade) items = items.filter(a => a.grade === state.activeGrade); }
      else items = items.filter(a => a.grade === state.currentUserGrade);
      activityItemsCache = items.slice(0, 100);
      renderOnlineTab();
    },
    err => console.warn('activity_log listener error:', err)
  );

  loadDeaconAttendance();
}

window.switchOnlineSubTab = (name, btn) => {
  document.querySelectorAll('#online-sub-tabs .tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('online-subpanel-activity').style.display = name === 'activity' ? 'block' : 'none';
  document.getElementById('online-subpanel-attendance').style.display = name === 'attendance' ? 'block' : 'none';
};

window.renderOnlineTab = () => {
  const filterName = document.getElementById('online-deacon-filter').value;

  // Activity feed — filtered by selected deacon's name if one is chosen
  const items = filterName ? activityItemsCache.filter(a => displayName(a.name) === filterName) : activityItemsCache;
  const el = document.getElementById('activity-list');
  if (!items.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📜</div>لا يوجد نشاط بعد</div>';
    return;
  }
  el.innerHTML = items.map(a => `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 16px;margin-bottom:8px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div style="font-size:14px;font-weight:700">🙏 ${displayName(a.name)}</div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <div style="font-size:11px;color:var(--text-dim);white-space:nowrap">${fullDateTime(a.timestamp)}</div>
          <button onclick="deleteActivity('${a.id}')" style="background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.25);border-radius:8px;color:var(--danger);font-size:12px;padding:4px 8px;cursor:pointer;line-height:1">🗑</button>
        </div>
      </div>
      <div style="font-size:13px;color:var(--text-dim);margin-top:4px">${a.action}${a.details ? ' — ' + a.details : ''}</div>
    </div>`).join('');
};

window.deleteActivity = async (id) => {
  if (!confirm('هتحذف النشاط ده؟')) return;
  try {
    await deleteDoc(doc(db, 'activity_log', id));
    activityItemsCache = activityItemsCache.filter(a => a.id !== id);
    renderOnlineTab();
  } catch (e) {
    showToast('تعذّر الحذف', 'error');
  }
};

window.deleteAllActivities = async () => {
  if (!activityItemsCache.length) { showToast('مفيش أنشطة تتحذف', 'info'); return; }
  if (!confirm('هتحذف كل الأنشطة؟ الإجراء ده مش هينفع يترجع')) return;
  try {
    await Promise.all(activityItemsCache.map(a => deleteDoc(doc(db, 'activity_log', a.id))));
    activityItemsCache = [];
    renderOnlineTab();
    showToast('تم حذف كل الأنشطة ✓', 'success');
  } catch (e) {
    showToast('تعذّر حذف كل الأنشطة', 'error');
  }
};
