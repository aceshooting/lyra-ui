import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { loadPapaParseCached } from '../../../internal/papaparse-loader.js';
import type { LyraCsvViewer } from './csv-viewer.class.js';
import './csv-viewer.js';

for (const transition of ['replace', 'clear', 'detach'] as const) {
  it(`discards obsolete parse diagnostics after ${transition} in a search-result callback`, async () => {
    await loadPapaParseCached();
    const viewer = await fixture<LyraCsvViewer>(html`<lr-csv-viewer></lr-csv-viewer>`);
    const parent = viewer.parentNode!;
    const originalFetch = window.fetch;
    const requested: string[] = [];
    let releaseResponse: (() => void) | undefined;
    window.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith('/search-obsolete.csv') || url.endsWith('/search-current.csv')) {
        requested.push(url);
        if (url.endsWith('/search-obsolete.csv')) {
          return new Promise<Response>(resolve => { releaseResponse = () => resolve(new Response('Header\n"Needle')); });
        }
        return new Response('Current\nReplacement');
      }
      return originalFetch.call(window, input, init);
    };
    let transitioned = false;
    let diagnostics = 0, errors = 0;
    viewer.addEventListener('lr-viewer-diagnostic', () => diagnostics++);
    viewer.addEventListener('lr-render-error', () => errors++);
    viewer.addEventListener('lr-search-change', event => {
      if (transitioned || event.detail.query !== 'Needle' || event.detail.matchCount !== 1) return;
      transitioned = true;
      if (transition === 'detach') viewer.remove();
      else viewer.src = transition === 'replace' ? '/search-current.csv' : '';
    });
    try {
      viewer.src = '/search-obsolete.csv';
      await waitUntil(() => releaseResponse !== undefined, 'the pending response leaves time to enter a search');
      expect(await viewer.search('Needle')).to.equal(0);
      releaseResponse!();
      await waitUntil(() => transitioned, 'the loaded CSV reapplies the retained search');
      await viewer.updateComplete;
      if (transition === 'clear') {
        await waitUntil(() => viewer.shadowRoot!.querySelector('[role="table"]') === null);
        viewer.src = '/search-current.csv';
      } else if (transition === 'detach') {
        expect(viewer.isConnected).to.equal(false);
        viewer.src = '/search-current.csv';
        parent.appendChild(viewer);
      }
      await waitUntil(() => viewer.shadowRoot!.querySelector('[role="columnheader"]')?.textContent?.trim() === 'Current');
      expect(await viewer.search('Replacement')).to.equal(1);
      expect(await viewer.search('Needle')).to.equal(0);
      expect(requested.filter(url => url.endsWith('/search-current.csv')).length).to.equal(1);
      expect(diagnostics).to.equal(0);
      expect(errors).to.equal(0);
    } finally {
      viewer.remove();
      window.fetch = originalFetch;
    }
  });
}
