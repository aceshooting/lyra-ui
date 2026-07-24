import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './pdf-viewer.js';
import '../../layout/virtual-list/virtual-list.js';
import { findDocumentRenderer, loadDocumentRenderer } from '../document-viewer/registry.js';
import type { LyraPdfViewer } from './pdf-viewer.js';
import { styles } from './pdf-viewer.styles.js';

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

// `[part="page"]`/`[part="text-layer"]` render inside `<lr-virtual-list>`'s own nested shadow root
// (see the pre-existing "virtualizes pages" test above) -- painted search marks live there too, not
// directly in `el.shadowRoot`.
function listShadowRoot(el: LyraPdfViewer): ShadowRoot {
  return el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!;
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

/** A promise plus its externally-callable resolve/reject, for precisely timing a stale in-flight
 *  `load()` against a later superseding `src` change. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Waits two animation frames -- enough for `<lr-virtual-list>`'s own rAF-coalesced scroll handler
 *  to have run (mirrors the identical helper in virtual-list.test.ts). */
async function nextFrame(): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

describe('lr-pdf-viewer', () => {
  it('defaults to an empty document, page one, and 100% zoom', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    expect(el.src).to.equal('');
    expect(el.name).to.equal('');
    expect(el.page).to.equal(1);
    expect(el.zoom).to.equal(1);
    expect(el.shadowRoot!.querySelector('.empty-note')).to.exist;
  });

  it('loads PDF bytes and renders toolbar and virtual list', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(3));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      expect(el.shadowRoot!.querySelector('lr-virtual-list')).to.exist;
      expect(el.shadowRoot!.querySelector('[part="page-indicator"]')!.textContent).to.equal('Page 1 of 3');
    } finally { restore(); }
  });

  it('emits render errors for failed fetches', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response(false))) as typeof window.fetch;
    try {
      const eventPromise = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/missing.pdf';
      const event = await eventPromise;
      expect(event.detail.error).to.exist;
      await waitFor(el, '[part="error"]');
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.contain('Failed to load document.');
    } finally { window.fetch = original; }
  });

  it('shows the localized missing-library error', async () => {
    const el = (await fixture(html`<lr-pdf-viewer .strings=${{ pdfViewerMissingLibrary: 'Bibliothèque manquante.' }}></lr-pdf-viewer>`)) as LyraPdfViewer;
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve(null);
    const restore = stubFetch();
    try {
      const eventPromise = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/report.pdf';
      expect((await eventPromise).detail.error).to.exist;
      await waitFor(el, '[part="error"]');
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Bibliothèque manquante.');
    } finally { restore(); }
  });

  it('handles corrupt documents', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, null, true);
    const restore = stubFetch();
    try {
      const eventPromise = oneEvent(el, 'lr-render-error');
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
      const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
      const eventPromise = oneEvent(el, 'lr-render-error');
      el.src = 'java\tscript:alert(1)';
      expect((await eventPromise).detail.error).to.exist;
      await waitFor(el, '[part="error"]');
      expect(called).to.be.false;
    } finally { window.fetch = original; }
  });

  it('rejects a malformed or excessive peer page count before materializing page items', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    let destroyCalls = 0;
    installFakeLoader(el, {
      ...fakeDocument(100_001),
      destroy: () => { destroyCalls++; },
    } as never);
    const restore = stubFetch();
    try {
      const eventPromise = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/pathological.pdf';
      expect((await eventPromise).detail.error).to.exist;
      await waitFor(el, '[part="error"]');
      expect(destroyCalls).to.equal(1);
      expect(el.shadowRoot!.querySelector('lr-virtual-list') === null).to.be.true;
    } finally {
      restore();
    }
  });

  it('paginates and emits page changes', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(3));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="page-indicator"]');
      const eventPromise = oneEvent(el, 'lr-page-change');
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
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="zoom-indicator"]');
      const eventPromise = oneEvent(el, 'lr-zoom-change');
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
    const el = (await fixture(html`<lr-pdf-viewer style="--lr-virtual-list-height: 100px;"></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(5));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, 'lr-virtual-list');
      const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { items: unknown[]; keyFunction?: (item: unknown, index: number) => unknown };
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
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(5));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, 'lr-virtual-list');
      let leaked = 0;
      el.addEventListener('lr-visible-range-changed', () => leaked++);
      const pageChange = oneEvent(el, 'lr-page-change');
      el.shadowRoot!.querySelector('lr-virtual-list')!.dispatchEvent(new CustomEvent('lr-visible-range-changed', { detail: { start: 2, end: 3 }, bubbles: true, composed: true }));
      expect((await pageChange).detail).to.deep.equal({ page: 3, pageCount: 5 });
      expect(el.page).to.equal(3);
      expect(leaked).to.equal(0);
    } finally { restore(); }
  });

  it('lets an explicit host aria-label win over the name-derived fallback', async () => {
    const named = (await fixture(html`<lr-pdf-viewer name="Report.pdf"></lr-pdf-viewer>`)) as LyraPdfViewer;
    expect(named.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Report.pdf');

    const overridden = (await fixture(
      html`<lr-pdf-viewer name="Report.pdf" aria-label="Quarterly report"></lr-pdf-viewer>`,
    )) as LyraPdfViewer;
    expect(overridden.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Quarterly report');
  });

  it('falls back to the localized label when neither name nor aria-label is set', async () => {
    const el = (await fixture(
      html`<lr-pdf-viewer .strings=${{ pdfViewerLabel: 'Visionneuse PDF' }}></lr-pdf-viewer>`,
    )) as LyraPdfViewer;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Visionneuse PDF');
  });

  it('is accessible in empty and loaded states', async () => {
    const empty = await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`);
    await expect(empty).to.be.accessible();
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      await expect(el).to.be.accessible();
    } finally { restore(); }
  });

  it('emits lr-render-error when a page canvas render task itself rejects', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    const boom = new Error('canvas render boom');
    const doc = {
      numPages: 1,
      getPage: (pageNumber: number) => Promise.resolve({ ...fakePage(pageNumber), render: () => ({ promise: Promise.reject(boom), cancel: () => {} }) }),
    };
    installFakeLoader(el, doc);
    const restore = stubFetch();
    try {
      const eventPromise = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/report.pdf';
      expect((await eventPromise).detail.error).to.equal(boom);
    } finally { restore(); }
  });

  it('emits lr-render-error when the text layer render itself rejects', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    const boom = new Error('text layer boom');
    class FailingTextLayer {
      constructor(private options: { container: HTMLElement }) {}
      render(): Promise<void> { return Promise.reject(boom); }
      cancel(): void {}
    }
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve({
      getDocument: () => ({ promise: Promise.resolve(fakeDocument(1)) }),
      GlobalWorkerOptions: { workerSrc: '' },
      TextLayer: FailingTextLayer,
    });
    const restore = stubFetch();
    try {
      const eventPromise = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/report.pdf';
      expect((await eventPromise).detail.error).to.equal(boom);
    } finally { restore(); }
  });

  it('setting highlights before any page has mounted is a no-op (empty pageCanvases)', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    el.highlights = [{ id: 'cite-1', anchor: { kind: 'page', page: 1 } }];
    await el.updateComplete;
    expect(el.highlights).to.have.length(1);
    expect(el.shadowRoot!.querySelector('.empty-note')).to.exist;
  });

  it('changing highlights after pages are already mounted repaints every mounted page', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      await aTimeout(50); // page 1's canvas is already mounted (pageCanvases is non-empty)
      el.highlights = [{ id: 'cite-1', anchor: { kind: 'page', page: 1 } }];
      await el.updateComplete;
      await aTimeout(20);
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      const layer = list.shadowRoot!.querySelector('lr-highlight-layer') as unknown as { items: { id: string }[] };
      expect(layer.items.some((item) => item.id === 'cite-1')).to.be.true;
    } finally {
      restore();
    }
  });

  it('shows the resource-too-large error for a response whose Content-Length exceeds the limit', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const original = window.fetch;
    window.fetch = (() => Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: (name: string) => (name === 'content-length' ? String(30 * 1024 * 1024) : null) },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    } as unknown as Response)) as typeof window.fetch;
    try {
      const eventPromise = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/huge.pdf';
      await eventPromise;
      await waitFor(el, '[part="error"]');
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('This document is too large to preview.');
    } finally { window.fetch = original; }
  });

  it('loads without an abort signal when AbortController is unavailable', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(2));
    const restore = stubFetch();
    const originalAbortController = window.AbortController;
    (window as unknown as { AbortController?: unknown }).AbortController = undefined;
    try {
      const eventPromise = oneEvent(el, 'lr-load');
      el.src = 'https://example.test/report.pdf';
      expect((await eventPromise).detail).to.deep.equal({ pageCount: 2 });
    } finally {
      window.AbortController = originalAbortController;
      restore();
    }
  });

  it('disconnecting while a page-render and a thumbnail-render task are in-flight cancels both', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    const cancels: string[] = [];
    const doc = {
      numPages: 1,
      getPage: (pageNumber: number) =>
        Promise.resolve({ ...fakePage(pageNumber), render: () => ({ promise: new Promise<void>(() => {}), cancel: () => cancels.push('cancel') }) }),
    };
    installFakeLoader(el, doc);
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      await aTimeout(30); // let the page-1 canvas mount and start its (never-resolving) render task
      const canvas = document.createElement('canvas');
      void el.renderPageThumbnail(1, canvas); // a second, separately-tracked in-flight render task
      await aTimeout(30);
      if (document.body.contains(el)) el.remove();
      expect(cancels.length).to.be.greaterThan(1); // both the page-render task and the thumbnail task were cancelled
    } finally { restore(); }
  });

  it('onPageClick activates a highlight whose painted rect contains the click point', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.highlights = [{ id: 'cite-1', anchor: { kind: 'page', page: 1 } }];
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      await aTimeout(50);
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      const canvas = list.shadowRoot!.querySelector('[part="page"] canvas') as HTMLCanvasElement;
      const pageDiv = list.shadowRoot!.querySelector('[part="page"]') as HTMLElement;
      const rect = canvas.getBoundingClientRect();
      const eventPromise = oneEvent(el, 'lr-highlight-activate');
      pageDiv.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
      expect((await eventPromise).detail).to.deep.equal({ id: 'cite-1' });
    } finally { restore(); }
  });

  it('onPageClick ignores a click while a text selection is active', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.highlights = [{ id: 'cite-1', anchor: { kind: 'page', page: 1 } }];
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      await aTimeout(50);
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      const canvas = list.shadowRoot!.querySelector('[part="page"] canvas') as HTMLCanvasElement;
      const pageDiv = list.shadowRoot!.querySelector('[part="page"]') as HTMLElement;
      const span = list.shadowRoot!.querySelector('[part="text-layer"] span');
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      if (span) {
        const range = document.createRange();
        range.selectNodeContents(span);
        selection.addRange(range);
      }
      let activated = false;
      el.addEventListener('lr-highlight-activate', () => { activated = true; });
      const rect = canvas.getBoundingClientRect();
      pageDiv.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
      await aTimeout(10);
      expect(activated).to.be.false;
      selection.removeAllRanges();
    } finally { restore(); }
  });

  it('onPageClick is a no-op when the page has no painted highlights', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      await aTimeout(50);
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      const canvas = list.shadowRoot!.querySelector('[part="page"] canvas') as HTMLCanvasElement;
      const pageDiv = list.shadowRoot!.querySelector('[part="page"]') as HTMLElement;
      let activated = false;
      el.addEventListener('lr-highlight-activate', () => { activated = true; });
      const rect = canvas.getBoundingClientRect();
      expect(() => pageDiv.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }))).to.not.throw();
      await aTimeout(10);
      expect(activated).to.be.false;
    } finally { restore(); }
  });

  it('onPageClick ignores a click outside every highlight rect', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.highlights = [{ id: 'cite-1', anchor: { kind: 'region', page: 1, rect: { x: 0, y: 0, width: 10, height: 10 } } }];
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      await aTimeout(50);
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      const canvas = list.shadowRoot!.querySelector('[part="page"] canvas') as HTMLCanvasElement;
      const pageDiv = list.shadowRoot!.querySelector('[part="page"]') as HTMLElement;
      let activated = false;
      el.addEventListener('lr-highlight-activate', () => { activated = true; });
      const rect = canvas.getBoundingClientRect();
      // Bottom-right corner of the canvas, well outside the highlight's 10%x10% region near the origin.
      pageDiv.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rect.right - 2, clientY: rect.bottom - 2 }));
      await aTimeout(10);
      expect(activated).to.be.false;
    } finally { restore(); }
  });
});

