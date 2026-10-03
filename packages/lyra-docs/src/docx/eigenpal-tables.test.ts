import assert from 'node:assert/strict';
import test from 'node:test';
import type { DocxEditorInstance } from '@docx-editor.dev/core';
import type { OoxmlElement, OoxmlNode, OoxmlPart } from '@docx-editor.dev/core/store';
import { qualifyTableCommand, tableAvailability, tableContext } from './eigenpal-tables.js';
import type { DocxTableAction } from './types.js';

const WORD = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function fixture(rows = 2, columns = 2) {
  let id = 0;
  const el = (name: string, children: OoxmlNode[] = [], namespaceUri = WORD): OoxmlElement =>
    ({ id: String(++id), kind: 'generic', namespaceUri, localName: name, prefix: 'x', namespaceBindings: [], attributes: [], children } as OoxmlElement);
  const grid = el('tblGrid', Array.from({ length: columns }, () => el('gridCol')));
  const rowNodes = Array.from({ length: rows }, () => el('tr', Array.from({ length: columns }, () => el('tc', [el('tcPr'), el('p')]))));
  const table = el('tbl', [el('tblPr'), grid, ...rowNodes]), outside = el('p'), body = el('body', [outside, table]), root = el('document', [body]);
  const part = { id: 'body', name: '/word/document.xml', contentType: '', root } as OoxmlPart;
  const nodes = new Map<string, OoxmlElement>(), parents = new Map<string, OoxmlElement>();
  const index = (node: OoxmlElement) => { nodes.set(node.id, node); for (const child of node.children) { parents.set(child.id, node); if (child.kind !== 'textValue') index(child); } };
  const paragraph = rowNodes[0]!.children[0] as OoxmlElement;
  const selected = paragraph.children[1]!;
  const f = { revision: 0, generation: 0, scope: 'body', rectangle: null as object | null, paragraphId: selected.id,
    offset: 0, end: 0, surface: true, tables: { blockId: table.id, rowCount: rows, columnCount: columns, cell: { row: 0, column: 0 } } as ReturnType<DocxEditorInstance['getSelectedTable']>, calls: 0, parts: new Map([[part.name, part]]), onPackage: () => {} };
  const surface = { session: { packageRevision: () => f.revision, part: () => part,
    currentPackage: () => { f.onPackage(); return { parts: f.parts, mainDocumentPart: part.name }; } },
  state: () => ({ selection: { anchor: { paragraphId: f.paragraphId, offset: f.offset }, head: { paragraphId: f.paragraphId, offset: f.end } }, cellSelection: f.rectangle }),
  storyScope: () => ({ kind: f.scope }) };
  const editor = { get surface() { return f.surface ? surface : null; }, get mountGeneration() { return f.generation; },
    getSelectedTable: () => f.tables, can: () => { f.calls++; throw Error('Pure read called can'); }, save: () => { throw Error('Pure read saved'); } } as unknown as DocxEditorInstance;
  const readers = { findNode: (_part: OoxmlPart, target: string) => nodes.get(target) ?? null,
    parentNodeOf: (_part: OoxmlPart, target: string) => parents.get(target) ?? null };
  const rebuild = () => { nodes.clear(); parents.clear(); index(root); };
  rebuild();
  const qualify = (action: DocxTableAction = { type: 'delete-table' }, limits?: Parameters<typeof qualifyTableCommand>[3]) => { rebuild(); return qualifyTableCommand(editor, readers, action, limits); };
  return { f, el, grid, table, root, body, outside, rows: rowNodes, editor, part, readers, qualify, rebuild };
}
const children = (node: OoxmlNode) => (node as unknown as { children: OoxmlNode[] }).children;

