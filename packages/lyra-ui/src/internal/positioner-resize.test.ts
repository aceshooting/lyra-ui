import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys, setViewport } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../test/wtr-focus.js';
import '../components/overlays/overlay/popover.js';
import '../components/forms/swatch-picker/swatch-picker.js';
import type { LyraPopover } from '../components/overlays/overlay/popover.class.js';
import type { LyraSwatchPicker } from '../components/forms/swatch-picker/swatch-picker.class.js';
import { place } from './positioner.js';
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
async function frames(count = 6): Promise<void> { for (let i = 0; i < count; i++) await frame(); }

it('coalesces element resize deliveries and cancels queued placement on disposal', async () => {
  const NativeObserver = window.ResizeObserver;
  const deliveries: (() => void)[] = [];
  window.ResizeObserver = class extends NativeObserver {
    constructor(callback: ResizeObserverCallback) { super(callback); deliveries.push(() => callback([], this)); }
  };
  let stop: (() => void) | undefined;
  try {
    const wrap = await fixture(html`<div><div id="reference" style="position:fixed;left:20px;top:100px;width:80px;height:20px"></div><div id="popup" style="height:20px"></div></div>`);
    const reference = wrap.querySelector<HTMLElement>('#reference')!;
    const popup = wrap.querySelector<HTMLElement>('#popup')!;
    let updates = 0;
    stop = place(reference, popup, { sync: 'width', onPlaced: () => updates++ });
    await frames();
    const deliver = deliveries.at(-1)!;
    const before = updates;
    deliver(); deliver(); deliver();
    await frames(3);
    expect(updates - before).to.equal(1);
    const beforeDispose = updates;
    deliver(); stop();
    await frames(3);
    expect(updates).to.equal(beforeDispose);
    reference.style.width = '120px';
    let replacementUpdates = 0;
    stop = place(reference, popup, { sync: 'width', onPlaced: () => replacementUpdates++ });
    await frames();
    expect(replacementUpdates).to.be.greaterThan(0);
    expect(popup.getBoundingClientRect().width).to.equal(120);
    expect(updates).to.equal(beforeDispose);
  } finally { stop?.(); window.ResizeObserver = NativeObserver; }
});

it('observes reference and virtual context sizing without polling idle frames', async () => {
  const wrap = await fixture(html`<div><div id="reference" style="position:fixed;left:20px;top:100px;width:80px;height:20px"></div><div id="popup" style="height:20px"></div></div>`);
  const reference = wrap.querySelector<HTMLElement>('#reference')!;
  const popup = wrap.querySelector<HTMLElement>('#popup')!;
  for (const anchor of [reference, { getBoundingClientRect: () => reference.getBoundingClientRect(), contextElement: reference }]) {
    let updates = 0;
    const stop = place(anchor, popup, { sync: 'width', onPlaced: () => updates++ });
    try {
      await frames();
      const initialWidth = reference.getBoundingClientRect().width;
      reference.style.width = `${initialWidth + 40}px`;
      await frames(10);
      expect(popup.getBoundingClientRect().width).to.equal(initialWidth + 40);
      const settled = updates;
      await frames(10);
      expect(updates).to.equal(settled);
    } finally { stop(); }
  }
});

it('keeps initial and ancestor-scroll geometry reads immediate', async () => {
  const wrap = await fixture(html`<div style="overflow:auto;width:200px;height:100px"><div id="reference" style="width:80px;height:20px"></div><div style="height:400px"></div><div id="popup" style="width:50px;height:20px"></div></div>`);
  const reference = wrap.querySelector<HTMLElement>('#reference')!;
  const popup = wrap.querySelector<HTMLElement>('#popup')!;
  const nativeRect = reference.getBoundingClientRect.bind(reference);
  let reads = 0;
  reference.getBoundingClientRect = () => { reads++; return nativeRect(); };
  let placements = 0;
  const stop = place(reference, popup, { onPlaced: () => placements++ });
  try {
    let placedBeforeFrame = false;
    await new Promise<void>((resolve) => requestAnimationFrame(() => { placedBeforeFrame = placements > 0; resolve(); }));
    expect(placedBeforeFrame).to.equal(true);
    expect(reads).to.be.greaterThan(1);
    await frames();
    const before = reads;
    wrap.dispatchEvent(new Event('scroll'));
    expect(reads).to.be.greaterThan(before);
  } finally { stop(); }
});

