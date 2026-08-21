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
function statement(raw, line) {
  const s = raw.trim();
  if (!s.endsWith(';')) throw new StylppError('Every statement must end with ;', line);
  return s.slice(0, -1).trim();
}

function parse(source) {
  const root = { type: 'root', children: [], line: 0 };
  const stack = [{ indent: -1, node: root }];
  for (const [index, original] of normalize(source).split('\n').entries()) {
    const lineNo = index + 1;
    const raw = original.replace(/\/\/.*$/, '');
    if (!raw.trim()) continue;
    const indent = indentOf(raw);
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].node;
    const text = statement(raw, lineNo);

    if (text === 'variables') {
      const n = { type: 'variables', children: [], line: lineNo }; parent.children.push(n); stack.push({ indent, node: n }); continue;
    }
    let m = text.match(/^for\s+([A-Za-z_][\w-]*)\s+in\s+(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)$/);
    if (m) {
      const n = { type: 'for', name: m[1], start: Number(m[2]), end: Number(m[3]), children: [], line: lineNo };
      parent.children.push(n); stack.push({ indent, node: n }); continue;
    }
    if (text.startsWith('if ')) {
      const n = { type: 'if', condition: text.slice(3).trim(), children: [], line: lineNo };
      parent.children.push(n); stack.push({ indent, node: n }); continue;
    }
    if (/^@(media|supports|container|layer|keyframes|font-face|page)\b/.test(text)) {
      const n = { type: 'atrule', header: text, children: [], line: lineNo };
      parent.children.push(n); stack.push({ indent, node: n }); continue;
    }
    const pm = text.match(/^([-\w]+)\s+(.+)$/);
    const isProperty = pm && !/^[.#:\[]/.test(text) && !/^[a-zA-Z_*][\w-]*\s*[.#:\[]/.test(text);
    if (isProperty) parent.children.push({ type: 'property', name: pm[1], value: pm[2], line: lineNo });
    else {
      const n = { type: 'selector', selector: text, children: [], line: lineNo };
      parent.children.push(n); stack.push({ indent, node: n });
    }
  }
  return root;
}

function parseNumber(value) {
  const m = String(value).trim().match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))([a-zA-Z%]*)$/);
  return m ? { n: Number(m[1]), unit: m[2] } : null;
}

function valueOf(value, env) {
  let v = String(value).replace(/\b([A-Za-z_][\w-]*)\b/g, (name) => Object.prototype.hasOwnProperty.call(env, name) ? env[name] : name);
  v = v.replace(/var\(\s*([A-Za-z_][\w-]*)\s*\)/g, (_, name) => `var(--${name})`);
  const parts = v.match(/^(.+?)\s*([+*/-])\s*(.+)$/);
  if (!parts) return v;
  const [, left, op, right] = parts;
  const a = parseNumber(left); const b = parseNumber(right);
  if (!a || !b) return `calc(${left.trim()} ${op} ${right.trim()})`;
  if (op === '+') {
    if (a.unit !== b.unit) return `calc(${left.trim()} + ${right.trim()})`;
    return `${a.n + b.n}${a.unit}`;
  }
  if (op === '-') {
    if (a.unit !== b.unit) return `calc(${left.trim()} - ${right.trim()})`;
    return `${a.n - b.n}${a.unit}`;
  }
  if (op === '*') {
    if (a.unit && b.unit) return `calc(${left.trim()} * ${right.trim()})`;
    return `${a.n * b.n}${a.unit || b.unit}`;
  }
  if (b.n === 0) throw new StylppError('Division by zero');
  if (b.unit) return `calc(${left.trim()} / ${right.trim()})`;
  return `${a.n / b.n}${a.unit}`;
}

function interpolate(text, env) { return String(text).replace(/\{([A-Za-z_][\w-]*)\}/g, (_, k) => env[k] ?? `{${k}}`); }
function enabled(condition, env) {
  let c = interpolate(condition, env).trim();
  if (c.startsWith('!')) return !enabled(c.slice(1), env);
  if (c === 'dark-mode') return env['dark-mode'] === true || env['dark-mode'] === 'true' || env['dark-mode'] === 1 || env['dark-mode'] === '1';
  if (c === 'light-mode') return env['light-mode'] === true || env['light-mode'] === 'true' || env['light-mode'] === 1 || env['light-mode'] === '1';
  return Boolean(env[c]);
}

