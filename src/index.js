const fs = require('fs');
const path = require('path');

class StylppError extends Error {
  constructor(message, line) {
    super(line ? `STYL++ line ${line}: ${message}` : message);
    this.name = 'StylppError';
    this.line = line;
  }
}

function normalize(source) { return String(source).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'); }
function indentOf(line) { return line.replace(/\t/g, '    ').length - line.trimStart().length; }
function statement(raw, line) { const s = raw.trim(); if (!s.endsWith(';')) throw new StylppError('Every statement must end with ;', line); return s.slice(0, -1).trim(); }
function parse(source) {
  const lines = normalize(source).split('\n'), root = { type: 'root', children: [], line: 0 }, stack = [{ indent: -1, node: root }];
  for (let n = 0; n < lines.length; n++) { const raw = lines[n]; if (!raw.trim() || raw.trim().startsWith('//')) continue; const indent = indentOf(raw), s = statement(raw, n + 1); while (indent <= stack.at(-1).indent) stack.pop(); const parent = stack.at(-1).node;
    if (s === 'variables') { const node={type:'variables',children:[],line:n+1}; parent.children.push(node); stack.push({indent,node}); continue; }
    const fm=s.match(/^for\s+([A-Za-z_]\w*)\s+in\s+(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)$/); if(fm){const node={type:'for',name:fm[1],start:Number(fm[2]),end:Number(fm[3]),children:[],line:n+1};parent.children.push(node);stack.push({indent,node});continue;}
    if(/^if\s+/.test(s)){const node={type:'if',condition:s.slice(3).trim(),children:[],line:n+1};parent.children.push(node);stack.push({indent,node});continue;}
    if(/^@(media|supports|container|layer|keyframes|font-face|page)\b/.test(s)){const node={type:'atrule',header:s,children:[],line:n+1};parent.children.push(node);stack.push({indent,node});continue;}
    const property=/^[-\w]+\s+.+$/.test(s) && !/^(body|html|head|main|section|article|header|footer|button|input|ul|ol|li|a|nav|p|h[1-6])\b/.test(s); if(property){const i=s.search(/\s/);parent.children.push({type:'property',name:s.slice(0,i),value:s.slice(i).trim(),line:n+1});} else {const node={type:'selector',selector:s,children:[],line:n+1};parent.children.push(node);stack.push({indent,node});}
  } return root;
}
function num(v){const m=String(v).trim().match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))([A-Za-z%]*)$/);return m?{number:Number(m[1]),unit:m[2]}:null;}
function evaluateMath(value,env){let v=String(value).replace(/\b([A-Za-z_]\w*)\b/g,m=>Object.prototype.hasOwnProperty.call(env,m)?env[m]:m).replace(/var\(\s*([\w-]+)\s*\)/g,(_,n)=>`var(--${n})`);const m=v.match(/^(-?[\d.]+[A-Za-z%]*)\s*([+*/-])\s*(-?[\d.]+[A-Za-z%]*)$/);if(!m)return v;const a=num(m[1]),b=num(m[3]);if(!a||!b)return v;if((m[2]=='+'||m[2]=='-')&&a.unit===b.unit)return `${m[2]=='+'?a.number+b.number:a.number-b.number}${a.unit}`;if(m[2]=='*'&&!a.unit!==!b.unit)return `${a.number*b.number}${a.unit||b.unit}`;if(m[2]=='/'&&!b.unit){if(!b.number)throw new StylppError('Division by zero');return `${a.number/b.number}${a.unit}`}return `calc(${m[1]} ${m[2]} ${m[3]})`;}
function interpolate(text,env){return String(text).replace(/\{([A-Za-z_]\w*)\}/g,(_,k)=>env[k]??`{${k}}`);}
function conditionEnabled(c,defines){c=c.trim();if(c.startsWith('!'))return !conditionEnabled(c.slice(1),defines);return defines[c]===true||defines[c]==='true'||defines[c]==='1';}
function compile(source,options={}){const ast=parse(source),env={...(options.defines||{})},vars={},rules=[];for(const n of ast.children)if(n.type==='variables')for(const c of n.children){if(c.type!=='property')throw new StylppError('Only variable declarations are allowed inside variables;',c.line);vars[c.name]=c.value;}Object.assign(env,vars);
 function expand(nodes,local,parents,wrappers){for(const n of nodes){if(n.type==='variables')continue;if(n.type==='for'){const step=n.start<=n.end?1:-1;for(let i=n.start;step>0?i<=n.end:i>=n.end;i+=step)expand(n.children,{...local,[n.name]:i},parents,wrappers);continue;}if(n.type==='if'){if(conditionEnabled(interpolate(n.condition,local),local))expand(n.children,local,parents,wrappers);continue;}if(n.type==='atrule'){expand(n.children,local,parents,[...wrappers,interpolate(n.header,local)]);continue;}if(n.type==='selector'){const sel=interpolate(n.selector,local),full=parents.length?parents.flatMap(p=>p.split(',').flatMap(a=>sel.split(',').map(b=>`${a.trim()} ${b.trim()}`))):sel.split(',').map(x=>x.trim()),props=n.children.filter(c=>c.type==='property');if(props.length)rules.push({selectors:full,props,wrappers:[...wrappers],env:{...local},line:n.line});expand(n.children.filter(c=>c.type!=='property'),local,full,wrappers);}}}expand(ast.children,env,[],[]);
 const out=[];if(Object.keys(vars).length){out.push(':root {');for(const[k,v]of Object.entries(vars))out.push(`  --${k}: ${evaluateMath(v,env)};`);out.push('}');}for(const r of rules){let block=`${r.selectors.join(', ')} {`;for(const p of r.props)block+=`\n  ${p.name}: ${evaluateMath(interpolate(p.value,{...env,...r.env}),{...env,...r.env})};`;block+='\n}';for(let i=r.wrappers.length-1;i>=0;i--)block=`${r.wrappers[i]} {\n${block.split('\n').map(x=>'  '+x).join('\n')}\n}`;out.push(block);}let css=out.join('\n');if(options.minify)css=minify(css);if(options.sourceMap)return{css,map:JSON.stringify({version:3,file:options.file||'',sources:[options.source||'input.stylpp'],names:[],mappings:''})};return{css};}
