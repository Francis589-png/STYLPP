const test = require('node:test');
const assert = require('node:assert/strict');
const { Signal, UINode, UIRuntime } = require('../src/runtime');

test('signal notifies subscribers only when value changes', () => {
  const signal = new Signal(1); const values = [];
  signal.subscribe((value, previous) => values.push([value, previous]));
  signal.value = 1; signal.value = 2; signal.value = 3;
  assert.deepEqual(values, [[2, 1], [3, 2]]);
});

test('signals can derive reactive values', () => {
  const source = new Signal(4); const doubled = source.map(v => v * 2);
  assert.equal(doubled.value, 8); source.value = 9; assert.equal(doubled.value, 18);
});

test('UI events bubble and can stop propagation', () => {
  const root = new UINode('root'); const button = new UINode('button'); root.append(button);
  const events = []; root.on('click', () => events.push('root')); button.on('click', e => { events.push('button'); e.stopPropagation(); });
  button.emit('click'); assert.deepEqual(events, ['button']);
});

test('layout computes deterministic column positions', () => {
  const root = new UINode('view', { layout: 'column', gap: 10, padding: 5 });
  root.append(new UINode('view'), new UINode('view'));
  new UIRuntime(root).tick(100, 100);
  assert.deepEqual(root.children.map(n => n.layout.y), [5, 55]);
  assert.equal(root.children[0].layout.width, 90);
});

test('tree lookup finds nodes by id', () => {
  const root = new UINode(); const panel = new UINode('panel', { id: 'settings' }); root.append(panel);
  assert.equal(root.findById('settings'), panel); assert.equal(root.findById('missing'), null);
});
