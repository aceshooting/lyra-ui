import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import type { LyraSpreadsheetViewer } from './spreadsheet-viewer.js';
import { LyraResourceLimitError } from '../../../internal/resource-loader.js';
import './spreadsheet-viewer.js';

const validWorkbook = () => ({ sheets: [{ name: 'Data', rows: [['Name', 'Count'], ['Ada', 2], ['Grace', 3]] }] });

describe('spreadsheet public workbook admission', () => {
  for (const [description, workbook, limited] of [
    ['absent sheets', {}, false],
    ['non-array sheets', { sheets: 'private-invalid-sheets' }, false],
    ['non-string sheet name', { sheets: [{ name: 42, rows: [] }] }, false],
    ['257 sheets', { sheets: Array.from({ length: 257 }, (_, i) => ({ name: `Sheet ${i}`, rows: [] })) }, true],
  ] as const) {
    it(`rejects ${description} through the public error contract and recovers with a valid workbook`, async () => {
      const viewer = await fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer
        .strings=${{ documentPreviewFailedToLoad: 'Cannot display input', documentPreviewResourceTooLarge: 'Input is too large' }}
      ></lr-spreadsheet-viewer>`);
      const failed = oneEvent(viewer, 'lr-render-error');
      Reflect.set(viewer, 'workbook', workbook);
      const event = await failed as CustomEvent<{ error: unknown }>;
      await waitUntil(() => viewer.shadowRoot!.querySelector('[part="error"]') !== null, 'workbook admission error');
      expect(event.detail.error instanceof (limited ? LyraResourceLimitError : TypeError)).to.equal(true);
      expect(event.bubbles).to.equal(true);
      expect(event.composed).to.equal(true);
      expect(viewer.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal(limited ? 'Input is too large' : 'Cannot display input');
      expect(viewer.shadowRoot!.querySelectorAll('[part="sheet"]').length).to.equal(0);
      viewer.workbook = validWorkbook();
      await waitUntil(() => viewer.shadowRoot!.querySelector('[part="header-row"]') !== null, 'valid workbook recovery');
      expect(viewer.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
      expect(viewer.shadowRoot!.querySelector('[part="sheet"]')?.getAttribute('aria-rowcount')).to.equal('3');
    });
  }

  it('charges UTF-8 sheet-name bytes even when its character count fits', async () => {
    const viewer = await fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer max-bytes="1"
      .strings=${{ documentPreviewResourceTooLarge: 'Input is too large' }}></lr-spreadsheet-viewer>`);
    const failed = oneEvent(viewer, 'lr-render-error');
    viewer.workbook = { sheets: [{ name: 'é', rows: [] }] };
    const event = await failed as CustomEvent<{ error: unknown }>;
    expect(event.detail.error instanceof LyraResourceLimitError).to.equal(true);
    await waitUntil(() => viewer.shadowRoot!.querySelector('[part="error"]') !== null, 'sheet name byte ceiling');
    expect(viewer.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal('Input is too large');
    viewer.maxBytes = 2;
    viewer.workbook = { sheets: [{ name: 'é', rows: [] }] };
    await waitUntil(() => viewer.shadowRoot!.querySelector('.empty-note') !== null, 'exactly bounded empty sheet');
    expect(viewer.workbook?.sheets[0]?.name).to.equal('é');
    expect(viewer.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  });

  for (const workbook of [{ sheets: [] }, { sheets: [{ name: 'Empty', rows: [] }] }]) {
    it(`renders ${workbook.sheets.length ? 'an empty sheet' : 'an empty workbook'} without a load error`, async () => {
      const viewer = await fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer
        .strings=${{ noData: 'No cells' }}></lr-spreadsheet-viewer>`);
      let errors = 0;
      viewer.addEventListener('lr-render-error', () => { errors++; });
      viewer.workbook = workbook;
      await waitUntil(() => viewer.shadowRoot!.querySelector('.empty-note')?.textContent === 'No cells', 'valid empty workbook state');
      expect(errors).to.equal(0);
      expect(viewer.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
      expect(await viewer.search('anything')).to.equal(0);
      viewer.workbook = validWorkbook();
      await waitUntil(() => viewer.shadowRoot!.querySelector('[part="header-row"]') !== null, 'populated workbook');
      expect(viewer.shadowRoot!.querySelector('[part="sheet"]')?.getAttribute('aria-colcount')).to.equal('2');
      expect(errors).to.equal(0);
    });
  }
});
