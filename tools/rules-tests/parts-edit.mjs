// Firestore rules check, LOCAL emulators only (project "demo-stmina"): the parts of the programme (`parts_distribution`).
// A part needs only a title and a day; its type / servant are given later by EDITING it, which the manager of the class may do (and an
// admin), only on these fields, never the class or who created it.
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { addDoc, collection, connectFirestoreEmulator, doc, getFirestore, serverTimestamp, updateDoc } from 'firebase/firestore';
import { randomBytes } from 'node:crypto';

const PROJECT = 'demo-stmina';
const app = initializeApp({ apiKey: 'demo-key', projectId: PROJECT, authDomain: 'localhost' });
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

const toValue = (v) => {
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
};
// the emulator accepts the "owner" token as a bypass of the rules (like the console)
const seed = async (path, fields) => {
  const res = await fetch(`http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/${path}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toValue(v)])) }),
  });
  if (!res.ok) throw new Error(`seed failed: ${res.status} ${await res.text()}`);
};

const creds = {};
const uids = {};
const makeUser = async (label, fields) => {
  const email = `${label}.${randomBytes(3).toString('hex')}@example.test`;
  const password = randomBytes(9).toString('base64url');
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  creds[label] = { email, password };
  uids[label] = cred.user.uid;
  await seed(`users/${cred.user.uid}`, { status: 'approved', name: label, ...fields });
};
const as = async (label) => { await signOut(auth); await signInWithEmailAndPassword(auth, creds[label].email, creds[label].password); };

await makeUser('admin', { role: 'admin' });
await makeUser('lead4', { role: 'deacon', isLead: true, grade: 'g4' });
await makeUser('lead5', { role: 'deacon', isLead: true, grade: 'g5' });
await makeUser('plain', { role: 'deacon', grade: 'g4' });
await seed('parts_distribution/part1', { grade: 'g4', type: '', title: 'ترنيمة', date: '2030-10-18', deaconName: '', section: 'boys', createdByUid: 'someone' });

const results = [];
const check = async (name, shouldBeAllowed, action) => {
  let outcome = 'allowed', detail = '';
  try { await action(); } catch (e) { outcome = 'DENIED'; detail = `${e.code || ''}`.trim(); }
  results.push({ name, expected: shouldBeAllowed ? 'allowed' : 'denied', outcome, ok: (outcome === 'allowed') === shouldBeAllowed, detail });
};
const part = () => doc(db, 'parts_distribution', 'part1');
const give = { type: 'الدرس', deaconName: 'مينا', deaconId: 'p1', updatedAt: serverTimestamp() };

await as('lead4');
await check('1. the manager of the class creates a part with only a title and a day (no type, no servant)', true, () =>
  addDoc(collection(db, 'parts_distribution'), { grade: 'g4', type: '', deaconName: '', deaconId: null, title: 'جديدة', date: '2030-10-19', section: 'boys', createdByUid: uids.lead4, createdAt: serverTimestamp() }));
await check('2. the manager of the class gives a part its type and servant later (edit)', true, () => updateDoc(part(), give));
await check('3. and changes its day and title', true, () => updateDoc(part(), { title: 'اتغيرت', date: '2030-10-25', updatedAt: serverTimestamp() }));
await check('4. must stay forbidden: move the part to another class', false, () => updateDoc(part(), { grade: 'g5' }));
await check('5. must stay forbidden: change who created it', false, () => updateDoc(part(), { createdByUid: 'me' }));
await check('6. must stay forbidden: change the section', false, () => updateDoc(part(), { section: 'girls' }));

await as('lead5');
await check('7. must stay forbidden: the manager of ANOTHER class edits the part', false, () => updateDoc(part(), give));

await as('plain');
await check('8. must stay forbidden: a servant who is not a manager edits the part', false, () => updateDoc(part(), give));

await as('admin');
await check('9. an admin edits any part', true, () => updateDoc(part(), give));
await check('10. an admin renames the servant on a part (the admin screen rename keeps working)', true, () => updateDoc(part(), { deaconName: 'مينا (جديد)' }));
await check('11. must stay forbidden even for an admin: other fields', false, () => updateDoc(part(), { createdByName: 'x' }));

for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}\n      expected ${r.expected}, got ${r.outcome}${r.detail ? `  -> ${r.detail}` : ''}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} behave as the rules should`);
process.exit(process.env.EXPECT === 'new' && failed ? 1 : 0);
