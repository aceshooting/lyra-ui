import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const packageRequire = createRequire(new URL('../packages/lyra-ui/package.json', import.meta.url));
const analyzerRequire = createRequire(packageRequire.resolve('@custom-elements-manifest/analyzer'));
const globbyRequire = createRequire(analyzerRequire.resolve('globby'));
const fastGlobRequire = createRequire(globbyRequire.resolve('fast-glob'));
const micromatchRequire = createRequire(fastGlobRequire.resolve('micromatch'));
const braces = micromatchRequire('braces');
const depthError = { name: 'SyntaxError', message: 'Input nesting depth exceeds maximum of 128' };
const nested = (depth, open = '{', close = '}') => open.repeat(depth) + 'a,b' + close.repeat(depth);

const stringEntries = {
  default: (input) => braces(input),
  array: (input) => braces(['ordinary', input]),
  create: (input) => braces.create(input),
  createExpanded: (input) => braces.create(input, { expand: true }),
  expanded: (input) => braces(input, { expand: true }),
  parse: (input) => braces.parse(input),
  compile: (input) => braces.compile(input),
  expand: (input) => braces.expand(input),
  stringify: (input) => braces.stringify(input),
};

// GHSA-vfj7-8cjw-p6xm: these inputs fit below the existing 10,000-character cap.
for (const [name, invoke] of Object.entries(stringEntries)) {
  test(`braces ${name} rejects pathological nesting before exhausting the stack`, () => {
    for (const pattern of [nested(4900), nested(4900, '(', ')'), '{('.repeat(2400) + 'a,b' + ')}'.repeat(2400)]) {
      assert.ok(pattern.length < 10000);
      assert.throws(() => invoke(pattern), depthError);
    }
  });
}

function nestedAst(depth) {
  const ast = { type: 'root', nodes: [] };
  let parent = ast;
  for (let index = 0; index < depth; index++) {
    const child = { type: 'paren', nodes: [], parent };
    parent.nodes.push(child);
    parent = child;
  }
  parent.nodes.push({ type: 'text', value: 'x', parent });
  return ast;
}

for (const name of ['compile', 'expand', 'stringify']) {
  test(`braces ${name} bounds caller-supplied ASTs, including cycles`, () => {
    assert.throws(() => braces[name](nestedAst(4900)), depthError);
    const cyclic = { type: 'root', nodes: [] };
    cyclic.nodes.push(cyclic);
    assert.throws(() => braces[name](cyclic), depthError);
  });
}

test('braces keeps the depth boundary consistent for strings and ASTs', () => {
  for (const [open, close] of [['{', '}'], ['(', ')']]) {
    const pattern = nested(128, open, close);
    assert.equal(braces.stringify(pattern), pattern);
    assert.doesNotThrow(() => braces.compile(pattern));
    assert.doesNotThrow(() => braces.expand(pattern));
    assert.throws(() => braces.parse(nested(129, open, close)), depthError);
  }
  for (const name of ['compile', 'expand', 'stringify']) {
    const result = braces[name](nestedAst(128));
    assert.deepEqual(result, name === 'expand' ? ['x'] : 'x');
    assert.throws(() => braces[name](nestedAst(129)), depthError);
  }
});

test('braces bounds unclosed nesting and does not let options disable the limit', () => {
  assert.throws(() => braces.parse('{'.repeat(129)), depthError);
  assert.throws(() => braces.parse('('.repeat(129)), depthError);
  for (const maxDepth of [false, Infinity, NaN, 1000000]) {
    assert.throws(() => braces.parse(nested(129), { maxDepth, maxLength: Infinity }), depthError);
  }
});

test('braces preserves documented ordinary expansion and compilation behavior', () => {
  assert.deepEqual(braces('a/{x,y,z}/b'), ['a/(x|y|z)/b']);
  assert.deepEqual(braces.expand('a{b,c,/{x,y}}/e'), ['ab/e', 'ac/e', 'a/x/e', 'a/y/e']);
  assert.deepEqual(braces.expand('{01..03}'), ['01', '02', '03']);
  assert.deepEqual(braces.expand('{2..10..2}'), ['2', '4', '6', '8', '10']);
  assert.deepEqual(braces.expand('{,a,a}', { noempty: true, nodupes: true }), ['a']);
  assert.deepEqual(braces.expand('a\\{d,c,b}e'), ['a{d,c,b}e']);
  assert.deepEqual(braces.expand('a{b}c'), ['a{b}c']);
  assert.deepEqual(braces.expand('a/{b,c'), ['a/{b,c']);
  assert.equal(braces.stringify(braces.parse('a/{b,c}/d')), 'a/{b,c}/d');
  assert.equal(braces.compile(braces.parse('a/{b,c}/d')), 'a/(b|c)/d');
  assert.deepEqual(braces.expand(braces.parse('a/{b,c}/d')), ['a/b/d', 'a/c/d']);
});

test('braces counts parsed nesting rather than literal or sequential delimiters', () => {
  const literal = '{'.repeat(200) + 'x' + '}'.repeat(200);
  assert.equal(braces.stringify('"' + literal + '"'), literal);
  assert.equal(braces.stringify('[' + literal + ']'), '[' + literal + ']');
  const escaped = '\\{'.repeat(200) + 'x' + '\\}'.repeat(200);
  assert.equal(braces.stringify(escaped), literal);
  assert.equal(braces.stringify('{a,b}'.repeat(200)), '{a,b}'.repeat(200));
  assert.equal(braces.stringify('(x)'.repeat(200)), '(x)'.repeat(200));
  assert.equal(braces.compile('x'.repeat(9999)), 'x'.repeat(9999));
});
