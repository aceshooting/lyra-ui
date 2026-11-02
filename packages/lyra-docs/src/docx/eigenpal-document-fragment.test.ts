import assert from 'node:assert/strict';
import test from 'node:test';
import type { DocxEditorInstance } from '@docx-editor.dev/core';
import type { OoxmlElement, OoxmlNode } from '@docx-editor.dev/core/store';
import { createDocumentInspection } from './eigenpal-document-inspection.js';
import { DOCX_FRAGMENT_LIMITS } from './document-operations.js';
import { WORD_NS as W } from './ooxml.js';

let sequence = 0;
const text = (value: string): OoxmlNode => ({ kind: 'textValue', id: `n-${++sequence}`, value }) as unknown as OoxmlNode;
function el(localName: string, children: OoxmlNode[] = [], attrs: Record<string, string> = {}): OoxmlElement {
  return { kind: 'element', id: `n-${++sequence}`, localName, namespaceUri: W, children,
    attributes: Object.entries(attrs).map(([localName, value]) => ({ localName, value, namespaceUri: W })) } as unknown as OoxmlElement;
}
const run = (...parts: OoxmlNode[]) => el('r', parts);
const t = (value: string) => el('t', [text(value)]);
function paragraph(content: string, options: { level?: number; style?: string } = {}) {
  const properties = [...(options.style ? [el('pStyle', [], { val: options.style })] : []),
    ...(options.level === undefined ? [] : [el('outlineLvl', [], { val: String(options.level - 1) })])];
  return el('p', [...(properties.length ? [el('pPr', properties)] : []), run(t(content))]);
}
function fixture(children: OoxmlNode[], styles: OoxmlNode[] = []) {
  const body = el('body', children), part = { name: '/word/document.xml', root: el('document', [body]) };
  const pkg = { mainDocumentPart: part.name, parts: new Map<string, unknown>([[part.name, part]]) };
  if (styles.length) pkg.parts.set('/word/styles.xml', { name: '/word/styles.xml', root: el('styles', styles) });
  const f = { revision: 0, selected: '', onPackage() {} };
  const session = { currentPackage: () => { f.onPackage(); return pkg; }, part: () => part, packageRevision: () => f.revision };
  const editor = { surface: { session }, mountGeneration: 0, can: () => ({ ok: true }),
    exec: (command: { range: { anchor: { paragraphId: string } } }) => { f.selected = command.range.anchor.paragraphId; return { ok: true, changed: false }; },
  } as unknown as DocxEditorInstance;
  const helper = createDocumentInspection(() => editor, action => action());
  return { f, helper, body, pkg };
}
const read = (helper: ReturnType<typeof fixture>['helper'], request: Partial<{ start: number; token: object; maxBlocks: number; maxText: number }> = {}) => {
  const result = helper.fragment({ maxBlocks: 16, maxText: 8192, ...request });
  assert(result.ok, JSON.stringify(result));
  return result.value;
};

