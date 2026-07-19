import { aTimeout, expect, fixture, html, oneEvent } from '@open-wc/testing';
import './ebook-viewer.js';
import { __setEpubJsForTesting } from './ebook-loader.js';
import type { LyraEbookViewer } from './ebook-viewer.js';
import { DEFAULT_MAX_RESOURCE_BYTES } from '../../../internal/resource-loader.js';

function response(ok = true): Response {
  return { ok, status: ok ? 200 : 404, statusText: ok ? 'OK' : 'Not Found', arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)) } as unknown as Response;
}

/** A response whose `content-length` header exceeds `DEFAULT_MAX_RESOURCE_BYTES`, so
 *  `readResponseArrayBuffer()` rejects with a `LyraResourceLimitError` before epub.js ever sees it. */
function oversizedResponse(): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)),
    headers: { get: (name: string) => (name.toLowerCase() === 'content-length' ? String(DEFAULT_MAX_RESOURCE_BYTES + 1) : null) },
  } as unknown as Response;
}

function fakeBook() {
  const calls = { next: 0, prev: 0, destroy: 0 };
  const rendition = {
    display: () => Promise.resolve(),
    next: () => { calls.next++; return Promise.resolve(); },
    prev: () => { calls.prev++; return Promise.resolve(); },
    // Real epub.js renditions always expose these (EventEmitter + annotations manager) -- present
    // here as no-ops so this "everything new left unset" fixture stays a faithful stand-in rather
    // than a shape only the pre-anchor/search component could render against.
    on: () => {},
    annotations: { highlight: () => {}, remove: () => {} },
  };
  const book = {
    ready: Promise.resolve(),
    renderTo: () => rendition,
    destroy: () => { calls.destroy++; },
  };
  return { calls, book, factory: () => book };
}

function stubFetch(): () => void {
  const original = window.fetch;
  window.fetch = (() => Promise.resolve(response())) as typeof window.fetch;
  return () => { window.fetch = original; };
}

/** Extends `fakeBook()` with navigation/spine-find/annotations/relocated/selected support, for the
 *  TOC/location/search/anchor tests below. */
function fakeBookWithFeatures(spineTexts: Record<string, string>) {
  const relocatedHandlers: ((loc: unknown) => void)[] = [];
  const selectedHandlers: ((cfiRange: string, contents: unknown) => void)[] = [];
  const highlightCalls: { cfi: string; className: string }[] = [];
  const removeCalls: string[] = [];
  const displayedCfis: string[] = [];
  const spineItems = Object.entries(spineTexts).map(([href, text]) => ({
    href,
    load: () => Promise.resolve(),
    unload: () => {},
    find: (query: string) =>
      text.toLowerCase().includes(query.toLowerCase())
        ? [{ cfi: `epubcfi(/6/2!/4/${href})`, excerpt: text }]
        : [],
  }));
  const rendition = {
    display: (target?: string) => {
      if (target) displayedCfis.push(target);
      return Promise.resolve();
    },
    next: () => Promise.resolve(),
    prev: () => Promise.resolve(),
    on: (event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'relocated') relocatedHandlers.push(handler as (loc: unknown) => void);
      if (event === 'selected') selectedHandlers.push(handler as (cfiRange: string, contents: unknown) => void);
    },
    annotations: {
      highlight: (cfi: string, _data: unknown, _cb: unknown, className: string) => {
        highlightCalls.push({ cfi, className });
      },
      remove: (cfi: string) => { removeCalls.push(cfi); },
    },
  };
  const book = {
    ready: Promise.resolve(),
    navigation: {
      toc: [
        { id: 'ch1', label: 'Chapter 1', href: 'ch1.xhtml', subitems: [{ label: 'Section 1.1', href: 'ch1.xhtml#s1' }] },
        { label: 'Chapter 2', href: 'ch2.xhtml' },
      ],
    },
    spine: { spineItems },
    renderTo: () => rendition,
    destroy: () => {},
  };
  return {
    book,
    rendition,
    factory: () => book,
    relocate: (loc: { start: { cfi: string; href: string } }) => relocatedHandlers.forEach((h) => h(loc)),
    select: (cfiRange: string, contents: unknown) => selectedHandlers.forEach((h) => h(cfiRange, contents)),
    highlightCalls,
    removeCalls,
    displayedCfis,
  };
}

