import assert from 'node:assert/strict';
import test from 'node:test';
import type { DocxEditorInstance } from '@docx-editor.dev/core';
import type { OoxmlElement, OoxmlNode } from '@docx-editor.dev/core/store';
import { createDocumentInspection } from './eigenpal-document-inspection.js';
import { WORD_NS as W, WORD_DRAWING_NS as WP, DRAWING_MAIN_NS as A, DRAWING_PICTURE_NS as PIC } from './ooxml.js';

let sequence = 0;
function el(localName: string, children: OoxmlNode[] = [], attrs: Record<string, string> = {}, namespaceUri = W): OoxmlElement {
  return { kind: 'element', id: `n-${++sequence}`, localName, namespaceUri, children,
    attributes: Object.entries(attrs).map(([localName, value]) => ({ localName, value, namespaceUri: namespaceUri === W ? W : '' })) } as unknown as OoxmlElement;
}
function paragraph(text: string, level?: number, style?: string) {
  return el('p', [el('pPr', [...(level === undefined ? [] : [el('outlineLvl', [], { val: String(level - 1) })]),
    ...(style ? [el('pStyle', [], { val: style })] : [])]), el('r', [el('t', [{ kind: 'textValue', id: `n-${++sequence}`, value: text }])])]);
}
function fixture(children: OoxmlNode[] = [paragraph('Introduction', 1), paragraph('Detail', 3)], styles: OoxmlNode[] = []) {
  const body = el('body', children), part = { name: '/word/document.xml', root: el('document', [body]) };
  const pkg = { mainDocumentPart: part.name, parts: new Map([[part.name, part]]) };
  if (styles.length) pkg.parts.set('/word/styles.xml', { name: '/word/styles.xml', root: el('styles', styles) });
  const f = { revision: 0, generation: 0, selected: '', canCalls: 0, execCalls: 0, onCan() {}, onPackage() {} };
  const session = { currentPackage: () => { f.onPackage(); return pkg; }, part: () => part, packageRevision: () => f.revision };
  const surface = { session, storyScope: () => ({ kind: 'body' }) };
  const editor = { surface, get mountGeneration() { return f.generation; }, can: () => { f.canCalls++; f.onCan(); return { ok: true }; },
    exec: (command: { range: { anchor: { paragraphId: string } } }) => { f.execCalls++; f.selected = command.range.anchor.paragraphId; return { ok: true, changed: false }; },
    getSelectedImage() { throw new Error('no layout queries'); }, save() { throw new Error('no save'); }, focus() { throw new Error('no focus'); } } as unknown as DocxEditorInstance;
  let current = editor;
  const helper = createDocumentInspection(() => current, run => run());
  return { f, editor, surface, session, helper, pkg, part, body, replace: () => { current = { ...editor } as DocxEditorInstance; } };
}

test('outline copies document order, real levels and tokens without mutation or layout reads', () => {
  const h = fixture(), before = structuredClone(h.pkg), result = h.helper.outline(); assert(result.ok);
  assert.deepEqual(result.value.items.map(({ level, text }) => ({ level, text })), [{ level: 1, text: 'Introduction' }, { level: 3, text: 'Detail' }]);
  assert.equal(result.value.truncated, false); assert(Object.isFrozen(result.value.items)); assert(Object.isFrozen(result.value.items[0]));
  assert.deepEqual(h.pkg, before); assert.equal(h.f.canCalls, 0); assert.equal(h.f.execCalls, 0);
  assert.deepEqual(h.helper.select(result.value.items[0]!.token), { ok: true, value: undefined });
  assert.equal(h.f.selected, h.body.children[0]!.id); assert.equal(h.f.revision, 0);
});

test('style inheritance resolves outline level, but unrecognized styles never guess from style id', () => {
  const parent = el('style', [el('pPr', [el('outlineLvl', [], { val: '1' })])], { styleId: 'Parent', type: 'paragraph' });
  const derived = el('style', [el('basedOn', [], { val: 'Parent' })], { styleId: 'Derived', type: 'paragraph' });
  const h = fixture([paragraph('Custom', undefined, 'Derived'), paragraph('Not a heading', undefined, 'Heading9')], [parent, derived]);
  const result = h.helper.outline(); assert(result.ok); assert.deepEqual(result.value.items.map(item => [item.level, item.text]), [[2, 'Custom']]);
});

