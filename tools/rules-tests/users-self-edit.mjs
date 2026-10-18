// Firestore rules check, run against the LOCAL emulators only (project "demo-stmina": no connection to the real project):
//   npm run test:rules
// A dummy servant signs up in the Auth emulator and writes its account document exactly like the app does (src/api/auth.ts), an
// "admin" approves it (emulator bypass), then the servant edits their own document the way the app does:
//   - the "complete your data" page (src/features/auth/profile-complete.ts), the settings preference, the servant photo
// and tries the edits that must stay forbidden (become a lead / admin, approve themselves, take access).
// Prints one line per check. With EXPECT=new it exits with 1 when a check does not behave as the fixed rules should.
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getFirestore, setDoc, updateDoc } from 'firebase/firestore';
import { randomBytes } from 'node:crypto';

const PROJECT = 'demo-stmina';
const app = initializeApp({ apiKey: 'demo-key', projectId: PROJECT, authDomain: 'localhost' });
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

const email = `dummy.${randomBytes(3).toString('hex')}@example.test`;
const password = randomBytes(9).toString('base64url'); // a throw-away value for the emulator only
const cred = await createUserWithEmailAndPassword(auth, email, password);
const uid = cred.user.uid;
const ref = doc(db, 'users', uid);

// what registerServant() writes: no isLead / isPhaseLead / phaseGrades (the create rule forbids them); address and dob left empty
const registration = {
  name: 'Dummy Servant', email, grade: 'سنة رابعة ابتدائي', role: 'deacon', status: 'pending',
  phones: ['01000000000'], phone: '01000000000', address: '', dob: '', section: 'boys', gender: 'male',
  graduated: false, college: '', university: '',
};

// the emulator accepts this "owner" token as a bypass of the rules (that is how an admin / the console writes)
const adminPatch = async (fields) => {
  const mask = Object.keys(fields).map((f) => `updateMask.fieldPaths=${f}`).join('&');
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { stringValue: v }])) };
  const res = await fetch(`http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}?${mask}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`admin patch failed: ${res.status} ${await res.text()}`);
};

const results = [];
const check = async (name, shouldBeAllowed, action) => {
  let outcome = 'allowed';
  let detail = '';
  try {
    await action();
  } catch (e) {
    outcome = 'DENIED';
    detail = `${e.code || ''} ${String(e.message || '').split('\n')[0]}`.trim();
  }
  const ok = (outcome === 'allowed') === shouldBeAllowed;
  results.push({ name, expected: shouldBeAllowed ? 'allowed' : 'denied', outcome, ok, detail });
};

await check('1. sign-up writes the account document (create)', true, () => setDoc(ref, registration));
await adminPatch({ status: 'approved' }); // the admin approves the request
await check('2. "complete your data" page: phones, address, dob, study (setDoc merge)', true, () =>
  setDoc(ref, { phones: ['01000000000'], phone: '01000000000', address: 'Fayoum', dob: '2000-01-01', graduated: false, college: 'Eng', university: 'Cairo' }, { merge: true }));
await check('3. settings: save a preference (updateDoc preferences)', true, () => updateDoc(ref, { preferences: { cropPhotos: true, focusSearchAfterMark: true } }));
await check('4. own photo (updateDoc photo)', true, () => updateDoc(ref, { photo: 'data:image/jpeg;base64,AAAA' }));
await check('5. must stay forbidden: make myself a lead (isLead: true)', false, () => updateDoc(ref, { isLead: true }));
await check('6. must stay forbidden: make myself admin (role)', false, () => updateDoc(ref, { role: 'admin' }));
await check('7. must stay forbidden: change my own status', false, () => updateDoc(ref, { status: 'rejected' }));
await check('8. must stay forbidden: give myself access (admin snapshot)', false, () => updateDoc(ref, { access: { admin: true, cells: [], sections: [] } }));
await check('9. must stay forbidden: make myself a phase lead', false, () => updateDoc(ref, { isPhaseLead: true }));

for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}\n      expected ${r.expected}, got ${r.outcome}${r.detail ? `  -> ${r.detail}` : ''}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} behave as the fixed rules should`);
process.exit(process.env.EXPECT === 'new' && failed ? 1 : 0);
