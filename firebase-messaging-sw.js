// firebase-messaging-sw.js
// ده الملف المسؤول عن استقبال الإشعارات لما الموقع يكون مقفول أو في الخلفية.
// لازم يترفع في نفس فولدر index.html بالظبط (نفس مكان الموقع على GitHub Pages).

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyClTS9x2lqMoeuTbmC7Q7vl7zB3c5p25k8",
  authDomain: "attends-39e5b.firebaseapp.com",
  projectId: "attends-39e5b",
  storageBucket: "attends-39e5b.firebasestorage.app",
  messagingSenderId: "976453525685",
  appId: "1:976453525685:web:60b7207000ee20163d9efc"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'فقرة جديدة';
  const body  = (payload.notification && payload.notification.body)  || '';
  self.registration.showNotification(title, {
    body,
    icon: 'icon-192.png',
    dir: 'rtl'
  });
});
