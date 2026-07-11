import { fixture, expect, html } from '@open-wc/testing';
import './time-range.js';
import type { LyraTimeRange } from './time-range.js';
import { styles } from './time-range.styles.js';

it('reflects start/end as the range fill width', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80"></lyra-time-range>`,
  )) as LyraTimeRange;
  const range = el.shadowRoot!.querySelector('[part="range"]') as HTMLElement;
  expect(range.style.insetInlineStart).to.equal('20%');
  expect(range.style.inlineSize).to.equal('60%');
});

it('moves the start handle with ArrowRight and emits lyra-input then lyra-change', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80" step="5"></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  expect(startHandle.getAttribute('role')).to.equal('slider');
  // lyra-input/lyra-change are emitted synchronously from the keydown/keyup
  // handlers, so the listener must be attached before dispatch (matches the
  // convention used by lyra-split's keyboard-step tests).
  let inputDetail: { start: number; end: number } | undefined;
  el.addEventListener('lyra-input', (e) => (inputDetail = (e as CustomEvent).detail));
  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(inputDetail!.start).to.equal(25);
  let changeDetail: { start: number; end: number } | undefined;
  el.addEventListener('lyra-change', (e) => (changeDetail = (e as CustomEvent).detail));
  startHandle.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
  expect(changeDetail!.start).to.equal(25);
});

it('never lets the start handle pass the end handle', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="78" end="80" step="5"></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  expect(el.start).to.equal(80);
});

it('is accessible', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80"></lyra-time-range>`,
  )) as LyraTimeRange;
  await expect(el).to.be.accessible();
});

it('re-clamps when only `end` is set below the current `start` (controlled/two-way binding)', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="50" end="90"></lyra-time-range>`,
  )) as LyraTimeRange;
  el.end = 10;
  await el.updateComplete;
  // end must never end up left of start: it is pulled up to meet start
  // rather than being left inverted.
  expect(el.end).to.be.at.least(el.start);
  expect(el.end).to.equal(50);
  const range = el.shadowRoot!.querySelector('[part="range"]') as HTMLElement;
  expect(range.style.inlineSize).to.not.include('-');
});

it('re-clamps when only `start` is set above the current `end` (controlled/two-way binding)', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="60"></lyra-time-range>`,
  )) as LyraTimeRange;
  el.start = 90;
  await el.updateComplete;
  expect(el.start).to.be.at.most(el.end);
  expect(el.start).to.equal(60);
});

it('does not emit lyra-change on keyup of a non-arrow key', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80" step="5"></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  let changeFired = false;
  el.addEventListener('lyra-change', () => (changeFired = true));
  startHandle.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', bubbles: true }));
  expect(changeFired).to.be.false;
});

it('removes the window pointermove/pointerup listeners on disconnect so a detached drag cannot leak', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80" step="1"></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  startHandle.setPointerCapture = () => {};

  // Begin a drag (adds window-level pointermove/pointerup listeners), then
  // remove the element from the DOM without ever delivering a pointerup —
  // mirrors a pointercancel/alt-tab/parent-unmount mid-drag.
  startHandle.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40 }),
  );
  const startBeforeDetach = el.start;
  el.remove();

  let inputFired = false;
  el.addEventListener('lyra-input', () => (inputFired = true));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 100 }));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));

  // If disconnectedCallback hadn't removed the window listeners, the stray
  // pointermove above would still mutate `start` and emit `lyra-input` on
  // the now-detached instance.
  expect(inputFired).to.be.false;
  expect(el.start).to.equal(startBeforeDetach);
});

it('re-clamps start/end into a narrower domain when min/max change after mount', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80"></lyra-time-range>`,
  )) as LyraTimeRange;
  // Narrowing `max` (e.g. zooming the time axis) must pull both handles
  // back inside [min, max] instead of leaving `end` (and the range fill)
  // rendered past 100%.
  el.max = 50;
  await el.updateComplete;
  expect(el.start).to.be.within(el.min, el.max);
  expect(el.end).to.be.within(el.min, el.max);
  expect(el.end).to.equal(50);
  expect(el.start).to.equal(20);

  el.min = 30;
  await el.updateComplete;
  expect(el.start).to.be.within(el.min, el.max);
  expect(el.end).to.be.within(el.min, el.max);
  expect(el.start).to.equal(30);
});

