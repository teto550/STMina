// Adds a LIST of occasions (feasts, fasts, ...) to the `occasions` collection, for when you do not want to type them one by one: ask Claude to
// fetch the dates of a year (from a Coptic calendar, a church site...), review the JSON it writes, then run this on it.
//   node tools/firestore/add-occasions.cjs tools/firestore/occasions.example.json            dry run: prints what would be added
//   node tools/firestore/add-occasions.cjs my-2027.json --apply --limit 1                    test with one
//   node tools/firestore/add-occasions.cjs my-2027.json --apply                              all of them
// To get the file for a year: `node tools/firestore/coptic-occasions.mjs 2028 --out my-2028.json` (the Coptic Orthodox list the church chose).
// The file is a JSON array of { "title": "عيد الميلاد", "date": "2027-01-07" } (date as YYYY-MM-DD). Several on one day are fine.
// Only ADDS: an occasion that already exists (same day and name) is skipped, nothing is changed or deleted, so it is safe to run twice.
// Each one gets a fixed id made of its day and name, and is created only if that id is free. Reads the (small) `occasions` list once.
// The app keeps each year for a week on every phone: new occasions show up there after that, or when "تحديث" is tapped.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { call, init, done, listAll, P } = require('./_client.cjs');
const arg = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const FILE = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
const APPLY = process.argv.includes('--apply'), LIMIT = arg('--limit') ? +arg('--limit') : Infinity;
if (!FILE) { console.error('usage: node tools/firestore/add-occasions.cjs <occasions.json> [--apply] [--limit N]'); process.exit(1); }

const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
const idOf = o => `${o.date}-${crypto.createHash('sha1').update(o.title).digest('hex').slice(0, 8)}`;
function load() {
  const rows = JSON.parse(fs.readFileSync(path.resolve(FILE), 'utf8'));
  if (!Array.isArray(rows)) throw new Error('the file must be a JSON array');
  const seen = new Set(), ok = [], bad = [];
  rows.forEach((r, i) => {
    const o = { title: norm(r && r.title), date: String((r && r.date) || '').trim() };
    if (!o.title || !/^\d{4}-\d{2}-\d{2}$/.test(o.date) || Number.isNaN(Date.parse(o.date))) { bad.push(`#${i + 1}: ${JSON.stringify(r)}`); return; }
    const id = idOf(o);
    if (!seen.has(id)) { seen.add(id); ok.push({ ...o, id }); }
  });
  return { ok, bad };
}

(async () => {
  const { ok, bad } = load();
  bad.forEach(b => console.error('skipped (needs a title and a date YYYY-MM-DD): ' + b));
  await init();
  // already there = same id (an earlier run of this script) OR the same day and name (typed by hand in the app, which uses random ids)
  const docs = await listAll('occasions');
  const existingIds = new Set(docs.map(d => d.name.split('/').pop()));
  const existingKeys = new Set(docs.map(d => `${d.fields && d.fields.date && d.fields.date.stringValue}|${norm(d.fields && d.fields.title && d.fields.title.stringValue)}`));
  const todo = ok.filter(o => !existingIds.has(o.id) && !existingKeys.has(`${o.date}|${o.title}`));
  console.log(`${ok.length} valid in the file, ${ok.length - todo.length} already there, ${todo.length} to add`);
  todo.slice(0, 50).forEach(o => console.log(`  + ${o.date}  ${o.title}`));
  if (todo.length > 50) console.log(`  ... and ${todo.length - 50} more`);
  if (!APPLY) { console.log('DRY RUN. Nothing written. Add --apply (optionally --limit 1 first).'); return done(0); }
  let added = 0; const failed = [];
  for (const o of todo.slice(0, LIMIT)) {
    const r = await call('firestore_update_document', { document: { name: `${P}/occasions/${o.id}`, fields: { title: { stringValue: o.title }, date: { stringValue: o.date } } }, currentDocument: { exists: false } });
    if (r.error) failed.push(`${o.date} ${o.title}: ${r.error}`); else added++;
  }
  console.log(`added ${added}, failed ${failed.length}`);
  failed.forEach(f => console.error('  failed: ' + f));
  done(failed.length ? 1 : 0);
})().catch(e => { console.error(e); done(1); });
