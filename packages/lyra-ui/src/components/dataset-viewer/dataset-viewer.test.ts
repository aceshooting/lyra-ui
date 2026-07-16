import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import './dataset-viewer.js';
import type { LyraDatasetViewer } from './dataset-viewer.js';
import { findDocumentRenderer } from '../document-viewer/registry.js';

const TAB_DATA = 'name\tage\tcity\nAda\t30\tLondon\nGrace\t85\tArlington';
function response(body: string): Response { return { ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(body) } as Response; }

describe('lyra-dataset-viewer', () => {
  it('renders an empty localized state by default', async () => {
    const el = (await fixture(html`<lyra-dataset-viewer></lyra-dataset-viewer>`)) as LyraDatasetViewer;
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No dataset to display.');
  });
  it('auto-detects tab-separated data and renders an accessible table', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response(TAB_DATA))) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lyra-dataset-viewer src="https://example.test/a.tsv" name="Data"></lyra-dataset-viewer>`)) as LyraDatasetViewer;
      await aTimeout(20);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
      await el.updateComplete;
      expect(Array.from(el.shadowRoot!.querySelectorAll('thead th')).map((th) => th.textContent)).to.deep.equal(['name', 'age', 'city']);
      expect(el.shadowRoot!.querySelectorAll('tbody tr')).to.have.length(2);
      expect(el.shadowRoot!.querySelector('caption')!.textContent).to.equal('Data: 2 rows');
    } finally { window.fetch = original; }
  });
  it('falls back to the count-only caption when name is unset', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response(TAB_DATA))) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lyra-dataset-viewer src="https://example.test/a.tsv"></lyra-dataset-viewer>`)) as LyraDatasetViewer;
      await aTimeout(20);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
      expect(el.shadowRoot!.querySelector('caption')!.textContent).to.equal('2 rows');
    } finally { window.fetch = original; }
  });
  it('surfaces its own localized diagnostic rather than the generic failure', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('name\tage\tcity'))) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lyra-dataset-viewer src="https://example.test/empty.tsv"></lyra-dataset-viewer>`)) as LyraDatasetViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[role="alert"]') !== null);
      expect(el.shadowRoot!.querySelector('[role="alert"]')!.textContent).to.equal('This dataset has no rows.');
    } finally { window.fetch = original; }
  });
  it('enforces a row cap well below the shared 10,000-row default, since it renders unvirtualized', async () => {
    // This component renders every row into a real <table> in one synchronous pass rather than
    // through <lyra-virtual-list> like csv-viewer/spreadsheet-viewer, so it enforces a much lower
    // cap than the shared default -- 1,000 rows here should already be rejected.
    const original = window.fetch;
    const header = 'a\tb\n';
    const body = Array.from({ length: 1_001 }, () => '1\t2').join('\n');
    window.fetch = (() => Promise.resolve(response(header + body))) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lyra-dataset-viewer src="https://example.test/big.tsv"></lyra-dataset-viewer>`)) as LyraDatasetViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[role="alert"]') !== null);
      expect(el.shadowRoot!.querySelector('[role="alert"]')).to.exist;
      expect(el.shadowRoot!.querySelector('[part="table"]')).to.not.exist;
    } finally { window.fetch = original; }
  });
  it('rejects unsafe URLs', async () => {
    const el = (await fixture(html`<lyra-dataset-viewer src="javascript:alert(1)"></lyra-dataset-viewer>`)) as LyraDatasetViewer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[role="alert"]')!.textContent).to.equal('Document URL is not allowed.');
  });
  it('registers tsv/psv/dat but not csv or unrelated files', () => {
    expect(findDocumentRenderer({ name: 'a.tsv', mimeType: 'application/octet-stream', src: 'x' })).to.exist;
    expect(findDocumentRenderer({ name: 'a.csv', mimeType: 'text/csv', src: 'x' })).to.not.exist;
  });
  it('is accessible', async () => { const el = await fixture(html`<lyra-dataset-viewer></lyra-dataset-viewer>`); await expect(el).to.be.accessible(); });
});
