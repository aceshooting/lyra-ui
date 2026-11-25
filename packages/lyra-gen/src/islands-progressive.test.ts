import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createIslandParser, parseIslands, type IslandParserOptions, type IslandResult, type MarkupIsland } from './islands.js';
import type { LyraGenPartialView } from './partial-view.js';
import type { LyraGenCatalog, LyraGenNode } from './types.js';

const catalog: LyraGenCatalog = { id: 'island-test', version: '1', components: {
  stack: { tag: 'div', properties: {}, children: true },
  text: { tag: 'p', properties: {}, text: true },
} };
const base = { catalog, surfaceId: 'chat', revision: 2, allowedTags: Object.keys(catalog.components) };
const progressive: IslandParserOptions = { ...base, progressive: { catalog, minCodeUnits: 0 } };
const body = '<stack id="answer">\n  <text id="one">First</text>\n  <text id="two">Second</text>\n'
  + '  <stack id="inner">\n    <text id="three">Third</text>\n  </stack>\n  <text id="four">Fourth</text>\n</stack>';
const source = `Intro\n\`\`\`lyra\n${body}\n\`\`\`\nAfter`;

const openIsland = (result: IslandResult): MarkupIsland | undefined =>
  result.parts.find((part): part is MarkupIsland => part.kind === 'island' && !part.closed);
const ids = (root: LyraGenNode): Map<string, string> => {
  const found = new Map<string, string>();
  const walk = (node: LyraGenNode): void => { found.set(node.id, node.type); node.children?.forEach(walk); };
  walk(root);
  return found;
};
function streamed(text: string, width: number, options: IslandParserOptions = progressive): { previews: LyraGenPartialView[]; parser: ReturnType<typeof createIslandParser>; last: IslandResult } {
  const parser = createIslandParser(options);
  const previews: LyraGenPartialView[] = [];
  let last: IslandResult = { parts: [], diagnostics: [] };
  for (let offset = 0; offset < text.length; offset += width) {
    last = parser.push(text.slice(offset, offset + width));
    const partial = openIsland(last)?.partial;
    if (partial && partial !== previews.at(-1)) previews.push(partial);
  }
  return { previews, parser, last };
}

test('an open island yields monotonic previews carrying the final surface and revision', () => {
  for (const width of [1, 3, 7, 24]) {
    const { previews, parser } = streamed(source, width);
    assert.ok(previews.length >= 2, `width ${width} previews`);
    for (const [index, preview] of previews.entries()) {
      assert.equal(preview.view.surfaceId, 'chat:island-0');
      assert.equal(preview.view.revision, 2);
      if (index === 0) continue;
      const previous = previews[index - 1]!;
      assert.ok(preview.sequence > previous.sequence);
      const now = ids(preview.view.root);
      for (const [id, type] of ids(previous.view.root)) assert.equal(now.get(id), type, `width ${width}: ${id} stays shown`);
    }
    const final = parser.finish();
    assert.deepEqual(final, parseIslands(source, base), `width ${width} final`);
    const island = final.parts[1] as MarkupIsland;
    assert.equal(island.partial, undefined);
    assert.equal(island.result.view?.surfaceId, previews[0]!.view.surfaceId);
  }
});

test('the final result equals the non-progressive parser for every two-chunk split', () => {
  const text = `A\n\`\`\`lyra\n<stack id="s"><text id="t">Hi</text><text id="u">There</text></stack>\n\`\`\`\nB\n\`\`\`lyra\n<text id="v">Next</text>\n\`\`\``;
  const expected = parseIslands(text, base);
  for (let split = 0; split <= text.length; split++) {
    const parser = createIslandParser(progressive);
    parser.push(text.slice(0, split)); parser.push(text.slice(split));
    assert.deepEqual(parser.finish(), expected, `split ${split}`);
  }
});

test('without opting in no island carries a preview', () => {
  const { previews } = streamed(source, 5, base);
  assert.equal(previews.length, 0);
});

test('a second island previews under its own ordinal surface', () => {
  const text = `\`\`\`lyra\n<text id="a">A</text>\n\`\`\`\n\`\`\`lyra\n<stack id="b"><text id="c">C</text>`;
  const { last } = streamed(text, 4);
  assert.equal(openIsland(last)?.partial?.view.surfaceId, 'chat:island-1');
});

test('cancel and an unclosed finish clear the preview and keep the island inert', () => {
  const partialSource = `\`\`\`lyra\n${body.slice(0, 80)}`;
  const cancelled = streamed(partialSource, 6);
  assert.ok(openIsland(cancelled.last)?.partial);
  const afterCancel = openIsland(cancelled.parser.cancel())!;
  assert.equal(afterCancel.partial, undefined);
  assert.equal(afterCancel.result.status, 'incomplete');
  const finished = streamed(partialSource, 6);
  const afterFinish = openIsland(finished.parser.finish())!;
  assert.equal(afterFinish.partial, undefined);
  assert.equal(afterFinish.result.view, undefined);
});

test('a malformed island never previews nodes absent from its source, stops growing at a syntax defect and clears on close', () => {
  const unknown = '```lyra\n<stack id="s">\n<text id="t">Real</text>\n<script id="x">bad</script>\n<text id="u">Also real</text>\n';
  const { previews } = streamed(unknown, 3);
  assert.ok(previews.length > 0);
  for (const preview of previews) {
    for (const [id, type] of ids(preview.view.root)) {
      assert.notEqual(type, 'script');
      assert.ok(unknown.includes(`id="${id}"`), `${id} comes from the source`);
    }
  }
  const broken = streamed('```lyra\n<stack id="s">\n<text id="t">Real</text>\n<text id="u" <<< ="x">\n<text id="w">Later</text>\n', 2);
  const shown = openIsland(broken.last)?.partial;
  assert.deepEqual(shown ? [...ids(shown.view.root).keys()] : [], shown ? ['s', 't'] : []);
  const final = broken.parser.push('```\n');
  assert.equal((final.parts[0] as MarkupIsland).result.status, 'error');
  assert.equal((final.parts[0] as MarkupIsland).partial, undefined);
});

test('a closing fence that is still arriving never reaches the preview as text', () => {
  const text = '```lyra\n<stack id="s">\n<text id="t">Kept</text>\n</stack>\n``';
  const { last } = streamed(text, 1);
  const preview = openIsland(last)!.partial!;
  assert.equal(preview.view.root.children?.[0]?.text, 'Kept');
  assert.equal(JSON.stringify(preview.view).includes('`'), false);
  const closed = createIslandParser(progressive);
  closed.push(text);
  const done = closed.push('`\n');
  assert.equal((done.parts[0] as MarkupIsland).result.status, 'complete');
  assert.equal((done.parts[0] as MarkupIsland).partial, undefined);
});

test('a rejected push clears the preview with the retained parts', () => {
  const parser = createIslandParser({ ...progressive, limits: { maxLength: 60 } });
  const first = parser.push('```lyra\n<stack id="s"><text id="t">Kept</text>');
  assert.ok(openIsland(first)?.partial);
  const rejected = parser.push('x'.repeat(80));
  assert.equal(rejected.diagnostics[0]?.code, 'source-length-limit');
  for (const part of rejected.parts) if (part.kind === 'island') assert.equal(part.partial, undefined);
});
