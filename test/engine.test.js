const test = require('node:test');
const assert = require('node:assert/strict');
const { STYLRuntime } = require('../src/engine');
const { node } = require('../src/ui');
const { Timeline, Tween } = require('../src/motion');

test('runtime connects signals, springs, physics and layout', () => {
  const root = node('row', { gap: 10 }, [node('button', { id: 'play' }), node('view')]);
  const runtime = new STYLRuntime({ root, width: 210, height: 50 });
  const state = runtime.signal('open', false);
  const spring = runtime.spring('panel', { value: 0, target: 100, stiffness: 180, damping: 24 });
  const body = runtime.body({ gravity: { x: 0, y: 10 } });
  const timeline = runtime.timeline(new Timeline().add(new Tween({ from: 0, to: 1, duration: 1 })).play());
  state.value = true; runtime.resize(210, 50); runtime.step(1 / 60);
  assert.equal(state.value, true);
  assert.ok(spring.value > 0);
  assert.ok(body.position.y > 0);
  assert.ok(timeline.time > 0);
  assert.equal(root.children[1].layout.x, 110);
});
