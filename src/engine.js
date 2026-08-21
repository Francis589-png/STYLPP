const { Signal, node, layout } = require('./ui');
const { Spring, PhysicsWorld, Body } = require('./physics');
const { Timeline } = require('./motion');

class EngineError extends Error {}

class STYLRuntime {
  constructor({ root = node('view'), width = 0, height = 0, gravity } = {}) {
    this.root = root;
    this.width = width;
    this.height = height;
    this.state = new Map();
    this.springs = new Map();
    this.physics = new PhysicsWorld({ gravity });
    this.timelines = new Set();
    this.time = 0;
  }

  signal(name, initialValue) {
    if (this.state.has(name)) return this.state.get(name);
    const signal = new Signal(initialValue);
    this.state.set(name, signal);
    return signal;
  }

  spring(name, options = {}) {
    if (this.springs.has(name)) return this.springs.get(name);
    const spring = new Spring(options);
    this.springs.set(name, spring);
    return spring;
  }

  body(options = {}) {
    const body = new Body(options);
    this.physics.add(body);
    return body;
  }

  timeline(timeline) {
    if (!(timeline instanceof Timeline)) throw new EngineError('timeline must be a Timeline');
    this.timelines.add(timeline);
    return timeline;
  }

  resize(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) throw new EngineError('width and height must be non-negative finite numbers');
    this.width = width; this.height = height;
    layout(this.root, width, height);
    return this;
  }

  step(dt = 1 / 60) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1) throw new EngineError('dt must be > 0 and <= 0.1 seconds');
    this.time += dt;
    for (const spring of this.springs.values()) spring.step(dt);
    this.physics.step(dt);
    for (const timeline of this.timelines) timeline.step(dt);
    layout(this.root, this.width, this.height);
    return this;
  }
}

module.exports = { EngineError, STYLRuntime };
