import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import type { LyraDatasetViewer } from './dataset-viewer.js';
import './dataset-viewer.js';

describe('dataset public table admission', () => {
  for (const [description, table] of [
    ['duplicate fields', { fields: ['Name', 'Name'], rows: [{ Name: 'Private value' }] }],
    ['non-string fields', { fields: [7], rows: [] }],
    ['non-array rows', { fields: ['Name'], rows: 'Private value' }],
  ] as const) {
    it(`rejects ${description} without exposing supplied values and accepts a replacement`, async () => {
      const viewer = await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer
        .strings=${{ documentPreviewFailedToLoad: 'Cannot display input' }}></lr-dataset-viewer>`);
      const failed = oneEvent(viewer, 'lr-render-error');
      Reflect.set(viewer, 'table', table);
      const event = await failed as CustomEvent<{ error: unknown }>;
      expect(event.detail.error instanceof TypeError).to.equal(true);
      await waitUntil(() => viewer.shadowRoot!.querySelector('[part="error"]') !== null, 'table admission error');
      expect(viewer.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal('Cannot display input');
      expect(viewer.shadowRoot!.querySelectorAll('[part="table"]').length).to.equal(0);
      viewer.table = { fields: ['Name'], rows: [{ Name: 'Ada' }] };
      await waitUntil(() => viewer.shadowRoot!.querySelector('[part="table"]') !== null, 'valid replacement table');
      expect(viewer.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
      expect(await viewer.search('Ada')).to.equal(1);
    });
  }

  it('normalizes missing and null cells while retaining scalar values in frozen table snapshots', async () => {
    const viewer = await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer></lr-dataset-viewer>`);
    Reflect.set(viewer, 'table', { fields: ['Missing', 'Null', 'Zero', 'False'], rows: [{ Null: null, Zero: 0, False: false }] });
    await waitUntil(() => viewer.shadowRoot!.querySelector('[part="table"]') !== null, 'normalized scalar table');
    expect(viewer.table?.rows).to.deep.equal([{ Missing: '', Null: '', Zero: '0', False: 'false' }]);
    expect(Object.isFrozen(viewer.table)).to.equal(true);
    expect(Object.isFrozen(viewer.table?.rows[0])).to.equal(true);
    expect(await viewer.search('false')).to.equal(2);
    expect(await viewer.search('0')).to.equal(1);
  });

  for (const table of [{ fields: [], rows: [] }, { fields: ['Name'], rows: [] }]) {
    it(`accepts an empty table with ${table.fields.length} fields without reporting an error`, async () => {
      const viewer = await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer
        .strings=${{ datasetViewerEmpty: 'No records' }}></lr-dataset-viewer>`);
      let errors = 0;
      viewer.addEventListener('lr-render-error', () => { errors++; });
      viewer.table = table;
      await waitUntil(() => viewer.shadowRoot!.querySelector('.empty-note')?.textContent === 'No records', 'valid empty table');
      expect(errors).to.equal(0);
      expect(await viewer.search('Name')).to.equal(0);
      expect(viewer.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
    });
  }
});
