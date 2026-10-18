import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './lightbox.js';
import type { LyraLightbox, LyraLightboxImage, LyraLightboxSource } from './lightbox.js';
import type { LyraSourceRecord, LyraSourceRangeRequest } from '../../../data-sources.js';

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

it('refreshes after disconnect and owner-document adoption while retaining the requested index', async () => {
  const pending: { request: LyraSourceRangeRequest; resolve: (records: readonly LyraSourceRecord<LyraLightboxImage>[]) => void }[] = [];
  let delayed = true; let reads = 0;
  const source: Source = { revision: 1, images: { count: 1_000_000, read: request => {
    reads++; return delayed ? new Promise(resolve => pending.push({ request, resolve })) : Promise.resolve([record(request.offset, 'Connected')]);
  } } };
  const el = await fixture<SourceLightbox>(html`<lr-lightbox .imageSource=${source} .index=${999_999}></lr-lightbox>`);
  await waitUntil(() => pending.length === 1);
  const parent = el.parentNode!;
  const frame = await fixture<HTMLIFrameElement>(html`<iframe title="Image owner"></iframe>`);
  await waitUntil(() => !!frame.contentDocument?.body);
  try {
    frame.contentDocument!.body.append(el);
    expect(pending[0]!.request.signal.aborted).to.equal(true);
    delayed = false; pending[0]!.resolve([record(999_999, 'Old')]);
    await ready(el, 'Connected 999999');
    expect(el.index).to.equal(999_999);
    expect(el.ownerDocument === frame.contentDocument).to.equal(true);
    const before = reads;
    el.remove(); parent.append(el);
    await waitUntil(() => reads === before + 1, 'reconnected source read');
    await ready(el, 'Connected 999999');
    expect(reads).to.equal(before + 1);
  } finally { parent.append(el); }
});

it('preserves modal focus, RTL navigation and legacy close behavior across source navigation and unset', async () => {
  const source: Source = { revision: 1, images: { count: 1_000_000, itemAt: index => record(index) } };
  const wrapper = await fixture<HTMLDivElement>(html`<div><button>Open images</button><lr-lightbox dir="rtl" .imageSource=${source} .images=${[record(0, 'Legacy').value]}></lr-lightbox></div>`);
  const el = wrapper.querySelector('lr-lightbox')!;
  const opener = wrapper.querySelector('button')!;
  const indices: number[] = [];
  el.addEventListener('lr-index-change', event => indices.push(event.detail.index));
  await ready(el, 'Image 0');
  await focusByKeyboard(opener);
  await el.show();
  const frame = el.shadowRoot!.querySelector('lr-pan-zoom')!;
  const viewport = frame.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
  try {
    await sendKeys({ press: 'Tab' });
    await waitUntil(() => frame.shadowRoot!.activeElement === viewport, 'keyboard reached the image viewport');
    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true }));
    expect(el.index).to.equal(0);
    el.shadowRoot!.querySelector('[part="panel"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true }));
    await ready(el, 'Image 1');
    expect(frame.shadowRoot!.activeElement === viewport).to.equal(true);
    el.index = 999_999; await ready(el, 'Image 999999');
    expect(indices).to.deep.equal([1]);
    el.imageSource = undefined; await ready(el, 'Legacy 0');
    expect(indices).to.deep.equal([1, 0]);
    expect(frame.shadowRoot!.activeElement === viewport).to.equal(true);
  } finally { await el.hide(); }
  expect(document.activeElement === opener).to.equal(true);
});
