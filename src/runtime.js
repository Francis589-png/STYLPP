class RuntimeError extends Error {
  constructor(message) { super(message); this.name = 'RuntimeError'; }
}

class Signal {
  constructor(value) { this._value = value; this.listeners = new Set(); }
  get value() { return this._value; }
  set value(next) { this.set(next); }
  get() { return this._value; }
  set(next) {
    if (Object.is(next, this._value)) return;
    const previous = this._value; this._value = next;
    for (const listener of [...this.listeners]) listener(next, previous);
  }
  subscribe(listener) { if (typeof listener !== 'function') throw new RuntimeError('Signal listener must be a function'); this.listeners.add(listener); return () => this.listeners.delete(listener); }
  map(fn) { const derived = new Signal(fn(this._value)); this.subscribe(v => derived.set(fn(v))); return derived; }
}

class UINode {
  constructor(type = 'view', props = {}) { this.type = type; this.props = { ...props }; this.children = []; this.parent = null; this.listeners = new Map(); this.layout = { x: 0, y: 0, width: 0, height: 0 }; }
  append(...nodes) { for (const node of nodes) { if (!(node instanceof UINode)) throw new RuntimeError('Only UINode children are allowed'); if (node.parent) node.parent.remove(node); node.parent = this; this.children.push(node); } return this; }
  remove(node) { const i = this.children.indexOf(node); if (i >= 0) { this.children.splice(i, 1); node.parent = null; } return this; }
  attr(name, value) { if (value === undefined) return this.props[name]; this.props[name] = value; return this; }
  on(event, handler) { if (typeof handler !== 'function') throw new RuntimeError('Event handler must be a function'); if (!this.listeners.has(event)) this.listeners.set(event, new Set()); this.listeners.get(event).add(handler); return () => this.listeners.get(event)?.delete(handler); }
  emit(event, detail = {}) { const evt = { type: event, target: this, currentTarget: this, detail, stopped: false, stopPropagation() { this.stopped = true; } }; let node = this; while (node) { evt.currentTarget = node; for (const handler of node.listeners.get(event) || []) handler(evt); if (evt.stopped) break; node = node.parent; } return !evt.stopped; }
  findById(id) { if (this.props.id === id) return this; for (const child of this.children) { const found = child.findById(id); if (found) return found; } return null; }
  walk(visitor) { visitor(this); for (const child of this.children) child.walk(visitor); return this; }
}

function px(value, fallback = 0) { if (typeof value === 'number') return value; const n = Number.parseFloat(value); return Number.isFinite(n) ? n : fallback; }
function layout(node, width = px(node.props.width, 0), height = px(node.props.height, 0)) {
  node.layout.width = width; node.layout.height = height;
  const direction = node.props.layout || node.props.direction || (node.type === 'row' ? 'row' : 'column');
  if (!node.children.length) return node;
  const gap = px(node.props.gap, 0), padding = px(node.props.padding, 0), innerW = Math.max(0, width - padding * 2), innerH = Math.max(0, height - padding * 2);
  if (direction === 'row') { const each = Math.max(0, (innerW - gap * (node.children.length - 1)) / node.children.length); node.children.forEach((child, i) => { child.layout.x = padding + i * (each + gap); child.layout.y = padding; layout(child, px(child.props.width, each), px(child.props.height, innerH)); }); }
  else { const each = Math.max(0, (innerH - gap * (node.children.length - 1)) / node.children.length); node.children.forEach((child, i) => { child.layout.x = padding; child.layout.y = padding + i * (each + gap); layout(child, px(child.props.width, innerW), px(child.props.height, each)); }); }
  return node;
}
class UIRuntime {
  constructor(root = new UINode('root')) { this.root = root; this.frame = 0; }
  tick(width, height) { layout(this.root, width, height); this.frame++; return this.root; }
  dispatch(node, event, detail) { return node.emit(event, detail); }
  find(id) { return this.root.findById(id); }
}
module.exports = { RuntimeError, Signal, UINode, UIRuntime, layout };
