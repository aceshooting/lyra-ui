import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './lightbox.js';
import '../../../translations/fr.js';
import type { LyraLightbox, LyraLightboxImage, LyraLightboxSource } from './lightbox.js';
import type { LyraSourceRecord, LyraSourceRangeRequest } from '../../../data-sources.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

type Source = LyraLightboxSource;
type SourceLightbox = LyraLightbox & { imageSource?: Source };
const src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3C/svg%3E';
const record = (index: number, prefix = 'Image'): LyraSourceRecord<LyraLightboxImage> => ({
  key: String(index), order: index, value: { src, alt: `${prefix} ${index}`, caption: `${prefix} ${index}` },
});
const caption = (el: LyraLightbox) => el.shadowRoot?.querySelector('[part="caption"]')?.textContent ?? '';
const ready = async (el: LyraLightbox, text: string): Promise<void> => {
  await waitUntil(() => caption(el) === text, 'current source image', { timeout: 1500 });
  const frame = el.shadowRoot!.querySelector('lr-pan-zoom')!;
  await frame.updateComplete;
  await waitUntil(() => {
    const image = frame.shadowRoot!.querySelector('img');
    return image?.alt === text && image.complete && image.naturalWidth === 8;
  }, 'current image rendered in the stable frame', { timeout: 1500 });
};

it('reads only first, middle and final descriptors from a million indexed images', async () => {
  let reads = 0;
  const source: Source = { revision: 1, images: { count: 1_000_000, itemAt: index => { reads++; return record(index); } } };
  const el = await fixture<SourceLightbox>(html`<lr-lightbox .imageSource=${source}></lr-lightbox>`);
  await ready(el, 'Image 0');
  el.goTo(500_000); await ready(el, 'Image 500000');
  el.goTo(999_999); await ready(el, 'Image 999999');
  expect(el.index).to.equal(999_999);
  expect(el.shadowRoot!.querySelector('[part="counter"]')!.textContent).to.equal('Image 1000000 of 1000000');
  expect(reads).to.equal(3);
  expect(el.shadowRoot!.querySelectorAll('[part="frame"]').length).to.equal(1);
  el.loop = true; el.next(); await ready(el, 'Image 0');
  expect(el.index).to.equal(0);
  expect(reads).to.equal(3);
  recordScaleMeasurement('lr-lightbox', 'n=1000000 first middle final loop', { descriptorReads: reads, frameCount: 1 });
});

it('retains a pending logical index and ignores a replaced ranged source', async () => {
  const pending: { request: LyraSourceRangeRequest; resolve: (records: readonly LyraSourceRecord<LyraLightboxImage>[]) => void }[] = [];
  const source: Source = { revision: 1, images: { count: 1_000_000, read: request => new Promise(resolve => pending.push({ request, resolve })) } };
  const el = await fixture<SourceLightbox>(html`<lr-lightbox .imageSource=${source} .index=${500_000}></lr-lightbox>`);
  await waitUntil(() => pending.length === 1, 'source read', { timeout: 1500 });
  expect(el.index).to.equal(500_000);
  expect(pending[0]!.request.offset).to.equal(500_000);
  expect(pending[0]!.request.limit).to.equal(1);
  el.imageSource = { revision: 2, images: { count: 1_000_000, itemAt: index => record(index, 'New') } };
  expect(pending[0]!.request.signal.aborted).to.equal(true);
  await ready(el, 'New 500000');
  pending[0]!.resolve([record(500_000, 'Old')]);
  await new Promise(resolve => setTimeout(resolve, 30));
  expect(caption(el)).to.equal('New 500000');
});

it('refreshes an indexed callback on a keyless update coalesced with named writes and restores legacy images on unset', async () => {
  let prefix = 'Before'; let reads = 0;
  const source: Source = { revision: 1, images: { count: 1_000_000, itemAt: index => { reads++; return record(index, prefix); } } };
  const el = await fixture<SourceLightbox>(html`<lr-lightbox .imageSource=${source} .images=${[record(0, 'Legacy').value]}></lr-lightbox>`);
  await ready(el, 'Before 0');
  prefix = 'After'; el.requestUpdate(); el.withoutCounter = true;
  await ready(el, 'After 0'); expect(reads).to.equal(2);
  el.fit = 'contain'; await el.updateComplete; expect(reads).to.equal(2);
  el.imageSource = undefined; await ready(el, 'Legacy 0');
});

