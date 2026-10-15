import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { platform } from '@floating-ui/dom';
import { place } from './positioner.js';
import '../components/overlays/overlay/tooltip.js';
import type { LyraTooltip } from '../components/overlays/overlay/tooltip.class.js';

const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
async function settle(): Promise<void> { for (let i = 0; i < 6; i++) await frame(); }
const checkpoint = () => new Promise<void>(resolve => setTimeout(resolve, 0));

async function mount() {
  const scroller = await fixture<HTMLElement>(html`<div style="overflow:auto;width:240px;height:160px">
    <div style="height:600px;padding-top:60px">
      <button id="reference">Anchor</button><div id="popup" style="width:60px;height:20px"></div>
    </div>
  </div>`);
  return {
    scroller,
    reference: scroller.querySelector<HTMLElement>('#reference')!,
    popup: scroller.querySelector<HTMLElement>('#popup')!,
  };
}

function holdFrames(view: Window) {
  const request = view.requestAnimationFrame;
  const cancel = view.cancelAnimationFrame;
  const queued = new Map<number, FrameRequestCallback>();
  let next = 0;
  view.requestAnimationFrame = callback => { const id = ++next; queued.set(id, callback); return id; };
  view.cancelAnimationFrame = id => { queued.delete(id); };
  return {
    queued,
    restore() { view.requestAnimationFrame = request; view.cancelAnimationFrame = cancel; },
    flush() {
      const callbacks = [...queued.values()];
      queued.clear();
      for (const callback of callbacks) callback(performance.now());
    },
  };
}

it('coalesces ancestor scrolls without geometry reads or placement before a frame, and cancels disposal', async () => {
  const { scroller, reference, popup } = await mount();
  let placements = 0;
  const stop = place(reference, popup, { onPlaced: () => placements++ });
  await settle();
  const readRect = reference.getBoundingClientRect.bind(reference);
  let reads = 0;
  reference.getBoundingClientRect = () => { reads++; return readRect(); };
  const frames = holdFrames(window);
  try {
    const before = placements;
    scroller.dispatchEvent(new Event('scroll'));
    scroller.dispatchEvent(new Event('scroll'));
    scroller.dispatchEvent(new Event('scroll'));
    expect(reads).to.equal(0);
    expect(frames.queued.size).to.equal(1);
    await checkpoint();
    expect(placements).to.equal(before);
    frames.restore();
    frames.flush();
    await waitUntil(() => placements === before + 1, 'One coalesced scroll placement');
    const stoppedFrames = holdFrames(window);
    try {
      scroller.dispatchEvent(new Event('scroll'));
      stop();
      expect(stoppedFrames.queued.size).to.equal(0);
      stoppedFrames.flush();
      await checkpoint();
      expect(placements).to.equal(before + 1);
    } finally { stoppedFrames.restore(); }
  } finally { frames.restore(); stop(); reference.getBoundingClientRect = readRect; }
});

for (const rejects of [false, true]) {
it(`invalidates an in-flight ${rejects ? 'rejected' : 'resolved'} placement as soon as a scroll queues its replacement`, async () => {
  const { scroller, reference, popup } = await mount();
  let placements = 0;
  const stop = place(reference, popup, { onPlaced: () => placements++ });
  await settle();
  const getRects = platform.getElementRects!;
  let release!: () => void;
  let reject!: (reason: Error) => void;
  const held = new Promise<void>((resolve, fail) => { release = resolve; reject = fail; });
  let entered = false;
  platform.getElementRects = async function (...args) {
    entered = true;
    await held;
    return getRects.apply(this, args);
  };
  const frames = holdFrames(window);
  try {
    const before = placements;
    window.dispatchEvent(new Event('resize'));
    await checkpoint();
    expect(entered).to.equal(true);
    scroller.dispatchEvent(new Event('scroll'));
    platform.getElementRects = getRects;
    if (rejects) reject(new Error('Superseded placement'));
    else release();
    await checkpoint();
    expect(placements, 'The obsolete promise must not publish before the queued frame').to.equal(before);
    frames.restore();
    frames.flush();
    await waitUntil(() => placements === before + 1, 'The current scroll placement publishes');
  } finally { release(); platform.getElementRects = getRects; frames.restore(); stop(); }
});

}