/** A `fakeBook()` whose `book.ready` is controlled externally, for exercising `load()`'s own
 *  generation race: a load that finishes opening only after a newer `src` has already superseded
 *  it must destroy the book it just created instead of assigning it live. */
function fakeBookDeferredReady() {
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => { resolveReady = resolve; });
  const calls = { destroy: 0 };
  const rendition = {
    display: () => Promise.resolve(),
    next: () => Promise.resolve(),
    prev: () => Promise.resolve(),
    on: () => {},
    annotations: { highlight: () => {}, remove: () => {} },
  };
  const book = { ready, renderTo: () => rendition, destroy: () => { calls.destroy++; } };
  return { book, factory: () => book, resolveReady, calls };
}

/** A one-section book whose `book.load` exists (so `search()`/`findTextQuoteCfi()` bind and
 *  forward it into `item.load()`) and whose `item.find()` resolves `undefined` rather than an
 *  array -- some `epub.js` builds do this instead of resolving `[]` for a no-match section. */
function fakeBookWithLoadBinding() {
  const loadArgs: unknown[] = [];
  const spineItem = {
    href: 'ch1.xhtml',
    load: (loader?: unknown) => { loadArgs.push(loader); return Promise.resolve(); },
    unload: () => {},
    find: () => undefined,
  };
  const rendition = {
    display: () => Promise.resolve(),
    next: () => Promise.resolve(),
    prev: () => Promise.resolve(),
    on: () => {},
    annotations: { highlight: () => {}, remove: () => {} },
  };
  const book = {
    ready: Promise.resolve(),
    load: (url: string) => Promise.resolve(url),
    spine: { spineItems: [spineItem] },
    renderTo: () => rendition,
    destroy: () => {},
  };
  return { book, factory: () => book, loadArgs };
}

afterEach(() => __setEpubJsForTesting(undefined));

