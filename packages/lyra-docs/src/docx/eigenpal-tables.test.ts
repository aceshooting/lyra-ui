import assert from 'node:assert/strict';
import test from 'node:test';
import type { DocxEditorInstance } from '@docx-editor.dev/core';
import type { OoxmlElement, OoxmlNode, OoxmlPart } from '@docx-editor.dev/core/store';
const { applyTreeOp, findNode, serializeOoxmlPart } = await import('@docx-editor.dev/core/store');
import type { TreeDocOp } from '@docx-editor.dev/core/store';
import { qualifyTableFormatting } from './eigenpal-table-formatting.js';
import { qualifyTableCommand, tableAvailability, tableContext } from './eigenpal-tables.js';
import type { DocxTableAction } from './types.js';

const WORD = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function fixture(rows = 2, columns = 2) {
  let id = 0;
  const kinds: Record<string, string> = { document: 'document', body: 'body', tbl: 'table', tr: 'tableRow', tc: 'tableCell', tblGrid: 'tableGrid', tblPr: 'tableProperties', p: 'paragraph' };
  const el = (name: string, children: OoxmlNode[] = [], namespaceUri = WORD): OoxmlElement =>
    ({ id: String(++id), kind: namespaceUri === WORD ? kinds[name] ?? 'generic' : 'generic', namespaceUri, localName: name, prefix: 'x', namespaceBindings: [], attributes: [], children } as OoxmlElement);
  const grid = el('tblGrid', Array.from({ length: columns }, () => el('gridCol')));
  const rowNodes = Array.from({ length: rows }, () => el('tr', Array.from({ length: columns }, () => el('tc', [el('tcPr'), el('p')]))));
  const table = el('tbl', [el('tblPr'), grid, ...rowNodes]), outside = el('p'), body = el('body', [outside, table]), root = el('document', [body]);
  Object.assign(root, { namespaceBindings: [{ prefix: 'x', namespaceUri: WORD }] });
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
    if (result.value.command && 'target' in result.value.command && typeof result.value.command.target === 'object' && 'tableId' in result.value.command.target) assert.equal(result.value.command.target?.tableId, h.table.id);
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

test('richer table actions retain original caret and use one command or public transaction plan', () => {
  const h = fixture();
  const actions = [
    { type: 'table-header-row', enabled: true }, { type: 'table-width', widthPoints: 100.05 },
    { type: 'table-cell-alignment', value: 'bottom' }, { type: 'table-cell-shading', color: '#ABCDEF' },
    { type: 'table-cell-borders', target: 'outside', style: 'double', widthPoints: 1.5, color: 'auto' },
    { type: 'table-cell-borders', target: 'top', style: 'none' },
  ] as const;
  for (const action of actions) {
    const result = h.qualify(action); assert.equal(result.ok, true); if (!result.ok) continue;
    assert.equal(result.value.valid(), true);
    if (action.type === 'table-header-row' || action.type === 'table-width') {
      assert.equal(result.value.command, undefined);
      assert.deepEqual(result.value.plan, { ok: true, selection: { kind: 'preserveSelection' }, ops: [
        { op: 'setTableProperties', tableId: h.table.id, ...(action.type === 'table-header-row' ? { headerRowCount: 1 } : { columnWidthsTwips: [1001, 1000] }) },
      ] });
    } else assert.equal(result.value.plan, undefined);
    h.f.end++; assert.equal(result.value.valid(), false); h.f.end--;
    h.f.revision++; assert.equal(result.value.valid(), false); h.f.revision--;
    h.f.offset++; h.f.end++; assert.equal(result.value.valid(), false); h.f.offset--; h.f.end--;
    assert.equal(h.f.revision, 0);
  }
  assert.equal(h.qualify({ type: 'table-width', widthPoints: 29.95 }).ok, false);
});

test('all richer formatting actions refuse merges, wrappers, ranges and bounded resource excess', () => {
  for (const action of [
    { type: 'table-header-row', enabled: true }, { type: 'table-width', widthPoints: 100 },
    { type: 'table-cell-alignment', value: 'center' }, { type: 'table-cell-shading', color: null },
    { type: 'table-cell-borders', target: 'all', style: 'none' },
  ] as const) {
    const h = fixture();
    assert.deepEqual(h.qualify(action, { cells: 1 }), { ok: false, code: 'resource-limit' });
    children(children(h.rows[1]!)[1]!)[0] = h.el('tcPr', [h.el('gridSpan')]);
    assert.deepEqual(h.qualify(action), { ok: false, code: 'unsupported' });
    const plain = fixture(); plain.f.end = 1;
    assert.deepEqual(plain.qualify(action), { ok: false, code: 'unsupported' });
  }
});

function prop(h: ReturnType<typeof fixture>, name: string, attributes: Record<string, string>) {
  const node = h.el(name);
  Object.assign(node, { attributes: Object.entries(attributes).map(([localName, value]) => ({ kind: 'genericExtension', namespaceUri: WORD, localName, value, prefix: 'x' })) });
  return node;
}

test('canonical matching values report unchanged without consulting rendered context', () => {
  const h = fixture(), cell = children(h.rows[0]!)[0]! as OoxmlElement, properties = children(cell)[0]!;
  children(properties).push(prop(h, 'vAlign', { val: 'center' }), prop(h, 'shd', { val: 'clear', fill: 'ABCDEF' }),
    h.el('tcBorders', ['top', 'left', 'bottom', 'right'].map(edge => prop(h, edge, { val: 'single', sz: '8', color: 'auto' }))));
  children(h.rows[0]!).unshift(h.el('trPr', [prop(h, 'tblHeader', { val: '1' })]));
  for (const action of [
    { type: 'table-header-row', enabled: true }, { type: 'table-cell-alignment', value: 'center' },
    { type: 'table-cell-shading', color: '#ABCDEF' },
    { type: 'table-cell-borders', target: 'all', style: 'single', widthPoints: 1, color: 'auto' },
    { type: 'table-cell-borders', target: 'inside', style: 'none' },
  ] as const) {
    h.f.tables = null;
    const result = h.qualify(action); assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value.unchanged, true, action.type);
  }
  children(properties).push(prop(h, 'vAlign', { val: 'bottom' }));
  assert.deepEqual(h.qualify({ type: 'table-cell-alignment', value: 'center' }), { ok: false, code: 'unsupported' });
});

