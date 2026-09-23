// One-off cleanup of leftovers found on 2026-09-24 (see docs/PORTING.md "Firestore data notes").
// Removes: collections `paragraphs` and `deacon_attendance`; fields students.lastVisit, students.waPhoneField,
// config/settings.currentGrade. Checks that the local backup exists first, and only PRINTS what it would do
// unless you pass --apply.
//   node tools/firestore/cleanup-legacy.cjs          (dry run)
//   node tools/firestore/cleanup-legacy.cjs --apply
const fs = require('fs'), path = require('path');
const { call, init, done, listAll, P } = require('./_client.cjs');
const APPLY = process.argv.includes('--apply');
const BK = path.resolve(__dirname, '..', '..', 'backups', '2026-09-24-firestore-cleanup'); // git-ignored
const rd = f => JSON.parse(fs.readFileSync(path.join(BK, f), 'utf8'));
(async () => {
  const bp = rd('paragraphs.json'), bd = rd('deacon_attendance.json'), bc = rd('config-settings.json'), bs = rd('students-fields-lastVisit-waPhoneField.json');
  console.log(`backup found: paragraphs=${bp.length} deacon_attendance=${bd.length} config=1 students-with-fields=${bs.length}`);
  console.log(APPLY ? 'APPLYING' : 'DRY RUN (add --apply to execute)');
  await init(); let errors = 0;
  for (const d of [...bp, ...bd]) { const n = d.name.split('/documents/')[1]; if (!APPLY) { console.log('would delete', n); continue; } const r = await call('firestore_delete_document', { name: d.name, currentDocument: { updateTime: d.updateTime } }); if (r.error) { errors++; console.log('FAIL delete', n, r.error.slice(0, 90)); } }
  for (const d of bs) { const n = d.name.split('/documents/')[1]; const fp = Object.keys(d.fields); if (!APPLY) { console.log('would remove fields', fp.join(','), 'from', n); continue; } const r = await call('firestore_update_document', { document: { name: d.name }, updateMask: { fieldPaths: fp }, currentDocument: { updateTime: d.updateTime } }); if (r.error) { errors++; console.log('FAIL fields', n, r.error.slice(0, 90)); } }
  if (!APPLY) console.log('would remove field currentGrade from config/settings'); else { const r = await call('firestore_update_document', { document: { name: bc.name }, updateMask: { fieldPaths: ['currentGrade'] }, currentDocument: { updateTime: bc.updateTime } }); if (r.error) { errors++; console.log('FAIL config', r.error.slice(0, 90)); } }
  if (APPLY) { console.log('collections now:', (await call('firestore_list_collections', { parent: P })).collectionIds.join(', ')); console.log(errors ? errors + ' error(s), see above' : 'done, no errors'); }
  done(errors ? 1 : 0);
})().catch(e => { console.error('ABORT:', e.message); done(1); });