it('settles a narrow palette after root text shrinks without resize-delivery errors', async () => {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const rootFont = document.documentElement.style.fontSize;
  const bodyMargin = document.body.style.margin;
  const errors: string[] = [];
  const onError = (event: ErrorEvent) => errors.push(event.message);
  window.addEventListener('error', onError);
  let popover: LyraPopover | undefined;
  try {
    await setViewport({ width: 320, height: 800 });
    document.body.style.margin = '0';
    document.documentElement.style.fontSize = '16px';
    const wrap = await fixture(html`<div style="padding:8px"><lr-popover placement="bottom-end" popup-role="dialog" aria-label="Choices" style="--lr-overlay-max-inline-size:22rem;--show-duration:0ms;--hide-duration:0ms"><button slot="trigger">Choices</button><div style="box-sizing:border-box;display:flex;flex-direction:column;gap:.15rem;padding:.3rem;inline-size:auto"><p>Selected choice</p><lr-swatch-picker aria-label="Choices" style="padding:0 .3rem .3rem;--lr-swatch-picker-hit-size:1.5rem;--lr-swatch-picker-wrap:wrap;--lr-swatch-picker-gap:.125rem"></lr-swatch-picker></div></lr-popover></div>`);
    popover = wrap.querySelector<LyraPopover>('lr-popover')!;
    const picker = popover.querySelector<LyraSwatchPicker>('lr-swatch-picker')!;
    picker.items = Array.from({ length: 9 }, (_, i) => ({ value: String(i), color: 'red', label: `Choice ${i}` }));
    picker.value = '0';
    await picker.updateComplete;
    await popover.show();
    await focusByKeyboard(picker.shadowRoot!.querySelector<HTMLElement>('[part~=swatch]')!);
    const popup = popover.shadowRoot!.querySelector<HTMLElement>('[part~=popup]')!;
    const settled: number[][] = [];
    for (const font of [16, 32, 16, 32]) {
      document.documentElement.style.fontSize = `${font}px`;
      await frames(12);
      const rect = popup.getBoundingClientRect();
      expect(rect.width).to.be.at.most(304.5);
      expect(rect.width).to.be.greaterThan(200);
      expect(picker.shadowRoot!.activeElement?.getAttribute('data-value')).to.equal('0');
      settled.push([rect.x, rect.y, rect.width, rect.height]);
      await frames(6);
      const stable = popup.getBoundingClientRect();
      expect([stable.x, stable.y, stable.width, stable.height]).to.deep.equal(settled.at(-1));
    }
    expect(errors).to.deep.equal([]);
    expect(settled[0]).to.deep.equal(settled[2]);
    expect(settled[1]).to.deep.equal(settled[3]);
    await sendKeys({ press: 'ArrowRight' });
    expect(picker.value).to.equal('1');
    const hidden = oneEvent(popover, 'lr-after-hide');
    await sendKeys({ press: 'Escape' });
    await hidden;
    expect(popover.open).to.equal(false);
    expect(document.activeElement?.getAttribute('slot')).to.equal('trigger');
  } finally {
    await popover?.hide();
    window.removeEventListener('error', onError);
    document.documentElement.style.fontSize = rootFont;
    document.body.style.margin = bodyMargin;
    await setViewport(viewport);
  }
});

