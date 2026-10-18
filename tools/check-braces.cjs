// Enforces the user's rule: an `if` / `else` always has a `{ }` block, never a one-liner (`if (x) return;`).
//   node tools/check-braces.cjs <folder or file> ...           report violations (exit code 1 when there are any)
//   node tools/check-braces.cjs --fix <folder or file> ...     rewrite them with braces, on their own lines
//   --skip-nocheck                                             skip the old plain files (they start with `// @ts-nocheck`): they are fixed when touched
// Ternary expressions (`a ? b : c`) are not if/else statements and are not checked. `else if` chains are fine.
const fs = require('fs'), path = require('path');
const { parse } = require('@babel/parser');

const args = process.argv.slice(2);
const FIX = args.includes('--fix');
const SKIP_OLD = args.includes('--skip-nocheck');
const targets = args.filter((a) => !a.startsWith('--'));
if (!targets.length) { console.error('usage: node tools/check-braces.cjs [--fix] <folder or file> ...'); process.exit(2); }

const listFiles = (p) => {
  if (!fs.existsSync(p)) { return []; }
  const st = fs.statSync(p);
  if (st.isFile()) { return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(p) ? [p] : []; }
  return fs.readdirSync(p).flatMap((n) => (n === 'node_modules' || n === 'dist' ? [] : listFiles(path.join(p, n))));
};

const walk = (node, visit) => {
  if (!node || typeof node.type !== 'string') { return; }
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'extra' || key.endsWith('Comments')) { continue; }
    const v = node[key];
    if (Array.isArray(v)) { v.forEach((c) => c && typeof c.type === 'string' && walk(c, visit)); }
    else if (v && typeof v.type === 'string') { walk(v, visit); }
  }
};

const parseFile = (code, file) => parse(code, {
  sourceType: 'unambiguous', errorRecovery: false,
  plugins: /\.(ts|tsx)$/.test(file) ? ['typescript', 'jsx'] : ['jsx'],
});

/** the violations of one parsed file: [{ kind: 'if' | 'else', node }] */
const braceless = (n) => n.type === 'IfStatement' && (n.consequent.type !== 'BlockStatement' || (n.alternate && n.alternate.type !== 'BlockStatement' && n.alternate.type !== 'IfStatement'));
const find = (ast) => {
  const out = [];
  walk(ast.program, (n) => {
    // `() => { if (x) y(); }` all on one line: expand the block first
    if (n.type === 'BlockStatement' && n.loc.start.line === n.loc.end.line && n.body.some(braceless)) { out.push({ kind: 'block', node: n }); }
    if (n.type !== 'IfStatement') { return; }
    if (n.consequent.type !== 'BlockStatement') { out.push({ kind: 'if', node: n }); }
    if (n.alternate && n.alternate.type !== 'BlockStatement' && n.alternate.type !== 'IfStatement') { out.push({ kind: 'else', node: n }); }
  });
  return out;
};

const indentOf = (code, pos) => {
  const lineStart = code.lastIndexOf('\n', pos - 1) + 1;
  return /^[ \t]*/.exec(code.slice(lineStart))[0];
};
const lineOf = (code, pos) => code.slice(0, pos).split('\n').length;

/** the rewritten text of `code` with every brace-less if/else of this pass wrapped (nested ones are done by the next pass) */
const fixOnce = (code, violations) => {
  const edits = [];
  const blocks = violations.filter((v) => v.kind === 'block');
  if (blocks.length) {
    // expand one-line blocks only (the next pass wraps the if inside); skip a block with comments between its statements
    for (const { node } of blocks) {
      const indent = indentOf(code, node.start);
      const parts = node.body.map((st) => code.slice(st.start, st.end));
      const between = code.slice(node.start + 1, node.end - 1).replace(parts.join(''), '');
      if (/\/[/*]/.test(between)) { continue; }
      edits.push({ start: node.start, end: node.end, text: `{\n${parts.map((p) => `${indent}  ${p}`).join('\n')}\n${indent}}` });
    }
    return apply(code, edits);
  }
  for (const { kind, node } of violations) {
    const stmt = kind === 'if' ? node.consequent : node.alternate;
    // where the statement's lead-in ends: right after the `)` of the condition, or right after the `else` keyword
    let lead = stmt.start;
    while (lead > 0 && /\s/.test(code[lead - 1])) { lead -= 1; }
    const indent = kind === 'if' ? indentOf(code, node.start) : indentOf(code, lead - 'else'.length);
    const inner = code.slice(stmt.start, stmt.end).replace(/\n/g, '\n  ');
    edits.push({ start: lead, end: stmt.end, text: ` {\n${indent}  ${inner}\n${indent}}` });
    // `}` and `else` belong on one line: `} else {`
    const closed = kind === 'if' ? stmt : node.consequent; // the end of the branch before the `else`
    if (node.alternate && (kind === 'if' || closed.type === 'BlockStatement')) {
      const gap = code.slice(closed.end, code.indexOf('else', closed.end));
      if (/^\s*\n\s*$/.test(gap)) { edits.push({ start: closed.end, end: closed.end + gap.length, text: ' ' }); }
    }
  }
  return apply(code, edits);
};

// apply from the end so earlier positions stay valid; skip an edit that overlaps one already applied (the next pass redoes it)
const apply = (code, edits) => {
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let out = code; let floor = Infinity;
  for (const e of edits) {
    if (e.end > floor) { continue; }
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    floor = e.start;
  }
  return out;
};

let total = 0, fixedFiles = 0;
for (const file of targets.flatMap(listFiles)) {
  let code = fs.readFileSync(file, 'utf8');
  if (SKIP_OLD && /^\s*\/\/ @ts-nocheck/.test(code)) { continue; }
  let violations;
  try { violations = find(parseFile(code, file)); }
  catch (e) { console.error(`cannot parse ${file}: ${e.message}`); process.exitCode = 2; continue; }
  if (!violations.length) { continue; }
  if (!FIX) {
    total += violations.filter((v) => v.kind !== 'block').length;
    for (const { kind, node } of violations) {
      if (kind === 'block') { continue; } // reported through the if inside it
      console.log(`${file}:${lineOf(code, (kind === 'if' ? node.consequent : node.alternate).start)}  ${kind} without braces`);
    }
    continue;
  }
  for (let pass = 0; pass < 8 && violations.length; pass += 1) {
    code = fixOnce(code, violations);
    violations = find(parseFile(code, file));
  }
  fs.writeFileSync(file, code);
  fixedFiles += 1;
  if (violations.length) { console.error(`${file}: ${violations.length} could not be fixed automatically`); process.exitCode = 1; }
}
if (FIX) { console.log(`fixed ${fixedFiles} file(s)`); }
else if (total) { console.log(`\n${total} if/else without braces. Fix them (or run with --fix).`); process.exitCode = 1; }
else { console.log('OK: every if/else has braces.'); }
