const fs = require('fs');
const path = require('path');

class StylppError extends Error {
  constructor(message, line) {
    super(line ? `STYL++ line ${line}: ${message}` : message);
    this.name = 'StylppError';
    this.line = line;
  }
}

function normalize(source) {
  return source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

function stripComments(line) {
  let quote = null;
  for (let i = 0; i < line.length - 1; i++) {
    const c = line[i];
    if ((c === '"' || c === "'") && line[i - 1] !== '\\') quote = quote === c ? null : (quote || c);
    if (!quote && c === '/' && line[i + 1] === '/') return line.slice(0, i);
  }
  return line;
}

function indentOf(line) {
  const expanded = line.replace(/\t/g, '    ');
  return expanded.length - expanded.trimStart().length;
}

function splitStatement(text, line) {
  const s = text.trim();
  if (!s.endsWith(';')) throw new StylppError('Every STYL++ statement must end with ;', line);
  return s.slice(0, -1).trim();
}

function parse(source) {
  const lines = normalize(source).split('\n');
  const root = { type: 'root', children: [], line: 0 };
  const stack = [{ indent: -1, node: root }];
  let variablesNode = null;

  for (let n = 0; n < lines.length; n++) {
    const raw = stripComments(lines[n]);
    if (!raw.trim()) continue;
    const indent = indentOf(raw);
    const statement = splitStatement(raw.trim(), n + 1);
    while (stack.length && indent <= stack[stack.length - 1].indent) stack.pop();
    if (!stack.length) throw new StylppError('Invalid indentation', n + 1);
    const parent = stack[stack.length - 1].node;

    if (statement === 'variables') {
      const node = { type: 'variables', children: [], line: n + 1 };
      parent.children.push(node);
      stack.push({ indent, node });
      variablesNode = node;
      continue;
    }

    if (/^for\s+([A-Za-z_][\w-]*)\s+in\s+(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)$/.test(statement)) {
      const m = statement.match(/^for\s+([A-Za-z_][\w-]*)\s+in\s+(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)$/);
      const node = { type: 'for', name: m[1], start: Number(m[2]), end: Number(m[3]), children: [], line: n + 1 };
      parent.children.push(node); stack.push({ indent, node }); continue;
    }

    if (/^if\s+/.test(statement)) {
      const node = { type: 'if', condition: statement.slice(3).trim(), children: [], line: n + 1 };
      parent.children.push(node); stack.push({ indent, node }); continue;
    }

    if (/^@(media|supports|container|layer|keyframes|font-face|page)\b/.test(statement)) {
      const node = { type: 'atrule', header: statement, children: [], line: n + 1 };
      parent.children.push(node); stack.push({ indent, node }); continue;
    }

    const selectorLike = /^(?:[.#:\[]|[a-zA-Z_*][\w-]*(?:\s*[.#:\[]|$))/.test(statement);
    const propertyLike = /^[-\w]+\s+.+$/.test(statement);
    if (propertyLike && !selectorLike) {
      const firstSpace = statement.search(/\s/);
      const name = statement.slice(0, firstSpace).trim();
      const value = statement.slice(firstSpace).trim();
      parent.children.push({ type: 'property', name, value, line: n + 1 });
    } else {
      const node = { type: 'selector', selector: statement, children: [], line: n + 1 };
      parent.children.push(node); stack.push({ indent, node });
    }
  }
  return root;
}

function parseValueNumber(value) {
  const m = String(value).trim().match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))([a-zA-Z%]*)$/);
  return m ? { number: Number(m[1]), unit: m[2] } : null;
}

function evaluateMath(value, env) {
  let v = value.replace(/\b([A-Za-z_][\w-]*)\b/g, (m) => Object.prototype.hasOwnProperty.call(env, m) ? env[m] : m);
  v = v.replace(/var\(\s*([A-Za-z_][\w-]*)\s*\)/g, (_, name) => `var(--${name})`);
  const exact = v.match(/^(-?[\d.]+[a-zA-Z%]*)\s*([+*/-])\s*(-?[\d.]+[a-zA-Z%]*)$/);
  if (!exact) return v;
  const a = parseValueNumber(exact[1]); const b = parseValueNumber(exact[3]);
  if (!a || !b) return v;
  const op = exact[2];
  if (op === '+' || op === '-') {
    if (a.unit === b.unit) return `${op === '+' ? a.number + b.number : a.number - b.number}${a.unit}`;
    return `calc(${exact[1]} ${op} ${exact[3]})`;
  }
  if (op === '*') {
    if (a.unit && b.unit) return `calc(${exact[1]} * ${exact[3]})`;
    const result = a.unit ? a.number * b.number : a.number * b.number;
    return `${result}${a.unit || b.unit}`;
  }
  if (op === '/') {
    if (b.number === 0) throw new StylppError('Division by zero');
    if (b.unit) return `calc(${exact[1]} / ${exact[3]})`;
    return `${a.number / b.number}${a.unit}`;
  }
  return v;
}

function interpolate(text, env) {
  return text.replace(/\{([A-Za-z_][\w-]*)\}/g, (_, k) => env[k] ?? `{${k}}`);
}

function conditionEnabled(condition, defines) {
  const c = condition.trim();
  if (/^!/.test(c)) return !conditionEnabled(c.slice(1), defines);
  if (defines[c] !== undefined) return String(defines[c]) === 'true' || defines[c] === true || defines[c] === '1';
  if (c === 'dark-mode') return defines['dark-mode'] === true;
  if (c === 'light-mode') return defines['light-mode'] === true;
  return false;
}

