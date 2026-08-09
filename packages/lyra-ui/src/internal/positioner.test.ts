import { fixture, expect, html } from '@open-wc/testing';
import { place, virtualAnchorFromRect, type VirtualAnchor } from './positioner.js';

/** Polls `read()` until it satisfies `until`, or throws once `timeoutMs` elapses. */
async function waitFor<T>(read: () => T, until: (v: T) => boolean, timeoutMs = 2000): Promise<T> {
  const start = performance.now();
  for (;;) {
    const value = read();
    if (until(value)) return value;
    if (performance.now() - start > timeoutMs) {
      throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    }
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }
}

it('positions the popup relative to the anchor', async () => {
  const wrap = await fixture(html`
    <div>
      <button id="a" style="position:absolute; top:100px; left:100px;">x</button>
      <div id="p" style="width:50px; height:20px;">pop</div>
    </div>
  `);
  const a = wrap.querySelector('#a') as HTMLElement;
  const p = wrap.querySelector('#p') as HTMLElement;

  const stop = place(a, p);
  // autoUpdate schedules an async computePosition; wait a frame for it to land.
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  expect(p.style.position).to.equal('fixed');
  expect(p.style.left).to.not.be.empty;
  expect(p.style.top).to.not.be.empty;
  expect(p.style.getPropertyValue('--lr-positioner-available-inline-size')).to.match(/^\d+(?:\.\d+)?px$/);
  expect(p.style.getPropertyValue('--lr-positioner-available-block-size')).to.match(/^\d+(?:\.\d+)?px$/);
  stop();
});

it('refreshes available space when the visual viewport changes', async () => {
  const wrap = await fixture(html`
    <div>
      <button id="a" style="position:absolute; top:100px; left:100px;">x</button>
      <div id="p" style="width:50px; height:20px;">pop</div>
    </div>
  `);
  const a = wrap.querySelector('#a') as HTMLElement;
  const p = wrap.querySelector('#p') as HTMLElement;
  const visualViewport = window.visualViewport;

  if (!visualViewport) return;

  const stop = place(a, p);
  await waitFor(
    () => p.style.getPropertyValue('--lr-positioner-available-block-size'),
    (value) => value !== '',
  );
  const initialTop = p.style.top;
  visualViewport.dispatchEvent(new Event('resize'));
  await waitFor(
    () => p.style.top,
    (top) => top !== '' && top === initialTop,
  );
  expect(p.style.getPropertyValue('--lr-positioner-available-block-size')).to.match(/^\d+(?:\.\d+)?px$/);
  stop();
});

it('keeps tracking the anchor via autoUpdate until stop() is called', async () => {
  const wrap = await fixture(html`
    <div>
      <button id="a" style="position:absolute; top:100px; left:100px; height:20px;">x</button>
      <div id="p" style="width:50px; height:20px;">pop</div>
    </div>
  `);
  const a = wrap.querySelector('#a') as HTMLElement;
  const p = wrap.querySelector('#p') as HTMLElement;

  const stop = place(a, p);
  await waitFor(
    () => p.style.top,
    (top) => top !== '',
  );
  const initialTop = parseFloat(p.style.top);

  // Growing the anchor (ResizeObserver-driven) pushes the anchor's bottom
  // edge down; autoUpdate should recompute and follow it without any
  // explicit re-invocation of place().
  a.style.height = '200px';
  await waitFor(
    () => parseFloat(p.style.top),
    (top) => top > initialTop,
  );
  const trackedTop = parseFloat(p.style.top);
  expect(trackedTop).to.be.greaterThan(initialTop);

  // Once stopped, further anchor changes must no longer move the popup.
  stop();
  a.style.height = '400px';
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => setTimeout(r, 100));
  expect(parseFloat(p.style.top)).to.equal(trackedTop);
});

it('invalidates an in-flight placement before cleanup returns', async () => {
  const wrap = await fixture(html`
    <div>
      <button id="a" style="position:absolute; top:100px; left:100px;">x</button>
      <div id="p" style="width:50px; height:20px;">pop</div>
    </div>
  `);
  const anchor = wrap.querySelector('#a') as HTMLElement;
  const popup = wrap.querySelector('#p') as HTMLElement;
  let placedCount = 0;

  const stop = place(anchor, popup, { onPlaced: () => placedCount++ });
  stop();
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

  expect(popup.style.left).to.equal('');
  expect(popup.style.top).to.equal('');
  expect(placedCount).to.equal(0);
});

