import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { LyraResourceLimitError } from '../../internal/resource-loader.js';
import type { LyraCsvViewer } from './csv-viewer/csv-viewer.js';
import type { LyraSpreadsheetViewer } from './spreadsheet-viewer/spreadsheet-viewer.js';
import type { LyraDatasetViewer } from './dataset-viewer/dataset-viewer.js';
import './csv-viewer/csv-viewer.js';
import './spreadsheet-viewer/spreadsheet-viewer.js';
import './dataset-viewer/dataset-viewer.js';

for (const kind of ['csv', 'spreadsheet'] as const) {
  for (const [property, low, restored] of [['maxRows', 2, 3], ['maxColumns', 1, 2], ['maxBytes', 1, 64]] as const) {
    it(`revalidates existing ${kind} data after ${property} changes and recovers without reassignment`, async () => {
      const rows = [['Name', 'Count'], ['Ada', '2'], ['Grace', '3']];
      const strings = { documentPreviewResourceTooLarge: 'Input is too large' };
      const viewer = kind === 'csv'
        ? await fixture<LyraCsvViewer>(html`<lr-csv-viewer .rows=${rows} .strings=${strings}></lr-csv-viewer>`)
        : await fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer .workbook=${{ sheets: [{ name: 'Data', rows }] }}
          .strings=${strings}></lr-spreadsheet-viewer>`);
      await waitUntil(() => viewer.shadowRoot!.querySelector('[part="header-row"]') !== null, 'initial parsed data');
      const failed = oneEvent(viewer, 'lr-render-error');
      viewer[property] = low;
      const event = await failed as CustomEvent<{ error: unknown }>;
      expect(event.detail.error instanceof LyraResourceLimitError).to.equal(true);
      await waitUntil(() => viewer.shadowRoot!.querySelector('[part="error"]') !== null, 'updated admission limit');
      expect(viewer.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal('Input is too large');
      expect(viewer.shadowRoot!.querySelectorAll('[part="header-row"]').length).to.equal(0);
      expect(await viewer.search('Ada')).to.equal(0);
      viewer[property] = restored;
      await waitUntil(() => viewer.shadowRoot!.querySelector('[part="header-row"]') !== null, 'restored admission limit');
      expect(viewer.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
      expect(await viewer.search('Ada')).to.equal(1);
      expect(await viewer.search('Grace')).to.equal(1);
    });
  }
}

for (const kind of ['csv', 'spreadsheet', 'dataset'] as const) {
  it(`clears the displayed ${kind} document when its parsed input is unset and accepts a later replacement`, async () => {
    const rows = [['Name'], ['Ada']];
    const strings = { documentPreviewEmpty: 'No supplied input' };
    const viewer = kind === 'csv'
      ? await fixture<LyraCsvViewer>(html`<lr-csv-viewer .rows=${rows} .strings=${strings}></lr-csv-viewer>`)
      : kind === 'spreadsheet'
        ? await fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer .workbook=${{ sheets: [{ name: 'Data', rows }] }}
          .strings=${strings}></lr-spreadsheet-viewer>`)
        : await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer .table=${{ fields: ['Name'], rows: [{ Name: 'Ada' }] }}
          .strings=${strings}></lr-dataset-viewer>`);
    const property = kind === 'csv' ? 'rows' : kind === 'spreadsheet' ? 'workbook' : 'table';
    const initial = Reflect.get(viewer, property);
    await waitUntil(() => viewer.shadowRoot!.querySelector('[role="table"]') !== null, 'initial document');
    let errors = 0;
    viewer.addEventListener('lr-render-error', () => { errors++; });
    Reflect.set(viewer, property, undefined);
    await waitUntil(() => viewer.shadowRoot!.querySelector('.empty-note')?.textContent === 'No supplied input', 'cleared parsed document');
    expect(Reflect.get(viewer, property)).to.equal(undefined);
    expect(viewer.shadowRoot!.querySelectorAll('[role="table"]').length).to.equal(0);
    expect(await viewer.search('Ada')).to.equal(0);
    Reflect.set(viewer, property, initial);
    await waitUntil(() => viewer.shadowRoot!.querySelector('[role="table"]') !== null, 'replacement document');
    expect(await viewer.search('Ada')).to.equal(1);
    expect(errors).to.equal(0);
  });
}
