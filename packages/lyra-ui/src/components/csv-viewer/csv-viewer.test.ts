import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import './csv-viewer.js';
import type { LyraCsvViewer } from './csv-viewer.js';

const CSV = 'Name,Role\nAda Lovelace,Mathematician\nGrace Hopper,Computer scientist';
function fetchText(value: string): () => void { const original = window.fetch; window.fetch = (() => Promise.resolve({ ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(value) } as Response)) as typeof window.fetch; return () => { window.fetch = original; }; }

describe('lyra-csv-viewer', () => {
  it('renders an empty localized state by default', async () => { const el = (await fixture(html`<lyra-csv-viewer></lyra-csv-viewer>`)) as LyraCsvViewer; expect(el.hasHeaderRow).to.be.true; expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No document to display.'); });
  it('parses quoted CSV and virtualizes body rows', async () => {
    const el = (await fixture(html`<lyra-csv-viewer></lyra-csv-viewer>`)) as LyraCsvViewer;
    const restore = fetchText('Name,Notes\nAda,"Wrote notes on the ""Engine"", 1843"');
    try { el.src = 'https://example.test/people.csv'; await waitUntil(() => el.shadowRoot!.querySelector('[part="header-row"]') !== null); expect((el.shadowRoot!.querySelector('lyra-virtual-list') as HTMLElement & { items: unknown[][] }).items[0]).to.deep.equal(['Ada', 'Wrote notes on the "Engine", 1843']); } finally { restore(); }
  });
  it('loads a src that changed while detached once it is reconnected', async () => {
    const el = (await fixture(html`<lyra-csv-viewer></lyra-csv-viewer>`)) as LyraCsvViewer;
    const parent = el.parentElement!;
    const restore = fetchText(CSV);
    try {
      el.remove();
      await aTimeout(0);
      el.src = 'https://example.test/detached.csv';
      await aTimeout(0);
      parent.append(el);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="header-row"]') !== null, 'src set while detached was never loaded after reconnect');
    } finally { restore(); }
  });
  it('can treat every row as data through a false property binding', async () => {
    const el = (await fixture(html`<lyra-csv-viewer .hasHeaderRow=${false}></lyra-csv-viewer>`)) as LyraCsvViewer;
    const restore = fetchText(CSV);
    try { el.src = 'https://example.test/people.csv'; await waitUntil(() => el.shadowRoot!.querySelector('lyra-virtual-list') !== null); expect(el.shadowRoot!.querySelector('[part="header-row"]')).to.not.exist; expect((el.shadowRoot!.querySelector('lyra-virtual-list') as HTMLElement & { items: unknown[][] }).items).to.have.lengthOf(3); } finally { restore(); }
  });
  it('is accessible', async () => { const el = await fixture(html`<lyra-csv-viewer></lyra-csv-viewer>`); await expect(el).to.be.accessible(); });
  it('uses name as the accessible name, falling back to a localized default', async () => {
    const named = (await fixture(html`<lyra-csv-viewer name="quarterly.csv"></lyra-csv-viewer>`)) as LyraCsvViewer;
    expect(named.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('quarterly.csv');
    const unnamed = (await fixture(html`<lyra-csv-viewer></lyra-csv-viewer>`)) as LyraCsvViewer;
    expect(unnamed.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('CSV document');
  });
});