it('fails closed for a defined invalid source instead of displaying legacy input', async () => {
  const el = await fixture<SourceLightbox>(html`<lr-lightbox .imageSource=${{ revision: 1, images: { count: -1 } }} .images=${[record(0, 'Legacy').value]}></lr-lightbox>`);
  expect(caption(el)).to.equal('');
  expect(el.shadowRoot!.querySelector('[part="source-error"]') !== null).to.equal(true);
});

it('reads single-image ranges at first middle and final positions without prefetch', async () => {
  const offsets: number[] = [];
  const source: Source = { revision: 1, images: { count: 1_000_000, read: async request => {
    expect(request.limit).to.equal(1); offsets.push(request.offset); return [record(request.offset)];
  } } };
  const el = await fixture<SourceLightbox>(html`<lr-lightbox .imageSource=${source}></lr-lightbox>`);
  for (const index of [0, 500_000, 999_999]) { el.goTo(index); await ready(el, `Image ${index}`); }
  expect(offsets).to.deep.equal([0, 500_000, 999_999]);
  const window = (el as unknown as { sourceController: { window: { pages: Map<number, unknown> } } }).sourceController.window;
  expect(window.pages.size).to.equal(3);
  recordScaleMeasurement('lr-lightbox', 'n=1000000 ranged first middle final', { descriptorReads: offsets.length, retainedDescriptors: window.pages.size, frameCount: el.shadowRoot!.querySelectorAll('[part="frame"]').length });
});

it('revokes the old range immediately and queues only the latest requested index', async () => {
  const pending: { request: LyraSourceRangeRequest; resolve: (records: readonly LyraSourceRecord<LyraLightboxImage>[]) => void }[] = [];
  const source: Source = { revision: 1, images: { count: 1_000_000, read: request => new Promise(resolve => pending.push({ request, resolve })) } };
  const el = await fixture<SourceLightbox>(html`<lr-lightbox .imageSource=${source}></lr-lightbox>`);
  await waitUntil(() => pending.length === 1);
  el.goTo(500_000); el.goTo(999_999);
  expect(pending[0]!.request.signal.aborted).to.equal(true);
  expect(el.index).to.equal(999_999);
  expect(pending.length).to.equal(1);
  pending[0]!.resolve([record(0)]);
  await waitUntil(() => pending.length === 2);
  expect(pending[1]!.request.offset).to.equal(999_999);
  pending[1]!.resolve([record(999_999)]);
  await ready(el, 'Image 999999');
  expect(pending.length).to.equal(2);
});

it('bounds descriptor fields, never invokes data getters and retries a failed current range', async () => {
  let getterCalls = 0; let fail = true;
  const value = { ...record(0).value, get caption() { getterCalls++; return 'getter'; } };
  const source: Source = { revision: 1, images: { count: 1_000_000, read: async () => fail ? [{ ...record(0), value }] : [record(0, 'Retry')] } };
  const el = await fixture<SourceLightbox>(html`<lr-lightbox .imageSource=${source}></lr-lightbox>`);
  await waitUntil(() => el.shadowRoot!.querySelector('[part="source-error"]') !== null);
  expect(getterCalls).to.equal(0);
  fail = false;
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-retry"]')!.click();
  await ready(el, 'Retry 0');
  el.imageSource = { revision: 2, images: { count: 1, itemAt: () => ({ ...record(0), value: { ...record(0).value, caption: 'x'.repeat(65_537) } }) } };
  await waitUntil(() => el.shadowRoot!.querySelector('[part="source-error"]') !== null);
  expect(caption(el)).to.equal('');
  el.imageSource = { revision: 3, images: { count: 1, itemAt: () => ({ ...record(0), value: { src: 'javascript:alert(1)' } }) } };
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="source-error"]') !== null);
  expect(el.shadowRoot!.querySelector('lr-pan-zoom')!.src).to.equal('');
});