describe('lr-ebook-viewer', () => {
  it('keeps a stable mount and renders an idle state by default', async () => {
    const el = (await fixture(html`<lr-ebook-viewer></lr-ebook-viewer>`)) as LyraEbookViewer;
    expect(el.shadowRoot!.querySelector('[part="mount"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.not.exist;
    expect((el.shadowRoot!.querySelector('[part="next-button"]') as HTMLButtonElement).disabled).to.be.true;
  });

  it('gives the page-turn buttons the shared minimum hit area', async () => {
    const el = (await fixture(html`<lr-ebook-viewer></lr-ebook-viewer>`)) as LyraEbookViewer;
    const previous = el.shadowRoot!.querySelector('[part="previous-button"]') as HTMLElement;
    const next = el.shadowRoot!.querySelector('[part="next-button"]') as HTMLElement;

    expect(getComputedStyle(previous).minInlineSize).to.equal('40px');
    expect(getComputedStyle(previous).minBlockSize).to.equal('40px');
    expect(getComputedStyle(next).minInlineSize).to.equal('40px');
    expect(getComputedStyle(next).minBlockSize).to.equal('40px');
  });

  it('loads a book, enables navigation, and destroys it when disconnected', async () => {
    const fake = fakeBook();
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      const next = el.shadowRoot!.querySelector('[part="next-button"]') as HTMLButtonElement;
      const previous = el.shadowRoot!.querySelector('[part="previous-button"]') as HTMLButtonElement;
      expect(next.disabled).to.be.false;
      next.click();
      previous.click();
      expect(fake.calls.next).to.equal(1);
      expect(fake.calls.prev).to.equal(1);
      el.remove();
      expect(fake.calls.destroy).to.equal(1);
    } finally {
      restore();
    }
  });

  it('reloads the book after a synchronous reparent while connected, instead of leaving stale-looking enabled controls', async () => {
    const fake = fakeBook();
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      const next = el.shadowRoot!.querySelector('[part="next-button"]') as HTMLButtonElement;
      expect(next.disabled).to.be.false;

      const otherContainer = document.createElement('div');
      document.body.appendChild(otherContainer);
      otherContainer.appendChild(el); // disconnect + reconnect synchronously, same instance
      await el.updateComplete;

      // Right after the reparent, the previous rendition was torn down -- the
      // controls must not still look live against a destroyed rendition.
      expect(fake.calls.destroy).to.equal(1);
      expect(next.disabled, 'controls must not stay enabled against a destroyed rendition').to.be.true;

      // The reconnect re-arms the load, so the book comes back rather than the
      // viewer staying permanently blank.
      await aTimeout(20);
      expect(next.disabled, 'a reconnect must reload the book').to.be.false;

      otherContainer.remove();
    } finally {
      restore();
    }
  });

  it('renders safe-url, fetch, and missing-peer errors', async () => {
    const restore = stubFetch();
    try {
      const unsafe = (await fixture(html`<lr-ebook-viewer .src=${'javascript:alert(1)'}></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(10);
      expect(unsafe.shadowRoot!.querySelector('[part="error"]')!.textContent).to.contain('Document URL is not allowed');
      __setEpubJsForTesting(null);
      const missing = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      expect(missing.shadowRoot!.querySelector('[part="error"]')!.textContent).to.contain('Failed to load the ebook');
    } finally {
      restore();
    }
  });

  it('renders a load error and emits lr-render-error when the fetch itself rejects', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.reject(new Error('network down'))) as typeof window.fetch;
    const fake = fakeBook();
    __setEpubJsForTesting(fake.factory as never);
    try {
      const el = (await fixture(html`<lr-ebook-viewer></lr-ebook-viewer>`)) as LyraEbookViewer;
      const errorPromise = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/unreachable.epub';
      const event = (await errorPromise) as CustomEvent<{ error: unknown }>;
      expect(event.detail.error).to.exist;
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Failed to load the ebook.');
    } finally {
      window.fetch = original;
    }
  });

  it('reports a resource-too-large error for an oversized response instead of the generic load error', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(oversizedResponse())) as typeof window.fetch;
    const fake = fakeBook();
    __setEpubJsForTesting(fake.factory as never);
    try {
      const el = (await fixture(html`<lr-ebook-viewer></lr-ebook-viewer>`)) as LyraEbookViewer;
      const errorPromise = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/huge.epub';
      await errorPromise;
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('This document is too large to preview.');
    } finally {
      window.fetch = original;
    }
  });

  it('drops an aborted in-flight load without surfacing an error, once a newer src supersedes it', async () => {
    const original = window.fetch;
    const signals: (AbortSignal | undefined)[] = [];
    window.fetch = ((_url: string, init?: RequestInit) => {
      signals.push(init?.signal ?? undefined);
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('The operation was aborted.');
          error.name = 'AbortError';
          reject(error);
        });
      });
    }) as typeof window.fetch;
    const fake = fakeBook();
    __setEpubJsForTesting(fake.factory as never);
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/first.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(10);
      let renderErrorFired = false;
      el.addEventListener('lr-render-error', () => { renderErrorFired = true; });
      el.src = 'https://example.test/second.epub'; // aborts the first fetch via beginAbortableLoad()
      await aTimeout(20);
      expect(signals[0]?.aborted, 'the first request should have been aborted').to.equal(true);
      expect(renderErrorFired, 'an aborted load must not surface as a render error').to.equal(false);
    } finally {
      window.fetch = original;
    }
  });

  it('surfaces a load error instead of throwing when the mount element is unexpectedly not yet rendered', async () => {
    const fake = fakeBook();
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer></lr-ebook-viewer>`)) as LyraEbookViewer;
      // Lit's own `ref()` directive self-heals `.value` back to the live element on every render
      // (it compares the ref's *current* value against what it last committed), so a plain
      // `mountRef.value = undefined` gets silently overwritten by the very re-render `ebookState =
      // 'loading'` triggers before `load()` reaches its mount check. Intercepting the accessor
      // itself is what actually keeps it hidden for this one defensive-guard test.
      const mountRef = (el as unknown as { mountRef: { value?: HTMLDivElement } }).mountRef;
      let real = mountRef.value;
      Object.defineProperty(mountRef, 'value', {
        configurable: true,
        get: () => undefined,
        set: (v: HTMLDivElement | undefined) => { real = v; },
      });
      el.src = 'https://example.test/book.epub';
      await aTimeout(20);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Failed to load the ebook.');
      void real; // silence unused-write lint; kept only so the setter has somewhere to record Lit's own writes
    } finally {
      restore();
    }
  });

  it('renders a load error and emits lr-render-error when opening/rendering the book throws', async () => {
    const book = {
      ready: Promise.resolve(),
      renderTo: () => { throw new Error('render failed'); },
      destroy: () => {},
    };
    __setEpubJsForTesting((() => book) as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      const errorPromise = oneEvent(el, 'lr-render-error');
      const event = (await errorPromise) as CustomEvent<{ error: unknown }>;
      expect(event.detail.error).to.exist;
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Failed to load the ebook.');
    } finally {
      restore();
    }
  });

  it('destroys a book that finishes opening after a newer load() has already superseded it', async () => {
    const stale = fakeBookDeferredReady();
    __setEpubJsForTesting(stale.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/first.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20); // let the first load reach `await book.ready` and suspend there

      const fresh = fakeBook();
      __setEpubJsForTesting(fresh.factory as never);
      el.src = 'https://example.test/second.epub'; // supersedes the first load's generation
      await aTimeout(20);
      const next = el.shadowRoot!.querySelector('[part="next-button"]') as HTMLButtonElement;
      expect(next.disabled, 'the second load should have completed and taken over').to.be.false;

      stale.resolveReady(); // now let the superseded first load finish opening
      await aTimeout(20);
      expect(stale.calls.destroy, 'a superseded load must destroy the book it finished creating instead of assigning it live').to.equal(1);
      expect(next.disabled, 'the live (second) book must remain in control').to.be.false;
    } finally {
      restore();
    }
  });

  it('emits lr-text-select on a non-empty epub.js selected event, and ignores a collapsed one', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'hello world' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);

      let events = 0;
      el.addEventListener('lr-text-select', () => { events++; });
      fake.select('epubcfi(/6/2!/4)', { window: { getSelection: () => ({ toString: () => '   ', rangeCount: 0 }) } });
      await aTimeout(10);
      expect(events, 'a collapsed/whitespace-only selection must not emit').to.equal(0);

      const rect = { x: 0, y: 0, width: 10, height: 10 } as DOMRect;
      const listener = oneEvent(el, 'lr-text-select');
      fake.select('epubcfi(/6/2!/4)', {
        window: { getSelection: () => ({ toString: () => 'world', rangeCount: 1, getRangeAt: () => ({ getClientRects: () => [rect] }) }) },
      });
      const event = (await listener) as CustomEvent<{ text: string; anchor: unknown; rects: DOMRect[] }>;
      expect(event.detail).to.deep.equal({ text: 'world', anchor: { kind: 'cfi', cfi: 'epubcfi(/6/2!/4)' }, rects: [rect] });
    } finally {
      restore();
    }
  });

  it('is accessible and supports localized navigation labels', async () => {
    const el = await fixture(html`<lr-ebook-viewer .strings=${{ previous: 'Précédent', next: 'Suivant' }}></lr-ebook-viewer>`);
    expect(el.shadowRoot!.querySelector('[part="previous-button"]')!.getAttribute('aria-label')).to.equal('Précédent');
    await expect(el).to.be.accessible();
  });
});