it('lets a replacement placement win while the cleaned-up run is still in flight', async () => {
  const wrap = await fixture(html`
    <div>
      <button id="first" style="position:absolute; top:40px; left:40px;">first</button>
      <button id="second" style="position:absolute; top:180px; left:300px;">second</button>
      <div id="popup" style="width:50px; height:20px;">pop</div>
    </div>
  `);
  const first = wrap.querySelector('#first') as HTMLElement;
  const second = wrap.querySelector('#second') as HTMLElement;
  const popup = wrap.querySelector('#popup') as HTMLElement;
  let obsoletePlacements = 0;
  let currentPlacements = 0;

  const stopFirst = place(first, popup, { onPlaced: () => obsoletePlacements++ });
  stopFirst();
  const stopSecond = place(second, popup, { onPlaced: () => currentPlacements++ });
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

  expect(obsoletePlacements).to.equal(0);
  expect(currentPlacements).to.be.greaterThan(0);
  expect(parseFloat(popup.style.left)).to.be.closeTo(300, 1);
  stopSecond();
});

it('honors a custom offset from PlaceOptions', async () => {
  const wrap = await fixture(html`
    <div>
      <button id="a" style="position:absolute; top:100px; left:100px; width:80px; height:20px;">x</button>
      <div id="p" style="width:50px; height:20px;">pop</div>
    </div>
  `);
  const a = wrap.querySelector('#a') as HTMLElement;
  const p = wrap.querySelector('#p') as HTMLElement;

  const stop = place(a, p, { offset: 50 });
  await waitFor(
    () => p.style.top,
    (top) => top !== '',
  );

  // Default placement is 'bottom-start', so the gap between the anchor's
  // bottom edge and the popup's top edge should equal the requested offset,
  // not the built-in default of 4.
  const gap = p.getBoundingClientRect().top - a.getBoundingClientRect().bottom;
  expect(gap).to.be.closeTo(50, 1);
  stop();
});

it('honors a custom placement from PlaceOptions', async () => {
  const wrap = await fixture(html`
    <div>
      <button id="a" style="position:absolute; top:200px; left:100px; width:80px; height:20px;">x</button>
      <div id="p" style="width:50px; height:20px;">pop</div>
    </div>
  `);
  const a = wrap.querySelector('#a') as HTMLElement;
  const p = wrap.querySelector('#p') as HTMLElement;

  const stop = place(a, p, { placement: 'top-end' });
  await waitFor(
    () => p.style.top,
    (top) => top !== '',
  );

  const anchorRect = a.getBoundingClientRect();
  const popupRect = p.getBoundingClientRect();
  // A 'top-*' placement puts the popup above the anchor, unlike the default
  // 'bottom-start' (which would put it below).
  expect(popupRect.bottom).to.be.at.most(anchorRect.top);
  // '-end' alignment lines the popup's trailing edge up with the anchor's
  // trailing edge (the right edge, in this LTR fixture).
  expect(popupRect.right).to.be.closeTo(anchorRect.right, 1);
  stop();
});

it('positions the popup relative to a virtual anchor with no backing DOM element', async () => {
  const wrap = await fixture(html`
    <div>
      <div id="p" style="width:50px; height:20px;">pop</div>
    </div>
  `);
  const p = wrap.querySelector('#p') as HTMLElement;
  const anchor: VirtualAnchor = {
    getBoundingClientRect: () => new DOMRect(100, 100, 0, 0),
  };

  const stop = place(anchor, p);
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  expect(p.style.position).to.equal('fixed');
  expect(p.style.left).to.not.be.empty;
  expect(p.style.top).to.not.be.empty;
  // Default placement 'bottom-start' + default 4px offset puts the popup's
  // top edge 4px below the anchor's (zero-height) point.
  expect(parseFloat(p.style.top)).to.be.closeTo(104, 1);
  expect(parseFloat(p.style.left)).to.be.closeTo(100, 1);
  stop();
});

