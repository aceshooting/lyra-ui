import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import '../citation-badge/citation-badge.js';
import '../pdf-viewer/pdf-viewer.js';
import './document-viewer.js';
import type { LyraCitationBadge, CitationActivateDetail } from '../citation-badge/citation-badge.class.js';
import type { LyraDocumentViewer } from './document-viewer.js';
import type { LyraPdfViewer } from '../pdf-viewer/pdf-viewer.js';

function fakePage() {
  return {
    getViewport: ({ scale = 1 }: { scale?: number } = {}) => ({ width: 200 * scale, height: 200 * scale, scale }),
    render: () => ({ promise: Promise.resolve(), cancel: () => {} }),
    streamTextContent: () => new ReadableStream(),
    getTextContent: () =>
      Promise.resolve({ items: [{ str: 'Hello,', hasEOL: false }, { str: 'world!', hasEOL: false }] }),
  };
}

function fakeDocument() {
  return { numPages: 1, getPage: () => Promise.resolve(fakePage()) };
}

class FakeTextLayer {
  constructor(private options: { container: HTMLElement }) {}
  render(): Promise<void> {
    for (const word of ['Hello,', 'world!']) {
      const span = document.createElement('span');
      span.textContent = word;
      this.options.container.appendChild(span);
      this.options.container.appendChild(document.createTextNode(' '));
    }
    return Promise.resolve();
  }
  cancel(): void {}
}

describe('citation-badge -> document-viewer end-to-end recipe', () => {
  it('clicking a citation badge opens the document viewer at the cited passage, flashed', async () => {
    const originalFetch = window.fetch;
    // A hung (never-resolving) fetch keeps pdf-viewer's *first* load attempt permanently in
    // 'loading' -- nothing settles prematurely while the fake loader below is being installed, and
    // the anchor-target mixin's retry loop just keeps polling `applyAnchor` (which returns false
    // while not ready) instead of ever reporting a premature `found: false`.
    window.fetch = (() => new Promise<Response>(() => {})) as typeof window.fetch;

    try {
      const container = await fixture(html`
        <div>
          <p>
            Overall revenue grew 12%<lr-citation-badge index="1" source-id="doc-1"></lr-citation-badge>.
          </p>
          <lr-document-viewer id="dv"></lr-document-viewer>
        </div>
      `);
      const badge = container.querySelector('lr-citation-badge') as LyraCitationBadge;
      const dv = container.querySelector('lr-document-viewer') as LyraDocumentViewer;

      const highlight = {
        id: 'cite-1',
        tone: 'accent' as const,
        anchor: { kind: 'text-quote' as const, quote: 'Hello, world!' },
      };
      badge.addEventListener('lr-citation-activate', (e) => {
        const detail = (e as CustomEvent<CitationActivateDetail>).detail;
        if (detail.sourceId !== 'doc-1') return;
        dv.name = 'sample.pdf';
        dv.mimeType = 'application/pdf';
        dv.src = 'https://example.test/sample.pdf';
        dv.highlights = [highlight];
        dv.anchor = highlight.id; // scroll + activate + flash once the pdf loads
        dv.open = true;
      });

      badge.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      await waitUntil(() => dv.shadowRoot!.querySelector('lr-pdf-viewer') !== null, undefined, { timeout: 2000 });
      const pdfViewer = dv.shadowRoot!.querySelector('lr-pdf-viewer') as unknown as LyraPdfViewer & {
        loadLibrary: () => Promise<unknown>;
        load: () => Promise<void>;
        anchorRetryIntervalMs: number;
        anchorTimeoutMs: number;
      };
      expect(pdfViewer, 'document-viewer must resolve the pdf renderer for application/pdf').to.exist;
      expect(pdfViewer.highlights).to.deep.equal([highlight]);
      expect(pdfViewer.anchor).to.equal('cite-1');

      pdfViewer.anchorRetryIntervalMs = 10;
      pdfViewer.anchorTimeoutMs = 2000;
      pdfViewer.loadLibrary = () =>
        Promise.resolve({
          getDocument: () => ({ promise: Promise.resolve(fakeDocument()) }),
          GlobalWorkerOptions: { workerSrc: '' },
          TextLayer: FakeTextLayer,
        });
      window.fetch = (() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        } as Response)) as typeof window.fetch;

      const anchorResultPromise = oneEvent(dv, 'lr-anchor-result');
      void pdfViewer.load(); // direct call bypasses property-change detection -- `src` didn't change
      const result = await anchorResultPromise;
      expect(result.detail).to.deep.equal({ found: true });
      expect(pdfViewer.activeHighlightId).to.equal('cite-1');
    } finally {
      window.fetch = originalFetch;
    }
  });

  it('reverse direction: a text selection inside the pdf emits lr-text-select with a citable anchor', async () => {
    const el = (await fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`)) as LyraPdfViewer & {
      loadLibrary: () => Promise<unknown>;
    };
    el.loadLibrary = () =>
      Promise.resolve({
        getDocument: () => ({ promise: Promise.resolve(fakeDocument()) }),
        GlobalWorkerOptions: { workerSrc: '' },
        TextLayer: FakeTextLayer,
      });
    const originalFetch = window.fetch;
    window.fetch = (() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      } as Response)) as typeof window.fetch;
    try {
      el.src = 'https://example.test/sample.pdf';
      // `[part="text-layer"]` renders inside `<lr-virtual-list>`'s own nested shadow root (it's
      // part of a virtualized page row), not directly in `el.shadowRoot`.
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
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
      expect(detail.anchor?.kind).to.equal('text-quote');
      selection.removeAllRanges();
    } finally {
      window.fetch = originalFetch;
    }
  });
});
