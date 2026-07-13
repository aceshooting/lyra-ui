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

it('tears down the drag on pointercancel even though no pointerup ever arrives', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80" step="1"></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  startHandle.setPointerCapture = () => {};

  startHandle.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40 }),
  );
  // Per the Pointer Events spec, a cancelled pointer (e.g. an edge-swipe-back
  // gesture, palm rejection, or any system gesture interrupting the touch
  // sequence) never receives a subsequent pointerup. Before the fix, only
  // pointerup tore down the drag, so `this.drags` kept a permanently-stale
  // entry and the window-level pointermove listener stayed attached forever.
  window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));

  let inputFired = false;
  el.addEventListener('lyra-input', () => (inputFired = true));
  const startAfterCancel = el.start;
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 180 }));

  // A stray pointermove for the cancelled pointerId must be a no-op: the
  // drag (and its window listeners) should already be gone.
  expect(inputFired).to.be.false;
  expect(el.start).to.equal(startAfterCancel);
});

it('tears down the drag on lostpointercapture even though no pointerup ever arrives', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80" step="1"></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  startHandle.setPointerCapture = () => {};

  startHandle.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40 }),
  );
  window.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 1 }));

  let inputFired = false;
  el.addEventListener('lyra-input', () => (inputFired = true));
  const startAfterLostCapture = el.start;
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 180 }));

  expect(inputFired).to.be.false;
  expect(el.start).to.equal(startAfterLostCapture);
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

it('mirrors the drag ratio under dir="rtl", since the track is positioned with inset-inline-start', async () => {
  const el = (await fixture(
    html`<lyra-time-range
      dir="rtl"
      min="0"
      max="100"
      start="20"
      end="80"
      step="1"
    ></lyra-time-range>`,
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

  let inputDetail: { start: number; end: number } | undefined;
  el.addEventListener('lyra-input', (e) => (inputDetail = (e as CustomEvent).detail));
  startHandle.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40 }),
  );
  // Pointer at physical x=160 on a 200px track under RTL: raw=0.8, mirrored
  // to ratio 0.2 -> value 20 on a [0,100] domain (0 renders at the right
  // edge in RTL, so the *left* 20% of physical space is still "near zero").
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 160 }));
  expect(inputDetail!.start).to.equal(20);
});

it('mirrors ArrowRight/ArrowLeft under dir="rtl" to keep the physical direction consistent with dragging', async () => {
  const el = (await fixture(
    html`<lyra-time-range dir="rtl" min="0" max="100" start="20" end="80"></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;

  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(el.start).to.equal(19);

  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  expect(el.start).to.equal(20);
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

it('renders handles/fill in the correct left-to-right order when min > max (inverted domain)', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="100" max="0" start="20" end="80" step="5"></lyra-time-range>`,
  )) as LyraTimeRange;
  const range = el.shadowRoot!.querySelector('[part="range"]') as HTMLElement;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector('[part="handle-end"]') as HTMLElement;
  // Before the fix, percentOf() indexed off this.min/this.max directly, so
  // start (20) rendered at 80% and end (80) at 20% — visually swapped, with
  // a negative (invalid) fill width. It must instead match willUpdate()'s
  // lo/hi normalization of the min>max domain, same as a min=0/max=100 case.
  expect(startHandle.style.insetInlineStart).to.equal('20%');
  expect(endHandle.style.insetInlineStart).to.equal('80%');
  expect(range.style.insetInlineStart).to.equal('20%');
  expect(range.style.inlineSize).to.equal('60%');
});

