import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './docx-viewer.js';
import type { LyraDocxViewer, DocxHeadingItem } from './docx-viewer.js';
import { findDocumentRenderer } from '../document-viewer/registry.js';
import { supportsCustomHighlights } from '../../../internal/text-highlights.js';
import { DEFAULT_MAX_RESOURCE_BYTES } from '../../../internal/resource-loader.js';
import { MINIMAL_DOCX_BASE64 } from './fixtures/minimal-docx-fixture.js';
import { styles } from './docx-viewer.styles.js';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function stubFetch(buffer: ArrayBuffer, ok = true): () => void {
  const original = window.fetch;
  window.fetch = (() => Promise.resolve({ ok, status: ok ? 200 : 500, statusText: ok ? 'OK' : 'Server Error', arrayBuffer: () => Promise.resolve(buffer) } as Response)) as typeof window.fetch;
  return () => { window.fetch = original; };
}

function useLibrary(el: LyraDocxViewer, deps: unknown): void {
  (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve(deps);
}

/** An `Error` shaped like `DOMException('AbortError')` -- matches `<lr-include>`'s own test
 *  helper of the same name, since both components reject a stale/aborted fetch the same way. */
function abortError(): Error {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

const BUFFER = base64ToArrayBuffer(MINIMAL_DOCX_BASE64);

/** Fixtures a `<lr-docx-viewer>`, stubs `mammoth.convertToHtml` to resolve `markup` verbatim and
 *  `DOMPurify.sanitize` to the identity function, then sets `src` and awaits the loaded
 *  `[part="content"]` region. Mirrors the `useLibrary`/`stubFetch` primitives every other test in
 *  this file already uses -- just packaged as one helper for the anchor/search tests below, which
 *  don't otherwise care about the conversion/sanitization pipeline itself. */
async function loadWithMarkup(markup: string): Promise<{ el: LyraDocxViewer; restore: () => void }> {
  const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer></lr-docx-viewer>`);
  useLibrary(el, {
    mammoth: { convertToHtml: () => Promise.resolve({ value: markup, messages: [] }) },
    DOMPurify: { sanitize: (value: string) => value },
  });
  const restore = stubFetch(BUFFER);
  el.src = 'https://example.test/report.docx';
  await waitUntil(() => el.shadowRoot!.querySelector('[part="content"]') !== null);
  return { el, restore };
}

/** Whether a `text-quote` highlight painted with `tone` is currently visible, via whichever paint
 *  path this browser uses -- the CSS Custom Highlight API registers ranges with no DOM element to
 *  query, so this checks the shared `CSS.highlights` registry directly there, and falls back to the
 *  `<mark data-lr-highlight-tone>` element the fallback path creates otherwise. Mirrors
 *  `<lr-markdown>`'s own equivalent test helper. */
function highlightPainted(el: LyraDocxViewer, tone = 'accent'): boolean {
  if (supportsCustomHighlights()) {
    const registry = (globalThis as unknown as { CSS: { highlights: Map<string, { size: number }> } }).CSS.highlights;
    return (registry.get(`lr-highlight-${tone}`)?.size ?? 0) > 0;
  }
  return el.shadowRoot!.querySelector(`[part="content"] mark[data-lr-highlight-tone="${tone}"]`) !== null;
}

/** Whether the single "active" highlight channel (distinct from the tone-based ones above) is
 *  currently painted, via whichever paint path this browser uses. */
function activeHighlightPainted(el: LyraDocxViewer): boolean {
  if (supportsCustomHighlights()) {
    const registry = (globalThis as unknown as { CSS: { highlights: Map<string, { size: number }> } }).CSS.highlights;
    return (registry.get('lr-highlight-active')?.size ?? 0) > 0;
  }
  return el.shadowRoot!.querySelector('[part="content"] mark[data-lr-highlight-name="lr-highlight-active"]') !== null;
}

describe('lr-docx-viewer', () => {
  it('renders an empty localized state by default', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer></lr-docx-viewer>`);
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No document to display.');
  });

  it('converts and sanitizes DOCX HTML', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer></lr-docx-viewer>`);
    useLibrary(el, {
      mammoth: { convertToHtml: () => Promise.resolve({ value: '<h1>Report</h1><script>bad()</script>', messages: [] }) },
      DOMPurify: { sanitize: (value: string) => value.replace('<script>bad()</script>', '') },
    });
    const restore = stubFetch(BUFFER);
    try {
      el.src = 'https://example.test/report.docx';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="content"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="content"]')!.textContent!.trim()).to.equal('Report');
      expect(el.shadowRoot!.querySelector('script')).to.not.exist;
    } finally {
      restore();
    }
  });

  it('shows a converter error when mammoth is unavailable', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer></lr-docx-viewer>`);
    useLibrary(el, { mammoth: undefined, DOMPurify: { sanitize: (value: string) => value } });
    const restore = stubFetch(BUFFER);
    try {
      const event = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/report.docx';
      await event;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal(
        'This viewer needs the optional "mammoth" package installed to convert this document.',
      );
    } finally {
      restore();
    }
  });

  it('blocks rendering when DOMPurify is unavailable', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer></lr-docx-viewer>`);
    useLibrary(el, { mammoth: { convertToHtml: () => Promise.resolve({ value: '<h1>Unsafe</h1>', messages: [] }) }, DOMPurify: undefined });
    const restore = stubFetch(BUFFER);
    try {
      const event = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/report.docx';
      await event;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal(
        'This viewer needs the optional "dompurify" package installed to render safely.',
      );
      expect(el.shadowRoot!.querySelector('[part="content"]')).to.not.exist;
    } finally {
      restore();
    }
  });

  it('emits non-fatal Mammoth messages after rendering', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer></lr-docx-viewer>`);
    useLibrary(el, {
      mammoth: { convertToHtml: () => Promise.resolve({ value: '<p>Ready</p>', messages: [{ type: 'warning', message: 'style' }] }) },
      DOMPurify: { sanitize: (value: string) => value },
    });
    const restore = stubFetch(BUFFER);
    try {
      const event = new Promise<CustomEvent<{ error: unknown }>>((resolve) => el.addEventListener('lr-render-error', resolve, { once: true }));
      el.src = 'https://example.test/report.docx';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="content"]') !== null);
      expect((await event).detail.error).to.be.an('array');
    } finally {
      restore();
    }
  });

  it('rejects unsafe URLs without fetching and emits exactly one render error', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer></lr-docx-viewer>`);
    let called = false;
    const original = window.fetch;
    window.fetch = (() => { called = true; return Promise.reject(new Error('unexpected')); }) as typeof window.fetch;
    try {
      let count = 0;
      el.addEventListener('lr-render-error', () => { count++; });
      const event = oneEvent(el, 'lr-render-error');
      el.src = 'java\tscript:alert(1)';
      await event;
      await aTimeout(0);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(called).to.be.false;
      expect(count).to.equal(1);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Document URL is not allowed.');
    } finally {
      window.fetch = original;
    }
  });

  it('applies max-height to the base custom property', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer max-height="32rem"></lr-docx-viewer>`);
    expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).style.getPropertyValue('--lr-docx-viewer-max-height')).to.equal('32rem');
  });

  it('is accessible in the empty state', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer></lr-docx-viewer>`);
    await expect(el).to.be.accessible();
  });

  it('uses the localized document name', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer .strings=${{ docxViewerLabel: 'Word file' }}></lr-docx-viewer>`);
    useLibrary(el, { mammoth: { convertToHtml: () => Promise.resolve({ value: '<p>Text</p>', messages: [] }) }, DOMPurify: { sanitize: (value: string) => value } });
    const restore = stubFetch(BUFFER);
    try {
      el.src = 'https://example.test/report.docx';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="content"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="content"]')!.getAttribute('aria-label')).to.equal('Word file');
    } finally {
      restore();
    }
  });

  it('forwards a host aria-label to the role="document" content region, winning over the localized default', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer aria-label="Q3 report"></lr-docx-viewer>`);
    useLibrary(el, { mammoth: { convertToHtml: () => Promise.resolve({ value: '<p>Text</p>', messages: [] }) }, DOMPurify: { sanitize: (value: string) => value } });
    const restore = stubFetch(BUFFER);
    try {
      el.src = 'https://example.test/report.docx';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="content"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="content"]')!.getAttribute('aria-label')).to.equal('Q3 report');
    } finally {
      restore();
    }
  });

  it('lets a host aria-label override the name property on the role=document owner', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer name="Named report" aria-label="Q3 report"></lr-docx-viewer>`);
    useLibrary(el, { mammoth: { convertToHtml: () => Promise.resolve({ value: '<p>Text</p>', messages: [] }) }, DOMPurify: { sanitize: (value: string) => value } });
    const restore = stubFetch(BUFFER);
    try {
      el.src = 'https://example.test/report.docx';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="content"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="content"]')!.getAttribute('aria-label')).to.equal('Q3 report');
    } finally {
      restore();
    }
  });

  it('reloads an already-loaded source after reconnecting', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer></lr-docx-viewer>`);
    useLibrary(el, {
      mammoth: { convertToHtml: () => Promise.resolve({ value: '<p>Ready</p>', messages: [] }) },
      DOMPurify: { sanitize: (value: string) => value },
    });
    const original = window.fetch;
    let calls = 0;
    window.fetch = (() => { calls++; return Promise.resolve({ ok: true, status: 200, statusText: 'OK', arrayBuffer: () => Promise.resolve(BUFFER) } as Response); }) as typeof window.fetch;
    try {
      el.src = 'https://example.test/report.docx';
      await waitUntil(() => calls === 1 && el.shadowRoot!.querySelector('[part="content"]') !== null);
      const parent = el.parentElement!;
      el.remove();
      parent.append(el);
      await waitUntil(() => calls === 2);
    } finally { window.fetch = original; }
  });

  it('reports a generic failure message for a non-OK HTTP response', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer></lr-docx-viewer>`);
    const restore = stubFetch(BUFFER, false);
    try {
      const errorEvent = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/report.docx';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Failed to load document.');
      expect((await errorEvent).detail.error).to.exist;
    } finally {
      restore();
    }
  });

  it('reports a distinct message when the response exceeds the resource size limit', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer></lr-docx-viewer>`);
    const original = window.fetch;
    window.fetch = (() => Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: (name: string) => (name.toLowerCase() === 'content-length' ? String(DEFAULT_MAX_RESOURCE_BYTES + 1) : null) },
      arrayBuffer: () => Promise.resolve(BUFFER),
    } as unknown as Response)) as typeof window.fetch;
    try {
      el.src = 'https://example.test/huge.docx';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('This document is too large to preview.');
    } finally {
      window.fetch = original;
    }
  });

  it('silently drops an aborted load (no error state, no lr-render-error) once a newer src supersedes it', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer></lr-docx-viewer>`);
    useLibrary(el, {
      mammoth: { convertToHtml: () => Promise.resolve({ value: '<p>Fresh</p>', messages: [] }) },
      DOMPurify: { sanitize: (value: string) => value },
    });
    const original = window.fetch;
    const signals: (AbortSignal | null | undefined)[] = [];
    window.fetch = ((url: string, init?: RequestInit) => {
      signals.push(init?.signal);
      if (url === 'https://example.test/stale.docx') {
        // Never resolves on its own; only settles once the caller aborts it.
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(abortError()));
        });
      }
      return Promise.resolve({ ok: true, status: 200, statusText: 'OK', arrayBuffer: () => Promise.resolve(BUFFER) } as Response);
    }) as typeof window.fetch;
    let renderErrorCount = 0;
    el.addEventListener('lr-render-error', () => { renderErrorCount += 1; });
    try {
      el.src = 'https://example.test/stale.docx';
      await waitUntil(() => signals.length > 0);
      el.src = 'https://example.test/fresh.docx';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="content"]') !== null);
      expect(signals[0]?.aborted, 'the stale request should have been aborted').to.be.true;
      expect(el.shadowRoot!.querySelector('[part="error"]')).to.not.exist;
      expect(renderErrorCount).to.equal(0);
    } finally {
      window.fetch = original;
    }
  });

  it('omits the fetch signal when AbortController is unavailable in the environment', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer></lr-docx-viewer>`);
    useLibrary(el, {
      mammoth: { convertToHtml: () => Promise.resolve({ value: '<p>No signal</p>', messages: [] }) },
      DOMPurify: { sanitize: (value: string) => value },
    });
    const originalAbortController = (globalThis as { AbortController?: typeof AbortController }).AbortController;
    const originalFetch = window.fetch;
    let observedSignal: AbortSignal | null | undefined = null;
    window.fetch = ((_url: string, init?: RequestInit) => {
      observedSignal = init?.signal;
      return Promise.resolve({ ok: true, status: 200, statusText: 'OK', arrayBuffer: () => Promise.resolve(BUFFER) } as Response);
    }) as typeof window.fetch;
    (globalThis as { AbortController?: typeof AbortController | undefined }).AbortController = undefined;
    try {
      el.src = 'https://example.test/report.docx';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="content"]') !== null);
      expect(observedSignal).to.equal(undefined);
    } finally {
      window.fetch = originalFetch;
      (globalThis as { AbortController?: typeof AbortController }).AbortController = originalAbortController;
    }
  });

  it('does not set state after being disconnected while the converter dependency is still loading', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer></lr-docx-viewer>`);
    let loadLibraryCalled = false;
    let resolveDeps!: (deps: unknown) => void;
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => {
      loadLibraryCalled = true;
      return new Promise((resolve) => { resolveDeps = resolve; });
    };
    const restore = stubFetch(BUFFER);
    try {
      el.src = 'https://example.test/report.docx';
      await waitUntil(() => loadLibraryCalled);
      el.remove();
      resolveDeps({
        mammoth: { convertToHtml: () => Promise.resolve({ value: '<p>Too late</p>', messages: [] }) },
        DOMPurify: { sanitize: (value: string) => value },
      });
      await aTimeout(20);
      expect(el.shadowRoot!.querySelector('[part="content"]')).to.not.exist;
      expect(el.shadowRoot!.querySelector('[part="error"]')).to.not.exist;
    } finally {
      restore();
    }
  });

  it('does not set state after being disconnected while mammoth is still converting', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer></lr-docx-viewer>`);
    let convertCalled = false;
    let resolveConvert!: (value: { value: string; messages: unknown[] }) => void;
    useLibrary(el, {
      mammoth: {
        convertToHtml: () => {
          convertCalled = true;
          return new Promise((resolve) => { resolveConvert = resolve; });
        },
      },
      DOMPurify: { sanitize: (value: string) => value },
    });
    const restore = stubFetch(BUFFER);
    try {
      el.src = 'https://example.test/report.docx';
      await waitUntil(() => convertCalled);
      el.remove();
      resolveConvert({ value: '<p>Too late</p>', messages: [] });
      await aTimeout(20);
      expect(el.shadowRoot!.querySelector('[part="content"]')).to.not.exist;
    } finally {
      restore();
    }
  });

  it('ignores a stale conversion result once a newer src has superseded it before mammoth resolves', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer></lr-docx-viewer>`);
    let convertCalls = 0;
    let resolveStaleConvert!: (value: { value: string; messages: unknown[] }) => void;
    useLibrary(el, {
      mammoth: {
        convertToHtml: () => {
          convertCalls += 1;
          if (convertCalls === 1) return new Promise((resolve) => { resolveStaleConvert = resolve; });
          return Promise.resolve({ value: '<p>Fresh</p>', messages: [] });
        },
      },
      DOMPurify: { sanitize: (value: string) => value },
    });
    const restore = stubFetch(BUFFER);
    try {
      el.src = 'https://example.test/stale.docx';
      await waitUntil(() => convertCalls === 1);
      el.src = 'https://example.test/fresh.docx';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="content"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="content"]')!.textContent!.trim()).to.equal('Fresh');
      resolveStaleConvert({ value: '<p>Stale</p>', messages: [] });
      await aTimeout(20);
      expect(el.shadowRoot!.querySelector('[part="content"]')!.textContent!.trim()).to.equal('Fresh');
    } finally {
      restore();
    }
  });
});

