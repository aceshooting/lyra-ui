import type { DocxEditorInstance, EditorCommand } from '@docx-editor.dev/core';
import type { OoxmlElement, OoxmlNode } from '@docx-editor.dev/core/store';
import type { DocxCommandAvailability, DocxResult, DocxTableAction, DocxTableContext } from './types.js';
import { DOCX_LIMITS } from './commands.js';

export type TableReaders = Pick<typeof import('@docx-editor.dev/core/store'), 'findNode' | 'parentNodeOf'>;
const WORD = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export const TABLE_READ_LIMITS = Object.freeze({ parts: 128, nodes: 20_000, depth: 64, attributes: 64, cells: 4_000 });
const word = (node: OoxmlNode, name: string): node is OoxmlElement =>
  node.kind !== 'textValue' && node.namespaceUri === WORD && node.localName === name;
const refusal = (code: 'unsupported' | 'resource-limit' | 'stale-selection'): DocxResult<never> => ({ ok: false, code });

/** Copy rendered context only after input settlement: the core layout getter can flush text. */
export function tableContext(editor: DocxEditorInstance): Readonly<DocxTableContext> | null {
  const table = typeof editor.getSelectedTable === 'function' ? editor.getSelectedTable() : null;
  if (!table || !Number.isSafeInteger(table.rowCount) || table.rowCount < 1 ||
    !Number.isSafeInteger(table.columnCount) || table.columnCount < 1) return null;
  const coordinate = (value: number | undefined, size: number) =>
    value !== undefined && Number.isSafeInteger(value) && value >= 0 && value < size ? value : null;
  return Object.freeze({ rows: table.rowCount, columns: table.columnCount,
    rowIndex: coordinate(table.cell?.row, table.rowCount), columnIndex: coordinate(table.cell?.column, table.columnCount) });
}

export function tableAvailability(editor: DocxEditorInstance, action: DocxTableAction, table: Readonly<DocxTableContext> | null): DocxCommandAvailability {
  const surface = editor.surface;
  if (!surface) return { enabled: false, reason: 'no-selection' };
  const state = surface.state();
  if (surface.storyScope().kind !== 'body' || state.cellSelection ||
    state.selection.anchor.paragraphId !== state.selection.head.paragraphId ||
    state.selection.anchor.offset !== state.selection.head.offset) return { enabled: false, reason: 'unsupported' };
  // Absence of rendered context is not proof of an outside-table caret. Execution resolves ancestry.
  if (action.type === 'insert-table') return { enabled: !table, ... (table ? { reason: 'unsupported' as const } : {}) };
  return table ? { enabled: true } : { enabled: false, reason: 'unsupported' };
}