function joinSelector(parent, child) {
  if (!parent) return child;
  if (child.includes('&')) return child.replace(/&/g, parent);
  if (/^[:\[]/.test(child)) return `${parent}${child}`;
  return `${parent} ${child}`;
}

function compile(source, options = {}) {
  const ast = parse(source);
  const env = { ...(options.defines || {}) };
  const variables = {};
  const rules = [];

  for (const n of ast.children) if (n.type === 'variables') {
    for (const c of n.children) {
      if (c.type !== 'property') throw new StylppError('Only name/value declarations are allowed inside variables;', c.line);
      variables[c.name] = interpolate(c.value, env);
      env[c.name] = variables[c.name];
    }
  }

  function selectorsFor(parents, selector) {
    const children = selector.split(',').map(s => s.trim());
    if (!parents.length) return children;
    return parents.flatMap(p => children.map(c => joinSelector(p, c)));
  }

  function emit(nodes, envNow, parents, wrappers) {
    for (const n of nodes) {
      if (n.type === 'variables') continue;
      if (n.type === 'for') {
        const step = n.start <= n.end ? 1 : -1;
        for (let i = n.start; step > 0 ? i <= n.end : i >= n.end; i += step) emit(n.children, { ...envNow, [n.name]: i }, parents, wrappers);
        continue;
      }
      if (n.type === 'if') { if (enabled(n.condition, envNow)) emit(n.children, envNow, parents, wrappers); continue; }
      if (n.type === 'selector') {
        const selectors = selectorsFor(parents, interpolate(n.selector, envNow));
        const properties = n.children.filter(c => c.type === 'property');
        if (properties.length) rules.push({ selectors, properties, env: envNow, wrappers, line: n.line });
        emit(n.children.filter(c => c.type !== 'property'), envNow, selectors, wrappers);
        continue;
      }
      if (n.type === 'atrule') {
        const properties = n.children.filter(c => c.type === 'property');
        if (properties.length && parents.length) rules.push({ selectors: parents, properties, env: envNow, wrappers: [...wrappers, interpolate(n.header, envNow)], line: n.line });
        emit(n.children.filter(c => c.type !== 'property'), envNow, parents, [...wrappers, interpolate(n.header, envNow)]);
      }
    }
  }
  emit(ast.children, env, [], []);

  const out = [];
  if (Object.keys(variables).length) {
    out.push(':root {');
    for (const [name, raw] of Object.entries(variables)) out.push(`  --${name}: ${valueOf(raw, env)};`);
    out.push('}');
  }
  for (const rule of rules) {
    let block = `${rule.selectors.join(', ')} {\n`;
    block += rule.properties.map(p => `  ${p.name}: ${valueOf(interpolate(p.value, rule.env), rule.env)};`).join('\n');
    block += '\n}';
    for (let i = rule.wrappers.length - 1; i >= 0; i--) block = `${rule.wrappers[i]} {\n${block.split('\n').map(line => `  ${line}`).join('\n')}\n}`;
    out.push(block);
  }
  let css = out.join('\n');
  if (options.minify) css = minify(css);
  const result = { css };
  if (options.sourceMap) result.map = JSON.stringify({ version: 3, file: options.file || '', sources: [options.source || 'input.stylpp'], names: [], mappings: '' });
  return result;
}

function minify(css) { return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>])\s*/g, '$1').replace(/;}/g, '}').trim(); }

function lint(source) {
  try { parse(source); return { ok: true, errors: [] }; }
  catch (e) { return { ok: false, errors: [e.message] }; }
}

function format(source) {
  const ast = parse(source), out = [];
  function walk(nodes, depth) {
    for (const n of nodes) {
      const pad = ' '.repeat(depth);
      if (n.type === 'variables') { out.push(`${pad}variables;`); walk(n.children, depth + 4); }
      else if (n.type === 'property') out.push(`${pad}${n.name} ${n.value};`);
      else if (n.type === 'selector') { out.push(`${pad}${n.selector};`); walk(n.children, depth + 4); }
      else if (n.type === 'for') { out.push(`${pad}for ${n.name} in ${n.start} to ${n.end};`); walk(n.children, depth + 4); }
      else if (n.type === 'if') { out.push(`${pad}if ${n.condition};`); walk(n.children, depth + 4); }
      else if (n.type === 'atrule') { out.push(`${pad}${n.header};`); walk(n.children, depth + 4); }
    }
  }
  walk(ast.children, 0); return out.join('\n') + (out.length ? '\n' : '');
}

function compileFile(input, output, options = {}) {
  const source = fs.readFileSync(input, 'utf8');
  const result = compile(source, { ...options, source: path.basename(input), file: path.basename(output) });
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, result.css + (result.css.endsWith('\n') ? '' : '\n'));
  if (result.map) fs.writeFileSync(`${output}.map`, result.map);
  return result;
}

module.exports = { StylppError, parse, compile, compileFile, lint, format, minify };
