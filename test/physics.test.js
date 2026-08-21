const test = require('node:test');
const assert = require('node:assert/strict');
const { Spring, Body, PhysicsWorld } = require('../src/physics');

test('spring moves toward its target', () => {
  const s = new Spring({ value: 0, target: 100, stiffness: 180, damping: 24 });
  for (let i = 0; i < 120; i++) s.step(1 / 60);
  assert.ok(Math.abs(s.value - 100) < 1);
  assert.ok(Math.abs(s.velocity) < 2);
});

test('spring preserves physical state and can retarget', () => {
  const s = new Spring({ value: 0, target: 1 });
  s.step(); s.setTarget(2);
  assert.equal(s.target, 2);
  assert.ok(Number.isFinite(s.velocity));
});

test('body integrates gravity and force', () => {
  const body = new Body({ x: 0, y: 0, gravity: { x: 0, y: 10 }, damping: 0 });
  body.applyForce(10, 0).step(0.1);
  assert.ok(body.position.x > 0);
  assert.ok(body.position.y > 0);
});

test('world uses a fixed timestep', () => {
  const world = new PhysicsWorld({ gravity: { x: 0, y: 10 }, fixedDt: 1 / 60 });
  const body = world.add(new Body({ gravity: { x: 0, y: 0 } }));
  const steps = world.step(1 / 30);
  assert.equal(steps, 2);
  assert.ok(body.position.y > 0);
});
