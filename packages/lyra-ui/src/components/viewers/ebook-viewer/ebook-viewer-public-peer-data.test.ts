import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { __setEpubJsForTesting, type EpubBook } from './ebook-loader.js';
import { MINIMAL_EPUB_BASE64 } from './fixtures/minimal-epub-fixture.js';
import type { LyraEbookViewer } from './ebook-viewer.class.js';
import './ebook-viewer.js';

type SpineItem = NonNullable<NonNullable<EpubBook['spine']>['spineItems']>[number];
const originalFetch = window.fetch;
const bytes = Uint8Array.from(atob(MINIMAL_EPUB_BASE64), character => character.charCodeAt(0));
afterEach(() => { window.fetch = originalFetch; __setEpubJsForTesting(undefined); });

function peer() {
  const callbacks = new Map<string, unknown>();
  const displayed: Array<string | undefined> = [];
  const rendition: ReturnType<EpubBook['renderTo']> = {
    display: target => { displayed.push(target); return Promise.resolve(); },
    prev: () => Promise.resolve(), next: () => Promise.resolve(),
    on(type: string, callback: unknown) { callbacks.set(type, callback); },
    annotations: { highlight: () => {}, remove: () => {} },
  };
  const item: SpineItem = { load: () => Promise.resolve(), find: () => [{ cfi: 'match-cfi', excerpt: 'A match' }], unload: () => {} };
  const book: EpubBook = {
    ready: Promise.resolve(), load: () => Promise.resolve(), destroy: () => {}, renderTo: () => rendition,
    spine: { spineItems: [item] }, navigation: { toc: [{ id: 'chapter', href: 'chapter.xhtml', label: 'Chapter' }] },
  };
  return { book, rendition, callbacks, displayed, item };
}

function provide(book: EpubBook): void {
  __setEpubJsForTesting(() => book);
  window.fetch = async () => new Response(bytes);
}

async function ready(element: LyraEbookViewer, fake: ReturnType<typeof peer>): Promise<void> {
  await waitUntil(() => fake.callbacks.has('relocated') && element.shadowRoot!.querySelector<HTMLButtonElement>('[part="next-button"]')?.disabled === false);
}

async function mount(fake: ReturnType<typeof peer>): Promise<LyraEbookViewer> {
  provide(fake.book);
  const element = await fixture<LyraEbookViewer>(html`<lr-ebook-viewer src="https://example.test/peer-data.epub"></lr-ebook-viewer>`);
  await ready(element, fake);
  return element;
}

function invalidLengthArray(): unknown[] {
  return new Proxy([], { getOwnPropertyDescriptor(target, key) {
    const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
    return key === 'length' && descriptor ? { ...descriptor, value: -1 } : descriptor;
  } });
}

for (const kind of ['spine', 'find', 'toc'] as const) {
  it(`contains an invalid peer ${kind} length and restores usable search/navigation after replacement`, async () => {
    const fake = peer();
    const malformed = invalidLengthArray();
    if (kind === 'spine') Reflect.set(fake.book.spine!, 'spineItems', malformed);
    else if (kind === 'find') Reflect.set(fake.item, 'find', () => malformed);
    else Reflect.set(fake.book.navigation!, 'toc', malformed);
    const element = await mount(fake);
    if (kind === 'toc') expect(await element.getToc()).to.deep.equal([]);
    else {
      const searched = oneEvent(element, 'lr-search-change');
      expect(await element.search('match')).to.equal(0);
      expect((await searched).detail).to.deep.include({ matchCount: 0, matchCountExact: false, activeIndex: -1 });
    }
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
    const replacement = peer();
    provide(replacement.book);
    element.src = 'https://example.test/replacement-peer-data.epub';
    await ready(element, replacement);
    const searched = oneEvent(element, 'lr-search-change');
    expect(await element.search('match')).to.equal(1);
    expect((await searched).detail).to.deep.include({ matchCount: 1, matchCountExact: true, activeIndex: 0 });
    expect(replacement.displayed.at(-1)).to.equal('match-cfi');
    expect(await element.getToc()).to.deep.equal([{ id: 'chapter', href: 'chapter.xhtml', label: 'Chapter', level: 1 }]);
  });
}