test('public core table store operations preserve existing records and produce canonical no-op values', () => {
  for (const action of [
    { type: 'table-header-row', enabled: true }, { type: 'table-width', widthPoints: 100.05 },
    { type: 'table-cell-alignment', value: 'bottom' }, { type: 'table-cell-shading', color: '#ABCDEF' },
    { type: 'table-cell-borders', target: 'all', style: 'double', widthPoints: 1.5, color: '#123456' },
    { type: 'table-cell-borders', target: 'top', style: 'none' },
  ] as const) {
    const h = fixture();
    const selectedCell = children(h.rows[0]!)[0]! as OoxmlElement;
    children(h.table)[0] = h.el('tblPr', [prop(h, 'tblCaption', { val: 'Keep table caption' })]);
    children(selectedCell).push(h.el('p'));
    const before = serializeOoxmlPart(h.part), result = h.qualify(action);
    assert.equal(result.ok, true); if (!result.ok) continue;
    const command = result.value.command;
    let op: TreeDocOp;
    if (result.value.plan?.ok) op = result.value.plan.ops[0]!;
    else if (command?.type === 'setCellFill') {
      if (command.color?.kind === 'theme' || command.color?.kind === 'auto') throw Error('Only explicit hex colors are authored');
      op = { op: 'setTableCellFill', tableId: h.table.id, cellIds: [selectedCell.id], color: command.color };
    }
    else if (command?.type === 'setTableCellVerticalAlignment') op = { op: 'setTableCellVerticalAlignment', tableId: h.table.id, cellIds: [selectedCell.id], alignment: command.alignment };
    else if (command?.type === 'setTableBorders') {
      if (command.scope === 'none') op = { op: 'setTableCellBorders', tableId: h.table.id, cellIds: [selectedCell.id], scope: command.scope, target: command.target };
      else {
        if (command.spec.color.kind === 'theme' || command.spec.color.kind === 'auto') throw Error('Only explicit colors are authored');
        op = { op: 'setTableCellBorders', tableId: h.table.id, cellIds: [selectedCell.id], scope: command.scope, spec: { ...command.spec, color: command.spec.color } };
      }
    }
    else throw Error('Expected one supported table formatting operation');
    const applied = applyTreeOp(h.part, op);
    assert.equal(applied.ok, true, JSON.stringify(applied)); if (!applied.ok) continue;
    assert.equal(serializeOoxmlPart(h.part), before);
    assert.match(serializeOoxmlPart(applied.part), /Keep table caption/u);
    const table = findNode(applied.part, h.table.id) as OoxmlElement;
    const rows = children(table).filter((node): node is OoxmlElement => node.kind !== 'textValue' && node.localName === 'tr');
    const cells = rows.flatMap(row => children(row).filter((node): node is OoxmlElement => node.kind !== 'textValue' && node.localName === 'tc'));
    const grid = table.children.find(node => node.kind !== 'textValue' && node.localName === 'tblGrid') as OoxmlElement;
    const aligned = qualifyTableFormatting(action, table, rows, cells, grid.children as OoxmlElement[], findNode(applied.part, selectedCell.id) as OoxmlElement);
    assert.equal(aligned.ok && aligned.value.unchanged, true, action.type);
    assert.deepEqual(cells.map(cell => cell.children.filter(node => node.kind !== 'textValue' && node.localName === 'p').length), [2, 1, 1, 1]);
  }
});

