const fs=require('fs');const path=require('path');
const parser=require('@babel/parser');const traverse=require('@babel/traverse').default;
const src=fs.readFileSync('work/module.js','utf8');
const ast=parser.parse(src,{sourceType:'module',attachComment:true});

// [startLine, module]
const MAP=[[1,'firebase'],[31,'assistant'],[36,'push'],[108,'settings-menu'],[126,'push'],[199,'firebase'],[211,'config'],[233,'session'],
[304,'firestore-helpers'],[343,'session'],[355,'splash'],[375,'presence'],[407,'section'],[494,'utils'],[512,'photos'],[624,'auth'],[654,'phone-rows'],
[702,'auth'],[934,'profile-complete'],[1010,'app-shell'],[1177,'legacy-migration'],[1255,'approvals'],[1327,'app-shell'],[1367,'students'],
[1434,'maintenance'],[1560,'stars'],[1626,'students'],[1725,'attendance'],[1849,'qr-scanner'],[1986,'export'],[2149,'id-cards'],[2257,'students'],
[2263,'dashboard'],[2558,'attendance'],[2608,'voice'],[2700,'assistant'],[3251,'student-profile'],[3496,'deacons'],[3550,'parts'],[3756,'deacons'],
[3797,'servants'],[4082,'import-attendance'],[4269,'import-students'],[4307,'import-creds'],[4853,'import-students'],[5098,'deacons-tab'],
[5560,'student-edit'],[5635,'tabs'],[5662,'stats'],[5882,'online'],[5965,'deacon-attendance'],[6236,'online'],[6284,'ui']];
const modOf=line=>{let m=null;for(const [l,n] of MAP){if(l<=line)m=n;else break;}return m;};

const body=ast.program.body;
const stmts=body.filter(n=>n.type!=='ImportDeclaration');
const imports=body.filter(n=>n.type==='ImportDeclaration');
const importMap={}; // local -> {source, imported}
for(const d of imports){const s=d.source.value.replace(/^.*firebasejs\/[\d.]+\/firebase-([a-z-]+)\.js$/,'firebase/$1');
  for(const sp of d.specifiers) importMap[sp.local.name]={source:s,imported:sp.imported.name};}

// statement -> module
const stmtMod=new Map();for(const n of stmts)stmtMod.set(n,modOf(n.loc.start.line));
const topOf=p=>{let x=p;while(x.parentPath&&x.parentPath.node!==ast.program)x=x.parentPath;return x.node;};

let programScope;traverse(ast,{Program(p){programScope=p.scope;p.stop();}});
// top-level bindings
const bindings={}; // name -> {module, kind, node(stmt), declKind}
for(const [name,b] of Object.entries(programScope.bindings)){
  if(b.kind==='module')continue;
  const stmt=topOf(b.path);
  bindings[name]={name,binding:b,stmt,module:stmtMod.get(stmt),kind:b.kind};
}
// which lets need state
const stateVars=new Set();
for(const [name,info] of Object.entries(bindings)){
  if(info.kind!=='let'&&info.kind!=='var')continue;
  for(const cv of info.binding.constantViolations){
    if(stmtMod.get(topOf(cv))!==info.module){stateVars.add(name);break;}
  }
}
// collect edits
const edits=[]; // {start,end,text}
const usage={}; // module -> {imports:Set(firebase locals), cross:Map(name->module), state:bool}
const use=m=>usage[m]||(usage[m]={fb:new Set(),cross:new Set(),state:false});
const needExport=new Set();
const eager=[];
const seen=new Set();
function addEdit(node,text){const k=node.start+':'+node.end;if(seen.has(k))return;seen.add(k);edits.push({start:node.start,end:node.end,text});}

