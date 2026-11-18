import assert from 'node:assert/strict';
import test from 'node:test';
import type { DocxEditorInstance } from '@docx-editor.dev/core';
import type { OoxmlElement, OoxmlNode } from '@docx-editor.dev/core/store';
import { createEigenpalEditing } from './eigenpal-editing.js';
import type { TableReaders } from './eigenpal-tables.js';
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
  const f = { revision: 0, selected: '', story: 'body', styles: [] as { styleId: string; name: string; type: string }[],
    anchor: { paragraphId: '', offset: 0 }, head: { paragraphId: '', offset: 0 }, cells: false, drawing: false, onPackage() {} };
  const session = { currentPackage: () => { f.onPackage(); return pkg; }, part: () => part, packageRevision: () => f.revision };
  const editor = {
    surface: { session, storyScope: () => ({ kind: f.story }),
      state: () => ({ selection: { anchor: f.anchor, head: f.head }, cellSelection: f.cells ? {} : null }),
      drawingSelectionIntent: () => f.drawing ? { kind: 'pointer', drawingNodeId: 'selected-drawing' } : { kind: 'none' } },
    getDocumentStyles: () => f.styles, mountGeneration: 0, can: () => ({ ok: true }),
    exec: (command: { range: { anchor: { paragraphId: string } } }) => { f.selected = command.range.anchor.paragraphId; return { ok: true, changed: false }; },
  } as unknown as DocxEditorInstance;
  const helper = createDocumentInspection(() => editor, action => action());
  return { f, helper, body, pkg, editor };
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

test('painted paragraph identity follows current body order across duplicate text and edits', () => {
  const first = paragraph('Repeated'), second = paragraph('Repeated'), nested = paragraph('Repeated');
  const h = fixture([first, el('tbl', [el('tr', [el('tc', [nested])])]), second]);
  assert.deepEqual([...h.helper.paragraphIndexes()!], [[first.id, 0], [second.id, 2]]);
  const inserted = paragraph('Repeated');
  (h.body.children as OoxmlNode[]).unshift(inserted);
  h.f.revision++;
  assert.deepEqual([...h.helper.paragraphIndexes()!], [[inserted.id, 0], [first.id, 1], [second.id, 3]]);
  assert.equal(fixture([first, first]).helper.paragraphIndexes(), null, 'ambiguous canonical identity');
  h.f.onPackage = () => { h.f.revision++; };
  assert.equal(h.helper.paragraphIndexes(), null);
  h.helper.dispose();
  assert.equal(h.helper.paragraphIndexes(), null);
});


test('selection uses the semantic head and the outline and fragment element ordinals after a reorder', () => {
  const first = paragraph('Same', { level: 1 }), second = paragraph('Same', { level: 2 });
  const cell = paragraph('Cell'), drawingHost = el('p', [run(el('drawing'))]);
  const table = el('tbl', [el('tr', [el('tc', [el('tbl', [el('tr', [el('tc', [cell])])])])])]);
  const h = fixture([text('\n'), first, el('sdt'), table, second, drawingHost, el('sectPr')]);
  const nodes = new Map<string, OoxmlNode>(), parents = new Map<string, OoxmlElement>();
  const index = (node: OoxmlNode) => {
    nodes.set(node.id, node);
    if (node.kind !== 'textValue') for (const child of node.children) {
      parents.set(child.id, node);
      index(child);
    }
  };
  index(h.body);
  const readers: TableReaders = { findNode: (_part, id) => nodes.get(id) ?? null,
    parentNodeOf: (_part, id) => parents.get(id) ?? null };
  const selectedIndex = (paragraphId: string) => {
    h.f.head = { paragraphId, offset: 0 };
    return h.helper.selectionBlock(readers);
  };
  const fragment = read(h.helper), outline = h.helper.outline();
  assert(outline.ok);
  assert.deepEqual(outline.value.items.map(item => item.blockIndex), [0, 3]);
  h.f.anchor = { paragraphId: first.id, offset: 0 };
  assert.deepEqual(selectedIndex(first.id), { ok: true, value: fragment.blocks[0]!.index });
  assert.deepEqual(selectedIndex(second.id), { ok: true, value: fragment.blocks[3]!.index });
  h.f.anchor = { paragraphId: second.id, offset: 2 };
  assert.deepEqual(selectedIndex(first.id), { ok: true, value: fragment.blocks[0]!.index }, 'a backward range follows its head');
  h.f.cells = true;
  assert.deepEqual(selectedIndex(cell.id), { ok: true, value: fragment.blocks[2]!.index }, 'nested cells resolve to their top-level table');
  h.f.cells = false; h.f.drawing = true;
  assert.deepEqual(selectedIndex(drawingHost.id), { ok: true, value: fragment.blocks[4]!.index });
  h.f.drawing = false; h.f.story = 'headerFooter';
  assert.deepEqual(selectedIndex(first.id), { ok: true, value: null });
  h.f.story = 'body';
  assert.deepEqual(selectedIndex('unmapped'), { ok: true, value: null });
  h.f.head = { paragraphId: cell.id, offset: 0 };
  assert.deepEqual(h.helper.selectionBlock({ ...readers, findNode(part, id) {
    h.f.head = { paragraphId: second.id, offset: 0 };
    return readers.findNode(part, id);
  } }), { ok: false, code: 'stale-selection' });
  const blocks = h.body.children as OoxmlNode[];
  blocks.splice(1, 1);
  blocks.splice(4, 0, first);
  h.f.revision++;
  assert.deepEqual(selectedIndex(first.id), { ok: true, value: 3 });
  assert.deepEqual(read(h.helper).blocks[3]?.text, 'Same');
  const reordered = h.helper.outline();
  assert(reordered.ok);
  assert.deepEqual(reordered.value.items.map(item => [item.level, item.blockIndex]), [[2, 2], [1, 3]]);
});

