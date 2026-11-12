import { expect, fixture, waitUntil } from '@open-wc/testing';
import { setReducedMotion } from '../../../test/wtr-media.js';
import { shrinkAnchorRetry } from '../../../test/viewer-scroll-test-support.js';
import { LyraCsvViewer } from './csv-viewer/csv-viewer.js';
import { LyraDatasetViewer } from './dataset-viewer/dataset-viewer.js';
import { LyraSpreadsheetViewer } from './spreadsheet-viewer/spreadsheet-viewer.js';

type Viewer = LyraCsvViewer | LyraDatasetViewer | LyraSpreadsheetViewer;
const viewers = {
  csv: () => document.createElement('lr-csv-viewer'),
  dataset: () => document.createElement('lr-dataset-viewer'),
  spreadsheet: () => document.createElement('lr-spreadsheet-viewer'),
};

beforeEach(async () => { await setReducedMotion('reduce'); });
afterEach(async () => { await setReducedMotion('no-preference'); });

function replaceRows(viewer: Viewer, names: string[]): void {
  if (viewer instanceof LyraDatasetViewer) viewer.table = { fields: ['Name'], rows: names.map(Name => ({ Name })) };
  else if (viewer instanceof LyraCsvViewer) viewer.rows = [['Name'], ...names.map(name => [name])];
  else viewer.workbook = { sheets: [{ name: 'Records', rows: [['Name'], ...names.map(name => [name])] }] };
}

for (const [kind, create] of Object.entries(viewers)) {
  for (const count of [10000, 10001]) {
    it(`navigates ${count} admitted ${kind} rows and resets navigation after replacing them with a short table`, async () => {
      const viewer = create();
      viewer.style.cssText = 'display:block;width:320px';
      viewer.maxHeight = '12rem';
      viewer.maxRows = count + 1;
      shrinkAnchorRetry(viewer);
      replaceRows(viewer, Array.from({ length: count }, (_, index) => `Record ${index}`));
      let errors = 0;
      viewer.addEventListener('lr-render-error', () => { errors++; });
      await fixture(viewer);
      const bodyText = () => viewer.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.textContent ?? '';
      await waitUntil(() => bodyText().includes('Record 0'));
      const list = viewer.shadowRoot!.querySelector('lr-virtual-list')!;
      expect(list.source !== undefined).to.equal(count > 10000);
      expect(viewer.shadowRoot!.querySelector('[role="table"]')?.getAttribute('aria-rowcount')).to.equal(String(count + 1));
      expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: `A${count + 1}` })).to.equal(true);
      await waitUntil(() => bodyText().includes(`Record ${count - 1}`), 'the requested last row becomes visible', { timeout: 3000 });
      expect(list.shadowRoot!.querySelectorAll('[role="row"]').length).to.be.within(1, 99);
      expect(errors).to.equal(0);
      replaceRows(viewer, ['Replacement first', 'Replacement last']);
      await waitUntil(() => bodyText().includes('Replacement first'));
      expect(viewer.shadowRoot!.querySelector('lr-virtual-list')!.source).to.equal(undefined);
      expect(viewer.shadowRoot!.querySelector('[role="table"]')?.getAttribute('aria-rowcount')).to.equal('3');
      expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: 'A3' })).to.equal(true);
      expect(bodyText()).to.include('Replacement last');
      expect(await viewer.scrollToAnchor({ kind: 'cell-range', range: `A${count + 1}` })).to.equal(false);
      expect(errors).to.equal(0);
    });
  }
}
