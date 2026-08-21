const test = require('node:test');
const assert = require('node:assert/strict');
const { STYLRuntime, UINode, Timeline, Tween } = require('../src/styl-runtime');

test('integrated runtime advances spring physics timeline and UI', () => {
  const root = new UINode('root', { layout: 'row', gap: 10 });
  root.append(new UINode('card', { id: 'card' }));
  const runtime = new STYLRuntime({ root, gravity: { x: 0, y: 10 }, width: 200, height: 100 });
  const spring = runtime.spring({ value: 0, target: 100, stiffness: 180, damping: 24 });
  const body = runtime.body({ gravity: { x: 0, y: 10 } });
  runtime.timeline(new Timeline().add(new Tween({ from: 0, to: 1, duration: 0.5 })).play());
  runtime.resize(200, 100);
  for (let i = 0; i < 30; i++) runtime.step(1 / 60);
  assert.ok(spring.value > 0);
  assert.ok(body.position.y > 0);
  assert.equal(runtime.find('card').props.id, 'card');
  assert.equal(runtime.ui.root.layout.width, 200);
});

test('runtime rejects invalid frame deltas', () => {
  const runtime = new STYLRuntime();
  assert.throws(() => runtime.step(0.2), /dt must be between/);
});
