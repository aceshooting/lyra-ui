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
  it('renders data rows as a grid, matching the header row, not as unstyled stacked text', async () => {
    // Regression test: renderRow()/renderCell()'s output for data rows is rendered inside
    // <lr-virtual-list>'s own shadow root via its renderItem callback, a different shadow tree
    // than csv-viewer.styles.ts's stylesheet is scoped to -- a plain [part='data-row']/[part='cell']
    // CSS selector there can never reach it, only the header row (rendered directly by csv-viewer).
    const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
    const restore = fetchText(GRID_CSV);
    try {
      el.src = 'https://example.test/people.csv';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      await waitUntil(() => list.shadowRoot!.querySelector('[part="data-row"]') !== null);
      const headerRow = el.shadowRoot!.querySelector('[part="header-row"]') as HTMLElement;
      const dataRow = list.shadowRoot!.querySelector('[part="data-row"]') as HTMLElement;
      expect(getComputedStyle(dataRow).display).to.equal('grid');
      expect(getComputedStyle(dataRow).display).to.equal(getComputedStyle(headerRow).display);
      const headerCell = headerRow.querySelector('[part="cell"]') as HTMLElement;
      const dataCell = dataRow.querySelector('[part="cell"]') as HTMLElement;
      expect(getComputedStyle(dataCell).paddingInlineStart).to.not.equal('0px');
      expect(getComputedStyle(dataCell).paddingInlineStart).to.equal(getComputedStyle(headerCell).paddingInlineStart);
      expect(getComputedStyle(dataCell).borderInlineEndStyle).to.equal('solid');
    } finally {
      restore();
    }
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

  describe('cell-highlight styling', () => {
    const injected: HTMLStyleElement[] = [];
    function injectStyle(cssText: string): void {
      const style = document.createElement('style');
      style.textContent = cssText;
      document.head.append(style);
      injected.push(style);
    }
    afterEach(() => { for (const style of injected.splice(0)) style.remove(); });

    /** Loads GRID_CSV, highlights A2, and resolves the highlighted cell alongside a plain one --
     *  both live inside <lr-virtual-list>'s own shadow root, one hop in from this component's. */
    async function mountHighlighted(el: LyraCsvViewer, activeId: string | null = null): Promise<{ highlighted: HTMLElement; plain: HTMLElement; dataRow: HTMLElement }> {
      el.src = 'https://example.test/people.csv';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      el.highlights = [{ id: 'h1', anchor: { kind: 'cell-range', range: 'A2' }, label: 'First result' }];
      el.activeHighlightId = activeId;
      await el.updateComplete;
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      await waitUntil(() => list.shadowRoot!.querySelector('[part~="cell-highlight"]') !== null);
      return {
        highlighted: list.shadowRoot!.querySelector('[part~="cell-highlight"]') as HTMLElement,
        plain: list.shadowRoot!.querySelector('[part="cell"]') as HTMLElement,
        dataRow: list.shadowRoot!.querySelector('[part="data-row"]') as HTMLElement,
      };
    }

    it('paints a highlighted cell with an outline no plain cell has', async () => {
      injectStyle('lr-csv-viewer { --lr-theme-color-brand-fill-loud: rgb(1, 2, 3); }');
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        const { highlighted, plain } = await mountHighlighted(el);
        const style = getComputedStyle(highlighted);
        expect(style.outlineStyle).to.equal('solid');
        expect(style.outlineWidth).to.not.equal('0px');
        expect(style.outlineColor).to.equal('rgb(1, 2, 3)');
        expect(style.cursor).to.equal('pointer');
        expect(getComputedStyle(plain).outlineStyle).to.equal('none');
      } finally { restore(); }
    });

    it('tints the active highlight apart from an inactive one', async () => {
      injectStyle('lr-csv-viewer { --lr-theme-color-brand-fill-loud: rgb(1, 2, 3); --lr-theme-color-warning-fill-loud: rgb(4, 5, 6); }');
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        const { highlighted } = await mountHighlighted(el, 'h1');
        expect(getComputedStyle(highlighted).outlineColor).to.equal('rgb(4, 5, 6)');
      } finally { restore(); }
    });

    it('swaps the highlight outline for the shared focus ring while the cell is focused', async () => {
      // The highlight outline is unconditional, so without an explicit :focus-visible rule it would
      // simply swallow the focus ring on this focusable cell -- indistinguishable from an unfocused
      // highlight. Probing the active (warning-tinted) highlight makes the swap unambiguous.
      injectStyle('lr-csv-viewer { --lr-theme-color-brand-fill-loud: rgb(1, 2, 3); --lr-theme-color-warning-fill-loud: rgb(4, 5, 6); }');
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        const { highlighted } = await mountHighlighted(el, 'h1');
        expect(getComputedStyle(highlighted).outlineColor).to.equal('rgb(4, 5, 6)');
        highlighted.focus();
        expect(getComputedStyle(highlighted).outlineColor).to.equal('rgb(1, 2, 3)');
      } finally { restore(); }
    });

    it('exports data-row, cell, and cell-highlight to a consumer stylesheet', async () => {
      injectStyle(`
        lr-csv-viewer::part(data-row) { opacity: 0.75; }
        lr-csv-viewer::part(cell) { padding-block-start: 3px; }
        lr-csv-viewer::part(cell-highlight) { padding-block-start: 5px; }
      `);
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        const { highlighted, plain, dataRow } = await mountHighlighted(el);
        expect(getComputedStyle(dataRow).opacity).to.equal('0.75');
        expect(getComputedStyle(plain).paddingBlockStart).to.equal('3px');
        expect(getComputedStyle(highlighted).paddingBlockStart).to.equal('5px');
      } finally { restore(); }
    });

    it('is accessible with a highlighted cell rendered', async () => {
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        const { highlighted } = await mountHighlighted(el);
        expect(highlighted.getAttribute('role')).to.equal('button');
        await expect(el).to.be.accessible();
      } finally { restore(); }
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