test('paragraph style entries share fragment heading levels for authored, inherited and ambiguous styles', () => {
  const definition = (id: string, name: string, base: string | null, level: string | null) => el('style', [
    el('name', [], { val: name }),
    ...(base === null ? [] : [el('basedOn', [], { val: base })]),
    ...(level === null ? [] : [el('pPr', [el('outlineLvl', [], { val: level })])]),
  ], { type: 'paragraph', styleId: id });
  const definitions = [
    definition('InstitutionA', 'Titre institutionnel', null, '3'),
    definition('Custom', 'Sous-titre', 'InstitutionA', null),
    definition('NameFallback', 'HeAdInG 9', null, null),
    definition('BodyText', 'heading 2', 'InstitutionA', '9'),
    definition('Invalid', 'heading 2', 'InstitutionA', 'invalid'),
    definition('Missing', 'Missing base', 'NoSuchStyle', null),
    definition('CycleA', 'Cycle A', 'CycleB', null),
    definition('CycleB', 'Cycle B', 'CycleA', null),
  ];
  const cases = [
    ['InstitutionA', 'Titre institutionnel', 4], ['Custom', 'Sous-titre', 4],
    ['NameFallback', 'Heading 9', 9], ['BodyText', 'Body text', null],
    ['Invalid', 'Invalid level', null], ['Missing', 'Missing base', null],
    ['CycleA', 'Cycle A', null], ['CycleB', 'Cycle B', null],
  ] as const;
  const h = fixture([...cases.map(([id]) => paragraph(id, { style: id })),
    paragraph('Direct override', { style: 'Custom', level: 2 })], definitions);
  h.f.styles = cases.map(([styleId, name]) => ({ styleId, name, type: 'paragraph' }));
  const editing = createEigenpalEditing(() => h.editor, action => action(), () => ({ ok: true, value: undefined }));
  const catalog = editing.paragraphStyles();
  assert.deepEqual(catalog.items.map(item => [item.id, item.label, item.outlineLevel]), cases);
  assert.deepEqual(read(h.helper).blocks.map(block => block.headingLevel), [...cases.map(([, , level]) => level), 2]);
  assert.equal(editing.paragraphStyles(), catalog);
  h.pkg.parts.set('/word/styles.xml', { name: '/word/styles.xml',
    root: el('styles', [definition('InstitutionA', 'Titre institutionnel', null, '5'), ...definitions.slice(1)]) });
  h.f.revision++;
  const refreshed = editing.paragraphStyles();
  assert.notEqual(refreshed, catalog);
  assert.deepEqual(refreshed.items.slice(0, 2).map(item => item.outlineLevel), [6, 6]);
  h.pkg.parts.set('/other/styles.xml', { name: '/other/styles.xml', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml',
    root: el('styles') });
  assert(editing.paragraphStyles().items.every(item => item.outlineLevel === null));
  assert.equal(read(h.helper).blocks[0]!.headingLevel, null);
});
