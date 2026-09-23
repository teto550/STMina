// @ts-nocheck
import { state } from '@/core/state';
import { DEACONS } from '@/features/servants/deacons';
import { DEACON_ATTENDANCE } from '@/features/servants/deacon-attendance';
import { studentPhonesLabel } from '@/features/students/students';
import { genderizeText } from '@/core/section';

// كل الأقسام المتاحة — المستخدم بيختار منها اللي عايزه
const DASH_SECTIONS = [
  { id:'kpi',       name:'📋 ملخص عام',                 desc:'عدد الخدام والمخدومين ومتوسط المخدومين للخادم' },
  { id:'topCalls',  name:'📞 الأكثر افتقادًا بالتليفون', desc:'ترتيب الخدام حسب عدد المخدومين اللي كلموهم' },
  { id:'topVisits', name:'🏠 الأكثر زيارة في البيت',     desc:'ترتيب الخدام حسب عدد الزيارات المنزلية' },
  { id:'topServed', name:'👥 الأكثر عددًا في المخدومين',  desc:'مين عنده مخدومين أكتر' },
  { id:'coverage',  name:'🎯 نسبة تغطية الافتقاد',       desc:'نسبة مخدومين كل خادم اللي اتواصل معاهم' },
  { id:'late',      name:'⏳ متأخرين في الافتقاد',        desc:'خدام لسه مكلموش مخدومين الشهر ده' },
  { id:'never',     name:'🚫 مخدومين مفيش تواصل معاهم',  desc:'اللي مكلمهمش ولا زارهم ولا مرة' },
  { id:'deaconAtt', name:'✅ حضور الخدام',               desc:'عدد أيام حضور كل خادم ونسبته' },
  { id:'noDeacon',  name:'⚠️ مخدومين بدون خادم',         desc:'مخدومين مش متسجل ليهم خادم افتقاد' },
  { id:'list',      name:'📄 قائمة تفصيلية بالتليفونات',  desc:'كل خادم وتحته مخدوميه وأرقام تليفوناتهم' }
];

const DASH_DEFAULT = ['kpi','topCalls','topVisits','topServed','late','list'];

function getDashPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem('dashSections') || 'null');
    if (Array.isArray(saved) && saved.length) return saved;
  } catch (e) {}
  return DASH_DEFAULT.slice();
}

function saveDashPrefs(ids) {
  try { localStorage.setItem('dashSections', JSON.stringify(ids)); } catch (e) {}
}

window.openDashModal = () => {
  const active = getDashPrefs();
  document.getElementById('dash-options').innerHTML = DASH_SECTIONS.map(s => `
    <label class="dash-opt">
      <input type="checkbox" value="${s.id}" ${active.includes(s.id) ? 'checked' : ''}>
      <span class="dash-opt-txt">
        <span class="dash-opt-name">${s.name}</span>
        <div class="dash-opt-desc">${s.desc}</div>
      </span>
    </label>`).join('');
  document.getElementById('dash-modal').style.display = 'flex';
};

window.closeDashModal = () => { document.getElementById('dash-modal').style.display = 'none'; };

window.closeDashModalOutside = (e) => { if (e.target.id === 'dash-modal') closeDashModal(); };

// بيحسب كل إحصائيات الخدام مرة واحدة ويستخدمها كل الأقسام
function computeDashStats() {
  const stats = {};
  DEACONS.forEach(d => {
    const mine = state.allStudents.filter(s => s.deacon === d);
    const called  = mine.filter(s => !!s.lastVisitPhone).length;
    const visited = mine.filter(s => !!s.lastVisitHome).length;
    const touched = mine.filter(s => s.lastVisitPhone || s.lastVisitHome).length;
    stats[d] = {
      total: mine.length,
      called, visited, touched,
      notThisMonth: mine.filter(s => !isVisitedThisMonth(s)).length,
      never: mine.filter(s => !s.lastVisitPhone && !s.lastVisitHome).length,
      coverage: mine.length ? Math.round(touched / mine.length * 100) : 0,
      students: mine.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'))
    };
  });
  return stats;
}