traverse(ast,{
  Identifier(p){
    const name=p.node.name;
    const b=p.scope.getBinding(name);
    let isRef=p.isReferencedIdentifier();
    let isWrite=false;
    if(!isRef){
      // assignment targets / update / for-of lhs
      const par=p.parent;
      if(b&&stateVars.has(name)&&b===programScope.bindings[name]){
        // check if it's in a constantViolation
        if(b.constantViolations.some(cv=>{const ids=cv.getBindingIdentifiers?cv.getBindingIdentifiers():{};return false;})){}
      }
    }
    if(!b)return;
    const top=topOf(p);
    if(top.type==='ImportDeclaration')return;
    const curMod=stmtMod.get(top);
    if(b===programScope.bindings[name]&&b.kind==='module'){
      if(isRef||isAssignTarget(p)) use(curMod).fb.add(name);
      return;
    }
    if(b!==programScope.bindings[name])return;
    const info=bindings[name];
    if(!info)return;
    const target=isRef||isAssignTarget(p);
    if(!target)return;
    // skip the declaration's own id
    if(p.parent.type==='VariableDeclarator'&&p.parent.id===p.node)return;
    if(stateVars.has(name)){
      use(curMod).state=true;
      if(p.parent.type==='ObjectProperty'&&p.parent.shorthand&&p.parent.value===p.node){
        // handled by key edit: replace whole property
        addEdit(p.parent,`${name}: state.${name}`);
      } else addEdit(p.node,`state.${name}`);
    } else if(info.module!==curMod){
      use(curMod).cross.add(name);needExport.add(name);
      const fp=p.getFunctionParent();
      let outer=fp;while(outer&&outer.getFunctionParent())outer=outer.getFunctionParent();
      const iife=outer&&outer.parent&&outer.parent.type==='CallExpression'&&outer.parent.callee===outer.node;
      if(!fp||iife)eager.push(`${curMod}.ts line ${p.node.loc.start.line}: eager use of ${name} (from ${info.module})`);
    }
  }
});
function isAssignTarget(p){
  const par=p.parent;
  if(par.type==='AssignmentExpression'&&par.left===p.node)return true;
  if(par.type==='UpdateExpression')return true;
  // pattern inside assignment: ArrayPattern / ObjectPattern property value
  let x=p,cur=p.parentPath;
  while(cur&&(cur.node.type==='ArrayPattern'||cur.node.type==='ObjectPattern'||cur.node.type==='RestElement'||(cur.node.type==='ObjectProperty'&&cur.parent.type==='ObjectPattern')||cur.node.type==='AssignmentPattern')){x=cur;cur=cur.parentPath;}
  if(x!==p&&cur&&cur.node.type==='AssignmentExpression'&&cur.node.left===x.node)return true;
  if(cur&&(cur.node.type==='ForOfStatement'||cur.node.type==='ForInStatement')&&cur.node.left===x.node&&x.node.type!=='VariableDeclaration')return true;
  return false;
}
// export flags for declarations
const declExport=new Map(); // stmt -> true
for(const n of needExport){const info=bindings[n];if(info&&!stateVars.has(n))declExport.set(info.stmt,true);}

// state.ts entries
const stateEntries=[];
for(const name of stateVars){
  const info=bindings[name];const decl=info.binding.path.node; // VariableDeclarator
  const init=decl.init?src.slice(decl.init.start,decl.init.end):'undefined';
  const ch0=info.stmt; let cm='';
  const nx=stmts[stmts.indexOf(info.stmt)+1];
  const tcs=[...(info.stmt.trailingComments||[]),...((nx&&nx.leadingComments)||[])].filter(c=>c.loc.start.line===info.stmt.loc.end.line&&c.start>=info.stmt.end);
  if(tcs.length)cm=[...new Map(tcs.map(c=>[c.start,c.value.trim()])).values()].join(' ');
  stateEntries.push({name,init,stmt:info.stmt,decl,cm});
}
// removal of declarations of state vars
const removeDecl=[];
const stateStmtCount=new Map();
for(const e of stateEntries){stateStmtCount.set(e.stmt,(stateStmtCount.get(e.stmt)||0)+1);}
const mixed=[];
for(const [stmt,c] of stateStmtCount){if(stmt.declarations.length!==c)mixed.push(stmt.loc.start.line);}
if(mixed.length)console.error('MIXED DECLARATIONS at',mixed);