test('a fragment copies a contiguous block slice with kinds, styles, heading levels and text', () => {
  const heading = el('style', [el('name', [], { val: 'heading 2' })], { type: 'paragraph', styleId: 'Heading2' });
  const quote = el('style', [el('name', [], { val: 'Quote' }), el('basedOn', [], { val: 'Heading2' })], { type: 'paragraph', styleId: 'Quote' });
  const table = el('tbl', [el('tr', [el('tc', [paragraph('A1'), paragraph('more')]), el('tc', [paragraph('')]), el('tc', [paragraph('C1')])]),
    el('tr', [el('tc', [paragraph('A2')]), el('tc', [paragraph('B2')]), el('tc', [])])]);
  const mixed = el('p', [run(t('Tab'), el('tab'), t('break'), el('br'), t('end')), el('del', [run(el('delText', [text('gone')]))]),
    run(el('instrText', [text('PAGE')]))]);
  const h = fixture([paragraph('Title', { level: 1 }), paragraph('Styled', { style: 'Heading2' }), paragraph('Inherited', { style: 'Quote' }),
    paragraph('Plain', { style: 'Missing' }), table, mixed, el('sectPr')], [heading, quote]);
  const before = structuredClone(h.pkg);
  const fragment = read(h.helper);
  assert.deepEqual(fragment.blocks.map(({ index, kind, styleId, headingLevel, text, textTruncated }) =>
    [index, kind, styleId, headingLevel, text, textTruncated]), [
    [0, 'paragraph', null, 1, 'Title', false],
    [1, 'paragraph', 'Heading2', 2, 'Styled', false],
    [2, 'paragraph', 'Quote', 2, 'Inherited', false],
    [3, 'paragraph', 'Missing', null, 'Plain', false],
    [4, 'table', null, null, 'A1 more\t\tC1\nA2\tB2\t', false],
    [5, 'paragraph', null, null, 'Tab\tbreak\nend', false],
    [6, 'other', null, null, '', false],
  ]);
  assert.deepEqual([fragment.start, fragment.blockCount, fragment.next, fragment.truncated], [0, 7, null, false]);
  assert(Object.isFrozen(fragment) && Object.isFrozen(fragment.blocks) && Object.isFrozen(fragment.blocks[0]));
  assert(fragment.blocks.every(block => (block.token !== null) === (block.kind === 'paragraph')));
  assert.deepEqual(h.pkg, before, 'reading never mutates the package');
});

test('only the requested blocks are visited, and next continues the slice', () => {
  const blocks = Array.from({ length: 10 }, (_, index) => paragraph(`P${index}`));
  const h = fixture(blocks);
  // Poison every block outside the requested range: visiting one would throw.
  for (const index of [0, 1, 2, 6, 7, 8, 9]) Object.defineProperty(blocks[index]!, 'children', { get() { throw new Error('visited'); } });
  const fragment = read(h.helper, { start: 3, maxBlocks: 3 });
  assert.deepEqual(fragment.blocks.map(block => block.text), ['P3', 'P4', 'P5']);
  assert.deepEqual([fragment.start, fragment.next, fragment.blockCount], [3, 6, 10]);
});

test('the end of the body is an empty fragment, and a start beyond it is refused', () => {
  const h = fixture([paragraph('Only')]);
  assert.deepEqual(read(h.helper, { start: 1 }).blocks, []);
  assert.equal(read(h.helper, { start: 1 }).next, null);
  assert.deepEqual(h.helper.fragment({ start: 2, maxBlocks: 1, maxText: 1 }), { ok: false, code: 'invalid-option' });
  const empty = fixture([]);
  assert.deepEqual([read(empty.helper).blockCount, read(empty.helper).blocks.length, read(empty.helper).next], [0, 0, null]);
});

test('text budgets clip without dividing a surrogate pair and stop the fragment', () => {
  const long = '😀'.repeat(DOCX_FRAGMENT_LIMITS.blockText);
  const h = fixture([paragraph(long), paragraph('second'), paragraph('third')]);
  const first = read(h.helper);
  assert.equal(first.blocks[0]!.textTruncated, true);
  assert.equal(first.blocks[0]!.text.length, DOCX_FRAGMENT_LIMITS.blockText);
  assert.equal(first.truncated, true);
  const small = read(h.helper, { maxText: 5 });
  assert.deepEqual(small.blocks.map(block => [block.text, block.textTruncated]), [['😀😀', true]]);
  assert.equal(small.next, 1, 'an exhausted text budget ends the slice where the next read continues');
  const exact = read(h.helper, { start: 1, maxText: 6 });
  assert.deepEqual([exact.blocks.map(block => block.text), exact.truncated, exact.next], [['second'], false, 2]);
});

test('a block larger than the node budget is truncated and ends the slice instead of refusing it', () => {
  const runs = [run(t('start')), ...Array.from({ length: DOCX_FRAGMENT_LIMITS.nodes - 1 }, () => el('r'))];
  const h = fixture([el('p', runs), paragraph('after')]);
  const fragment = read(h.helper);
  assert.deepEqual([fragment.blocks.length, fragment.blocks[0]!.textTruncated, fragment.truncated, fragment.next], [1, true, true, 1]);
  assert.deepEqual(read(h.helper, { start: 1 }).blocks.map(block => block.text), ['after']);
});

