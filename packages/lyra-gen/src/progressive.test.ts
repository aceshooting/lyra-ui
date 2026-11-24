import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { propertyRuns } from '../test/property-options.js';
import { dashboardCatalog } from './catalog.js';
import { createJsonViewStream, parseJsonView } from './json-stream.js';
import { createMarkupParser } from './parser.js';
import type { LyraGenPartialView } from './partial-view.js';
import { createProgressiveMarkupParser } from './progressive.js';
import { validateView } from './runtime.js';
import type { LyraGenNode, LyraGenView } from './types.js';

interface Scenario { readonly id: string; readonly root: LyraGenNode }
// The benchmark corpus is plain authored data; a computed specifier keeps it out of the type graph.
const corpusUrl = new URL('../../../../benchmarks/generative-ui/dashboards/scenarios.mjs', import.meta.url).href;
const { scenarios } = await import(corpusUrl) as { scenarios: readonly Scenario[] };
const catalog = dashboardCatalog();
const reference = { id: catalog.id, version: catalog.version };
const viewOf = (root: LyraGenNode): LyraGenView => ({ version: '1', catalog: reference, surfaceId: 'bench', revision: 3, root });
const markupOptions = { catalog, surfaceId: 'bench', revision: 3, allowedTags: Object.keys(catalog.components) };