// عدد أيام حضور كل خادم من سجل حضور الخدام (النوعين مع بعض أو نوع واحد)
function computeDeaconAttendanceStats(type) {
  const types = type ? [type] : ['sunday', 'meeting'];
  const counts = {};
  DEACONS.forEach(d => { counts[d] = 0; });
  let totalDays = 0;
  types.forEach(t => {
    const map = (DEACON_ATTENDANCE && DEACON_ATTENDANCE[t]) || {};
    const dates = Object.keys(map);
    totalDays += dates.length;
    dates.forEach(dt => {
      Object.keys(map[dt] || {}).forEach(name => {
        if (counts[name] !== undefined) counts[name]++;
      });
    });
  });
  return { totalDays, counts };
}

// رسم شريط أفقي مرتب (bar chart بسيط وواضح)
function dashBarChart(rows, color, suffix) {
  if (!rows.length) return `<div class="dash-empty">مفيش بيانات</div>`;
  const max = Math.max(...rows.map(r => r.value), 1);
  return rows.map((r, i) => {
    const rank = i < 3 ? `top${i + 1}` : '';
    const pct = Math.round(r.value / max * 100);
    return `<div class="dash-bar-row">
      <div class="dash-bar-head">
        <span class="dash-rank ${rank}">${i + 1}</span>
        <span class="dash-bar-name">${r.name}</span>
        <span class="dash-bar-val" style="color:${color}">${r.value}${suffix || ''}</span>
      </div>
      <div class="dash-bar-track"><div class="dash-bar-fill" style="width:${Math.max(pct, 3)}%;background:${color}"></div></div>
    </div>`;
  }).join('');
}

function dashCard(title, inner) {
  return `<div class="dash-card"><div class="dash-card-title">${title}</div>${inner}</div>`;
}

