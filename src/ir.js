class IRError extends Error {
  constructor(message, line = 0, column = 0) { super(`STYL++ IR error${line ? ` at ${line}:${column || 1}` : ''}: ${message}`); this.name = 'STYLppIRError'; this.line = line; this.column = column; }
}

const UI_NODES = new Set(['app','view','button','text','input','image','row','column','stack','grid','scroll','overlay','card']);
const PHYSICS_PROPS = new Set(['mass','gravity','velocity','friction','restitution']);
const SPRING_PROPS = new Set(['stiffness','damping','mass','target','value','velocity']);

function number(value, name, line) {
  const n = Number(value); if (!Number.isFinite(n)) throw new IRError(`${name} must be a finite number`, line); return n;
}
function value(raw, line) {
  if (raw === 'true') return true; if (raw === 'false') return false; if (raw === 'null') return null;
  const n = Number(raw); return Number.isFinite(n) ? n : raw.replace(/^['"]|['"]$/g, '');
}

function lower(node, parent = null) {
  const name = node.type; const v = node.value; const line = node.line;
  if (UI_NODES.has(name)) return { kind:'ui', type:name, props:{}, children:[], parent, line };
  if (name === 'state') {
    const p = v.match(/^([A-Za-z_][\w-]*)\s+(.+)$/); if (!p) throw new IRError('state requires name and value', line);
    return { kind:'state', name:p[1], initial:value(p[2],line), line };
  }
  if (name === 'spring') return { kind:'spring', props:{}, children:[], parent, line };
  if (name === 'physics') return { kind:'physics', props:{}, children:[], parent, line };
  if (name === 'on') { const p=v.match(/^([A-Za-z][\w:-]*)\s*(.*)$/); if(!p) throw new IRError('event requires a name',line); return {kind:'event',event:p[1],body:p[2],parent,line}; }
  if (name === 'id') { if(!v) throw new IRError('id requires a value',line); return {kind:'property',name:'id',value:value(v,line),line}; }
  if (name === 'width' || name === 'height' || name === 'gap' || name === 'padding' || name === 'layout') return {kind:'property',name,value:value(v,line),line};
  if (PHYSICS_PROPS.has(name) || SPRING_PROPS.has(name)) return {kind:'property',name,value:value(v,line),line};
  throw new IRError(`unsupported runtime declaration '${name}'`,line);
}

function validate(node, context = { states:new Set() }) {
  if (node.kind === 'state') { if(context.states.has(node.name)) throw new IRError(`duplicate state '${node.name}'`,node.line); context.states.add(node.name); }
  if (node.kind === 'ui' && node.props.id && typeof node.props.id !== 'string') throw new IRError('id must be a string',node.line);
  if (node.kind === 'spring') {
    if (node.props.stiffness !== undefined && node.props.stiffness <= 0) throw new IRError('spring stiffness must be > 0',node.line);
    if (node.props.damping !== undefined && node.props.damping < 0) throw new IRError('spring damping must be >= 0',node.line);
  }
  if (node.kind === 'physics' && node.props.mass !== undefined && node.props.mass <= 0) throw new IRError('physics mass must be > 0',node.line);
  for(const child of node.children || []) validate(child,context);
  return node;
}

function buildIR(ast) {
  const root = { kind:'program', children:[], line:0 };
  function walk(source, parent) {
    for(const child of source.children || []) {
      const ir = lower(child,parent); parent.children.push(ir); if(child.children?.length) walk(child,ir);
    }
  }
  walk(ast,root); validate(root); return root;
}

module.exports = { IRError, buildIR, validate, UI_NODES };