const escapeText = (value: string): string => value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
const escapeAttribute = (value: string): string => escapeText(value).replace(/"/gu, '&quot;');
function markup(node: LyraGenNode, depth = 0): string {
  const pad = '  '.repeat(depth);
  const attributes = [`id="${escapeAttribute(node.id)}"`];
  for (const [key, value] of Object.entries(node.props ?? {})) attributes.push(typeof value === 'string' ? `${key}="${escapeAttribute(value)}"` : `${key}={${JSON.stringify(value)}}`);
  if (typeof node.slot === 'string') attributes.push(`slot="${escapeAttribute(node.slot)}"`);
  for (const key of ['bindings', 'reads', 'liveReads', 'action'] as const) if (node[key] !== undefined) attributes.push(`${key}={${JSON.stringify(node[key])}}`);
  const open = `<${node.type} ${attributes.join(' ')}`;
  if (node.children?.length) return `${pad}${open}>\n${node.children.map(child => markup(child, depth + 1)).join('\n')}\n${pad}</${node.type}>`;
  if (typeof node.text === 'string' && node.text.length) return `${pad}${open}>${escapeText(node.text)}</${node.type}>`;
  return `${pad}${open} />`;
}
const nodesOf = (root: LyraGenNode): Map<string, LyraGenNode> => {
  const found = new Map<string, LyraGenNode>();
  const walk = (node: LyraGenNode): void => { found.set(node.id, node); node.children?.forEach(walk); };
  walk(root);
  return found;
};
const split = (source: string, widths: readonly number[]): string[] => {
  const chunks: string[] = [];
  for (let offset = 0, index = 0; offset < source.length; index++) { const width = widths[index % widths.length]!; chunks.push(source.slice(offset, offset + width)); offset += width; }
  return chunks;
};
type Format = 'json' | 'markup';
const sourceOf = (format: Format, root: LyraGenNode): string => format === 'json' ? JSON.stringify(viewOf(root)) : markup(root);
function stream(format: Format, chunks: readonly string[], minCodeUnits?: number): { partials: LyraGenPartialView[]; final: unknown; offsets: number[] } {
  const progressive = minCodeUnits === undefined ? {} : { minCodeUnits };
  const parser = format === 'json' ? createJsonViewStream({ catalog, progressive }) : createProgressiveMarkupParser({ ...markupOptions, progressive });
  const partials: LyraGenPartialView[] = [];
  const offsets: number[] = [];
  let consumed = 0;
  for (const chunk of chunks) {
    const step = parser.push(chunk);
    consumed += chunk.length;
    if (step.partial) { partials.push(step.partial); offsets.push(consumed); }
  }
  return { partials, final: parser.finish(), offsets };
}
const batch = (format: Format, source: string): unknown => {
  if (format === 'json') return parseJsonView(source, { catalog });
  const parser = createMarkupParser(markupOptions);
  parser.push(source);
  return parser.finish();
};
/** Shared preview invariants; `truth` holds the nodes every shown node must come from. */
function assertPreviews(partials: readonly LyraGenPartialView[], truth: ReadonlyMap<string, LyraGenNode>): void {
  let previous: Map<string, LyraGenNode> | undefined;
  partials.forEach((partial, index) => {
    assert.equal(partial.sequence, index + 1);
    assert.equal(validateView(partial.view, catalog).ok, true, 'every preview validates');
    assert.equal(partial.view.surfaceId, 'bench');
    assert.equal(partial.view.revision, 3);
    const shown = nodesOf(partial.view.root);
    for (const id of partial.partialNodes) assert.ok(shown.has(id), `open node ${id} is shown`);
    for (const [id, node] of shown) {
      const source = truth.get(id);
      assert.ok(source, `shown node ${id} was received, never invented`);
      assert.equal(node.type, source.type);
      if (!partial.partialNodes.includes(id)) assert.deepEqual(node, source, `complete node ${id} matches its final form`);
      else assert.deepEqual(node.children?.map(child => child.id), source.children?.slice(0, node.children?.length).map(child => child.id), `open node ${id} shows a prefix of its children`);
    }
    if (previous) for (const [id, node] of previous) assert.equal(shown.get(id)?.type, node.type, `node ${id} stays shown with its identity`);
    previous = shown;
  });
}
const validatedRoot = (root: LyraGenNode): Map<string, LyraGenNode> => {
  const checked = validateView(viewOf(root), catalog);
  assert.equal(checked.ok, true);
  return nodesOf(checked.ok ? checked.value.root : root);
};

test('previews under arbitrary chunk splits validate, only grow, and the final commit equals the non-progressive result', () => {
  fc.assert(fc.property(fc.constantFrom(...scenarios), fc.constantFrom<Format>('json', 'markup'), fc.array(fc.integer({ min: 1, max: 97 }), { minLength: 1, maxLength: 12 }), fc.constantFrom(0, 64, undefined), (scenario, format, widths, interval) => {
    const source = sourceOf(format, scenario.root);
    const { partials, final } = stream(format, split(source, widths), interval);
    assert.deepEqual(final, batch(format, source));
    assertPreviews(partials, validatedRoot(scenario.root));
  }), propertyRuns());
});

test('multi-panel dashboards show a validated root before half of the stream', () => {
  const panels = scenarios.filter(scenario => (scenario.root.children?.length ?? 0) >= 3);
  assert.ok(panels.length >= 8);
  for (const scenario of panels) for (const format of ['json', 'markup'] as const) {
    const source = sourceOf(format, scenario.root);
    const { partials, offsets } = stream(format, split(source, [24]));
    assert.ok(partials.length > 0, `${scenario.id}/${format} previews`);
    assert.equal(partials[0]!.view.root.id, scenario.root.id);
    assert.ok(offsets[0]! / source.length < 0.5, `${scenario.id}/${format} first root at ${(offsets[0]! / source.length).toFixed(2)}`);
  }
});

test('damaged streams never yield an invented or altered node', () => {
  fc.assert(fc.property(fc.constantFrom(...scenarios), fc.constantFrom<Format>('json', 'markup'), fc.double({ min: 0, max: 1, noNaN: true }), fc.constantFrom('', '<', '>', '"', '}', ']', '{', ',', '</stack>', '<text id="root">', '&bogus;', 'x'), fc.integer({ min: 1, max: 40 }), (scenario, format, at, stray, width) => {
    const source = sourceOf(format, scenario.root);
    const cut = Math.floor(source.length * at);
    const damaged = stray ? source.slice(0, cut) + stray + source.slice(cut) : source.slice(0, cut);
    const { partials, final } = stream(format, split(damaged, [width]), 0);
    assert.deepEqual(final, batch(format, damaged));
    if (!stray) { assertPreviews(partials, validatedRoot(scenario.root)); return; }
    // A stray character may change received data, but every shown identity was literally received.
    for (const partial of partials) for (const id of nodesOf(partial.view.root).keys()) {
      assert.ok(damaged.includes(format === 'json' ? `"id":${JSON.stringify(id)}` : `id="${id}"`), `shown node ${id} was received`);
    }
  }), propertyRuns());
});

test('a view header that arrives after the root defers previews to the commit', () => {
  const scenario = scenarios[0]!;
  const { root, ...header } = viewOf(scenario.root);
  const source = JSON.stringify({ root, ...header });
  const { partials, final } = stream('json', split(source, [8]), 0);
  assert.equal(partials.length, 0);
  assert.equal((final as { status: string }).status, 'complete');
});

test('progressive mode is opt in and previews never accompany a terminal result', () => {
  const source = sourceOf('json', scenarios[0]!.root);
  const plain = createJsonViewStream({ catalog });
  for (const chunk of split(source, [16])) assert.equal(plain.push(chunk).partial, undefined);
  const markupPlain = createMarkupParser(markupOptions);
  assert.equal(Object.hasOwn(markupPlain.push(markup(scenarios[0]!.root)), 'partial'), false);
  const progressive = createJsonViewStream({ catalog, progressive: true });
  progressive.push(source.slice(0, 200));
  assert.equal(progressive.cancel().partial, undefined);
  assert.equal(progressive.push(source.slice(200)).status, 'cancelled');
});

test('preview attempts are spaced so validation work stays linear', () => {
  const big: LyraGenNode = { id: 'root', type: 'stack', children: Array.from({ length: 300 }, (_, index) => ({ id: `t${index}`, type: 'text', text: `Row ${index}` })) };
  for (const format of ['json', 'markup'] as const) {
    const source = sourceOf(format, big);
    const { partials } = stream(format, split(source, [7]), 0);
    assert.ok(partials.length > 3 && partials.length < 40, `${format}: ${partials.length} previews`);
  }
});
