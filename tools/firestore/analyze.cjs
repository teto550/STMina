// Read-only: lists every collection with document count, field names/types (no values) and date ranges.
//   node tools/firestore/analyze.cjs
// Compare the output with the collections used in src/ (grep "collection(db,") to find unused collections/fields.
const { call, init, done, listAll, P } = require('./_client.cjs');
const typeOf = v => Object.keys(v)[0].replace('Value', '');
(async () => {
  await init();
  const cols = (await call('firestore_list_collections', { parent: P })).collectionIds;
  for (const c of cols) {
    const docs = await listAll(c); const fields = {}, dates = {};
    for (const d of docs) for (const [k, v] of Object.entries(d.fields || {})) {
      (fields[k] = fields[k] || { t: new Set(), n: 0 }); fields[k].t.add(typeOf(v)); fields[k].n++;
      if (v.timestampValue) { const r = dates[k] = dates[k] || [v.timestampValue, v.timestampValue]; if (v.timestampValue < r[0]) r[0] = v.timestampValue; if (v.timestampValue > r[1]) r[1] = v.timestampValue; }
    }
    console.log(`\n## ${c}  docs=${docs.length}`);
    for (const [k, f] of Object.entries(fields).sort((a, b) => b[1].n - a[1].n)) console.log(`  ${k.padEnd(22)} ${[...f.t].join('|').padEnd(12)} ${f.n}/${docs.length}` + (dates[k] ? `   ${dates[k][0].slice(0, 10)} .. ${dates[k][1].slice(0, 10)}` : ''));
  }
  done(0);
})().catch(e => { console.error(e); done(1); });