describe('anchor-target adoption', () => {
  it('exposes anchorKinds and defaults highlights/activeHighlightId/anchor', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    expect(el.anchorKinds).to.deep.equal(['page', 'text-quote', 'region']);
    expect(el.highlights).to.deep.equal([]);
    expect(el.activeHighlightId).to.be.null;
    expect(el.anchor).to.be.null;
  });

  it('emits lr-load { pageCount } when the document becomes ready', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(3));
    const restore = stubFetch();
    try {
      const eventPromise = oneEvent(el, 'lr-load');
      el.src = 'https://example.test/report.pdf';
      expect((await eventPromise).detail).to.deep.equal({ pageCount: 3 });
    } finally {
      restore();
    }
  });

  it('scrollToAnchor with a page anchor sets page and resolves true once the row materializes', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
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
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
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
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
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
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
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
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    installFakeLoader(el, fakeDocument(2));
    const restore = stubFetch();
    try {
      const eventPromise = oneEvent(el, 'lr-anchor-result');
      el.anchor = { kind: 'page', page: 2 };
      el.src = 'https://example.test/report.pdf';
      expect((await eventPromise).detail).to.deep.equal({ found: true });
      expect(el.page).to.equal(2);
    } finally {
      restore();
    }
  });

  it('scrollToAnchor with a region anchor navigates to the page and scrolls the rect into view', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(3));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      const ok = await el.scrollToAnchor({ kind: 'region', page: 2, rect: { x: 10, y: 20, width: 30, height: 15 } });
      expect(ok).to.be.true;
      expect(el.page).to.equal(2);
    } finally {
      restore();
    }
  });

  it('scrollToAnchor resolves false for an anchor kind pdf-viewer does not handle (applyAnchor default case)', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      const ok = await el.scrollToAnchor({ kind: 'fragment', id: 'introduction' });
      expect(ok).to.be.false;
    } finally {
      restore();
    }
  });

  it('a src change while awaiting the pdf.js library import supersedes the earlier load (stale generation)', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    const restore = stubFetch();
    const lib = deferred<unknown>();
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => lib.promise;
    try {
      el.src = 'https://example.test/first.pdf';
      await aTimeout(20); // let load() reach `await this.loadLibrary()` and suspend there
      installFakeLoader(el, fakeDocument(2));
      const loadPromise = oneEvent(el, 'lr-load');
      el.src = 'https://example.test/second.pdf'; // bumps generation, superseding the first load
      expect((await loadPromise).detail).to.deep.equal({ pageCount: 2 });
      let extraLoadFired = false;
      el.addEventListener('lr-load', () => { extraLoadFired = true; });
      // The stale first load's library import now resolves late; it must bail silently instead of
      // clobbering the second (current) document.
      lib.resolve({ getDocument: () => ({ promise: Promise.resolve(fakeDocument(1)) }), GlobalWorkerOptions: { workerSrc: '' }, TextLayer: FakeTextLayer });
      await aTimeout(20);
      expect(extraLoadFired).to.be.false;
      expect(el.shadowRoot!.querySelector('[part="page-indicator"]')!.textContent).to.equal('Page 1 of 2');
    } finally {
      restore();
    }
  });

  it('a src change while awaiting the pdf document promise supersedes the earlier load (stale generation)', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    const restore = stubFetch();
    const docPromise = deferred<unknown>();
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve({
      getDocument: () => ({ promise: docPromise.promise }),
      GlobalWorkerOptions: { workerSrc: '' },
      TextLayer: FakeTextLayer,
    });
    try {
      el.src = 'https://example.test/first.pdf';
      await aTimeout(20); // let load() reach `await pdfjsLib.getDocument({ data }).promise` and suspend there
      installFakeLoader(el, fakeDocument(3));
      const loadPromise = oneEvent(el, 'lr-load');
      el.src = 'https://example.test/second.pdf'; // bumps generation, superseding the first load
      expect((await loadPromise).detail).to.deep.equal({ pageCount: 3 });
      let extraLoadFired = false;
      el.addEventListener('lr-load', () => { extraLoadFired = true; });
      // The stale first load's document promise now resolves late; it must bail silently instead of
      // clobbering the second (current) document.
      let staleDestroyCalls = 0;
      docPromise.resolve({
        ...fakeDocument(1),
        destroy: () => { staleDestroyCalls++; },
      });
      await aTimeout(20);
      expect(extraLoadFired).to.be.false;
      expect(staleDestroyCalls, 'the superseded PDF worker must be released').to.equal(1);
      expect(el.shadowRoot!.querySelector('[part="page-indicator"]')!.textContent).to.equal('Page 1 of 3');
    } finally {
      restore();
    }
  });

  it('a superseded in-flight load that later rejects does not surface a stale render-error', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    const restore = stubFetch();
    const docPromise = deferred<unknown>();
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve({
      getDocument: () => ({ promise: docPromise.promise }),
      GlobalWorkerOptions: { workerSrc: '' },
      TextLayer: FakeTextLayer,
    });
    try {
      el.src = 'https://example.test/first.pdf';
      await aTimeout(20);
      installFakeLoader(el, fakeDocument(1));
      const loadPromise = oneEvent(el, 'lr-load');
      el.src = 'https://example.test/second.pdf';
      await loadPromise;
      let renderErrorFired = false;
      el.addEventListener('lr-render-error', () => { renderErrorFired = true; });
      docPromise.reject(new Error('stale boom'));
      await aTimeout(20);
      expect(renderErrorFired).to.be.false;
    } finally {
      restore();
    }
  });

  it('getPageText returns raw page text and rejects out-of-range pages', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
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
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
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
      const loadPromise = oneEvent(el, 'lr-load');
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
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
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

  it('getPageText evicts the oldest cached page once the cache exceeds 64 pages (LRU)', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    const getPageCalls: number[] = [];
    const doc = {
      numPages: 70,
      getPage: (pageNumber: number) => {
        getPageCalls.push(pageNumber);
        return Promise.resolve(fakePage(pageNumber));
      },
    };
    installFakeLoader(el, doc);
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      getPageCalls.length = 0; // drop the initial page-1 canvas render's own (unrelated) getPage call
      for (let page = 1; page <= 65; page++) await el.getPageText(page);
      const callsForPage1BeforeRefetch = getPageCalls.filter((n) => n === 1).length;
      // Page 1 was the first of 65 distinct pages cached (limit 64) -- it must have been evicted, so
      // this re-fetch triggers a fresh doc.getPage(1) call instead of hitting the cache.
      await el.getPageText(1);
      expect(getPageCalls.filter((n) => n === 1).length).to.be.greaterThan(callsForPage1BeforeRefetch);
    } finally {
      restore();
    }
  });

  it('renderPageThumbnail renders into the caller-supplied canvas and resolves false out of range', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
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

  it('renderPageThumbnail rejects non-finite, non-positive, and excessive raster widths', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      const canvas = document.createElement('canvas');
      for (const width of [NaN, Infinity, -1, 0, 4096]) {
        expect(await el.renderPageThumbnail(1, canvas, { width }), String(width)).to.be.false;
      }
    } finally {
      restore();
    }
  });

  it('lets only the latest async page lookup start a render on a shared page canvas', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    const doc = fakeDocument(1);
    installFakeLoader(el, doc);
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      const canvas = listShadowRoot(el).querySelector('[part="page-canvas"]') as HTMLCanvasElement;
      const firstPage = deferred<ReturnType<typeof fakePage>>();
      const secondPage = deferred<ReturnType<typeof fakePage>>();
      let calls = 0;
      doc.getPage = () => (++calls === 1 ? firstPage.promise : secondPage.promise);
      const renders = { first: 0, second: 0 };
      const invoke = (el as unknown as {
        renderPage(page: number, target: HTMLCanvasElement): Promise<void>;
      }).renderPage.bind(el);
      const first = invoke(1, canvas);
      const second = invoke(1, canvas);
      secondPage.resolve({
        ...fakePage(1),
        render: () => {
          renders.second++;
          return { promise: Promise.resolve(), cancel: () => {} };
        },
      });
      await second;
      firstPage.resolve({
        ...fakePage(1),
        render: () => {
          renders.first++;
          return { promise: Promise.resolve(), cancel: () => {} };
        },
      });
      await first;
      expect(renders).to.deep.equal({ first: 0, second: 1 });
    } finally {
      restore();
    }
  });

  it('renderPageThumbnail cancels a prior in-flight render for the same canvas', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
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

  it('renderPageThumbnail resolves false when the render task aborts', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    const doc = {
      numPages: 1,
      getPage: (pageNumber: number) =>
        Promise.resolve({ ...fakePage(pageNumber), render: () => ({ promise: Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), cancel: () => {} }) }),
    };
    installFakeLoader(el, doc);
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      const canvas = document.createElement('canvas');
      expect(await el.renderPageThumbnail(1, canvas)).to.be.false;
    } finally {
      restore();
    }
  });

  it('renderPageThumbnail rethrows a non-abort render error', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    const boom = new Error('thumbnail render boom');
    const doc = {
      numPages: 1,
      getPage: (pageNumber: number) =>
        Promise.resolve({ ...fakePage(pageNumber), render: () => ({ promise: Promise.reject(boom), cancel: () => {} }) }),
    };
    installFakeLoader(el, doc);
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      const canvas = document.createElement('canvas');
      let caught: unknown;
      try {
        await el.renderPageThumbnail(1, canvas);
      } catch (error) {
        caught = error;
      }
      expect(caught).to.equal(boom);
    } finally {
      restore();
    }
  });

  it('paints per-page highlight rects and forwards activeHighlightId to each page layer', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.highlights = [{ id: 'cite-1', anchor: { kind: 'page', page: 1 }, tone: 'warning' }];
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      await aTimeout(50);
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      const layer = list.shadowRoot!.querySelector('lr-highlight-layer') as unknown as {
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

  it('a highlight anchored to a different page resolves to no rects for the current page', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.highlights = [
        { id: 'cite-1', anchor: { kind: 'page', page: 1 } },
        { id: 'cite-elsewhere', anchor: { kind: 'page', page: 99 } }, // never matches page 1
      ];
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      await aTimeout(50);
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      const layer = list.shadowRoot!.querySelector('lr-highlight-layer') as unknown as { items: { id: string }[] };
      expect(layer.items.some((item) => item.id === 'cite-1')).to.be.true;
      expect(layer.items.some((item) => item.id === 'cite-elsewhere')).to.be.false;
    } finally {
      restore();
    }
  });

  it('resolves highlight rects for a text-quote anchor against the rendered text layer', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.highlights = [{ id: 'cite-1', anchor: { kind: 'text-quote', quote: 'revenue grew 12%' } }];
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      await aTimeout(80); // let the text layer render so resolveHighlightRectsForPage() has a scope
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      const layer = list.shadowRoot!.querySelector('lr-highlight-layer') as unknown as { items: { id: string; rects: unknown[] }[] };
      const item = layer.items.find((i) => i.id === 'cite-1');
      expect(item).to.exist;
      expect(item!.rects.length).to.be.greaterThan(0);
    } finally {
      restore();
    }
  });

  it('highlightLayerRef sizes a freshly-mounted layer from an already-sized canvas', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      await aTimeout(50); // let renderPage() actually set the real canvas's style.width/height
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      const canvas = list.shadowRoot!.querySelector('[part="page"] canvas') as HTMLCanvasElement;
      expect(canvas.style.width).to.not.equal('');
      // Simulates a fresh <lr-highlight-layer> mount for the same page number arriving after the
      // canvas is already sized (the ref callback is memoized per page number by
      // highlightLayerRef(), so invoking it directly here is the same function the real ref="..."
      // binding on the template would call).
      const refCallback = (el as unknown as { highlightLayerRef: (pageNumber: number) => (element: Element | undefined) => void }).highlightLayerRef(1);
      const freshLayer = document.createElement('lr-highlight-layer') as unknown as HTMLElement;
      refCallback(freshLayer);
      expect(freshLayer.style.width).to.equal(canvas.style.width);
      expect(freshLayer.style.height).to.equal(canvas.style.height);
    } finally {
      restore();
    }
  });

  it('lr-text-select fires a text-quote anchor with the page containing the selection', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      // `[part="text-layer"]` renders inside `<lr-virtual-list>`'s own nested shadow root (it's part
      // of a virtualized page row), not directly in `el.shadowRoot` -- same pattern the pre-existing
      // "virtualizes pages" test above already uses.
      await waitFor(el, 'lr-virtual-list');
      const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement;
      await waitUntil(() => list.shadowRoot!.querySelector('[part="text-layer"] span') !== null);
      const span = list.shadowRoot!.querySelector('[part="text-layer"] span') as HTMLElement;
      const range = document.createRange();
      range.selectNodeContents(span);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      const eventPromise = oneEvent(el, 'lr-text-select');
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

  it('lr-text-select fires with a null anchor when the selection falls outside every page (e.g. the toolbar)', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="page-indicator"]');
      const label = el.shadowRoot!.querySelector('[part="page-indicator"]') as HTMLElement;
      const range = document.createRange();
      range.selectNodeContents(label);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      const eventPromise = oneEvent(el, 'lr-text-select');
      el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      const detail = (await eventPromise).detail;
      expect(detail.anchor).to.be.null;
      expect(detail.text).to.equal('Page 1 of 1');
      selection.removeAllRanges();
    } finally {
      restore();
    }
  });

  it('resolveSelectionRange falls back to shadow-root/global Selection when getComposedRanges is unavailable', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    const originalGetSelection = window.getSelection;
    let listShadowRoot: ShadowRoot | undefined;
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, 'lr-virtual-list');
      const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement;
      await waitUntil(() => list.shadowRoot!.querySelector('[part="text-layer"] span') !== null);
      listShadowRoot = list.shadowRoot!;
      const span = listShadowRoot.querySelector('[part="text-layer"] span') as HTMLElement;
      const range = document.createRange();
      range.selectNodeContents(span);
      // Real Chromium normally supports Selection.getComposedRanges(), exercised by the primary
      // "lr-text-select fires..." test above. Stubbing window.getSelection to omit that method forces
      // resolveSelectionRange() down its shadow-root/global-Selection fallback path -- but Chromium's
      // non-standard ShadowRoot.getSelection() would otherwise still return a (real, but unrelated
      // and empty) Selection for the nested list shadow root, short-circuiting the `??` before it
      // ever reaches our fake global one, so that's stubbed out here too.
      window.getSelection = (() => ({ rangeCount: 1, isCollapsed: false, getRangeAt: () => range })) as unknown as typeof window.getSelection;
      (listShadowRoot as unknown as { getSelection: () => Selection | null }).getSelection = () => null;
      const eventPromise = oneEvent(el, 'lr-text-select');
      el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      const detail = (await eventPromise).detail;
      expect(detail.anchor).to.exist;
      expect(detail.anchor!.kind).to.equal('text-quote');
    } finally {
      window.getSelection = originalGetSelection;
      if (listShadowRoot) delete (listShadowRoot as unknown as { getSelection?: unknown }).getSelection;
      restore();
    }
  });

  it('bindTextSelection tears down a previous binding before installing a new one', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, 'lr-virtual-list');
      const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      const removedTypes: string[] = [];
      const originalRemove = base.removeEventListener.bind(base);
      base.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => {
        removedTypes.push(type);
        originalRemove(type, listener, options);
      }) as typeof base.removeEventListener;
      try {
        // firstUpdated() already bound once; re-invoking directly (the same escape-hatch cast
        // docx-viewer.class.ts / markdown-core.class.ts use internally for this same override) must
        // tear down that earlier binding's listeners (the `this.textSelectionCleanup?.()` non-null
        // branch) instead of stacking a second, duplicate set alongside it.
        (el as unknown as { bindTextSelection: (root: Element) => void }).bindTextSelection(base);
      } finally {
        base.removeEventListener = originalRemove;
      }
      expect(removedTypes).to.include('pointerup');
      expect(removedTypes).to.include('keyup');
    } finally {
      restore();
    }
  });

  it('a selection outside the viewer entirely (crossing no shadow boundary back into it) does not emit lr-text-select', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    const outside = document.createElement('div');
    outside.textContent = 'text entirely outside the pdf viewer';
    document.body.appendChild(outside);
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      const range = document.createRange();
      range.selectNodeContents(outside);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      let fired = false;
      el.addEventListener('lr-text-select', () => { fired = true; });
      el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      await aTimeout(10);
      expect(fired).to.be.false;
      selection.removeAllRanges();
    } finally {
      outside.remove();
      restore();
    }
  });

  it('is accessible with highlights present', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
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
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
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
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
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

  it('waits for a page well outside the initial render window to actually mount (waitForPageMount)', async () => {
    const el = (await fixture(html`<lr-pdf-viewer style="--lr-pdf-viewer-height: 100px;"></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(30));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, 'lr-virtual-list');
      const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & {
        overscan: number;
        scrollToIndex: (index: number, options?: { align?: 'start' | 'end' | 'auto'; behavior?: 'auto' | 'smooth' }) => void;
      };
      list.overscan = 0;
      await nextFrame();
      // A small height + zero overscan keeps the render window narrow -- page 20 is well outside it.
      expect(list.shadowRoot!.querySelectorAll('[part="page"]').length).to.be.lessThan(15);
      const goToPromise = el.goToPage(20);
      await el.updateComplete; // let goToPage() reach `await this.waitForPageMount(20)` and register its listener
      list.scrollToIndex(19, { align: 'start', behavior: 'auto' });
      await nextFrame();
      const ok = await goToPromise;
      expect(ok).to.be.true;
      expect(el.page).to.equal(20);
    } finally {
      restore();
    }
  });

  it('resolves false via the fallback timeout when the target page never mounts at all', async () => {
    const el = (await fixture(html`<lr-pdf-viewer style="--lr-pdf-viewer-height: 100px;"></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(30));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, 'lr-virtual-list');
      const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { overscan: number };
      list.overscan = 0;
      await nextFrame();
      const base = list.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      const originalScrollTo = base.scrollTo.bind(base);
      // Setting `page` also flips `activeId`, which the list would otherwise answer with its own
      // real (asynchronous, physics-driven) scrollActiveIntoView() -- neutralize that so nothing else
      // ever brings page 20 into view or re-fires lr-visible-range-changed during this test, leaving
      // waitForPageMount()'s internal 500ms timeout as the only way this can resolve.
      base.scrollTo = (() => {}) as typeof base.scrollTo;
      try {
        const started = Date.now();
        const ok = await el.goToPage(20);
        expect(ok).to.be.false;
        expect(el.page).to.equal(20);
        expect(Date.now() - started).to.be.greaterThan(400);
      } finally {
        base.scrollTo = originalScrollTo;
      }
    } finally {
      restore();
    }
  });
});