it('does not lock dragging to a fixed value when min > max', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="100" max="0" start="20" end="80" step="5"></lyra-time-range>`,
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
  // Before the fix, clamp() computed Math.min(this.max=0, Math.max(this.min=100, stepped))
  // which is always 0 no matter where the pointer is — the widget was
  // non-interactive. It must now track the pointer like any other domain.
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 100 }));
  expect(el.start).to.equal(50);
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 180 }));
  expect(el.start).to.equal(10);
});

it("tracks concurrent drags by pointerId so a second pointer cannot hijack the first drag's handle", async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80" step="1"></lyra-time-range>`,
  )) as LyraTimeRange;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector('[part="handle-end"]') as HTMLElement;
  startHandle.setPointerCapture = () => {};
  endHandle.setPointerCapture = () => {};
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

  // Finger 1 starts dragging handle-start; finger 2 starts dragging
  // handle-end before finger 1 lifts (two-finger touch drag).
  startHandle.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40 }),
  );
  endHandle.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 2, clientX: 160 }),
  );

  // Before the fix, the single `dragging` scalar was overwritten to 'end' by
  // the second pointerdown, so moving finger 1 (pointerId 1) would have
  // mutated `end` instead of `start`.
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 60 }));
  expect(el.start).to.equal(30);
  expect(el.end).to.equal(80);

  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, clientX: 180 }));
  expect(el.end).to.equal(90);
  expect(el.start).to.equal(30);

  // Before the fix, any single pointerup unconditionally cleared `dragging`
  // and tore down both window listeners, silently ending finger 2's
  // still-in-progress drag too.
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, clientX: 190 }));
  expect(el.end).to.equal(95);
});

it('does not poison start/end with NaN when step is 0', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80" step="0"></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  // Before the fix: Math.round(20 / 0) * 0 === NaN, and NaN then propagates
  // into `start` permanently (and cross-contaminates `end` on the next
  // drag via the sibling-clamp comparison).
  expect(Number.isNaN(el.start)).to.be.false;
  expect(el.start).to.equal(20);
});

it('rounds a non-integer step to its own decimal precision instead of accumulating float drift', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80" step="0.1"></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  expect(el.start).to.equal(20.1);
  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  // Before the fix, re-deriving `current + step` from the already-stepped
  // 20.1 produced 20.200000000000003 (Math.round(value / step) * step
  // accumulating IEEE-754 binary drift), not the clean 20.2.
  expect(el.start).to.equal(20.2);
});

it('anchors the step grid at `min` rather than absolute 0, matching native <input type=range>', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="3" max="100" start="3" step="10"></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  // Before the fix, clamp() snapped 13 (3 + step) to the nearest multiple of
  // 10 from zero (Math.round(13/10)*10 === 10), a +7 jump instead of the
  // expected one-step +10 move off an unaligned `min`.
  expect(el.start).to.equal(13);
});

