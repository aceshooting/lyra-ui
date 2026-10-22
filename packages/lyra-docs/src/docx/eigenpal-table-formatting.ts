import type { DocxEditorInstance, EditorCommand } from '@docx-editor.dev/core';
import type { OoxmlElement, OoxmlNode } from '@docx-editor.dev/core/store';
import type { DocxResult, DocxTableAction } from './types.js';
import { WORD_NS as WORD } from './ooxml.js';

type FormattingAction = Extract<DocxTableAction, { type: 'table-header-row' | 'table-width' | 'table-cell-alignment' | 'table-cell-shading' | 'table-cell-borders' }>;
type TableCommandPlan = Parameters<NonNullable<DocxEditorInstance['surface']>['applyTableCommandPlan']>[0];
/** One table edit: exactly one engine step, a command or a command plan, and whether it would change nothing. */
export type TableFormatting = { readonly unchanged?: boolean } & (
  | { readonly command: EditorCommand; readonly plan?: never }
  | { readonly plan: TableCommandPlan; readonly command?: never }
);
const child = (node: OoxmlElement | undefined, name: string): OoxmlElement | undefined =>
  (node?.children as readonly OoxmlNode[] | undefined)?.find((value): value is OoxmlElement => value.kind !== 'textValue' && value.namespaceUri === WORD && value.localName === name);
const attribute = (node: OoxmlElement | undefined, name: string) =>
  node?.attributes.find(value => value.namespaceUri === WORD && value.localName === name)?.value;
const hasAttribute = (node: OoxmlElement | undefined, names: readonly string[]) =>
  node?.attributes.some(value => value.namespaceUri === WORD && names.includes(value.localName)) ?? false;
const exact = (node: OoxmlElement | undefined, attrs: Record<string, string>) => !!node && node.children.length === 0 &&
  node.attributes.length === Object.keys(attrs).length && node.attributes.every(value =>
    value.namespaceUri === WORD && attrs[value.localName] === value.value);
const success = (value: TableFormatting): DocxResult<TableFormatting> => ({ ok: true, value });

/** Translate only a fully qualified canonical table; never infer targets from a rendered selection. */
export function qualifyTableFormatting(action: FormattingAction, table: OoxmlElement, rows: readonly OoxmlElement[],
  cells: readonly OoxmlElement[], grid: readonly OoxmlElement[], selectedCell: OoxmlElement): DocxResult<TableFormatting> {
  const properties = child(selectedCell, 'tcPr');
  switch (action.type) {
    case 'table-header-row': {
      const unchanged = rows.every((row, index) => {
        const header = child(child(row, 'trPr'), 'tblHeader');
        return action.enabled && index === 0 ? attribute(header, 'val') === '1' : !header;
      });
      return success({ plan: { ok: true, ops: [{ op: 'setTableProperties', tableId: table.id, headerRowCount: action.enabled ? 1 : 0 }],
        selection: { kind: 'preserveSelection' } }, unchanged });
    }
    case 'table-width': {
      const total = Math.round(action.widthPoints * 20), count = grid.length;
      // The public store contract requires authored grid columns of at least 300 twips each.
      if (!count || total < count * 300) return { ok: false, code: 'unsupported' };
      const base = Math.floor(total / count), extra = total % count;
      const widths = Array.from({ length: count }, (_, index) => base + (index < extra ? 1 : 0));
      const tableProperties = child(table, 'tblPr');
      const unchanged = exact(child(tableProperties, 'tblW'), { type: 'dxa', w: String(total) }) &&
        exact(child(tableProperties, 'tblLayout'), { type: 'fixed' }) &&
        grid.every((column, index) => attribute(column, 'w') === String(widths[index])) &&
        cells.every((cell, index) => exact(child(child(cell, 'tcPr'), 'tcW'), { type: 'dxa', w: String(widths[index % count]) }));
      return success({ plan: { ok: true, ops: [{ op: 'setTableProperties', tableId: table.id, columnWidthsTwips: widths }],
        selection: { kind: 'preserveSelection' } }, unchanged });
    }
    case 'table-cell-alignment':
      return success({ command: { type: 'setTableCellVerticalAlignment', alignment: action.value },
        unchanged: attribute(child(properties, 'vAlign'), 'val') === action.value });
    case 'table-cell-shading': {
      const shading = child(properties, 'shd');
      const themed = hasAttribute(shading, ['themeFill', 'themeFillTint', 'themeFillShade']);
      const unchanged = action.color === null ? !themed && !hasAttribute(shading, ['fill']) :
        !themed && attribute(shading, 'val') !== 'nil' && attribute(shading, 'fill')?.toUpperCase() === action.color.slice(1);
      return success({ command: { type: 'setCellFill', color: action.color === null ? null : { kind: 'hex', value: action.color.slice(1) } }, unchanged });
    }
    case 'table-cell-borders': {
      const edges = action.target === 'inside' ? [] : action.target === 'all' || action.target === 'outside' ?
        ['top', 'left', 'bottom', 'right'] : [action.target];
      const borders = child(properties, 'tcBorders');
      const attrs: Record<string, string> = action.style === 'none' ? { val: 'none' } : {
        val: action.style, sz: String(action.widthPoints * 8), color: action.color === 'auto' ? 'auto' : action.color.slice(1),
      };
      const unchanged = edges.every(edge => exact(child(borders, edge), attrs));
      const command: EditorCommand = action.style === 'none' ? { type: 'setTableBorders', scope: 'none', target: action.target } :
        { type: 'setTableBorders', scope: action.target, spec: { style: action.style, size: action.widthPoints * 8,
          color: action.color === 'auto' ? { kind: 'auto' } : { kind: 'hex', value: action.color.slice(1) } } };
      return success({ command, unchanged });
    }
  }
}
