const fs=require('fs');const parser=require('@babel/parser');
const src=fs.readFileSync('work/module.js','utf8');
const ast=parser.parse(src,{sourceType:'module',errorRecovery:false});
const rows=[];
for(const n of ast.program.body){
  let names=[];
  if(n.type==='FunctionDeclaration')names=[n.id.name];
  else if(n.type==='VariableDeclaration')names=n.declarations.map(d=>d.id.name||'{pattern}');
  else if(n.type==='ImportDeclaration')names=['import'];
  else if(n.type==='ExpressionStatement'){const e=n.expression;names=[src.slice(e.start,Math.min(e.end,e.start+50)).replace(/\n/g,' ')];}
  else names=[n.type];
  rows.push(`${n.loc.start.line}-${n.loc.end.line}\t${n.type}\t${names.join(',').slice(0,90)}`);
}
fs.writeFileSync('work/table.txt',rows.join('\n'));
console.log(rows.length);