it('does not render invalid CSS or an aria-valuenow="NaN" when start fails Number attribute conversion', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="not-a-number" end="80"></lyra-time-range>`,
  )) as LyraTimeRange;
  expect(Number.isNaN(el.start)).to.be.true;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  // Before the fix, percentOf(NaN) produced `inset-inline-start:NaN%`, an
  // invalid CSS value the browser silently drops, and the template bound
  // aria-valuenow to the literal NaN.
  expect(startHandle.style.insetInlineStart).to.equal('0%');
  expect(startHandle.hasAttribute('aria-valuenow')).to.be.false;
});

it('defaults each handle\'s aria-label and lets startLabel/endLabel override them', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80"></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector('[part="handle-end"]') as HTMLElement;
  // Unset, these match the literal text this component always rendered
  // before startLabel/endLabel existed -- non-breaking default.
  expect(startHandle.getAttribute('aria-label')).to.equal('Range start');
  expect(endHandle.getAttribute('aria-label')).to.equal('Range end');

  el.startLabel = 'From';
  el.endLabel = 'To';
  await el.updateComplete;
  // Before the fix, both aria-labels were hardcoded literals with no
  // property to override them, so this assignment would have had no effect
  // on what's actually rendered.
  expect(startHandle.getAttribute('aria-label')).to.equal('From');
  expect(endHandle.getAttribute('aria-label')).to.equal('To');
});

it('reflects startLabel/endLabel from their start-label/end-label content attributes', async () => {
  const el = (await fixture(
    html`<lyra-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      start-label="From"
      end-label="To"
    ></lyra-time-range>`,
  )) as LyraTimeRange;
  expect(el.startLabel).to.equal('From');
  expect(el.endLabel).to.equal('To');
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector('[part="handle-end"]') as HTMLElement;
  expect(startHandle.getAttribute('aria-label')).to.equal('From');
  expect(endHandle.getAttribute('aria-label')).to.equal('To');
});

it('marks handles aria-disabled when disabled, for screen readers browsing by virtual cursor', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80" disabled></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector('[part="handle-end"]') as HTMLElement;
  expect(startHandle.getAttribute('aria-disabled')).to.equal('true');
  expect(endHandle.getAttribute('aria-disabled')).to.equal('true');

  el.disabled = false;
  await el.updateComplete;
  expect(startHandle.hasAttribute('aria-disabled')).to.be.false;
  expect(endHandle.hasAttribute('aria-disabled')).to.be.false;
});

it('ignores arrow-key input on a handle that keeps keyboard focus after disabled is set mid-interaction', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80" step="5"></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  expect(el.start).to.equal(25);

  el.disabled = true;
  let inputFired = false;
  let changeFired = false;
  el.addEventListener('lyra-input', () => (inputFired = true));
  el.addEventListener('lyra-change', () => (changeFired = true));
  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(el.start).to.equal(25);
  expect(inputFired).to.be.false;
  startHandle.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
  expect(changeFired).to.be.false;
});

it('toggles tabindex between "0" and "-1" as disabled changes, removing disabled handles from the tab order', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80"></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector('[part="handle-end"]') as HTMLElement;
  expect(startHandle.getAttribute('tabindex')).to.equal('0');
  expect(endHandle.getAttribute('tabindex')).to.equal('0');

  el.disabled = true;
  await el.updateComplete;
  // aria-disabled alone does not remove an element from the tab order —
  // tabindex="-1" is the actual mechanism making a disabled handle
  // unfocusable.
  expect(startHandle.getAttribute('tabindex')).to.equal('-1');
  expect(endHandle.getAttribute('tabindex')).to.equal('-1');

  el.disabled = false;
  await el.updateComplete;
  expect(startHandle.getAttribute('tabindex')).to.equal('0');
  expect(endHandle.getAttribute('tabindex')).to.equal('0');
});

it('is disabled by an ancestor <fieldset disabled> without mutating the disabled property, and re-enables when the fieldset does', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset disabled>
        <lyra-time-range min="0" max="100" start="20" end="80" step="5"></lyra-time-range>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-time-range') as LyraTimeRange;
  await el.updateComplete;

  // `el.disabled` (the consumer-facing IDL property/attribute) is never
  // mutated by fieldset cascading -- only the combined `effectiveDisabled`
  // reflects it (mirrors lyra-combobox's/lyra-slider's identical
  // `_fieldsetDisabled`/`effectiveDisabled` pattern).
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to.be.true;
  expect(el.disabled).to.be.false;

  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  expect(startHandle.getAttribute('tabindex')).to.equal('-1');
  expect(startHandle.getAttribute('aria-disabled')).to.equal('true');

  // Before the fix, lyra-time-range never became form-associated at all, so
  // an ancestor fieldset had no effect: the handle would stay focusable and
  // arrow keys would still move it.
  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(el.start).to.equal(20);

  const fieldset = form.querySelector('fieldset')!;
  fieldset.disabled = false;
  await el.updateComplete;
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to.be.false;
  expect(startHandle.getAttribute('tabindex')).to.equal('0');
  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(el.start).to.equal(25);
});

it('disables preset buttons via an ancestor <fieldset disabled> too', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset disabled>
        <lyra-time-range min="0" max="100" start="20" end="80"></lyra-time-range>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-time-range') as LyraTimeRange;
  el.presets = PRESETS;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="preset-button"]')!;
  expect(button.disabled).to.be.true;
  button.click();
  await el.updateComplete;
  expect(el.start).to.equal(20);
  expect(el.end).to.equal(80);
});

it('renders a stable 0%/100% pair instead of dividing by zero when min === max', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="50" max="50" start="50" end="50"></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector('[part="handle-end"]') as HTMLElement;
  expect(startHandle.style.insetInlineStart).to.equal('0%');
  expect(endHandle.style.insetInlineStart).to.equal('0%');
});

it("binds each handle's aria-valuemin/aria-valuemax to its reachable sub-range bounded by the sibling handle, not the full domain", async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80"></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector('[part="handle-end"]') as HTMLElement;
  // Before the fix, both handles reported the full [min, max]=[0, 100] pair,
  // implying a reachable range that clamp() actually forbids past the
  // sibling handle's current value.
  expect(startHandle.getAttribute('aria-valuemin')).to.equal('0');
  expect(startHandle.getAttribute('aria-valuemax')).to.equal('80');
  expect(endHandle.getAttribute('aria-valuemin')).to.equal('20');
  expect(endHandle.getAttribute('aria-valuemax')).to.equal('100');
});

it('jumps to the reachable min/max with Home/End, capped by the sibling handle', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80"></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector('[part="handle-end"]') as HTMLElement;

  // The start handle's End target is capped at the current end (80): clamp()
  // already enforces start <= end regardless of what value End aims for.
  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  await el.updateComplete;
  expect(el.start).to.equal(80);

  endHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  await el.updateComplete;
  expect(el.end).to.equal(80);
});

it('jumps to the full domain bound with Home/End when unconstrained by the sibling', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80"></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector('[part="handle-end"]') as HTMLElement;

  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  await el.updateComplete;
  expect(el.start).to.equal(0);

  endHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  await el.updateComplete;
  expect(el.end).to.equal(100);
});

it('moves by a larger increment with PageUp/PageDown than a single ArrowUp/ArrowDown step', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80" step="2"></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;

  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
  await el.updateComplete;
  expect(el.start).to.equal(40);

  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
  await el.updateComplete;
  expect(el.start).to.equal(20);
});

it('commits lyra-change on keyup of Home/End/PageUp/PageDown, mirroring arrow-key commit', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80"></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  let changeDetail: { start: number; end: number } | undefined;
  el.addEventListener('lyra-change', (e) => (changeDetail = (e as CustomEvent).detail));
  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  startHandle.dispatchEvent(new KeyboardEvent('keyup', { key: 'Home', bubbles: true }));
  expect(changeDetail!.start).to.equal(0);
});

// --- discrete-preset mode -------------------------------------------------

const PRESETS = [
  { label: 'Last 7 days', start: 0, end: 7 },
  { label: 'Last 30 days', start: 0, end: 30 },
  { label: 'Last 90 days', start: 0, end: 90 },
];

it('renders no [part="presets"] row at all when presets is empty (the default)', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80"></lyra-time-range>`,
  )) as LyraTimeRange;
  expect(el.presets).to.deep.equal([]);
  expect(el.shadowRoot!.querySelector('[part="presets"]')).to.equal(null);
  expect(el.shadowRoot!.querySelectorAll('[part="preset-button"]').length).to.equal(0);
});