test('inspection emits only stable rules/data and safe canonical navigation tokens', () => {
  const image = el('drawing', [el('inline', [el('docPr', [], { descr: ' ' }, WP), el('graphic', [el('graphicData', [el('pic', [], {}, PIC)], { uri: PIC }, A)], {}, A)], {}, WP)]);
  const p = paragraph('Picture'); (p.children[1] as unknown as { children: OoxmlNode[] }).children = [image];
  const table = el('tbl', [el('tr', [el('tc', [paragraph('Cell')])])]);
  const h = fixture([paragraph('Title', 1), paragraph('Skipped', 3), p, table]), result = h.helper.inspectDocument(); assert(result.ok);
  assert.deepEqual(result.value.diagnostics.map(item => item.rule), ['heading-level-skipped', 'image-description-missing', 'table-header-missing']);
  assert.deepEqual(result.value.diagnostics[0]!.data, { previousLevel: 1, level: 3 });
  assert(result.value.diagnostics.every(item => Object.isFrozen(item.data)));
  assert(result.value.capabilities.every(item => item.preserved === 'unverified' && item.renderable === 'unverified'));
  assert.equal(h.f.canCalls, 0); assert.equal(h.f.execCalls, 0);
});

test('forged, invalidated, disposed and stale tokens fail before dispatch', () => {
  for (const change of ['revision', 'generation', 'replace', 'invalidate', 'dispose']) {
    const h = fixture(), result = h.helper.outline(); assert(result.ok);
    if (change === 'revision') h.f.revision++;
    else if (change === 'generation') h.f.generation++;
    else if (change === 'replace') h.replace();
    else if (change === 'invalidate') h.helper.invalidate();
    else h.helper.dispose();
    assert.equal(h.helper.select(result.value.items[0]!.token).ok, false, change); assert.equal(h.f.execCalls, 0);
  }
  const h = fixture(); assert.deepEqual(h.helper.select({}), { ok: false, code: 'stale-selection' });
  const result = h.helper.outline(); assert(result.ok); h.f.onCan = () => { h.f.revision++; };
  assert.deepEqual(h.helper.select(result.value.items[0]!.token), { ok: false, code: 'stale-selection' }); assert.equal(h.f.execCalls, 0);
});

test('traversal/text/result budgets fail or explicitly truncate; cycles and duplicate ids refuse', () => {
  for (const limits of [{ parts: 0 }, { nodes: 1 }, { depth: 1 }, { text: 3 }]) {
    const h = fixture(), helper = createDocumentInspection(() => h.editor, run => run(), limits);
    assert.deepEqual(helper.outline(), { ok: false, code: 'resource-limit' });
  }
  const h = fixture([paragraph('😀'.repeat(200), 1), paragraph('Other', 2)]), helper = createDocumentInspection(() => h.editor, run => run(), { items: 1, label: 5 });
  const result = helper.outline(); assert(result.ok); assert.equal(result.value.items.length, 1); assert.equal(result.value.truncated, true);
  assert.equal(result.value.items[0]!.text, '😀😀'); assert.equal(result.value.items[0]!.textTruncated, true);
  const cyclic = fixture(); (cyclic.body.children as OoxmlNode[]).push(cyclic.body); assert.deepEqual(cyclic.helper.outline(), { ok: false, code: 'unsupported' });
  const duplicate = fixture(); (duplicate.body.children[1] as { id: string }).id = duplicate.body.children[0]!.id;
  assert.deepEqual(duplicate.helper.outline(), { ok: false, code: 'unsupported' });
});

test('accessor trees and sparse arrays refuse without invoking caller getters', () => {
  for (const target of ['children', 'attribute', 'node']) {
    const h = fixture(); let calls = 0;
    if (target === 'children') Object.defineProperty(h.body, 'children', { get() { calls++; return []; } });
    else if (target === 'node') Object.defineProperty(h.body.children[0], 'kind', { get() { calls++; return 'element'; } });
    else {
      const property = (h.body.children[0] as OoxmlElement).children[0] as OoxmlElement;
      const outline = property.children[0] as OoxmlElement;
      Object.defineProperty(outline.attributes[0], 'value', { get() { calls++; return '0'; } });
    }
    assert.deepEqual(h.helper.outline(), { ok: false, code: 'unsupported' }); assert.equal(calls, 0);
  }
  const h = fixture(); delete (h.body.children as OoxmlNode[])[0];
  assert.deepEqual(h.helper.inspectDocument(), { ok: false, code: 'unsupported' });
});