describe('getOutline', () => {
  it('maps a nested outline to PdfOutlineItem[], resolving destinations to 1-based pages', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
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
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
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
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
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
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
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
      el.addEventListener('lr-search-change', (e) => (detail = (e as CustomEvent).detail));
      expect(await el.searchNext()).to.be.true;
      expect(detail!.activeIndex).to.equal(1); // advances from match 0 (page 1) to match 1 (page 3)
      expect(el.page).to.equal(3);
      expect(await el.searchNext()).to.be.true;
      expect(el.page).to.equal(1); // wrapped back to the first match
    } finally {
      restore();
    }
  });

  it('finds a match against real (unoverridden) getPageText, whose raw text trails a normalized space', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      // Deliberately does NOT override getPageText -- loadPageText() appends a trailing ' ' after
      // every item (including the last), so normalizeForSearch()'s raw text here genuinely ends in
      // whitespace, exercising its trailing-space trim branch.
      const count = await el.search('demand');
      expect(count).to.equal(1);
      expect(el.page).to.equal(1);
    } finally {
      restore();
    }
  });

  it('normalizes query whitespace with the same rules as document text', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      (el as unknown as { getPageText: () => Promise<string> }).getPageText =
        () => Promise.resolve('alpha \n\t beta');
      expect(await el.search('alpha    beta')).to.equal(1);
    } finally {
      restore();
    }
  });

  it('preserves contextual Greek case folding and raw paint offsets', async () => {
    const el = (await fixture(html`<lr-pdf-viewer locale="el"></lr-pdf-viewer>`)) as LyraPdfViewer;
    class GreekTextLayer {
      constructor(private options: { container: HTMLElement }) {}
      render(): Promise<void> {
        const span = document.createElement('span');
        span.textContent = 'ΟΣ';
        this.options.container.appendChild(span);
        return Promise.resolve();
      }
      cancel(): void {}
    }
    const page = {
      ...fakePage(1),
      getTextContent: () => Promise.resolve({ items: [{ str: 'ΟΣ', hasEOL: false }] }),
    };
    const doc = { numPages: 1, getPage: () => Promise.resolve(page) };
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve({
      getDocument: () => ({ promise: Promise.resolve(doc) }),
      GlobalWorkerOptions: { workerSrc: '' },
      TextLayer: GreekTextLayer,
    });
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      expect(await el.search('ος')).to.equal(1);
      const mark = listShadowRoot(el).querySelector('mark[part~="search-match"]');
      expect(mark?.textContent).to.equal('ΟΣ');
    } finally {
      restore();
    }
  });

  it('maps locale-fold expansions back to the complete raw grapheme', async () => {
    const el = (await fixture(html`<lr-pdf-viewer locale="en"></lr-pdf-viewer>`)) as LyraPdfViewer;
    class ExpandedTextLayer {
      constructor(private options: { container: HTMLElement }) {}
      render(): Promise<void> {
        const span = document.createElement('span');
        span.textContent = 'İX';
        this.options.container.appendChild(span);
        return Promise.resolve();
      }
      cancel(): void {}
    }
    const page = {
      ...fakePage(1),
      getTextContent: () => Promise.resolve({ items: [{ str: 'İX', hasEOL: false }] }),
    };
    const doc = { numPages: 1, getPage: () => Promise.resolve(page) };
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve({
      getDocument: () => ({ promise: Promise.resolve(doc) }),
      GlobalWorkerOptions: { workerSrc: '' },
      TextLayer: ExpandedTextLayer,
    });
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      expect(await el.search('i\u0307x')).to.equal(1);
      const mark = listShadowRoot(el).querySelector('mark[part~="search-match"]');
      expect(mark?.textContent).to.equal('İX');
    } finally {
      restore();
    }
  });

  it('skips a page whose getPageText rejects and keeps scanning the rest', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(3));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      (el as unknown as { getPageText: (page: number) => Promise<string> }).getPageText = (page: number) =>
        page === 2 ? Promise.reject(new Error('boom')) : Promise.resolve(page === 1 ? 'the cat sat' : 'the CAT ran');
      const count = await el.search('cat');
      expect(count).to.equal(2); // page 2 silently skipped, matches on pages 1 and 3 still found
    } finally {
      restore();
    }
  });

  it('searchPrevious wraps backward across matches', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
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
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
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
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
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

  it('clearSearch resets lr-search-change to a 0/-1 state', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      (el as unknown as { getPageText: (page: number) => Promise<string> }).getPageText = () =>
        Promise.resolve('the cat sat on the mat');
      await el.search('cat');
      const eventPromise = oneEvent(el, 'lr-search-change');
      el.clearSearch();
      expect((await eventPromise).detail).to.deep.equal({ query: '', matchCount: 0, activeIndex: -1 });
    } finally {
      restore();
    }
  });

  it('is accessible with an active search match painted', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
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
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
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

  it('paints both matches when the term repeats within a single text-layer node (regression)', async () => {
    // A real PDF page renders one <span> per text item; when a search term occurs twice inside the
    // same item ("aab" at offsets 0 and 3 of "aabaab", non-overlapping since search() advances by the
    // query length), both matches land in one physical text-layer Text node. paintSearchMatches() used
    // to throw an uncaught IndexSizeError from setStart()/setEnd() painting the second match, because
    // wrapping the first one with surroundContents() splits/shrinks the node out from under the second
    // match's precomputed offset. This single-span, no-trailing-whitespace TextLayer stand-in (unlike
    // the shared FakeTextLayer, which inserts an extra whitespace Text node per word) keeps the DOM and
    // getPageText() coordinate spaces exactly aligned so the two matches are provably in one node.
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    class SingleSpanTextLayer {
      constructor(private options: { container: HTMLElement }) {}
      render(): Promise<void> {
        const span = document.createElement('span');
        span.textContent = 'aabaab';
        this.options.container.appendChild(span);
        return Promise.resolve();
      }
      cancel(): void {}
    }
    const doc = {
      numPages: 1,
      getPage: (pageNumber: number) =>
        Promise.resolve({
          ...fakePage(pageNumber),
          getTextContent: () => Promise.resolve({ items: [{ str: 'aabaab', hasEOL: false }] }),
        }),
    };
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve({
      getDocument: () => ({ promise: Promise.resolve(doc) }),
      GlobalWorkerOptions: { workerSrc: '' },
      TextLayer: SingleSpanTextLayer,
    });
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      const count = await el.search('aab'); // used to reject with an uncaught IndexSizeError
      expect(count).to.equal(2);
      const marks = listShadowRoot(el).querySelectorAll('mark[part~="search-match"]');
      expect(marks.length).to.equal(2);
      expect(Array.from(marks).map((mark) => mark.textContent)).to.deep.equal(['aab', 'aab']);
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
    expect(template.strings.join('')).to.contain('lr-pdf-viewer');
  });
});

