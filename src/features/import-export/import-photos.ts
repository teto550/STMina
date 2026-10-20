// @ts-nocheck
import { state } from '@/core/state';
import { ensureXLSXLoaded } from '@/features/import-export/import-attendance';
import { logActivity } from '@/core/presence';
import { loadStudents } from '@/features/students/students';
import { saveKidPhotoLinks } from '@/api/student-photo-links';
import { isPermissionDenied } from '@/api/errors';
import { buildPhotoPlan, parsePhotoSheet } from '@/core/photo-links';

// ===== رفع لينكات الصور (أدمن) — اللينك بيتسجل مرة واحدة في ملف المخدوم (students/{id}.photoLink) وبعد كده ثابت =====
// المطابقة بالـ ID بالظبط (students/{id}.kidId = SERIAL_NUMBER في الشيت). أي شك بيتعرض عليك، ومفيش حاجة بتتكتب من غير تأكيدك.
let rows = null, kids = null, plan = null;
const approved = new Set();   // IDs اللي قبلت فيها حالة الشك

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const short = (u) => (u.length > 70 ? u.slice(0, 67) + '…' : u);

window.openPhotoLinksModal = () => {
  if (state.currentUserRole !== 'admin') {
    return;
  }
  rows = null; kids = null; plan = null; approved.clear();
  $('plinks-file-input').value = '';
  $('plinks-review').style.display = 'none';
  const st = $('plinks-status'); st.style.display = 'none'; st.textContent = '';
  const btn = $('plinks-commit-btn'); btn.disabled = true; btn.textContent = '🔒 تثبيت نهائي';
  $('plinks-modal').style.display = 'block';
  document.body.style.overflow = 'hidden';
};

window.closePhotoLinksModal = () => {
  $('plinks-modal').style.display = 'none';
  document.body.style.overflow = '';
  rows = null; kids = null; plan = null;
};

function reportText(p) {
  const L = [];
  L.push(`📄 صفوف الشيت: ${p.sheetRows}`);
  L.push('');
  L.push(`✅ هيتكتب لهم لينك الصورة: ${p.writes.length}`);
  if (p.same) {
    L.push(`   • عندهم نفس اللينك أصلاً (مش هيتلمسوا): ${p.same}`);
  }
  if (p.lockedDifferent.length) {
    L.push('');
    L.push(`🔒 عندهم لينك مختلف متسجل قبل كده — ثابت ومش هيتغير (اتسابوا): ${p.lockedDifferent.length}`);
    p.lockedDifferent.slice(0, 15).forEach((x) => L.push(`   • ${x.name} (ID ${x.kidId})`));
  }
  const pend = p.doubtful.filter((d) => d.approvable).length, hard = p.doubtful.filter((d) => !d.approvable);
  if (p.doubtful.length) {
    L.push('');
    L.push(`⚠️ فيها شك (مش هتتكتب غير لما تقبلها من القايمة): ${pend}`);
  }
  if (hard.length) {
    L.push(`⛔ ID مكرر في الشيت بلينكين مختلفين (مش هيتكتب أبدًا لحد ما تصلح الشيت): ${hard.length}`);
    hard.slice(0, 15).forEach((d) => L.push(`   • ID ${d.kidId}`));
  }
  if (p.duplicateKids.length) {
    L.push('');
    L.push(`⛔ نفس الـ ID على أكتر من مخدوم في البرنامج (اتسابوا): ${p.duplicateKids.length}`);
    p.duplicateKids.slice(0, 15).forEach((d) => L.push(`   • ID ${d.kidId}: ${d.names.join(' / ')}`));
  }
  L.push('');
  L.push(p.notFound.length ? `ℹ️ IDs في الشيت مش في الفصل ده (غالبًا فصول تانية): ${p.notFound.length}\n   ${p.notFound.slice(0, 40).join('، ')}${p.notFound.length > 40 ? ' …' : ''}` : 'ℹ️ IDs في الشيت مش في الفصل ده: مفيش');
  if (p.badRows.length) {
    L.push('');
    L.push(`🚫 صفوف غلط في الشيت (اتتجاهلت): ${p.badRows.length}`);
    p.badRows.slice(0, 15).forEach((b) => L.push(`   • سطر ${b.line}: ${b.reason} (ID: ${b.kidId || '—'})`));
  }
  return L.join('\n');
}

function renderReview() {
  const box = $('plinks-review'), list = $('plinks-review-list');
  const all = window.__plinksDoubts || [];
  if (!all.length) { box.style.display = 'none'; list.innerHTML = ''; return; }
  box.style.display = 'block';
  // نفس الحالة + نفس اللينك = مجموعة واحدة بعلامة واحدة (مثلاً 48 مخدوم على نفس الصورة الافتراضية)
  const groups = new Map();
  all.forEach((d) => { const k = d.reason + '|' + d.url; (groups.get(k) || groups.set(k, []).get(k)).push(d); });
  window.__plinksGroups = [...groups.values()];
  list.innerHTML = window.__plinksGroups.map((g, i) => {
    const on = g.every((d) => approved.has(d.kidId));
    return `<label style="display:flex;gap:8px;align-items:flex-start;border-top:1px solid var(--border);padding:8px 0;cursor:pointer;font-size:12px;line-height:1.7">
      <input type="checkbox" ${on ? 'checked' : ''} onchange="plinksToggleGroup(${i}, this.checked)" style="margin-top:4px">
      <div style="min-width:0"><span style="color:var(--warning);font-weight:700">${esc(g[0].detail)}</span> — ${g.length} مخدوم<br>
      <span dir="ltr" style="color:var(--text-dim);word-break:break-all">${esc(short(g[0].url))}</span><br>
      <span style="color:var(--text-dim)">IDs: ${esc(g.slice(0, 8).map((d) => d.kidId).join('، '))}${g.length > 8 ? ' …' : ''}</span></div></label>`;
  }).join('');
}

