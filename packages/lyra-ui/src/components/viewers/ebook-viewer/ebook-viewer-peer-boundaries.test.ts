import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './ebook-viewer.js';
import type { LyraEbookViewer } from './ebook-viewer.js';
import { __setEpubJsForTesting, type EpubBook } from './ebook-loader.js';
import { MINIMAL_EPUB_BASE64 } from './fixtures/minimal-epub-fixture.js';

type SpineItem = NonNullable<NonNullable<EpubBook['spine']>['spineItems']>[number];
const originalFetch = window.fetch;
afterEach(() => {
  window.fetch = originalFetch;
  __setEpubJsForTesting(undefined);
});

function peer() {
  const callbacks = new Map<string, unknown>();
  const displayed: Array<string | undefined> = [];
  const rendition: ReturnType<EpubBook['renderTo']> = {
    display: (target) => { displayed.push(target); return Promise.resolve(); },
    prev: () => Promise.resolve(), next: () => Promise.resolve(),
    on(type: string, callback: unknown) { callbacks.set(type, callback); },
    annotations: { highlight: () => {}, remove: () => {} },
  };
  const book: EpubBook = {
    ready: Promise.resolve(), load: () => Promise.resolve(), destroy: () => {},
    renderTo: () => rendition,
  };
  return { book, rendition, callbacks, displayed };
}

function provide(book: EpubBook): void {
  __setEpubJsForTesting(() => book);
  const bytes = Uint8Array.from(atob(MINIMAL_EPUB_BASE64), character => character.charCodeAt(0));
  window.fetch = (() => Promise.resolve(new Response(bytes))) as typeof fetch;
}

async function mount(book: EpubBook): Promise<LyraEbookViewer> {
  provide(book);
  const element = await fixture<LyraEbookViewer>(html`<lr-ebook-viewer src="https://example.test/boundaries.epub"></lr-ebook-viewer>`);
  await waitUntil(() => element.shadowRoot!.querySelector<HTMLButtonElement>('[part="next-button"]')?.disabled === false);
  return element;
}

it('searches valid later spine sections after holes and malformed sections without claiming an exact count', async () => {
  const { book, displayed } = peer();
  const sections = new Array<SpineItem>(3);
  sections[1] = {} as SpineItem;
  sections[2] = { load: () => Promise.resolve(), find: () => [{ cfi: 'safe-cfi', excerpt: 'Safe match' }], unload: () => {} };
  book.spine = { spineItems: sections };
  const element = await mount(book);
  const pending = oneEvent(element, 'lr-search-change');
  expect(await element.search('safe')).to.equal(1);
  expect((await pending).detail).to.deep.include({ matchCount: 1, matchCountExact: false, activeIndex: 0 });
  expect(displayed.at(-1)).to.equal('safe-cfi');
});

it('retains usable CFIs with malformed excerpts and rejects malformed CFIs from a peer result', async () => {
  const { book, displayed } = peer();
  const results = [{ cfi: 12 }, { cfi: 'usable-cfi', excerpt: 42 }];
  book.spine = { spineItems: [{ load: () => Promise.resolve(), find: () => results as unknown as ReturnType<SpineItem['find']>, unload: () => {} }] };
  const element = await mount(book);
  const pending = oneEvent(element, 'lr-search-change');
  expect(await element.search('match')).to.equal(1);
  expect((await pending).detail.matchCountExact).to.equal(false);
  expect(displayed.at(-1)).to.equal('usable-cfi');
});

it('contains a synchronous result-thenable failure and throwing cleanup while searching later chapters', async () => {
  const { book, displayed } = peer();
  let unloads = 0;
  book.spine = { spineItems: [
    { load: () => Promise.resolve(), find: () => ({ then() { throw new Error('peer result failure'); } }) as unknown as ReturnType<SpineItem['find']>, unload: () => { unloads++; throw new Error('cleanup failure'); } },
    { load: () => Promise.resolve(), find: () => [{ cfi: 'later-cfi' }], unload: () => { unloads++; } },
  ] };
  const element = await mount(book);
  const pending = oneEvent(element, 'lr-search-change');
  expect(await element.search('later')).to.equal(1);
  expect((await pending).detail.matchCountExact).to.equal(false);
  expect(unloads).to.equal(2);
  expect(displayed.at(-1)).to.equal('later-cfi');
});

it('preserves a found text-quote anchor when its section cleanup throws', async () => {
  const { book, displayed } = peer();
  let unloads = 0;
  book.spine = { spineItems: [{ load: () => Promise.resolve(), find: () => [{ cfi: 'quote-cfi' }], unload: () => { unloads++; throw new Error('optional cleanup failure'); } }] };
  const element = await mount(book);
  expect(await element.scrollToAnchor({ kind: 'text-quote', quote: 'quoted passage' })).to.equal(true);
  expect(unloads).to.equal(1);
  expect(displayed.at(-1)).to.equal('quote-cfi');
  expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
});

it('contains a throwing chapter-selection callback payload and keeps navigation usable', async () => {
  const { book, callbacks, displayed } = peer();
  const element = await mount(book);
  let selections = 0;
  element.addEventListener('lr-text-select', () => selections++);
  const selected = callbacks.get('selected') as (cfi: string, contents: unknown) => void;
  selected('selection-cfi', { window: { getSelection() { throw new Error('selection unavailable'); } } });
  expect(selections).to.equal(0);
  expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  expect(await element.scrollToAnchor({ kind: 'cfi', cfi: 'still-usable' })).to.equal(true);
  expect(displayed.at(-1)).to.equal('still-usable');
});

for (const boundary of ['descriptor', 'prototype', 'ready-thenable', 'display-thenable'] as const) {
  it(`shows a localized load failure when a required peer ${boundary} fails synchronously`, async () => {
    const { book, rendition } = peer();
    let provided: EpubBook = book;
    if (boundary === 'descriptor') provided = new Proxy(book, { getOwnPropertyDescriptor() { throw new Error('private peer detail'); } });
    if (boundary === 'prototype') provided = new Proxy({} as EpubBook, { getPrototypeOf() { throw new Error('private peer detail'); } });
    if (boundary === 'ready-thenable') book.ready = { then() { throw new Error('private peer detail'); } } as unknown as Promise<void>;
    if (boundary === 'display-thenable') rendition.display = () => ({ then() { throw new Error('private peer detail'); } }) as unknown as Promise<void>;
    provide(provided);
    const element = await fixture<LyraEbookViewer>(html`<lr-ebook-viewer></lr-ebook-viewer>`);
    const pending = oneEvent(element, 'lr-render-error');
    element.src = 'https://example.test/invalid-peer.epub';
    await pending;
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal('Failed to load the ebook.');
    expect(element.shadowRoot!.textContent).not.to.contain('private peer detail');
    expect(element.shadowRoot!.querySelector<HTMLButtonElement>('[part="next-button"]')?.disabled).to.equal(true);
  });
}
