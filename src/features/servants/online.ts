// @ts-nocheck
import { query, collection, orderBy, limit, startAfter, where, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { countReads } from '@/core/firestore-helpers';
import { state } from '@/core/state';
import { DEACONS } from '@/features/servants/deacons';
import { db } from '@/core/firebase';
import { inCurrentSection } from '@/core/section';

// ===== ACTIVITY LOG VIEWER (admin / year and phase leads) =====
// On demand only. The log can hold thousands of entries, so it is never read as a whole and nothing is read until this
// screen is opened. Newest first, 20 per page; the next page loads by itself when the user scrolls to the bottom.
// The filters (servant, type of activity, date range, class) are applied BY THE SERVER, only when "apply" is pressed,
// and the same filters are used for every following page.
//
// Free-text search is NOT offered: Firestore cannot search inside text, and a text filter cannot be combined with the
// newest-first order. See docs/READ-OPTIMIZATION.md ("Where should the activity log live?").
//
// Needs 3 composite indexes (firestore.indexes.json): (grade, timestamp), (name, timestamp), (action, timestamp).
const PAGE_SIZE = 20;
const MAX_RAW_PAGES_PER_LOAD = 5; // when the safety checks below hide most entries of a page, look at most 5 x 20 per step
const MAX_EMPTY_SCAN = 200;       // ...and give up after 200 raw entries if not a single one was shown

// every action the app writes to the log (used for the "type" filter)
const ACTIVITY_TYPES = [
  'دخل التطبيق', 'خرج من التطبيق',
  'سجّل حضور', 'ألغى حضور', 'سجّل افتقاد بالصوت', 'سجّل حضور خادم',
  'أضاف مخدوم جديد', 'حذف مخدوم', 'أضاف نجمة', 'شال نجمة', 'سجّل هدية عيد ميلاد', 'ألغى هدية عيد ميلاد',
  'حدد موقع GPS', 'مسح موقع GPS',
  'أضاف خادم جديد', 'عدّل اسم خادم', 'حذف خادم', 'وافق على طلب خادم', 'رفض طلب خادم',
  'عيّن أدمن جديد', 'ألغى صلاحية أدمن', 'عيّن مسؤول سنة', 'ألغى مسؤول سنة', 'عيّن مسؤول مرحلة', 'ألغى مسؤول مرحلة',
  'ترقية سنة دراسية', 'تنظيف حضور قديم', 'حذف تاريخ حضور', 'ترحيل بيانات قديمة',
  'استيراد حضور من إكسيل', 'رفع بيانات مخدومين من إكسيل', 'رفع ID وباسوردات المخدومين',
];

let feed = { items: [], cursor: null, done: false, loading: false, started: false, filters: null, gen: 0, rawSeen: 0, error: null };
let observer = null;

function fullDateTime(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('ar-EG', { weekday:'long', day:'numeric', month:'long' }) +
    ' — ' + d.toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' });
}

// لو الاسم المسجل شكله إيميل (فيه @) اعتبره زي ما لو مفيش اسم خالص
function displayName(name) {
  return (name && !/@/.test(name)) ? name : 'بدون اسم';
}

// أسماء مستبعدة تمامًا من تبويب المتابعة (مش هتظهر في الليست ولا الفلتر)
const EXCLUDED_NAMES = ['سوتي'];
const isExcludedName = (name) => !!name && EXCLUDED_NAMES.some(x => name.includes(x));

// Safety checks that stay on the client because old log entries lack the fields needed to filter them on the server
// (no `section` on older entries; admin actions are 'role: admin'). They never change what the user chose to filter.
const passesSafetyChecks = (a) => inCurrentSection(a) && a.role !== 'admin' && !isExcludedName(a.name);

// the class the log is limited to: an admin sees the active class, a lead sees their own class
const classForUser = () => (state.currentUserRole === 'admin' ? state.activeGrade : state.currentUserGrade) || null;

function readFilters() {
  return {
    grade: classForUser(),
    name:  document.getElementById('online-deacon-filter').value,
    type:  document.getElementById('activity-type').value,
    from:  document.getElementById('activity-from').value,
    to:    document.getElementById('activity-to').value,
  };
}

function buildQuery(f, cursor) {
  const c = [];
  if (f.grade) c.push(where('grade', '==', f.grade));
  if (f.name)  c.push(where('name', '==', f.name));
  if (f.type)  c.push(where('action', '==', f.type));
  if (f.from)  c.push(where('timestamp', '>=', Timestamp.fromDate(new Date(f.from + 'T00:00:00'))));
  if (f.to)    c.push(where('timestamp', '<=', Timestamp.fromDate(new Date(f.to + 'T23:59:59.999'))));
  c.push(orderBy('timestamp', 'desc'));
  if (cursor) c.push(startAfter(cursor));
  c.push(limit(PAGE_SIZE));
  return query(collection(db, 'activity_log'), ...c);
}

async function loadMore() {
  if (feed.loading || feed.done || !feed.started) return;
  const gen = feed.gen;
  feed.loading = true; render();
  const before = feed.items.length;
  let pages = 0;
  try {
    while (!feed.done && pages < MAX_RAW_PAGES_PER_LOAD && feed.items.length - before < PAGE_SIZE) {
      const snap = await getDocs(buildQuery(feed.filters, feed.cursor)); pages++;
      if (gen !== feed.gen) return; // "apply" was pressed meanwhile: this answer belongs to the old filters
      countReads('activity_log', Math.max(snap.size, 1));
      feed.rawSeen += snap.docs.length;
      if (snap.size < PAGE_SIZE) feed.done = true;
      if (snap.docs.length) feed.cursor = snap.docs[snap.docs.length - 1];
      snap.docs.forEach(d => { const a = { id: d.id, ...d.data() }; if (passesSafetyChecks(a)) feed.items.push(a); });
    }
  } catch (e) {
    if (gen !== feed.gen) return;
    console.warn('activity log error:', e);
    feed.done = true; // do not retry in a loop while scrolling
    feed.error = /index/i.test(String(e && e.message)) ? 'index' : 'error';
  }
  // nothing shown after a long look (e.g. the newest entries are all admin actions): stop instead of reading the whole log
  if (!feed.items.length && feed.rawSeen >= MAX_EMPTY_SCAN && !feed.done) { feed.done = true; feed.capped = true; }
  feed.loading = false; render();
  // the page is still empty or short and the bottom is on screen: the scroll trigger will NOT fire again by itself
  // (it only reacts to changes), so ask for the next page right away
  if (!feed.done && bottomInView()) loadMore();
}

// is the end-of-list marker visible (or almost) right now?
function bottomInView() {
  const el = document.getElementById('activity-sentinel');
  return !!el && el.offsetParent !== null && el.getBoundingClientRect().top < window.innerHeight + 200;
}

// "apply" (or first open, or refresh): forget what was loaded and start again from the newest entry with the chosen filters
function startFeed() {
  feed = { items: [], cursor: null, done: false, loading: false, started: true, filters: readFilters(), gen: feed.gen + 1, rawSeen: 0, error: null, capped: false };
  render();
  loadMore();
}

function render() {
  if (!feed.started) return;
  const list   = document.getElementById('activity-list');
  const bottom = document.getElementById('activity-bottom');
  const count  = document.getElementById('activity-count');
  if (count) count.textContent = feed.items.length ? `(${feed.items.length}${feed.done ? '' : '+'})` : '';
  list.innerHTML = feed.items.map(a => `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 16px;margin-bottom:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div style="font-size:14px;font-weight:700">🙏 ${displayName(a.name)}</div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            <div style="font-size:11px;color:var(--text-dim);white-space:nowrap">${fullDateTime(a.timestamp)}</div>
            <button onclick="deleteActivity('${a.id}')" style="background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.25);border-radius:8px;color:var(--danger);font-size:12px;padding:4px 8px;cursor:pointer">🗑</button>
          </div>
        </div>
        <div style="font-size:13px;color:var(--text-dim);margin-top:4px">${a.action}${a.details ? ' — ' + a.details : ''}</div>
      </div>`).join('');
  if (feed.loading) bottom.innerHTML = '<div class="spinner" style="margin:0 auto 6px"></div>جاري التحميل…';
  else if (feed.error === 'index') bottom.textContent = '⚠️ الفلتر ده محتاج index في Firestore — شغّل: firebase deploy --only firestore:indexes';
  else if (feed.error) bottom.textContent = '⚠️ مقدرناش نجيب الأنشطة، دوس "تطبيق" تاني';
  else if (feed.capped) bottom.textContent = 'مفيش نشاط مطابق في آخر 200 تسجيل — جرّب تغيّر الفلتر أو التاريخ';
  else if (feed.done) bottom.textContent = feed.items.length ? '— آخر النتائج —' : 'لا يوجد نشاط مطابق';
  else bottom.textContent = '';
}

export function initOnlineTab() {
  // Filter dropdowns — servants from the registered deacons list (خانة الخدام), types from the app's action list
  const sel = document.getElementById('online-deacon-filter');
  const cur = sel.value;
  sel.innerHTML = '<option value="">كل الخدام</option>' +
    DEACONS.filter(d => !isExcludedName(d)).map(d => `<option value="${d}"${cur === d ? ' selected' : ''}>${d}</option>`).join('');
  const typeSel = document.getElementById('activity-type');
  if (typeSel.options.length <= 1) {
    typeSel.innerHTML = '<option value="">كل الأنواع</option>' + ACTIVITY_TYPES.map(t => `<option value="${t}">${t}</option>`).join('');
  }
  // infinite scroll: when the end of the list comes into view, load the next page
  if (!observer && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) loadMore(); }, { rootMargin: '200px' });
    observer.observe(document.getElementById('activity-sentinel'));
  }
  // the class can change between visits: start again when it did (or on the first visit)
  if (!feed.started || feed.error || (feed.filters && feed.filters.grade !== classForUser())) startFeed();
}

window.switchOnlineSubTab = (name, btn) => {
  document.querySelectorAll('#online-sub-tabs .tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('online-subpanel-activity').style.display = name === 'activity' ? 'block' : 'none';
  document.getElementById('online-subpanel-attendance').style.display = name === 'attendance' ? 'block' : 'none';
};

// "apply" button: read the filters and start again (this is the only thing that triggers a new server query)
window.applyActivityFilters = () => startFeed();
window.clearActivityFilters = () => {
  ['online-deacon-filter', 'activity-type', 'activity-from', 'activity-to'].forEach(id => { document.getElementById(id).value = ''; });
  startFeed();
};

window.deleteActivity = async (id) => {
  if (!confirm('هتحذف النشاط ده؟')) return;
  try {
    await deleteDoc(doc(db, 'activity_log', id));
    feed.items = feed.items.filter(a => a.id !== id);
    render();
  } catch (e) {
    showToast('تعذّر الحذف', 'error');
  }
};
