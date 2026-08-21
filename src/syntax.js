class SyntaxError extends Error {
  constructor(message, line, column = 1) { super(`STYL++ line ${line}, column ${column}: ${message}`); this.name = 'STYLPSyntaxError'; this.line = line; this.column = column; }
}

function lex(source) {
  const lines = String(source).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  return lines.map((original, index) => {
    const line = index + 1;
    const raw = original.replace(/\/\/.*$/, '');
    if (!raw.trim()) return null;
    const expanded = raw.replace(/\t/g, '    ');
    const indent = expanded.length - expanded.trimStart().length;
    const text = expanded.trim();
    if (!text.endsWith(';')) throw new SyntaxError('statement must end with ;', line, indent + 1);
    return { line, indent, text: text.slice(0, -1).trim(), tokens: text.slice(0, -1).trim().split(/\s+/) };
  }).filter(Boolean);
}

function parse(source, classify) {
  const root = { type: 'root', children: [], line: 0 };
  const stack = [{ indent: -1, node: root }];
  for (const token of lex(source)) {
    while (stack.length > 1 && token.indent <= stack.at(-1).indent) stack.pop();
    const parent = stack.at(-1).node;
    const node = classify(token, parent);
    if (!node) throw new SyntaxError(`unknown statement: ${token.text}`, token.line, token.indent + 1);
    parent.children.push(node);
    if (node.block) { delete node.block; stack.push({ indent: token.indent, node }); }
  }
  return root;
}

module.exports = { SyntaxError, lex, parse };