test('heading chains, named headings and direct body-text override have distinct semantics', () => {
  const named = el('style', [el('name', [], { val: 'Heading 4' })], { styleId: 'CustomName', type: 'paragraph' });
  const first = el('style', [el('basedOn', [], { val: 'Second' })], { styleId: 'First', type: 'paragraph' });
  const second = el('style', [el('basedOn', [], { val: 'First' })], { styleId: 'Second', type: 'paragraph' });
  const h = fixture([paragraph('Named', undefined, 'CustomName'), paragraph('Body', 10, 'CustomName'), paragraph('Cycle', undefined, 'First')], [named, first, second]);
  const result = h.helper.outline(); assert(result.ok); assert.deepEqual(result.value.items.map(item => [item.level, item.text]), [[4, 'Named']]);
  const inspection = h.helper.inspectDocument(); assert(inspection.ok);
  assert.equal(inspection.value.capabilities[0]!.refused, true);
  assert(inspection.value.diagnostics.some(item => item.rule === 'unsupported-content'));
});

test('complex tables are reported as uninspected, explicit header false is a missing-header diagnostic', () => {
  for (const kind of ['merged', 'nested', 'wrapped', 'header-false', 'header-true']) {
    const table = el('tbl', [el('tr', [el('tc', [paragraph('Cell')])])]);
    const row = table.children[0] as OoxmlElement, cell = row.children[0] as OoxmlElement;
    if (kind === 'merged') (cell.children as OoxmlNode[]).unshift(el('tcPr', [el('gridSpan', [], { val: '2' })]));
    if (kind === 'nested') (cell.children as OoxmlNode[]).push(el('tbl', [el('tr', [el('tc', [paragraph('Nested')])])]));
    if (kind === 'wrapped') (row.children as OoxmlNode[]).push(el('sdt', [paragraph('Wrapped')]));
    if (kind.startsWith('header')) (row.children as OoxmlNode[]).unshift(el('trPr', [el('tblHeader', [], { val: kind === 'header-true' ? '1' : '0' })]));
    const h = fixture([table]), result = h.helper.inspectDocument(); assert(result.ok);
    const tableCapability = result.value.capabilities.find(item => item.code === 'simple-table-headers')!;
    assert.equal(tableCapability.refused, !kind.startsWith('header'), kind);
    assert.equal(result.value.diagnostics.some(item => item.rule === 'table-header-missing'), kind === 'header-false', kind);
  }
});

test('inspection limits remain explicit and original owner changes during canonical query refuse', () => {
  const h = fixture(), helper = createDocumentInspection(() => h.editor, run => run(), { diagnostics: 0 });
  const result = helper.inspectDocument(); assert(result.ok); assert.equal(result.value.truncated, true); assert.equal(result.value.diagnostics.length, 0);
  h.f.onPackage = () => { h.f.revision++; };
  assert.deepEqual(h.helper.outline(), { ok: false, code: 'unsupported' }); assert.equal(h.f.execCalls, 0);
  for (const limit of [NaN, Infinity, -1, 0.5]) {
    assert.deepEqual(createDocumentInspection(() => fixture().editor, run => run(), { nodes: limit }).outline(), { ok: false, code: 'unsupported' });
  }
});

test('uninspected heading spans break hierarchy comparisons instead of manufacturing skipped-level defects', () => {
  const h = fixture([paragraph('First', 1), paragraph('Unknown', undefined, 'MissingStyle'), paragraph('Later', 3)]);
  const result = h.helper.inspectDocument(); assert(result.ok);
  assert.equal(result.value.diagnostics.some(item => item.rule === 'heading-level-skipped'), false);
  assert.equal(result.value.diagnostics.some(item => item.rule === 'unsupported-content'), true);
});

test('hidden heading/image content and non-picture inline payloads produce coverage limitations', () => {
  const hidden = paragraph('Hidden', 1);
  ((hidden.children[1] as OoxmlElement).children as OoxmlNode[]).unshift(el('rPr', [el('vanish')]));
  const payload = paragraph('Not a picture');
  ((payload.children[1] as OoxmlElement).children as OoxmlNode[]).push(el('drawing', [el('inline', [el('docPr', [], {}, WP), el('graphic', [el('graphicData', [el('pic', [], {}, PIC)], { uri: 'urn:other-data' }, A)], {}, A)], {}, WP)]));
  const h = fixture([hidden, payload]), outline = h.helper.outline(), report = h.helper.inspectDocument(); assert(outline.ok); assert(report.ok);
  assert.equal(outline.value.items.length, 0);
  assert.equal(report.value.diagnostics.some(item => item.rule === 'image-description-missing'), false);
  assert.equal(report.value.capabilities[0]!.refused, true); assert.equal(report.value.capabilities[1]!.refused, true);
});
