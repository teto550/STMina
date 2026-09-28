// ID migration step 3 (docs/ID-MIGRATION.md): adds `deaconId` next to the servant NAME on the records that link to a servant by name:
//   students.deacon -> students.deaconId      deaconAttendance.name -> deaconAttendance.deaconId      parts_distribution.deaconName -> deaconId
// The name fields stay (dual mode, so rolling back is safe). The match is by exact name inside the same section (missing section = boys).
// A name with no single match is REPORTED and left alone; nothing is guessed. Only documents without a deaconId are touched (safe to re-run).
//   node tools/firestore/backfill-deacon-ids.cjs                       dry run: report + local plan file, writes nothing
//   node tools/firestore/backfill-deacon-ids.cjs --apply --limit 1     one document per collection first
//   node tools/firestore/backfill-deacon-ids.cjs --apply
// Reads deacons + students + deaconAttendance + parts_distribution (~270 documents) before and once after applying.
const fs = require('fs'), path = require('path');
const { call, init, done, listAll } = require('./_client.cjs');
const arg = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const APPLY = process.argv.includes('--apply'), LIMIT = arg('--limit') ? +arg('--limit') : Infinity;
const BK = path.resolve(__dirname, '..', '..', 'backups', new Date().toLocaleDateString('sv') + '-backfill-deacon-ids');
// misspelled names found in the data (2026-09-24 dry run): the record is linked to the right servant and its name is corrected too
const ALIASES = { 'فيلبواتير': 'فيلوباتير' };
const TARGETS = [['students', 'deacon'], ['deaconAttendance', 'name'], ['parts_distribution', 'deaconName']];
const str = (d, f) => d.fields && d.fields[f] && d.fields[f].stringValue;
const has = (d, f) => !!(d.fields && d.fields[f] && d.fields[f].nullValue === undefined);
const id = d => d.name.split('/').pop();
const clean = s => (s || '').replace(/\s+/g, ' ').trim();

async function plan() {
  const roster = await listAll('deacons'), writes = [], report = {};
  const bySectionName = new Map();
  for (const d of roster) { const k = (str(d, 'section') || 'boys') + '|' + clean(str(d, 'name')); bySectionName.set(k, [...(bySectionName.get(k) || []), d]); }
  for (const [col, field] of TARGETS) {
    const docs = await listAll(col); report[col] = { total: docs.length, alreadyLinked: 0, noName: 0, unmatched: [], ambiguous: [] };
    for (const d of docs) {
      if (has(d, 'deaconId')) { report[col].alreadyLinked++; continue; }
      const raw = clean(str(d, field)); if (!raw) { report[col].noName++; continue; }
      const name = ALIASES[raw] || raw;
      const m = bySectionName.get((str(d, 'section') || 'boys') + '|' + name) || [];
      if (m.length === 1) writes.push({ doc: d, col, fields: { deaconId: { stringValue: id(m[0]) }, ...(name !== raw ? { [field]: { stringValue: name } } : {}) } });
      else (m.length ? report[col].ambiguous : report[col].unmatched).push(`${id(d)}: ${name}`);
    }
  }
  return { writes, report };
}

(async () => {
  await init();
  const { writes, report } = await plan();
  const per = {}; writes.forEach(w => per[w.col] = (per[w.col] || 0) + 1);
  console.log('to write (documents):', JSON.stringify(per));
  for (const [col, r] of Object.entries(report)) console.log(col, JSON.stringify({ total: r.total, alreadyLinked: r.alreadyLinked, noName: r.noName, unmatched: r.unmatched.length, ambiguous: r.ambiguous.length }));
  for (const [col, r] of Object.entries(report)) { r.unmatched.slice(0, 15).forEach(x => console.log(`  unmatched ${col}:`, x)); r.ambiguous.slice(0, 15).forEach(x => console.log(`  ambiguous ${col}:`, x)); }
  fs.mkdirSync(BK, { recursive: true });
  const bk = path.join(BK, `plan-${new Date().toLocaleTimeString('sv').replace(/:/g, '')}${APPLY ? '-apply' : '-dry'}.json`);
  fs.writeFileSync(bk, JSON.stringify({ report, writes: writes.map(w => ({ doc: w.col + '/' + id(w.doc), set: w.fields })) }, null, 1));
  console.log('plan saved (new file every run):', bk);
  if (!APPLY) { console.log('DRY RUN. Nothing written. Add --apply (optionally --limit 1 first).'); return done(0); }
  const seen = {}, todo = writes.filter(w => (seen[w.col] = (seen[w.col] || 0) + 1) <= LIMIT);
  let i = 0, ok = 0; const failed = [];
  const worker = async () => { while (i < todo.length) { const w = todo[i++];
    const r = await call('firestore_update_document', { document: { name: w.doc.name, fields: w.fields }, updateMask: { fieldPaths: Object.keys(w.fields) }, currentDocument: { updateTime: w.doc.updateTime } });
    if (r.error) failed.push(w.col + '/' + id(w.doc)); else if (++ok % 50 === 0) console.log('progress', ok + '/' + todo.length); } };
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(`written: ${ok}/${todo.length}, failed (changed meanwhile, re-run): ${failed.length}`); failed.slice(0, 10).forEach(f => console.log('  FAIL', f));
  const after = await plan(); const left = {}; after.writes.forEach(w => left[w.col] = (left[w.col] || 0) + 1);
  console.log('still to write after the run:', JSON.stringify(left), LIMIT < Infinity ? '(expected: you used --limit)' : '');
  done(failed.length ? 1 : 0);
})().catch(e => { console.error('ABORT:', e.message); done(1); });