it('retains usable EPUB matches when a peer excerpt exceeds the shared search text budget', async () => {
  const fake = peer();
  fake.item.find = () => [{ cfi: 'first-cfi', excerpt: 'x'.repeat(4_000_001) }, { cfi: 'second-cfi', excerpt: 'A bounded match' }];
  const element = await mount(fake);
  const searched = oneEvent(element, 'lr-search-change');
  expect(await element.search('match')).to.equal(2);
  expect((await searched).detail).to.deep.include({ matchCount: 2, matchCountExact: false, activeIndex: 0 });
  expect(fake.displayed.at(-1)).to.equal('first-cfi');
  expect(await element.searchNext()).to.equal(true);
  expect(fake.displayed.at(-1)).to.equal('second-cfi');
  expect(await element.searchPrevious()).to.equal(true);
  expect(fake.displayed.at(-1)).to.equal('first-cfi');
  expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
});

it('applies the registered network-silent chapter hook without invalidating an empty chapter document', async () => {
  const fake = peer();
  const hooks: Array<(chapter: Document) => void> = [];
  Reflect.set(fake.book.spine!, 'hooks', { content: { register(callback: (chapter: Document) => void) { hooks.push(callback); } } });
  const chapter = new DOMParser().parseFromString(
    '<?xml-stylesheet href="https://example.test/chapter.css"?><html><head><link rel="preconnect" href="https://example.test/"/><link rel="dns-prefetch" href="https://example.test/"/><meta http-equiv="refresh" content="0;url=https://example.test/"/><style>p { color: green; }</style></head><body><p>Reading content</p></body></html>',
    'application/xhtml+xml',
  );
  const empty = document.implementation.createDocument(null, '');
  const renderTo = fake.book.renderTo;
  fake.book.renderTo = (mountPoint, options) => {
    if (hooks.length !== 1) throw new Error('The chapter content hook was not registered.');
    hooks[0]!(empty);
    hooks[0]!(chapter);
    return renderTo(mountPoint, options);
  };
  const element = await mount(fake);
  expect(Array.from(chapter.childNodes, node => node.nodeType).includes(Node.PROCESSING_INSTRUCTION_NODE)).to.equal(false);
  expect(chapter.querySelectorAll('link').length).to.equal(0);
  expect(chapter.querySelectorAll('meta[http-equiv="refresh"]').length).to.equal(0);
  const policy = chapter.querySelector('head')?.firstElementChild;
  expect(policy?.getAttribute('http-equiv')).to.equal('Content-Security-Policy');
  expect(policy?.getAttribute('content')).to.contain("default-src 'none'");
  expect(policy?.getAttribute('content')).to.contain('img-src blob: data:');
  expect(chapter.querySelector('style')?.textContent).to.equal('p { color: green; }');
  expect(chapter.querySelector('p')?.textContent).to.equal('Reading content');
  expect(empty.documentElement === null).to.equal(true);
  expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
});

it('accepts synchronous peer navigation completion and relays the resulting public location', async () => {
  const fake = peer();
  Reflect.set(fake.rendition, 'display', (target?: string) => { fake.displayed.push(target); });
  const relocate = (cfi: string) => {
    const callback = fake.callbacks.get('relocated') as (value: { start: { cfi: string } }) => void;
    callback({ start: { cfi } });
  };
  Reflect.set(fake.rendition, 'next', () => { relocate('next-cfi'); });
  Reflect.set(fake.rendition, 'prev', () => { relocate('previous-cfi'); });
  const element = await mount(fake);
  for (const [part, cfi] of [['next-button', 'next-cfi'], ['previous-button', 'previous-cfi']] as const) {
    const changed = oneEvent(element, 'lr-location-change');
    element.shadowRoot!.querySelector<HTMLButtonElement>(`[part="${part}"]`)!.click();
    expect((await changed).detail).to.deep.equal({ cfi, href: '' });
    await element.updateComplete;
    expect(element.location).to.equal(cfi);
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  }
});
