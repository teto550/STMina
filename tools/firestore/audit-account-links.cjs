// READ-ONLY. Finds logins and account documents that do not belong together, the cause of "permission-denied" on "كمّل بياناتك" (2026-10-22):
// the app finds a person's account by the uid of their login (`users/{uid}`), so a login that was deleted and made again (new uid) has no
// account document, and the old document belongs to a uid that no longer exists in Firebase Authentication.
//   A. logins (Authentication) with NO `users/{uid}` document        -> the person cannot get in properly
//   B. `users/{uid}` documents whose uid has NO login                -> an orphan profile (a dead duplicate, or the person's old account)
// When A and B share the same email they are the same person: relink = copy the B document to `users/<the new uid>` (keeps the deaconId, so the
// kids and the attendance stay linked: they point to the servants list, not to the login), then remove the orphan after a backup.
// Prints names and masked emails only (no phones, addresses or birth dates). Reads the `users` collection once and the logins once.
//   MCP_FEATURES=core,firestore,auth node tools/firestore/audit-account-links.cjs
const { call, init, done, listAll } = require('./_client.cjs');

const str = (f) => (f && f.stringValue) || '';
const mask = (email) => {
  const [name = '', domain = ''] = String(email || '').split('@');
  return `${name.slice(0, 3)}***@${domain}`;
};
const short = (uid) => `${uid.slice(0, 6)}…`;

(async () => {
  await init();
  const res = await call('auth_get_users', { limit: 500 });
  if (res.error) {
    console.error('auth_get_users failed:', res.error, '\nRun with MCP_FEATURES=core,firestore,auth');
    return done(1);
  }
  const logins = res.users || [];
  const docs = (await listAll('users')).map((d) => ({ uid: d.name.split('/').pop(), name: str(d.fields?.name), email: str(d.fields?.email).toLowerCase(), status: str(d.fields?.status), role: str(d.fields?.role), deaconId: str(d.fields?.deaconId) }));
  const loginByUid = new Map(logins.map((l) => [l.uid, l]));
  const docByUid = new Map(docs.map((d) => [d.uid, d]));
  console.log(`logins (Authentication): ${logins.length}   account documents (users): ${docs.length}\n`);

  const A = logins.filter((l) => !docByUid.has(l.uid));
  const B = docs.filter((d) => !loginByUid.has(d.uid));

  console.log(`A. logins with NO account document: ${A.length}`);
  for (const l of A) {
    const same = docs.find((d) => d.email && d.email === String(l.email || '').toLowerCase());
    console.log(`   ${short(l.uid)}  ${mask(l.email)}  created ${new Date(Number(l.createdAt)).toISOString().slice(0, 10)}  last sign-in ${String(l.lastRefreshAt || '').slice(0, 10) || '-'}${same ? `   <- same email as the orphan document "${same.name}" (${short(same.uid)})` : '   (no document with this email at all)'}`);
  }
  console.log(`\nB. account documents whose uid has NO login: ${B.length}`);
  for (const d of B) {
    const login = logins.find((l) => String(l.email || '').toLowerCase() === d.email);
    console.log(`   ${short(d.uid)}  "${d.name || '(no name)'}"  ${d.status || '-'}  ${d.role || '-'}  ${mask(d.email)}${d.deaconId ? '  linked to the servants list' : ''}${login ? `   <- the login with this email is now ${short(login.uid)}` : '   (no login with this email either)'}`);
  }
  console.log(`\nOK ${A.length === 0 && B.length === 0 ? 'every login has its document and the other way round' : 'see the lists above'}`);
  done(0);
})().catch((e) => { console.error(e); done(1); });
