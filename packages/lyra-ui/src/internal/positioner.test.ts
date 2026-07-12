import { fixture, expect, html } from '@open-wc/testing';
import { place } from './positioner.js';

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