/** Explicit-operation guard. The upstream ancestry index can do a cold whole-part build. */
export function qualifyTableCommand(editor: DocxEditorInstance, readers: TableReaders, action: DocxTableAction,
  limits = TABLE_READ_LIMITS): DocxResult<{ command: EditorCommand; valid(): boolean }> {
  const surface = editor.surface;
  if (!surface) return refusal('unsupported');
  const session = surface.session, generation = editor.mountGeneration, revision = session.packageRevision();
  const initial = surface.state(), scope = surface.storyScope();
  if (scope.kind !== 'body' || initial.cellSelection ||
    initial.selection.anchor.paragraphId !== initial.selection.head.paragraphId ||
    initial.selection.anchor.offset !== initial.selection.head.offset) return refusal('unsupported');
  const paragraphId = initial.selection.head.paragraphId, offset = initial.selection.head.offset;
  const valid = () => {
    if (editor.surface !== surface || editor.mountGeneration !== generation || surface.session !== session ||
      session.packageRevision() !== revision || surface.storyScope().kind !== 'body') return false;
    const state = surface.state();
    return state.cellSelection === null && state.selection.anchor.paragraphId === paragraphId &&
      state.selection.head.paragraphId === paragraphId && state.selection.anchor.offset === offset && state.selection.head.offset === offset;
  };
  const pkg = session.currentPackage(), part = session.part();
  if (pkg.parts.size > limits.parts) return refusal('resource-limit');
  if (pkg.parts.get(pkg.mainDocumentPart) !== part || !word(part.root, 'document')) return refusal('unsupported');
  if (part.root.children.length > limits.nodes) return refusal('resource-limit');
  let body: OoxmlElement | null = null;
  for (const child of part.root.children) {
    if (!word(child, 'body') || body) return refusal('unsupported');
    body = child;
  }
  const ancestors: OoxmlElement[] = [];
  let cursor = readers.findNode(part, paragraphId);
  if (!cursor || !word(cursor, 'p')) return refusal('unsupported');
  while (cursor) {
    if (ancestors.length >= limits.depth) return refusal('resource-limit');
    ancestors.push(cursor);
    cursor = readers.parentNodeOf(part, cursor.id);
  }
  ancestors.reverse();
  if (ancestors[0] !== part.root || ancestors[1] !== body) return refusal('unsupported');
  if (action.type === 'insert-table') {
    if (ancestors.length !== 3) return refusal('unsupported');
    return valid() ? { ok: true, value: { command: { type: 'insertTable', rows: action.rows, cols: action.columns }, valid } } : refusal('stale-selection');
  }
  if (ancestors.length !== 6 || !word(ancestors[2]!, 'tbl') || !word(ancestors[3]!, 'tr') ||
    !word(ancestors[4]!, 'tc')) return refusal('unsupported');
  const table = ancestors[2]!, selectedRow = ancestors[3]!, selectedCell = ancestors[4]!;
  let nodes = 0, cells = 0, rows = 0, columns = 0, rowIndex = -1, columnIndex = -1;
  const ids = new Set<string>(), rowSizes: number[] = [], gridIds: string[] = [];
  const stack: { node: OoxmlNode; depth: number; parent: string; row: number }[] = [{ node: table, depth: 3, parent: 'body', row: -1 }];
  const forbidden = new Set(['gridSpan', 'vMerge', 'hMerge', 'gridBefore', 'gridAfter', 'sdt', 'ins', 'del', 'moveFrom', 'moveTo', 'tblPrChange', 'trPrChange', 'tcPrChange']);
  while (stack.length) {
    const frame = stack.pop()!, node = frame.node;
    if (++nodes > limits.nodes || frame.depth > limits.depth) return refusal('resource-limit');
    if (ids.has(node.id)) return refusal('unsupported');
    ids.add(node.id);
    if (node.kind === 'textValue') {
      if (frame.parent === 'tbl' || frame.parent === 'tr' || frame.parent === 'tc' || frame.parent === 'tblGrid') return refusal('unsupported');
      continue;
    }
    if (node.attributes.length > limits.attributes || node.children.length + stack.length > limits.nodes - nodes) return refusal('resource-limit');
    if (forbidden.has(node.localName)) return refusal('unsupported');
    if (['tbl', 'tr', 'tc', 'tblGrid', 'gridCol'].includes(node.localName) && node.namespaceUri !== WORD) return refusal('unsupported');
    const name = node.namespaceUri === WORD ? node.localName : '';
    if ((name === 'tbl' && node !== table) || (name === 'tr' && frame.parent !== 'tbl') ||
      (name === 'tc' && frame.parent !== 'tr') || (name === 'tblGrid' && frame.parent !== 'tbl') ||
      (name === 'gridCol' && frame.parent !== 'tblGrid')) return refusal('unsupported');
    const allowed = name === 'tbl' ? ['tblPr', 'tblGrid', 'tr'] : name === 'tr' ? ['trPr', 'tc'] :
      name === 'tc' ? ['tcPr', 'p'] : name === 'tblGrid' ? ['gridCol'] : null;
    if (allowed) {
      const seen = new Set<string>();
      for (const child of node.children) {
        if (child.kind === 'textValue' || child.namespaceUri !== WORD || !allowed.includes(child.localName)) return refusal('unsupported');
        if (child.localName.endsWith('Pr') || child.localName === 'tblGrid') {
          if (seen.has(child.localName)) return refusal('unsupported');
          seen.add(child.localName);
        }
      }
    }
    if (name === 'tr') {
      frame.row = rows++;
      rowSizes.push(0);
      if (node === selectedRow) rowIndex = frame.row;
    }
    if (name === 'tc') {
      if (++cells > limits.cells) return refusal('resource-limit');
      const index = rowSizes[frame.row]!;
      rowSizes[frame.row] = index + 1;
      if (node === selectedCell) columnIndex = index;
      if (!node.children.some(child => word(child, 'p'))) return refusal('unsupported');
    }
    if (name === 'gridCol') gridIds.push(node.id);
    for (let index = node.children.length - 1; index >= 0; index--) {
      stack.push({ node: node.children[index]!, depth: frame.depth + 1, parent: name, row: frame.row });
    }
  }
  columns = gridIds.length || rowSizes[0] || 0;
  if (!rows || !columns || rowIndex < 0 || columnIndex < 0 || rowSizes.some(size => size !== columns)) return refusal('unsupported');
  if ((action.type === 'insert-table-row' && (rows + 1 > DOCX_LIMITS.tableRows || columns > DOCX_LIMITS.tableColumns || (rows + 1) * columns > DOCX_LIMITS.tableCells)) ||
    (action.type === 'insert-table-column' && (rows > DOCX_LIMITS.tableRows || columns + 1 > DOCX_LIMITS.tableColumns || rows * (columns + 1) > DOCX_LIMITS.tableCells))) return refusal('resource-limit');
  const rowTarget = { sourceRevision: revision, tableId: table.id, rowId: selectedRow.id, isHeaderRepeat: false };
  const columnTarget = gridIds[columnIndex] ? { sourceRevision: revision, tableId: table.id, gridColumnId: gridIds[columnIndex]!, isHeaderRepeat: false } : undefined;
  let command: EditorCommand;
  switch (action.type) {
    case 'insert-table-row': command = { type: 'insertRow', where: action.where, target: rowTarget }; break;
    case 'insert-table-column': command = { type: 'insertColumn', where: action.where, ...(columnTarget ? { target: columnTarget } : {}) }; break;
    case 'delete-table-row': command = { type: 'deleteRow', target: rowTarget }; break;
    // Explicit column targets preserve at least one column; deleting the final column removes its table.
    case 'delete-table-column': command = columns === 1 ? { type: 'deleteTable' } : { type: 'deleteColumn', ...(columnTarget ? { target: columnTarget } : {}) }; break;
    case 'delete-table': command = { type: 'deleteTable' }; break;
  }
  return valid() ? { ok: true, value: { command, valid } } : refusal('stale-selection');
}
