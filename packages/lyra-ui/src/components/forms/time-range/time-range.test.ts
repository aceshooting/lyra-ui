import { fixture, expect, html } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import './time-range.js';
import type { LyraTimeRange } from './time-range.js';
import { styles } from './time-range.styles.js';
import { LyraElement } from '../../../internal/lyra-element.js';

it('reflects start/end as the range fill width', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`,
  )) as LyraTimeRange;
  const range = el.shadowRoot!.querySelector('[part="range"]') as HTMLElement;
  expect(range.style.insetInlineStart).to.equal('20%');
  expect(range.style.inlineSize).to.equal('60%');
});

it('moves the start handle with ArrowRight and emits lr-input then lr-change', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80" step="5"></lr-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  expect(startHandle.getAttribute('role')).to.equal('slider');
  // lr-input/lr-change are emitted synchronously from the keydown/keyup
  // handlers, so the listener must be attached before dispatch (matches the
  // convention used by lr-split's keyboard-step tests).
  let inputDetail: { start: number; end: number } | undefined;
  el.addEventListener('lr-input', (e) => (inputDetail = (e as CustomEvent).detail));
  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(inputDetail!.start).to.equal(25);
  let changeDetail: { start: number; end: number } | undefined;
  el.addEventListener('lr-change', (e) => (changeDetail = (e as CustomEvent).detail));
  startHandle.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
  expect(changeDetail!.start).to.equal(25);
});

it('never lets the start handle pass the end handle', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="78" end="80" step="5"></lr-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  expect(el.start).to.equal(80);
});

it('is accessible', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`,
  )) as LyraTimeRange;
  await expect(el).to.be.accessible();
});

it('formats each handle value as aria-valuetext while preserving numeric slider state', async () => {
  const labels = ['April 2023', 'May 2023', 'June 2023'];
  const el = (await fixture(html`
    <lr-time-range
      min="0"
      max="2"
      start="0"
      end="2"
      .valueFormatter=${(value: number, handle: 'start' | 'end') =>
        `${handle === 'start' ? 'From' : 'Through'} ${labels[value]}`}
    ></lr-time-range>
  `)) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector('[part="handle-end"]') as HTMLElement;

  expect(startHandle.getAttribute('aria-valuenow')).to.equal('0');
  expect(startHandle.getAttribute('aria-valuetext')).to.equal('From April 2023');
  expect(endHandle.getAttribute('aria-valuenow')).to.equal('2');
  expect(endHandle.getAttribute('aria-valuetext')).to.equal('Through June 2023');

  el.start = 1;
  await el.updateComplete;
  expect(startHandle.getAttribute('aria-valuetext')).to.equal('From May 2023');
});

it('omits aria-valuetext when valueFormatter is unset (opt-in regression)', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector('[part="handle-end"]') as HTMLElement;
  expect(startHandle.hasAttribute('aria-valuetext')).to.be.false;
  expect(endHandle.hasAttribute('aria-valuetext')).to.be.false;
});

it('re-clamps when only `end` is set below the current `start` (controlled/two-way binding)', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="50" end="90"></lr-time-range>`,
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
    html`<lr-time-range min="0" max="100" start="20" end="60"></lr-time-range>`,
  )) as LyraTimeRange;
  el.start = 90;
  await el.updateComplete;
  expect(el.start).to.be.at.most(el.end);
  expect(el.start).to.equal(60);
});

it('does not emit lr-change on keyup of a non-arrow key', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80" step="5"></lr-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  let changeFired = false;
  el.addEventListener('lr-change', () => (changeFired = true));
  startHandle.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', bubbles: true }));
  expect(changeFired).to.be.false;
});

it('removes the window pointermove/pointerup listeners on disconnect so a detached drag cannot leak', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80" step="1"></lr-time-range>`,
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
  el.addEventListener('lr-input', () => (inputFired = true));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 100 }));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));

  // If disconnectedCallback hadn't removed the window listeners, the stray
  // pointermove above would still mutate `start` and emit `lr-input` on
  // the now-detached instance.
  expect(inputFired).to.be.false;
  expect(el.start).to.equal(startBeforeDetach);
});

