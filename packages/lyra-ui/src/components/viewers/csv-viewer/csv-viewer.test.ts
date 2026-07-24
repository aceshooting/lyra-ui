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
    const original = window.fetch;
    let calls = 0;
    window.fetch = (() => { calls++; return Promise.resolve({ ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(CSV) } as Response); }) as typeof window.fetch;
    try {
      el.remove();
      await aTimeout(0);
      el.src = 'https://example.test/detached.csv';
      await aTimeout(0);
      parent.append(el);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="header-row"]') !== null, 'src set while detached was never loaded after reconnect');
      expect(calls).to.equal(1);
    } finally { window.fetch = original; }
  });
  it('reloads an already-loaded source after reconnecting', async () => {
    const original = window.fetch;
    let calls = 0;
    window.fetch = (() => { calls++; return Promise.resolve({ ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(CSV) } as Response); }) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lr-csv-viewer src="https://example.test/people.csv"></lr-csv-viewer>`)) as LyraCsvViewer;
      await waitUntil(() => calls === 1 && el.shadowRoot!.querySelector('[part="header-row"]') !== null);
      const parent = el.parentElement!;
      el.remove();
      parent.append(el);
      await waitUntil(() => calls === 2);
    } finally { window.fetch = original; }
  });
  it('can treat every row as data through a false property binding', async () => {
    const el = (await fixture(html`<lr-csv-viewer .hasHeaderRow=${false}></lr-csv-viewer>`)) as LyraCsvViewer;
    const restore = fetchText(CSV);
    try { el.src = 'https://example.test/people.csv'; await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null); expect(el.shadowRoot!.querySelector('[part="header-row"]')).to.not.exist; expect((el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { items: unknown[][] }).items).to.have.lengthOf(3); } finally { restore(); }
  });
  it('accepts has-header-row="false" as a plain-HTML attribute string, not only a property binding', async () => {
    // Regression test: Lit's default presence-based Boolean converter treats ANY attribute value,
    // including the literal string "false", as true -- a true-defaulting property needs a
    // custom converter (mirrors lr-task-list's trueDefaultBooleanConverter) for plain markup to be
    // able to turn it off at all.
    const el = (await fixture(html`<lr-csv-viewer has-header-row="false"></lr-csv-viewer>`)) as LyraCsvViewer;
    expect(el.hasHeaderRow).to.be.false;
  });
  it('is accessible', async () => { const el = await fixture(html`<lr-csv-viewer></lr-csv-viewer>`); await expect(el).to.be.accessible(); });
  it('uses name as the accessible name, falling back to a localized default', async () => {
    const named = (await fixture(html`<lr-csv-viewer name="quarterly.csv"></lr-csv-viewer>`)) as LyraCsvViewer;
    expect(named.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('quarterly.csv');
    const unnamed = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
    expect(unnamed.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('CSV document');
  });
  it('exposes the accessible name on a region and lets the host aria-label override name', async () => {
    const el = (await fixture(html`<lr-csv-viewer name="quarterly.csv" aria-label="Quarterly report"></lr-csv-viewer>`)) as LyraCsvViewer;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('role')).to.equal('region');
    expect(base.getAttribute('aria-label')).to.equal('Quarterly report');
  });
  it('emits exactly one render error for an unsafe URL', async () => {
    const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
    let count = 0;
    el.addEventListener('lr-render-error', () => { count++; });
    const event = oneEvent(el, 'lr-render-error');
    el.src = 'javascript:alert(1)';
    await event;
    await aTimeout(0);
    expect(count).to.equal(1);
  });
  it('emits a render error when the optional parser is unavailable', async () => {
    const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve(null);
    const restore = fetchText(CSV);
    try {
      const event = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/people.csv';
      await event;
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('CSV preview is unavailable.');
    } finally { restore(); }
  });
  it('supports a .strings override for the csvViewerLabel fallback', async () => {
    const el = (await fixture(html`<lr-csv-viewer .strings=${{ csvViewerLabel: 'Document CSV' }}></lr-csv-viewer>`)) as LyraCsvViewer;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Document CSV');
  });
  it('applies max-height as a custom property on the base part', async () => {
    const el = (await fixture(html`<lr-csv-viewer max-height="20rem"></lr-csv-viewer>`)) as LyraCsvViewer;
    expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).style.getPropertyValue('--lr-csv-viewer-max-height')).to.equal('20rem');
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

    it('resolves and scrolls a header-row anchor', async () => {
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="header-row"]') !== null);
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'B1' })).to.be.true;
      } finally { restore(); }
    });

    it('renders header highlights with table-cell semantics and one nested action', async () => {
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="header-row"]') !== null);
        el.highlights = [
          { id: 'duplicate', anchor: { kind: 'cell-range', range: 'A1' }, label: 'First' },
          { id: 'duplicate', anchor: { kind: 'cell-range', range: 'B1' }, label: 'Ignored duplicate' },
        ];
        await el.updateComplete;
        const header = el.shadowRoot!.querySelector('[part="header-row"]')!;
        expect(header.getAttribute('role')).to.equal('row');
        expect(header.querySelectorAll('[part~="cell-highlight"]')).to.have.lengthOf(1);
        const highlighted = header.querySelector('[part~="cell-highlight"]')!;
        expect(highlighted.getAttribute('role')).to.equal('columnheader');
        const action = highlighted.querySelector('[part="cell-highlight-action"]') as HTMLElement;
        expect(action !== null).to.be.true;
        expect(getComputedStyle(highlighted).outlineStyle).to.equal('solid');
        expect(getComputedStyle(action).minBlockSize).to.equal('40px');
      } finally { restore(); }
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

    it('truthfully rejects rows and columns outside the parsed grid', async () => {
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      shrinkAnchorRetry(el);
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'A999' })).to.be.false;
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'K2' })).to.be.false;
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
        expect(highlighted.getAttribute('role')).to.equal('cell');
        const action = highlighted.querySelector('[part="cell-highlight-action"]') as HTMLButtonElement;
        expect(action !== null).to.be.true;
        expect(action.getAttribute('aria-label')).to.equal('First result');
        const listener = oneEvent(el, 'lr-highlight-activate');
        action.click();
        const event = (await listener) as CustomEvent<{ id: string }>;
        expect(event.detail).to.deep.equal({ id: 'h1' });
      } finally {
        restore();
      }
    });

    it('uses a native keyboard-activatable button and never makes a plain cell interactive', async () => {
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
        const action = highlighted.querySelector('[part="cell-highlight-action"]')!;
        expect(action.tagName).to.equal('BUTTON');
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

    it('case-folds with the effective locale and can navigate a header match', async () => {
      const el = (await fixture(html`<lr-csv-viewer lang="tr"></lr-csv-viewer>`)) as LyraCsvViewer;
      const restore = fetchText('İSTANBUL,Role\nAnkara,Capital');
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="header-row"]') !== null);
        expect(await el.search('istanbul')).to.equal(1);
      } finally { restore(); }
    });

    it('recomputes an active search when the host language changes', async () => {
      const el = (await fixture(html`<lr-csv-viewer lang="en"></lr-csv-viewer>`)) as LyraCsvViewer;
      const restore = fetchText('City\nİSTANBUL\nistanbul');
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        expect(await el.search('istanbul')).to.equal(1);
        el.lang = 'tr';
        await el.updateComplete;
        await aTimeout(0);
        expect((el as unknown as { searchMatches: unknown[] }).searchMatches).to.have.lengthOf(2);
      } finally { restore(); }
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

    it('caps retained search matches before allocating an unbounded result list', async () => {
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      (el as unknown as { fetchState: unknown }).fetchState = {
        kind: 'loaded',
        rows: Array.from({ length: 1_001 }, () => ['hit']),
      };
      await el.updateComplete;
      expect(await el.search('hit')).to.equal(1_000);
      expect((el as unknown as { searchMatches: unknown[] }).searchMatches).to.have.lengthOf(1_000);
    });
  });

  it('does not leak internal virtual-list events through the viewer host', async () => {
    const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
    const restore = fetchText(GRID_CSV);
    try {
      el.src = 'https://example.test/people.csv';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      let leaked = 0;
      for (const name of ['lr-load-more', 'lr-visible-range-changed', 'lr-scroll']) {
        el.addEventListener(name as never, () => { leaked++; });
        el.shadowRoot!.querySelector('lr-virtual-list')!.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
      }
      expect(leaked).to.equal(0);
    } finally { restore(); }
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

    it('shows the shared focus ring on the nested highlight action', async () => {
      // The highlight outline is unconditional, so without an explicit :focus-visible rule it would
      // simply swallow the focus ring on this focusable cell -- indistinguishable from an unfocused
      // highlight. Probing the active (warning-tinted) highlight makes the swap unambiguous.
      injectStyle('lr-csv-viewer { --lr-theme-color-brand-fill-loud: rgb(1, 2, 3); --lr-theme-color-warning-fill-loud: rgb(4, 5, 6); }');
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        const { highlighted } = await mountHighlighted(el, 'h1');
        expect(getComputedStyle(highlighted).outlineColor).to.equal('rgb(4, 5, 6)');
        const action = highlighted.querySelector('[part="cell-highlight-action"]') as HTMLElement;
        action.focus();
        expect(getComputedStyle(action).outlineColor).to.equal('rgb(1, 2, 3)');
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
        expect(highlighted.getAttribute('role')).to.equal('cell');
        await expect(el).to.be.accessible();
      } finally { restore(); }
    });
  });

  describe('overflow', () => {
    it('pins overflow-y on [part="sheet"] alongside its overflow-x, avoiding a phantom scrollbar', async () => {
      // Per the CSS overflow spec, pinning only overflow-x to a non-'visible' value forces
      // overflow-y's used value to 'auto' too (never stays 'visible') -- risking a phantom/empty
      // vertical scrollbar from sub-pixel rounding on a grid that never actually overflows
      // vertically (the same bug shape already fixed on lr-tabs). Pin both axes explicitly.
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      const restore = fetchText(CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="sheet"]') !== null);
        const sheet = el.shadowRoot!.querySelector('[part="sheet"]') as HTMLElement;
        expect(getComputedStyle(sheet).overflowX).to.equal('auto');
        expect(getComputedStyle(sheet).overflowY).to.equal('hidden');
      } finally { restore(); }
    });
  });

  describe('cell-highlight hover state', () => {
    it('gives lr-virtual-list::part(cell-highlight) a :hover rule alongside its :focus-visible ring', async () => {
      // jsdom/wtr don't synthesize a real :hover pseudo-class from a dispatched event, so this
      // asserts the internal rule exists directly via the adopted stylesheet text (mirrors
      // lr-task-list's identical hover-rule test).
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      const rule = (el.shadowRoot!.adoptedStyleSheets ?? [])
        .flatMap((sheet) => Array.from(sheet.cssRules))
        .map((cssRule) => cssRule.cssText)
        .find((text) => text.includes(':hover') && text.includes('cell-highlight'));
      expect(rule).to.exist;
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
