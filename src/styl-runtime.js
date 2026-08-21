const { Signal, UINode, UIRuntime, layout } = require('./runtime');
const { Spring, Body, PhysicsWorld } = require('./physics');
const { Tween, Timeline } = require('./motion');
class STYLRuntimeError extends Error { constructor(message) { super(message); this.name = 'STYLRuntimeError'; } }
class STYLRuntime {
  constructor({ root, gravity = { x: 0, y: 980 }, width = 0, height = 0 } = {}) { this.ui = new UIRuntime(root || new UINode('root')); this.physics = new PhysicsWorld({ gravity }); this.timelines = new Set(); this.springs = new Set(); this.signals = new Set(); this.width = width; this.height = height; this.time = 0; }
  signal(value) { const s = new Signal(value); this.signals.add(s); return s; }
  spring(options) { const s = new Spring(options); this.springs.add(s); return s; }
  body(options) { return this.physics.add(new Body(options)); }
  timeline(timeline = new Timeline()) { if (!(timeline instanceof Timeline)) throw new STYLRuntimeError('timeline must be a Timeline'); this.timelines.add(timeline); return timeline; }
  resize(width, height) { if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) throw new STYLRuntimeError('width and height must be non-negative finite numbers'); this.width = width; this.height = height; this.ui.tick(width, height); return this; }
  step(dt) { if (!Number.isFinite(dt) || dt < 0 || dt > 0.1) throw new STYLRuntimeError('dt must be between 0 and 0.1 seconds'); this.time += dt; for (const spring of this.springs) if (!spring.settle()) spring.step(dt); this.physics.step(dt); for (const timeline of this.timelines) timeline.step(dt); this.ui.tick(this.width, this.height); return this.snapshot(); }
  dispatch(node, event, detail = {}) { return this.ui.dispatch(node, event, detail); }
  find(id) { return this.ui.find(id); }
  snapshot() { return { time: this.time, frame: this.ui.frame, width: this.width, height: this.height, root: this.ui.root }; }
}
module.exports = { STYLRuntime, STYLRuntimeError, Signal, UINode, Spring, Body, PhysicsWorld, Tween, Timeline, layout };
