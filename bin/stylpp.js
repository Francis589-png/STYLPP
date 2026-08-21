#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const http = require('http');
const { compileFile, lint, format } = require('../src');

function usage(code = 0) {
  console.log(`STYL++ 0.2.0\n\nUsage:\n  stylpp compile <input.stylpp> <output.css> [--minify] [--source-map] [--define key=value]\n  stylpp lint <files...>\n  stylpp format <files...> [--write]\n  stylpp watch <input.stylpp> <output.css>\n  stylpp serve [--port 3000] [--root .]\n`);
  process.exit(code);
}
function flags(args) {
  const result = { defines: {} };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--minify') result.minify = true;
    else if (args[i] === '--source-map') result.sourceMap = true;
    else if (args[i] === '--write') result.write = true;
    else if (args[i] === '--port') { result.port = Number(args[++i]); if (!Number.isInteger(result.port) || result.port < 1 || result.port > 65535) throw new Error('port must be an integer from 1 to 65535'); }
    else if (args[i] === '--root') result.root = args[++i];
    else if (args[i] === '--define') { const raw = args[++i]; if (!raw || !raw.includes('=')) throw new Error('--define requires key=value'); const [k, v = 'true'] = String(raw).split('='); if (!k) throw new Error('--define requires a non-empty key'); result.defines[k] = v === 'true' ? true : v === 'false' ? false : v; }
    else throw new Error(`Unknown option: ${args[i]}`);
  }
  return result;
}
const args = process.argv.slice(2); const command = args.shift();
if (!command || command === '--help' || command === '-h') usage();
try {
  if (command === 'compile') { const input=args.shift(), output=args.shift(); if(!input||!output) usage(1); const result=compileFile(input,output,flags(args)); console.log(`Compiled ${input} -> ${output}${result.map?' + source map':''}`); }
  else if (command === 'lint') { const files=args; if(!files.length) usage(1); let failed=false; for(const file of files){const result=lint(fs.readFileSync(file,'utf8'));if(result.ok)console.log(`✓ ${file}`);else{failed=true;console.error(`✗ ${file}`);result.errors.forEach(e=>console.error(`  ${e}`));}} process.exitCode=failed?1:0; }
  else if (command === 'format') { const opts=flags(args.filter(a=>a==='--write')); const files=args.filter(a=>a!=='--write'); if(!files.length) usage(1); for(const file of files){const formatted=format(fs.readFileSync(file,'utf8'));if(opts.write)fs.writeFileSync(file,formatted);else process.stdout.write(formatted);} }
  else if (command === 'watch') { const input=args.shift(),output=args.shift(); if(!input||!output) usage(1); const opts=flags(args); let timer; const build=()=>{clearTimeout(timer);timer=setTimeout(()=>{try{compileFile(input,output,opts);console.log(`[STYL++] ${new Date().toLocaleTimeString()} compiled`);}catch(e){console.error(e.message);}},25);}; build(); fs.watch(input,{persistent:true},build); console.log(`Watching ${input}`); }
  else if (command === 'serve') { const opts=flags(args),root=path.resolve(opts.root||process.cwd()),port=opts.port||3000; const server=http.createServer((req,res)=>{let urlPath;try{urlPath=decodeURIComponent((req.url||'/').split('?')[0]);}catch{res.writeHead(400);return res.end('Bad request');}const file=path.resolve(root,'.'+(urlPath==='/'?'/index.html':urlPath));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden');}fs.readFile(file,(err,data)=>{if(err){res.writeHead(err.code==='ENOENT'?404:500);return res.end(err.code==='ENOENT'?'Not found':'Server error');}const ext=path.extname(file);const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});res.end(data);});});server.listen(port,()=>console.log(`STYL++ server: http://localhost:${port}`)); }
  else usage(1);
} catch(error){console.error(error.stack||error.message);process.exitCode=1;}
