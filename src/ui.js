class UIError extends Error {}
const types = new Set(['root','app','view','text','button','input','image','stack','row','column','grid','scroll','overlay','card']);

class Signal {
  constructor(value) { this.value = value; this.listeners = new Set(); }
  get() { return this.value; }
  set(value) { if (Object.is(value, this.value)) return; const previous = this.value; this.value = value; for (const listener of [...this.listeners]) listener(value, previous); }
  subscribe(listener) { if (typeof listener !== 'function') throw new UIError('Signal listener must be a function'); this.listeners.add(listener); return () => this.listeners.delete(listener); }
  map(fn) { const derived = new Signal(fn(this.value)); this.subscribe(v => { derived.set(fn(v)); }); return derived; }
}

class UINode {
  constructor(type = 'view', props = {}) { if (!types.has(type)) throw new UIError(`Unknown UI node: ${type}`); this.type = type; this.props = { ...props }; this.children = []; this.parent = null; this.listeners = new Map(); this.layout = { x: 0, y: 0, width: 0, height: 0 }; }
  append(...children) { for (const child of children) { if (!(child instanceof UINode)) throw new UIError('children must be UINode instances'); if (child.parent) child.parent.remove(child); child.parent = this; this.children.push(child); } return this; }
  remove(child) { const index = this.children.indexOf(child); if (index !== -1) { this.children.splice(index, 1); child.parent = null; } return this; }
  attr(name, value) { if (value === undefined) return this.props[name]; this.props[name] = value; return this; }
  on(event, handler) { if (typeof handler !== 'function') throw new UIError('event handler must be a function'); if (!this.listeners.has(event)) this.listeners.set(event, new Set()); this.listeners.get(event).add(handler); return () => this.listeners.get(event)?.delete(handler); }
  emit(event, detail = {}) { const evt = { type: event, target: this, currentTarget: this, detail, stopped: false, stopPropagation() { this.stopped = true; } }; let current = this; while (current) { evt.currentTarget = current; for (const handler of current.listeners.get(event) || []) handler(evt); if (evt.stopped) break; current = current.parent; } return !evt.stopped; }
  findById(id) { if (this.props.id === id) return this; for (const child of this.children) { const found = child.findById(id); if (found) return found; } return null; }
}

function node(type, props = {}, children = []) { const result = new UINode(type, props); return result.append(...children); }
function walk(root, visitor) { visitor(root); for (const child of root.children) walk(child, visitor); return root; }
function find(root, id) { return root.findById ? root.findById(id) : (() => { let result; walk(root, n => { if (n.props.id === id) result = n; }); return result; })(); }
function layout(root, width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) throw new UIError('layout dimensions must be non-negative finite numbers');
  function measure(n, x, y, w, h) { const p = n.props; const widthValue = Number.isFinite(p.width) ? p.width : w; const heightValue = Number.isFinite(p.height) ? p.height : h; n.layout = { x, y, width: Math.max(0, widthValue), height: Math.max(0, heightValue) }; if (!n.children.length) return; const gap = Number.isFinite(p.gap) ? p.gap : 0; if (n.type === 'row') { const childW = Math.max(0, (n.layout.width - gap * (n.children.length - 1)) / n.children.length); n.children.forEach((c, i) => measure(c, x + i * (childW + gap), y, childW, n.layout.height)); } else if (n.type === 'stack' || n.type === 'overlay') n.children.forEach(c => measure(c, x, y, n.layout.width, n.layout.height)); else { const childH = Math.max(0, (n.layout.height - gap * (n.children.length - 1)) / n.children.length); n.children.forEach((c, i) => measure(c, x, y + i * (childH + gap), n.layout.width, childH)); } }
  measure(root, 0, 0, width, height); return root;
}

module.exports = { UIError, Signal, UINode, node, walk, find, layout };
