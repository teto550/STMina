const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

// كل ما حد (أدمن) يضيف فقرة جديدة، الدالة دي بتشتغل تلقائيًا
// وبتبعت إشعار push لكل الخدام اللي مسجلين توكن جهازهم، ما عدا اللي ضاف الفقرة نفسه.
exports.notifyNewParagraph = onDocumentCreated('paragraphs/{id}', async (event) => {
  const p  = event.data.data();
  const db = getFirestore();

  const usersSnap = await db.collection('users').get();
  let tokens = [];
  usersSnap.forEach(userDoc => {
    const u = userDoc.data();
    if (u.name === p.createdBy) return; // متبقاش تبعت للي هو نفسه اللي ضاف الفقرة
    if (Array.isArray(u.fcmTokens)) tokens = tokens.concat(u.fcmTokens);
  });

  if (!tokens.length) return null;

  const message = {
    notification: {
      title: 'فقرة جديدة: ' + (p.type || ''),
      body: 'الخادم: ' + (p.deacon || '') + (p.notes ? ' — ' + p.notes : '')
    },
    tokens
  };

  const res = await getMessaging().sendEachForMulticast(message);

  // تنضيف أي توكينز بقت غير صالحة (مثلاً حد مسح بيانات المتصفح)
  const invalid = [];
  res.responses.forEach((r, i) => { if (!r.success) invalid.push(tokens[i]); });
  if (invalid.length) {
    const batch = db.batch();
    usersSnap.forEach(userDoc => {
      const u = userDoc.data();
      if (Array.isArray(u.fcmTokens) && u.fcmTokens.some(t => invalid.includes(t))) {
        batch.update(userDoc.ref, { fcmTokens: u.fcmTokens.filter(t => !invalid.includes(t)) });
      }
    });
    await batch.commit();
  }

  return null;
});
