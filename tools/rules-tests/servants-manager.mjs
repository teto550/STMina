// Firestore rules check, LOCAL emulators only (project "demo-stmina"): a person whose role manages the servants of a section
// (`users.access.servants`) may read and decide the pending join requests of THAT section, and nothing more.
//   npm run test:rules      (see package.json; the check below prints one PASS / FAIL line each; EXPECT=new makes a FAIL exit 1)
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, query, updateDoc, where } from 'firebase/firestore';
import { randomBytes } from 'node:crypto';

const PROJECT = 'demo-stmina';
const app = initializeApp({ apiKey: 'demo-key', projectId: PROJECT, authDomain: 'localhost' });
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

// JS value -> Firestore REST value (the emulator accepts the "owner" token as a bypass of the rules, like the console)
const toValue = (v) => {
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
};
const seed = async (uid, fields) => {
  const res = await fetch(`http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toValue(v)])) }),
  });
  if (!res.ok) throw new Error(`seed failed: ${res.status} ${await res.text()}`);
};
const base = (extra) => ({ role: 'deacon', status: 'approved', name: 'x', ...extra });

// each person signs up in the Auth emulator with a throw-away password, so the checks can act as them one after another
const creds = {};
const makeUser = async (label, fields) => {
  const email = `${label}.${randomBytes(3).toString('hex')}@example.test`;
  const password = randomBytes(9).toString('base64url');
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await seed(cred.user.uid, fields);
  creds[label] = { email, password };
};
const as = async (label) => {
  await signOut(auth);
  await signInWithEmailAndPassword(auth, creds[label].email, creds[label].password);
};
await makeUser('boysManager', base({ access: { admin: false, cells: ['male:3'], sections: ['boys'], servants: ['male'] } }));     // خدام
await makeUser('girlsManager', base({ access: { admin: false, cells: ['female:3'], sections: ['girls'], servants: ['female'] } })); // خادمات
await makeUser('plain', base({ access: { admin: false, cells: ['male:3'], sections: ['boys'], servants: [] } }));                // a servant of a class only
await seed('pendingBoy', { role: 'deacon', status: 'pending', name: 'Pending Boy', section: 'boys', email: 'b@example.test' });
await seed('pendingGirl', { role: 'deacon', status: 'pending', name: 'Pending Girl', section: 'girls', email: 'g@example.test' });
await seed('pendingBoy2', { role: 'deacon', status: 'pending', name: 'Pending Boy 2', section: 'boys', email: 'b2@example.test' });
await seed('approvedBoy', { role: 'deacon', status: 'approved', name: 'Approved Boy', section: 'boys', email: 'ab@example.test' });

const results = [];
const check = async (name, shouldBeAllowed, action) => {
  let outcome = 'allowed', detail = '';
  try { await action(); } catch (e) { outcome = 'DENIED'; detail = `${e.code || ''}`.trim(); }
  results.push({ name, expected: shouldBeAllowed ? 'allowed' : 'denied', outcome, ok: (outcome === 'allowed') === shouldBeAllowed, detail });
};

const pendingOf = (section) => query(collection(db, 'users'), where('status', '==', 'pending'), where('section', '==', section));
const approve = (id, extra = {}) => updateDoc(doc(db, 'users', id), { status: 'approved', deaconId: 'person1', ...extra });

await as('boysManager');
await check('1. خدام manager reads the pending requests of the BOYS section (query limited to the section)', true, async () => {
  const snap = await getDocs(pendingOf('boys'));
  if (snap.size !== 2) throw new Error(`expected 2 pending boys, got ${snap.size}`);
});
await check('2. خدام manager cannot read the pending requests of the GIRLS section', false, () => getDocs(pendingOf('girls')));
await check('3. a query for ALL pending requests (no section) is refused', false, () => getDocs(query(collection(db, 'users'), where('status', '==', 'pending'))));
await check('4. reads one pending boy', true, () => getDoc(doc(db, 'users', 'pendingBoy')));
await check('5. cannot read one pending girl', false, () => getDoc(doc(db, 'users', 'pendingGirl')));
await check('6. approves a pending boy (status + link to the person)', true, () => approve('pendingBoy'));
await check('7. rejects a pending boy', true, () => updateDoc(doc(db, 'users', 'pendingBoy2'), { status: 'rejected' }));
await check('8. must stay forbidden: approve a pending GIRL', false, () => approve('pendingGirl'));
await check('9. must stay forbidden: approve AND make admin (role)', false, async () => { await seed('p9', { role: 'deacon', status: 'pending', section: 'boys' }); await approve('p9', { role: 'admin' }); });
await check('10. must stay forbidden: approve AND write the access snapshot', false, async () => { await seed('p10', { role: 'deacon', status: 'pending', section: 'boys' }); await approve('p10', { access: { admin: true, cells: [], sections: [], servants: ['male'] } }); });
await check('11. must stay forbidden: change an already approved servant', false, () => updateDoc(doc(db, 'users', 'approvedBoy'), { status: 'rejected' }));
await check('12. must stay forbidden: set status to something else than approved / rejected', false, async () => { await seed('p12', { role: 'deacon', status: 'pending', section: 'boys' }); await updateDoc(doc(db, 'users', 'p12'), { status: 'pending2' }); });

await as('girlsManager');
await check('13. خادمات manager reads the pending GIRLS and approves one', true, async () => {
  const snap = await getDocs(pendingOf('girls'));
  if (snap.size !== 1) throw new Error(`expected 1, got ${snap.size}`);
  await approve('pendingGirl');
});
await check('14. خادمات manager cannot read the pending BOYS', false, () => getDocs(pendingOf('boys')));

await as('plain');
await check('15. a servant without the servants block cannot read pending requests', false, () => getDocs(pendingOf('boys')));
await check('16. a servant without the servants block cannot approve', false, async () => { await seed('p16', { role: 'deacon', status: 'pending', section: 'boys' }); await approve('p16'); });

for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}\n      expected ${r.expected}, got ${r.outcome}${r.detail ? `  -> ${r.detail}` : ''}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} behave as the rules should`);
process.exit(process.env.EXPECT === 'new' && failed ? 1 : 0);