describe('getToc', () => {
  it('flattens the navigation tree with 1-based nesting levels', async () => {
    const fake = fakeBookWithFeatures({});
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      expect(await el.getToc()).to.deep.equal([
        { id: 'ch1', label: 'Chapter 1', href: 'ch1.xhtml', level: 1 },
        { id: 'ch1.xhtml#s1', label: 'Section 1.1', href: 'ch1.xhtml#s1', level: 2 },
        { id: 'ch2.xhtml', label: 'Chapter 2', href: 'ch2.xhtml', level: 1 },
      ]);
    } finally {
      restore();
    }
  });

  it('resolves [] before the book is ready', async () => {
    const el = (await fixture(html`<lr-ebook-viewer></lr-ebook-viewer>`)) as LyraEbookViewer;
    expect(await el.getToc()).to.deep.equal([]);
  });

  it('resolves [] once loaded when the book reports no navigation toc', async () => {
    const fake = fakeBook(); // no `navigation` field at all
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      expect(await el.getToc()).to.deep.equal([]);
    } finally {
      restore();
    }
  });

  it('falls back to an empty label for a navigation entry with none', async () => {
    const book = {
      ready: Promise.resolve(),
      navigation: { toc: [{ href: 'ch3.xhtml' }] }, // no id, no label
      renderTo: () => ({
        display: () => Promise.resolve(),
        next: () => Promise.resolve(),
        prev: () => Promise.resolve(),
        on: () => {},
        annotations: { highlight: () => {}, remove: () => {} },
      }),
      destroy: () => {},
    };
    __setEpubJsForTesting((() => book) as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      expect(await el.getToc()).to.deep.equal([{ id: 'ch3.xhtml', label: '', href: 'ch3.xhtml', level: 1 }]);
    } finally {
      restore();
    }
  });
});

