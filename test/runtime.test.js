const test = require('node:test');
const assert = require('node:assert/strict');
const { Tween, Timeline, Signal, node, layout, find } = require('../src');

test('tween reaches its exact endpoint', () => {
  const t = new Tween({ from: 0, to: 100, duration: 1 });
  t.step(1);
  assert.equal(t.done, true);
  assert.equal(t.step(0.1), 100);
});

test('timeline samples delayed tracks deterministically', () => {
  const timeline = new Timeline().add(new Tween({ from: 0, to: 10, duration: 1 }), 0.5).play();
  timeline.step(0.75);
  assert.equal(timeline.sample()[0].active, true);
  assert.ok(timeline.sample()[0].value > 0);
});

test('signals notify only on real changes', () => {
  const signal = new Signal(1); let calls = 0;
  signal.subscribe(() => calls++); signal.set(1); signal.set(2);
  assert.equal(calls, 1);
});

test('UI tree lays out rows and supports lookup', () => {
  const root = node('row', { id: 'root', gap: 10 }, [node('button', { id: 'a' }), node('button', { id: 'b' })]);
  layout(root, 210, 50);
  assert.equal(find(root, 'b').layout.x, 110);
  assert.equal(root.layout.width, 210);
});
