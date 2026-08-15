import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './csv-viewer.js';
import type { LyraCsvViewer } from './csv-viewer.js';
import { LyraResourceLimitError } from '../../../internal/resource-loader.js';

const CSV = 'Name,Role\nAda Lovelace,Mathematician\nGrace Hopper,Computer scientist';
const GRID_CSV = 'Name,Role\nAda,Mathematician\nGrace,Scientist\nAda,Programmer';
function fetchText(value: string): () => void { const original = window.fetch; window.fetch = (() => Promise.resolve({ ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(value) } as Response)) as typeof window.fetch; return () => { window.fetch = original; }; }
/** Shrinks `DocumentAnchorTarget`'s retry loop so a permanently-unresolvable `scrollToAnchor()` call
 *  resolves in milliseconds instead of waiting out the real 5s default timeout. */
function shrinkAnchorRetry(el: LyraCsvViewer): void {
  (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
  (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
}

async function assertScrollFrameFollowsAdoption(
  el: HTMLElement & { updateComplete: Promise<unknown> },
  scrollColumnIntoView: () => Promise<void>,
): Promise<void> {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameWindow = frame.contentWindow;
  const frameDocument = frame.contentDocument;
  if (!frameWindow || !frameDocument) {
    frame.remove();
    throw new Error('The iframe realm was unavailable.');
  }

  const originalRequest = window.requestAnimationFrame;
  const originalCancel = window.cancelAnimationFrame;
  const originalFrameRequest = frameWindow.requestAnimationFrame;
  const originalFrameCancel = frameWindow.cancelAnimationFrame;
  const originalMatchMedia = window.matchMedia;
  const originalFrameMatchMedia = frameWindow.matchMedia;
  const renderRoot = el.shadowRoot!;
  const originalQuerySelector = renderRoot.querySelector.bind(renderRoot);
  const queued = new Map<number, FrameRequestCallback>();
  const cancelled: number[] = [];
  const scrollBehaviors: ScrollBehavior[] = [];
  let nextHandle = 0;
  let topRequests = 0;
  let frameRequests = 0;
  let topMotionQueries = 0;
  let frameMotionQueries = 0;

  const target = { scrollIntoView: (options: ScrollIntoViewOptions) => {
    if (options.behavior) scrollBehaviors.push(options.behavior);
  } };
  const row = { querySelectorAll: () => [target, target] };
  const list = { updateComplete: Promise.resolve(), shadowRoot: { querySelector: () => row } };
  renderRoot.querySelector = ((selector: string) => (
    selector.startsWith('lr-virtual-list') ? list : originalQuerySelector(selector)
  )) as typeof renderRoot.querySelector;
  window.matchMedia = (() => {
    topMotionQueries++;
    return { matches: false } as MediaQueryList;
  }) as typeof window.matchMedia;
  frameWindow.matchMedia = (() => {
    frameMotionQueries++;
    return { matches: true } as MediaQueryList;
  }) as typeof frameWindow.matchMedia;

  window.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
    topRequests++;
    const handle = ++nextHandle;
    queued.set(handle, callback);
    return handle;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((handle: number): void => {
    cancelled.push(handle);
    queued.delete(handle);
  }) as typeof window.cancelAnimationFrame;
  frameWindow.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
    frameRequests++;
    const handle = ++nextHandle;
    queueMicrotask(() => callback(0));
    return handle;
  }) as typeof frameWindow.requestAnimationFrame;
  frameWindow.cancelAnimationFrame = (() => {}) as typeof frameWindow.cancelAnimationFrame;

  try {
    const staleScroll = scrollColumnIntoView();
    await waitUntil(() => topRequests === 1);
    frameDocument.body.append(el);
    await el.updateComplete;
    for (const [handle, callback] of [...queued]) {
      queued.delete(handle);
      callback(0);
    }
    await staleScroll;

    const currentScroll = scrollColumnIntoView();
    await waitUntil(() => frameRequests === 1 || topRequests === 2);
    for (const [handle, callback] of [...queued]) {
      queued.delete(handle);
      callback(0);
    }
    await currentScroll;

    expect(el.ownerDocument === frameDocument).to.be.true;
    expect(topRequests).to.equal(1);
    expect(cancelled).to.deep.equal([1]);
    expect(frameRequests).to.equal(1);
    expect(topMotionQueries).to.equal(0);
    expect(frameMotionQueries).to.equal(1);
    expect(scrollBehaviors).to.deep.equal(['auto']);
  } finally {
    window.requestAnimationFrame = originalRequest;
    window.cancelAnimationFrame = originalCancel;
    frameWindow.requestAnimationFrame = originalFrameRequest;
    frameWindow.cancelAnimationFrame = originalFrameCancel;
    window.matchMedia = originalMatchMedia;
    frameWindow.matchMedia = originalFrameMatchMedia;
    renderRoot.querySelector = originalQuerySelector as typeof renderRoot.querySelector;
    frame.remove();
  }
}

