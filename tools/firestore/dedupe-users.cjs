// Deletes the duplicate / test / abandoned account documents in `users` (2026-09-24 review, see docs/ROLES-DESIGN.md).
// One account is kept per person (the most recently active). Only the Firestore profile is deleted, NOT the Firebase Auth login:
// a person who signs in again simply registers again. Every entry is checked by uid prefix AND email before it is touched.
// A full copy of each document is written to backups/ first. Dry run by default.
//   node tools/firestore/dedupe-users.cjs            dry run: shows what would be deleted
//   node tools/firestore/dedupe-users.cjs --apply    delete them
// Reads the 32 `users` documents once. Project-specific list: for the other project build a new list from the dry-run of the analysis.
const fs = require('fs'), path = require('path');
const { call, init, done, listAll } = require('./_client.cjs');
const APPLY = process.argv.includes('--apply');
const DELETE = [ // [uid prefix, email, why]
  ['6g4MqI', 'devidemele@gmail.com', 'duplicate of the active admin account hU1TK8'],
  ['XLKAN6', 'mpdotf@gmail.com', 'duplicate of the active admin account qxT6SN'],
  ['npPlYg', 'kwkwysy312@gmail.com', 'duplicate of 7Q2usy'],
  ['OPhLJB', 'davidt2550@gmail.com', 'duplicate of TuKgf7'],
  ['RUriiv', 'davidt2550@gmail.com', 'duplicate of TuKgf7'],
  ['bP9ojT', 'davidt2550@gmail.com', 'duplicate of TuKgf7'],
  ['ny2nSm', 'davidt2550@gmail.com', 'duplicate of TuKgf7'],
  ['CHstLj', 'davidishan4@gmail.com', 'test/extra account, same name as TuKgf7, never active'],
  ['PsWuMf', 'testing@gmail.com', 'test account, never active'],
  ['z0ncLk', 'davide@gmail.com', 'test account, never active'],
  ['WYlmBA', 'bsameh928@gmail.com', 'duplicate of QBDEGd'],
  ['jrFtiY', 'bsameh928@gmail.com', 'duplicate of QBDEGd'],
  ['ppt38Q', 'ebramsameh2006@gmail.com', 'duplicate of QBDEGd (same servant, never active)'],
  ['GFPY9f', 'youssefkamel788@gmail.com', 'duplicate of K3Kj4u'],
  ['CrRoRs', 'felobateer.akram@msa.edu.eg', 'duplicate of gzkmf5'],
  ['P8KSoA', 'fabiorefaat639@gmail.com', 'duplicate of DPGTgr'],
  ['QTP8RD', 'abanoubamir288@gmail.com', 'duplicate of yGJBbN'],
];
const v = (d, f) => d.fields && d.fields[f] && d.fields[f].stringValue;
(async () => {
  await init();
  const users = await listAll('users'), todo = [];
  for (const [prefix, email, why] of DELETE) {
    const m = users.filter(u => u.name.split('/').pop().startsWith(prefix));
    if (m.length !== 1) { console.log(`SKIP ${prefix}: ${m.length} matching documents`); continue; }
    if (v(m[0], 'email') !== email) { console.log(`SKIP ${prefix}: email is ${v(m[0], 'email')}, expected ${email}`); continue; }
    todo.push({ doc: m[0], why });
    console.log(`${APPLY ? 'delete' : 'would delete'} ${m[0].name.split('/').pop()}  ${v(m[0], 'name')}  ${email}  (${why})`);
  }
  const BK = path.resolve(__dirname, '..', '..', 'backups', new Date().toLocaleDateString('sv') + '-dedupe-users'); fs.mkdirSync(BK, { recursive: true });
  const bk = path.join(BK, `users-${new Date().toLocaleTimeString('sv').replace(/:/g, '')}${APPLY ? '-apply' : '-dry'}.json`);
  fs.writeFileSync(bk, JSON.stringify(todo.map(t => ({ why: t.why, document: t.doc })), null, 1)); console.log(`${todo.length} document(s); full copy saved:`, bk);
  if (!APPLY) { console.log('DRY RUN. Nothing deleted. Add --apply.'); return done(0); }
  let ok = 0; for (const t of todo) { const r = await call('firestore_delete_document', { name: t.doc.name, currentDocument: { updateTime: t.doc.updateTime } }); if (r.error) console.log('FAIL', t.doc.name.split('/').pop(), r.error.slice(0, 90)); else ok++; }
  console.log(`deleted ${ok}/${todo.length}. ${users.length - ok} accounts remain.`); done(ok === todo.length ? 0 : 1);
})().catch(e => { console.error('ABORT:', e.message); done(1); });
