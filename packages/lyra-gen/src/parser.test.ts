import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMarkupParser, parseMarkup } from './parser.js';
import type { MarkupOptions } from './parser.js';
import { markupFixtures } from '../test/fixtures/markup.js';

const options: MarkupOptions = { catalog: { id: 'test', version: '1' }, surfaceId: 'surface', revision: 0,
  allowedTags: ['stack', 'row', 'grid', 'text', 'heading', 'divider', 'form', 'button', 'input'] };
const plain = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

test('corpus has at least 150 separately named expectations', () => {
  assert.ok(markupFixtures.length >= 150);
  assert.equal(new Set(markupFixtures.map(fixture => fixture.name)).size, markupFixtures.length);
});
for (const fixture of markupFixtures) {
  test(`markup conformance: ${fixture.name}`, () => {
    const config = { ...options, ...fixture.options };
    const result = parseMarkup(fixture.source, config);
    assert.equal(result.status, fixture.status);
    if (fixture.code) assert.equal(result.diagnostics[0]?.code, fixture.code);
    if (fixture.status === 'complete') {
      assert.ok(result.view);
      assert.equal(result.diagnostics.length, 0);
      if (fixture.text !== undefined) assert.equal(result.view.root.text, fixture.text);
      if (fixture.props !== undefined) assert.deepEqual(plain(result.view.root.props), plain(fixture.props));
    } else assert.equal(result.view, undefined);
    for (let split = 0; split <= fixture.source.length; split++) {
      const parser = createMarkupParser(config);
      assert.equal(parser.push(fixture.source.slice(0, split)).view, undefined);
      assert.equal(parser.push(fixture.source.slice(split)).view, undefined);
      assert.deepEqual(parser.finish(), result, `chunk split ${split}`);
      assert.deepEqual(parser.finish(), result, 'finish is idempotent');
    }
  });
}
test('source map retains exact UTF16 positions through entities and supplementary Unicode', () => {
  const source = ' <stack id="r"><text id="t" text="🚀 &amp;"/></stack> ';
  const result = parseMarkup(source, options);
  assert.equal(result.status, 'complete');
  const node = result.sourceMap['t']!;
  assert.equal(source.slice(node.start, node.end), '<text id="t" text="🚀 &amp;"/>');
  assert.equal(source.slice(node.attributes['text']!.start, node.attributes['text']!.end), 'text="🚀 &amp;"');
  assert.equal(result.view?.root.children?.[0]?.text, '🚀 &');
});
test('diagnostic entity range points into original source', () => {
  const source = '<text id="x">🚀 &wrong;</text>';
  const result = parseMarkup(source, options);
  assert.deepEqual(result.diagnostics[0]?.source, { start: 16, end: 23 });
});
test('stream cancellation discards data and cannot publish', () => {
  const parser = createMarkupParser(options);
  parser.push('<text id="x"/>');
  assert.equal(parser.cancel().view, undefined);
  assert.equal(parser.finish().diagnostics[0]?.code, 'cancelled');
  assert.equal(parser.push('<text id="y"/>').diagnostics[0]?.code, 'stream-closed');
});
test('limits cannot be widened beyond hard ceilings', () => {
  const result = parseMarkup(' '.repeat(262145), { ...options, limits: { maxLength: Number.MAX_SAFE_INTEGER } });
  assert.equal(result.diagnostics[0]?.code, 'source-length-limit');
});
test('invalid host context is represented by a diagnostic', () => {
  assert.equal(parseMarkup('<text id="x"/>', { ...options, revision: -1 }).diagnostics[0]?.code, 'invalid-context');
});

test('catalog input contributes its reference only, never host capabilities', () => {
  const catalog = { id: 'test', version: '1', components: { text: { tag: 'p', properties: {}, text: true } }, actions: { save: { confirm: true } } };
  const result = parseMarkup('<text id="x"/>', { ...options, catalog });
  assert.deepEqual(result.view?.catalog, { id: 'test', version: '1' });
});
test('formatting whitespace does not become content on empty structural nodes', () => {
  const result = parseMarkup('<stack id="r">\n  </stack>', options);
  assert.equal(result.status, 'complete');
  assert.equal(result.view?.root.text, undefined);
});

test('mistyped untrusted source fails without throwing or publishing', () => {
  for (const source of [null, undefined, 1, [], {}]) {
    assert.equal(parseMarkup(source as unknown as string, options).status, 'error');
    const parser = createMarkupParser(options);
    assert.equal(parser.push(source as unknown as string).status, 'error');
    assert.equal(parser.finish().view, undefined);
  }
});