it('renders a [part="presets"] row of [part="preset-button"] buttons when presets is non-empty', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80"></lyra-time-range>`,
  )) as LyraTimeRange;
  el.presets = PRESETS;
  await el.updateComplete;
  const row = el.shadowRoot!.querySelector('[part="presets"]');
  expect(row).to.not.equal(null);
  const buttons = el.shadowRoot!.querySelectorAll('[part="preset-button"]');
  expect(buttons.length).to.equal(3);
  expect(buttons[1].textContent).to.include('Last 30 days');
  // the brush itself must be completely unaffected: same track/handles.
  expect(el.shadowRoot!.querySelector('[part="base"]')).to.not.equal(null);
  expect(el.shadowRoot!.querySelector('[part="handle-start"]')).to.not.equal(null);
  expect(el.shadowRoot!.querySelector('[part="handle-end"]')).to.not.equal(null);
});

it('clicking a preset button sets start/end to that preset and fires lyra-change with the right detail', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80"></lyra-time-range>`,
  )) as LyraTimeRange;
  el.presets = PRESETS;
  await el.updateComplete;
  const buttons = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="preset-button"]');

  let changeDetail: { start: number; end: number } | undefined;
  el.addEventListener('lyra-change', (e) => (changeDetail = (e as CustomEvent).detail));
  buttons[1].click(); // 'Last 30 days' -> { start: 0, end: 30 }
  await el.updateComplete;

  expect(el.start).to.equal(0);
  expect(el.end).to.equal(30);
  expect(changeDetail).to.deep.equal({ start: 0, end: 30 });
});