it('tears down the drag on pointercancel even though no pointerup ever arrives', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80" step="1"></lr-time-range>`,
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
  el.addEventListener('lr-input', () => (inputFired = true));
  const startAfterCancel = el.start;
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 180 }));

  // A stray pointermove for the cancelled pointerId must be a no-op: the
  // drag (and its window listeners) should already be gone.
  expect(inputFired).to.be.false;
  expect(el.start).to.equal(startAfterCancel);
});

it('tears down the drag on lostpointercapture even though no pointerup ever arrives', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80" step="1"></lr-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  startHandle.setPointerCapture = () => {};

  startHandle.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40 }),
  );
  window.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 1 }));

  let inputFired = false;
  el.addEventListener('lr-input', () => (inputFired = true));
  const startAfterLostCapture = el.start;
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 180 }));

  expect(inputFired).to.be.false;
  expect(el.start).to.equal(startAfterLostCapture);
});

it('re-clamps start/end into a narrower domain when min/max change after mount', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`,
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
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`,
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
    html`<lr-time-range min="0" max="100" start="20" end="80" step="1"></lr-time-range>`,
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
  el.addEventListener('lr-input', () => (inputFired = true));
  el.addEventListener('lr-change', () => (changeFired = true));
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

it('drags the start handle with pointer events and emits lr-input then lr-change on release', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80" step="1"></lr-time-range>`,
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
  el.addEventListener('lr-input', (e) => (inputDetail = (e as CustomEvent).detail));
  startHandle.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40 }),
  );
  // Midpoint of the 200px-wide track -> ratio 0.5 -> value 50 on a [0,100] domain.
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 100 }));
  expect(inputDetail!.start).to.equal(50);
  expect(inputDetail!.end).to.equal(80);

  let changeDetail: { start: number; end: number } | undefined;
  el.addEventListener('lr-change', (e) => (changeDetail = (e as CustomEvent).detail));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
  expect(changeDetail!.start).to.equal(50);
});

it('mirrors the drag ratio under dir="rtl", since the track is positioned with inset-inline-start', async () => {
  const el = (await fixture(
    html`<lr-time-range
      dir="rtl"
      min="0"
      max="100"
      start="20"
      end="80"
      step="1"
    ></lr-time-range>`,
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
  el.addEventListener('lr-input', (e) => (inputDetail = (e as CustomEvent).detail));
  startHandle.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40 }),
  );
  // Pointer at physical x=160 on a 200px track under RTL: raw=0.8, mirrored
  // to ratio 0.2 -> value 20 on a [0,100] domain (0 renders at the right
  // edge in RTL, so the *left* 20% of physical space is still "near zero").
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 160 }));
  expect(el.start).to.equal(20);
  expect(inputDetail).to.equal(undefined);
});

