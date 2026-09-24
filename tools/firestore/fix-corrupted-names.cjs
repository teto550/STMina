// Repairs servant names damaged by a lost character (U+FFFD "replacement character") in `deacons`.
// Known repair: 'يوسف كامل' (the 'و' was lost). Only a name that contains U+FFFD is touched; kids/attendance already use the correct spelling.
//   node tools/firestore/fix-corrupted-names.cjs            dry run
//   node tools/firestore/fix-corrupted-names.cjs --apply
const { call, init, done, listAll } = require('./_client.cjs');
const APPLY = process.argv.includes('--apply');
const REPAIRS = { 'ي��سف كامل': 'يوسف كامل' };
(async () => { await init();
  const bad = (await listAll('deacons')).filter(d => (d.fields?.name?.stringValue || '').includes('�'));
  console.log(`${bad.length} servant name(s) with a damaged character`);
  for (const d of bad) { const old = d.fields.name.stringValue, nw = REPAIRS[old];
    if (!nw) { console.log('  no known repair for', JSON.stringify(old), d.name.split('/').pop()); continue; }
    console.log(`  ${d.name.split('/').pop()}: ${JSON.stringify(old)} -> ${JSON.stringify(nw)}`);
    if (APPLY) { const r = await call('firestore_update_document', { document: { name: d.name, fields: { name: { stringValue: nw } } }, updateMask: { fieldPaths: ['name'] }, currentDocument: { updateTime: d.updateTime } }); console.log(r.error ? '  FAIL ' + r.error.slice(0, 90) : '  fixed'); } }
  if (!APPLY) console.log('DRY RUN. Add --apply.'); done(0); })().catch(e => { console.error('ABORT:', e.message); done(1); });
