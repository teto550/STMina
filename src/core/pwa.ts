// @ts-nocheck
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  setTimeout(() => {
    document.getElementById('install-banner').style.display = 'block';
  }, 3000);
});

document.getElementById('install-btn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById('install-banner').style.display = 'none';
});

window.addEventListener('appinstalled', () => {
  document.getElementById('install-banner').style.display = 'none';
});
