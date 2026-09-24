// Minimal client for the Firebase MCP server (read/write Firestore with your own `firebase login`).
// Project id comes from .firebaserc ("default"), so the same script works for the other project.
const { spawn } = require('child_process'); const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const PROJECT = JSON.parse(fs.readFileSync(path.join(ROOT, '.firebaserc'), 'utf8')).projects.default;
const P = `projects/${PROJECT}/databases/(default)/documents`;
const p = spawn('npx', ['-y', 'firebase-tools@latest', 'mcp', '--dir', ROOT, '--only', 'core,firestore'], { stdio: ['pipe', 'pipe', 'pipe'] });
let buf = '', id = 0; const pending = new Map();
p.stdout.setEncoding('utf8'); // decode multi-byte characters across chunk boundaries (otherwise Arabic text can get U+FFFD)
p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!l) continue; try { const m = JSON.parse(l); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } } catch {} } });
const send = (method, params) => new Promise(r => { const i = ++id; pending.set(i, r); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: i, method, params }) + '\n'); });
const call = async (tool, args) => { const r = await send('tools/call', { name: tool, arguments: args }); const t = r.result; if (!t || t.isError) return { error: (t && t.content && t.content[0].text) || JSON.stringify(r.error) }; return t.structuredContent || JSON.parse(t.content[0].text); };
const init = async () => { await send('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'tools', version: '1' } }); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n'); };
const done = code => { p.kill(); process.exit(code); };
async function listAll(col) { const docs = []; let tok; do { const r = await call('firestore_list_documents', { parent: P, collectionId: col, pageSize: 300, pageToken: tok }); if (r.error) throw new Error(col + ': ' + r.error); docs.push(...(r.documents || [])); tok = r.nextPageToken; } while (tok); return docs; }
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS) || 20 * 60 * 1000;   // safety net so a hung run never lingers
setTimeout(() => { console.error('timeout after ' + TIMEOUT_MS / 1000 + 's'); done(1); }, TIMEOUT_MS);

module.exports = { call, init, done, listAll, P };