function buildDashboardHTML() {
  const stats = computeDashStats();
  const active = getDashPrefs();
  const names = DEACONS.slice();
  const totalStudents = state.allStudents.length;
  const noDeaconList = state.allStudents
    .filter(s => !(s.deacon || '').trim())
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  let out = '';

  if (active.includes('kpi')) {
    const totalCalled  = state.allStudents.filter(s => !!s.lastVisitPhone).length;
    const totalVisited = state.allStudents.filter(s => !!s.lastVisitHome).length;
    const avg = names.length ? (totalStudents / names.length).toFixed(1) : '0';
    out += dashCard('📋 ملخص عام', `<div class="dash-kpis">
      <div class="dash-kpi"><div class="dash-kpi-num" style="color:var(--accent)">${names.length}</div><div class="dash-kpi-lbl">عدد الخدام</div></div>
      <div class="dash-kpi"><div class="dash-kpi-num" style="color:var(--accent2)">${totalStudents}</div><div class="dash-kpi-lbl">عدد المخدومين</div></div>
      <div class="dash-kpi"><div class="dash-kpi-num" style="color:var(--success)">${totalCalled}</div><div class="dash-kpi-lbl">اتكلم معاهم تليفون</div></div>
      <div class="dash-kpi"><div class="dash-kpi-num" style="color:#f1c40f">${totalVisited}</div><div class="dash-kpi-lbl">اتزاروا في البيت</div></div>
      <div class="dash-kpi"><div class="dash-kpi-num" style="color:var(--text)">${avg}</div><div class="dash-kpi-lbl">متوسط المخدومين للخادم</div></div>
      <div class="dash-kpi"><div class="dash-kpi-num" style="color:var(--danger)">${noDeaconList.length}</div><div class="dash-kpi-lbl">بدون خادم افتقاد</div></div>
    </div>`);
  }

  if (active.includes('topCalls')) {
    const rows = names.map(d => ({ name: d, value: stats[d].called })).sort((a, b) => b.value - a.value);
    out += dashCard('📞 الأكثر افتقادًا بالتليفون', dashBarChart(rows, 'var(--accent)'));
  }

  if (active.includes('topVisits')) {
    const rows = names.map(d => ({ name: d, value: stats[d].visited })).sort((a, b) => b.value - a.value);
    out += dashCard('🏠 الأكثر زيارة في البيت', dashBarChart(rows, '#f1c40f'));
  }

  if (active.includes('topServed')) {
    const rows = names.map(d => ({ name: d, value: stats[d].total })).sort((a, b) => b.value - a.value);
    out += dashCard('👥 الأكثر عددًا في المخدومين', dashBarChart(rows, 'var(--accent2)'));
  }

  if (active.includes('coverage')) {
    const rows = names.map(d => ({ name: d, value: stats[d].coverage })).sort((a, b) => b.value - a.value);
    out += dashCard('🎯 نسبة تغطية الافتقاد', dashBarChart(rows, 'var(--success)', '%'));
  }

  if (active.includes('late')) {
    const rows = names.map(d => ({ name: d, n: stats[d].notThisMonth, t: stats[d].total }))
      .filter(r => r.n > 0).sort((a, b) => b.n - a.n);
    const inner = rows.length
      ? rows.map(r => `<div class="dash-li">
          <span class="dash-li-name">${r.name}</span>
          <span class="dash-li-val">${r.n} من ${r.t}</span>
          <span class="dash-pill ${r.n >= r.t ? 'bad' : 'warn'}">لسه متأخر</span>
        </div>`).join('')
      : `<div class="dash-empty">تمام ✅ مفيش حد متأخر الشهر ده</div>`;
    out += dashCard('⏳ متأخرين في الافتقاد (الشهر ده)', inner);
  }

  if (active.includes('never')) {
    const rows = names.map(d => ({ name: d, n: stats[d].never })).filter(r => r.n > 0).sort((a, b) => b.n - a.n);
    const inner = rows.length
      ? rows.map(r => `<div class="dash-li">
          <span class="dash-li-name">${r.name}</span>
          <span class="dash-pill bad">${r.n} مخدوم مفيش تواصل</span>
        </div>`).join('')
      : `<div class="dash-empty">تمام ✅ كل المخدومين اتواصل معاهم</div>`;
    out += dashCard('🚫 مخدومين مفيش تواصل معاهم خالص', inner);
  }

  if (active.includes('deaconAtt')) {
    const { totalDays, counts } = computeDeaconAttendanceStats();
    if (!totalDays) {
      out += dashCard('✅ حضور الخدام', `<div class="dash-empty">مفيش أيام حضور متسجلة للخدام لسه</div>`);
    } else {
      const rows = names.map(d => ({ name: d, value: counts[d] || 0 })).sort((a, b) => b.value - a.value);
      const inner = rows.map((r, i) => {
        const pct = Math.round(r.value / totalDays * 100);
        const cls = pct >= 75 ? 'ok' : pct >= 40 ? 'warn' : 'bad';
        return `<div class="dash-li">
          <span class="dash-rank ${i < 3 ? 'top' + (i + 1) : ''}">${i + 1}</span>
          <span class="dash-li-name">${r.name}</span>
          <span class="dash-li-val">${r.value} من ${totalDays}</span>
          <span class="dash-pill ${cls}">${pct}%</span>
        </div>`;
      }).join('');
      out += dashCard(`✅ حضور الخدام (${totalDays} يوم)`, inner);
    }
  }

  if (active.includes('noDeacon')) {
    const inner = noDeaconList.length
      ? noDeaconList.map(s => `<div class="dash-li">
          <span class="dash-li-name">${s.name}</span>
          <span class="dash-phone">${studentPhonesLabel(s)}</span>
        </div>`).join('')
      : `<div class="dash-empty">تمام ✅ كل المخدومين ليهم خادم</div>`;
    out += dashCard('⚠️ مخدومين بدون خادم افتقاد', inner);
  }

  if (active.includes('list')) {
    const inner = names.slice().sort((a, b) => a.localeCompare(b, 'ar')).map(d => {
      const st = stats[d];
      const rows = st.students.length
        ? st.students.map(s => `<div class="dash-li">
            <span class="dash-li-name">${s.name}</span>
            <span class="dash-phone">${studentPhonesLabel(s)}</span>
          </div>`).join('')
        : `<div class="dash-empty">مفيش مخدومين متسجلين تحت اسمه</div>`;
      return `<div class="dash-sub-name">🙏 ${d} <span style="font-size:11px;color:var(--text-dim);font-weight:700">(${st.total})</span></div>${rows}`;
    }).join('');
    out += dashCard('📄 قائمة تفصيلية بالتليفونات', inner || `<div class="dash-empty">مفيش خدام</div>`);
  }

  return out || `<div class="dash-empty">مختارتش أي قسم — دوس ⚙️ واختار الأقسام</div>`;
}

window.openDashboard = () => {
  // خزّن اختيارات المستخدم لو الشاشة دي اتفتحت من مودال الإعدادات
  const boxes = document.querySelectorAll('#dash-options input[type=checkbox]');
  if (boxes.length) {
    saveDashPrefs(Array.from(boxes).filter(b => b.checked).map(b => b.value));
  }
  closeDashModal();
  if (!DEACONS.length) { showToast('مفيش خدام مسجلين للسنة دي', 'info'); return; }
  document.getElementById('dash-subtitle').textContent =
    `${state.activeGrade || 'كل السنوات'} · ${DEACONS.length} خادم · ${state.allStudents.length} مخدوم`;
  document.getElementById('dash-body').innerHTML = buildDashboardHTML();
  document.getElementById('dash-view').style.display = 'block';
  document.body.style.overflow = 'hidden';
};

