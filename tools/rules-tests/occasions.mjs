// Firestore rules check, LOCAL emulators only (project "demo-stmina"): the occasions (`occasions/{id}` = { title, date }), one list for the
// whole app. Every approved account reads it (one year at a time); only an admin writes.
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { addDoc, collection, connectFirestoreEmulator, deleteDoc, doc, getDocs, getFirestore, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { randomBytes } from 'node:crypto';

const PROJECT = 'demo-stmina';
const app = initializeApp({ apiKey: 'demo-key', projectId: PROJECT, authDomain: 'localhost' });
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

const toValue = (v) => (typeof v === 'string' ? { stringValue: v } : typeof v === 'boolean' ? { booleanValue: v } : { stringValue: String(v) });
// the emulator accepts the "owner" token as a bypass of the rules (like the console)
const seed = async (path, fields) => {
  const res = await fetch(`http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/${path}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toValue(v)])) }),
  });
  if (!res.ok) throw new Error(`seed failed: ${res.status} ${await res.text()}`);
};
const creds = {};
const makeUser = async (label, fields) => {
  const email = `${label}.${randomBytes(3).toString('hex')}@example.test`;
  const password = randomBytes(9).toString('base64url');
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  creds[label] = { email, password };
  await seed(`users/${cred.user.uid}`, fields);
};
const as = async (label) => { await signOut(auth); await signInWithEmailAndPassword(auth, creds[label].email, creds[label].password); };

await makeUser('admin', { role: 'admin', status: 'approved', name: 'admin' });
await makeUser('lead', { role: 'deacon', status: 'approved', isLead: true, grade: 'g4', name: 'lead' });
await makeUser('servant', { role: 'deacon', status: 'approved', name: 'servant' });
await makeUser('pending', { role: 'deacon', status: 'pending', name: 'pending' });
await seed('occasions/o1', { title: 'عيد الميلاد', date: '2027-01-07' });
await seed('occasions/o2', { title: 'صوم الميلاد', date: '2026-11-25' });

const results = [];
const check = async (name, shouldBeAllowed, action) => {
  let outcome = 'allowed', detail = '';
  try { await action(); } catch (e) { outcome = 'DENIED'; detail = `${e.code || ''}`.trim(); }
  results.push({ name, expected: shouldBeAllowed ? 'allowed' : 'denied', outcome, ok: (outcome === 'allowed') === shouldBeAllowed, detail });
};
const year = (y) => query(collection(db, 'occasions'), where('date', '>=', `${y}-01-01`), where('date', '<=', `${y}-12-31`), orderBy('date'));
const o1 = () => doc(db, 'occasions', 'o1');

await as('servant');
await check('1. any approved servant reads one year of occasions (a range on the date)', true, async () => {
  const snap = await getDocs(year(2027));
  if (snap.size !== 1) throw new Error(`expected 1, got ${snap.size}`);
});
await check('2. must stay forbidden: a servant adds an occasion', false, () => addDoc(collection(db, 'occasions'), { title: 'x', date: '2027-02-01' }));
await check('3. must stay forbidden: a servant edits one', false, () => updateDoc(o1(), { title: 'y' }));
await check('4. must stay forbidden: a servant deletes one', false, () => deleteDoc(o1()));

await as('lead');
await check('5. must stay forbidden: the manager of a class does not manage the app-wide list', false, () => addDoc(collection(db, 'occasions'), { title: 'x', date: '2027-02-01' }));

await as('pending');
await check('6. must stay forbidden: an account that is not approved reads nothing', false, () => getDocs(year(2027)));

await as('admin');
await check('7. an admin adds an occasion', true, () => addDoc(collection(db, 'occasions'), { title: 'عيد الغطاس', date: '2027-01-19' }));
await check('8. several occasions on the same day are fine', true, () => addDoc(collection(db, 'occasions'), { title: 'عيد تاني', date: '2027-01-19' }));
await check('9. an admin edits one (name and day)', true, () => updateDoc(o1(), { title: 'عيد الميلاد المجيد', date: '2027-01-08' }));
await check('10. must stay forbidden: an occasion without a name', false, () => addDoc(collection(db, 'occasions'), { title: '', date: '2027-02-01' }));
await check('11. must stay forbidden: a day that is not YYYY-MM-DD', false, () => addDoc(collection(db, 'occasions'), { title: 'x', date: '7 يناير' }));
await check('12. must stay forbidden: extra fields', false, () => addDoc(collection(db, 'occasions'), { title: 'x', date: '2027-02-01', secret: 'y' }));
await check('13. an admin deletes one', true, () => deleteDoc(doc(db, 'occasions', 'o2')));

for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}\n      expected ${r.expected}, got ${r.outcome}${r.detail ? `  -> ${r.detail}` : ''}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} behave as the rules should`);
process.exit(process.env.EXPECT === 'new' && failed ? 1 : 0);
