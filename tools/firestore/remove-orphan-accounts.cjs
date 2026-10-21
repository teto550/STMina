// Removes DEAD DUPLICATE account documents: `users/{uid}` whose uid has no login (Firebase Authentication) any more, while the SAME email now
// has a working login with its own account document. That is a person who made their login again (forgot the password...): the old document
// is a leftover that the roles / people screens could pick by mistake. See audit-account-links.cjs for the full picture.
// A document is removed ONLY when all of these hold, otherwise it is listed under "needs a person" and left alone:
//   - its uid has no login, and the same email has a login (another uid) that HAS an account document;
//   - both documents point to the same person of the servants list (same `deaconId`), or the dead one has none.
// Kids and attendance are not touched: they point to the servants list (`deaconId`), not to the login.
// Dry run by default (writes only the local backup of what it WOULD remove); `--apply` removes them.
//   MCP_FEATURES=core,firestore,auth node tools/firestore/remove-orphan-accounts.cjs [--apply]
const fs = require('fs'), path = require('path');
const { call, init, done, listAll, P } = require('./_client.cjs');

const APPLY = process.argv.includes('--apply');
const str = (f) => (f && f.stringValue) || '';
const mask = (email) => { const [n = '', d = ''] = String(email || '').split('@'); return `${n.slice(0, 3)}***@${d}`; };

(async () => {
  await init();
  const res = await call('auth_get_users', { limit: 500 });
  if (res.error) {
    console.error('auth_get_users failed:', res.error, '\nRun with MCP_FEATURES=core,firestore,auth');
    return done(1);
  }
  const logins = res.users || [];
  const docs = await listAll('users');
  const rows = docs.map((d) => ({ uid: d.name.split('/').pop(), raw: d, name: str(d.fields?.name), email: str(d.fields?.email).toLowerCase(), deaconId: str(d.fields?.deaconId) }));
  const loginUids = new Set(logins.map((l) => l.uid));
  const docUids = new Set(rows.map((r) => r.uid));
  const liveByEmail = new Map(logins.filter((l) => docUids.has(l.uid)).map((l) => [String(l.email || '').toLowerCase(), l.uid]));

  const remove = [], keep = [];
  for (const r of rows.filter((x) => !loginUids.has(x.uid))) {
    const liveUid = r.email && liveByEmail.get(r.email);
    const live = liveUid && rows.find((x) => x.uid === liveUid);
    if (live && (!r.deaconId || r.deaconId === live.deaconId)) {
      remove.push({ ...r, liveUid });
    } else {
      keep.push({ ...r, why: live ? 'points to a different person than the live account' : 'no live login with this email (the person may need a relink, not a removal)' });
    }
  }
  console.log(`logins ${logins.length}, account documents ${rows.length}`);
  console.log(`\nDead duplicates to remove: ${remove.length}`);
  for (const r of remove) console.log(`   ${r.uid.slice(0, 6)}…  "${r.name}"  ${mask(r.email)}   (the live account is ${r.liveUid.slice(0, 6)}…)`);
  console.log(`\nNeeds a person (left alone): ${keep.length}`);
  for (const r of keep) console.log(`   ${r.uid.slice(0, 6)}…  "${r.name}"  ${mask(r.email)}   ${r.why}`);

  if (!remove.length) {
    console.log('\nNothing to remove.');
    return done(0);
  }
  const dir = path.join(__dirname, '..', '..', 'backups', `${new Date().toISOString().slice(0, 10)}-remove-orphan-accounts`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'users.json'), JSON.stringify(remove.map((r) => r.raw), null, 2));
  console.log(`\nbackup of the ${remove.length} document(s): ${path.relative(process.cwd(), dir)}/users.json`);
  if (!APPLY) {
    console.log('dry run: nothing removed. Run again with --apply.');
    return done(0);
  }
  for (const r of remove) {
    const out = await call('firestore_delete_document', { name: `${P}/users/${r.uid}`, currentDocument: { exists: true } });
    console.log(out.error ? `   FAILED ${r.uid.slice(0, 6)}…: ${out.error}` : `   removed ${r.uid.slice(0, 6)}…`);
  }
  done(0);
})().catch((e) => { console.error(e); done(1); });
