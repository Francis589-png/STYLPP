const { Signal, UINode } = require('./ui');
const { Spring, Body } = require('./physics');

class RuntimeDslError extends Error {
  constructor(message, line) { super(line ? `STYL++ runtime line ${line}: ${message}` : message); this.name = 'RuntimeDslError'; this.line = line; }
}

function parseValue(value) {
  const v = String(value).trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null') return null;
  const n = Number(v); if (Number.isFinite(n)) return n;
  return v.replace(/^['"]|['"]$/g, '');
}

function compileRuntime(source, { root = new UINode('root') } = {}) {
  const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
  const stack = [{ indent: -1, node: root, kind: 'root' }];
  const signals = new Map(); const springs = []; const bodies = []; const handlers = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].replace(/\/\/.*$/, ''); if (!raw.trim()) continue;
    const indent = raw.replace(/\t/g, '    ').length - raw.trimStart().length;
    while (stack.length > 1 && indent <= stack.at(-1).indent) stack.pop();
    const text = raw.trim(); if (!text.endsWith(';')) throw new RuntimeDslError('Runtime declarations must end with ;', i + 1);
    const statement = text.slice(0, -1).trim(); const parent = stack.at(-1);
    const parts = statement.split(/\s+/); const keyword = parts[0];
    if (['app','view','button','text','input','image','row','column','stack','grid','scroll','overlay','card'].includes(keyword)) {
      const node = new UINode(keyword); parent.node.append(node); stack.push({ indent, node, kind: 'node' }); continue;
    }
    if (keyword === 'id') { parent.node.attr('id', parts.slice(1).join(' ')); continue; }
    if (keyword === 'state') {
      if (parts.length < 3) throw new RuntimeDslError('state requires a name and value', i + 1);
      const name = parts[1], value = parseValue(parts.slice(2).join(' ')); signals.set(name, new Signal(value)); continue;
    }
    if (keyword === 'spring') { const spring = new Spring(); springs.push(spring); stack.push({ indent, node: parent.node, kind: 'spring', spring }); continue; }
    if (keyword === 'physics') { const body = new Body(); bodies.push(body); stack.push({ indent, node: parent.node, kind: 'physics', body }); continue; }
    if (keyword === 'on') {
      if (parts.length < 2) throw new RuntimeDslError('on requires an event name', i + 1);
      const event = parts[1], body = parts.slice(2).join(' '); handlers.push({ node: parent.node, event, body, line: i + 1 }); continue;
    }
    const target = parent.kind === 'spring' ? parent.spring : parent.kind === 'physics' ? parent.body : parent.node;
    if (keyword === 'stiffness' || keyword === 'damping' || keyword === 'mass' || keyword === 'velocity' || keyword === 'target' || keyword === 'value') { target[keyword] = parseValue(parts.slice(1).join(' ')); continue; }
    if (keyword === 'gravity') { const x = parseValue(parts[1] || '0'), y = parseValue(parts[2] || '0'); target.gravity = { x, y }; continue; }
    if (keyword === 'width' || keyword === 'height' || keyword === 'gap' || keyword === 'padding' || keyword === 'layout') { parent.node.attr(keyword, parseValue(parts.slice(1).join(' '))); continue; }
    throw new RuntimeDslError(`Unknown runtime declaration: ${keyword}`, i + 1);
  }
  return { root, signals, springs, bodies, handlers };
}

module.exports = { RuntimeDslError, compileRuntime, parseValue };
