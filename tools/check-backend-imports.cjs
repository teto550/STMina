// Enforces the "one door" rule (CLAUDE.md, BACKEND ACCESS): only `src/api/**`, `src/core/firebase.ts` (initialisation) and
// `src/core/firestore-helpers.ts` may use the backend SDK (`firebase/*`, `@/core/firebase`, `@/core/firestore-helpers`). Every other file
// asks `src/api/` for what it needs, so moving to another backend (Supabase was considered) is a rewrite of that one folder.
//
// The files that still break the rule today are listed in tools/backend-imports-baseline.json. The list can only SHRINK:
//   node tools/check-backend-imports.cjs            fails on a NEW file that uses the backend directly (and on a baseline file that is clean now)
//   node tools/check-backend-imports.cjs --shrink   removes the files that are clean now from the baseline
// Part of `npm run build` (npm run check:backend).
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BASELINE = path.join(__dirname, 'backend-imports-baseline.json');
const ALLOWED = [/^src\/api\//, /^src\/core\/firebase\.ts$/, /^src\/core\/firestore-helpers\.ts$/];
const SKIPPED = [/(^|\/)__tests__\//, /^src\/test\//, /\.test\.[tj]sx?$/, /\.d\.ts$/];
// import ... from 'firebase/x' | import('firebase/x') | '@/core/firebase' | '@/core/firestore-helpers' | './firebase' | './firestore-helpers' (inside core/)
const BACKEND = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"](?:firebase\/[a-z-]+|@\/core\/firebase|@\/core\/firestore-helpers|\.\/firebase|\.\/firestore-helpers)['"]/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** The files outside the allowed places that use the backend directly (paths relative to `root`, with `/`). */
function violators(root = ROOT) {
  const src = path.join(root, 'src');
  if (!fs.existsSync(src)) return [];
  return walk(src)
    .map(f => path.relative(root, f).split(path.sep).join('/'))
    .filter(rel => !ALLOWED.some(re => re.test(rel)) && !SKIPPED.some(re => re.test(rel)))
    .filter(rel => BACKEND.test(fs.readFileSync(path.join(root, rel), 'utf8')))
    .sort();
}

/** What is wrong, given the files that break the rule now and the baseline. */
function compare(now, baseline) {
  return { fresh: now.filter(f => !baseline.includes(f)), cleaned: baseline.filter(f => !now.includes(f)) };
}

module.exports = { violators, compare, BACKEND };

if (require.main === module) {
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).files;
  const now = violators();
  const { fresh, cleaned } = compare(now, baseline);
  if (process.argv.includes('--shrink')) {
    fs.writeFileSync(BASELINE, JSON.stringify({ note: 'Legacy files that still use the backend directly. May only shrink: see tools/check-backend-imports.cjs', files: baseline.filter(f => !cleaned.includes(f)) }, null, 2) + '\n');
    console.log(`baseline: ${cleaned.length} clean file(s) removed, ${baseline.length - cleaned.length} left`);
    process.exit(0);
  }
  if (fresh.length) {
    console.error('These files use the backend (firebase/*, @/core/firebase, @/core/firestore-helpers) directly. Put the call in a function of src/api/ and call that instead (CLAUDE.md, BACKEND ACCESS):');
    fresh.forEach(f => console.error('  ' + f));
  }
  if (cleaned.length) {
    console.error('These files no longer use the backend directly: remove them from tools/backend-imports-baseline.json (node tools/check-backend-imports.cjs --shrink):');
    cleaned.forEach(f => console.error('  ' + f));
  }
  if (fresh.length || cleaned.length) process.exit(1);
  console.log(`OK: no new direct backend use (${baseline.length} legacy file(s) still on the baseline, to be moved into src/api/ when touched).`);
}
