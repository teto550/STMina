// @ts-nocheck

// ===== حقول تليفون متعددة (فورم التسجيل + استكمال البيانات + تعديل ملف الخادم) =====
function phoneRowHtml(value) {
  const v = (value || '').replace(/"/g, '&quot;');
  return `<div class="phone-row" style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
    <input type="tel" class="field-input phone-input" dir="ltr" placeholder="01xxxxxxxxx" value="${v}" style="margin-bottom:0;flex:1">
    <button type="button" onclick="removePhoneRow(this)" style="background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.25);border-radius:8px;color:var(--danger);width:36px;height:36px;flex-shrink:0;cursor:pointer;font-size:16px">✕</button>
  </div>`;
}

function updatePhoneRemoveButtons(cont) {
  const rows = cont.querySelectorAll('.phone-row');
  rows.forEach(r => {
    const btn = r.querySelector('button');
    if (btn) btn.style.visibility = rows.length > 1 ? 'visible' : 'hidden';
  });
}

// بيرسم كل صفوف التليفونات (يُستخدم لما نفتح فورم فيه بيانات جاهزة، زي تعديل ملف الخادم)
window.renderPhoneRows = function(containerId, values) {
  const cont = document.getElementById(containerId);
  if (!cont) return;
  const list = (values && values.length) ? values : [''];
  cont.innerHTML = list.map(phoneRowHtml).join('');
  updatePhoneRemoveButtons(cont);
};

// زرار "+ إضافة رقم تليفون تاني"
window.addPhoneRow = function(containerId) {
  const cont = document.getElementById(containerId);
  if (!cont) return;
  cont.insertAdjacentHTML('beforeend', phoneRowHtml(''));
  updatePhoneRemoveButtons(cont);
  const inputs = cont.querySelectorAll('.phone-input');
  inputs[inputs.length - 1].focus();
};

window.removePhoneRow = function(btn) {
  const cont = btn.closest('.phone-list');
  const row = btn.closest('.phone-row');
  if (row) row.remove();
  if (cont && !cont.querySelector('.phone-row')) cont.insertAdjacentHTML('beforeend', phoneRowHtml(''));
  if (cont) updatePhoneRemoveButtons(cont);
};

// بيجمع كل أرقام التليفونات المكتوبة في فورم معيّن (وبيتجاهل الفاضي)
window.getPhoneValues = function(containerId) {
  const cont = document.getElementById(containerId);
  if (!cont) return [];
  return Array.from(cont.querySelectorAll('.phone-input'))
    .map(i => i.value.trim())
    .filter(Boolean);
};