it('does not let start/end render outside the track after a domain change', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80"></lyra-time-range>`,
  )) as LyraTimeRange;
  el.max = 50;
  await el.updateComplete;
  const range = el.shadowRoot!.querySelector('[part="range"]') as HTMLElement;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector('[part="handle-end"]') as HTMLElement;
  expect(parseFloat(range.style.insetInlineStart)).to.be.at.least(0);
  expect(parseFloat(range.style.insetInlineStart) + parseFloat(range.style.inlineSize)).to.be.at.most(100);
  expect(parseFloat(startHandle.style.insetInlineStart)).to.be.within(0, 100);
  expect(parseFloat(endHandle.style.insetInlineStart)).to.be.within(0, 100);
});

it('stops an in-progress drag without mutating start/end once disabled mid-drag', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80" step="1"></lyra-time-range>`,
  )) as LyraTimeRange;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  startHandle.setPointerCapture = () => {};
  base.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 200,
      bottom: 0,
      width: 200,
      height: 0,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    }) as DOMRect;

  startHandle.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40 }),
  );
  // A drag is now in progress and window-level listeners are attached.
  el.disabled = true;

  let inputFired = false;
  let changeFired = false;
  el.addEventListener('lyra-input', () => (inputFired = true));
  el.addEventListener('lyra-change', () => (changeFired = true));
  const startBeforeMove = el.start;
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 100 }));

  // The already-captured pointer would otherwise keep mutating start/end
  // (pointer capture bypasses `:host([disabled]) { pointer-events: none }`).
  expect(inputFired).to.be.false;
  expect(changeFired).to.be.false;
  expect(el.start).to.equal(startBeforeMove);

  // The drag should also be fully torn down: a further pointermove/up must
  // be no-ops too, and the window listeners must be gone.
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 150 }));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
  expect(inputFired).to.be.false;
  expect(changeFired).to.be.false;
});

it('drags the start handle with pointer events and emits lyra-input then lyra-change on release', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80" step="1"></lyra-time-range>`,
  )) as LyraTimeRange;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;

  // Synthetic PointerEvents aren't tied to a real hardware pointer sequence,
  // so setPointerCapture throws "InvalidPointerId" in a real browser; stub
  // it out to exercise the drag math (ratio/clamp/emit) headlessly. Likewise
  // stub the layout rect so the ratio math is deterministic regardless of
  // the test runner's viewport.
  startHandle.setPointerCapture = () => {};
  base.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 200,
      bottom: 0,
      width: 200,
      height: 0,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    }) as DOMRect;

  let inputDetail: { start: number; end: number } | undefined;
  el.addEventListener('lyra-input', (e) => (inputDetail = (e as CustomEvent).detail));
  startHandle.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40 }),
  );
  // Midpoint of the 200px-wide track -> ratio 0.5 -> value 50 on a [0,100] domain.
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 100 }));
  expect(inputDetail!.start).to.equal(50);
  expect(inputDetail!.end).to.equal(80);

  let changeDetail: { start: number; end: number } | undefined;
  el.addEventListener('lyra-change', (e) => (changeDetail = (e as CustomEvent).detail));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
  expect(changeDetail!.start).to.equal(50);
});

it('widens the handle hit/drag area past the visible 14px dot via a transparent ::before', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80"></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  // The visible dot itself must stay 14px (unchanged design).
  expect(getComputedStyle(startHandle).width).to.equal('14px');
  // The actual hit/drag area (the ::before hit-slop) must be widened well
  // past the visible dot, closer to the ~24-28px minimum touch target size.
  const before = getComputedStyle(startHandle, '::before');
  expect(before.content).to.not.equal('none');
  expect(before.width).to.equal('28px');
  expect(before.height).to.equal('28px');
});

it('uses cursor:not-allowed (not pointer-events:none) when disabled, matching every other lyra-* control', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80" disabled></lyra-time-range>`,
  )) as LyraTimeRange;
  const hostStyle = getComputedStyle(el);
  expect(hostStyle.pointerEvents).to.not.equal('none');
  expect(hostStyle.cursor).to.equal('not-allowed');
  expect(hostStyle.opacity).to.equal('0.5');
  // [part^='handle'] sets `cursor: grab` unconditionally, so the
  // disabled-cursor rule must be restated on the handle specifically for it
  // to actually change there too, not just on the track.
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  expect(getComputedStyle(startHandle).cursor).to.equal('not-allowed');
});

it('references the shared focus-ring tokens on the handle focus-visible outline instead of hardcoded literals', () => {
  expect(styles.cssText).to.include(
    'outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color)',
  );
  expect(styles.cssText).to.include('outline-offset: var(--lyra-focus-ring-offset)');
});
