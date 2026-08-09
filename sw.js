// ===== خدمة ابتدائي — Service Worker =====
// كل ما تعدّل حاجة في index.html وتنزلها على GitHub Pages، غيّر رقم النسخة
// دي (CACHE_VERSION) عشان المتصفح يجيب النسخة الجديدة بدل القديمة المخزنة.
const CACHE_VERSION = 'v3';
const CACHE_NAME = `sanmina-kids-${CACHE_VERSION}`;

// الملفات الأساسية اللي لازم تتخزن عشان الموقع يفتح بالكامل من غير نت
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js',
];

// ===== INSTALL: خزّن الـ app shell =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(err => console.warn('SW install cache error:', err))
  );
  self.skipWaiting();
});

// ===== ACTIVATE: امسح أي نسخ كاش قديمة =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ===== FETCH =====
// - صفحة الموقع (index.html / navigation): جرّب النت الأول (عشان تجيب آخر
//   تحديث)، ولو فشل (أوفلاين) رجّع النسخة المخزنة — كده الموقع يفتح حتى
//   من غير نت خالص.
// - Firestore / Firebase Auth (googleapis.com, firestore.googleapis.com...):
//   سيبها تروح للنت زي ما هي، الـ SDK نفسه بيدير الأوفلاين والمزامنة.
// - باقي الملفات الثابتة (JS/CSS/خطوط/أيقونات): كاش أول، ولو مش موجودة
//   هات من النت وخزنها لمرة جاية.
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // متلمسش طلبات Firebase/Firestore الفعلية (بيانات، مش ملفات) — سيبها للـ SDK
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('googleapis.com') && !url.pathname.includes('firebasejs') ||
      url.hostname.includes('identitytoolkit')) {
    return;
  }

  if (req.mode === 'navigate' || (req.method === 'GET' && url.pathname.endsWith('index.html'))) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
