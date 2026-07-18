import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './csv-viewer.js';
import type { LyraCsvViewer } from './csv-viewer.js';

const CSV = 'Name,Role\nAda Lovelace,Mathematician\nGrace Hopper,Computer scientist';
const GRID_CSV = 'Name,Role\nAda,Mathematician\nGrace,Scientist\nAda,Programmer';
function fetchText(value: string): () => void { const original = window.fetch; window.fetch = (() => Promise.resolve({ ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(value) } as Response)) as typeof window.fetch; return () => { window.fetch = original; }; }
/** Shrinks `DocumentAnchorTarget`'s retry loop so a permanently-unresolvable `scrollToAnchor()` call
 *  resolves in milliseconds instead of waiting out the real 5s default timeout. */
function shrinkAnchorRetry(el: LyraCsvViewer): void {
  (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
  (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
}

describe('lr-csv-viewer', () => {
  it('renders an empty localized state by default', async () => { const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer; expect(el.hasHeaderRow).to.be.true; expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No document to display.'); });
  it('parses quoted CSV and virtualizes body rows', async () => {
    const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
    const restore = fetchText('Name,Notes\nAda,"Wrote notes on the ""Engine"", 1843"');
    try { el.src = 'https://example.test/people.csv'; await waitUntil(() => el.shadowRoot!.querySelector('[part="header-row"]') !== null); expect((el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { items: unknown[][] }).items[0]).to.deep.equal(['Ada', 'Wrote notes on the "Engine", 1843']); } finally { restore(); }
  });
  it('loads a src that changed while detached once it is reconnected', async () => {
    const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
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
    const el = (await fixture(html`<lr-csv-viewer .hasHeaderRow=${false}></lr-csv-viewer>`)) as LyraCsvViewer;
    const restore = fetchText(CSV);
    try { el.src = 'https://example.test/people.csv'; await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null); expect(el.shadowRoot!.querySelector('[part="header-row"]')).to.not.exist; expect((el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { items: unknown[][] }).items).to.have.lengthOf(3); } finally { restore(); }
  });
  it('is accessible', async () => { const el = await fixture(html`<lr-csv-viewer></lr-csv-viewer>`); await expect(el).to.be.accessible(); });
  it('uses name as the accessible name, falling back to a localized default', async () => {
    const named = (await fixture(html`<lr-csv-viewer name="quarterly.csv"></lr-csv-viewer>`)) as LyraCsvViewer;
    expect(named.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('quarterly.csv');
    const unnamed = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
    expect(unnamed.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('CSV document');
  });

  describe('cell-range anchor-target', () => {
    it('scrolls to a cell-range anchor addressing the raw grid (header included)', async () => {
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        // Row 2 (raw, 1-based, header at row 1) is the first data row ("Ada,Mathematician").
        const result = await el.scrollToAnchor({ kind: 'cell-range', range: 'A2' });
        expect(result).to.be.true;
      } finally {
        restore();
      }
    });

    it('resolves false for an anchor with a sheet set (csv has no sheets)', async () => {
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      shrinkAnchorRetry(el);
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        expect(await el.scrollToAnchor({ kind: 'cell-range', sheet: 'Sheet1', range: 'A2' })).to.be.false;
      } finally {
        restore();
      }
    });

    it('renders a focusable cell-highlight and emits lr-highlight-activate', async () => {
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        el.highlights = [{ id: 'h1', anchor: { kind: 'cell-range', range: 'A2' }, label: 'First result' }];
        await el.updateComplete;
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        const highlighted = list.shadowRoot!.querySelector('[part~="cell-highlight"]') as HTMLElement;
        expect(highlighted).to.exist;
        expect(highlighted.getAttribute('tabindex')).to.equal('0');
        expect(highlighted.getAttribute('role')).to.equal('button');
        expect(highlighted.getAttribute('aria-label')).to.equal('First result');
        const listener = oneEvent(el, 'lr-highlight-activate');
        highlighted.click();
        const event = (await listener) as CustomEvent<{ id: string }>;
        expect(event.detail).to.deep.equal({ id: 'h1' });
      } finally {
        restore();
      }
    });

    it('activates a highlighted cell via Enter/Space and never a plain cell', async () => {
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        el.highlights = [{ id: 'h1', anchor: { kind: 'cell-range', range: 'A2' } }];
        await el.updateComplete;
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        const plain = list.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
        expect(plain.hasAttribute('tabindex')).to.be.false;
        const highlighted = list.shadowRoot!.querySelector('[part~="cell-highlight"]') as HTMLElement;
        const listener = oneEvent(el, 'lr-highlight-activate');
        highlighted.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
        const event = (await listener) as CustomEvent<{ id: string }>;
        expect(event.detail).to.deep.equal({ id: 'h1' });
      } finally {
        restore();
      }
    });
  });

  describe('search', () => {
    it('finds matches ordered row -> column', async () => {
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        const count = await el.search('ada');
        expect(count).to.equal(2); // "Ada" appears in two data rows, column 0
        let detail: { matchCount: number; activeIndex: number } | undefined;
        el.addEventListener('lr-search-change', (e) => (detail = (e as CustomEvent).detail));
        expect(await el.searchNext()).to.be.true;
        expect(detail!.activeIndex).to.equal(1);
        expect(await el.searchNext()).to.be.true;
        expect(detail!.activeIndex).to.equal(0); // wraps
      } finally {
        restore();
      }
    });

    it('searchPrevious wraps backward', async () => {
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        await el.search('ada');
        expect(await el.searchPrevious()).to.be.true;
        let detail: { activeIndex: number } | undefined;
        el.addEventListener('lr-search-change', (e) => (detail = (e as CustomEvent).detail));
        expect(await el.searchPrevious()).to.be.true;
        expect(detail!.activeIndex).to.equal(0);
      } finally {
        restore();
      }
    });

    it('clearSearch resets matchCount/activeIndex to 0/-1', async () => {
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        await el.search('ada');
        const listener = oneEvent(el, 'lr-search-change');
        el.clearSearch();
        const event = (await listener) as CustomEvent<{ matchCount: number; activeIndex: number }>;
        expect(event.detail).to.deep.equal({ query: '', matchCount: 0, activeIndex: -1 });
      } finally {
        restore();
      }
    });

    it('an empty query behaves like clearSearch and resolves 0', async () => {
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        await el.search('ada');
        expect(await el.search('   ')).to.equal(0);
      } finally {
        restore();
      }
    });
  });

  describe('back-compat', () => {
    it('rendering is unchanged with highlights empty and no search active', async () => {
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        expect(list.shadowRoot!.querySelectorAll('[part~="cell-highlight"]').length).to.equal(0);
      } finally {
        restore();
      }
    });
  });
});