it('mirrors ArrowRight/ArrowLeft under dir="rtl" to keep the physical direction consistent with dragging', async () => {
  const el = (await fixture(
    html`<lr-time-range dir="rtl" min="0" max="100" start="20" end="80"></lr-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;

  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(el.start).to.equal(19);

  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  expect(el.start).to.equal(20);
});

it('widens the handle hit/drag area past the visible 14px dot via a transparent ::before', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`,
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

it('uses cursor:not-allowed (not pointer-events:none) when disabled, matching every other lr-* control', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80" disabled></lr-time-range>`,
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

it('dims with opacity/not-allowed cursor when disabled purely via an ancestor fieldset, not just its own disabled attribute', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset disabled>
        <lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-time-range') as LyraTimeRange;
  await el.updateComplete;
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to.be.true;
  expect(el.hasAttribute('disabled'), 'the own disabled attribute must stay unset').to.be.false;

  const hostStyle = getComputedStyle(el);
  expect(hostStyle.opacity, 'fieldset-only disablement must still dim the host').to.equal('0.5');
  expect(hostStyle.cursor).to.equal('not-allowed');
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  expect(getComputedStyle(startHandle).cursor).to.equal('not-allowed');
});

it('gives the drag handles hover feedback matching the keyboard focus-visible cue', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part\^='handle'\]:hover\s*\{[^}]*filter:/);
});

describe('preset-button hover specificity', () => {
  it('wraps the internal :hover:not(:disabled) rule in :where() so a consumer ::part(preset-button):hover override does not need !important', async () => {
    const el = (await fixture(html`
      <lr-time-range
        .presets=${[{ label: 'Last 7 days', start: 0, end: 7 }]}
      ></lr-time-range>
    `)) as LyraTimeRange;
    // Real :hover can't be synthesized from a dispatched event in this test harness (jsdom/real
    // browser alike) -- assert the internal rule's specificity-zeroing shape directly, the same
    // way lr-attachment-trigger's own hover-specificity test does.
    const internalRule = (el.shadowRoot!.adoptedStyleSheets ?? [])
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .map((rule) => rule.cssText)
      .find((text) => text.includes(':hover') && text.includes('preset-button'));
    expect(internalRule).to.contain(':where(');
  });
});

describe('ElementInternals availability', () => {
  it('does not throw when constructed in an environment without a real ElementInternals implementation (e.g. a downstream Vitest + happy-dom suite)', () => {
    const original = HTMLElement.prototype.attachInternals;
    // @ts-expect-error -- simulating an environment that lacks ElementInternals entirely
    delete HTMLElement.prototype.attachInternals;
    try {
      let el: LyraTimeRange | undefined;
      expect(() => {
        el = document.createElement('lr-time-range') as LyraTimeRange;
      }).to.not.throw();
      expect(el!.disabled).to.be.false;
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });
});

it('calls super.willUpdate so a future LyraElement/mixin lifecycle hook stays wired in', async () => {
  // Monkey-patch LyraElement.prototype.willUpdate (the established pattern, e.g. checkbox.test.ts)
  // to prove LyraTimeRange's own willUpdate() override actually calls super.willUpdate(...)
  // rather than shadowing it silently.
  const proto = LyraElement.prototype as unknown as { willUpdate: (changed: PropertyValues) => void };
  const original = proto.willUpdate;
  let called = false;
  proto.willUpdate = function (this: LyraElement, changed: PropertyValues): void {
    called = true;
    original.call(this, changed);
  };
  try {
    const el = (await fixture(html`<lr-time-range></lr-time-range>`)) as LyraTimeRange;
    await el.updateComplete;
    expect(called).to.be.true;
  } finally {
    proto.willUpdate = original;
  }
});

it('references the shared focus-ring tokens on the handle focus-visible outline instead of hardcoded literals', () => {
  expect(styles.cssText).to.include(
    'outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color)',
  );
  expect(styles.cssText).to.include('outline-offset: var(--lr-focus-ring-offset)');
});

it('targets the real preset-button part in the reduced-motion override, not a nonexistent "preset" part', async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      .presets=${[{ label: 'Last hour', start: 0, end: 10 }]}
    ></lr-time-range>`,
  )) as LyraTimeRange;
  const presetButton = el.shadowRoot!.querySelector('[part="preset-button"]');
  expect(presetButton, 'the rendered preset button must actually carry part="preset-button"').to.exist;

  const reducedMotionBlock = styles.cssText.match(/@media \(prefers-reduced-motion: reduce\)[\s\S]*/)?.[0] ?? '';
  expect(reducedMotionBlock).to.include("[part='preset-button']");
  // The pre-fix selector was `[part='preset']`, which never matches the button's real
  // `preset-button` part -- assert the exact broken selector string is gone.
  expect(reducedMotionBlock).to.not.include("[part='preset']");
});

it('renders handles/fill in the correct left-to-right order when min > max (inverted domain)', async () => {
  const el = (await fixture(
    html`<lr-time-range min="100" max="0" start="20" end="80" step="5"></lr-time-range>`,
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
    html`<lr-time-range min="100" max="0" start="20" end="80" step="5"></lr-time-range>`,
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
  // The pointer maps through the normalized [0, 100] domain even though the
  // public min/max attributes are reversed.
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 100 }));
  expect(el.start).to.equal(50);
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 180 }));
  // The 90% pointer position is 90, but the start handle cannot cross end=80.
  expect(el.start).to.equal(80);
});

it('maps RTL pointer positions through the normalized domain when min > max', async () => {
  const el = (await fixture(
    html`<lr-time-range dir="rtl" min="100" max="0" start="20" end="80" step="1"></lr-time-range>`,
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
  // RTL mirrors raw=.2 to .8, then uses normalized [0,100] math: 80.
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 40 }));
  expect(el.start).to.equal(80);
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
});

it("tracks concurrent drags by pointerId so a second pointer cannot hijack the first drag's handle", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80" step="1"></lr-time-range>`,
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
    html`<lr-time-range min="0" max="100" start="20" end="80" step="0"></lr-time-range>`,
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
    html`<lr-time-range min="0" max="100" start="20" end="80" step="0.1"></lr-time-range>`,
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

it('rounds exponent-form steps without collapsing the nudge to zero', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="1" start="0" end="1" step="1e-7"></lr-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  expect(el.start).to.equal(0.0000001);
});

it('anchors the step grid at `min` rather than absolute 0, matching native <input type=range>', async () => {
  const el = (await fixture(
    html`<lr-time-range min="3" max="100" start="3" step="10"></lr-time-range>`,
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
    html`<lr-time-range min="0" max="100" start="not-a-number" end="80"></lr-time-range>`,
  )) as LyraTimeRange;
  expect(Number.isNaN(el.start)).to.be.true;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  // Before the fix, percentOf(NaN) produced `inset-inline-start:NaN%`, an
  // invalid CSS value the browser silently drops, and the template bound
  // aria-valuenow to the literal NaN.
  expect(startHandle.style.insetInlineStart).to.equal('0%');
  expect(startHandle.hasAttribute('aria-valuenow')).to.be.false;
});

it('keeps infinities out of domain geometry and ARIA attributes', async () => {
  const el = (await fixture(
    html`<lr-time-range min="Infinity" max="100" start="Infinity" end="-Infinity"></lr-time-range>`,
  )) as LyraTimeRange;
  const handles = [...el.shadowRoot!.querySelectorAll('[role="slider"]')] as HTMLElement[];
  handles.forEach((handle) => {
    expect(handle.getAttribute('aria-valuemin') ?? '').to.not.include('Infinity');
    expect(handle.getAttribute('aria-valuemax') ?? '').to.not.include('Infinity');
    expect(handle.getAttribute('aria-valuenow') ?? '').to.not.include('Infinity');
    expect(handle.getAttribute('style')).to.not.match(/NaN|Infinity/);
  });
});

it('lets a formatter omit aria-valuetext for either handle with a nullish result', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="38" start="0" end="38"></lr-time-range>`,
  )) as LyraTimeRange;
  el.valueFormatter = (value, handle) => (handle === 'start' ? `Month ${value}` : undefined);
  await el.updateComplete;

  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector('[part="handle-end"]') as HTMLElement;
  expect(startHandle.getAttribute('aria-valuetext')).to.equal('Month 0');
  expect(endHandle.hasAttribute('aria-valuetext')).to.be.false;
});

it('preserves an intentionally empty formatter result instead of treating it as nullish', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="38" start="0" end="38"></lr-time-range>`,
  )) as LyraTimeRange;
  el.valueFormatter = (_value, handle) => (handle === 'start' ? '' : null);
  await el.updateComplete;

  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector('[part="handle-end"]') as HTMLElement;
  expect(startHandle.hasAttribute('aria-valuetext')).to.be.true;
  expect(startHandle.getAttribute('aria-valuetext')).to.equal('');
  expect(endHandle.hasAttribute('aria-valuetext')).to.be.false;
});