function minify(css){return css.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\s+/g,' ').replace(/\s*([{}:;,>])\s*/g,'$1').replace(/;}/g,'}').trim();}
function lint(source){const errors=[];try{parse(source);}catch(e){errors.push(e.message);}return{ok:!errors.length,errors};}
function format(source){const ast=parse(source),out=[];function emit(ns,d){for(const n of ns){if(n.type==='property')out.push(' '.repeat(d)+`${n.name} ${n.value};`);else if(n.type==='variables') {out.push(' '.repeat(d)+'variables;');emit(n.children,d+4);}else if(n.type==='selector'){out.push(' '.repeat(d)+n.selector+';');emit(n.children,d+4);}else if(n.type==='for'){out.push(' '.repeat(d)+`for ${n.name} in ${n.start} to ${n.end};`);emit(n.children,d+4);}else if(n.type==='if'){out.push(' '.repeat(d)+`if ${n.condition};`);emit(n.children,d+4);}else if(n.type==='atrule'){out.push(' '.repeat(d)+n.header+';');emit(n.children,d+4);}}}emit(ast.children,0);return out.join('\n')+'\n';}
function compileFile(input,output,options={}){const source=fs.readFileSync(input,'utf8'),result=compile(source,{...options,source:path.basename(input),file:path.basename(output)});fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,result.css+'\n');if(result.map)fs.writeFileSync(`${output}.map`,result.map);return result;}
const physics = require('./physics');
module.exports={compile,parse,lint,format,minify,compileFile,StylppError,...physics};
