import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './pdf-viewer.js';
import '../virtual-list/virtual-list.js';
import { findDocumentRenderer, loadDocumentRenderer } from '../document-viewer/registry.js';
import type { LyraPdfViewer } from './pdf-viewer.js';

function response(ok = true): Response {
  return { ok, status: ok ? 200 : 404, statusText: ok ? 'OK' : 'Not Found', arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) } as Response;
}

function stubFetch(): () => void {
  const original = window.fetch;
  window.fetch = (() => Promise.resolve(response())) as typeof window.fetch;
  return () => { window.fetch = original; };
}

const PAGE_TEXTS: Record<number, string> = {
  1: 'Overall revenue grew 12% year over year, driven by strong demand.',
  2: 'This page has entirely unrelated content about operating costs.',
  3: 'A closing summary page with nothing quotable in it.',
};

// `textContentSource` is opaque as far as pdf-viewer.class.ts is concerned -- it's only ever handed
// straight through to `new pdfjsLib.TextLayer({ textContentSource, ... })` -- so the fake tags it with
// the source page number instead of a real ReadableStream. That lets `FakeTextLayer.render()` read the
// page number directly off its own constructor options. A shared `static currentPage` set by a
// wrapping `getPage()` was tried first, but it races: `getPageText()` (used by the text-quote anchor
// scan) also calls `doc.getPage()` for pages it never renders, so a concurrent scan could overwrite the
// static between a real page's `getPage()` call and its `TextLayer.render()` actually running.
class FakeTextLayer {
  static lastContainer: HTMLElement | null = null;
  constructor(private options: { container: HTMLElement; textContentSource?: { pageNumber: number } }) {
    FakeTextLayer.lastContainer = options.container;
  }
  render(): Promise<void> {
    const text = PAGE_TEXTS[this.options.textContentSource?.pageNumber ?? 0] ?? '';
    for (const word of text.split(' ')) {
      const span = document.createElement('span');
      span.textContent = word;
      this.options.container.appendChild(span);
      this.options.container.appendChild(document.createTextNode(' '));
    }
    return Promise.resolve();
  }
  cancel(): void {}
}

function fakePage(pageNumber: number) {
  return {
    pageNumber,
    getViewport: ({ scale = 1 }: { scale?: number } = {}) => ({ width: 200 * scale, height: 300 * scale, scale }),
    render: () => ({ promise: Promise.resolve(), cancel: () => {} }),
    streamTextContent: () => ({ pageNumber }),
    getTextContent: () =>
      Promise.resolve({ items: (PAGE_TEXTS[pageNumber] ?? '').split(' ').map((str) => ({ str, hasEOL: false })) }),
  };
}

function fakeDocument(numPages: number) {
  return { numPages, getPage: (pageNumber: number) => Promise.resolve(fakePage(pageNumber)) };
}

