const test = require('node:test');
const assert = require('node:assert/strict');
const { compile, lint, format } = require('../src');

test('compiles variables and nested selectors', () => {
  const result = compile(`variables;\n    primary #007bff;\n    spacing 16px;\n.button;\n    color var(primary);\n    padding var(spacing);\n    :hover;\n        color black;\n`);
  assert.match(result.css, /--primary: #007bff/);
  assert.match(result.css, /\.button \{/);
  assert.match(result.css, /\.button:hover \{/);
  assert.match(result.css, /color: var\(--primary\);/);
});

test('supports nested media queries', () => {
  const result = compile(`.container;\n    width 100%;\n    @media (min-width: 768px);\n        width 750px;\n`);
  assert.match(result.css, /@media \(min-width: 768px\)/);
  assert.match(result.css, /\.container \{/);
  assert.match(result.css, /width: 750px/);
});

test('evaluates compatible math and emits calc for mixed units', () => {
  const result = compile(`variables;\n    base-size 16px;\n.heading;\n    font-size base-size * 1.5;\n.container;\n    width 100% - 40px;\n`);
  assert.match(result.css, /font-size: 24px/);
  assert.match(result.css, /width: calc\(100% - 40px\)/);
});

test('expands loops and interpolation', () => {
  const result = compile(`for i in 1 to 3;\n    .column-{i};\n        grid-column i;\n`);
  assert.match(result.css, /\.column-1/);
  assert.match(result.css, /grid-column: 1/);
  assert.match(result.css, /\.column-3/);
});

test('supports defines for conditionals', () => {
  const result = compile(`.card;\n    color black;\n    if dark-mode;\n        background #111;\n        color white;\n`, { defines: { 'dark-mode': true } });
  assert.match(result.css, /background: #111/);
  assert.match(result.css, /color: white/);
});

test('lint catches missing semicolons', () => {
  const result = lint('.bad\n    color red;\n');
  assert.equal(result.ok, false);
});

test('formatter produces canonical indentation', () => {
  const result = format('.a;\n    color red;\n');
  assert.equal(result, '.a;\n    color red;\n');
});