it('never passes a non-finite handle value to valueFormatter or aria-valuetext', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="38" start="not-a-number" end="38"></lr-time-range>`,
  )) as LyraTimeRange;
  const formattedHandles: string[] = [];
  el.valueFormatter = (value, handle) => {
    formattedHandles.push(`${handle}:${value}`);
    return `Month ${value}`;
  };
  await el.updateComplete;

  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector('[part="handle-end"]') as HTMLElement;
  expect(formattedHandles).to.deep.equal(['end:38']);
  expect(startHandle.hasAttribute('aria-valuetext')).to.be.false;
  expect(endHandle.getAttribute('aria-valuetext')).to.equal('Month 38');
});

it('defaults each handle\'s aria-label and lets startLabel/endLabel override them', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`,
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

it('resolves the rangeStart/rangeEnd aria-label keys through a .strings override', async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      .strings=${{ rangeStart: 'Début de plage', rangeEnd: 'Fin de plage' }}
    ></lr-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector('[part="handle-end"]') as HTMLElement;
  // With startLabel/endLabel left at their defaults, the aria-labels must resolve through the
  // localization registry -- a strings override reaching the DOM proves the call sites pass no
  // unconditional fallback that would short-circuit it.
  expect(startHandle.getAttribute('aria-label')).to.equal('Début de plage');
  expect(endHandle.getAttribute('aria-label')).to.equal('Fin de plage');
});