describe('styling', () => {
  it('gives toolbar buttons a hover state', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='toolbar'\] button:hover/);
  });
});

// Parity with <lr-notebook-viewer>/<lr-svg-viewer>/<lr-xml-viewer>, which all expose a `max-height`
// attribute as a declarative alternative to setting their own sizing CSS custom property inline --
// `<lr-pdf-viewer>` only ever offered `--lr-pdf-viewer-height` as an inline style/ancestor rule,
// with no HTML-attribute equivalent.
describe('maxHeight', () => {
  it('defaults to unset, leaving --lr-pdf-viewer-height at its stylesheet default', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    expect(el.maxHeight).to.equal('');
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.style.getPropertyValue('--lr-pdf-viewer-height')).to.equal('');
  });

  it('reflects the max-height attribute onto --lr-pdf-viewer-height, and it reaches the virtualized page list', async () => {
    const el = (await fixture(html`<lr-pdf-viewer max-height="10rem"></lr-pdf-viewer>`)) as LyraPdfViewer;
    expect(el.maxHeight).to.equal('10rem');
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.style.getPropertyValue('--lr-pdf-viewer-height').trim()).to.equal('10rem');

    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="pages"]');
      const pages = el.shadowRoot!.querySelector('[part="pages"]') as HTMLElement;
      expect(getComputedStyle(pages).blockSize).to.equal('160px');
    } finally {
      restore();
    }
  });

  it('updates --lr-pdf-viewer-height live when the maxHeight property changes after first render', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    el.maxHeight = '12rem';
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.style.getPropertyValue('--lr-pdf-viewer-height').trim()).to.equal('12rem');
  });
});

