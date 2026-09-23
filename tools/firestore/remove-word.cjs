// Removes a whole word (default "مستر") from servant-name fields in Firestore, collapses double spaces and trims.
// Names are join keys today, so every name field is changed together (see docs/ID-MIGRATION.md for the plan to
// replace name links with ids). Dry run by default; it writes a backup of every old value to backups/ FIRST.
//   node tools/firestore/remove-word.cjs                       dry run: prints what would change, writes only the backup
//   node tools/firestore/remove-word.cjs --apply --limit 1     test on one document, then check the app
//   node tools/firestore/remove-word.cjs --apply               all documents
// Each write only touches the name fields and fails (then retries from the current value) if the document changed
// since it was read. Afterwards it re-scans and reports how many occurrences are left.
const fs = require('fs'), path = require('path');
const { call, init, done, listAll } = require('./_client.cjs');
const arg = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const APPLY = process.argv.includes('--apply'), LIMIT = arg('--limit') ? +arg('--limit') : Infinity, WORD = arg('--word') || 'مستر';
const RE = new RegExp(`(?<![\\u0621-\\u064A])${WORD}(?![\\u0621-\\u064A])`, 'g');   // whole Arabic word only
const clean = s => s.replace(RE, ' ').replace(/\s+/g, ' ').trim();
const TARGETS = { deacons: ['name'], users: ['name'], students: ['deacon'], deaconAttendance: ['name'], parts_distribution: ['deaconName'], activity_log: ['name', 'details'] };
const ORDER = Object.keys(TARGETS);
const BK = path.resolve(__dirname, '..', '..', 'backups', new Date().toLocaleDateString('sv') + '-remove-word'); // git-ignored, local date

async function scan() {
  const docs = new Map(); const anomalies = [];
  for (const [col, fields] of Object.entries(TARGETS)) { const all = await listAll(col); console.log('  scanned', col, all.length); for (const d of all) for (const f of fields) {
    const v = d.fields && d.fields[f]; if (!v || v.stringValue === undefined || !v.stringValue.includes(WORD)) continue;
    const nw = clean(v.stringValue), id = d.name.split('/').pop();
    if (!nw || nw.includes(WORD)) anomalies.push(`${col}/${id}.${f}: ${JSON.stringify(v.stringValue)} -> ${JSON.stringify(nw)}`);
    if ((v.stringValue.split(WORD).length - 1) !== (v.stringValue.match(RE) || []).length) anomalies.push(`${col}/${id}.${f}: word attached to other letters`);
    const k = col + '/' + id; if (!docs.has(k)) docs.set(k, { col, id, name: d.name, updateTime: d.updateTime, changes: {} });
    docs.get(k).changes[f] = { old: v.stringValue, new: nw };
  } }
  return { list: [...docs.values()].sort((a, b) => ORDER.indexOf(a.col) - ORDER.indexOf(b.col)), anomalies };
}
async function write(d, fields, updateTime) {
  return call('firestore_update_document', { document: { name: d.name, fields: Object.fromEntries(Object.entries(fields).map(([f, v]) => [f, { stringValue: v }])) }, updateMask: { fieldPaths: Object.keys(fields) }, currentDocument: { updateTime } });
}
(async () => {
  await init();
  const { list, anomalies } = await scan();
  const count = list.reduce((n, d) => n + Object.keys(d.changes).length, 0);
  console.log(`${count} field changes in ${list.length} documents`);
  const per = {}; list.forEach(d => Object.keys(d.changes).forEach(f => per[d.col + '.' + f] = (per[d.col + '.' + f] || 0) + 1)); console.log(per);
  const dup = {}; list.filter(d => d.col === 'deacons').forEach(d => (dup[d.changes.name.new] = dup[d.changes.name.new] || []).push(d.id));
  const collisions = Object.entries(dup).filter(([, v]) => v.length > 1);
  console.log('anomalies:', anomalies.length, ' name collisions among deacons:', collisions.length); anomalies.slice(0, 10).forEach(a => console.log('  !', a)); collisions.forEach(([k]) => console.log('  ! collision:', JSON.stringify(k)));
  if (anomalies.length || collisions.length) { console.log('Stopping: fix the anomalies first.'); return done(1); }
  fs.mkdirSync(BK, { recursive: true }); const bkFile = path.join(BK, `changes-${new Date().toLocaleTimeString('sv').replace(/:/g, '')}${APPLY ? '-apply' : '-dry'}.json`); fs.writeFileSync(bkFile, JSON.stringify(list.map(d => ({ doc: d.col + '/' + d.id, changes: d.changes })), null, 1)); console.log('backup of all old values (a new file every run, never overwritten):', bkFile);
  if (!APPLY) { console.log('DRY RUN. Nothing written to Firestore. Add --apply (optionally --limit 1 first).'); return done(0); }
  const todo = list.slice(0, LIMIT); let i = 0, ok = 0, retried = 0; const failed = [];
  const worker = async () => { while (i < todo.length) { const d = todo[i++]; const nw = Object.fromEntries(Object.entries(d.changes).map(([f, c]) => [f, c.new]));
    let r = await write(d, nw, d.updateTime);
    if (r.error) { const cur = await call('firestore_get_document', { name: d.name }); if (cur.error) { failed.push(d.col + '/' + d.id); continue; }
      const redo = {}; for (const f of Object.keys(d.changes)) { const v = cur.fields && cur.fields[f] && cur.fields[f].stringValue; if (v !== undefined && v.includes(WORD)) redo[f] = clean(v); }
      if (!Object.keys(redo).length) { ok++; continue; } r = await write(d, redo, cur.updateTime); retried++; if (r.error) { failed.push(d.col + '/' + d.id); continue; } }
    if (++ok % 50 === 0) console.log('progress', ok + '/' + todo.length); } };
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`written: ${ok}/${todo.length} documents (retried ${retried}), failed: ${failed.length}`); failed.slice(0, 10).forEach(f => console.log('  FAIL', f));
  const after = await scan(); console.log('left after the run:', after.list.reduce((n, d) => n + Object.keys(d.changes).length, 0), 'field(s) still containing the word' + (LIMIT < Infinity ? ' (expected: you used --limit)' : ''));
  done(failed.length ? 1 : 0);
})().catch(e => { console.error('ABORT:', e.message); done(1); });