it('reflects startLabel/endLabel from their start-label/end-label content attributes', async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      start-label="From"
      end-label="To"
    ></lr-time-range>`,
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
    html`<lr-time-range min="0" max="100" start="20" end="80" disabled></lr-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector('[part="handle-end"]') as HTMLElement;
  expect(startHandle.getAttribute('aria-disabled')).to.equal('true');
  expect(endHandle.getAttribute('aria-disabled')).to.equal('true');

  el.disabled = false;
  await el.updateComplete;
  expect(startHandle.getAttribute('aria-disabled')).to.equal('false');
  expect(endHandle.getAttribute('aria-disabled')).to.equal('false');
});

it('ignores arrow-key input on a handle that keeps keyboard focus after disabled is set mid-interaction', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80" step="5"></lr-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  expect(el.start).to.equal(25);

  el.disabled = true;
  let inputFired = false;
  let changeFired = false;
  el.addEventListener('lr-input', () => (inputFired = true));
  el.addEventListener('lr-change', () => (changeFired = true));
  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(el.start).to.equal(25);
  expect(inputFired).to.be.false;
  startHandle.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
  expect(changeFired).to.be.false;
});

it('toggles tabindex between "0" and "-1" as disabled changes, removing disabled handles from the tab order', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`,
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
        <lr-time-range min="0" max="100" start="20" end="80" step="5"></lr-time-range>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-time-range') as LyraTimeRange;
  await el.updateComplete;

  // `el.disabled` (the consumer-facing IDL property/attribute) is never
  // mutated by fieldset cascading -- only the combined `effectiveDisabled`
  // reflects it (mirrors lr-combobox's/lr-slider's identical
  // `_fieldsetDisabled`/`effectiveDisabled` pattern).
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to.be.true;
  expect(el.disabled).to.be.false;

  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  expect(startHandle.getAttribute('tabindex')).to.equal('-1');
  expect(startHandle.getAttribute('aria-disabled')).to.equal('true');

  // Before the fix, lr-time-range never became form-associated at all, so
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
        <lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-time-range') as LyraTimeRange;
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
    html`<lr-time-range min="50" max="50" start="50" end="50"></lr-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector('[part="handle-end"]') as HTMLElement;
  expect(startHandle.style.insetInlineStart).to.equal('0%');
  expect(endHandle.style.insetInlineStart).to.equal('0%');
});

it("binds each handle's aria-valuemin/aria-valuemax to its reachable sub-range bounded by the sibling handle, not the full domain", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`,
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
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`,
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
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`,
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
    html`<lr-time-range min="0" max="100" start="20" end="80" step="2"></lr-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;

  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
  await el.updateComplete;
  expect(el.start).to.equal(40);

  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
  await el.updateComplete;
  expect(el.start).to.equal(20);
});