it('ignores obsolete image load callbacks and resets the stable frame on source replacement', async () => {
  const source: Source = { revision: 1, images: { count: 1_000_000, itemAt: index => record(index) } };
  const el = await fixture<SourceLightbox>(html`<lr-lightbox .imageSource=${source}></lr-lightbox>`);
  await ready(el, 'Image 0');
  const frame = el.shadowRoot!.querySelector('lr-pan-zoom')!;
  await el.show();
  frame.zoom = 3; await frame.updateComplete;
  let obsolete: HTMLImageElement | undefined;
  const original = document.createElement;
  document.createElement = function (this: Document, ...args: Parameters<Document['createElement']>): HTMLElement {
    const node = original.apply(this, args);
    if (args[0] === 'img') {
      obsolete = node as HTMLImageElement;
      Object.defineProperty(node, 'src', { configurable: true, set() {}, get: () => src });
    }
    return node;
  } as Document['createElement'];
  try {
    el.imageSource = { ...source, revision: 2 };
    await waitUntil(() => obsolete !== undefined);
    const oldLoad = obsolete!.onload!;
    document.createElement = original;
    el.imageSource = { revision: 3, images: { count: 1_000_000, itemAt: index => record(index, 'Current') } };
    await ready(el, 'Current 0');
    oldLoad.call(obsolete!, new Event('load'));
    await el.updateComplete;
    expect(caption(el)).to.equal('Current 0');
    expect(el.shadowRoot!.querySelector('lr-pan-zoom') === frame).to.equal(true);
    expect(frame.zoom).to.equal(1);
  } finally { document.createElement = original; await el.hide(); }
});



it('announces a current source error separately from its visible localized retry state', async () => {
  const source: Source = { revision: 1, images: { count: 1, itemAt: index => record(index) } };
  const el = await fixture<SourceLightbox>(html`<lr-lightbox .imageSource=${source} .strings=${{ imageViewerFailedToLoad: 'Source unavailable', retry: 'Try again' }}></lr-lightbox>`);
  await ready(el, 'Image 0'); await el.show();
  try {
    el.imageSource = { revision: 2, images: { count: 1, itemAt: () => ({ ...record(0), value: { src: 'javascript:bad' } }) } };
    await waitUntil(() => el.shadowRoot!.querySelector('[part="source-error"]') !== null);
    expect(el.shadowRoot!.querySelector('[part="source-error"]')!.textContent).to.contain('Source unavailable');
    expect(el.shadowRoot!.querySelector('[part="source-retry"]')!.textContent).to.equal('Try again');
    await waitUntil(() => [...document.querySelectorAll(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}]`)].some(sink => sink.textContent?.includes('Source unavailable')), 'light DOM error announcement', { timeout: 1500 });
  } finally { await el.hide(); }
});

it('keeps the current frame source when an index write clamps to the same logical image', async () => {
  const source: Source = { revision: 1, images: { count: 1_000_000, itemAt: index => record(index) } };
  const el = await fixture<SourceLightbox>(html`<lr-lightbox .imageSource=${source}></lr-lightbox>`);
  await ready(el, 'Image 0');
  const frame = el.shadowRoot!.querySelector('lr-pan-zoom')!;
  el.index = 0.5; await el.updateComplete; await frame.updateComplete;
  expect(el.index).to.equal(0);
  expect(frame.src).to.equal(src);
  expect(frame.shadowRoot!.querySelector('img') !== null).to.equal(true);
});



it('rebinds same-source revisions and locale context without unbounded reads', async () => {
  const locales: string[] = [];
  let version = 1;
  const source = { revision: 1, images: { count: 1_000_000, read: async (request: LyraSourceRangeRequest) => {
    locales.push(request.locale); return [record(request.offset, `Version ${version}`)];
  } } };
  const el = await fixture<SourceLightbox>(html`<lr-lightbox .imageSource=${source}></lr-lightbox>`);
  await ready(el, 'Version 1 0');
  version = 2; source.revision = 2; el.imageSource = source;
  await ready(el, 'Version 2 0');
  expect(locales.length).to.equal(2);
  el.lang = 'fr';
  await waitUntil(() => locales.length === 3, 'locale rebound');
  expect(locales[2]).to.equal('fr');
  await ready(el, 'Version 2 0');
  el.imageSource = { revision: 3, images: { count: 0, itemAt: () => { throw new Error('Empty sources do not read'); } } };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="source-error"]') === null).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="counter"]') === null).to.equal(true);
});