type Fixture = ReturnType<typeof fixture>;
const cellParagraph = (h: Fixture, row: number, column = 0) => children(children(h.rows[row]!)[column]!)[1] as OoxmlElement;
const tableProperties = (h: Fixture) => children(h.table)[0] as OoxmlElement;

test('a selection that resolves outside the qualified part is refused', () => {
  const h = fixture();
  assert.equal(h.qualify().ok, true);
  Object.assign(h.part, { root: h.el('document', [h.el('body')]) });
  assert.deepEqual(h.qualify(), { ok: false, code: 'unsupported' });
});

test('a selection whose readers place the table under another body than the document body is refused', () => {
  const h = fixture(), impostor = h.el('body', [h.table]);
  h.rebuild();
  const readers = { findNode: h.readers.findNode, parentNodeOf: (part: OoxmlPart, id: string) =>
    id === h.table.id ? impostor : id === impostor.id ? h.root : h.readers.parentNodeOf(part, id) };
  assert.deepEqual(qualifyTableCommand(h.editor, readers, { type: 'delete-table' }), { ok: false, code: 'unsupported' });
  assert.equal(qualifyTableCommand(h.editor, h.readers, { type: 'delete-table' }).ok, true);
});

test('canonical reads judge the size of the document top level before its structure, and bound the depth inside the table', () => {
  const crowded = fixture();
  children(crowded.root).push(crowded.el('bookmarkStart'));
  assert.deepEqual(crowded.qualify(), { ok: false, code: 'unsupported' });
  assert.deepEqual(crowded.qualify(undefined, { nodes: 1 }), { ok: false, code: 'resource-limit' });
  const h = fixture();
  children(cellParagraph(h, 1, 1)).push(h.el('r'));
  assert.equal(h.qualify(undefined, { depth: 7 }).ok, true);
  assert.deepEqual(h.qualify(undefined, { depth: 6 }), { ok: false, code: 'resource-limit' });
  assert.equal(fixture().qualify(undefined, { depth: 6 }).ok, true);
});

test('formatting actions report a stale selection when the package changes while they are qualified', () => {
  for (const action of [
    { type: 'table-header-row', enabled: true }, { type: 'table-width', widthPoints: 100 },
    { type: 'table-cell-alignment', value: 'center' }, { type: 'table-cell-shading', color: '#ABCDEF' },
    { type: 'table-cell-borders', target: 'all', style: 'none' },
  ] as const) {
    const h = fixture();
    assert.equal(h.qualify(action).ok, true, action.type);
    h.f.onPackage = () => { h.f.revision++; };
    assert.deepEqual(h.qualify(action), { ok: false, code: 'stale-selection' }, action.type);
  }
});

test('an element that repeats an attribute is refused, while the same name in another namespace is kept', () => {
  const attribute = (value: string, namespaceUri = WORD) => ({ kind: 'genericExtension', namespaceUri, localName: 'val', value, prefix: 'x' });
  const withAttributes = (...attributes: object[]) => {
    const h = fixture();
    children(children(h.rows[1]!)[1]!)[0] = Object.assign(h.el('tcPr'), { attributes });
    return h;
  };
  assert.equal(withAttributes(attribute('1'), attribute('2', 'urn:other')).qualify().ok, true);
  assert.deepEqual(withAttributes(attribute('1'), attribute('2')).qualify(), { ok: false, code: 'unsupported' });
});

