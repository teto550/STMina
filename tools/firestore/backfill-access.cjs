// Roles step 2: adds the NEW fields of the roles design, additively (nothing existing is changed or removed):
//   students: gender ('male'), cell ('male:<grade>')      deacons: roleIds ([]), uid (linked login)      users: deaconId
// Accounts are linked to their person by exact name (trimmed); unmatched accounts, duplicate names and kids that are not male
// (girls' section, grade 3+) are only REPORTED, never written. Only documents missing a field are touched (safe to run twice).
//   node tools/firestore/backfill-access.cjs                       dry run: report + local backup list, writes nothing
//   node tools/firestore/backfill-access.cjs --apply --limit 1     test on one document per collection first
//   node tools/firestore/backfill-access.cjs --apply               all
// Reads students + deacons + users once (~600 documents?) before and once after applying. Each write needs the document
// unchanged since it was read.
const fs = require('fs'), path = require('path');
const { call, init, done, listAll } = require('./_client.cjs');
const arg = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const APPLY = process.argv.includes('--apply'), LIMIT = arg('--limit') ? +arg('--limit') : Infinity;
const BK = path.resolve(__dirname, '..', '..', 'backups', new Date().toLocaleDateString('sv') + '-backfill-access');
const GRADE_WORDS = [['أولى', 1], ['تانية', 2], ['ثانية', 2], ['تالتة', 3], ['ثالثة', 3], ['رابعة', 4], ['خامسة', 5], ['سادسة', 6]];
const gradeNo = s => { const w = GRADE_WORDS.find(([k]) => (s || '').includes(k)); return w ? w[1] : null; };
const str = (d, f) => d.fields && d.fields[f] && d.fields[f].stringValue;
const has = (d, f) => !!(d.fields && d.fields[f]);
const id = d => d.name.split('/').pop();

async function plan() {
  const [students, deacons, users] = await Promise.all(['students', 'deacons', 'users'].map(listAll));
  const writes = [], report = { kidsNotMale: [], kidsNoGrade: [], unmatchedUsers: [], duplicateNames: [], alreadyLinked: 0 };
  for (const s of students) {
    if (has(s, 'gender') && has(s, 'cell')) continue;
    const g = gradeNo(str(s, 'grade'));
    if (!g) { report.kidsNoGrade.push(id(s)); continue; }
    if (!has(s, 'gender') && str(s, 'section') === 'girls' && g >= 3) { report.kidsNotMale.push(id(s)); continue; }
    const gender = str(s, 'gender') || 'male', f = {};
    if (!has(s, 'gender')) f.gender = { stringValue: gender };
    if (!has(s, 'cell')) f.cell = { stringValue: `${gender}:${g}` };
    writes.push({ doc: s, col: 'students', fields: f });
  }
  const byName = new Map();
  for (const d of deacons) { const n = (str(d, 'name') || '').trim(); byName.set(n, [...(byName.get(n) || []), d]); }
  report.duplicateNames = [...byName].filter(([n, v]) => n && v.length > 1).map(([n]) => n);
  const uidOf = new Map();
  for (const u of users) {
    const n = (str(u, 'name') || '').trim(), m = byName.get(n);
    if (!m || m.length !== 1) { report.unmatchedUsers.push(`${id(u)} (${n || 'no name'}, ${str(u, 'role') || '-'})`); continue; }
    uidOf.set(id(m[0]), id(u));
    if (has(u, 'deaconId')) report.alreadyLinked++; else writes.push({ doc: u, col: 'users', fields: { deaconId: { stringValue: id(m[0]) } } });
  }
  for (const d of deacons) {
    const f = {};
    if (!has(d, 'roleIds')) f.roleIds = { arrayValue: {} };
    if (!has(d, 'uid') && uidOf.has(id(d))) f.uid = { stringValue: uidOf.get(id(d)) };
    if (Object.keys(f).length) writes.push({ doc: d, col: 'deacons', fields: f });
  }
  return { writes, report, counts: { students: students.length, deacons: deacons.length, users: users.length } };
}

(async () => {
  await init();
  const { writes, report, counts } = await plan();
  const per = {}; writes.forEach(w => per[w.col] = (per[w.col] || 0) + 1);
  console.log('read:', JSON.stringify(counts), '\nto write (documents):', JSON.stringify(per));
  console.log('report:', JSON.stringify({ ...report, unmatchedUsers: report.unmatchedUsers.length, kidsNotMale: report.kidsNotMale.length, kidsNoGrade: report.kidsNoGrade.length }));
  report.unmatchedUsers.forEach(u => console.log('  unmatched account:', u));
  report.duplicateNames.forEach(n => console.log('  duplicate servant name:', n));
  if (report.kidsNotMale.length) console.log('  kids in the girls section, grade 3+ (not written, tell me their gender):', report.kidsNotMale.length);
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