it('cleans synchronous initial disposal before observers or viewport listeners survive setup', async () => {
  const NativeObserver = window.ResizeObserver;
  let created = 0;
  let disconnected = 0;
  window.ResizeObserver = class extends NativeObserver {
    constructor(callback: ResizeObserverCallback) { super(callback); created++; }
    override disconnect(): void { disconnected++; super.disconnect(); }
  };
  let stop: (() => void) | undefined;
  try {
    const popup = await fixture<HTMLElement>(html`<div style="width:50px;height:20px"></div>`);
    let rectReads = 0;
    let updates = 0;
    const anchor = { getBoundingClientRect: () => new DOMRect(rectReads++ === 0 ? 20 : NaN, 100, 80, 20) };
    stop = place(anchor, popup, { onPlaced: () => updates++ });
    expect(disconnected).to.equal(created);
    await frames();
    expect(updates).to.equal(0);
    expect(popup.style.left).to.equal('');
  } finally { stop?.(); window.ResizeObserver = NativeObserver; }
});

it('uses the popup owning window for reference resize frames', async () => {
  const iframe = await fixture<HTMLIFrameElement>(html`<iframe title="Positioning reference"></iframe>`);
  const loaded = new Promise<void>(resolve => {
    const onLoad = () => {
      if (iframe.contentDocument?.body.id !== 'reference-document') return;
      iframe.removeEventListener('load', onLoad);
      resolve();
    };
    iframe.addEventListener('load', onLoad);
  });
  iframe.srcdoc = '<!doctype html><html><body id="reference-document"></body></html>';
  await loaded;
  const doc = iframe.contentDocument!;
  expect(doc.body.id).to.equal('reference-document');
  const view = doc.defaultView!;
  const nativeFrame = view.requestAnimationFrame.bind(view);
  let scheduled = 0;
  view.requestAnimationFrame = callback => { scheduled++; return nativeFrame(callback); };
  const reference = doc.createElement('div');
  const popup = doc.createElement('div');
  reference.style.cssText = 'position:fixed;left:20px;top:30px;width:80px;height:20px';
  popup.style.height = '20px';
  doc.body.append(reference, popup);
  const stop = place(reference, popup, { sync: 'width' });
  try {
    for (let i = 0; i < 6; i++) {
      await new Promise<void>(resolve => nativeFrame(() => resolve()));
    }
    expect(popup.getBoundingClientRect().width).to.equal(80);
    const initialFrames = scheduled;
    reference.style.width = '120px';
    await waitUntil(
      () => scheduled > initialFrames && popup.getBoundingClientRect().width === 120,
      'The popup owning window did not place the resized reference.',
    );
    expect(iframe.contentDocument === doc).to.equal(true);
    expect(scheduled).to.be.greaterThan(initialFrames);
    expect(popup.getBoundingClientRect().width).to.equal(120);
  } finally { stop(); view.requestAnimationFrame = nativeFrame; }
});


it('retains initial and scroll placement when ResizeObserver is unavailable', async () => {
  const wrap = await fixture(html`<div style="overflow:auto;width:200px;height:100px"><div id="reference" style="width:80px;height:20px"></div><div style="height:400px"></div><div id="popup" style="width:50px;height:20px"></div></div>`);
  const reference = wrap.querySelector<HTMLElement>('#reference')!;
  const popup = wrap.querySelector<HTMLElement>('#popup')!;
  const descriptor = Object.getOwnPropertyDescriptor(window, 'ResizeObserver')!;
  Object.defineProperty(window, 'ResizeObserver', { ...descriptor, value: undefined });
  let stop: (() => void) | undefined;
  try {
    let updates = 0;
    stop = place(reference, popup, { onPlaced: () => updates++ });
    await frame();
    expect(updates).to.be.greaterThan(0);
    const before = updates;
    wrap.scrollTop = 30;
    wrap.dispatchEvent(new Event('scroll'));
    await frames(3);
    expect(updates).to.be.greaterThan(before);
    expect(Number.parseFloat(popup.style.top)).to.be.lessThan(reference.offsetHeight);
  } finally { stop?.(); Object.defineProperty(window, 'ResizeObserver', descriptor); }
});