// Page content is committed inside `<lr-virtual-list>`'s own shadow root, one boundary below this
// viewer's render root, so every rule for it has to travel through `::part()`. These assertions read
// the *rendered* result of each such rule rather than the stylesheet text -- a selector that stops at
// the boundary produces an element that still exists and still carries its `part` attribute, so only
// a computed-style check can tell a live rule apart from an inert one.
describe('virtualized page part styling', () => {
  /** Resolves a design token to the exact color string the browser computes for it, by measuring a
   *  throwaway element in the viewer's own shadow tree -- token values differ per color scheme and
   *  under forced colors, so a hardcoded literal here would be both wrong and unthemeable. */
  function tokenColor(el: LyraPdfViewer, token: string): string {
    const probe = document.createElement('div');
    probe.style.background = `var(${token})`;
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return value;
  }

  async function loadedPage(el: LyraPdfViewer): Promise<ShadowRoot> {
    el.src = 'https://example.test/report.pdf';
    await waitFor(el, '[part="toolbar"]');
    await waitUntil(() => listShadowRoot(el).querySelector('[part="text-layer"] span') !== null);
    await el.updateComplete;
    return listShadowRoot(el);
  }

  function expectPageLayersAligned(root: ShadowRoot): void {
    const canvasRect = root.querySelector('[part="page-canvas"]')!.getBoundingClientRect();
    for (const [name, selector] of [
      ['text-layer', '[part="text-layer"]'],
      ['highlight-layer', 'lr-highlight-layer'],
    ] as const) {
      const layerRect = root.querySelector(selector)!.getBoundingClientRect();
      expect(layerRect.left, `${name} left`).to.be.closeTo(canvasRect.left, 0.5);
      expect(layerRect.width, `${name} width`).to.be.closeTo(canvasRect.width, 0.5);
    }
  }

  it('styles the page wrapper, its canvas, and its text layer', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      const root = await loadedPage(el);
      const page = root.querySelector('[part="page"]') as HTMLElement;
      const canvas = root.querySelector('[part="page-canvas"]') as HTMLElement;
      const textLayer = root.querySelector('[part="text-layer"]') as HTMLElement;
      const listBase = el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.querySelector(
        '[part="base"]',
      ) as HTMLElement;
      expect(page.tagName).to.equal('DIV');
      expect(canvas.tagName).to.equal('CANVAS');
      expect(getComputedStyle(page).position).to.equal('relative');
      expect(getComputedStyle(page).display).to.equal('flex');
      expect(getComputedStyle(page).justifyContent).to.equal('safe center');
      expect(getComputedStyle(canvas).boxShadow).to.contain(tokenColor(el, '--lr-color-border'));
      expect(getComputedStyle(textLayer).position).to.equal('absolute');
      expect(getComputedStyle(textLayer).overflow).to.equal('hidden');
      expect(getComputedStyle(listBase).overflowX).to.equal('auto');
    } finally {
      restore();
    }
  });

  for (const direction of ['ltr', 'rtl'] as const) {
    it(`centers fitting page layers together in ${direction}`, async () => {
      const wrapper = (await fixture(html`
        <div dir=${direction} style="width: 320px"><lr-pdf-viewer></lr-pdf-viewer></div>
      `)) as HTMLElement;
      const el = wrapper.querySelector('lr-pdf-viewer') as LyraPdfViewer;
      installFakeLoader(el, fakeDocument(1));
      const restore = stubFetch();
      try {
        const root = await loadedPage(el);
        await nextFrame();
        const pageRect = root.querySelector('[part="page"]')!.getBoundingClientRect();
        const canvasRect = root.querySelector('[part="page-canvas"]')!.getBoundingClientRect();
        expect(canvasRect.left + canvasRect.width / 2, 'canvas center').to.be.closeTo(
          pageRect.left + pageRect.width / 2,
          0.5,
        );
        expectPageLayersAligned(root);
      } finally {
        restore();
      }
    });
  }

  it('keeps a max-zoom page horizontally reachable in a 320px allocation', async () => {
    const wrapper = (await fixture(html`
      <div style="width: 320px"><lr-pdf-viewer></lr-pdf-viewer></div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-pdf-viewer') as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      el.zoom = 4;
      await el.updateComplete;
      await nextFrame();
      const base = el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.querySelector(
        '[part="base"]',
      ) as HTMLElement;
      expect(base.scrollWidth).to.be.greaterThan(base.clientWidth);
      expect(getComputedStyle(base).overflowX).to.equal('auto');
      expectPageLayersAligned(listShadowRoot(el));
    } finally {
      restore();
    }
  });

  it('keeps max-zoom page layers aligned and reachable in RTL', async () => {
    const wrapper = (await fixture(html`
      <div dir="rtl" style="width: 320px"><lr-pdf-viewer></lr-pdf-viewer></div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-pdf-viewer') as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      el.zoom = 4;
      await el.updateComplete;
      await nextFrame();
      const base = el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.querySelector(
        '[part="base"]',
      ) as HTMLElement;
      expect(base.scrollWidth).to.be.greaterThan(base.clientWidth);
      expect(getComputedStyle(base).overflowX).to.equal('auto');
      expectPageLayersAligned(listShadowRoot(el));
    } finally {
      restore();
    }
  });

  it('makes each generated text run an invisible, selectable overlay run', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      const root = await loadedPage(el);
      const span = root.querySelector('[part="text-layer"] span') as HTMLElement;
      expect(span.getAttribute('part')).to.equal('text-span');
      expect(getComputedStyle(span).position).to.equal('absolute');
      expect(getComputedStyle(span).color).to.equal('rgba(0, 0, 0, 0)');
      expect(getComputedStyle(span).whiteSpace).to.equal('pre');
      expect(getComputedStyle(span).userSelect).to.equal('text');
    } finally {
      restore();
    }
  });

  // A highlight pseudo is matched against the element the selected text originates in, and `::part()`
  // cannot be followed by a descendant combinator -- so the selection tint has to hang off the text
  // run's own part rather than its text-layer container's.
  it('tints the selection over a text run with the brand-quiet token', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      const root = await loadedPage(el);
      const span = root.querySelector('[part="text-layer"] span') as HTMLElement;
      expect(getComputedStyle(span, '::selection').backgroundColor).to.equal(tokenColor(el, '--lr-color-brand-quiet'));
    } finally {
      restore();
    }
  });

  it('paints search matches and the active match with the warning tokens', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    // Single span, no trailing whitespace nodes: keeps the DOM and getPageText() coordinate spaces
    // aligned so both matches provably paint.
    class SingleSpanTextLayer {
      constructor(private options: { container: HTMLElement }) {}
      render(): Promise<void> {
        const span = document.createElement('span');
        span.textContent = 'aabaab';
        this.options.container.appendChild(span);
        return Promise.resolve();
      }
      cancel(): void {}
    }
    const doc = {
      numPages: 1,
      getPage: (pageNumber: number) =>
        Promise.resolve({
          ...fakePage(pageNumber),
          getTextContent: () => Promise.resolve({ items: [{ str: 'aabaab', hasEOL: false }] }),
        }),
    };
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve({
      getDocument: () => ({ promise: Promise.resolve(doc) }),
      GlobalWorkerOptions: { workerSrc: '' },
      TextLayer: SingleSpanTextLayer,
    });
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      expect(await el.search('aab')).to.equal(2);
      await el.updateComplete;
      const root = listShadowRoot(el);
      const marks = Array.from(root.querySelectorAll<HTMLElement>('mark[part~="search-match"]'));
      expect(marks.length).to.equal(2);
      const active = root.querySelector('mark[part~="search-match-active"]') as HTMLElement;
      const inactive = marks.find((mark) => !mark.getAttribute('part')!.includes('search-match-active'))!;
      expect(getComputedStyle(inactive).backgroundColor).to.equal(tokenColor(el, '--lr-color-warning-quiet'));
      expect(getComputedStyle(inactive).color).to.equal('rgba(0, 0, 0, 0)');
      expect(getComputedStyle(active).backgroundColor).to.equal(tokenColor(el, '--lr-color-warning'));
    } finally {
      restore();
    }
  });

  it('mirrors the text layer offset under RTL', async () => {
    const ltr = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(ltr, fakeDocument(1));
    const rtl = (await fixture(html`<lr-pdf-viewer dir="rtl"></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(rtl, fakeDocument(1));
    const restore = stubFetch();
    try {
      const ltrLayer = (await loadedPage(ltr)).querySelector('[part="text-layer"]') as HTMLElement;
      const rtlLayer = (await loadedPage(rtl)).querySelector('[part="text-layer"]') as HTMLElement;
      await waitUntil(() => ltrLayer.style.width !== '' && rtlLayer.style.width !== '');
      expect(new DOMMatrix(getComputedStyle(ltrLayer).transform).m41).to.be.lessThan(0);
      expect(new DOMMatrix(getComputedStyle(rtlLayer).transform).m41).to.be.greaterThan(0);
    } finally {
      restore();
    }
  });

  it('exposes the page parts to a consumer stylesheet', async () => {
    const host = (await fixture(html`<div>
      <style>
        lr-pdf-viewer::part(page) { outline-color: rgb(1, 2, 3); }
        lr-pdf-viewer::part(page-canvas) { outline-color: rgb(4, 5, 6); }
        lr-pdf-viewer::part(text-layer) { outline-color: rgb(7, 8, 9); }
        lr-pdf-viewer::part(text-span) { outline-color: rgb(10, 11, 12); }
      </style>
      <lr-pdf-viewer></lr-pdf-viewer>
    </div>`)) as HTMLElement;
    const el = host.querySelector('lr-pdf-viewer') as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      const root = await loadedPage(el);
      expect(getComputedStyle(root.querySelector('[part="page"]')!).outlineColor).to.equal('rgb(1, 2, 3)');
      expect(getComputedStyle(root.querySelector('[part="page-canvas"]')!).outlineColor).to.equal('rgb(4, 5, 6)');
      expect(getComputedStyle(root.querySelector('[part="text-layer"]')!).outlineColor).to.equal('rgb(7, 8, 9)');
      expect(getComputedStyle(root.querySelector('[part="text-span"]')!).outlineColor).to.equal('rgb(10, 11, 12)');
    } finally {
      restore();
    }
  });

  it('exposes the search-match parts to a consumer stylesheet', async () => {
    const host = (await fixture(html`<div>
      <style>
        lr-pdf-viewer::part(search-match) { outline-color: rgb(13, 14, 15); }
        lr-pdf-viewer::part(search-match-active) { outline-color: rgb(16, 17, 18); }
      </style>
      <lr-pdf-viewer></lr-pdf-viewer>
    </div>`)) as HTMLElement;
    const el = host.querySelector('lr-pdf-viewer') as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(1));
    const restore = stubFetch();
    try {
      el.src = 'https://example.test/report.pdf';
      await waitFor(el, '[part="toolbar"]');
      (el as unknown as { getPageText: (page: number) => Promise<string> }).getPageText = () =>
        Promise.resolve('the cat sat on the mat');
      await el.search('at');
      await el.updateComplete;
      const root = listShadowRoot(el);
      const marks = Array.from(root.querySelectorAll<HTMLElement>('mark[part~="search-match"]'));
      expect(marks.length).to.be.greaterThan(0);
      const active = root.querySelector('mark[part~="search-match-active"]') as HTMLElement | null;
      expect(getComputedStyle(marks[0]!).outlineColor).to.equal(active === marks[0] ? 'rgb(16, 17, 18)' : 'rgb(13, 14, 15)');
    } finally {
      restore();
    }
  });

  it('is accessible with pages, text runs, and search matches rendered', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer;
    installFakeLoader(el, fakeDocument(2));
    const restore = stubFetch();
    try {
      const root = await loadedPage(el);
      (el as unknown as { getPageText: (page: number) => Promise<string> }).getPageText = () =>
        Promise.resolve('the cat sat on the mat');
      await el.search('at');
      await el.updateComplete;
      expect(root.querySelectorAll('[part="text-span"]').length).to.be.greaterThan(0);
      expect(root.querySelectorAll('[part~="search-match"]').length).to.be.greaterThan(0);
      await expect(el).to.be.accessible();
    } finally {
      restore();
    }
  });
});