window.closeDashboard = () => {
  document.getElementById('dash-view').style.display = 'none';
  document.body.style.overflow = '';
};

// نسخة فاتحة من الداشبورد للطباعة / الحفظ كـ PDF
function buildDashboardPrintDocument(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<title>داشبورد الخدام</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
  :root { --bg:#fff; --surface:#fff; --surface2:#f4f6fb; --border:#e2e6ef; --text:#222; --text-dim:#777;
          --accent:#4f8ef7; --accent2:#7c5cbf; --success:#2ecc71; --danger:#e74c3c; --radius:14px; --radius-sm:10px; }
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:'Cairo',Arial,sans-serif; background:#fff; color:var(--text); padding:18px; }
  h1 { font-size:18px; text-align:center; margin-bottom:4px; }
  .sub { font-size:12px; color:var(--text-dim); text-align:center; margin-bottom:18px; }
  .dash-card { background:#fff; border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-bottom:14px; page-break-inside:avoid; }
  .dash-card-title { font-size:15px; font-weight:800; margin-bottom:14px; }
  .dash-kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
  .dash-kpi { background:var(--surface2); border:1px solid var(--border); border-radius:var(--radius-sm); padding:12px 8px; text-align:center; }
  .dash-kpi-num { font-size:22px; font-weight:900; }
  .dash-kpi-lbl { font-size:10px; color:var(--text-dim); margin-top:4px; }
  .dash-bar-row { margin-bottom:11px; }
  .dash-bar-head { display:flex; align-items:center; gap:8px; font-size:12px; margin-bottom:4px; }
  .dash-rank { width:20px; height:20px; border-radius:6px; background:var(--surface2); display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:800; color:var(--text-dim); flex-shrink:0; }
  .dash-rank.top1 { background:#fdf3cf; color:#c49b06; }
  .dash-rank.top2 { background:#eef1f2; color:#8d9698; }
  .dash-rank.top3 { background:#fbe7d6; color:#c4600f; }
  .dash-bar-name { flex:1; font-weight:700; }
  .dash-bar-val { font-weight:800; }
  .dash-bar-track { height:7px; background:var(--surface2); border-radius:6px; overflow:hidden; }
  .dash-bar-fill { height:100%; border-radius:6px; }
  .dash-li { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:7px 0; border-bottom:1px solid #f0f0f0; font-size:12px; }
  .dash-li:last-child { border-bottom:none; }
  .dash-li-name { font-weight:700; flex:1; }
  .dash-li-val { font-size:11px; color:var(--text-dim); }
  .dash-phone { font-size:11px; color:#555; direction:ltr; }
  .dash-pill { font-size:10px; font-weight:700; padding:3px 8px; border-radius:20px; }
  .dash-pill.bad { background:#fdeceb; color:var(--danger); }
  .dash-pill.ok { background:#eafaf1; color:#27ae60; }
  .dash-pill.warn { background:#fef9e7; color:#c49b06; }
  .dash-sub-name { font-size:13px; font-weight:800; margin:12px 0 5px; padding-bottom:4px; border-bottom:1px solid var(--border); }
  .dash-empty { color:#999; font-size:11px; text-align:center; padding:8px 0; }
  @media print { @page { margin:11mm; } }
</style></head>
<body>
  <h1>📊 داشبورد الخدام</h1>
  <div class="sub">${state.activeGrade || 'كل السنوات'} · ${DEACONS.length} خادم · ${state.allStudents.length} مخدوم · ${new Date().toLocaleDateString('ar-EG', { day:'numeric', month:'long', year:'numeric' })}</div>
  ${bodyHtml}
</body></html>`;
}

window.printDashboard = () => {
  const win = window.open('', '_blank');
  if (!win) { showToast('امنع حظر النوافذ المنبثقة للموقع ده من إعدادات المتصفح', 'error'); return; }
  win.document.open();
  win.document.write(genderizeText(buildDashboardPrintDocument(buildDashboardHTML())));
  win.document.close();
  setTimeout(() => { try { win.focus(); win.print(); } catch (e) {} }, 500);
};