describe('location', () => {
  it('applies a location set before load once the book is ready', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'hello' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(
        html`<lr-ebook-viewer src="https://example.test/book.epub" location="epubcfi(/6/4!)"></lr-ebook-viewer>`,
      )) as LyraEbookViewer;
      await aTimeout(20);
      expect(fake.displayedCfis).to.include('epubcfi(/6/4!)');
    } finally {
      restore();
    }
  });

  it('does not re-trigger rendition.display() from its own relocated event (loop guard)', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'hello' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      const before = fake.displayedCfis.length;
      fake.relocate({ start: { cfi: 'epubcfi(/6/2!)', href: 'ch1.xhtml' } });
      expect(el.location).to.equal('epubcfi(/6/2!)');
      expect(fake.displayedCfis.length).to.equal(before); // relocated updates the property without re-displaying
      await aTimeout(20); // the guard must also hold once the deferred update actually runs
      expect(fake.displayedCfis.length).to.equal(before);
    } finally {
      restore();
    }
  });

  it('emits lr-location-change on relocated', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'hello' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      const listener = oneEvent(el, 'lr-location-change');
      fake.relocate({ start: { cfi: 'epubcfi(/6/2!)', href: 'ch1.xhtml' } });
      const event = (await listener) as CustomEvent<{ cfi: string; href: string }>;
      expect(event.detail).to.deep.equal({ cfi: 'epubcfi(/6/2!)', href: 'ch1.xhtml' });
    } finally {
      restore();
    }
  });

  it('applies an externally-assigned location immediately once the book is ready', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'hello' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      el.location = 'epubcfi(/6/10!)';
      await aTimeout(20);
      expect(fake.displayedCfis).to.include('epubcfi(/6/10!)');
    } finally {
      restore();
    }
  });
});

describe('lr-ebook-viewer search', () => {
  it('finds matches across spine sections in order and navigates', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'no match', 'ch2.xhtml': 'the treasure map' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      const count = await el.search('treasure');
      expect(count).to.equal(1);
      expect(await el.searchNext()).to.be.true;
      expect(fake.highlightCalls.length).to.be.greaterThan(0);
    } finally {
      restore();
    }
  });

  it('aborts a stale scan when a newer search() call supersedes it', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'apple', 'ch2.xhtml': 'banana' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      const stale = el.search('apple');
      const fresh = await el.search('banana');
      await stale;
      expect(fresh).to.equal(1);
    } finally {
      restore();
    }
  });

  it('emits lr-search-change with the query, match count, and active index', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'no match', 'ch2.xhtml': 'the treasure map' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      const listener = oneEvent(el, 'lr-search-change');
      await el.search('treasure');
      const event = (await listener) as CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
      expect(event.detail).to.deep.equal({ query: 'treasure', matchCount: 1, activeIndex: 0 });
      expect(fake.highlightCalls.some((call) => call.className === 'lr-ebook-search')).to.be.true;
    } finally {
      restore();
    }
  });

  it('clearSearch() resets to a 0-match state and emits lr-search-change', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'no match', 'ch2.xhtml': 'the treasure map' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      await el.search('treasure');
      const listener = oneEvent(el, 'lr-search-change');
      el.clearSearch();
      const event = (await listener) as CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
      expect(event.detail).to.deep.equal({ query: '', matchCount: 0, activeIndex: -1 });
    } finally {
      restore();
    }
  });

  it('resolves 0 and resets to a no-match state for an empty query, or before a book has loaded', async () => {
    const fresh = (await fixture(html`<lr-ebook-viewer></lr-ebook-viewer>`)) as LyraEbookViewer;
    expect(await fresh.search('anything')).to.equal(0); // no book loaded yet

    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'the treasure map' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      expect(await el.search('   ')).to.equal(0); // whitespace-only query
    } finally {
      restore();
    }
  });

  it('resolves 0 matches when the query is not found anywhere in the spine', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'nothing relevant here' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      expect(await el.search('zzzznotfound')).to.equal(0);
    } finally {
      restore();
    }
  });

  it('resolves 0 matches (instead of throwing) against a loaded book with no spine', async () => {
    const fake = fakeBook(); // no `spine` field at all
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      expect(await el.search('anything')).to.equal(0);
    } finally {
      restore();
    }
  });

  it('binds book.load into item.load() and tolerates a nullish item.find() result', async () => {
    const fake = fakeBookWithLoadBinding();
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      expect(await el.search('anything')).to.equal(0);
      expect(fake.loadArgs).to.have.lengthOf(1);
      expect(typeof fake.loadArgs[0]).to.equal('function'); // book.load was bound and forwarded
    } finally {
      restore();
    }
  });

  it('skips a spine section that throws instead of aborting the whole scan', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'apple', 'ch2.xhtml': 'banana' });
    fake.book.spine.spineItems[0].find = () => { throw new Error('boom'); };
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      expect(await el.search('banana')).to.equal(1);
    } finally {
      restore();
    }
  });

  it('applies the stale-scan guard after finishing its last spine item too, not just mid-loop', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'apple pie' }); // single spine item
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      const stale = el.search('apple');
      el.clearSearch(); // bumps the search generation synchronously while `stale` is suspended mid-scan
      expect(await stale).to.equal(0); // the post-loop generation guard discards the stale scan's own result
    } finally {
      restore();
    }
  });

  it('searchNext() and searchPrevious() resolve false and no-op when there are no matches', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'hello' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      expect(await el.searchNext()).to.be.false;
      expect(await el.searchPrevious()).to.be.false;
    } finally {
      restore();
    }
  });

  it('searchPrevious() wraps to the last match and paints it', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'apple pie', 'ch2.xhtml': 'apple tart' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      const count = await el.search('apple');
      expect(count).to.equal(2);
      fake.highlightCalls.length = 0;
      expect(await el.searchPrevious()).to.be.true; // wraps from index 0 to the last match
      expect(fake.displayedCfis[fake.displayedCfis.length - 1]).to.equal('epubcfi(/6/2!/4/ch2.xhtml)');
      expect(fake.highlightCalls.some((call) => call.className === 'lr-ebook-search')).to.be.true;
    } finally {
      restore();
    }
  });

  it('showSearchMatch() is a defensive no-op for an out-of-range index', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'apple' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      await el.search('apple');
      await (el as unknown as { showSearchMatch: (i: number) => Promise<void> }).showSearchMatch(99); // must not throw
    } finally {
      restore();
    }
  });

  it('announces search results through the visually-hidden live region', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'no match', 'ch2.xhtml': 'the treasure map' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      await el.search('treasure');
      await aTimeout(600); // the shared Announcer's default throttle window
      expect(el.shadowRoot!.querySelector('[part="announcer"]')!.textContent).to.equal('Match 1 of 1');
    } finally {
      restore();
    }
  });
});

