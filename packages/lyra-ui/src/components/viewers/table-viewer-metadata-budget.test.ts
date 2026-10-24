import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import type { LyraTabularColumn, LyraTabularSource } from '../../data-sources.js';
import type { LyraCsvViewer } from './csv-viewer/csv-viewer.class.js';
import type { LyraSpreadsheetViewer } from './spreadsheet-viewer/spreadsheet-viewer.class.js';
import './csv-viewer/csv-viewer.js';
import './spreadsheet-viewer/spreadsheet-viewer.js';

for (const kind of ['csv', 'workbook'] as const) {
  it(`rejects aggregate ${kind} column metadata before reading cells and recovers on provider replacement`, async () => {
    const strings = { documentPreviewResourceTooLarge: 'Column metadata exceeds limits' };
    const element = await fixture<LyraCsvViewer | LyraSpreadsheetViewer>(kind === 'csv'
      ? html`<lr-csv-viewer style="inline-size:4096px;--lr-size-8rem:128px" .strings=${strings}></lr-csv-viewer>`
      : html`<lr-spreadsheet-viewer style="inline-size:4096px;--lr-size-8rem:128px" .strings=${strings}></lr-spreadsheet-viewer>`);
    expect(element.clientWidth).to.be.at.least(4096);
    const assign = (source: LyraTabularSource) => {
      if (kind === 'csv') (element as LyraCsvViewer).dataSource = source;
      else (element as LyraSpreadsheetViewer).dataSource = { revision: source.revision, sheets: [{ key: 'sheet', name: 'Sheet', data: source }] };
    };
    let errorCount = 0;
    element.addEventListener('lr-render-error', () => { errorCount++; });
    const columns: LyraTabularColumn[] = [];
    const label = 'L'.repeat(65_536);
    let rejectedReads = 0;
    const failed = oneEvent(element, 'lr-render-error');
    assign({ revision: 'oversized-metadata', rowCount: 2, columnCount: 32,
      columnAt: index => {
        const column = { key: `column-${index}`, label };
        columns.push(column);
        return column;
      },
      cellAt: () => { rejectedReads++; return 'Should not be read'; },
    });
    await failed;
    await waitUntil(() => element.shadowRoot!.querySelector('[part="error"]')?.textContent === 'Column metadata exceeds limits');
    expect(columns.length).to.be.greaterThan(30);
    expect(columns.every(column => column.key.length > 0 && column.key.length <= 65_536 && column.label.length <= 65_536)).to.equal(true);
    expect(columns.reduce((units, column) => units + column.key.length + column.label.length, 0)).to.be.greaterThan(2_000_000);
    expect(rejectedReads).to.equal(0);
    expect(errorCount).to.equal(1);
    expect(element.shadowRoot!.querySelectorAll('[role="table"]').length).to.equal(0);

    let recoveredReads = 0;
    assign({ revision: 'recovered', rowCount: 2, columnCount: 2,
      columnAt: index => ({ key: `recovered-${index}`, label: `Column ${index}` }),
      cellAt: (row, column) => { recoveredReads++; return `Recovered ${row}:${column}`; },
    });
    await waitUntil(() => element.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-busy') === 'false' &&
      element.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot
        ?.querySelector('[data-row-index="1"] [aria-colindex="2"]')?.textContent === 'Recovered 1:1', 'replacement provider rows did not render');
    expect(recoveredReads).to.be.greaterThan(0);
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
    expect(element.shadowRoot!.querySelectorAll('[role="columnheader"]').length).to.equal(2);
    expect(errorCount).to.equal(1);
  });
}
