import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './dataset-viewer.js';
import type { LyraDatasetViewer } from './dataset-viewer.js';
import { findDocumentRenderer } from '../document-viewer/registry.js';
import { styles } from './dataset-viewer.styles.js';

const TAB_DATA = 'name\tage\tcity\nAda\t30\tLondon\nGrace\t85\tArlington';
const GRID_DATASET = 'name,role\nAda,Mathematician\nGrace,Scientist\nAda,Programmer';
function response(body: string): Response { return { ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(body) } as Response; }
function fetchText(value: string): () => void { const original = window.fetch; window.fetch = (() => Promise.resolve(response(value))) as typeof window.fetch; return () => { window.fetch = original; }; }
/** Shrinks `DocumentAnchorTarget`'s retry loop so a permanently-unresolvable `scrollToAnchor()` call
 *  resolves in milliseconds instead of waiting out the real 5s default timeout. */
function shrinkAnchorRetry(el: LyraDatasetViewer): void {
  (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
  (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
}

describe('lr-dataset-viewer', () => {
  it('renders an empty localized state by default', async () => {
    const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No dataset to display.');
  });
  it('auto-detects tab-separated data and renders an accessible table', async () => {
    const el = (await fixture(html`<lr-dataset-viewer name="Data"></lr-dataset-viewer>`)) as LyraDatasetViewer;
    const restore = fetchText(TAB_DATA);
    try {
      el.src = 'https://example.test/a.tsv';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
      await el.updateComplete;
      expect(Array.from(el.shadowRoot!.querySelectorAll('[part="header-cell"]')).map((th) => th.textContent)).to.deep.equal(['name', 'age', 'city']);
      expect(el.shadowRoot!.querySelector('[part="table"]')!.getAttribute('aria-label')).to.equal('Data: 2 rows');
      expect(el.shadowRoot!.querySelector('[part="table"]')!.getAttribute('aria-rowcount')).to.equal('3');
    } finally { restore(); }
  });
  it('falls back to the count-only caption when name is unset', async () => {
    const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
    const restore = fetchText(TAB_DATA);
    try {
      el.src = 'https://example.test/a.tsv';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="table"]')!.getAttribute('aria-label')).to.equal('2 rows');
    } finally { restore(); }
  });
  it('renders a neutral empty-note, not the role="alert" error chrome, for a well-formed file with no rows', async () => {
    // Regression test: a delimited-text file that parses fine but has zero data rows (or zero
    // columns) used to throw the same LyraUserFacingError funneled through the generic catch
    // block into `case 'error'` -- role="alert" and error-styled chrome for a state that isn't
    // actually a failure (matching <lr-calendar-viewer>'s identical zero-events handling).
    const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
    let renderErrors = 0;
    el.addEventListener('lr-render-error', () => { renderErrors++; });
    const restore = fetchText('name\tage\tcity');
    try {
      el.src = 'https://example.test/empty.tsv';
      await waitUntil(() => el.shadowRoot!.querySelector('.empty-note')?.textContent === 'This dataset has no rows.');
      expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('This dataset has no rows.');
      expect(el.shadowRoot!.querySelector('[role="alert"]')).to.equal(null);
      expect(renderErrors).to.equal(0);
    } finally { restore(); }
  });
  it('honors a host aria-label over the computed row-count caption when name is unset', async () => {
    const el = (await fixture(html`<lr-dataset-viewer aria-label="Team roster"></lr-dataset-viewer>`)) as LyraDatasetViewer;
    const restore = fetchText(TAB_DATA);
    try {
      el.src = 'https://example.test/a.tsv';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="table"]')!.getAttribute('aria-label')).to.equal('Team roster');
    } finally { restore(); }
  });
  it('lets an explicit host aria-label take precedence over name', async () => {
    const el = (await fixture(html`<lr-dataset-viewer name="Data" aria-label="Team roster"></lr-dataset-viewer>`)) as LyraDatasetViewer;
    const restore = fetchText(TAB_DATA);
    try {
      el.src = 'https://example.test/a.tsv';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="table"]')!.getAttribute('aria-label')).to.equal('Team roster');
    } finally { restore(); }
  });
  it('localizes the interpolated row count', async () => {
    const el = (await fixture(html`<lr-dataset-viewer lang="ar"></lr-dataset-viewer>`)) as LyraDatasetViewer;
    const restore = fetchText(TAB_DATA);
    try {
      el.src = 'https://example.test/a.tsv';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="table"]')!.getAttribute('aria-label')).to.contain(new Intl.NumberFormat('ar').format(2));
    } finally { restore(); }
  });
  it('supports a .strings override for the empty-state message', async () => {
    const el = (await fixture(html`<lr-dataset-viewer .strings=${{ documentPreviewEmpty: 'Aucun {type} à afficher.', documentPreviewTypeDataset: 'jeu de données' }}></lr-dataset-viewer>`)) as LyraDatasetViewer;
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('Aucun jeu de données à afficher.');
  });
  it('rejects unsafe URLs and emits exactly one render error', async () => {
    const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
    let count = 0;
    el.addEventListener('lr-render-error', () => { count++; });
    const event = oneEvent(el, 'lr-render-error');
    el.src = 'javascript:alert(1)';
    await event;
    await aTimeout(0);
    expect(el.shadowRoot!.querySelector('[role="alert"]')!.textContent).to.equal('Document URL is not allowed.');
    expect(count).to.equal(1);
  });
  it('registers tsv/psv/dat but not csv or unrelated files', () => {
    expect(findDocumentRenderer({ name: 'a.tsv', mimeType: 'application/octet-stream', src: 'x' })).to.exist;
    expect(findDocumentRenderer({ name: 'a.csv', mimeType: 'text/csv', src: 'x' })).to.not.exist;
  });
  it('reloads an already-loaded source after reconnecting', async () => {
    const original = window.fetch;
    let calls = 0;
    window.fetch = (() => { calls++; return Promise.resolve(response(TAB_DATA)); }) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lr-dataset-viewer src="https://example.test/a.tsv"></lr-dataset-viewer>`)) as LyraDatasetViewer;
      await waitUntil(() => calls === 1 && el.shadowRoot!.querySelector('[part="table"]') !== null);
      const parent = el.parentElement!;
      el.remove();
      parent.append(el);
      await waitUntil(() => calls === 2);
    } finally { window.fetch = original; }
  });
  it('is accessible', async () => { const el = await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`); await expect(el).to.be.accessible(); });

  describe('virtualized table structure', () => {
    it('maps to role=table / role=row / role=rowgroup with correct rowcount/rowindex', async () => {
      const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
        const table = el.shadowRoot!.querySelector('[part="table"]')!;
        expect(table.getAttribute('role')).to.equal('table');
        expect(table.getAttribute('aria-rowcount')).to.equal('4'); // 3 data rows + header
        expect(table.getAttribute('aria-colcount')).to.equal('2');
        expect(el.shadowRoot!.querySelector('[part="header-row"]')!.getAttribute('role')).to.equal('row');
        expect(el.shadowRoot!.querySelector('[part="header-row"]')!.getAttribute('aria-rowindex')).to.equal('1');
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        expect(list.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')).to.equal('rowgroup');
        await aTimeout(0);
        const firstRow = list.shadowRoot!.querySelector('[part="row"]')!;
        expect(firstRow.getAttribute('role')).to.equal('row');
        expect(firstRow.getAttribute('aria-rowindex')).to.equal('2'); // first body row, offset by the header
      } finally {
        restore();
      }
    });

    it('is accessible on the mapped table/rowgroup/row tree', async () => {
      const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
        await expect(el).to.be.accessible();
      } finally {
        restore();
      }
    });

    it('is accessible with cell-range highlights painting their focusable action buttons', async () => {
      // Populated-state axe check: the `cell-highlight` cells and their nested
      // `cell-highlight-action` buttons only render once `highlights` resolve against a loaded
      // grid — no highlight-free axe run can see them. Assert the highlight actually rendered
      // (inside the nested virtual-list shadow root, which axe also traverses) before running axe.
      const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.highlights = [
          { id: 'h1', anchor: { kind: 'cell-range', range: 'A2:B2' }, label: 'First data row' },
        ];
        el.src = 'https://example.test/data.tsv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        await waitUntil(() => list.shadowRoot!.querySelector('[part~="cell-highlight"]') !== null);
        expect(list.shadowRoot!.querySelector('[part="cell-highlight-action"]')).to.exist;
        await expect(el).to.be.accessible();
      } finally {
        restore();
      }
    });

    it('exports the virtualized row parts so a consumer stylesheet reaches them', async () => {
      // Row markup is rendered inside <lr-virtual-list>'s own shadow root, two hops from a
      // consumer: without exportparts on that element, lr-dataset-viewer::part(cell) and friends
      // match nothing at all.
      const style = document.createElement('style');
      style.textContent = `
        lr-dataset-viewer::part(data-row) { opacity: 0.75; }
        lr-dataset-viewer::part(cell) { padding-block-start: 3px; }
        lr-dataset-viewer::part(cell-highlight) { padding-block-start: 5px; }
        lr-dataset-viewer::part(cell-highlight-action) { padding-block-start: 7px; }
      `;
      document.head.append(style);
      const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.highlights = [{ id: 'h1', anchor: { kind: 'cell-range', range: 'A2' }, label: 'First data row' }];
        el.src = 'https://example.test/data.tsv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        await waitUntil(() => list.shadowRoot!.querySelector('[part~="cell-highlight"]') !== null);
        const dataRow = list.shadowRoot!.querySelector('[part="data-row"]') as HTMLElement;
        const plain = list.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
        const highlighted = list.shadowRoot!.querySelector('[part~="cell-highlight"]') as HTMLElement;
        const action = list.shadowRoot!.querySelector('[part="cell-highlight-action"]') as HTMLElement;
        expect(getComputedStyle(dataRow).opacity).to.equal('0.75');
        expect(getComputedStyle(plain).paddingBlockStart).to.equal('3px');
        expect(getComputedStyle(highlighted).paddingBlockStart).to.equal('5px');
        expect(getComputedStyle(action).paddingBlockStart).to.equal('7px');
      } finally {
        restore();
        style.remove();
      }
    });

    it('renders files above the old 1,000-row cap up to the shared 10k default', async () => {
      const bigRows = Array.from({ length: 5000 }, (_unused, i) => `row${i},value${i}`).join('\n');
      const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
      const restore = fetchText(`name,val\n${bigRows}`);
      try {
        el.src = 'https://example.test/big.tsv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
        expect(el.shadowRoot!.querySelector('[part="error"]')).to.not.exist;
        expect(el.shadowRoot!.querySelector('[part="table"]')!.getAttribute('aria-rowcount')).to.equal('5001');
      } finally {
        restore();
      }
    });

    it('still errors above 10,000 rows', async () => {
      const bigRows = Array.from({ length: 10001 }, (_unused, i) => `row${i},value${i}`).join('\n');
      const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
      const restore = fetchText(`name,val\n${bigRows}`);
      try {
        el.src = 'https://example.test/toobig.tsv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
        expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;
      } finally {
        restore();
      }
    });
  });

  describe('cell-range anchor-target and search', () => {
    it('resolves a cell-range anchor addressing the raw grid (header included)', async () => {
      const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'A2' })).to.be.true;
      } finally {
        restore();
      }
    });

    it('resolves an anchor and highlight in the header row, deduplicating repeated public ids', async () => {
      const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'B1' })).to.be.true;
        el.highlights = [
          { id: 'duplicate', anchor: { kind: 'cell-range', range: 'A1' }, label: 'First' },
          { id: 'duplicate', anchor: { kind: 'cell-range', range: 'B1' }, label: 'Ignored duplicate' },
        ];
        await el.updateComplete;
        const header = el.shadowRoot!.querySelector('[part="header-row"]')!;
        expect(header.querySelectorAll('[part~="cell-highlight"]')).to.have.lengthOf(1);
        const highlighted = header.querySelector('[part~="cell-highlight"]')!;
        expect(highlighted.getAttribute('role')).to.equal('columnheader');
        const action = highlighted.querySelector('[part="cell-highlight-action"]') as HTMLElement;
        expect(action !== null).to.be.true;
        expect(getComputedStyle(highlighted).outlineStyle).to.equal('solid');
        expect(getComputedStyle(action).minBlockSize).to.equal('40px');
      } finally { restore(); }
    });

    it('resolves false for an anchor with a sheet set', async () => {
      const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
      shrinkAnchorRetry(el);
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
        expect(await el.scrollToAnchor({ kind: 'cell-range', sheet: 'Sheet1', range: 'A1' })).to.be.false;
      } finally {
        restore();
      }
    });

    it('truthfully rejects rows and columns outside the parsed grid', async () => {
      const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
      shrinkAnchorRetry(el);
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'A999' })).to.be.false;
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'K2' })).to.be.false;
      } finally {
        restore();
      }
    });

    it('scrolls the addressed body column horizontally into view', async () => {
      const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelector('[part="data-row"]') != null);
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        const target = list.shadowRoot!.querySelector('[part="data-row"]')!.querySelectorAll('[part~="cell"]')[1] as HTMLElement;
        let scrolled = false;
        target.scrollIntoView = () => { scrolled = true; };
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'B2' })).to.be.true;
        expect(scrolled).to.be.true;
      } finally {
        restore();
      }
    });

    it('finds search matches ordered row -> column', async () => {
      const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
        expect(await el.search('ada')).to.equal(2);
      } finally {
        restore();
      }
    });

    it('caps retained search matches before allocating an unbounded result list', async () => {
      const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
      (el as unknown as { fetchState: unknown }).fetchState = {
        kind: 'loaded',
        table: {
          fields: ['value'],
          rows: Array.from({ length: 1_001 }, () => ({ value: 'hit' })),
        },
      };
      await el.updateComplete;
      expect(await el.search('hit')).to.equal(1_000);
      expect((el as unknown as { searchMatches: unknown[] }).searchMatches).to.have.lengthOf(1_000);
    });

    it('searches header fields and case-folds with the effective locale', async () => {
      const el = (await fixture(html`<lr-dataset-viewer lang="tr"></lr-dataset-viewer>`)) as LyraDatasetViewer;
      const restore = fetchText('İSTANBUL,role\nAnkara,capital');
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
        expect(await el.search('istanbul')).to.equal(1);
      } finally { restore(); }
    });

    it('recomputes an active search when the host language changes', async () => {
      const el = (await fixture(html`<lr-dataset-viewer lang="en"></lr-dataset-viewer>`)) as LyraDatasetViewer;
      const restore = fetchText('City\nİSTANBUL\nistanbul');
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
        expect(await el.search('istanbul')).to.equal(1);
        el.lang = 'tr';
        await el.updateComplete;
        await aTimeout(0);
        expect((el as unknown as { searchMatches: unknown[] }).searchMatches).to.have.lengthOf(2);
      } finally { restore(); }
    });

    it('searchNext/searchPrevious wrap, and clearSearch resets to 0/-1', async () => {
      const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
        await el.search('ada');
        let detail: { matchCount: number; activeIndex: number } | undefined;
        el.addEventListener('lr-search-change', (e) => (detail = (e as CustomEvent).detail));
        expect(await el.searchNext()).to.be.true;
        expect(detail!.activeIndex).to.equal(1);
        expect(await el.searchNext()).to.be.true;
        expect(detail!.activeIndex).to.equal(0); // wraps
        expect(await el.searchPrevious()).to.be.true;
        expect(detail!.activeIndex).to.equal(1); // wraps backward
        const listener = oneEvent(el, 'lr-search-change');
        el.clearSearch();
        const event = (await listener) as CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
        expect(event.detail).to.deep.equal({ query: '', matchCount: 0, activeIndex: -1 });
      } finally {
        restore();
      }
    });

    it('an empty query behaves like clearSearch and resolves 0', async () => {
      const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
        await el.search('ada');
        expect(await el.search('   ')).to.equal(0);
      } finally {
        restore();
      }
    });

    it('renders a focusable cell-highlight and emits lr-highlight-activate', async () => {
      const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
        el.highlights = [{ id: 'h1', anchor: { kind: 'cell-range', range: 'A2' } }];
        await el.updateComplete;
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        const highlighted = list.shadowRoot!.querySelector('[part~="cell-highlight"]') as HTMLElement | null;
        expect(highlighted).to.exist;
        // The cell itself stays structural (role="cell", not focusable); the activation
        // affordance is the nested native button.
        expect(highlighted!.getAttribute('role')).to.equal('cell');
        expect(highlighted!.hasAttribute('tabindex')).to.be.false;
        const action = highlighted!.querySelector('[part="cell-highlight-action"]') as HTMLElement | null;
        expect(action).to.exist;
        expect(action!.tagName).to.equal('BUTTON');
        // A real action button (not a plain grid cell) -- gets the shared minimum hit area.
        expect(getComputedStyle(action!).minInlineSize).to.equal('40px');
        expect(getComputedStyle(action!).minBlockSize).to.equal('40px');
        const listener = oneEvent(el, 'lr-highlight-activate');
        action!.click();
        const event = (await listener) as CustomEvent<{ id: string }>;
        expect(event.detail).to.deep.equal({ id: 'h1' });
      } finally {
        restore();
      }
    });

    it('exposes an activation button only inside a highlighted cell, never a plain cell', async () => {
      const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
        el.highlights = [{ id: 'h1', anchor: { kind: 'cell-range', range: 'A2' }, label: 'First result' }];
        await el.updateComplete;
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        const plain = list.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
        expect(plain.hasAttribute('tabindex')).to.be.false;
        expect(plain.querySelector('button')).to.equal(null);
        // A native <button> provides Enter/Space activation as built-in behavior, so proving the
        // control is a button with the highlight's accessible name covers the keyboard contract.
        const action = list.shadowRoot!.querySelector('[part="cell-highlight-action"]') as HTMLButtonElement;
        expect(action.tagName).to.equal('BUTTON');
        expect(action.getAttribute('aria-label')).to.equal('First result');
        const listener = oneEvent(el, 'lr-highlight-activate');
        action.click();
        const event = (await listener) as CustomEvent<{ id: string }>;
        expect(event.detail).to.deep.equal({ id: 'h1' });
      } finally {
        restore();
      }
    });
  });

  it('does not leak internal virtual-list events through the viewer host', async () => {
    const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
    const restore = fetchText(GRID_DATASET);
    try {
      el.src = 'https://example.test/data.tsv';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      let leaked = 0;
      for (const name of ['lr-load-more', 'lr-visible-range-changed', 'lr-scroll']) {
        el.addEventListener(name as never, () => { leaked++; });
        el.shadowRoot!.querySelector('lr-virtual-list')!.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
      }
      expect(leaked).to.equal(0);
    } finally { restore(); }
  });

  describe('back-compat', () => {
    it('::part(table) still matches, and no cell-highlight renders unset', async () => {
      const el = (await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`)) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
        expect(el.shadowRoot!.querySelector('[part~="table"]')).to.exist;
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        expect(list.shadowRoot!.querySelectorAll('[part~="cell-highlight"]').length).to.equal(0);
      } finally {
        restore();
      }
    });
  });
});

describe('styling', () => {
  it('gives the cell-highlight-action a hover state', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/lr-virtual-list::part\(cell-highlight-action\):hover/);
  });
});
