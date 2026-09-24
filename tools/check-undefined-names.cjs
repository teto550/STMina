// Finds names that are used but never defined in the old (`// @ts-nocheck`) files: TypeScript stays silent there, so a forgotten
// import only shows up in the browser ("X is not defined"). It copies src/ to a temp folder, removes the @ts-nocheck headers, runs tsc
// and lists every "Cannot find name" that is NOT a known global (a `window.x = ...` function of the app, or a CDN library).
//   node tools/check-undefined-names.cjs        (also: npm run check:names)   exit code 1 when something is missing
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const CDN_GLOBALS = new Set(['XLSX', 'ExcelJS', 'emailjs']);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'names-'));
fs.cpSync(path.join(ROOT, 'src'), path.join(tmp, 'src'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'tsconfig.json'), path.join(tmp, 'tsconfig.json'));
fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'));
(function strip(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name);
  if (e.isDirectory()) strip(p); else if (/\.(ts|tsx)$/.test(e.name)) { const s = fs.readFileSync(p, 'utf8'); if (s.includes('@ts-nocheck')) fs.writeFileSync(p, s.replace(/^\/\/ @ts-nocheck.*$/m, '')); } } })(path.join(tmp, 'src'));
const r = spawnSync(path.join(ROOT, 'node_modules', '.bin', 'tsc'), ['--noEmit', '-p', 'tsconfig.json'], { cwd: tmp, encoding: 'utf8' });
const defined = []; // every `window.name = ...` in the app (functions the old code shares through window)
(function scan(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name);
  if (e.isDirectory()) scan(p); else if (/\.(ts|tsx|html|js)$/.test(e.name)) for (const m of fs.readFileSync(p, 'utf8').matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) defined.push(m[1]); } })(path.join(ROOT, 'src'));
for (const m of fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) defined.push(m[1]);
const okNames = new Set([...defined, ...CDN_GLOBALS]);
const missing = new Map();
for (const line of (r.stdout || '').split('\n')) { const m = line.match(/^(.+?)\((\d+),\d+\): error TS(?:2304|2552): Cannot find name '([^']+)'/); if (m && !okNames.has(m[3])) missing.set(`${m[1]}: ${m[3]}`, m[2]); }
fs.rmSync(tmp, { recursive: true, force: true });
if (!missing.size) { console.log('OK: no undefined names in the old files.'); process.exit(0); }
console.log('Undefined names (missing import?):'); for (const [k, l] of missing) console.log(`  ${k} (line ${l})`); process.exit(1);
