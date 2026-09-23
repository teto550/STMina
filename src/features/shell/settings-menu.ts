// @ts-nocheck

// ===== SETTINGS MENU (الترس فوق: ملف المخدوم + تشغيل/إلغاء الإشعارات) =====
window.toggleSettingsMenu = (e) => {
  if (e) e.stopPropagation();
  const m = document.getElementById('settings-menu');
  if (!m) return;
  m.style.display = (m.style.display === 'none' || !m.style.display) ? 'block' : 'none';
};

window.closeSettingsMenu = () => {
  const m = document.getElementById('settings-menu');
  if (m) m.style.display = 'none';
};

document.addEventListener('click', (e) => {
  const m = document.getElementById('settings-menu');
  const gearBtn = document.getElementById('settings-gear-btn');
  if (!m || m.style.display === 'none') return;
  if (m.contains(e.target) || (gearBtn && gearBtn.contains(e.target))) return;
  m.style.display = 'none';
});