// build modules
const lines=src.split('\n');
const lineStart=[0];for(let i=0;i<src.length;i++)if(src[i]==='\n')lineStart.push(i+1);
const lineEndOf=off=>{const i=src.indexOf('\n',off);return i<0?src.length:i;};
const outputs={};const order=[];
let prevEndLine=0;
const stmtChunk=new Map();
for(let i=0;i<stmts.length;i++){
  const n=stmts[i];
  let start=n.start;
  const lc=(n.leadingComments||[]).filter(c=>c.loc.start.line>prevEndLine);
  if(lc.length)start=lc[0].start;
  let end=n.end;
  // same-line trailing comment
  const tc=[...(n.trailingComments||[]),...((stmts[i+1]&&stmts[i+1].leadingComments)||[])].filter(c=>c.loc.start.line===n.loc.end.line&&c.start>=n.end);
  if(tc.length)end=Math.max(end,...tc.map(c=>c.end));
  stmtChunk.set(n,{start,end});
  prevEndLine=n.loc.end.line;
  if(tc.length)prevEndLine=Math.max(prevEndLine,...tc.map(c=>c.loc.end.line));
}
for(const n of stmts){
  if(stateVars.size&&n.type==='VariableDeclaration'&&stateStmtCount.get(n)===n.declarations.length){
    // whole statement is state — keep only leading comments that are section headers? drop statement text, keep leading comments
    const ch=stmtChunk.get(n);
    const lead=src.slice(ch.start,n.start).trim();
    if(lead&&/^\/\/ ={3,}/m.test(lead)) (outputs[stmtMod.get(n)]||(outputs[stmtMod.get(n)]=[])).push(lead);
    continue;
  }
  const m=stmtMod.get(n);
  if(!outputs[m]){outputs[m]=[];order.push(m);}
  const ch=stmtChunk.get(n);
  let text=src.slice(ch.start,ch.end);
  const es=edits.filter(e=>e.start>=ch.start&&e.end<=ch.end).sort((a,b)=>b.start-a.start);
  for(const e of es)text=text.slice(0,e.start-ch.start)+e.text+text.slice(e.end-ch.start);
  if(declExport.get(n)){
    const off=n.start-ch.start;
    // account for edits before n.start (leading comments have no edits)
    text=text.slice(0,off)+'export '+text.slice(off);
  }
  outputs[m].push(text);
}
if(!order.includes('state'))order.push('state');
// firebase import lines
const fbBySource=(names)=>{const g={};for(const nm of names){const i=importMap[nm];(g[i.source]=g[i.source]||[]).push(nm);}return Object.entries(g).map(([s,ns])=>`import { ${ns.join(', ')} } from '${s}';`);};
fs.mkdirSync('out',{recursive:true});
const report=[];
for(const m of order){
  if(m==='state')continue;
  const u=usage[m]||{fb:new Set(),cross:new Set(),state:false};
  const head=['// @ts-nocheck'];
  head.push(...fbBySource([...u.fb]));
  if(u.state)head.push(`import { state } from './state';`);
  const by={};for(const n of u.cross){(by[bindings[n].module]=by[bindings[n].module]||[]).push(n);}
  for(const [mod,ns] of Object.entries(by))head.push(`import { ${ns.sort().join(', ')} } from './${mod}';`);
  let text=head.join('\n')+'\n\n'+(outputs[m]||[]).join('\n\n')+'\n';
  text=text.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-([a-z-]+)\.js/g,'firebase/$1');
  fs.writeFileSync(`out/${m}.ts`,text);
  report.push(`${m}.ts\t${text.split('\n').length} lines`);
}
// state.ts
const st=['// @ts-nocheck','// Shared mutable state (was module-level `let` variables in the single-file script).','export const state = {'];
for(const e of stateEntries){st.push(`  ${e.name}: ${e.init.replace(/\n/g,'\n  ')},${e.cm?' // '+e.cm:''}`);}
st.push('};','');
fs.writeFileSync('out/state.ts',st.join('\n'));
fs.writeFileSync('out/main.ts',order.filter(m=>m!=='state').map(m=>`import './${m}';`).join('\n')+'\n');
console.log(report.join('\n'));
console.log('\nSTATE VARS ('+stateVars.size+'):',[...stateVars].join(', '));
console.log('\nEAGER cross-module refs:\n'+eager.join('\n'));
console.log('\nstate init w/ identifiers:');
for(const e of stateEntries)if(/[A-Za-z_]\w*\(|\b[A-Z_]{3,}\b/.test(e.init))console.log(' ',e.name,'=',e.init.slice(0,80));
