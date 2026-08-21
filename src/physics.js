class PhysicsError extends Error {
  constructor(message) { super(message); this.name = 'PhysicsError'; }
}

function finite(n, name) {
  if (!Number.isFinite(n)) throw new PhysicsError(`${name} must be finite`);
  return n;
}

function vec(x = 0, y = 0) { return { x: finite(x, 'x'), y: finite(y, 'y') }; }

class Spring {
  constructor({ value = 0, target = value, stiffness = 170, damping = 26, mass = 1, velocity = 0 } = {}) {
    this.value = finite(value, 'value');
    this.target = finite(target, 'target');
    this.velocity = finite(velocity, 'velocity');
    this.stiffness = finite(stiffness, 'stiffness');
    this.damping = finite(damping, 'damping');
    this.mass = finite(mass, 'mass');
    if (this.mass <= 0 || this.stiffness < 0 || this.damping < 0) throw new PhysicsError('mass must be > 0; stiffness and damping must be >= 0');
  }
  step(dt = 1 / 60) {
    finite(dt, 'dt');
    if (dt <= 0 || dt > 0.1) throw new PhysicsError('dt must be > 0 and <= 0.1 seconds');
    const acceleration = (this.stiffness * (this.target - this.value) - this.damping * this.velocity) / this.mass;
    this.velocity += acceleration * dt;
    this.value += this.velocity * dt;
    return this.value;
  }
  setTarget(target) { this.target = finite(target, 'target'); return this; }
  settle(epsilon = 0.001) { return Math.abs(this.target - this.value) <= epsilon && Math.abs(this.velocity) <= epsilon; }
  state() { return { value: this.value, target: this.target, velocity: this.velocity }; }
}

class Body {
  constructor({ x = 0, y = 0, vx = 0, vy = 0, mass = 1, gravity = { x: 0, y: 980 }, damping = 0 } = {}) {
    this.position = vec(x, y); this.velocity = vec(vx, vy); this.force = vec();
    this.mass = finite(mass, 'mass'); this.gravity = vec(gravity.x, gravity.y); this.damping = finite(damping, 'damping');
    if (this.mass <= 0) throw new PhysicsError('mass must be > 0');
  }
  applyForce(x, y) { this.force.x += finite(x, 'force.x'); this.force.y += finite(y, 'force.y'); return this; }
  step(dt = 1 / 60) {
    if (dt <= 0 || dt > 0.1) throw new PhysicsError('dt must be > 0 and <= 0.1 seconds');
    const ax = this.gravity.x + this.force.x / this.mass - this.damping * this.velocity.x;
    const ay = this.gravity.y + this.force.y / this.mass - this.damping * this.velocity.y;
    this.velocity.x += ax * dt; this.velocity.y += ay * dt;
    this.position.x += this.velocity.x * dt; this.position.y += this.velocity.y * dt;
    this.force.x = 0; this.force.y = 0;
    return this.position;
  }
}

class PhysicsWorld {
  constructor({ gravity = { x: 0, y: 980 }, fixedDt = 1 / 60, maxSubSteps = 8 } = {}) {
    this.gravity = vec(gravity.x, gravity.y); this.fixedDt = fixedDt; this.maxSubSteps = maxSubSteps; this.accumulator = 0; this.bodies = [];
  }
  add(body) { this.bodies.push(body); body.gravity = vec(this.gravity.x, this.gravity.y); return body; }
  step(dt) {
    finite(dt, 'dt'); this.accumulator += Math.min(dt, this.fixedDt * this.maxSubSteps);
    let steps = 0;
    while (this.accumulator >= this.fixedDt && steps < this.maxSubSteps) {
      for (const body of this.bodies) body.step(this.fixedDt);
      this.accumulator -= this.fixedDt; steps++;
    }
    return steps;
  }
}

module.exports = { PhysicsError, Spring, Body, PhysicsWorld, vec };