describe('scrollToAnchor (ebook)', () => {
  it('reports its supported anchor kinds', async () => {
    const el = (await fixture(html`<lr-ebook-viewer></lr-ebook-viewer>`)) as LyraEbookViewer;
    expect(el.anchorKinds).to.deep.equal(['cfi', 'text-quote']);
  });

  it('declines any anchor before a book has loaded (no rendition yet)', async () => {
    const el = (await fixture(html`<lr-ebook-viewer></lr-ebook-viewer>`)) as LyraEbookViewer;
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    expect(await el.scrollToAnchor({ kind: 'cfi', cfi: 'epubcfi(/6/2!)' })).to.be.false;
  });

  it('declines an anchor kind it does not support', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'hello' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
      (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
      expect(await el.scrollToAnchor({ kind: 'page', page: 1 })).to.be.false;
    } finally {
      restore();
    }
  });

  it('displays an exact cfi anchor', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'hello' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      expect(await el.scrollToAnchor({ kind: 'cfi', cfi: 'epubcfi(/6/8!)' })).to.be.true;
      expect(fake.displayedCfis).to.include('epubcfi(/6/8!)');
    } finally {
      restore();
    }
  });

  it('resolves false for a text-quote absent from every section', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'hello world' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
      (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
      expect(await el.scrollToAnchor({ kind: 'text-quote', quote: 'not present anywhere' })).to.be.false;
    } finally {
      restore();
    }
  });

  it('displays a text-quote anchor found in a spine section', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'hello world' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      expect(await el.scrollToAnchor({ kind: 'text-quote', quote: 'world' })).to.be.true;
      expect(fake.displayedCfis).to.include('epubcfi(/6/2!/4/ch1.xhtml)');
    } finally {
      restore();
    }
  });

  it('resolves a text-quote anchor past a spine section that throws, instead of aborting the scan', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'apple', 'ch2.xhtml': 'banana' });
    fake.book.spine.spineItems[0].find = () => { throw new Error('boom'); };
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      expect(await el.scrollToAnchor({ kind: 'text-quote', quote: 'banana' })).to.be.true;
    } finally {
      restore();
    }
  });

  it('binds book.load into item.load() and tolerates a nullish item.find() result while scanning for a text-quote', async () => {
    const fake = fakeBookWithLoadBinding();
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
      (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
      expect(await el.scrollToAnchor({ kind: 'text-quote', quote: 'anything' })).to.be.false;
      expect(fake.loadArgs.length).to.be.greaterThan(0);
    } finally {
      restore();
    }
  });

  it('resolves a text-quote anchor as not found (instead of throwing) against a loaded book with no spine', async () => {
    const fake = fakeBook(); // no `spine` field at all
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
      (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
      expect(await el.scrollToAnchor({ kind: 'text-quote', quote: 'anything' })).to.be.false;
    } finally {
      restore();
    }
  });

  it('declines a text-quote anchor if internal state has no book, defensively (book/rendition normally move in lockstep)', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'hello' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
      (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
      (el as unknown as { book: unknown }).book = undefined; // rendition stays set
      expect(await el.scrollToAnchor({ kind: 'text-quote', quote: 'hello' })).to.be.false;
    } finally {
      restore();
    }
  });

  it('repaintHighlights() is a no-op before a book has loaded (defensive guard)', async () => {
    const el = (await fixture(html`<lr-ebook-viewer></lr-ebook-viewer>`)) as LyraEbookViewer;
    expect(() => (el as unknown as { repaintHighlights: () => void }).repaintHighlights()).to.not.throw();
  });

  it('skips a highlight whose anchor is not a cfi when painting', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'hello world' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      el.highlights = [
        { id: 'quote-hl', anchor: { kind: 'text-quote', quote: 'world' } },
        { id: 'cfi-hl', anchor: { kind: 'cfi', cfi: 'epubcfi(/6/6!)' } },
      ];
      await el.updateComplete;
      expect(fake.highlightCalls).to.have.lengthOf(1);
      expect(fake.highlightCalls[0].cfi).to.equal('epubcfi(/6/6!)');
    } finally {
      restore();
    }
  });

  it('removes a previously-painted highlight before repainting, when highlights change without a reload', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'hello world' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      el.highlights = [{ id: 'h1', anchor: { kind: 'cfi', cfi: 'epubcfi(/6/6!)' } }];
      await el.updateComplete;
      expect(fake.highlightCalls.some((call) => call.cfi === 'epubcfi(/6/6!)')).to.be.true;

      // Same live rendition (no reload/reconnect) -- repaintHighlights() must first remove the
      // highlight it painted last time before painting the new set.
      el.highlights = [{ id: 'h2', anchor: { kind: 'cfi', cfi: 'epubcfi(/6/8!)' } }];
      await el.updateComplete;
      expect(fake.removeCalls).to.include('epubcfi(/6/6!)');
      expect(fake.highlightCalls.some((call) => call.cfi === 'epubcfi(/6/8!)')).to.be.true;
    } finally {
      restore();
    }
  });

  it('paints a cfi highlight via rendition.annotations.highlight() and re-applies it after a reconnect remount', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'hello world' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      el.highlights = [{ id: 'h1', anchor: { kind: 'cfi', cfi: 'epubcfi(/6/6!)' } }];
      await el.updateComplete;
      expect(fake.highlightCalls.some((call) => call.cfi === 'epubcfi(/6/6!)')).to.be.true;

      fake.highlightCalls.length = 0;
      const otherContainer = document.createElement('div');
      document.body.appendChild(otherContainer);
      otherContainer.appendChild(el); // disconnect + reconnect synchronously, same instance
      await aTimeout(20);
      expect(fake.highlightCalls.some((call) => call.cfi === 'epubcfi(/6/6!)')).to.be.true;
      otherContainer.remove();
    } finally {
      restore();
    }
  });
});

describe('back-compat', () => {
  it('prev/next/teardown behavior is unchanged with every new prop left unset', async () => {
    const fake = fakeBook();
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lr-ebook-viewer src="https://example.test/book.epub"></lr-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      const next = el.shadowRoot!.querySelector('[part="next-button"]') as HTMLButtonElement;
      next.click();
      expect(fake.calls.next).to.equal(1);
      el.remove();
      expect(fake.calls.destroy).to.equal(1);
    } finally {
      restore();
    }
  });
});