it('honors an optional contextElement on a virtual anchor without throwing', async () => {
  const wrap = await fixture(html`
    <div>
      <div id="p" style="width:50px; height:20px;">pop</div>
    </div>
  `);
  const p = wrap.querySelector('#p') as HTMLElement;
  const anchor: VirtualAnchor = {
    getBoundingClientRect: () => new DOMRect(20, 30, 0, 0),
    contextElement: wrap as unknown as Element,
  };

  const stop = place(anchor, p);
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  expect(p.style.left).to.not.include('NaN');
  expect(p.style.top).to.not.include('NaN');
  stop();
});

describe('virtualAnchorFromRect', () => {
  it('builds a VirtualAnchor whose getBoundingClientRect() reflects the given rect', () => {
    const anchor = virtualAnchorFromRect({ x: 10, y: 20, width: 30, height: 40 });
    const rect = anchor.getBoundingClientRect();
    expect(rect.x).to.equal(10);
    expect(rect.y).to.equal(20);
    expect(rect.width).to.equal(30);
    expect(rect.height).to.equal(40);
    expect(rect.left).to.equal(10);
    expect(rect.top).to.equal(20);
    expect(rect.right).to.equal(40);
    expect(rect.bottom).to.equal(60);
  });

  it('defaults width/height to 0, producing a zero-size point anchor', () => {
    const anchor = virtualAnchorFromRect({ x: 5, y: 6 });
    const rect = anchor.getBoundingClientRect();
    expect(rect.width).to.equal(0);
    expect(rect.height).to.equal(0);
    expect(rect.left).to.equal(5);
    expect(rect.top).to.equal(6);
  });

  it('forwards an optional contextElement onto the built VirtualAnchor', () => {
    const el = document.createElement('div');
    const anchor = virtualAnchorFromRect({ x: 0, y: 0, contextElement: el });
    expect(anchor.contextElement).to.equal(el);
  });

  it('leaves contextElement undefined when not supplied', () => {
    const anchor = virtualAnchorFromRect({ x: 0, y: 0 });
    expect(anchor.contextElement).to.equal(undefined);
  });
});

describe('shared overflow boundary', () => {
  async function boundaryFixture(): Promise<{
    box: HTMLElement;
    anchor: HTMLElement;
    popup: HTMLElement;
  }> {
    const box = await fixture<HTMLElement>(html`
      <div
        style="position: fixed; inset-block-start: 100px; inset-inline-start: 100px;
          inline-size: 240px; block-size: 140px; overflow: hidden;"
      >
        <button
          id="boundary-anchor"
          style="position: absolute; inset-block-end: 8px; inset-inline-start: 60px;
            inline-size: 80px; block-size: 24px;"
        >
          Anchor
        </button>
        <div id="boundary-popup" style="inline-size: 100px; block-size: 70px;">Popup</div>
      </div>
    `);
    return {
      box,
      anchor: box.querySelector('#boundary-anchor') as HTMLElement,
      popup: box.querySelector('#boundary-popup') as HTMLElement,
    };
  }

  it('uses an empty shared boundary as viewport-only clipping', async () => {
    const { anchor, popup } = await boundaryFixture();
    const stop = place(anchor, popup, { placement: 'bottom', boundary: [] });
    await waitFor(
      () => popup.style.top,
      (top) => top !== '',
    );
    expect(popup.getBoundingClientRect().top).to.be.at.least(anchor.getBoundingClientRect().bottom);
    stop();
  });

  it('uses an element shared boundary for flip, shift, and available-size measurement', async () => {
    const { box, anchor, popup } = await boundaryFixture();
    const stop = place(anchor, popup, { placement: 'bottom', boundary: box });
    await waitFor(
      () => popup.style.top,
      (top) => top !== '',
    );
    expect(popup.getBoundingClientRect().bottom).to.be.at.most(anchor.getBoundingClientRect().top + 1);
    expect(parseFloat(popup.style.getPropertyValue('--lr-positioner-available-inline-size'))).to.be.at.most(
      box.getBoundingClientRect().width,
    );
    stop();
  });

  it('lets a per-middleware boundary override the shared boundary', async () => {
    const { box, anchor, popup } = await boundaryFixture();
    const stop = place(anchor, popup, {
      placement: 'bottom',
      boundary: box,
      flipBoundary: [],
      shift: false,
    });
    await waitFor(
      () => popup.style.top,
      (top) => top !== '',
    );
    expect(popup.getBoundingClientRect().top).to.be.at.least(anchor.getBoundingClientRect().bottom);
    stop();
  });
});
