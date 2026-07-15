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

class FakeTextLayer {
  static lastContainer: HTMLElement | null = null;
  constructor(options: { container: HTMLElement }) { FakeTextLayer.lastContainer = options.container; }
  render(): Promise<void> { return Promise.resolve(); }
  cancel(): void {}
}

function fakePage(pageNumber: number) {
  return {
    pageNumber,
    getViewport: ({ scale = 1 }: { scale?: number } = {}) => ({ width: 200 * scale, height: 300 * scale, scale }),
    render: () => ({ promise: Promise.resolve(), cancel: () => {} }),
    streamTextContent: () => new ReadableStream(),
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
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.contain('404');
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

describe('registry registration', () => {
  it('registers exact and filename PDF matches as a lazy renderer', async () => {
    const exact = findDocumentRenderer({ name: 'a.pdf', mimeType: 'application/pdf', src: 'https://example.test/a.pdf' });
    expect(exact).to.exist;
    expect(exact!.render).to.be.undefined;
    expect(exact!.load).to.exist;
    expect(findDocumentRenderer({ name: 'a.pdf', mimeType: 'application/octet-stream', src: 'https://example.test/a.pdf' })).to.equal(exact);
    expect(findDocumentRenderer({ name: 'a.csv', mimeType: 'text/csv', src: 'https://example.test/a.csv' })).to.not.exist;
    const resolved = await loadDocumentRenderer(exact!);
    const template = resolved.render!({ name: 'a.pdf', mimeType: 'application/pdf', src: 'https://example.test/a.pdf' }) as { strings: readonly string[] };
    expect(template.strings.join('')).to.contain('lyra-pdf-viewer');
  });
});
