class UIError extends Error {}
const types = new Set(['view','text','button','input','image','stack','row','grid','scroll','overlay']);

class Signal {
  constructor(value) { this.value = value; this.listeners = new Set(); }
  get() { return this.value; }
  set(value) { if (Object.is(value, this.value)) return; this.value = value; for (const listener of this.listeners) listener(value); }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}

function node(type, props = {}, children = []) {
  if (!types.has(type)) throw new UIError(`Unknown UI node: ${type}`);
  if (!Array.isArray(children)) throw new UIError('children must be an array');
  return { type, props: { ...props }, children: children.slice() };
}

function walk(root, visitor) { visitor(root); for (const child of root.children) walk(child, visitor); return root; }
function find(root, id) { let result; walk(root, n => { if (n.props.id === id) result = n; }); return result; }

function layout(root, width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) throw new UIError('layout dimensions must be non-negative finite numbers');
  function measure(n, x, y, w, h) {
    const p = n.props; const widthValue = Number.isFinite(p.width) ? p.width : w; const heightValue = Number.isFinite(p.height) ? p.height : h;
    n.layout = { x, y, width: Math.max(0, widthValue), height: Math.max(0, heightValue) };
    if (!n.children.length) return;
    const gap = Number.isFinite(p.gap) ? p.gap : 0;
    if (n.type === 'row') { const childW = Math.max(0, (n.layout.width - gap * (n.children.length - 1)) / n.children.length); n.children.forEach((c, i) => measure(c, x + i * (childW + gap), y, childW, n.layout.height)); }
    else if (n.type === 'stack' || n.type === 'overlay') n.children.forEach(c => measure(c, x, y, n.layout.width, n.layout.height));
    else { const childH = Math.max(0, (n.layout.height - gap * (n.children.length - 1)) / n.children.length); n.children.forEach((c, i) => measure(c, x, y + i * (childH + gap), n.layout.width, childH)); }
  }
  measure(root, 0, 0, width, height); return root;
}

module.exports = { UIError, Signal, node, walk, find, layout };
