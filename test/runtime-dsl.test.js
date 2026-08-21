const test = require('node:test');
const assert = require('node:assert/strict');
const { compileRuntime, RuntimeDslError } = require('../src/runtime-dsl');

test('runtime DSL creates a real UI tree, state, spring and physics body', () => {
  const result = compileRuntime(`
app;
    id main;
    state open false;
    card;
        id card;
        width 320;
        height 180;
        spring;
            stiffness 180;
            damping 24;
            mass 1;
        physics;
            mass 2;
            gravity 0 980;
        on click;
`);
  assert.equal(result.root.findById('main').type, 'app');
  assert.equal(result.root.findById('card').props.width, 320);
  assert.equal(result.signals.get('open').value, false);
  assert.equal(result.springs[0].stiffness, 180);
  assert.equal(result.bodies[0].gravity.y, 980);
  assert.equal(result.handlers[0].event, 'click');
});

test('runtime DSL rejects malformed declarations', () => {
  assert.throws(() => compileRuntime('app'), /must end with/);
  assert.throws(() => compileRuntime('unknown value;'), /Unknown runtime declaration/);
});
