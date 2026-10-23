import { readOoxmlPart } from '@engine/store/package/ooxml-tree.ts';
import { applyMergeTableCells } from '@engine/store/store/tree-op-table-merge.ts';
import { applySplitTableCell } from '@engine/store/store/tree-op-table-split.ts';
import { applyMergedColumnOp } from '@engine/store/store/tree-op-table-merged-columns.ts';
import { readEditableTableTopology } from '@engine/store/store/tree-op-table-topology.ts';
import { wmlAttributeValue, wmlChildNamed } from '@engine/store/store/tree-op-table-shared.ts';
import { FeatureNotPreparedError, featureIsPrepared } from '@engine/features/prepared-runtime.ts';
import { prepareCommandFeatures } from '@engine/features/command-preparation.ts';
function check(value, message) {
    if (!value)
        throw new Error(message);
}
function descendants(node) {
    return [node, ...('children' in node ? node.children.flatMap(descendants) : [])];
}
function fixture(merged = false) {
    const cell = (text, span = '') => `<w:tc><w:tcPr>${span}<w:tcW w:w="${span ? 2880 : 1440}" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
    const rows = merged
        ? `<w:tr>${cell('A', '<w:gridSpan w:val="2"/>')}</w:tr>`
        : `<w:tr>${cell('A')}${cell('B')}</w:tr><w:tr>${cell('C')}${cell('D')}</w:tr>`;
    const read = readOoxmlPart(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tblPr><w:tblW w:w="2880" w:type="dxa"/></w:tblPr><w:tblGrid><w:gridCol w:w="1440"/><w:gridCol w:w="1440"/></w:tblGrid>${rows}</w:tbl><w:p/></w:body></w:document>`, {
        name: '/word/document.xml',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
    });
    check(read.ok, 'Table fixture must parse');
    return read.part;
}
function topology(part) {
    const table = descendants(part.root).find(node => node.kind === 'table');
    check(table, 'Expected table');
    const read = readEditableTableTopology(part.root, table.id);
    check(read.ok, 'Result table topology must be valid');
    return read.topology;
}
function resultPart(result, name) {
    check(result.ok, `${name} rejected: ${result.ok ? '' : result.reason}`);
    return result.part;
}
function text(part) {
    return descendants(part.root).filter(node => node.kind === 'textValue').map(node => node.value).join('');
}
function unprepared(run, name) {
    let failure;
    try {
        run();
    }
    catch (error) {
        failure = error;
    }
    check(failure instanceof FeatureNotPreparedError, `${name} must require preparation`);
    check(failure.module === 'store/store/tree-op-tables.ts', `${name} must reach the extracted table helpers`);
}
/** Run in a fresh module realm, before any editor or table feature is prepared. */
export async function tablePreparationRegression() {
    check(!featureIsPrepared('tables'), 'Negative readiness checks require a fresh module realm');
    const regular = fixture();
    const original = topology(regular);
    const merge = { op: 'mergeTableCells', tableId: original.table.id, cellIds: original.rows.flatMap(row => row.cells.map(cell => cell.id)) };
    const wide = fixture(true);
    const wideTable = topology(wide);
    const split = { op: 'splitTableCell', tableId: wideTable.table.id, cellId: wideTable.rows[0].cells[0].id, rows: 2, columns: 2 };
    const insert = { op: 'insertTableColumn', tableId: wideTable.table.id, gridColumnId: wideTable.gridColumns[0].id, where: 'right' };
    unprepared(() => applyMergeTableCells(regular, merge), 'merge');
    unprepared(() => applySplitTableCell(wide, split), 'split');
    unprepared(() => applyMergedColumnOp(wide, insert), 'merged column insert');
    check(topology(regular).rows.every(row => row.cells.length === 2), 'Refused merge must not mutate input');
    check(topology(wide).gridColumns.length === 2, 'Refused column insertion must not mutate input');
    await prepareCommandFeatures({ type: 'mergeCells' });
    check(featureIsPrepared('tables'), 'mergeCells command must prepare tables');
    const merged = resultPart(applyMergeTableCells(regular, merge), 'merge');
    const mergedTable = topology(merged);
    check(mergedTable.rows.length === 2 && mergedTable.rows.every(row => row.cells.length === 1), 'Merge must leave one spanning cell per row');
    check(text(merged) === 'ABCD', 'Merge must preserve cell text in reading order');
    const splitPart = resultPart(applySplitTableCell(wide, split), 'split');
    check(topology(splitPart).rows.length === 2 && topology(splitPart).rows.every(row => row.cells.length === 2), 'Split must produce a two-by-two grid');
    check(text(splitPart) === 'A', 'Split must preserve content');
    const inserted = resultPart(applyMergedColumnOp(wide, insert), 'merged column insert');
    const insertedTable = topology(inserted);
    check(insertedTable.gridColumns.length === 3, 'Merged column insertion must extend the grid');
    const props = wmlChildNamed(insertedTable.rows[0].cells[0], 'tcPr');
    const span = props && wmlChildNamed(props, 'gridSpan');
    check(span && wmlAttributeValue(span, 'val') === '3', 'Insertion inside a spanning cell must extend its span');
    check(text(inserted) === 'A', 'Merged column insertion must preserve content');
    return ['unprepared merge/split/column refuse without mutation', 'mergeCells prepares real table helpers', 'merge preserves topology and text', 'split preserves content', 'merged column insertion extends span'];
}
