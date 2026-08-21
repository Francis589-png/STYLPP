const { Signal, UINode } = require('./runtime');
const { Spring, Body } = require('./physics');
const { parse, SyntaxError } = require('./syntax');
class RuntimeDslError extends SyntaxError { constructor(message, line, column = 1) { super(`runtime: ${message}`, line, column); this.name = 'RuntimeDslError'; } }
function parseValue(value) { const v = String(value).trim(); if (v === 'true') return true; if (v === 'false') return false; if (v === 'null') return null; const n = Number(v); if (Number.isFinite(n)) return n; return v.replace(/^['"]|['"]$/g, ''); }
const nodeTypes = new Set(['app','view','button','text','input','image','row','column','stack','grid','scroll','overlay','card']);
function compileRuntime(source, { root = new UINode('root') } = {}) {
  const signals = new Map(), springs = [], bodies = [], handlers = [];
  const ast = parse(source, token => { const [keyword, ...args] = token.tokens;
    if (nodeTypes.has(keyword)) return { type: 'node', keyword, block: true, line: token.line };
    if (keyword === 'id') return { type: 'id', value: args.join(' '), line: token.line };
    if (keyword === 'state') { if (args.length < 2) throw new RuntimeDslError('state requires a name and value', token.line, token.indent + 1); if (signals.has(args[0])) throw new RuntimeDslError(`duplicate state: ${args[0]}`, token.line, token.indent + 1); signals.set(args[0], new Signal(parseValue(args.slice(1).join(' ')))); return { type: 'state', line: token.line }; }
    if (keyword === 'spring') { const spring = new Spring(); springs.push(spring); return { type: 'spring', spring, block: true, line: token.line }; }
    if (keyword === 'physics') { const body = new Body(); bodies.push(body); return { type: 'physics', body, block: true, line: token.line }; }
    if (keyword === 'on') { if (!args[0]) throw new RuntimeDslError('on requires an event name', token.line, token.indent + 1); handlers.push({ event: args[0], body: args.slice(1).join(' '), line: token.line }); return { type: 'on', line: token.line }; }
    if (['stiffness','damping','mass','velocity','target','value','gravity','width','height','gap','padding','layout'].includes(keyword)) return { type: 'property', keyword, args, line: token.line };
    throw new RuntimeDslError(`Unknown runtime declaration: ${keyword}`, token.line, token.indent + 1);
  });
  function build(nodes, parent, context = { kind: 'node', target: parent }) { for (const n of nodes) { if (n.type === 'node') { const child = new UINode(n.keyword); parent.append(child); build(n.children, child, { kind: 'node', target: child }); } else if (n.type === 'id') parent.attr('id', n.value); else if (n.type === 'state') continue; else if (n.type === 'spring') buildProperties(n.children, n.spring, { kind: 'spring', target: n.spring }); else if (n.type === 'physics') buildProperties(n.children, n.body, { kind: 'physics', target: n.body }); else if (n.type === 'property') applyProperty(n, context); else if (n.type === 'on') { const handler = handlers.find(h => h.line === n.line); if (handler) handler.node = parent; } } }
  function buildProperties(nodes, target, ctx) { for (const n of nodes) { if (n.type === 'property') applyProperty(n, ctx); else if (n.type === 'on') { const handler = handlers.find(h => h.line === n.line); if (handler) handler.node = target; } } }
  function applyProperty(n, ctx) { const value = parseValue(n.args.join(' ')); if (n.keyword === 'gravity') { ctx.target.gravity = { x: parseValue(n.args[0] || '0'), y: parseValue(n.args[1] || '0') }; return; } if (ctx.kind === 'node') ctx.target.attr(n.keyword, value); else ctx.target[n.keyword] = value; }
  build(ast.children, root); return { root, signals, springs, bodies, handlers };
}
module.exports = { RuntimeDslError, compileRuntime, parseValue };