it('coalesces visual viewport scrolling but keeps viewport resize immediate', async function () {
  if (!window.visualViewport) this.skip();
  const { reference, popup } = await mount();
  let placements = 0;
  const stop = place(reference, popup, { onPlaced: () => placements++ });
  await settle();
  const frames = holdFrames(window);
  try {
    const before = placements;
    window.visualViewport!.dispatchEvent(new Event('scroll'));
    expect(frames.queued.size).to.equal(1);
    await checkpoint();
    expect(placements).to.equal(before);
    window.visualViewport!.dispatchEvent(new Event('resize'));
    await checkpoint();
    expect(placements).to.be.greaterThan(before);
    expect(frames.queued.size).to.equal(0);
  } finally { frames.restore(); stop(); }
});

it('schedules virtual-context scrolling in the popup owning window', async () => {
  const iframe = await fixture<HTMLIFrameElement>(html`<iframe title="Scroll positioning"></iframe>`);
  const doc = iframe.contentDocument!;
  const view = doc.defaultView!;
  doc.body.innerHTML = '<div style="overflow:auto;width:200px;height:100px"><button>Anchor</button><div style="height:500px"></div><div id="popup" style="width:50px;height:20px"></div></div>';
  const scroller = doc.body.firstElementChild as HTMLElement;
  const reference = scroller.querySelector('button')!;
  const popup = doc.getElementById('popup')!;
  let placements = 0;
  const stop = place({ contextElement: reference, getBoundingClientRect: () => reference.getBoundingClientRect() }, popup, { onPlaced: () => placements++ });
  await settle();
  const frames = holdFrames(view);
  try {
    const before = placements;
    scroller.dispatchEvent(new Event('scroll'));
    expect(frames.queued.size).to.equal(1);
    await checkpoint();
    expect(placements).to.equal(before);
    frames.restore();
    frames.flush();
    await waitUntil(() => placements > before, 'The owning window places its virtual context');
  } finally { frames.restore(); stop(); }
});

it('keeps an open tooltip and its arrow out of native scroll publication until a frame', async () => {
  const scroller = await fixture<HTMLElement>(html`<div style="overflow:auto;width:280px;height:180px">
    <div style="height:600px;padding:70px 20px 0">
      <lr-tooltip manual placement="bottom" content="More information" style="--show-duration:0ms;--hide-duration:0ms">
        <button slot="trigger">Anchor</button>
      </lr-tooltip>
    </div>
  </div>`);
  const tooltip = scroller.querySelector<LyraTooltip>('lr-tooltip')!;
  await tooltip.show();
  await settle();
  const popup = tooltip.shadowRoot!.querySelector<HTMLElement>('[part~=popup]')!;
  const arrow = tooltip.shadowRoot!.querySelector<HTMLElement>('[part~=arrow]')!;
  const beforeTop = Number.parseFloat(popup.style.top);
  let scrollWrites = 0;
  const observer = new MutationObserver(records => scrollWrites += records.length);
  // Layout observers may validly run before the native scroll event. Measure only writes after
  // dispatch starts, when scroll-driven geometry must wait for its animation frame.
  scroller.addEventListener('scroll', () => {
    observer.observe(popup, { attributes: true, attributeFilter: ['style'] });
    observer.observe(arrow, { attributes: true, attributeFilter: ['style'] });
  }, { capture: true, once: true });
  const frames = holdFrames(window);
  try {
    const scrolled = oneEvent(scroller, 'scroll');
    scroller.scrollTop = 25;
    await scrolled;
    await checkpoint();
    expect(scrollWrites).to.equal(0);
    expect(frames.queued.size).to.equal(1);
    frames.restore();
    frames.flush();
    await waitUntil(() => Math.abs(Number.parseFloat(popup.style.top) - (beforeTop - 25)) < 1, 'The tooltip follows its scrolled anchor');
    expect(tooltip.open).to.equal(true);
    expect(arrow.style.cssText).not.to.equal('');
  } finally { observer.disconnect(); frames.restore(); await tooltip.hide(); }
});