test('a fragment can start at a current outline token and its paragraph tokens navigate', () => {
  const h = fixture([paragraph('Intro', { level: 1 }), paragraph('Body'), paragraph('Next', { level: 1 }), paragraph('Tail')]);
  const outline = h.helper.outline(); assert(outline.ok);
  const fragment = read(h.helper, { token: outline.value.items[1]!.token });
  assert.deepEqual([fragment.start, fragment.blocks.map(block => block.text)], [2, ['Next', 'Tail']]);
  assert.deepEqual(h.helper.select(fragment.blocks[1]!.token!), { ok: true, value: undefined });
  assert.equal(h.f.selected, (h.body.children[3] as unknown as { id: string }).id);
  assert.equal(h.helper.resolve(fragment.blocks[0]!.token!), (h.body.children[2] as unknown as { id: string }).id);
  h.f.revision++;
  assert.equal(h.helper.resolve(fragment.blocks[0]!.token!), null, 'tokens expire with the revision');
  assert.deepEqual(h.helper.fragment({ token: outline.value.items[0]!.token, maxBlocks: 1, maxText: 1 }), { ok: false, code: 'stale-selection' });
  assert.deepEqual(h.helper.fragment({ token: {}, maxBlocks: 1, maxText: 1 }), { ok: false, code: 'stale-selection' });
});

test('a token whose paragraph is no longer a top-level block is stale', () => {
  const nested = paragraph('Cell');
  const h = fixture([paragraph('Top'), el('tbl', [el('tr', [el('tc', [nested])])])]);
  const fragment = read(h.helper); h.helper.invalidate();
  const outlineLike = read(h.helper);
  (h.body.children as unknown as OoxmlNode[]).splice(0, 1);
  assert.deepEqual(h.helper.fragment({ token: outlineLike.blocks[0]!.token!, maxBlocks: 1, maxText: 1 }), { ok: false, code: 'stale-selection' });
  assert.equal(h.helper.resolve(fragment.blocks[0]!.token!), null, 'invalidation forgets earlier tokens');
});

test('malformed, oversized, changing or disposed documents are refused', () => {
  const missingBody = fixture([]); (missingBody.pkg.parts.get('/word/document.xml') as { root: OoxmlElement }).root = el('document', []);
  assert.deepEqual(missingBody.helper.fragment({ maxBlocks: 1, maxText: 1 }), { ok: false, code: 'unsupported' });
  const huge = fixture(Array.from({ length: DOCX_FRAGMENT_LIMITS.bodyBlocks + 1 }, () => el('p')));
  assert.deepEqual(huge.helper.fragment({ maxBlocks: 1, maxText: 1 }), { ok: false, code: 'resource-limit' });
  const racing = fixture([paragraph('a')]); racing.f.onPackage = () => { racing.f.revision++; };
  assert.deepEqual(racing.helper.fragment({ maxBlocks: 1, maxText: 1 }), { ok: false, code: 'unsupported' });
  const disposed = fixture([paragraph('a')]); disposed.helper.dispose();
  assert.deepEqual(disposed.helper.fragment({ maxBlocks: 1, maxText: 1 }), { ok: false, code: 'unsupported' });
  const ambiguous = fixture([paragraph('Dup', { style: 'Dup' })], [el('style', [], { type: 'paragraph', styleId: 'Dup' }),
    el('style', [], { type: 'paragraph', styleId: 'Dup' })]);
  assert.equal(read(ambiguous.helper).blocks[0]!.headingLevel, null, 'ambiguous styles yield no level rather than a guess');
  const cycle = fixture([paragraph('Loop', { style: 'A' })], [el('style', [el('basedOn', [], { val: 'B' })], { type: 'paragraph', styleId: 'A' }),
    el('style', [el('basedOn', [], { val: 'A' })], { type: 'paragraph', styleId: 'B' })]);
  assert.equal(read(cycle.helper).blocks[0]!.headingLevel, null);
  const bodyText = fixture([paragraph('Body text', { level: 10 })]);
  assert.equal(read(bodyText.helper).blocks[0]!.headingLevel, null, 'outline level 9 is body text');
});