describe('lr-csv-viewer', () => {
  it('renders an empty localized state by default', async () => { const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer; expect(el.hasHeaderRow).to.be.true; expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No document to display.'); });
  it('parses quoted CSV and virtualizes body rows', async () => {
    const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
    const restore = fetchText('Name,Notes\nAda,"Wrote notes on the ""Engine"", 1843"');
    try { el.src = 'https://example.test/people.csv'; await waitUntil(() => el.shadowRoot!.querySelector('[part="header-row"]') !== null); expect((el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { items: unknown[][] }).items[0]).to.deep.equal(['Ada', 'Wrote notes on the "Engine", 1843']); } finally { restore(); }
  });
  it('preserves auto-detected delimiters and quoted newlines through the bounded parser path', async () => {
    const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
    const restore = fetchText('Name;Notes\r\nAda;"first; clause\r\nsecond clause"\r\nGrace;plain');
    try {
      el.src = 'https://example.test/people.csv';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { items: unknown[][] };
      expect(list.items).to.deep.equal([
        ['Ada', 'first; clause\r\nsecond clause'],
        ['Grace', 'plain'],
      ]);
    } finally {
      restore();
    }
  });
  it('emits bounded parser diagnostics while retaining a recoverable partial grid', async () => {
    const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
    const diagnostics: unknown[] = [];
    el.addEventListener('lr-render-error', (event) => {
      diagnostics.push((event as CustomEvent<{ error: unknown }>).detail.error);
    });
    const restore = fetchText('Name,Role\nAda,Math\n"Grace,Science');
    try {
      el.src = 'https://example.test/recoverable.csv';
      await waitUntil(() => diagnostics.length === 1);
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      const codes = (diagnostics[0] as Array<{ code?: string }>).map((error) => error.code);
      expect(codes).to.include('MissingQuotes');
      expect(el.shadowRoot!.querySelectorAll('[part="error"]')).to.have.lengthOf(0);
      expect(el.shadowRoot!.querySelectorAll('lr-virtual-list')).to.have.lengthOf(1);
    } finally {
      restore();
    }
  });
  it('rejects a compact million-row resource before PapaParse is invoked', async () => {
    const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
    let parseCalls = 0;
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve({
      parse() {
        parseCalls++;
        return { data: [], errors: [], meta: {} };
      },
    });
    const restore = fetchText('x\n'.repeat(1_000_000));
    try {
      const errorEvent = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/compact-million.csv';
      const event = await errorEvent as CustomEvent<{ error: unknown }>;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(event.detail.error instanceof LyraResourceLimitError).to.be.true;
      expect(parseCalls).to.equal(0);
      expect(el.shadowRoot!.querySelectorAll('lr-virtual-list')).to.have.lengthOf(0);
    } finally {
      restore();
    }
  });
  it('keeps a fetched empty document in neutral no-data state', async () => {
    const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
    const restore = fetchText('');
    try {
      el.src = 'https://example.test/empty.csv';
      await waitUntil(() => el.shadowRoot!.querySelector('.empty-note')?.textContent === 'No data');
      expect(el.shadowRoot!.querySelectorAll('[part="error"]')).to.have.lengthOf(0);
    } finally {
      restore();
    }
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
    try { el.src = 'https://example.test/people.csv'; await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null); expect((el.shadowRoot!.querySelector('[part="header-row"]')) == null).to.be.true; expect((el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { items: unknown[][] }).items).to.have.lengthOf(3); } finally { restore(); }
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
  it('leaves a non-empty host aria-label on the host instead of duplicating a shadow owner', async () => {
    const el = (await fixture(html`<lr-csv-viewer name="quarterly.csv" aria-label="Quarterly report"></lr-csv-viewer>`)) as LyraCsvViewer;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('role')).to.be.null;
    expect(base.getAttribute('aria-label')).to.be.null;
    expect(el.getAttribute('aria-label')).to.equal('Quarterly report');
  });
  it('preserves an explicitly empty host aria-label on the stable region without duplicating it on the table', async () => {
    const el = (await fixture(html`<lr-csv-viewer name="quarterly.csv" aria-label=""></lr-csv-viewer>`)) as LyraCsvViewer;
    const restore = fetchText(CSV);
    try {
      el.src = 'https://example.test/report.csv';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="sheet"]') !== null);
      const base = el.shadowRoot!.querySelector('[part="base"]')!;
      const sheet = el.shadowRoot!.querySelector('[part="sheet"]')!;
      expect(base.hasAttribute('aria-label')).to.be.true;
      expect(base.getAttribute('aria-label')).to.equal('');
      expect(sheet.hasAttribute('aria-label')).to.be.false;
    } finally {
      restore();
    }
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
      const originalMatchMedia = window.matchMedia;
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="header-row"]') !== null);
        const cell = el.shadowRoot!.querySelector('[part="header-row"]')!
          .querySelectorAll('[part~="cell"]')[1] as HTMLElement;
        const behaviors: (ScrollBehavior | undefined)[] = [];
        cell.scrollIntoView = ((options?: ScrollIntoViewOptions) => { behaviors.push(options?.behavior); }) as HTMLElement['scrollIntoView'];

        window.matchMedia = (() => ({ matches: false }) as MediaQueryList) as typeof window.matchMedia;
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'B1' })).to.be.true;
        // Pinned so this branch can't silently diverge from <lr-dataset-viewer>'s identical one.
        expect(behaviors).to.deep.equal(['smooth']);

        window.matchMedia = (() => ({ matches: true }) as MediaQueryList) as typeof window.matchMedia;
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'B1' })).to.be.true;
        expect(behaviors).to.deep.equal(['smooth', 'auto']);
      } finally {
        window.matchMedia = originalMatchMedia;
        restore();
      }
    });

    it('reports a failed jump when a concurrent src reassignment lands during the scroll wait', async () => {
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        // One attempt only: the mixin's retry loop would otherwise re-resolve against the newly
        // loaded document, which is correct behavior but hides this call's own result.
        (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 0;
        (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 0;

        // Reassign `src` through the real public setter from inside the await that jumpToCell is
        // already suspended on -- exactly the citation/file-tab click that lands mid-jump.
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        let swapped = false;
        Object.defineProperty(list, 'updateComplete', {
          configurable: true,
          get: () => {
            if (swapped) return Promise.resolve(true);
            swapped = true;
            return (async () => {
              el.src = 'https://example.test/other.csv';
              await el.updateComplete;
              await aTimeout(0);
              return true;
            })();
          },
        });

        const found = await el.scrollToAnchor({ kind: 'cell-range', range: 'A2' });
        expect(swapped, 'the reassignment really landed inside the jump').to.equal(true);
        expect(found, 'a jump whose document was replaced mid-flight is not a success').to.equal(false);
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

    it('cancels a stale scroll frame in its source realm and uses the current realm after iframe adoption', async () => {
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      const scrollColumnIntoView = (): Promise<void> => (
        el as unknown as { scrollColumnIntoView: (col: number) => Promise<void> }
      ).scrollColumnIntoView(1);

      await assertScrollFrameFollowsAdoption(el, scrollColumnIntoView);
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
        expect((highlighted) != null).to.equal(true);
        expect(highlighted.getAttribute('role')).to.equal('cell');
        const action = highlighted.querySelector('[part="cell-highlight-action"]') as HTMLButtonElement;
        expect(action !== null).to.be.true;
        expect(action.getAttribute('aria-label')).to.equal('Highlight: Ada — First result');
        const listener = oneEvent(el, 'lr-highlight-activate');
        action.click();
        const event = (await listener) as CustomEvent<{ id: string }>;
        expect(event.detail).to.deep.equal({ id: 'h1' });
      } finally {
        restore();
      }
    });

    it('localizes the complete highlighted-cell name with independently ordered value and label placeholders', async () => {
      const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
      el.strings = {
        cellHighlightWithLabel: '{label} ⇐ {value}',
      };
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        el.highlights = [{ id: 'h1', anchor: { kind: 'cell-range', range: 'A2' }, label: 'First result' }];
        await el.updateComplete;
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        const action = list.shadowRoot!.querySelector('[part="cell-highlight-action"]') as HTMLButtonElement;
        expect(action.getAttribute('aria-label')).to.equal('First result ⇐ Ada');
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
        const event = (await listener) as CustomEvent<{ matchCount: number; matchCountExact: boolean; activeIndex: number }>;
        expect(event.detail).to.deep.equal({ query: '', matchCount: 0, matchCountExact: true, activeIndex: -1 });
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
      let detail: { matchCount: number; matchCountExact: boolean } | undefined;
      el.addEventListener('lr-search-change', (event) => { detail = event.detail; });
      expect(await el.search('hit')).to.equal(1_000);
      expect((el as unknown as { searchMatches: unknown[] }).searchMatches).to.have.lengthOf(1_000);
      expect(detail).to.deep.include({ matchCount: 1_000, matchCountExact: false });

      (el as unknown as { fetchState: unknown }).fetchState = {
        kind: 'loaded',
        rows: Array.from({ length: 1_000 }, () => ['hit']),
      };
      expect(await el.search('hit')).to.equal(1_000);
      expect(detail).to.deep.include({ matchCount: 1_000, matchCountExact: true });
    });
  });

  it('does not leak internal virtual-list events through the viewer host', async () => {
    const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
    const restore = fetchText(GRID_CSV);
    try {
      el.src = 'https://example.test/people.csv';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      let leaked = 0;
      for (const name of ['lr-load-more', 'lr-visible-range-changed', 'lr-virtual-scroll']) {
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
      // vertically (the same bug shape already fixed on lr-tab-group). Pin both axes explicitly.
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

it('validates maxHeight before assigning the base custom property', async () => {
  const el = await fixture<LyraCsvViewer>(html`<lr-csv-viewer></lr-csv-viewer>`);
  el.maxHeight = '10rem;position:fixed';
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.style.position).to.equal('');
  expect(base.style.getPropertyValue('--lr-csv-viewer-max-height')).to.equal('');
  el.maxHeight = 'calc(10rem + 2px)';
  await el.updateComplete;
  expect(base.style.getPropertyValue('--lr-csv-viewer-max-height')).to.equal('calc(10rem + 2px)');
});

// -- Document-renderer registry entry ---------------------------------------

it('registers a text/csv renderer that matches .csv files and renders the viewer', async () => {
  const { getDefaultDocumentRendererRegistry } = await import('../document-viewer/registry.js');
  const def = getDefaultDocumentRendererRegistry().get('text/csv');
  expect(def, 'importing csv-viewer.js registers the renderer').to.exist;
  expect(def!.matches!({ name: 'Q3-report.CSV', mimeType: 'text/csv', src: 'https://example.test/a.csv' })).to.be.true;
  expect(def!.matches!({ name: 'notes.txt', mimeType: 'text/plain', src: 'https://example.test/a.txt' })).to.be.false;
  expect(def!.capabilities).to.deep.equal({ anchors: ['cell-range'], search: true, textSelect: false });

  const host = (await fixture(
    html`<div>${def!.render({ name: 'a.csv', mimeType: 'text/csv', src: 'https://example.test/a.csv' })}</div>`,
  )) as HTMLElement;
  const viewer = host.querySelector('lr-csv-viewer') as LyraCsvViewer;
  expect(viewer).to.exist;
  expect(viewer.name).to.equal('a.csv');
  expect(viewer.anchor).to.be.null;
  expect(viewer.highlights).to.deep.equal([]);
});