it('commits lr-change on keyup of Home/End/PageUp/PageDown, mirroring arrow-key commit', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  let changeDetail: { start: number; end: number } | undefined;
  el.addEventListener('lr-change', (e) => (changeDetail = (e as CustomEvent).detail));
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
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`,
  )) as LyraTimeRange;
  expect(el.presets).to.deep.equal([]);
  expect(el.shadowRoot!.querySelector('[part="presets"]')).to.equal(null);
  expect(el.shadowRoot!.querySelectorAll('[part="preset-button"]').length).to.equal(0);
});

it('renders a [part="presets"] row of [part="preset-button"] buttons when presets is non-empty', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`,
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

it('clicking a preset button sets start/end to that preset and fires lr-change with the right detail', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`,
  )) as LyraTimeRange;
  el.presets = PRESETS;
  await el.updateComplete;
  const buttons = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="preset-button"]');

  let changeDetail: { start: number; end: number } | undefined;
  el.addEventListener('lr-change', (e) => (changeDetail = (e as CustomEvent).detail));
  buttons[1].click(); // 'Last 30 days' -> { start: 0, end: 30 }
  await el.updateComplete;

  expect(el.start).to.equal(0);
  expect(el.end).to.equal(30);
  expect(changeDetail).to.deep.equal({ start: 0, end: 30 });
});

it('marks only the preset matching the current start/end as active (aria-pressed + data-active)', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="0" end="30"></lr-time-range>`,
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
    html`<lr-time-range min="0" max="100" start="0" end="10"></lr-time-range>`,
  )) as LyraTimeRange;
  el.presets = [{ label: 'Far future', start: 60, end: 90 }];
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="preset-button"]')!;
  button.click();
  await el.updateComplete;
  expect(el.start).to.equal(60);
  expect(el.end).to.equal(90);
});

it('emits exactly one lr-input event from a preset click, already holding the final values', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`,
  )) as LyraTimeRange;
  el.presets = [{ label: 'Far future', start: 60, end: 90 }];
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="preset-button"]')!;

  const inputDetails: Array<{ start: number; end: number }> = [];
  el.addEventListener('lr-input', (e) => inputDetails.push((e as CustomEvent).detail));
  button.click();

  // Before the fix, applyPreset() routed both handles through setValue()
  // sequentially, so this fired twice: once with the *stale* pre-preset end
  // (80) while start had already moved but end hadn't yet, and only the
  // second carried the true final values -- a caller reacting to the first
  // lr-input would have observed an inconsistent, never-actually-rendered
  // intermediate state.
  expect(inputDetails.length).to.equal(1);
  expect(inputDetails[0]).to.deep.equal({ start: 60, end: 90 });
});

it('lands exactly on preset values that are not aligned to a coarse step, and still shows data-active', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80" step="10"></lr-time-range>`,
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
    html`<lr-time-range min="0" max="100" start="20" end="80" step="1"></lr-time-range>`,
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
  el.addEventListener('lr-input', (e) => (inputDetail = (e as CustomEvent).detail));
  startHandle.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40 }),
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 100 }));
  expect(inputDetail!.start).to.equal(50);

  let changeDetail: { start: number; end: number } | undefined;
  el.addEventListener('lr-change', (e) => (changeDetail = (e as CustomEvent).detail));
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
    html`<lr-time-range min="0" max="100" start="20" end="80" disabled></lr-time-range>`,
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
    html`<lr-time-range min="0" max="100" start="0" end="30"></lr-time-range>`,
  )) as LyraTimeRange;
  el.presets = PRESETS;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