test('table availability is advisory and never invokes core can or canonical readers', () => {
  const h = fixture();
  assert.deepEqual(tableContext(h.editor), { rows: 2, columns: 2, rowIndex: 0, columnIndex: 0 });
  assert.equal(Object.isFrozen(tableContext(h.editor)), true);
  assert.equal(tableAvailability(h.editor, { type: 'delete-table' }, tableContext(h.editor)).enabled, true);
  assert.equal(tableAvailability(h.editor, { type: 'insert-table', rows: 1, columns: 1 }, tableContext(h.editor)).enabled, false);
  h.f.tables = null;
  assert.equal(tableAvailability(h.editor, { type: 'insert-table', rows: 1, columns: 1 }, tableContext(h.editor)).enabled, true);
  assert.equal(tableAvailability(h.editor, { type: 'delete-table' }, tableContext(h.editor)).enabled, false);
  for (const mode of ['rectangle', 'range', 'header', 'surface']) {
    h.f.rectangle = mode === 'rectangle' ? Object.defineProperty({}, 'cellIds', { get() { throw Error('array read'); } }) : null;
    h.f.end = mode === 'range' ? 1 : 0; h.f.scope = mode === 'header' ? 'header' : 'body'; h.f.surface = mode !== 'surface';
    assert.equal(tableAvailability(h.editor, { type: 'delete-table' }, tableContext(h.editor)).enabled, false);
  }
  assert.equal(h.f.calls, 0);
});

test('rendered context sanitizes counts and coordinates without leaking engine IDs', () => {
  const h = fixture();
  for (const [rowCount, columnCount] of [[0, 2], [2, 0], [NaN, 2], [2, Infinity], [1.5, 2]] as const) {
    h.f.tables = { blockId: 'private', rowCount, columnCount, cell: null };
    assert.equal(tableContext(h.editor), null);
  }
  for (const cell of [null, { row: -1, column: 3 }, { row: 0.5, column: NaN }]) {
    h.f.tables = { blockId: 'private', rowCount: 2, columnCount: 2, cell };
    assert.deepEqual(tableContext(h.editor), { rows: 2, columns: 2, rowIndex: null, columnIndex: null });
  }
  assert.equal(tableContext({} as DocxEditorInstance), null);
});

test('qualified actions use exact canonical row/grid identities and retain a pure stale guard', () => {
  const h = fixture();
  for (const action of [{ type: 'insert-table-row', where: 'above' }, { type: 'insert-table-column', where: 'right' },
    { type: 'delete-table-row' }, { type: 'delete-table-column' }, { type: 'delete-table' }] as const) {
    const result = h.qualify(action); assert.equal(result.ok, true); if (!result.ok) continue;
    assert.equal(result.value.valid(), true);
    assert.equal(h.f.revision, 0);
    if ('target' in result.value.command && typeof result.value.command.target === 'object' && 'tableId' in result.value.command.target) assert.equal(result.value.command.target?.tableId, h.table.id);
    h.f.revision++; assert.equal(result.value.valid(), false); h.f.revision--;
    h.f.generation++; assert.equal(result.value.valid(), false); h.f.generation--;
    h.f.end++; assert.equal(result.value.valid(), false); h.f.end--;
    h.f.scope = 'header'; assert.equal(result.value.valid(), false); h.f.scope = 'body';
    h.f.rectangle = {}; assert.equal(result.value.valid(), false); h.f.rectangle = null;
    h.f.surface = false; assert.equal(result.value.valid(), false); h.f.surface = true;
  }
  h.f.tables = null;
  assert.equal(h.qualify({ type: 'insert-table', rows: 2, columns: 2 }).ok, false);
  h.f.paragraphId = h.outside.id;
  const inserted = h.qualify({ type: 'insert-table', rows: 2, columns: 3 });
  assert.equal(inserted.ok, true);
  if (inserted.ok) assert.deepEqual(inserted.value.command, { type: 'insertTable', rows: 2, cols: 3 });
  assert.equal(h.qualify().ok, false);
});

test('table growth is bounded but ordinary over-limit tables can be reduced', () => {
  for (const [rows, columns, row, column] of [[20, 20, false, false], [19, 20, true, false], [20, 19, false, true], [21, 2, false, false]] as const) {
    const h = fixture(rows, columns);
    assert.equal(h.qualify({ type: 'insert-table-row', where: 'below' }).ok, row);
    assert.equal(h.qualify({ type: 'insert-table-column', where: 'left' }).ok, column);
    assert.equal(h.qualify({ type: 'delete-table-row' }).ok, true);
  }
});

