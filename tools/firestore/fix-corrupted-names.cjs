// Repairs name fields that contain U+FFFD (the "replacement character" left when an Arabic letter was lost).
// Cause (fixed): an older `_client.cjs` split multi-byte characters across read chunks, and a script wrote the damaged text back.
// Only fields that contain U+FFFD are touched, and only when a known repair exists (add new ones to REPAIRS after checking the dry run).
//   node tools/firestore/fix-corrupted-names.cjs            dry run (also reports damaged values without a known repair)
//   node tools/firestore/fix-corrupted-names.cjs --apply
const { call, init, done, listAll } = require('./_client.cjs');
const APPLY = process.argv.includes('--apply');
const FIELDS = { deacons: ['name'], users: ['name'], students: ['deacon'], deaconAttendance: ['name'], parts_distribution: ['deaconName'] };
const REPAIRS = { 'م��ريو': 'ماريو' };
(async () => { await init(); let found = 0;
  for (const [col, fields] of Object.entries(FIELDS)) for (const d of await listAll(col)) for (const f of fields) {
    const old = d.fields?.[f]?.stringValue; if (!old || !old.includes('�')) continue; found++;
    const nw = REPAIRS[old], id = d.name.split('/').pop();
    if (!nw) { console.log(`  no known repair: ${col}/${id}.${f} = ${JSON.stringify(old)}`); continue; }
    console.log(`  ${col}/${id}.${f}: ${JSON.stringify(old)} -> ${JSON.stringify(nw)}`);
    if (APPLY) { const r = await call('firestore_update_document', { document: { name: d.name, fields: { [f]: { stringValue: nw } } }, updateMask: { fieldPaths: [f] }, currentDocument: { updateTime: d.updateTime } }); console.log(r.error ? '  FAIL ' + r.error.slice(0, 90) : '  fixed'); } }
  console.log(`${found} damaged value(s).`, APPLY ? '' : 'DRY RUN. Add --apply.'); done(0); })().catch(e => { console.error('ABORT:', e.message); done(1); });