describe('DOCX registry', () => {
  it('registers the OOXML DOCX MIME type and extension fallback', () => {
    expect(findDocumentRenderer({ name: 'report.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', src: 'x' })).to.exist;
    expect(findDocumentRenderer({ name: 'report.docx', mimeType: 'application/octet-stream', src: 'x' })).to.exist;
    expect(findDocumentRenderer({ name: 'report.pdf', mimeType: 'application/pdf', src: 'x' })).to.not.exist;
  });

  it('declares its anchor/search/text-select capabilities', () => {
    const exact = findDocumentRenderer({ name: 'report.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', src: 'x' });
    expect(exact!.capabilities?.anchors).to.deep.equal(['fragment', 'text-quote']);
    expect(exact!.capabilities?.search).to.be.true;
    expect(exact!.capabilities?.textSelect).to.be.true;
  });
});

describe('getHeadingTree', () => {
  it('derives a document-ordered heading tree from the rendered h1-h6 elements', async () => {
    const { el, restore } = await loadWithMarkup('<h1>Title</h1><p>Body.</p><h2>Section One</h2><h2>Section One</h2>');
    try {
      const expected: DocxHeadingItem[] = [
        { id: 'title', label: 'Title', level: 1 },
        { id: 'section-one', label: 'Section One', level: 2 },
        { id: 'section-one-1', label: 'Section One', level: 2 },
      ];
      expect(el.getHeadingTree()).to.deep.equal(expected);
    } finally {
      restore();
    }
  });

  it('resolves an empty array before anything has loaded', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer></lr-docx-viewer>`);
    expect(el.getHeadingTree()).to.deep.equal([]);
  });

  it('matches markdown slugging on identical heading text (shared-util regression)', async () => {
    const { el, restore } = await loadWithMarkup('<h2>Getting Started!</h2>');
    try {
      expect(el.getHeadingTree()[0]!.id).to.equal('getting-started');
    } finally {
      restore();
    }
  });

  it('stamps id attributes on the rendered headings', async () => {
    const { el, restore } = await loadWithMarkup('<h1>Title</h1>');
    try {
      expect(el.shadowRoot!.querySelector('h1')!.getAttribute('id')).to.equal('title');
    } finally {
      restore();
    }
  });

  it('getHeadingTree() returns a fresh array each call -- mutating the result cannot corrupt internal state', async () => {
    const { el, restore } = await loadWithMarkup('<h1>Title</h1>');
    try {
      const tree = el.getHeadingTree();
      tree.push({ id: 'injected', label: 'Injected', level: 1 });
      expect(el.getHeadingTree()).to.have.length(1);
    } finally {
      restore();
    }
  });
});

describe('scrollToAnchor (fragment)', () => {
  it('scrolls to a heading by id', async () => {
    const { el, restore } = await loadWithMarkup('<h1>Title</h1><h2>Section One</h2>');
    try {
      let scrolled = false;
      const heading = el.shadowRoot!.querySelector('#section-one') as HTMLElement;
      heading.scrollIntoView = () => {
        scrolled = true;
      };
      expect(await el.scrollToAnchor({ kind: 'fragment', id: 'section-one' })).to.be.true;
      expect(scrolled).to.be.true;
    } finally {
      restore();
    }
  });

  it('resolves false for an unknown fragment id', async () => {
    const { el, restore } = await loadWithMarkup('<h1>Title</h1>');
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    try {
      expect(await el.scrollToAnchor({ kind: 'fragment', id: 'nope' })).to.be.false;
    } finally {
      restore();
    }
  });

  it('reports its supported anchor kinds', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer></lr-docx-viewer>`);
    expect(el.anchorKinds).to.deep.equal(['fragment', 'text-quote']);
  });

  it('declines an anchor kind neither fragment nor text-quote (e.g. page)', async () => {
    const { el, restore } = await loadWithMarkup('<h1>Title</h1>');
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    try {
      expect(await el.scrollToAnchor({ kind: 'page', page: 1 })).to.be.false;
    } finally {
      restore();
    }
  });

  it('still resolves a heading fragment by computed position when its id attribute is missing from the DOM', async () => {
    const { el, restore } = await loadWithMarkup('<h1>Title</h1><h2>Section One</h2>');
    try {
      // Simulates DOMPurify's DOM-clobbering protection stripping an id that collides with a
      // `document` property name (see findHeadingByComputedId's own doc comment) -- the heading is
      // still reachable by re-deriving the same slug order getHeadingTree() was built in.
      const heading = el.shadowRoot!.querySelector('#section-one') as HTMLElement;
      heading.removeAttribute('id');
      let scrolled = false;
      heading.scrollIntoView = () => {
        scrolled = true;
      };
      expect(await el.scrollToAnchor({ kind: 'fragment', id: 'section-one' })).to.be.true;
      expect(scrolled).to.be.true;
    } finally {
      restore();
    }
  });
});