test('merges anywhere, nested tables, wrappers and ambiguous structural records fail closed', () => {
  for (const kind of ['gridSpan', 'vMerge', 'hMerge', 'gridBefore', 'gridAfter', 'sdt', 'ins', 'del', 'moveFrom', 'moveTo', 'tblPrChange', 'trPrChange', 'tcPrChange']) {
    const h = fixture(); children(children(h.rows[1]!)[1]!)[0] = h.el('tcPr', [h.el(kind)]);
    assert.deepEqual(h.qualify(), { ok: false, code: 'unsupported' }, kind);
  }
  for (const change of [
    (h: ReturnType<typeof fixture>) => children(children(h.rows[1]!)[1]!).push(h.el('tbl')),
    (h: ReturnType<typeof fixture>) => children(h.table).push(h.el('tblGrid')),
    (h: ReturnType<typeof fixture>) => children(h.rows[0]!).unshift(h.el('trPr'), h.el('trPr')),
    (h: ReturnType<typeof fixture>) => children(children(h.rows[0]!)[0]!).push(h.el('tcPr')),
    (h: ReturnType<typeof fixture>) => children(h.rows[1]!).pop(),
    (h: ReturnType<typeof fixture>) => children(h.table).push(h.el('tr', [], 'urn:foreign')),
    (h: ReturnType<typeof fixture>) => children(h.grid).push(h.el('gridCol', [], 'urn:foreign')),
    (h: ReturnType<typeof fixture>) => children(h.table).push(h.el('unknown')),
    (h: ReturnType<typeof fixture>) => children(h.root).push(h.el('body')),
    (h: ReturnType<typeof fixture>) => children(h.grid).push(h.grid.children[0]!),
    (h: ReturnType<typeof fixture>) => children(h.rows[1]!).push(h.el('tc', [h.el('tcPr')])),
  ]) { const h = fixture(); change(h); assert.equal(h.qualify().ok, false); }
});

test('canonical reads refuse unsupported identity, scopes and bounded resource excess', () => {
  for (const [limit, value] of [['parts', 0], ['nodes', 1], ['depth', 2], ['cells', 1], ['attributes', -1]] as const) {
    const h = fixture(); assert.deepEqual(h.qualify(undefined, { [limit]: value }), { ok: false, code: 'resource-limit' });
  }
  for (const mode of ['scope', 'rectangle', 'range', 'missing', 'surface', 'part', 'root']) {
    const h = fixture();
    if (mode === 'scope') h.f.scope = 'header';
    if (mode === 'rectangle') h.f.rectangle = {};
    if (mode === 'range') h.f.end = 1;
    if (mode === 'missing') h.f.paragraphId = 'missing';
    if (mode === 'surface') h.f.surface = false;
    if (mode === 'part') h.f.parts.clear();
    if (mode === 'root') Object.assign(h.root, { namespaceUri: 'urn:other' });
    assert.equal(h.qualify().ok, false, mode);
  }
  const h = fixture(); h.f.onPackage = () => { h.f.revision++; };
  assert.deepEqual(h.qualify(), { ok: false, code: 'stale-selection' });
  h.f.paragraphId = h.outside.id;
  assert.deepEqual(h.qualify({ type: 'insert-table', rows: 1, columns: 1 }), { ok: false, code: 'stale-selection' });
});


test('deleting the final column uses one whole-table command after simple topology qualification', () => {
  for (const rows of [1, 3]) {
    const h = fixture(rows, 1), result = h.qualify({ type: 'delete-table-column' });
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.value.command, { type: 'deleteTable' });
    children(children(h.rows[0]!)[0]!)[0] = h.el('tcPr', [h.el('vMerge')]);
    assert.deepEqual(h.qualify({ type: 'delete-table-column' }), { ok: false, code: 'unsupported' });
  }
});