test('text and foreign extension elements inside a cell paragraph are kept unless they imitate table structure', () => {
  const h = fixture();
  const text = { id: 'cell-text', kind: 'textValue', value: 'Cell text' } as unknown as OoxmlNode;
  // A foreign element is judged by its namespace, so a borders-like name with repeated children is not a table record.
  children(cellParagraph(h, 1)).push(text, h.el('widget', [h.el('part', [], 'urn:foreign')], 'urn:foreign'),
    h.el('tcBorders', [h.el('top'), h.el('top')], 'urn:foreign'));
  assert.equal(h.qualify().ok, true);
  for (const name of ['tbl', 'tr', 'tc', 'tblGrid', 'gridCol']) {
    const imitation = fixture();
    children(cellParagraph(imitation, 1)).push(imitation.el(name, [], 'urn:foreign'));
    assert.deepEqual(imitation.qualify(), { ok: false, code: 'unsupported' }, name);
  }
});

test('table structure outside the parent it requires is refused', () => {
  const cell = (h: Fixture) => h.el('tc', [h.el('tcPr'), h.el('p')]);
  const misplaced: [string, (h: Fixture) => void][] = [
    ['a table inside a paragraph', h => children(cellParagraph(h, 1)).push(h.el('tbl'))],
    ['a row beside the table properties', h => children(tableProperties(h)).push(h.el('tr', [cell(h), cell(h)]))],
    ['a cell beside the table properties', h => children(tableProperties(h)).push(cell(h))],
    ['a second grid inside the table properties', h => children(tableProperties(h)).push(h.el('tblGrid'))],
    ['a grid column inside the table properties', h => { children(h.grid).pop(); children(tableProperties(h)).push(h.el('gridCol')); }],
  ];
  assert.equal(fixture().qualify().ok, true);
  for (const [label, place] of misplaced) {
    const h = fixture();
    place(h);
    assert.deepEqual(h.qualify(), { ok: false, code: 'unsupported' }, label);
  }
});

test('text placed directly inside table structure is refused', () => {
  const text = { id: 'stray-text', kind: 'textValue', value: 'stray' } as unknown as OoxmlNode;
  const containers: [string, (h: Fixture) => OoxmlNode][] = [['table', h => h.table], ['row', h => h.rows[0]!], ['cell', h => children(h.rows[0]!)[0]!], ['grid', h => h.grid]];
  for (const [label, container] of containers) {
    const h = fixture();
    children(container(h)).push(text);
    assert.deepEqual(h.qualify(), { ok: false, code: 'unsupported' }, label);
  }
});

test('a table without a declared grid takes its width from its rows and addresses columns by position', () => {
  const h = fixture(2, 3);
  children(h.table).splice(1, 1);
  const insert = h.qualify({ type: 'insert-table-column', where: 'right' }), remove = h.qualify({ type: 'delete-table-column' });
  assert.deepEqual(insert.ok && insert.value.command, { type: 'insertColumn', where: 'right' });
  assert.deepEqual(remove.ok && remove.value.command, { type: 'deleteColumn' });
  const row = h.qualify({ type: 'delete-table-row' });
  assert.equal(row.ok && row.value.command?.type, 'deleteRow');
  const single = fixture(2, 1);
  children(single.table).splice(1, 1);
  const only = single.qualify({ type: 'delete-table-column' });
  assert.deepEqual(only.ok && only.value.command, { type: 'deleteTable' });
  children(h.rows[1]!).pop();
  assert.deepEqual(h.qualify(), { ok: false, code: 'unsupported' });
});

test('a table whose first row has no cells and which declares no grid has no width to qualify against', () => {
  const h = fixture();
  children(h.table).splice(1, 1);
  h.f.paragraphId = cellParagraph(h, 1).id;
  assert.equal(h.qualify().ok, true);
  children(h.rows[0]!).length = 0;
  assert.deepEqual(h.qualify(), { ok: false, code: 'unsupported' });
});
