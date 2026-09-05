import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './ebook-viewer.js';
import { __setEpubJsForTesting, type EpubBook } from './ebook-loader.js';
import type { LyraEbookViewer } from './ebook-viewer.js';
import type { TextSelectDetail } from '../document-viewer/anchors.js';
import { TEXT_QUOTE_LIMITS, TEXT_SELECTION_RECT_LIMIT } from '../../../internal/text-quote.js';
import { MINIMAL_EPUB_BASE64 } from './fixtures/minimal-epub-fixture.js';

const originalFetch = window.fetch;
afterEach(() => {
  window.fetch = originalFetch;
  __setEpubJsForTesting(undefined);
});

async function mountedBook() {
  const selected: Array<(cfi: string, contents: unknown) => void> = [];
  const chapters: HTMLIFrameElement[] = [];
  const rendition = {
    display: () => Promise.resolve(), prev: () => Promise.resolve(), next: () => Promise.resolve(),
    annotations: { highlight: () => {}, remove: () => {} },
    on(type: string, callback: (...args: never[]) => void) {
      if (type === 'selected') selected.push(callback as (cfi: string, contents: unknown) => void);
    },
  };
  const book: EpubBook = {
    ready: Promise.resolve(), load: () => Promise.resolve(), destroy: () => {},
    renderTo(mount) {
      const frame = mount.ownerDocument.createElement('iframe');
      frame.style.cssText = 'inline-size:300px;block-size:100px;border:0';
      mount.append(frame);
      frame.contentDocument!.body.textContent = 'Native chapter selection';
      chapters.push(frame);
      return rendition;
    },
  };
  __setEpubJsForTesting(() => book);
  const bytes = Uint8Array.from(atob(MINIMAL_EPUB_BASE64), (character) => character.charCodeAt(0));
  window.fetch = (() => Promise.resolve(new Response(bytes))) as typeof fetch;
  const el = await fixture<LyraEbookViewer>(html`<lr-ebook-viewer src="https://example.test/native.epub"></lr-ebook-viewer>`);
  await waitUntil(() => selected.length === 1 && chapters.length === 1);
  const frame = chapters[0]!;
  const view = frame.contentWindow!;
  const document = frame.contentDocument!;
  const selection = view.getSelection()!;
  const range = document.createRange();
  range.selectNodeContents(document.body);
  selection.removeAllRanges();
  selection.addRange(range);
  expect(selection.rangeCount).to.equal(1);
  return { el, frame, view, document, selection, range, selected, chapters };
}

it('emits bounded text, CFI and translated rectangles from a genuine chapter iframe Selection', async () => {
  const { el, view, frame, selection, selected } = await mountedBook();
  const events: TextSelectDetail[] = [];
  el.addEventListener('lr-text-select', (event) => events.push(event.detail));
  const cfi = 'epubcfi(/6/2!/4/2:0,/4/2:24)';
  expect(selection.toString()).to.equal('Native chapter selection');
  selected[0]!(cfi, { window: view });
  expect(events.length).to.equal(1);
  expect(events[0]!.text).to.equal('Native chapter selection');
  expect(events[0]!.anchor).to.deep.equal({ kind: 'cfi', cfi });
  expect(events[0]!.rects.length).to.be.greaterThan(0);
  expect(events[0]!.rects.every((rect) => Number.isFinite(rect.x) && Number.isFinite(rect.y) && rect.width > 0)).to.equal(true);
  expect(events[0]!.rects[0]!.x).to.be.at.least(frame.getBoundingClientRect().left);
  selection.collapseToStart();
  selected[0]!(cfi, { window: view });
  expect(events.length).to.equal(1);
});

it('bounds a genuine native selection without reading shadowing peer accessors', async () => {
  const { el, view, document, selection, range, selected } = await mountedBook();
  document.body.textContent = 'x'.repeat(TEXT_QUOTE_LIMITS.maxQueryCodeUnits + 10);
  range.selectNodeContents(document.body);
  selection.removeAllRanges();
  selection.addRange(range);
  let reads = 0;
  Object.defineProperty(selection, 'rangeCount', { configurable: true, get() { reads++; throw new Error('untrusted accessor'); } });
  Object.defineProperty(selection, 'getRangeAt', { configurable: true, get() { reads++; throw new Error('untrusted method accessor'); } });
  const events: TextSelectDetail[] = [];
  el.addEventListener('lr-text-select', (event) => events.push(event.detail));
  try {
    selected[0]!('epubcfi(/6/2!/4)', { window: view });
    expect(events.length).to.equal(1);
    expect(events[0]!.text.length).to.equal(TEXT_QUOTE_LIMITS.maxQueryCodeUnits);
    expect(events[0]!.rects.length).to.be.at.most(TEXT_SELECTION_RECT_LIMIT);
    expect(reads).to.equal(0);
  } finally {
    Reflect.deleteProperty(selection, 'rangeCount');
    Reflect.deleteProperty(selection, 'getRangeAt');
  }
});

it('contains arbitrary peer accessors and ignores selected callbacks after source replacement or disconnect', async () => {
  const { el, view, selected } = await mountedBook();
  const stale = selected[0]!;
  let reads = 0;
  let events = 0;
  el.addEventListener('lr-text-select', () => events++);
  const badContents = { get window() { reads++; throw new Error('untrusted contents'); } };
  stale('epubcfi(/6/2!/4)', badContents);
  stale('epubcfi(/6/2!/4)', { window: { getSelection: () => ({ get rangeCount() { reads++; throw new Error('untrusted selection'); } }) } });
  expect(reads).to.equal(0);
  expect(events).to.equal(0);
  el.src = 'https://example.test/replacement.epub';
  await waitUntil(() => selected.length === 2);
  stale('epubcfi(/6/2!/4)', { window: view });
  expect(events).to.equal(0);
  el.remove();
  selected[1]!('epubcfi(/6/2!/4)', { window: view });
  expect(events).to.equal(0);
});