function recompute() {
  plan = buildPhotoPlan(rows, kids, approved);
  const st = $('plinks-status'), btn = $('plinks-commit-btn');
  st.style.display = 'block';
  st.textContent = `🎯 الفصل: ${state.activeGrade || 'كل المخدومين المحمّلين'} — ${kids.length} مخدوم عندهم ID\n🔍 معاينة (لسه مفيش حاجة اتكتبت):\n\n` + reportText(plan);
  const cnt = $('plinks-review-count');
  if (cnt) {
    cnt.textContent = `مقبول: ${[...approved].length} مخدوم من ${(window.__plinksDoubts || []).length}`;
  }
  btn.disabled = !plan.writes.length;
  btn.textContent = plan.writes.length ? `🔒 تثبيت نهائي (${plan.writes.length} لينك)` : 'مفيش حاجة جديدة تتثبت';
}

window.plinksToggleGroup = (i, on) => { (window.__plinksGroups[i] || []).forEach((d) => (on ? approved.add(d.kidId) : approved.delete(d.kidId))); recompute(); };

window.onPhotoLinksFileChange = async () => {
  const input = $('plinks-file-input'), st = $('plinks-status'), btn = $('plinks-commit-btn');
  rows = null; kids = null; plan = null; approved.clear(); btn.disabled = true; btn.textContent = '🔒 تثبيت نهائي';
  $('plinks-review').style.display = 'none';
  if (!input.files.length) {
    return;
  }
  if (!navigator.onLine) { showToast('محتاج نت عشان تحلل الملف', 'error'); return; }
  st.style.display = 'block'; st.textContent = '⏳ بقرا الملف وبدوّر على المخدومين بالـ ID…';
  try {
    await ensureXLSXLoaded();
    const wb = XLSX.read(await input.files[0].arrayBuffer(), { type: 'array' });
    const parsed = parsePhotoSheet(wb.SheetNames.map((n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null })));
    if (!parsed || !parsed.rows.length) { st.textContent = '❌ مالقيتش عمود SERIAL_NUMBER وعمود AVATAR_FULL_URL في الملف ده.'; return; }
    rows = parsed.rows;
    // الفصل المفتوح بس: المخدومين اللي اتحمّلوا أصلاً في البرنامج، من غير أي قراءة زيادة من Firestore
    await loadStudents();
    kids = (state.allStudents || []).filter((s) => s.kidId != null && String(s.kidId).trim() !== '');
    st.textContent = `🎯 الفصل: ${state.activeGrade || 'كل المخدومين المحمّلين'} — ${kids.length} مخدوم عندهم ID`;
    window.__plinksDoubts = buildPhotoPlan(rows, kids, new Set()).doubtful.filter((d) => d.approvable);
    renderReview();
    recompute();
  } catch (e) {
    console.error(e);
    st.textContent = '❌ تعذّرت قراءة الملف أو تحميل البيانات: ' + (e.message || e);
  }
};

window.commitPhotoLinks = async () => {
  if (state.currentUserRole !== 'admin' || !plan || !plan.writes.length) {
    return;
  }
  if (!navigator.onLine) { showToast('محتاج نت للتثبيت', 'error'); return; }
  if (!confirm(`هيتم تثبيت ${plan.writes.length} لينك صورة.\n\nاللينك هيبقى ثابت ومحدش (حتى الأدمن) هينفع يغيره من التطبيق بعد كده.\nمتأكد إن المعاينة سليمة؟`)) {
    return;
  }
  const st = $('plinks-status'), btn = $('plinks-commit-btn');
  const log = (t) => { st.textContent += '\n' + t; st.scrollTop = st.scrollHeight; };
  btn.disabled = true; btn.textContent = 'جاري التثبيت…';
  try {
    await saveKidPhotoLinks(plan.writes, (done, total) => log(`   ✓ اتثبّت ${done}/${total}`));
    logActivity('رفع لينكات صور المخدومين', `${plan.writes.length} لينك`);
    log('⏳ تحديث قائمة المخدومين…');
    await loadStudents({ force: true });
    log('🎉 تمّ. لينكات الصور بقت ثابتة.');
    btn.textContent = '✔ تم'; plan = null;
  } catch (e) {
    console.error(e);
    log(isPermissionDenied(e) ? '⛔ Firestore رفض الكتابة. اتأكد إن قواعد photoLink اتنشرت (firebase deploy --only firestore:rules) وإنك أدمن.' : '❌ حصل خطأ: ' + (e.message || e));
    log('ارفع الملف تاني — اللي اتثبّت قبل كده مش هيتكرر.');
    btn.textContent = '🔒 تثبيت نهائي';
  }
};

// ===== عرض الصورة جوه البرنامج بس (من غير لينك خارجي) =====
window.openStudentPhotoLink = (id) => {
  const s = (state.allStudents || []).find((x) => x.id === id);
  if (!s || !s.photoLink) {
    return;
  }
  const img = $('plink-view-img'), msg = $('plink-view-msg');
  msg.textContent = 'جاري تحميل الصورة…';
  img.onload = () => { msg.textContent = ''; };
  img.onerror = () => { msg.textContent = 'مقدرناش نفتح الصورة (اللينك ممكن يكون اتمسح أو مفيش نت).'; };
  img.referrerPolicy = 'no-referrer';
  img.src = s.photoLink;
  $('plink-view-name').textContent = s.name || '';
  $('plink-view-modal').style.display = 'flex';
};

window.closeStudentPhotoLink = () => {
  $('plink-view-modal').style.display = 'none';
  $('plink-view-img').removeAttribute('src');
};
