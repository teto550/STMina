// Sets the `gender` field on every servant that does not have one yet: the `users` (accounts) and `deacons` (servants list)
// collections. The only two values that may ever be stored are 'male' and 'female'. There are no female servants yet, so the
// default is 'male'. Only documents WITHOUT a gender are touched (safe to run twice); only that one field is written.
//   node tools/firestore/set-gender.cjs                  dry run: prints what would change, writes only a local backup list
//   node tools/firestore/set-gender.cjs --apply --limit 1     test on one document first
//   node tools/firestore/set-gender.cjs --apply          all of them
//   node tools/firestore/set-gender.cjs --apply --value female    (only for a run limited to female servants later)
// Each write is skipped (and re-read) if the document changed since it was read. Reads ~81 documents twice (before and after).
const fs = require('fs'), path = require('path');
const { call, init, done, listAll } = require('./_client.cjs');
const arg = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const APPLY = process.argv.includes('--apply'), LIMIT = arg('--limit') ? +arg('--limit') : Infinity, VALUE = arg('--value') || 'male';
const COLLECTIONS = ['users', 'deacons'];
if (!['male', 'female'].includes(VALUE)) { console.error("--value must be 'male' or 'female'"); process.exit(1); }
const BK = path.resolve(__dirname, '..', '..', 'backups', new Date().toLocaleDateString('sv') + '-set-gender'); // git-ignored, local date

async function scan() {
  const missing = [], counts = {};
  for (const col of COLLECTIONS) {
    const docs = await listAll(col); counts[col] = { total: docs.length, male: 0, female: 0, missing: 0, invalid: 0 };
    for (const d of docs) {
      const g = d.fields && d.fields.gender && d.fields.gender.stringValue;
      if (g === 'male' || g === 'female') counts[col][g]++;
      else if (d.fields && d.fields.gender) counts[col].invalid++;          // a gender that is neither: reported, never overwritten
      else { counts[col].missing++; missing.push({ col, id: d.name.split('/').pop(), name: d.name, updateTime: d.updateTime }); }
    }
  }
  return { missing, counts };
}
async function write(d, updateTime) {
  return call('firestore_update_document', { document: { name: d.name, fields: { gender: { stringValue: VALUE } } }, updateMask: { fieldPaths: ['gender'] }, currentDocument: { updateTime } });
}
(async () => {
  await init();
  const { missing, counts } = await scan();
  console.log('before:', JSON.stringify(counts));
  console.log(`${missing.length} document(s) without a gender -> would set gender = '${VALUE}'`);
  fs.mkdirSync(BK, { recursive: true });
  const bkFile = path.join(BK, `docs-${new Date().toLocaleTimeString('sv').replace(/:/g, '')}${APPLY ? '-apply' : '-dry'}.json`);
  fs.writeFileSync(bkFile, JSON.stringify(missing.map(d => ({ doc: d.col + '/' + d.id, gender: null, willSet: VALUE })), null, 1));
  console.log('list of documents (a new file every run):', bkFile);
  if (!APPLY) { console.log('DRY RUN. Nothing written to Firestore. Add --apply (optionally --limit 1 first).'); return done(0); }
  const todo = missing.slice(0, LIMIT); let i = 0, ok = 0; const failed = [];
  const worker = async () => { while (i < todo.length) { const d = todo[i++];
    let r = await write(d, d.updateTime);
    if (r.error) { const cur = await call('firestore_get_document', { name: d.name }); if (cur.error) { failed.push(d.col + '/' + d.id); continue; }
      if (cur.fields && cur.fields.gender) { ok++; continue; }           // someone set it meanwhile: leave it
      r = await write(d, cur.updateTime); if (r.error) { failed.push(d.col + '/' + d.id); continue; } }
    ok++; } };
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(`written: ${ok}/${todo.length}, failed: ${failed.length}`); failed.slice(0, 10).forEach(f => console.log('  FAIL', f));
  const after = await scan(); console.log('after:', JSON.stringify(after.counts));
  console.log(after.missing.length ? `${after.missing.length} still without a gender${LIMIT < Infinity ? ' (expected: you used --limit)' : ''}` : 'every servant now has a gender');
  done(failed.length ? 1 : 0);
})().catch(e => { console.error('ABORT:', e.message); done(1); });
