// Firestore rules check, LOCAL emulators only (project "demo-stmina"): the parts of the programme (`parts_distribution`).
// A part needs only a title and a day; its type / servant are given later by EDITING it. ANY servant of the class (whose roles give them the
// class: users.access.cells; or, for an old account without roles, their own `grade`) may add, edit and delete the parts of that class, and an
// admin any class. Edits only touch the allowed fields, never the class, the section or who created it (2026-10-23: it used to be the class manager only).
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { addDoc, collection, connectFirestoreEmulator, deleteDoc, doc, getFirestore, serverTimestamp, updateDoc } from 'firebase/firestore';
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
await makeUser('plain5', { role: 'deacon', grade: 'g5' });
// servants with ROLES (the admin screen writes users.access): real class names, the cells decide the class
const CLS4 = 'سنة رابعة ابتدائي', CLS5 = 'سنة خامسة ابتدائي', CLS1 = 'سنة أولى ابتدائي';
const accessOf = (...cells) => ({ cells, admin: false, sections: ['boys'], servants: [] });
await makeUser('roles4', { role: 'deacon', grade: CLS4, gender: 'male', access: accessOf('male:4') });
await makeUser('rolesStale', { role: 'deacon', grade: CLS4, gender: 'male', access: accessOf('male:5') }); // old `grade` says 4, the roles say 5
await makeUser('girls4', { role: 'deacon', gender: 'female', access: accessOf('female:4') });
await makeUser('girlsMixed', { role: 'deacon', gender: 'female', access: accessOf('female:1', 'male:1') });
await makeUser('noClass', { role: 'deacon', gender: 'male', access: accessOf() }); // roles, but no class yet
await makeUser('legacy4', { role: 'deacon', grade: CLS4, gender: 'male' }); // an old account: no roles, just a class
await seed('parts_distribution/rp4', { grade: CLS4, type: '', title: 'x', date: '2030-10-18', deaconName: '', section: 'boys', createdByUid: 'someone' });
await seed('parts_distribution/rp5', { grade: CLS5, type: '', title: 'x', date: '2030-10-18', deaconName: '', section: 'boys', createdByUid: 'someone' });
await seed('parts_distribution/rg4', { grade: CLS4, type: '', title: 'x', date: '2030-10-18', deaconName: '', section: 'girls', createdByUid: 'someone' });
await seed('parts_distribution/rg1', { grade: CLS1, type: '', title: 'x', date: '2030-10-18', deaconName: '', section: 'girls', createdByUid: 'someone' });
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
await check('8. any servant of the class (not a manager) edits a part of their class', true, () => updateDoc(part(), give));

await as('admin');
await check('9. an admin edits any part', true, () => updateDoc(part(), give));
await check('10. an admin renames the servant on a part (the admin screen rename keeps working)', true, () => updateDoc(part(), { deaconName: 'مينا (جديد)' }));
await check('11. must stay forbidden even for an admin: other fields', false, () => updateDoc(part(), { createdByName: 'x' }));

await as('lead4');
await check('12. the manager of the class adds a reference (notes / links, several lines) to a part', true, () => updateDoc(part(), { reference: 'https://example.com/a\nملاحظة', updatedAt: serverTimestamp() }));
await as('plain');
await check('13. any servant of the class changes the reference', true, () => updateDoc(part(), { reference: 'x', updatedAt: serverTimestamp() }));
await as('plain5');
await check('13b. must stay forbidden: a servant of ANOTHER class changes the reference', false, () => updateDoc(part(), { reference: 'x', updatedAt: serverTimestamp() }));


// ----- roles-based servants: the class comes from users.access.cells -----
const ref = (id) => doc(db, 'parts_distribution', id);
const newPart = (uid, grade, section) => ({ grade, type: '', deaconName: '', deaconId: null, title: 'جديدة', date: '2030-10-20', section, createdByUid: uid, createdAt: serverTimestamp() });
const made = {};
await as('roles4');
await check('14. a servant whose roles give them class 4 (boys) adds a part to it', true, async () => { made.r4 = await addDoc(collection(db, 'parts_distribution'), newPart(uids.roles4, CLS4, 'boys')); });
await check('15. ... edits a part of that class (type, servant, reference)', true, () => updateDoc(ref('rp4'), { ...give, reference: 'ملاحظة' }));
await check('16. ... deletes a part of that class', true, () => deleteDoc(made.r4));
await check('17. must stay forbidden: adds a part to ANOTHER class (5)', false, () => addDoc(collection(db, 'parts_distribution'), newPart(uids.roles4, CLS5, 'boys')));
await check('18. must stay forbidden: edits a part of another class', false, () => updateDoc(ref('rp5'), give));
await check('19. must stay forbidden: deletes a part of another class', false, () => deleteDoc(ref('rp5')));
await check('20. must stay forbidden: adds a part to the same class of the OTHER section (girls)', false, () => addDoc(collection(db, 'parts_distribution'), newPart(uids.roles4, CLS4, 'girls')));
await check('21. must stay forbidden: moves a part of their class to another class', false, () => updateDoc(ref('rp4'), { grade: CLS5 }));
await check('22. must stay forbidden: adds a part in someone else\'s name (createdByUid)', false, () => addDoc(collection(db, 'parts_distribution'), newPart('someone-else', CLS4, 'boys')));

await as('rolesStale');
await check('23. the old `grade` field is ignored once there are roles: no edit on class 4 (the roles say 5)', false, () => updateDoc(ref('rp4'), give));
await check('24. ... but class 5 (the roles) works', true, () => updateDoc(ref('rp5'), give));

await as('noClass');
await check('25. roles without any class give no class: no edit', false, () => updateDoc(ref('rp4'), give));
await check('26. ... and no new part', false, () => addDoc(collection(db, 'parts_distribution'), newPart(uids.noClass, CLS4, 'boys')));

await as('girls4');
await check('27. a servant of class 4 in the GIRLS section edits the girls\' part of class 4', true, () => updateDoc(ref('rg4'), give));
await check('28. must stay forbidden: ... but not the boys\' part of class 4', false, () => updateDoc(ref('rp4'), give));

await as('girlsMixed');
await check('29. grades 1-2 (boys and girls together, women serve): a servant of the mixed grade edits the girls\' part of grade 1', true, () => updateDoc(ref('rg1'), give));
await check('30. must stay forbidden: ... but not class 4', false, () => updateDoc(ref('rg4'), give));

await as('legacy4');
await check('31. an old account without roles: any servant edits the parts of their own class (grade field)', true, () => updateDoc(ref('rp4'), give));
await check('32. must stay forbidden: ... and not another class', false, () => updateDoc(ref('rp5'), give));

for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}\n      expected ${r.expected}, got ${r.outcome}${r.detail ? `  -> ${r.detail}` : ''}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} behave as the rules should`);
process.exit(process.env.EXPECT === 'new' && failed ? 1 : 0);