function compile(source, options = {}) {
  const ast = parse(source);
  const env = Object.assign({}, options.defines || {});
  const variables = {};
  const rules = [];
  const mappings = [];

  function collectVars(nodes) {
    for (const node of nodes) {
      if (node.type === 'variables') {
        for (const child of node.children) {
          if (child.type !== 'property') throw new StylppError('Only variable declarations are allowed inside variables;', child.line);
          variables[child.name] = interpolate(child.value, env);
        }
      }
    }
  }
  collectVars(ast.children);
  Object.assign(env, variables);

  function expand(nodes, localEnv, parents, wrappers) {
    for (const node of nodes) {
      if (node.type === 'variables') continue;
      if (node.type === 'for') {
        const step = node.start <= node.end ? 1 : -1;
        for (let i = node.start; step > 0 ? i <= node.end : i >= node.end; i += step) {
          expand(node.children, { ...localEnv, [node.name]: i }, parents, wrappers);
        }
        continue;
      }
      if (node.type === 'if') {
        if (conditionEnabled(interpolate(node.condition, localEnv), localEnv)) expand(node.children, localEnv, parents, wrappers);
        continue;
      }
      if (node.type === 'atrule') {
        expand(node.children, localEnv, parents, wrappers.concat(interpolate(node.header, localEnv)));
        continue;
      }
      if (node.type === 'selector') {
        const sel = interpolate(node.selector, localEnv);
        const full = parents.length ? parents.flatMap(p => p.split(',').map(x => x.trim())).flatMap(p => sel.split(',').map(x => `${p} ${x.trim()}`)) : sel.split(',').map(x => x.trim());
        const props = [];
        for (const child of node.children) {
          if (child.type === 'property') props.push(child);
        }
        if (props.length) rules.push({ selectors: full, props, wrappers: [...wrappers], env: { ...localEnv }, line: node.line });
        expand(node.children.filter(c => c.type !== 'property'), localEnv, full, wrappers);
        continue;
      }
    }
  }
  expand(ast.children, env, [], []);

  const cssLines = [];
  if (Object.keys(variables).length) {
    cssLines.push(':root {');
    for (const [name, value] of Object.entries(variables)) cssLines.push(`  --${name}: ${evaluateMath(value, env)};`);
    cssLines.push('}');
  }

  for (const rule of rules) {
    let block = `${rule.selectors.join(', ')} {`;
    for (const p of rule.props) {
      const value = evaluateMath(interpolate(p.value, { ...env, ...rule.env }), { ...env, ...rule.env });
      block += `\n  ${p.name}: ${value};`;
    }
    block += '\n}';
    let wrapped = block;
    for (let i = rule.wrappers.length - 1; i >= 0; i--) wrapped = `${rule.wrappers[i]} {\n${wrapped.split('\n').map(x => '  ' + x).join('\n')}\n}`;
    cssLines.push(wrapped);
    mappings.push(rule.line);
  }

  let css = cssLines.join('\n');
  if (options.minify) css = minify(css);
  if (options.sourceMap) {
    const map = { version: 3, file: options.file || '', sources: [options.source || 'input.stylpp'], names: [], mappings: '' };
    return { css, map: JSON.stringify(map) };
  }
  return { css };
}

function minify(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>])\s*/g, '$1').replace(/;}/g, '}').trim();
}

function lint(source) {
  const errors = [];
  try {
    const ast = parse(source);
    const known = new Set();
    function walk(nodes) {
      for (const n of nodes) {
        if (n.type === 'property') {
          if (!/^--[\w-]+$/.test(n.name) && !/^[a-zA-Z][\w-]*$/.test(n.name)) errors.push(`Line ${n.line}: invalid property name`);
          known.add(n.name);
        }
        if (n.children) walk(n.children);
      }
    }
    walk(ast.children);
  } catch (e) { errors.push(e.message); }
  return { ok: errors.length === 0, errors };
}

function format(source) {
  const ast = parse(source);
  const out = [];
  function emit(nodes, depth) {
    for (const n of nodes) {
      if (n.type === 'variables') { out.push(' '.repeat(depth) + 'variables;'); emit(n.children, depth + 4); }
      else if (n.type === 'property') out.push(' '.repeat(depth) + `${n.name} ${n.value};`);
      else if (n.type === 'for') { out.push(' '.repeat(depth) + `for ${n.name} in ${n.start} to ${n.end};`); emit(n.children, depth + 4); }
      else if (n.type === 'if') { out.push(' '.repeat(depth) + `if ${n.condition};`); emit(n.children, depth + 4); }
      else if (n.type === 'atrule') { out.push(' '.repeat(depth) + `${n.header};`); emit(n.children, depth + 4); }
      else if (n.type === 'selector') { out.push(' '.repeat(depth) + `${n.selector};`); emit(n.children, depth + 4); }
    }
  }
  emit(ast.children, 0); return out.join('\n') + '\n';
}

function compileFile(input, output, options = {}) {
  const source = fs.readFileSync(input, 'utf8');
  const result = compile(source, { ...options, source: path.basename(input), file: path.basename(output) });
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, result.css + (result.css.endsWith('\n') ? '' : '\n'));
  if (result.map) fs.writeFileSync(`${output}.map`, result.map);
  return result;
}

module.exports = { compile, parse, lint, format, minify, compileFile, StylppError };