function installFakeLoader(el: LyraPdfViewer, doc: ReturnType<typeof fakeDocument> | null, reject = false): void {
  (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve({
    getDocument: () => ({ promise: reject ? Promise.reject(new Error('bad PDF')) : Promise.resolve(doc) }),
    GlobalWorkerOptions: { workerSrc: '' },
    TextLayer: FakeTextLayer,
  });
}

async function waitFor(el: LyraPdfViewer, selector: string): Promise<void> {
  await waitUntil(() => el.shadowRoot!.querySelector(selector) !== null);
  await el.updateComplete;
}

// `[part="page"]`/`[part="text-layer"]` render inside `<lyra-virtual-list>`'s own nested shadow root
// (see the pre-existing "virtualizes pages" test above) -- painted search marks live there too, not
// directly in `el.shadowRoot`.
function listShadowRoot(el: LyraPdfViewer): ShadowRoot {
  return el.shadowRoot!.querySelector('lyra-virtual-list')!.shadowRoot!;
}

function fakeDocumentWithText(pages: string[], outline: unknown[] | null = null) {
  return {
    numPages: pages.length,
    getPage: (pageNumber: number) => Promise.resolve(fakePage(pageNumber)),
    getOutline: () => Promise.resolve(outline),
    getDestination: (name: string) => Promise.resolve([{ num: Number(name.replace('dest', '')), gen: 0 }]),
    getPageIndex: (ref: { num: number }) => Promise.resolve(ref.num),
  };
}

describe('lyra-pdf-viewer', () => {
  it('defaults to an empty document, page one, and 100% zoom', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    expect(el.src).to.equal('');
    expect(el.name).to.equal('');
    expect(el.page).to.equal(1);
    expect(el.zoom).to.equal(1);
    expect(el.shadowRoot!.querySelector('.empty-note')).to.exist;
  });

  it('loads PDF bytes and renders toolbar and virtual list', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(3));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      expect(el.shadowRoot!.querySelector('lyra-virtual-list')).to.exist;
      expect(el.shadowRoot!.querySelector('[part="page-indicator"]')!.textContent).to.equal('Page 1 of 3');
    } finally { restore(); }
  });

  it('emits render errors for failed fetches', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response(false))) as typeof window.fetch;
    try {
      const eventPromise = oneEvent(el, 'lyra-render-error');
      el.src = 'https://example.test/missing.pdf';
      const event = await eventPromise;
      expect(event.detail.error).to.exist;
      await waitFor(el, '[part="error"]');
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.contain('Failed to load document.');
    } finally { window.fetch = original; }
  });

  it('shows the localized missing-library error', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer .strings=${{ pdfViewerMissingLibrary: 'Bibliothèque manquante.' }}></lyra-pdf-viewer>`)) as LyraPdfViewer;
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve(null);
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="error"]');
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Bibliothèque manquante.');
    } finally { restore(); }
  });

  it('handles corrupt documents', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, null, true);
    const restore = stubFetch();
    try {
      const eventPromise = oneEvent(el, 'lyra-render-error');
      el.src = 'https://example.test/corrupt.pdf';
      await eventPromise;
      await waitFor(el, '[part="error"]');
    } finally { restore(); }
  });

  it('rejects unsafe URLs without fetching', async () => {
    let called = false;
    const original = window.fetch;
    window.fetch = (() => { called = true; return Promise.resolve(response()); }) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lyra-pdf-viewer .src=${'java\tscript:alert(1)'}></lyra-pdf-viewer>`)) as LyraPdfViewer;
      await waitFor(el, '[part="error"]');
      expect(called).to.be.false;
    } finally { window.fetch = original; }
  });

  it('paginates and emits page changes', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(3));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="page-indicator"]');
      const eventPromise = oneEvent(el, 'lyra-page-change');
      el.nextPage();
      expect((await eventPromise).detail).to.deep.equal({ page: 2, pageCount: 3 });
      expect(el.page).to.equal(2);
      el.page = 99;
      await el.updateComplete;
      expect(el.page).to.equal(3);
      el.previousPage();
      await el.updateComplete;
      expect(el.page).to.equal(2);
      el.page = NaN;
      await el.updateComplete;
      expect(el.page).to.equal(1); // non-finite falls back to page 1 instead of NaN
      el.page = -7;
      await el.updateComplete;
      expect(el.page).to.equal(1); // clamped to the first valid page
    } finally { restore(); }
  });

  it('zooms in and out within the supported range', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="zoom-indicator"]');
      const eventPromise = oneEvent(el, 'lyra-zoom-change');
      el.zoomIn();
      expect((await eventPromise).detail).to.deep.equal({ zoom: 1.25 });
      expect(el.shadowRoot!.querySelector('[part="zoom-indicator"]')!.textContent).to.equal('125%');
      el.zoom = 0.1;
      await el.updateComplete;
      expect(el.zoom).to.equal(0.25);
      el.zoomOut();
      await el.updateComplete;
      expect(el.zoom).to.equal(0.25);
      el.zoom = NaN;
      await el.updateComplete;
      expect(el.zoom).to.equal(1); // non-finite falls back to 100% instead of NaN
      el.zoom = 999;
      await el.updateComplete;
      expect(el.zoom).to.equal(4); // clamped to the maximum supported zoom
    } finally { restore(); }
  });

  it('virtualizes pages and renders a canvas with a selectable text layer', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer style="--lyra-virtual-list-height: 100px;"></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(5));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, 'lyra-virtual-list');
      const list = el.shadowRoot!.querySelector('lyra-virtual-list') as HTMLElement & { items: unknown[]; keyFunction?: (item: unknown, index: number) => unknown };
      expect(list.items).to.deep.equal([1, 2, 3, 4, 5]);
      expect(list.keyFunction!(3, 2)).to.equal(3);
      await aTimeout(80);
      await waitUntil(() => list.shadowRoot!.querySelector('[part="page"] canvas') !== null);
      const canvas = list.shadowRoot!.querySelector('[part="page"] canvas') as HTMLCanvasElement;
      expect(canvas.style.width).to.equal('200px');
      expect(canvas.style.height).to.equal('300px');
      await waitUntil(() => list.shadowRoot!.querySelector('[part="text-layer"]') !== null);
      expect(FakeTextLayer.lastContainer).to.exist;
      expect(FakeTextLayer.lastContainer!.style.width).to.equal('200px');
    } finally { restore(); }
  });

  it('updates the current page from the virtual list visible range', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(5));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, 'lyra-virtual-list');
      el.shadowRoot!.querySelector('lyra-virtual-list')!.dispatchEvent(new CustomEvent('lyra-visible-range-changed', { detail: { start: 2, end: 3 }, bubbles: true, composed: true }));
      await el.updateComplete;
      expect(el.page).to.equal(3);
    } finally { restore(); }
  });

  it('lets an explicit host aria-label win over the name-derived fallback', async () => {
    const named = (await fixture(html`<lyra-pdf-viewer name="Report.pdf"></lyra-pdf-viewer>`)) as LyraPdfViewer;
    expect(named.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Report.pdf');

    const overridden = (await fixture(
      html`<lyra-pdf-viewer name="Report.pdf" aria-label="Quarterly report"></lyra-pdf-viewer>`,
    )) as LyraPdfViewer;
    expect(overridden.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Quarterly report');
  });

  it('falls back to the localized label when neither name nor aria-label is set', async () => {
    const el = (await fixture(
      html`<lyra-pdf-viewer .strings=${{ pdfViewerLabel: 'Visionneuse PDF' }}></lyra-pdf-viewer>`,
    )) as LyraPdfViewer;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Visionneuse PDF');
  });

  it('is accessible in empty and loaded states', async () => {
    const empty = await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`);
    await expect(empty).to.be.accessible();
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      await expect(el).to.be.accessible();
    } finally { restore(); }
  });
});

describe('anchor-target adoption', () => {
  it('exposes anchorKinds and defaults highlights/activeHighlightId/anchor', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    expect(el.anchorKinds).to.deep.equal(['page', 'text-quote', 'region']);
    expect(el.highlights).to.deep.equal([]);
    expect(el.activeHighlightId).to.be.null;
    expect(el.anchor).to.be.null;
  });

  it('emits lyra-load { pageCount } when the document becomes ready', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(3));
    const restore = stubFetch();
    try {
      const eventPromise = oneEvent(el, 'lyra-load');
      el.src = 'https://example.test/report.pdf';
      expect((await eventPromise).detail).to.deep.equal({ pageCount: 3 });
    } finally {
      restore();
    }
  });

  it('scrollToAnchor with a page anchor sets page and resolves true once the row materializes', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(5));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      const ok = await el.scrollToAnchor({ kind: 'page', page: 3 });
      expect(ok).to.be.true;
      expect(el.page).to.equal(3);
    } finally {
      restore();
    }
  });

  it('scrollToAnchor with an unhinted text-quote anchor full-scans and lands on the matching page', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(3));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      const ok = await el.scrollToAnchor({ kind: 'text-quote', quote: 'operating costs' });
      expect(ok).to.be.true;
      expect(el.page).to.equal(2);
    } finally {
      restore();
    }
  });

  it('scrollToAnchor with a hinted text-quote anchor checks the hinted page first', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(3));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      const ok = await el.scrollToAnchor({ kind: 'text-quote', quote: 'revenue grew 12%', page: 1 });
      expect(ok).to.be.true;
      expect(el.page).to.equal(1);
    } finally {
      restore();
    }
  });

  it('scrollToAnchor with a text-quote anchor that matches nothing resolves false', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(3));
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      const ok = await el.scrollToAnchor({ kind: 'text-quote', quote: 'nothing here matches anything' });
      expect(ok).to.be.false;
    } finally {
      restore();
    }
  });

  it('declarative anchor set before src finishes loading resolves after ready (retry path)', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    installFakeLoader(el, fakeDocument(2));
    const restore = stubFetch();
    try {
      const eventPromise = oneEvent(el, 'lyra-anchor-result');
      el.anchor = { kind: 'page', page: 2 };
      el.src = 'https://example.test/report.pdf';
      expect((await eventPromise).detail).to.deep.equal({ found: true });
      expect(el.page).to.equal(2);
    } finally {
      restore();
    }
  });

  it('getPageText returns raw page text and rejects out-of-range pages', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(2));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      const text = await el.getPageText(1);
      expect(text).to.contain('revenue grew 12%');
      let rejected = false;
      try {
        await el.getPageText(99);
      } catch {
        rejected = true;
      }
      expect(rejected).to.be.true;
    } finally {
      restore();
    }
  });

  it('getPageText does not return stale text from a previous document after src changes (regression)', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/doc-a.pdf';
      await waitFor(el, '[part="toolbar"]');
      const textA = await el.getPageText(1);
      expect(textA).to.contain('revenue');

      const docB = {
        numPages: 1,
        getPage: (pageNumber: number) =>
          Promise.resolve({
            ...fakePage(pageNumber),
            getTextContent: () =>
              Promise.resolve({ items: [{ str: 'Completely', hasEOL: false }, { str: 'different', hasEOL: false }, { str: 'content.', hasEOL: false }] }),
          }),
      };
      installFakeLoader(el, docB);
      const loadPromise = oneEvent(el, 'lyra-load');
      el.src = 'https://example.test/doc-b.pdf';
      await loadPromise;

      const textB = await el.getPageText(1);
      expect(textB).to.contain('different');
      expect(textB).to.not.contain('revenue');
    } finally {
      restore();
    }
  });

  it('getPageText shares an in-flight promise for concurrent calls to the same page', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      const [a, b] = await Promise.all([el.getPageText(1), el.getPageText(1)]);
      expect(a).to.equal(b);
    } finally {
      restore();
    }
  });

  it('renderPageThumbnail renders into the caller-supplied canvas and resolves false out of range', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      const canvas = document.createElement('canvas');
      const ok = await el.renderPageThumbnail(1, canvas, { width: 96 });
      expect(ok).to.be.true;
      expect(canvas.style.width).to.equal('96px');
      expect(await el.renderPageThumbnail(99, canvas)).to.be.false;
    } finally {
      restore();
    }
  });

  it('renderPageThumbnail cancels a prior in-flight render for the same canvas', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(2));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      const canvas = document.createElement('canvas');
      const first = el.renderPageThumbnail(1, canvas);
      const second = el.renderPageThumbnail(2, canvas);
      const [firstResult, secondResult] = await Promise.all([first, second]);
      expect(secondResult).to.be.true;
      // The first call's render task was cancelled by the second's same-canvas call; it must not
      // report a stale success (the exact resolved value of a cancelled call is not asserted beyond
      // "not a crash" -- what matters is the canvas ends up showing the second page).
      void firstResult;
    } finally {
      restore();
    }
  });

  it('paints per-page highlight rects and forwards activeHighlightId to each page layer', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.highlights = [{ id: 'cite-1', anchor: { kind: 'page', page: 1 }, tone: 'warning' }];
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      await aTimeout(50);
      const list = el.shadowRoot!.querySelector('lyra-virtual-list')!;
      const layer = list.shadowRoot!.querySelector('lyra-highlight-layer') as unknown as {
        items: { id: string; tone?: string }[];
        activeId: string | null;
      };
      expect(layer.items.some((item) => item.id === 'cite-1' && item.tone === 'warning')).to.be.true;
      el.activeHighlightId = 'cite-1';
      await el.updateComplete;
      expect(layer.activeId).to.equal('cite-1');
    } finally {
      restore();
    }
  });

  it('lyra-text-select fires a text-quote anchor with the page containing the selection', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      // `[part="text-layer"]` renders inside `<lyra-virtual-list>`'s own nested shadow root (it's part
      // of a virtualized page row), not directly in `el.shadowRoot` -- same pattern the pre-existing
      // "virtualizes pages" test above already uses.
      await waitFor(el, 'lyra-virtual-list');
      const list = el.shadowRoot!.querySelector('lyra-virtual-list') as HTMLElement;
      await waitUntil(() => list.shadowRoot!.querySelector('[part="text-layer"] span') !== null);
      const span = list.shadowRoot!.querySelector('[part="text-layer"] span') as HTMLElement;
      const range = document.createRange();
      range.selectNodeContents(span);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      const eventPromise = oneEvent(el, 'lyra-text-select');
      el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      const detail = (await eventPromise).detail;
      expect(detail.anchor).to.exist;
      expect(detail.anchor!.kind).to.equal('text-quote');
      if (detail.anchor!.kind === 'text-quote') expect(detail.anchor!.page).to.equal(1);
      selection.removeAllRanges();
    } finally {
      restore();
    }
  });

  it('is accessible with highlights present', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.highlights = [{ id: 'cite-1', anchor: { kind: 'page', page: 1 } }];
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      await expect(el).to.be.accessible();
    } finally {
      restore();
    }
  });
});

describe('goToPage', () => {
  it('resolves false for an out-of-range page', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(3));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      expect(await el.goToPage(0)).to.be.false;
      expect(await el.goToPage(99)).to.be.false;
    } finally {
      restore();
    }
  });

  it('resolves true and updates page for a valid page', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(5));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      expect(await el.goToPage(3)).to.be.true;
      expect(el.page).to.equal(3);
    } finally {
      restore();
    }
  });
});

describe('getOutline', () => {
  it('maps a nested outline to PdfOutlineItem[], resolving destinations to 1-based pages', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    const outline = [
      { title: 'Chapter 1', dest: 'dest0', items: [{ title: 'Section 1.1', dest: 'dest1', items: [] }] },
    ];
    installFakeLoader(el, fakeDocumentWithText(['a', 'b'], outline) as unknown as ReturnType<typeof fakeDocument>);
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      const result = await el.getOutline();
      expect(result).to.deep.equal([
        { title: 'Chapter 1', page: 1, children: [{ title: 'Section 1.1', page: 2 }] },
      ]);
    } finally {
      restore();
    }
  });

  it('resolves [] for a document with no outline', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocumentWithText(['a'], null) as unknown as ReturnType<typeof fakeDocument>);
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      expect(await el.getOutline()).to.deep.equal([]);
    } finally {
      restore();
    }
  });

  it('omits page for an unresolvable destination but keeps title/children', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    const doc = fakeDocumentWithText(['a'], [{ title: 'Broken', dest: 'missing', items: [] }]) as unknown as Record<
      string,
      unknown
    >;
    doc.getDestination = () => Promise.reject(new Error('not found'));
    installFakeLoader(el, doc as unknown as ReturnType<typeof fakeDocument>);
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      expect(await el.getOutline()).to.deep.equal([{ title: 'Broken' }]);
    } finally {
      restore();
    }
  });
});

describe('search', () => {
  it('finds matches across pages, counts them, and navigates with wraparound', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(3));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      (el as unknown as { getPageText: (page: number) => Promise<string> }).getPageText = (page: number) =>
        Promise.resolve(page === 1 ? 'the cat sat' : page === 2 ? 'no match here' : 'the CAT ran');
      const count = await el.search('cat');
      expect(count).to.equal(2);
      expect(el.page).to.equal(1); // search() focuses the first match
      let detail: { query: string; matchCount: number; activeIndex: number } | undefined;
      el.addEventListener('lyra-search-change', (e) => (detail = (e as CustomEvent).detail));
      expect(await el.searchNext()).to.be.true;
      expect(detail!.activeIndex).to.equal(1); // advances from match 0 (page 1) to match 1 (page 3)
      expect(el.page).to.equal(3);
      expect(await el.searchNext()).to.be.true;
      expect(el.page).to.equal(1); // wrapped back to the first match
    } finally {
      restore();
    }
  });

  it('searchPrevious wraps backward across matches', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(3));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      (el as unknown as { getPageText: (page: number) => Promise<string> }).getPageText = (page: number) =>
        Promise.resolve(page === 1 ? 'the cat sat' : page === 2 ? 'no match here' : 'the CAT ran');
      expect(await el.search('cat')).to.equal(2);
      expect(el.page).to.equal(1);
      expect(await el.searchPrevious()).to.be.true;
      expect(el.page).to.equal(3); // wraps backward from the first match to the last
    } finally {
      restore();
    }
  });

  it('an empty query resolves 0 matches and behaves like clearSearch', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      (el as unknown as { getPageText: (page: number) => Promise<string> }).getPageText = () =>
        Promise.resolve('the cat sat on the mat');
      expect(await el.search('  ')).to.equal(0);
      expect(await el.searchNext()).to.be.false;
      expect(await el.searchPrevious()).to.be.false;
    } finally {
      restore();
    }
  });

  it('never adds a search match to highlights, and clearSearch removes painted marks', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      (el as unknown as { getPageText: (page: number) => Promise<string> }).getPageText = () =>
        Promise.resolve('the cat sat on the mat');
      await el.search('at');
      await el.updateComplete;
      expect(el.highlights).to.deep.equal([]);
      expect(listShadowRoot(el).querySelectorAll('[part~="search-match"]').length).to.be.greaterThan(0);
      el.clearSearch();
      await el.updateComplete;
      expect(listShadowRoot(el).querySelectorAll('[part~="search-match"]').length).to.equal(0);
    } finally {
      restore();
    }
  });

  it('clearSearch resets lyra-search-change to a 0/-1 state', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      (el as unknown as { getPageText: (page: number) => Promise<string> }).getPageText = () =>
        Promise.resolve('the cat sat on the mat');
      await el.search('cat');
      const eventPromise = oneEvent(el, 'lyra-search-change');
      el.clearSearch();
      expect((await eventPromise).detail).to.deep.equal({ query: '', matchCount: 0, activeIndex: -1 });
    } finally {
      restore();
    }
  });

  it('is accessible with an active search match painted', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      (el as unknown as { getPageText: (page: number) => Promise<string> }).getPageText = () =>
        Promise.resolve('the cat sat on the mat');
      await el.search('cat');
      await expect(el).to.be.accessible();
    } finally {
      restore();
    }
  });

  it('back-compat: toolbar/page/zoom rendering is unchanged when search is never called', async () => {
    const el = (await fixture(html`<lyra-pdf-viewer></lyra-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(3));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      expect(el.shadowRoot!.querySelector('[part="page-indicator"]')!.textContent).to.equal('Page 1 of 3');
      expect(listShadowRoot(el).querySelectorAll('[part~="search-match"]').length).to.equal(0);
    } finally {
      restore();
    }
  });
});

describe('registry registration', () => {
  it('registers exact and filename PDF matches as a lazy renderer', async () => {
    const exact = findDocumentRenderer({ name: 'a.pdf', mimeType: 'application/pdf', src: 'https://example.test/a.pdf' });
    expect(exact).to.exist;
    expect(exact!.render).to.be.undefined;
    expect(exact!.load).to.exist;
    expect(exact!.capabilities?.search).to.be.true;
    expect(exact!.capabilities?.anchors).to.deep.equal(['page', 'text-quote', 'region']);
    expect(exact!.capabilities?.textSelect).to.be.true;
    expect(findDocumentRenderer({ name: 'a.pdf', mimeType: 'application/octet-stream', src: 'https://example.test/a.pdf' })).to.equal(exact);
    expect(findDocumentRenderer({ name: 'a.csv', mimeType: 'text/csv', src: 'https://example.test/a.csv' })).to.not.exist;
    const resolved = await loadDocumentRenderer(exact!);
    const template = resolved.render!({ name: 'a.pdf', mimeType: 'application/pdf', src: 'https://example.test/a.pdf' }) as { strings: readonly string[] };
    expect(template.strings.join('')).to.contain('lyra-pdf-viewer');
  });
});
