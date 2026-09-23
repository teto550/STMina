// @ts-nocheck
import { state } from '@/core/state';
import { filteredStudents } from '@/features/students/students';

// ===== PRINT ID CARD (avatar + name + class + reward stars) =====
const CARD_PALETTE = ['#4f8ef7', '#f39c12', '#2ecc71', '#ff6b9d', '#00b4d8', '#7c5cbf'];

const APP_LOGO_URL = new URL('icon-192.png', document.baseURI).href;

const AVATAR_URLS = Array.from({ length: 10 }, (_, i) => new URL(`avatar${i + 1}.png`, document.baseURI).href);

function randomAvatar() {
  return AVATAR_URLS[Math.floor(Math.random() * AVATAR_URLS.length)];
}

function cardColorFor(s) {
  let sum = 0;
  for (const ch of (s.name || '')) sum += ch.charCodeAt(0);
  return CARD_PALETTE[sum % CARD_PALETTE.length];
}

// نجمة صفرا فاضية (لسه ما اتكسبتش) أو نجمة صفرا مليانة (اتكسبت) — حسب عدد نجوم المخدوم
function starIcon(filled) {
  return `<svg class="pstar" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polygon points="12,2 14.9,8.6 22,9.3 16.5,14.1 18.2,21 12,17.3 5.8,21 7.5,14.1 2,9.3 9.1,8.6" fill="${filled ? '#f1c40f' : 'none'}" stroke="#f1c40f" stroke-width="1.4"/></svg>`;
}

function buildIdCardHTML(s) {
  const photoUrl = randomAvatar();
  const color = cardColorFor(s);
  const count = s.starCount || 0;
  const starsLeft  = `<div class="pstars">${starIcon(count >= 1)}${starIcon(count >= 2)}${starIcon(count >= 3)}</div>`;
  const starsRight = `<div class="pstars">${starIcon(count >= 4)}${starIcon(count >= 5)}${starIcon(count >= 6)}</div>`;
  return `<div class="print-card">
    <div class="pc-head" style="background:${color}">
      <img class="pc-logo" src="${APP_LOGO_URL}">
      <span class="pc-headtitle">خدمة ابتدائي</span>
    </div>
    <div class="pc-body">
      <img class="pphoto" style="border-color:${color}" src="${photoUrl}">
      ${starsLeft}
      <div class="pinfo">
        <div class="pname">${s.name}</div>
        ${s.grade ? `<div class="pgrade" style="color:${color}">${s.grade}</div>` : ''}
      </div>
      ${starsRight}
    </div>
  </div>`;
}

// Build a fully standalone HTML document (own styles, own images) so it can be
// printed from a real browser tab — printing the app's own page directly fails
// when the app is running as an installed home-screen PWA on iOS/Android.
function buildPrintDocument(cardsHtml) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<title>كروت المخدومين</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Cairo',Arial,sans-serif; background:#fff; }
  .grid { display:grid; grid-template-columns:repeat(2,1fr); gap:18px; padding:18px; }
  .print-card { border-radius:18px; overflow:hidden; page-break-inside:avoid; background:#fff; border:1px solid #eee; box-shadow:0 2px 8px rgba(0,0,0,0.08); -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .pc-head { display:flex; align-items:center; gap:8px; padding:8px 12px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .pc-logo { width:26px; height:26px; border-radius:8px; object-fit:cover; box-shadow:0 1px 3px rgba(0,0,0,0.25); }
  .pc-headtitle { color:#fff; font-size:12px; font-weight:700; }
  .pc-body { display:flex; align-items:center; gap:4px; padding:14px 10px; }
  .pphoto { width:70px; height:70px; border-radius:50%; object-fit:cover; flex-shrink:0; border:3px solid #ddd; }
  .pinfo { flex-shrink:0; text-align:center; }
  .pstars { flex:1; display:flex; align-items:center; min-width:0; }
  .pstar { flex:1 1 0; width:100%; height:34px; }
  .pname { font-size:15px; font-weight:800; color:#222; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px; }
  .pgrade { display:inline-block; margin-top:5px; background:#f1f4ff; font-size:11px; font-weight:700; padding:3px 10px; border-radius:20px; }
  @media print { @page { margin:10mm; } }
</style></head>
<body>
  <div class="grid">${cardsHtml}</div>
</body></html>`;
}

function openPrintWindow(cardsHtml) {
  const win = window.open('', '_blank');
  if (!win) {
    showToast('امنع حظر النوافذ المنبثقة للموقع ده من إعدادات المتصفح', 'error');
    return;
  }
  win.document.open();
  win.document.write(buildPrintDocument(cardsHtml));
  win.document.close();

  const triggerPrint = () => { try { win.focus(); win.print(); } catch (e) {} };
  const imgs = () => Array.from(win.document.images || []);
  const waitAndPrint = () => {
    const list = imgs();
    if (!list.length) { setTimeout(triggerPrint, 250); return; }
    let done = 0;
    const check = () => { done++; if (done >= list.length) setTimeout(triggerPrint, 200); };
    list.forEach(img => { if (img.complete) check(); else { img.onload = check; img.onerror = check; } });
    setTimeout(triggerPrint, 3000); // hard fallback so it never hangs
  };
  setTimeout(waitAndPrint, 50);
}

window.printOneCard = (id) => {
  const s = state.allStudents.find(x => x.id === id);
  if (!s) return;
  openPrintWindow(buildIdCardHTML(s));
};

window.printAllCards = () => {
  const list = filteredStudents(state.currentStuGrade);
  if (!list.length) { showToast('مفيش مخدومين للطباعة', 'info'); return; }
  openPrintWindow(list.map(buildIdCardHTML).join(''));
};
