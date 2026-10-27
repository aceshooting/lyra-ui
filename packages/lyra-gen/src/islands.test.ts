import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createIslandParser, parseIslands } from './islands.js';
import type { MarkupIsland } from './islands.js';
import type { MarkupOptions } from './parser.js';

const options: MarkupOptions = { catalog: { id: 'test', version: '1' }, surfaceId: 'chat', revision: 0 };
const markup = '<text id="x">Hello &amp; 🚀</text>';
const fences = [
  ['backticks', '```lyra\n', '\n```\n'],
  ['tildes', '~~~lyra\n', '\n~~~\n'],
  ['longer closer', '```lyra\n', '\n`````\n'],
  ['indented fence', '   ```lyra\n', '\n   ```\n'],
  ['trailing horizontal space', '```lyra \t\n', '\n``` \t\n'],
  ['info separated with whitespace', '``` lyra\n', '\n```\n'],
  ['CR', '```lyra\r', '\r```\r'],
  ['CRLF', '```lyra\r\n', '\r\n```\r\n'],
  ['no final line break', '```lyra\n', '\n```']
] as const;
for (const [name, open, close] of fences) {
  test(`island fence conformance: ${name}`, () => {
    const source = `Before\n${open}${markup}${close}`;
    const result = parseIslands(source, options);
    assert.equal(result.parts.length, 2);
    assert.equal(result.parts[0]?.source, 'Before\n');
    const island = result.parts[1] as MarkupIsland;
    assert.equal(island.kind, 'island');
    assert.equal(island.closed, true);
    assert.equal(island.result.status, 'complete');
    assert.equal(island.result.view?.root.text, 'Hello & 🚀');
    assert.equal(source.slice(island.bodyStart, island.bodyEnd), island.body);
    assert.equal(result.parts.map(part => part.source).join(''), source);
    for (let split = 0; split <= source.length; split++) {
      const parser = createIslandParser(options);
      parser.push(source.slice(0, split)); parser.push(source.slice(split));
      assert.deepEqual(parser.finish(), result, `split ${split}`);
    }
  });
}
for (const [name, source] of [
  ['raw markup', markup], ['inline fence', `before \`\`\`lyra\n${markup}\n\`\`\``],
  ['escaped fence', `\\\`\`\`lyra\n${markup}\n\`\`\``],
  ['four space indent', `    \`\`\`lyra\n${markup}\n    \`\`\``],
  ['unknown info string', `\`\`\`html\n${markup}\n\`\`\``],
  ['additional info fields', `\`\`\`lyra live\n${markup}\n\`\`\``],
  ['short fence', `\`\`lyra\n${markup}\n\`\``],
  ['nested code example', `\`\`\`\`markdown\n\`\`\`lyra\n${markup}\n\`\`\`\n\`\`\`\``],
  ['capitalized info string', `\`\`\`Lyra\n${markup}\n\`\`\``],
  ['backtick in info string', `\`\`\`lyra\`\n${markup}\n\`\`\``]
] as const) {
  test(`preserve prose: ${name}`, () => {
    const result = parseIslands(source, options);
    assert.equal(result.parts.filter(part => part.kind === 'island').length, 0);
    assert.equal(result.parts.map(part => part.source).join(''), source);
  });
}
test('complete islands publish before later prose finishes with independent identities', () => {
  const parser = createIslandParser(options);
  const first = parser.push(`Intro\n\`\`\`lyra\n${markup}\n\`\`\`\n`);
  const firstIsland = first.parts[1] as MarkupIsland;
  assert.equal(firstIsland.result.status, 'complete');
  assert.equal(firstIsland.result.view?.surfaceId, 'chat:island-0');
  const later = parser.push(`More\n\`\`\`lyra\n${markup}\n\`\`\`\nStill streaming`);
  assert.strictEqual(later.parts[1], firstIsland);
  const secondIsland = later.parts[3] as MarkupIsland;
  assert.equal(secondIsland.result.view?.surfaceId, 'chat:island-1');
  assert.equal(later.parts[4]?.source, 'Still streaming');
});
test('an unclosed fence never exposes an activatable view', () => {
  const result = parseIslands(`\`\`\`lyra\n${markup}`, options);
  const island = result.parts[0] as MarkupIsland;
  assert.equal(island.closed, false);
  assert.equal(island.result.status, 'incomplete');
  assert.equal(island.result.view, undefined);
});
test('a shorter or different closer cannot activate an island', () => {
  for (const close of ['```', '~~~~', '```` extra']) {
    const result = parseIslands(`\`\`\`\`lyra\n${markup}\n${close}\n`, options);
    const island = result.parts[0] as MarkupIsland;
    assert.equal(island.closed, false);
    assert.equal(island.result.view, undefined);
  }
});
test('invalid closed island leaves surrounding prose intact', () => {
  const result = parseIslands('Before\n```lyra\n<script id="x"/>\n```\nAfter', options);
  assert.equal(result.parts[0]?.source, 'Before\n');
  assert.equal((result.parts[1] as MarkupIsland).result.status, 'error');
  assert.equal(result.parts[2]?.source, 'After');
});
test('UTF8 budget applies before a complete island can publish', () => {
  const parser = createIslandParser({ ...options, limits: { maxBytes: 30 } });
  const result = parser.push('```lyra\n<text id="x">🚀🚀🚀</text>\n```\n');
  assert.equal(result.parts.length, 0);
  assert.equal(result.diagnostics[0]?.code, 'source-byte-limit');
});
test('UTF8 byte accounting is independent of surrogate chunking', () => {
  const source = `\`\`\`lyra\n${markup}\n\`\`\`\n`;
  const limit = new TextEncoder().encode(source).length;
  for (const maxBytes of [limit - 1, limit]) {
    const config = { ...options, limits: { maxBytes } };
    const parser = createIslandParser(config);
    let last = parser.push('');
    for (let index = 0; index < source.length; index++) {
      const next = parser.push(source[index]!);
      if (next.diagnostics.length === 0) last = next;
    }
    const whole = parseIslands(source, config);
    const streamed = parser.finish();
    assert.deepEqual(streamed.diagnostics, whole.diagnostics);
    // A budget rejection keeps what streamed in before it; one whole push has nothing earlier.
    assert.deepEqual(streamed.parts, whole.diagnostics.length ? last.parts : whole.parts);
  }
});
test('byte then length overflow has deterministic final diagnostic', () => {
  const config = { ...options, limits: { maxBytes: 5, maxLength: 10 } };
  const parser = createIslandParser(config);
  parser.push('🚀🚀'); parser.push('abcdefghijkl');
  assert.deepEqual(parser.finish(), parseIslands('🚀🚀abcdefghijkl', config));
});
test('cancellation preserves complete islands and cannot commit incomplete ones', () => {
  const parser = createIslandParser(options);
  parser.push(`\`\`\`lyra\n${markup}\n\`\`\`\n\`\`\`lyra\n${markup}`);
  const result = parser.cancel();
  assert.equal((result.parts[0] as MarkupIsland).closed, true);
  assert.equal((result.parts[1] as MarkupIsland).closed, false);
  assert.deepEqual(parser.push('\n```\n'), result);
});
test('a rejected push keeps completed islands and prose beside the failure diagnostic', () => {
  for (const limits of [{ maxLength: 60 }, { maxBytes: 60 }]) {
    const parser = createIslandParser({ ...options, limits });
    const good = 'Before\n```lyra\n<text id="x">Hi</text>\n```\nAfter';
    const accepted = parser.push(good);
    assert.deepEqual(accepted.diagnostics, []);
    const rejected = parser.push('z'.repeat(60));
    assert.match(rejected.diagnostics[0]?.code ?? '', /^source-(?:length|byte)-limit$/);
    assert.deepEqual(rejected.parts, accepted.parts);
    assert.equal((rejected.parts[1] as MarkupIsland).result.status, 'complete');
    assert.deepEqual(parser.finish().parts, accepted.parts);
  }
  const parser = createIslandParser(options);
  const accepted = parser.push('Intro\n```lyra\n<text id="x">Hi</text>\n```\n');
  const invalid = parser.push(42 as unknown as string);
  assert.equal(invalid.diagnostics[0]?.code, 'invalid-input');
  assert.deepEqual(invalid.parts, accepted.parts);
});
test('single-character pushes and split CRLF terminators match one whole push', () => {
  const source = `Intro\r\n\`\`\`lyra\r\n${markup}\r\n\`\`\`\r\nTail\r~~~\rcode\r~~~\nend`;
  const whole = parseIslands(source, options);
  const parser = createIslandParser(options);
  for (const unit of source) parser.push(unit);
  assert.deepEqual(parser.finish(), whole);
});