it('marks only the preset matching the current start/end as active (aria-pressed + data-active)', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="0" end="30"></lyra-time-range>`,
  )) as LyraTimeRange;
  el.presets = PRESETS;
  await el.updateComplete;
  const buttons = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="preset-button"]');

  expect(buttons[0].getAttribute('aria-pressed')).to.equal('false');
  expect(buttons[0].hasAttribute('data-active')).to.be.false;
  expect(buttons[1].getAttribute('aria-pressed')).to.equal('true');
  expect(buttons[1].hasAttribute('data-active')).to.be.true;
  expect(buttons[2].getAttribute('aria-pressed')).to.equal('false');
  expect(buttons[2].hasAttribute('data-active')).to.be.false;

  // Clicking a different preset moves the "active" affordance accordingly.
  buttons[2].click();
  await el.updateComplete;
  expect(buttons[0].getAttribute('aria-pressed')).to.equal('false');
  expect(buttons[1].getAttribute('aria-pressed')).to.equal('false');
  expect(buttons[2].getAttribute('aria-pressed')).to.equal('true');
  expect(buttons[2].hasAttribute('data-active')).to.be.true;
});

it('handles a preset that shifts the whole range past the previous end (clamp() cross-reference must not clip it)', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="0" end="10"></lyra-time-range>`,
  )) as LyraTimeRange;
  el.presets = [{ label: 'Far future', start: 60, end: 90 }];
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="preset-button"]')!;
  button.click();
  await el.updateComplete;
  expect(el.start).to.equal(60);
  expect(el.end).to.equal(90);
});

it('emits exactly one lyra-input event from a preset click, already holding the final values', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80"></lyra-time-range>`,
  )) as LyraTimeRange;
  el.presets = [{ label: 'Far future', start: 60, end: 90 }];
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="preset-button"]')!;

  const inputDetails: Array<{ start: number; end: number }> = [];
  el.addEventListener('lyra-input', (e) => inputDetails.push((e as CustomEvent).detail));
  button.click();

  // Before the fix, applyPreset() routed both handles through setValue()
  // sequentially, so this fired twice: once with the *stale* pre-preset end
  // (80) while start had already moved but end hadn't yet, and only the
  // second carried the true final values -- a caller reacting to the first
  // lyra-input would have observed an inconsistent, never-actually-rendered
  // intermediate state.
  expect(inputDetails.length).to.equal(1);
  expect(inputDetails[0]).to.deep.equal({ start: 60, end: 90 });
});

it('lands exactly on preset values that are not aligned to a coarse step, and still shows data-active', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80" step="10"></lyra-time-range>`,
  )) as LyraTimeRange;
  el.presets = [{ label: 'Odd preset', start: 3, end: 47 }];
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="preset-button"]')!;
  button.click();
  await el.updateComplete;

  // Before the fix, routing preset.start/preset.end through setValue()'s
  // clamp() snapped them to the nearest multiple of `step` from `min` (0 and
  // 50), silently overriding the caller's exact preset numbers and leaving
  // the button's aria-pressed/data-active match permanently false.
  expect(el.start).to.equal(3);
  expect(el.end).to.equal(47);
  expect(button.getAttribute('aria-pressed')).to.equal('true');
  expect(button.hasAttribute('data-active')).to.be.true;
});

it('still supports brush dragging via handle-start/handle-end while presets is set (both interaction modes coexist)', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80" step="1"></lyra-time-range>`,
  )) as LyraTimeRange;
  el.presets = PRESETS;
  await el.updateComplete;
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

  let inputDetail: { start: number; end: number } | undefined;
  el.addEventListener('lyra-input', (e) => (inputDetail = (e as CustomEvent).detail));
  startHandle.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40 }),
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 100 }));
  expect(inputDetail!.start).to.equal(50);

  let changeDetail: { start: number; end: number } | undefined;
  el.addEventListener('lyra-change', (e) => (changeDetail = (e as CustomEvent).detail));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
  expect(changeDetail!.start).to.equal(50);

  // Keyboard interaction on the same handle also still works unmodified.
  const endHandle = el.shadowRoot!.querySelector('[part="handle-end"]') as HTMLElement;
  endHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  await el.updateComplete;
  expect(el.end).to.equal(79);
});

it('does not let a disabled preset button be clicked', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80" disabled></lyra-time-range>`,
  )) as LyraTimeRange;
  el.presets = PRESETS;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="preset-button"]')!;
  expect(button.disabled).to.be.true;
  button.click();
  await el.updateComplete;
  expect(el.start).to.equal(20);
  expect(el.end).to.equal(80);
});

it('is accessible with presets set', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="0" end="30"></lyra-time-range>`,
  )) as LyraTimeRange;
  el.presets = PRESETS;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
