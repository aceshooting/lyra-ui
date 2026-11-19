import '../spreadsheet-viewer/spreadsheet-viewer.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../dataset-viewer/dataset-viewer.js';
import './csv-viewer.js';
import type { LyraCsvViewer } from './csv-viewer.js';
import type { LyraDatasetViewer } from '../dataset-viewer/dataset-viewer.js';

/** First request rejects when its signal aborts; later requests resolve with `body`. */
function abortAwareFetch(body: string): { restore: () => void; calls: () => number } {
  const original = window.fetch;
  let calls = 0;
  window.fetch = ((_url: unknown, init?: RequestInit) => {
    calls++;
    if (calls === 1) {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    }
    return Promise.resolve({ ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(body) } as Response);
  }) as typeof window.fetch;
  return { restore: () => { window.fetch = original; }, calls: () => calls };
}

describe('table viewers moved while loading', () => {
  it('lr-csv-viewer resumes its load after a same-task move', async () => {
    const stub = abortAwareFetch('Name,Role\nAda,One');
    try {
      const el = await fixture<LyraCsvViewer>(html`<lr-csv-viewer src="https://example.test/a.csv"></lr-csv-viewer>`);
      await waitUntil(() => stub.calls() === 1);
      const parent = el.parentElement!;
      el.remove();
      parent.append(el);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="header-row"]') !== null, 'load never resumed');
      expect(stub.calls()).to.equal(2);
    } finally {
      stub.restore();
    }
  });

  it('lr-dataset-viewer resumes its load after a same-task move', async () => {
    const stub = abortAwareFetch('name\trole\nAda\tOne');
    try {
      const el = await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer src="https://example.test/a.tsv"></lr-dataset-viewer>`);
      await waitUntil(() => stub.calls() === 1);
      const parent = el.parentElement!;
      el.remove();
      parent.append(el);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null, 'load never resumed');
      expect(stub.calls()).to.equal(2);
    } finally {
      stub.restore();
    }
  });
});

for (const [name, content] of [
  ['CSV', html`<lr-csv-viewer .rows=${[['Name'], ['Ada']]}></lr-csv-viewer>`],
  ['dataset', html`<lr-dataset-viewer .table=${{ fields: ['Name'], rows: [{ Name: 'Ada' }] }}></lr-dataset-viewer>`],
  ['workbook', html`<lr-spreadsheet-viewer .workbook=${{ sheets: [{ name: 'People', rows: [['Name'], ['Ada']] }] }}></lr-spreadsheet-viewer>`],
] as const) {
  it(`shrinks a short ${name} grid to the height of its rows`, async () => {
    const el = await fixture<HTMLElement>(content);
    const list = () => el.shadowRoot!.querySelector('lr-virtual-list');
    await waitUntil(() => !!list()?.shadowRoot?.querySelector('[part="spacer"][data-item-count="1"]'));
    const port = list()!.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const spacer = list()!.shadowRoot!.querySelector<HTMLElement>('[part="spacer"]')!;
    expect(spacer.offsetHeight).to.be.greaterThan(0);
    expect(port.clientHeight).to.be.closeTo(spacer.offsetHeight, 1);
  });
}
