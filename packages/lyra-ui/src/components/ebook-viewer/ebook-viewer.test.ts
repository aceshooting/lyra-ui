import { aTimeout, expect, fixture, html, oneEvent } from '@open-wc/testing';
import './ebook-viewer.js';
import { __setEpubJsForTesting } from './ebook-loader.js';
import type { LyraEbookViewer } from './ebook-viewer.js';

function response(ok = true): Response {
  return { ok, status: ok ? 200 : 404, statusText: ok ? 'OK' : 'Not Found', arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)) } as unknown as Response;
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
      remove: () => {},
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
    displayedCfis,
  };
}

afterEach(() => __setEpubJsForTesting(undefined));

describe('lyra-ebook-viewer', () => {
  it('keeps a stable mount and renders an idle state by default', async () => {
    const el = (await fixture(html`<lyra-ebook-viewer></lyra-ebook-viewer>`)) as LyraEbookViewer;
    expect(el.shadowRoot!.querySelector('[part="mount"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.not.exist;
    expect((el.shadowRoot!.querySelector('[part="next-button"]') as HTMLButtonElement).disabled).to.be.true;
  });

  it('gives the page-turn buttons the shared minimum hit area', async () => {
    const el = (await fixture(html`<lyra-ebook-viewer></lyra-ebook-viewer>`)) as LyraEbookViewer;
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
      const el = (await fixture(html`<lyra-ebook-viewer src="https://example.test/book.epub"></lyra-ebook-viewer>`)) as LyraEbookViewer;
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
      const el = (await fixture(html`<lyra-ebook-viewer src="https://example.test/book.epub"></lyra-ebook-viewer>`)) as LyraEbookViewer;
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
      const unsafe = (await fixture(html`<lyra-ebook-viewer .src=${'javascript:alert(1)'}></lyra-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(10);
      expect(unsafe.shadowRoot!.querySelector('[part="error"]')!.textContent).to.contain('Document URL is not allowed');
      __setEpubJsForTesting(null);
      const missing = (await fixture(html`<lyra-ebook-viewer src="https://example.test/book.epub"></lyra-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      expect(missing.shadowRoot!.querySelector('[part="error"]')!.textContent).to.contain('Failed to load the ebook');
    } finally {
      restore();
    }
  });

  it('is accessible and supports localized navigation labels', async () => {
    const el = await fixture(html`<lyra-ebook-viewer .strings=${{ previous: 'Précédent', next: 'Suivant' }}></lyra-ebook-viewer>`);
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
      const el = (await fixture(html`<lyra-ebook-viewer src="https://example.test/book.epub"></lyra-ebook-viewer>`)) as LyraEbookViewer;
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
    const el = (await fixture(html`<lyra-ebook-viewer></lyra-ebook-viewer>`)) as LyraEbookViewer;
    expect(await el.getToc()).to.deep.equal([]);
  });
});

describe('location', () => {
  it('applies a location set before load once the book is ready', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'hello' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(
        html`<lyra-ebook-viewer src="https://example.test/book.epub" location="epubcfi(/6/4!)"></lyra-ebook-viewer>`,
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
      const el = (await fixture(html`<lyra-ebook-viewer src="https://example.test/book.epub"></lyra-ebook-viewer>`)) as LyraEbookViewer;
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

  it('emits lyra-location-change on relocated', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'hello' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lyra-ebook-viewer src="https://example.test/book.epub"></lyra-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      const listener = oneEvent(el, 'lyra-location-change');
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
      const el = (await fixture(html`<lyra-ebook-viewer src="https://example.test/book.epub"></lyra-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      el.location = 'epubcfi(/6/10!)';
      await aTimeout(20);
      expect(fake.displayedCfis).to.include('epubcfi(/6/10!)');
    } finally {
      restore();
    }
  });
});

describe('lyra-ebook-viewer search', () => {
  it('finds matches across spine sections in order and navigates', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'no match', 'ch2.xhtml': 'the treasure map' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lyra-ebook-viewer src="https://example.test/book.epub"></lyra-ebook-viewer>`)) as LyraEbookViewer;
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
      const el = (await fixture(html`<lyra-ebook-viewer src="https://example.test/book.epub"></lyra-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      const stale = el.search('apple');
      const fresh = await el.search('banana');
      await stale;
      expect(fresh).to.equal(1);
    } finally {
      restore();
    }
  });

  it('emits lyra-search-change with the query, match count, and active index', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'no match', 'ch2.xhtml': 'the treasure map' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lyra-ebook-viewer src="https://example.test/book.epub"></lyra-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      const listener = oneEvent(el, 'lyra-search-change');
      await el.search('treasure');
      const event = (await listener) as CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
      expect(event.detail).to.deep.equal({ query: 'treasure', matchCount: 1, activeIndex: 0 });
      expect(fake.highlightCalls.some((call) => call.className === 'lyra-ebook-search')).to.be.true;
    } finally {
      restore();
    }
  });

  it('clearSearch() resets to a 0-match state and emits lyra-search-change', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'no match', 'ch2.xhtml': 'the treasure map' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lyra-ebook-viewer src="https://example.test/book.epub"></lyra-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      await el.search('treasure');
      const listener = oneEvent(el, 'lyra-search-change');
      el.clearSearch();
      const event = (await listener) as CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
      expect(event.detail).to.deep.equal({ query: '', matchCount: 0, activeIndex: -1 });
    } finally {
      restore();
    }
  });

  it('announces search results through the visually-hidden live region', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'no match', 'ch2.xhtml': 'the treasure map' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lyra-ebook-viewer src="https://example.test/book.epub"></lyra-ebook-viewer>`)) as LyraEbookViewer;
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
    const el = (await fixture(html`<lyra-ebook-viewer></lyra-ebook-viewer>`)) as LyraEbookViewer;
    expect(el.anchorKinds).to.deep.equal(['cfi', 'text-quote']);
  });

  it('displays an exact cfi anchor', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'hello' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lyra-ebook-viewer src="https://example.test/book.epub"></lyra-ebook-viewer>`)) as LyraEbookViewer;
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
      const el = (await fixture(html`<lyra-ebook-viewer src="https://example.test/book.epub"></lyra-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
      (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
      expect(await el.scrollToAnchor({ kind: 'text-quote', quote: 'not present anywhere' })).to.be.false;
    } finally {
      restore();
    }
  });

  it('paints a cfi highlight via rendition.annotations.highlight() and re-applies it after a reconnect remount', async () => {
    const fake = fakeBookWithFeatures({ 'ch1.xhtml': 'hello world' });
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lyra-ebook-viewer src="https://example.test/book.epub"></lyra-ebook-viewer>`)) as LyraEbookViewer;
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
      const el = (await fixture(html`<lyra-ebook-viewer src="https://example.test/book.epub"></lyra-ebook-viewer>`)) as LyraEbookViewer;
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
