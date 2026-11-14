import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './notebook-viewer.js';
import type { LyraNotebookViewer } from './notebook-viewer.js';

/** Cells render inside lr-virtual-list's shadow root. */
function rowRoot(el: LyraNotebookViewer): ShadowRoot {
  return el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!;
}

const INVALID = 'This file is not a valid Jupyter notebook.';

describe('lr-notebook-viewer field fallbacks', () => {
  it('renders an error output that carries no name, value, or traceback as a bare separator', async () => {
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [{ cell_type: 'code', id: 'c1', source: 'x', outputs: [{ output_type: 'error' }] }],
    };
    const el = await fixture<LyraNotebookViewer>(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`);
    await waitUntil(() => rowRoot(el).querySelector('[data-output-type="error"]') !== null);
    const output = rowRoot(el).querySelector('[data-output-type="error"]')!;
    const label = output.querySelector('[part="error-output-label"]')!;
    expect(label.textContent).to.equal('Error');
    expect(output.textContent!.slice(label.textContent!.length).trim()).to.equal(':');
  });

  it('labels code cells with the kernelspec language when language_info is absent, and none without metadata', async () => {
    const cells = [{ cell_type: 'code', id: 'c1', source: 'println(1)', outputs: [] }];
    const julia = await fixture<LyraNotebookViewer>(html`<lr-notebook-viewer
      .notebook=${{ nbformat: 4, nbformat_minor: 5, metadata: { kernelspec: { language: 'julia' } }, cells }}
    ></lr-notebook-viewer>`);
    await waitUntil(() => rowRoot(julia).querySelector('lr-code-block') !== null);
    expect(rowRoot(julia).querySelector('lr-code-block')!.getAttribute('language')).to.equal('julia');

    const bare = await fixture<LyraNotebookViewer>(html`<lr-notebook-viewer
      .notebook=${{ nbformat: 4, nbformat_minor: 5, cells }}
    ></lr-notebook-viewer>`);
    await waitUntil(() => rowRoot(bare).querySelector('lr-code-block') !== null);
    expect(rowRoot(bare).querySelector('lr-code-block')!.getAttribute('language')).to.equal('');
  });

  it('rejects serialized JSON payloads that parse to values outside the JSON output contract', async () => {
    const payloads: Array<[string, string]> = [
      ['overflowing number literal', '1e999'],
      ['oversized serialized array', JSON.stringify(new Array(100_001).fill(0))],
    ];
    for (const [description, payload] of payloads) {
      const el = await fixture<LyraNotebookViewer>(html`<lr-notebook-viewer></lr-notebook-viewer>`);
      const errorPromise = oneEvent(el, 'lr-render-error');
      el.notebook = {
        nbformat: 4, nbformat_minor: 5,
        cells: [{ cell_type: 'code', source: '', outputs: [{ output_type: 'display_data', data: { 'application/json': payload } }] }],
      } as never;
      await errorPromise;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="error"]')?.textContent, description).to.equal(INVALID);
    }
  });
});