describe('scrollToAnchor / highlights (text-quote)', () => {
  it('resolves a quote spanning an inline <strong> boundary', async () => {
    const { el, restore } = await loadWithMarkup('<p>The <strong>quick brown</strong> fox jumps.</p>');
    try {
      let scrolled = false;
      // The quote starts inside <strong>, so the resolved range's own scroll target may be that
      // inline element rather than the paragraph itself -- stub scrollIntoView on every element in
      // the rendered content so the assertion doesn't depend on exactly which one is targeted.
      el.shadowRoot!.querySelectorAll('[part="content"] *').forEach((node) => {
        (node as HTMLElement).scrollIntoView = () => {
          scrolled = true;
        };
      });
      expect(await el.scrollToAnchor({ kind: 'text-quote', quote: 'quick brown fox' })).to.be.true;
      expect(scrolled).to.be.true;
    } finally {
      restore();
    }
  });

  it('resolves false for a text-quote anchor that matches nothing', async () => {
    const { el, restore } = await loadWithMarkup('<p>Hello world</p>');
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    try {
      expect(await el.scrollToAnchor({ kind: 'text-quote', quote: 'nothing to see here' })).to.be.false;
    } finally {
      restore();
    }
  });

  it('paints a text-quote highlight (CSS Custom Highlight API, or a <mark> fallback)', async () => {
    const { el, restore } = await loadWithMarkup('<p>Hello world</p>');
    try {
      el.highlights = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'world' } }];
      await el.updateComplete;
      expect(highlightPainted(el)).to.be.true;
    } finally {
      restore();
    }
  });

  it('clears a previously-painted highlight once highlights is set back to empty', async () => {
    const { el, restore } = await loadWithMarkup('<p>Hello world</p>');
    try {
      el.highlights = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'world' } }];
      await el.updateComplete;
      expect(highlightPainted(el)).to.be.true;
      el.highlights = [];
      await el.updateComplete;
      expect(highlightPainted(el)).to.be.false;
    } finally {
      restore();
    }
  });

  it('emits lr-highlight-activate when a painted highlight is clicked', async () => {
    const { el, restore } = await loadWithMarkup('<p>Hello world</p>');
    try {
      el.highlights = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'world' } }];
      await el.updateComplete;

      const paragraph = el.shadowRoot!.querySelector('[part="content"] p')!;
      const textNode = paragraph.firstChild as Text;
      const offset = textNode.data.indexOf('world');
      const range = document.createRange();
      range.setStart(textNode, offset);
      range.setEnd(textNode, offset + 'world'.length);
      const rect = range.getClientRects()[0];

      const listener = oneEvent(el, 'lr-highlight-activate');
      paragraph.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          composed: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
        }),
      );
      const event = (await listener) as CustomEvent<{ id: string }>;
      expect(event.detail).to.deep.equal({ id: 'h1' });
    } finally {
      restore();
    }
  });

  it('emits lr-text-select with a text-quote anchor on selection', async () => {
    const { el, restore } = await loadWithMarkup('<p>The quick brown fox jumps over the lazy dog.</p>');
    try {
      const paragraph = el.shadowRoot!.querySelector('[part="content"] p')!;
      const textNode = paragraph.firstChild!;
      const range = document.createRange();
      range.setStart(textNode, 10);
      range.setEnd(textNode, 15);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      const listener = oneEvent(el, 'lr-text-select');
      (paragraph as HTMLElement).dispatchEvent(new MouseEvent('pointerup', { bubbles: true, composed: true }));
      const event = (await listener) as CustomEvent<{ text: string; anchor: unknown }>;
      expect(event.detail.text).to.equal('brown');
      selection.removeAllRanges();
    } finally {
      restore();
    }
  });

  it('skips a non-text-quote highlight and a text-quote highlight that resolves to nothing', async () => {
    const { el, restore } = await loadWithMarkup('<p>Hello world</p>');
    try {
      el.highlights = [
        { id: 'h-page', anchor: { kind: 'page', page: 1 } },
        { id: 'h-miss', anchor: { kind: 'text-quote', quote: 'not present anywhere' } },
        { id: 'h-hit', anchor: { kind: 'text-quote', quote: 'world' } },
      ];
      await el.updateComplete;
      expect(highlightPainted(el)).to.be.true;
    } finally {
      restore();
    }
  });

  it('marks the highlight matching activeHighlightId as the active one', async () => {
    const { el, restore } = await loadWithMarkup('<p>Hello world</p>');
    try {
      el.highlights = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'world' } }];
      el.activeHighlightId = 'h1';
      await el.updateComplete;
      expect(activeHighlightPainted(el)).to.be.true;
    } finally {
      restore();
    }
  });

  it('falls back to <mark>-wrapped highlights, stamping a highlight part, without the CSS Custom Highlight API', async () => {
    const originalHighlight = (globalThis as { Highlight?: unknown }).Highlight;
    (globalThis as { Highlight?: unknown }).Highlight = undefined;
    try {
      const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer></lr-docx-viewer>`);
      useLibrary(el, {
        mammoth: { convertToHtml: () => Promise.resolve({ value: '<p>Hello world</p>', messages: [] }) },
        DOMPurify: { sanitize: (value: string) => value },
      });
      const restore = stubFetch(BUFFER);
      try {
        el.src = 'https://example.test/report.docx';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="content"]') !== null);
        el.highlights = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'world' } }];
        await el.updateComplete;
        const mark = el.shadowRoot!.querySelector('[part="content"] mark[data-lr-highlight-tone="accent"]');
        expect(mark !== null).to.equal(true);
        expect(mark!.getAttribute('part')).to.equal('highlight');
      } finally {
        restore();
      }
    } finally {
      (globalThis as { Highlight?: unknown }).Highlight = originalHighlight;
    }
  });

  it('lets component-scoped properties theme fallback highlights and search states', async () => {
    const originalHighlight = (globalThis as { Highlight?: unknown }).Highlight;
    (globalThis as { Highlight?: unknown }).Highlight = undefined;
    const { el, restore } = await loadWithMarkup('<p>Hello world Hello</p>');
    try {
      el.style.setProperty('--lr-docx-viewer-highlight-accent-background', 'rgb(1, 2, 3)');
      el.style.setProperty('--lr-docx-viewer-search-match-background', 'rgb(4, 5, 6)');
      el.style.setProperty('--lr-docx-viewer-search-match-active-background', 'rgb(7, 8, 9)');
      el.highlights = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'world' } }];
      await el.updateComplete;
      const highlight = el.shadowRoot!.querySelector<HTMLElement>(
        '[part="content"] mark[data-lr-highlight-tone="accent"]',
      );
      expect(highlight !== null).to.equal(true);
      expect(getComputedStyle(highlight!).backgroundColor).to.equal('rgb(1, 2, 3)');

      await el.search('Hello');
      const matches = Array.from(
        el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="search-match"]'),
      );
      expect(matches.length).to.equal(2);
      const active = matches.find((match) => match.getAttribute('part')?.includes('search-match-active'));
      const inactive = matches.find((match) => !match.getAttribute('part')?.includes('search-match-active'));
      expect(active !== undefined).to.equal(true);
      expect(inactive !== undefined).to.equal(true);
      expect(getComputedStyle(active!).backgroundColor).to.equal('rgb(7, 8, 9)');
      expect(getComputedStyle(inactive!).backgroundColor).to.equal('rgb(4, 5, 6)');
    } finally {
      restore();
      (globalThis as { Highlight?: unknown }).Highlight = originalHighlight;
    }
  });

  it('gives the clickable <mark>-wrap highlight fallback a :hover rule matching its cursor:pointer affordance', () => {
    // Browser test runners don't synthesize a real :hover pseudo-class from a dispatched event
    // (same constraint documented at tabs.test.ts's identical stylesheet-source check), so this
    // asserts against the parsed stylesheet rather than a forced pseudo-state.
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/mark\[data-lr-highlight-tone\]:hover/);
  });

  it('does not activate a highlight when a click misses every painted range', async () => {
    const { el, restore } = await loadWithMarkup('<p>Hello world</p>');
    try {
      el.highlights = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'world' } }];
      await el.updateComplete;
      let activated = false;
      el.addEventListener('lr-highlight-activate', () => {
        activated = true;
      });
      const paragraph = el.shadowRoot!.querySelector('[part="content"] p')!;
      paragraph.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, clientX: -9999, clientY: -9999 }));
      await aTimeout(10);
      expect(activated).to.be.false;
    } finally {
      restore();
    }
  });
});

describe('search', () => {
  it('finds and counts matches, clearing state fully on src change', async () => {
    const { el, restore } = await loadWithMarkup('<p>The cat sat on the mat, said the cat.</p>');
    try {
      const count = await el.search('cat');
      expect(count).to.equal(2);
      expect(await el.searchNext()).to.be.true;
      expect(el.shadowRoot!.querySelectorAll('[part~="search-match"]').length).to.be.greaterThan(0);
      expect(el.shadowRoot!.querySelectorAll('[part~="search-match-active"]').length).to.equal(1);

      el.src = '';
      await waitUntil(() => el.shadowRoot!.querySelectorAll('[part~="search-match"]').length === 0);
    } finally {
      restore();
    }
  });

  it('case-folds with the effective locale', async () => {
    const { el, restore } = await loadWithMarkup('<p>İSTANBUL</p>');
    try {
      el.lang = 'tr';
      await el.updateComplete;
      expect(await el.search('istanbul')).to.equal(1);
    } finally { restore(); }
  });

  it('caps match objects and painted marks for adversarial repetitive content', async () => {
    const { el, restore } = await loadWithMarkup(`<p>${'x '.repeat(1500)}</p>`);
    try {
      expect(await el.search('x')).to.equal(1000);
      expect(el.shadowRoot!.querySelectorAll('[part~="search-match"]').length).to.equal(1000);
    } finally { restore(); }
  });

  it('wraps around in both directions', async () => {
    const { el, restore } = await loadWithMarkup('<p>cat cat cat</p>');
    try {
      expect(await el.search('cat')).to.equal(3);
      let detail: { activeIndex: number } | undefined;
      el.addEventListener('lr-search-change', (e) => (detail = (e as CustomEvent).detail));
      expect(await el.searchPrevious()).to.be.true;
      expect(detail?.activeIndex).to.equal(2);
      expect(await el.searchNext()).to.be.true;
      expect(detail?.activeIndex).to.equal(0);
    } finally {
      restore();
    }
  });

  it('resolves 0 and no-ops searchNext/searchPrevious for a query with no matches', async () => {
    const { el, restore } = await loadWithMarkup('<p>Hello world</p>');
    try {
      expect(await el.search('nope')).to.equal(0);
      expect(await el.searchNext()).to.be.false;
      expect(await el.searchPrevious()).to.be.false;
    } finally {
      restore();
    }
  });

  it('clearSearch() clears the query, matches, and painted marks, and fires lr-search-change', async () => {
    const { el, restore } = await loadWithMarkup('<p>The cat sat on the mat.</p>');
    try {
      await el.search('cat');
      const listener = oneEvent(el, 'lr-search-change');
      el.clearSearch();
      const event = (await listener) as CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
      expect(event.detail).to.deep.equal({ query: '', matchCount: 0, activeIndex: -1 });
      expect(el.shadowRoot!.querySelectorAll('[part~="search-match"]').length).to.equal(0);
    } finally {
      restore();
    }
  });

  it('is accessible with an active search match', async () => {
    const { el, restore } = await loadWithMarkup('<p>The cat sat on the mat.</p>');
    try {
      await el.search('cat');
      await expect(el).to.be.accessible();
    } finally {
      restore();
    }
  });

  it('finds a match spanning multiple text nodes created by inline markup', async () => {
    const { el, restore } = await loadWithMarkup('<p>Hello <b>world</b>, cat!</p>');
    try {
      expect(await el.search('cat')).to.equal(1);
      expect(el.shadowRoot!.querySelectorAll('[part~="search-match"]').length).to.be.greaterThan(0);
    } finally {
      restore();
    }
  });

  it('resolves 0 when the query is empty/whitespace-only, clearing any previous matches', async () => {
    const { el, restore } = await loadWithMarkup('<p>The cat sat on the mat.</p>');
    try {
      await el.search('cat');
      expect(el.shadowRoot!.querySelectorAll('[part~="search-match"]').length).to.be.greaterThan(0);
      const listener = oneEvent(el, 'lr-search-change');
      const count = await el.search('   ');
      const event = (await listener) as CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
      expect(count).to.equal(0);
      expect(event.detail).to.deep.equal({ query: '   ', matchCount: 0, activeIndex: -1 });
      expect(el.shadowRoot!.querySelectorAll('[part~="search-match"]').length).to.equal(0);
    } finally {
      restore();
    }
  });

  it('resolves 0 when no document has loaded (no content root)', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lr-docx-viewer></lr-docx-viewer>`);
    expect(await el.search('cat')).to.equal(0);
  });

  it('re-derives fresh ranges from the current DOM on repaint, tolerating offsets that no longer resolve to any text node', async () => {
    // A long filler prefix (containing no "cat" substring) pushes both matches' stored offsets well
    // past the handful of whitespace-only text characters Lit's own `[part="content"]` template
    // wrapper contributes around `${unsafeHTML(...)}` -- so once the <p> is shrunk below, those
    // offsets can't coincidentally still resolve inside that ambient whitespace.
    const filler = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore. ';
    const { el, restore } = await loadWithMarkup(`<p>${filler}The cat sat on the mat, said the cat.</p>`);
    try {
      expect(await el.search('cat')).to.equal(2);
      expect(el.shadowRoot!.querySelectorAll('[part~="search-match"]').length).to.be.greaterThan(0);

      // Simulate the rendered content changing out from under the stored match offsets --
      // paintSearchMatches() always re-derives fresh Ranges from the *current* DOM and must
      // tolerate offsets that no longer resolve to any text node instead of throwing. Mutating the
      // inner <p> (rather than the [part="content"] wrapper Lit itself manages via unsafeHTML) keeps
      // this a plain, safe DOM change.
      el.shadowRoot!.querySelector('[part="content"] p')!.textContent = 'x';

      expect(await el.searchNext()).to.be.true;
      expect(el.shadowRoot!.querySelectorAll('[part~="search-match"]').length).to.equal(0);
      expect(el.shadowRoot!.querySelector('mark[part~="search-match-active"]')).to.not.exist;
    } finally {
      restore();
    }
  });
});

describe('back-compat', () => {
  it('rendering is unchanged with no anchor/search method ever called (only the heading id is additive)', async () => {
    const { el, restore } = await loadWithMarkup('<h1>Title</h1><p>Body.</p>');
    try {
      const content = el.shadowRoot!.querySelector('[part="content"]')!;
      expect(content.querySelector('h1')!.textContent).to.equal('Title');
      expect(content.querySelector('p')!.textContent).to.equal('Body.');
      expect(el.shadowRoot!.querySelectorAll('[part~="search-match"]').length).to.equal(0);
    } finally {
      restore();
    }
  });
});