describe('active-preset cssprops', () => {
  /** Resolves what a `declaration` would compute to *inside this component's shadow root*, where the
   *  `--lr-*` design tokens actually live. Used to assert the unset defaults byte-for-byte against
   *  the tokens they fall back to. */
  function resolvedInShadow(el: LyraTimeRange, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  const overrides =
    '--lr-time-range-preset-active-bg: rgb(0, 51, 102);' +
    '--lr-time-range-preset-active-border-color: rgb(0, 102, 51);' +
    '--lr-time-range-preset-active-color: rgb(255, 255, 0);';

  async function themed(style: string): Promise<LyraTimeRange> {
    const wrapper = (await fixture(html`
      <div style=${style}><lr-time-range min="0" max="100" start="0" end="30"></lr-time-range></div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-time-range') as LyraTimeRange;
    el.presets = PRESETS;
    await el.updateComplete;
    return el;
  }

  it('recolors the active preset from an ancestor, not a :host-declared prop', async () => {
    const el = await themed(overrides);
    const active = el.shadowRoot!.querySelector('[part="preset-button"][data-active]') as HTMLElement;
    expect(active).to.exist;
    expect(active.textContent).to.include('Last 30 days');
    const rendered = getComputedStyle(active);
    expect(rendered.backgroundColor).to.equal('rgb(0, 51, 102)');
    expect(rendered.borderTopColor).to.equal('rgb(0, 102, 51)');
    expect(rendered.color).to.equal('rgb(255, 255, 0)');
    // A non-active preset keeps its resting surface treatment -- the props are scoped to
    // [data-active] only.
    const inactive = el.shadowRoot!.querySelector('[part="preset-button"]:not([data-active])') as HTMLElement;
    expect(getComputedStyle(inactive).backgroundColor).to.equal(
      resolvedInShadow(el, 'background: var(--lr-color-surface)', 'background-color'),
    );
  });

  it('renders byte-identically to the pre-cssprop output when the props are unset', async () => {
    const el = await themed('');
    const active = el.shadowRoot!.querySelector('[part="preset-button"][data-active]') as HTMLElement;
    const rendered = getComputedStyle(active);
    expect(rendered.backgroundColor).to.equal(resolvedInShadow(el, 'background: var(--lr-color-brand)', 'background-color'));
    expect(rendered.borderTopColor).to.equal(
      resolvedInShadow(el, 'border-color: var(--lr-color-brand)', 'border-top-color'),
    );
    expect(rendered.color).to.equal(resolvedInShadow(el, 'color: var(--lr-color-on-brand)', 'color'));
  });

  it('is accessible with the active-preset props themed', async () => {
    const el = await themed(overrides);
    await expect(el).to.be.accessible();
  });
});

it('scales the drag-handle hit-area proportionally, floored at 24px', async () => {
  // The 2xs/xs/s/m tiers land on exact integer pixels (the 24px floor, and
  // the unscaled 28px base), so they compare against an exact string.
  const exact: Record<string, string> = {
    '2xs': '24px',
    xs: '24px',
    s: '24px',
    m: '28px',
  };
  for (const [size, px] of Object.entries(exact)) {
    const el = await fixture(html`<lr-time-range size=${size}></lr-time-range>`);
    const handle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
    const before = getComputedStyle(handle, '::before');
    expect(before.inlineSize, `size=${size}`).to.equal(px);
  }

  // The l/xl tiers multiply 28px by a non-integer scale (1.2/1.4), so the
  // exact result (33.6px/39.2px) isn't representable in IEEE754 binary
  // floating point; combined with each engine's own subpixel layout
  // rounding, the rendered value can come out a few thousandths of a pixel
  // off the mathematical target (e.g. Chromium renders `l` as 33.5938px, not
  // 33.6px). This suite runs across Chromium/Firefox/WebKit
  // (`test:platform` in ci.yml), so a hardcoded exact px string here would
  // be fragile per-engine -- compare numerically with a tolerance instead,
  // which still proves the proportional-scaling math is correct.
  const approximate: Record<string, number> = {
    l: 33.6,
    xl: 39.2,
  };
  for (const [size, px] of Object.entries(approximate)) {
    const el = await fixture(html`<lr-time-range size=${size}></lr-time-range>`);
    const handle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
    const before = getComputedStyle(handle, '::before');
    expect(parseFloat(before.inlineSize), `size=${size}`).to.be.closeTo(px, 0.1);
  }
});

it('exposes independent handle, hit-area, track, and base size hooks', async () => {
  const el = (await fixture(html`
    <lr-time-range
      style="
        --lr-time-range-handle-size: 20px;
        --lr-time-range-hit-size: 30px;
        --lr-time-range-track-size: 6px;
        --lr-time-range-base-size: 36px;
      "
    ></lr-time-range>
  `)) as LyraTimeRange;
  const handle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(handle).inlineSize).to.equal('20px');
  expect(getComputedStyle(handle, '::before').inlineSize).to.equal('30px');
  expect(getComputedStyle(track).blockSize).to.equal('6px');
  expect(getComputedStyle(base).blockSize).to.equal('36px');
});

it('defaults to size "m" and reflects a size attribute', async () => {
  const defaultEl = (await fixture(html`<lr-time-range></lr-time-range>`)) as LyraTimeRange;
  expect(defaultEl.size).to.equal('m');
  const el = (await fixture(html`<lr-time-range size="s"></lr-time-range>`)) as LyraTimeRange;
  expect(el.getAttribute('size')).to.equal('s');
  expect(el.size).to.equal('s');
});

it('floors the preset-button hit-area at 24px at the 2xs tier, without disturbing its natural (already-compliant) size at m', async () => {
  // [part="preset-button"] is a real interactive <button>, not a decorative label. Before the
  // size-scaling `min-block-size`/`min-inline-size` floor was added, the unfloored
  // `calc(var(--lr-space-xs) * var(--lr-time-range-size-scale))`/font-size math shrank this
  // button to ~15px tall at the 2xs tier -- well under the WCAG 2.5.8 24px minimum hit-area,
  // even though the m/l/xl tiers already cleared it unaided (28px/33.6px/37.2px).
  const el2xs = (await fixture(
    html`<lr-time-range size="2xs"></lr-time-range>`,
  )) as LyraTimeRange;
  el2xs.presets = PRESETS;
  await el2xs.updateComplete;
  const button2xs = el2xs.shadowRoot!.querySelector('[part="preset-button"]') as HTMLElement;
  const rendered2xs = getComputedStyle(button2xs);
  expect(parseFloat(rendered2xs.blockSize)).to.be.at.least(24);
  expect(parseFloat(rendered2xs.inlineSize)).to.be.at.least(24);

  const elM = (await fixture(html`<lr-time-range size="m"></lr-time-range>`)) as LyraTimeRange;
  elM.presets = PRESETS;
  await elM.updateComplete;
  const buttonM = elM.shadowRoot!.querySelector('[part="preset-button"]') as HTMLElement;
  // The default `m` tier was never part of the regression (already above the floor, unaided) --
  // the added min-block-size must not change its rendered size. The exact px value depends on the
  // platform's font metrics (line-height from `font: inherit`), so instead of hardcoding a literal
  // that only holds for one font stack, compare against the same element with the floor disabled:
  // if the floor were engaging at `m`, removing it would shrink the button; it must not.
  const flooredHeight = parseFloat(getComputedStyle(buttonM).blockSize);
  buttonM.style.setProperty('min-block-size', '0');
  const unflooredHeight = parseFloat(getComputedStyle(buttonM).blockSize);
  expect(flooredHeight).to.equal(unflooredHeight);
  expect(flooredHeight).to.be.at.least(24);
});

it('stays silent when keyboard normalization or a repeated preset leaves the effective range unchanged', async () => {
  const el = (await fixture(html`
    <lr-time-range min="0" max="10" start="0" end="10" step="1"></lr-time-range>
  `)) as LyraTimeRange;
  el.presets = [{ label: 'All', start: 0, end: 10 }];
  await el.updateComplete;
  const events: string[] = [];
  el.addEventListener('lr-input', () => events.push('input'));
  el.addEventListener('lr-change', () => events.push('change'));

  const start = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  start.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  start.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', bubbles: true }));
  (el.shadowRoot!.querySelector('[part="preset-button"]') as HTMLButtonElement).click();

  expect(events).to.deep.equal([]);
});

it('keeps near-overflow domains and tiny steps finite during keyboard interaction', async () => {
  const el = (await fixture(html`<lr-time-range></lr-time-range>`)) as LyraTimeRange;
  el.min = -Number.MAX_VALUE;
  el.max = Number.MAX_VALUE;
  el.start = 0;
  el.end = Number.MAX_VALUE;
  el.step = Number.MIN_VALUE;
  await el.updateComplete;
  const start = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  start.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;

  expect(Number.isFinite(el.start)).to.be.true;
  expect(Number.isFinite(el.end)).to.be.true;
  expect(start.getAttribute('style')).to.not.contain('NaN');
  expect(start.getAttribute('style')).to.not.contain('Infinity');
});

it('keeps endpoint hit geometry inside a 320px allocation', async () => {
  const el = (await fixture(html`
    <lr-time-range style="inline-size:320px" start="0" end="100"></lr-time-range>
  `)) as LyraTimeRange;
  expect(el.scrollWidth).to.be.at.most(320);
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.scrollWidth).to.be.at.most(base.clientWidth);
});
