import { fixture, expect, html, elementUpdated } from '@open-wc/testing';
import './slider.js';
import type { LyraSlider } from './slider.js';
import { styles } from './slider.styles.js';

function mockTrackWidth(el: LyraSlider, width: number): void {
  const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  track.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: width,
      bottom: 0,
      width,
      height: 0,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    }) as DOMRect;
}

/** Vertical counterpart of mockTrackWidth: a track box spanning `height` px
 *  down the block axis, with 0% (the domain minimum) at the bottom edge. */
function mockTrackHeight(el: LyraSlider, height: number): void {
  const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  track.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 0,
      bottom: height,
      width: 0,
      height,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    }) as DOMRect;
}

/** Every rendered handle, in DOM order (`thumb` alone, or `thumb-min` then
 *  `thumb-max` in range mode). */
function handles(el: LyraSlider): HTMLElement[] {
  return Array.from(el.shadowRoot!.querySelectorAll('[part~="thumb"]')) as HTMLElement[];
}

/** setPointerCapture is not implemented for synthesized PointerEvents, so
 *  every handle a gesture may capture on has to be stubbed first. */
function stubPointerCapture(el: LyraSlider): void {
  for (const handle of handles(el)) handle.setPointerCapture = () => {};
}

it('defaults min=0, max=100, step=1, and seeds an unset value to the domain midpoint', async () => {
  const el = (await fixture(html`<lr-slider></lr-slider>`)) as LyraSlider;
  expect(el.min).to.equal(0);
  expect(el.max).to.equal(100);
  expect(el.step).to.equal(1);
  expect(el.value).to.equal('50');
  expect(el.valueAsNumber).to.equal(50);
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(thumb.getAttribute('role')).to.equal('slider');
  expect(thumb.getAttribute('aria-valuemin')).to.equal('0');
  expect(thumb.getAttribute('aria-valuemax')).to.equal('100');
  expect(thumb.getAttribute('aria-valuenow')).to.equal('50');
});

it('keeps extreme finite domains and tiny steps finite instead of overflowing rounding math', async () => {
  const el = (await fixture(html`<lr-slider></lr-slider>`)) as LyraSlider;
  el.min = -Number.MAX_VALUE;
  el.max = Number.MAX_VALUE;
  el.step = Number.MIN_VALUE;
  el.valueAsNumber = 0;
  await el.updateComplete;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;

  expect(Number.isFinite(el.valueAsNumber)).to.be.true;
  expect(thumb.getAttribute('style')).to.not.contain('NaN');
  expect(thumb.getAttribute('style')).to.not.contain('Infinity');
});

it('defaults to the true midpoint and pointer-maps the full finite number range', async () => {
  const defaulted = (await fixture(html`
    <lr-slider
      min=${-Number.MAX_VALUE}
      max=${Number.MAX_VALUE}
      step="0"
    ></lr-slider>
  `)) as LyraSlider;
  expect(defaulted.valueAsNumber).to.equal(0);

  const dragged = (await fixture(html`
    <lr-slider
      min=${-Number.MAX_VALUE}
      max=${Number.MAX_VALUE}
      step="0"
      value=${-Number.MAX_VALUE}
    ></lr-slider>
  `)) as LyraSlider;
  const thumb = dragged.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  mockTrackWidth(dragged, 200);
  thumb.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 70, clientX: 0 }),
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 70, clientX: 100 }));
  expect(dragged.valueAsNumber).to.equal(0);
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 70 }));
});

it('honors a declared value attribute instead of the midpoint default', async () => {
  const el = (await fixture(html`<lr-slider value="70"></lr-slider>`)) as LyraSlider;
  expect(el.value).to.equal('70');
  expect(el.valueAsNumber).to.equal(70);
});

it('keeps value (string) and valueAsNumber (number) in sync in both directions', async () => {
  const el = (await fixture(html`<lr-slider min="0" max="1" step="0.1"></lr-slider>`)) as LyraSlider;
  el.valueAsNumber = 0.7;
  await elementUpdated(el);
  expect(el.value).to.equal('0.7');

  el.value = '0.3';
  await elementUpdated(el);
  expect(el.valueAsNumber).to.equal(0.3);
});

it('renders the indicator and thumb position from the current percent-of-range', async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="25"></lr-slider>`,
  )) as LyraSlider;
  const indicator = el.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(indicator.style.inlineSize).to.equal('25%');
  expect(indicator.style.insetInlineStart).to.equal('0%');
  expect(thumb.style.insetInlineStart).to.equal('25%');
  // The filled portion is exposed as `indicator` (matching the wider slider
  // vocabulary); the former `fill` name is gone rather than aliased.
  expect(el.shadowRoot!.querySelectorAll('[part~="fill"]').length).to.equal(0);
});

it('renders the visible value readout by default, and omits it when show-value is false', async () => {
  const shown = (await fixture(html`<lr-slider value="42"></lr-slider>`)) as LyraSlider;
  const readout = shown.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
  expect(readout).to.exist;
  expect(readout.textContent).to.equal('42');
  expect(readout.getAttribute('aria-hidden')).to.equal('true');

  const hidden = (await fixture(
    html`<lr-slider value="42" .showValue=${false}></lr-slider>`,
  )) as LyraSlider;
  expect(hidden.shadowRoot!.querySelector('[part="value"]')).to.equal(null);
});

it('maps a numeric value to opt-in human-readable aria-valuetext without changing the visible readout', async () => {
  const el = (await fixture(html`
    <lr-slider
      min="0"
      max="2"
      value="1"
      .valueFormatter=${(value: number) => ['Cold', 'Warm', 'Hot'][value]}
    ></lr-slider>
  `)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  const readout = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;

  expect(thumb.getAttribute('aria-valuenow')).to.equal('1');
  expect(thumb.getAttribute('aria-valuetext')).to.equal('Warm');
  expect(readout.textContent).to.equal('1');
});

it('formats the default visible value and aria-valuetext with the effective locale', async () => {
  const el = (await fixture(
    html`<lr-slider lang="ar-EG" min="0" max="2000" value="1234"></lr-slider>`,
  )) as LyraSlider;
  const formatted = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 20 }).format(1234);
  expect(el.shadowRoot!.querySelector('[part="thumb"]')!.getAttribute('aria-valuetext')).to.equal(formatted);
  expect(el.shadowRoot!.querySelector('[part="value"]')!.textContent).to.equal(formatted);
});

it('preserves numeric aria-valuetext when valueFormatter is unset and omits it for a nullish result', async () => {
  const el = (await fixture(html`<lr-slider value="42"></lr-slider>`)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(thumb.getAttribute('aria-valuetext')).to.equal('42');

  el.valueFormatter = () => undefined;
  await el.updateComplete;
  expect(thumb.hasAttribute('aria-valuetext')).to.be.false;
});

it('omits the value readout from a plain HTML show-value="false" content attribute too, not just the .showValue property binding', async () => {
  // Regression guard for trueDefaultBooleanConverter: Lit's default presence-based `type:
  // Boolean` converter can never be turned back off from a plain-HTML attribute once the
  // property's own default is `true` -- a bare show-value="false" string would otherwise still
  // parse as truthy (only presence matters to the default converter).
  const el = (await fixture(html`<lr-slider value="42" show-value="false"></lr-slider>`)) as LyraSlider;
  expect(el.showValue).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="value"]')).to.equal(null);

  // Removing the attribute (never setting it at all) still defaults to true, the other half of
  // the same converter's contract.
  const defaulted = (await fixture(html`<lr-slider value="42"></lr-slider>`)) as LyraSlider;
  expect(defaulted.showValue).to.be.true;
});

it('lets a forwarded host aria-label win on the thumb while retaining the label prop fallback', async () => {
  const labeled = (await fixture(
    html`<lr-slider label="Temperature"></lr-slider>`,
  )) as LyraSlider;
  const thumb1 = labeled.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(thumb1.getAttribute('aria-label')).to.equal('Temperature');

  const forwarded = (await fixture(
    html`<lr-slider aria-label="Forwarded label"></lr-slider>`,
  )) as LyraSlider;
  const thumb2 = forwarded.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(thumb2.getAttribute('aria-label')).to.equal('Forwarded label');

  const hostOverride = (await fixture(
    html`<lr-slider label="Temperature" aria-label="Author label"></lr-slider>`,
  )) as LyraSlider;
  const thumb3 = hostOverride.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(thumb3.getAttribute('aria-label')).to.equal('Author label');
});

it('falls back to the localized generic slider label when neither `label` nor a host aria-label is set', async () => {
  const el = (await fixture(html`<lr-slider></lr-slider>`)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(thumb.getAttribute('aria-label')).to.equal('Slider');
});

it('resolves the generic slider label through the strings override', async () => {
  const el = (await fixture(
    html`<lr-slider .strings=${{ sliderLabel: 'Curseur' }}></lr-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(thumb.getAttribute('aria-label')).to.equal('Curseur');
});

it('moves by one step on ArrowRight/ArrowUp and emits lr-input on keydown, lr-change on keyup', async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" step="5"></lr-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;

  let inputDetail: { value: number } | undefined;
  el.addEventListener('lr-input', (e) => (inputDetail = (e as CustomEvent).detail));
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(inputDetail!.value).to.equal(25);
  expect(el.valueAsNumber).to.equal(25);

  let changeDetail: { value: number } | undefined;
  el.addEventListener('lr-change', (e) => (changeDetail = (e as CustomEvent).detail));
  thumb.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
  expect(changeDetail!.value).to.equal(25);
});

it('moves by one step on ArrowLeft/ArrowDown', async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" step="5"></lr-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  expect(el.valueAsNumber).to.equal(15);
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  expect(el.valueAsNumber).to.equal(10);
});

it('does not emit input or change when a keyboard step is clamped to the current value', async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="100" step="5"></lr-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  let inputCount = 0;
  let changeCount = 0;
  el.addEventListener('lr-input', () => inputCount++);
  el.addEventListener('lr-change', () => changeCount++);

  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  thumb.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));

  expect(inputCount).to.equal(0);
  expect(changeCount).to.equal(0);
  expect(el.value).to.equal('100');
});

it('jumps to min/max with Home/End', async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20"></lr-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  expect(el.valueAsNumber).to.equal(100);
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  expect(el.valueAsNumber).to.equal(0);
});

it('moves by a larger increment with PageUp/PageDown than a single ArrowUp/ArrowDown step', async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" step="2"></lr-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
  expect(el.valueAsNumber).to.equal(40);
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
  expect(el.valueAsNumber).to.equal(20);
});

it('does not emit lr-change on keyup of a non-slider key', async () => {
  const el = (await fixture(html`<lr-slider value="20"></lr-slider>`)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  let changeFired = false;
  el.addEventListener('lr-change', () => (changeFired = true));
  thumb.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', bubbles: true }));
  expect(changeFired).to.be.false;
});

it('clears a pending keyboard commit when own or fieldset disablement interrupts the key sequence', async () => {
  const form = (await fixture(html`
    <form><fieldset>
      <lr-slider min="0" max="100" value="20" step="5"></lr-slider>
    </fieldset></form>
  `)) as HTMLFormElement;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  const el = form.querySelector('lr-slider') as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  let changes = 0;
  el.addEventListener('lr-change', () => changes++);

  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(el.valueAsNumber).to.equal(25);
  el.disabled = true;
  el.disabled = false;
  await el.updateComplete;
  thumb.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
  expect(changes, 're-enabling must not revive an own-disabled key sequence').to.equal(0);

  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(el.valueAsNumber).to.equal(30);
  fieldset.disabled = true;
  fieldset.disabled = false;
  await el.updateComplete;
  thumb.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
  expect(changes, 're-enabling must not revive a fieldset-disabled key sequence').to.equal(0);
});

it('mirrors ArrowRight/ArrowLeft under dir="rtl", matching lr-time-range/lr-split', async () => {
  const el = (await fixture(
    html`<lr-slider dir="rtl" min="0" max="100" value="20"></lr-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(el.valueAsNumber).to.equal(19);
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  expect(el.valueAsNumber).to.equal(20);
});

it('does not swap ArrowUp/ArrowDown under dir="rtl" (direction only affects the horizontal inline axis)', async () => {
  const el = (await fixture(
    html`<lr-slider dir="rtl" min="0" max="100" value="20"></lr-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  expect(el.valueAsNumber).to.equal(21);
});

it('drags the thumb with pointer events and emits lr-input then lr-change on release', async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" step="1"></lr-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  mockTrackWidth(el, 200);

  let inputDetail: { value: number } | undefined;
  el.addEventListener('lr-input', (e) => (inputDetail = (e as CustomEvent).detail));
  thumb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40 }));
  // Midpoint of a 200px-wide track -> ratio 0.5 -> value 50 on a [0,100] domain.
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 100 }));
  expect(inputDetail!.value).to.equal(50);
  expect(el.valueAsNumber).to.equal(50);

  let changeDetail: { value: number } | undefined;
  el.addEventListener('lr-change', (e) => (changeDetail = (e as CustomEvent).detail));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
  expect(changeDetail!.value).to.equal(50);
});

it('clicking the track (not the thumb) jumps the thumb to that point and continues the drag', async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" step="1"></lr-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  mockTrackWidth(el, 200);

  let inputDetail: { value: number } | undefined;
  el.addEventListener('lr-input', (e) => (inputDetail = (e as CustomEvent).detail));
  // Clicking directly on the track at x=150 (75% across a 200px track) should
  // immediately jump the thumb there, matching native <input type=range>'s
  // click-to-seek, which this component previously lacked entirely (only the
  // 16px thumb itself had a pointerdown handler).
  track.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 2, clientX: 150 }),
  );
  expect(inputDetail!.value).to.equal(75);
  expect(el.valueAsNumber).to.equal(75);

  // The same gesture continues as a drag from the jumped-to point.
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, clientX: 100 }));
  expect(el.valueAsNumber).to.equal(50);

  let changeDetail: { value: number } | undefined;
  el.addEventListener('lr-change', (e) => (changeDetail = (e as CustomEvent).detail));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2 }));
  expect(changeDetail!.value).to.equal(50);
});

it('does not double-jump when the pointerdown originates on the thumb itself', async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" step="1"></lr-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  mockTrackWidth(el, 200);

  thumb.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 3, clientX: 40 }),
  );
  // A pointerdown on the thumb itself (which bubbles up to [part="base"])
  // must not be treated as a separate track click and jump the value out
  // from under the thumb-only pointerdown handler.
  expect(el.valueAsNumber).to.equal(20);
});

it('focuses the thumb after a track click so keyboard interaction can continue seamlessly', async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" step="1"></lr-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  mockTrackWidth(el, 200);
  track.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 4, clientX: 100 }),
  );
  // Compared as a boolean rather than `expect(...).to.equal(thumb)` -- on
  // failure, chai's default assertion-message formatting walks live DOM
  // nodes (parentNode/ownerDocument/etc. all hold circular back-references),
  // which can make a *failing* comparison of two elements pathologically
  // slow in this browser test environment.
  expect(el.shadowRoot!.activeElement === thumb).to.be.true;
});

it('ignores a track click while disabled', async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" disabled></lr-slider>`,
  )) as LyraSlider;
  const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  mockTrackWidth(el, 200);
  track.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 5, clientX: 150 }),
  );
  expect(el.valueAsNumber).to.equal(20);
});

it('mirrors the drag ratio under dir="rtl", since the track is positioned with inset-inline-start', async () => {
  const el = (await fixture(
    html`<lr-slider dir="rtl" min="0" max="100" value="20" step="1"></lr-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  mockTrackWidth(el, 200);

  let inputDetail: { value: number } | undefined;
  el.addEventListener('lr-input', (e) => (inputDetail = (e as CustomEvent).detail));
  thumb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40 }));
  // Pointer at physical x=40 on a 200px track under RTL: raw=0.2, mirrored
  // to ratio 0.8 -> value 80 on a [0,100] domain.
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 40 }));
  expect(inputDetail!.value).to.equal(80);
});

it('keeps live values but suppresses lr-change and tears down on pointercancel/lostpointercapture', async () => {
  for (const [index, endType] of (['pointercancel', 'lostpointercapture'] as const).entries()) {
    const el = (await fixture(
      html`<lr-slider min="0" max="100" value="20" step="1"></lr-slider>`,
    )) as LyraSlider;
    const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
    thumb.setPointerCapture = () => {};
    mockTrackWidth(el, 200);
    let inputs = 0;
    let changes = 0;
    el.addEventListener('lr-input', () => inputs++);
    el.addEventListener('lr-change', () => changes++);
    const pointerId = 50 + index;

    thumb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId, clientX: 40 }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId, clientX: 100 }));
    expect(el.valueAsNumber, endType).to.equal(50);
    expect(inputs, endType).to.equal(1);

    window.dispatchEvent(new PointerEvent(endType, { pointerId }));
    expect(changes, endType).to.equal(0);
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId, clientX: 180 }));
    expect(inputs, endType).to.equal(1);
    expect(el.valueAsNumber, endType).to.equal(50);
  }
});

it('removes the window pointermove/pointerup listeners on disconnect so a detached drag cannot leak', async () => {
  const el = (await fixture(html`<lr-slider value="20" step="1"></lr-slider>`)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.setPointerCapture = () => {};

  thumb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40 }));
  const before = el.valueAsNumber;
  el.remove();

  let inputFired = false;
  el.addEventListener('lr-input', () => (inputFired = true));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 180 }));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
  expect(inputFired).to.be.false;
  expect(el.valueAsNumber).to.equal(before);
});

it('stops an in-progress drag without mutating value once disabled mid-drag', async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" step="1"></lr-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  mockTrackWidth(el, 200);

  thumb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40 }));
  el.disabled = true;

  let inputFired = false;
  let changeFired = false;
  el.addEventListener('lr-input', () => (inputFired = true));
  el.addEventListener('lr-change', () => (changeFired = true));
  const before = el.valueAsNumber;
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 100 }));
  expect(inputFired).to.be.false;
  expect(el.valueAsNumber).to.equal(before);

  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
  expect(changeFired).to.be.false;
});

it('ignores click and keydown activation while disabled, and is not focusable', async () => {
  const el = (await fixture(html`<lr-slider value="20" disabled></lr-slider>`)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(thumb.getAttribute('tabindex')).to.equal('-1');
  expect(thumb.getAttribute('aria-disabled')).to.equal('true');

  let fired = false;
  el.addEventListener('lr-input', () => (fired = true));
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(fired).to.be.false;
  expect(el.valueAsNumber).to.equal(20);
});

it('forwards host focus()/blur() to the internal thumb control', async () => {
  const el = (await fixture(html`<lr-slider></lr-slider>`)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  el.focus();
  expect(el.shadowRoot!.activeElement === thumb).to.be.true;
  el.blur();
  expect(el.shadowRoot!.activeElement).to.equal(null);
});

it('forwards host click() to the internal thumb control', async () => {
  const el = (await fixture(html`<lr-slider></lr-slider>`)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  let clicked = false;
  thumb.addEventListener('click', () => (clicked = true));
  el.click();
  expect(clicked).to.be.true;
});

it('re-clamps value into a narrower domain when min/max change after mount', async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="80"></lr-slider>`,
  )) as LyraSlider;
  el.max = 50;
  await elementUpdated(el);
  expect(el.valueAsNumber).to.equal(50);
  expect(el.value).to.equal('50');
});

it('rounds a non-integer step to its own decimal precision instead of accumulating float drift', async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="1" value="0.2" step="0.1"></lr-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(el.valueAsNumber).to.equal(0.3);
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(el.valueAsNumber).to.equal(0.4);
});

it('does not poison value with NaN when step is 0', async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="20" step="0"></lr-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(Number.isNaN(el.valueAsNumber)).to.be.false;
  expect(el.valueAsNumber).to.equal(20);
});

it('does not poison the submitted value with the literal string "NaN" when valueAsNumber is written NaN', async () => {
  const form = (await fixture(html`
    <form><lr-slider name="temperature" min="0" max="100" value="20"></lr-slider></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-slider') as LyraSlider;
  el.valueAsNumber = NaN;
  await elementUpdated(el);
  // Before the fix, clampValue(NaN) propagated NaN straight through
  // Math.max/Math.min, so `value` became the literal string "NaN" and stayed
  // that way, including in FormData.
  expect(el.value).to.not.equal('NaN');
  expect(Number.isFinite(el.valueAsNumber)).to.be.true;
  expect(new FormData(form).get('temperature')).to.not.equal('NaN');
});

it('resyncs a post-mount non-numeric value string instead of submitting it as-is', async () => {
  const form = (await fixture(html`
    <form><lr-slider name="temperature" min="0" max="100"></lr-slider></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-slider') as LyraSlider;
  el.value = 'not-a-number';
  await elementUpdated(el);
  // Before the fix, willUpdate() only re-sanitized an *empty* value string,
  // so a non-numeric string assigned directly stuck around forever as the
  // FormAssociated submitted value.
  expect(el.value).to.not.equal('not-a-number');
  expect(Number.isFinite(Number(el.value))).to.be.true;
  expect(new FormData(form).get('temperature')).to.not.equal('not-a-number');
});

it('sanitizes value and form submission synchronously when the range changes', async () => {
  const form = (await fixture(html`
    <form><lr-slider name="temperature" min="0" max="100" step="10" value="83"></lr-slider></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-slider') as LyraSlider;
  expect(el.value).to.equal('80');
  expect(new FormData(form).get('temperature')).to.equal('80');

  el.max = 50;
  expect(el.value).to.equal('50');
  expect(el.valueAsNumber).to.equal(50);
  expect(new FormData(form).get('temperature')).to.equal('50');

  el.value = 'NaN';
  expect(el.value).to.equal('30');
  expect(Number.isFinite(el.valueAsNumber)).to.be.true;
  expect(new FormData(form).get('temperature')).to.equal('30');
});

it('rounds exponential step values without collapsing them to zero', async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="1" value="0" step="1e-7"></lr-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(el.valueAsNumber).to.equal(0.0000001);
  expect(el.value).to.equal('1e-7');
});

it('does not render invalid CSS or an aria-valuenow="Infinity" when max is Infinity', async () => {
  // No `value` attribute -- this forces the eager midpoint default
  // (`ensureValue()`/`defaultNumericValue()`) to compute off the domain
  // itself, which is where an unguarded Infinity actually poisons things.
  const el = (await fixture(html`<lr-slider min="0" max="Infinity"></lr-slider>`)) as LyraSlider;
  await elementUpdated(el);
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  // Before the fix, domain()'s `isNaN(this.max)` guard let Infinity straight
  // through (isNaN(Infinity) is false). The midpoint default then computed
  // `0 + Infinity / 2` = Infinity, so `value` became the literal string
  // "Infinity", and percentOf(Infinity) with an infinite span produced
  // Infinity/Infinity = NaN, rendering `inset-inline-start:NaN%` (invalid
  // CSS the browser silently drops) and an aria-valuenow of "Infinity".
  expect(thumb.style.insetInlineStart).to.match(/^-?\d+(\.\d+)?%$/);
  expect(thumb.getAttribute('aria-valuenow')).to.not.equal('Infinity');
  expect(Number.isFinite(Number(thumb.getAttribute('aria-valuenow')))).to.be.true;
});

it('participates in a form: submits the string value under name', async () => {
  const form = (await fixture(html`
    <form><lr-slider name="temperature" value="70"></lr-slider></form>
  `)) as HTMLFormElement;
  expect(new FormData(form).get('temperature')).to.equal('70');
});

it('restores the declared default value on form.reset()', async () => {
  const form = (await fixture(html`
    <form><lr-slider name="temperature" value="70"></lr-slider></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-slider') as LyraSlider;
  el.valueAsNumber = 10;
  await elementUpdated(el);
  expect(el.valueAsNumber).to.equal(10);

  form.reset();
  await elementUpdated(el);
  expect(el.value).to.equal('70');
});

it('re-defaults to the domain midpoint on form.reset() when no default was declared', async () => {
  const form = (await fixture(html`
    <form><lr-slider name="temperature" min="0" max="100"></lr-slider></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-slider') as LyraSlider;
  expect(el.valueAsNumber).to.equal(50);
  el.valueAsNumber = 90;
  await elementUpdated(el);

  form.reset();
  await elementUpdated(el);
  expect(el.valueAsNumber).to.equal(50);
});

it('restores and submits the implicit midpoint synchronously during form.reset()', async () => {
  const form = (await fixture(html`
    <form><lr-slider name="temperature" min="0" max="100"></lr-slider></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-slider') as LyraSlider;
  el.valueAsNumber = 90;
  expect(new FormData(form).get('temperature')).to.equal('90');

  form.reset();
  expect(el.value).to.equal('50');
  expect(el.valueAsNumber).to.equal(50);
  expect(new FormData(form).get('temperature')).to.equal('50');
});

it('sanitizes and submits a declared default synchronously during form.reset()', async () => {
  const form = (await fixture(html`
    <form><lr-slider name="temperature" min="0" max="100" step="10" value="83"></lr-slider></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-slider') as LyraSlider;
  expect(el.valueAsNumber).to.equal(80);
  el.valueAsNumber = 20;
  expect(new FormData(form).get('temperature')).to.equal('20');

  form.reset();
  expect(el.value).to.equal('80');
  expect(el.valueAsNumber).to.equal(80);
  expect(new FormData(form).get('temperature')).to.equal('80');
});

it('formDisabledCallback disables the control via a fieldset', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset disabled>
        <lr-slider name="temperature"></lr-slider>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-slider') as LyraSlider;
  // `el.disabled` (the consumer-facing IDL property/attribute) is never
  // mutated by fieldset cascading -- only the combined `effectiveDisabled`
  // reflects it (mirrors lr-combobox/lr-select's identical
  // `_fieldsetDisabled`/`effectiveDisabled` pattern).
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to.be.true;
  expect(el.disabled).to.be.false;
  expect(getComputedStyle(el).opacity).to.equal('0.5');
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(getComputedStyle(thumb).cursor).to.equal('not-allowed');
});

it('widens the thumb hit/drag area past the visible 16px dot via a transparent ::before', async () => {
  const el = (await fixture(html`<lr-slider value="20"></lr-slider>`)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(getComputedStyle(thumb).width).to.equal('16px');
  const before = getComputedStyle(thumb, '::before');
  expect(before.content).to.not.equal('none');
  expect(before.width).to.equal('28px');
  expect(before.height).to.equal('28px');
});

it('keeps every range handle above the 24px WCAG 2.5.8 target floor, in both orientations', async () => {
  for (const orientation of ['horizontal', 'vertical'] as const) {
    const el = (await fixture(html`
      <lr-slider range orientation=${orientation} min-value="20" max-value="80"></lr-slider>
    `)) as LyraSlider;
    expect(handles(el).length, orientation).to.equal(2);
    for (const handle of handles(el)) {
      const hitArea = getComputedStyle(handle, '::before');
      expect(Number.parseFloat(hitArea.width), orientation).to.be.at.least(24);
      expect(Number.parseFloat(hitArea.height), orientation).to.be.at.least(24);
    }
  }
});

it('flips the thumb and hit-area centering translate under dir="rtl"', async () => {
  const ltr = (await fixture(html`<lr-slider value="20"></lr-slider>`)) as LyraSlider;
  const ltrThumb = ltr.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(new DOMMatrixReadOnly(getComputedStyle(ltrThumb).transform).m41).to.be.lessThan(0);
  expect(new DOMMatrixReadOnly(getComputedStyle(ltrThumb, '::before').transform).m41).to.be.lessThan(0);

  // The thumb (and its enlarged ::before hit-area) is positioned via a logical
  // inset-inline-start percentage, which anchors to the physical right edge under RTL -- the
  // centering translateX must flip to positive there or the visible dot (and the drag hit
  // zone) lands a full box-width off from its true track position.
  const rtl = (await fixture(html`<lr-slider dir="rtl" value="20"></lr-slider>`)) as LyraSlider;
  const rtlThumb = rtl.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(new DOMMatrixReadOnly(getComputedStyle(rtlThumb).transform).m41).to.be.greaterThan(0);
  expect(new DOMMatrixReadOnly(getComputedStyle(rtlThumb, '::before').transform).m41).to.be.greaterThan(0);
});

it('references the shared focus-ring tokens on the thumb focus-visible outline', () => {
  expect(styles.cssText).to.include(
    'outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color)',
  );
  expect(styles.cssText).to.include('outline-offset: var(--lr-focus-ring-offset)');
});

it('gives every thumb a :hover rule alongside its :focus-visible ring, gated on neither disabled nor readonly', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(
    /:host\(:not\(:disabled\):not\(\[readonly\]\)\)\s*\[part~='thumb'\]:hover\s*\{[^}]*box-shadow:/,
  );
});

it('applies the thumb hover ring to both range handles, and withdraws the grab cursor while readonly', async () => {
  const el = (await fixture(html`<lr-slider range min-value="20" max-value="80"></lr-slider>`)) as LyraSlider;
  // Rendered result rather than stylesheet text: the [part~='thumb'] selector
  // really reaches a handle whose part attribute is "thumb thumb-max".
  for (const handle of handles(el)) {
    expect(getComputedStyle(handle).cursor).to.equal('grab');
  }

  const readonlySlider = (await fixture(html`<lr-slider readonly></lr-slider>`)) as LyraSlider;
  expect(
    getComputedStyle(readonlySlider.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement).cursor,
  ).to.equal('default');
});

it('is accessible in the default (unset value, no label) state', async () => {
  const el = (await fixture(html`<lr-slider aria-label="Volume"></lr-slider>`)) as LyraSlider;
  await expect(el).to.be.accessible();
});

it('is accessible in a populated, labeled state with a fractional step', async () => {
  const el = (await fixture(
    html`<lr-slider label="Temperature" min="0" max="1" step="0.1" value="0.7"></lr-slider>`,
  )) as LyraSlider;
  await expect(el).to.be.accessible();
});

// ---------------------------------------------------------------------------
// range (two-handle) mode
// ---------------------------------------------------------------------------

it('renders two independently named role="slider" handles in range mode', async () => {
  const el = (await fixture(html`
    <lr-slider range min="0" max="100" min-value="20" max-value="80"></lr-slider>
  `)) as LyraSlider;

  expect(handles(el).length).to.equal(2);
  const minThumb = el.shadowRoot!.querySelector('[part~="thumb-min"]') as HTMLElement;
  const maxThumb = el.shadowRoot!.querySelector('[part~="thumb-max"]') as HTMLElement;
  expect(minThumb.getAttribute('role')).to.equal('slider');
  expect(maxThumb.getAttribute('role')).to.equal('slider');
  // Which handle is which is announced, never left to visual position (which
  // mirrors under RTL anyway).
  expect(minThumb.getAttribute('aria-label')).to.equal('Range start');
  expect(maxThumb.getAttribute('aria-label')).to.equal('Range end');
  expect(minThumb.getAttribute('tabindex')).to.equal('0');
  expect(maxThumb.getAttribute('tabindex')).to.equal('0');
  expect(el.minValue).to.equal(20);
  expect(el.maxValue).to.equal(80);
});

it('bounds each handle`s aria-valuemin/aria-valuemax by its sibling, not by the full domain', async () => {
  const el = (await fixture(html`
    <lr-slider range min="0" max="100" min-value="20" max-value="80"></lr-slider>
  `)) as LyraSlider;
  const minThumb = el.shadowRoot!.querySelector('[part~="thumb-min"]') as HTMLElement;
  const maxThumb = el.shadowRoot!.querySelector('[part~="thumb-max"]') as HTMLElement;

  expect(minThumb.getAttribute('aria-valuenow')).to.equal('20');
  expect(minThumb.getAttribute('aria-valuemin')).to.equal('0');
  expect(minThumb.getAttribute('aria-valuemax')).to.equal('80');
  expect(maxThumb.getAttribute('aria-valuenow')).to.equal('80');
  expect(maxThumb.getAttribute('aria-valuemin')).to.equal('20');
  expect(maxThumb.getAttribute('aria-valuemax')).to.equal('100');
  expect(minThumb.getAttribute('aria-valuetext')).to.equal('20');
  expect(maxThumb.getAttribute('aria-valuetext')).to.equal('80');
});

it('names the two-handle group from label/aria-label while each handle keeps its own name', async () => {
  const el = (await fixture(html`
    <lr-slider range label="Price" min-value="20" max-value="80"></lr-slider>
  `)) as LyraSlider;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal('group');
  expect(base.getAttribute('aria-label')).to.equal('Price');

  const forwarded = (await fixture(html`
    <lr-slider range aria-label="Budget"></lr-slider>
  `)) as LyraSlider;
  expect(
    (forwarded.shadowRoot!.querySelector('[part="base"]') as HTMLElement).getAttribute('aria-label'),
  ).to.equal('Budget');

  // A single-handle slider is not a group -- the thumb itself owns the name.
  const single = (await fixture(html`<lr-slider label="Price"></lr-slider>`)) as LyraSlider;
  expect((single.shadowRoot!.querySelector('[part="base"]') as HTMLElement).hasAttribute('role')).to
    .be.false;
});

it('resolves both range handle names through the strings override', async () => {
  const el = (await fixture(html`
    <lr-slider range .strings=${{ rangeStart: 'Début', rangeEnd: 'Fin' }}></lr-slider>
  `)) as LyraSlider;
  expect(
    (el.shadowRoot!.querySelector('[part~="thumb-min"]') as HTMLElement).getAttribute('aria-label'),
  ).to.equal('Début');
  expect(
    (el.shadowRoot!.querySelector('[part~="thumb-max"]') as HTMLElement).getAttribute('aria-label'),
  ).to.equal('Fin');
});

it('defaults an unset min-value/max-value to the full domain span', async () => {
  const el = (await fixture(html`<lr-slider range min="10" max="30"></lr-slider>`)) as LyraSlider;
  expect(el.minValue).to.equal(10);
  expect(el.maxValue).to.equal(30);
});

it('never lets the handles cross, and lets them meet at a single value', async () => {
  const el = (await fixture(html`
    <lr-slider range min="0" max="100" step="10" min-value="40" max-value="60"></lr-slider>
  `)) as LyraSlider;
  const minThumb = el.shadowRoot!.querySelector('[part~="thumb-min"]') as HTMLElement;

  minThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  minThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(el.minValue).to.equal(60);
  // Meeting is allowed (a zero-width selection); crossing is not.
  minThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(el.minValue).to.equal(60);
  expect(el.maxValue).to.equal(60);

  await elementUpdated(el);
  const indicator = el.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  expect(indicator.style.inlineSize).to.equal('0%');

  // Both handles can still travel away from the meeting point.
  minThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  expect(el.minValue).to.equal(50);
  expect(el.maxValue).to.equal(60);
});

it('pulls the sibling handle along instead of crossing when a value is assigned past it', async () => {
  const el = (await fixture(html`
    <lr-slider range min="0" max="100" min-value="20" max-value="80"></lr-slider>
  `)) as LyraSlider;
  el.minValue = 95;
  expect(el.minValue).to.equal(80);
  expect(el.maxValue).to.equal(80);

  el.maxValue = 10;
  expect(el.maxValue).to.equal(80);
});

it('renders the range indicator from min-value to max-value, not from the domain floor', async () => {
  const el = (await fixture(html`
    <lr-slider range min="0" max="100" min-value="20" max-value="80"></lr-slider>
  `)) as LyraSlider;
  const indicator = el.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  expect(indicator.style.insetInlineStart).to.equal('20%');
  expect(indicator.style.inlineSize).to.equal('60%');
});

it('steps each range handle independently with Arrow/Page/Home/End keys', async () => {
  const el = (await fixture(html`
    <lr-slider range min="0" max="100" step="2" min-value="20" max-value="80"></lr-slider>
  `)) as LyraSlider;
  const minThumb = el.shadowRoot!.querySelector('[part~="thumb-min"]') as HTMLElement;
  const maxThumb = el.shadowRoot!.querySelector('[part~="thumb-max"]') as HTMLElement;

  minThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(el.minValue).to.equal(22);
  expect(el.maxValue).to.equal(80);

  maxThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
  expect(el.maxValue).to.equal(60);
  expect(el.minValue).to.equal(22);

  // Home/End jump to the *reachable* bound, i.e. the sibling handle, not the
  // component's full [min, max] domain.
  maxThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  expect(el.maxValue).to.equal(22);
  maxThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  expect(el.maxValue).to.equal(100);
  minThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  expect(el.minValue).to.equal(0);
});

it('emits lr-input/lr-change carrying both handle values and which handle moved', async () => {
  const el = (await fixture(html`
    <lr-slider range min="0" max="100" step="5" min-value="20" max-value="80"></lr-slider>
  `)) as LyraSlider;
  const maxThumb = el.shadowRoot!.querySelector('[part~="thumb-max"]') as HTMLElement;

  let inputDetail: { value: number; minValue: number; maxValue: number; handle: string } | undefined;
  el.addEventListener('lr-input', (e) => (inputDetail = (e as CustomEvent).detail));
  let changeDetail: typeof inputDetail;
  el.addEventListener('lr-change', (e) => (changeDetail = (e as CustomEvent).detail));

  maxThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  expect(inputDetail!.handle).to.equal('max');
  expect(inputDetail!.value).to.equal(75);
  expect(inputDetail!.minValue).to.equal(20);
  expect(inputDetail!.maxValue).to.equal(75);

  maxThumb.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', bubbles: true }));
  expect(changeDetail!.handle).to.equal('max');
  expect(changeDetail!.maxValue).to.equal(75);
});

it('emits handle "value" details in single-handle mode', async () => {
  const el = (await fixture(html`<lr-slider min="0" max="100" value="20"></lr-slider>`)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  let detail: { value: number; handle: string } | undefined;
  el.addEventListener('lr-input', (e) => (detail = (e as CustomEvent).detail));
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(detail!.handle).to.equal('value');
  expect(detail!.value).to.equal(21);
});

it('drags the nearer handle when the track itself is clicked in range mode', async () => {
  const el = (await fixture(html`
    <lr-slider range min="0" max="100" step="1" min-value="20" max-value="80"></lr-slider>
  `)) as LyraSlider;
  const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  stubPointerCapture(el);
  mockTrackWidth(el, 200);

  // x=60 of 200 -> 30%, nearer the min handle (20) than the max handle (80).
  track.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 11, clientX: 60 }));
  expect(el.minValue).to.equal(30);
  expect(el.maxValue).to.equal(80);
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 11, clientX: 20 }));
  expect(el.minValue).to.equal(10);
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 11 }));

  // x=180 of 200 -> 90%, nearer the max handle.
  track.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 12, clientX: 180 }));
  expect(el.maxValue).to.equal(90);
  expect(el.minValue).to.equal(10);
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 12 }));
});

it('keeps a range drag on its own handle and tears down cleanly on pointercancel', async () => {
  const el = (await fixture(html`
    <lr-slider range min="0" max="100" step="1" min-value="20" max-value="80"></lr-slider>
  `)) as LyraSlider;
  const minThumb = el.shadowRoot!.querySelector('[part~="thumb-min"]') as HTMLElement;
  stubPointerCapture(el);
  mockTrackWidth(el, 200);
  let changes = 0;
  el.addEventListener('lr-change', () => changes++);

  minThumb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 13, clientX: 40 }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 13, clientX: 60 }));
  expect(el.minValue).to.equal(30);
  expect(el.maxValue).to.equal(80);

  window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 13 }));
  expect(changes).to.equal(0);
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 13, clientX: 120 }));
  expect(el.minValue).to.equal(30);
});

it('mirrors range arrow keys under dir="rtl"', async () => {
  const el = (await fixture(html`
    <lr-slider dir="rtl" range min="0" max="100" min-value="20" max-value="80"></lr-slider>
  `)) as LyraSlider;
  const minThumb = el.shadowRoot!.querySelector('[part~="thumb-min"]') as HTMLElement;
  minThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(el.minValue).to.equal(19);
  minThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  expect(el.minValue).to.equal(20);
});

it('shows both handle values in the readout, formatted with the effective locale', async () => {
  const el = (await fixture(html`
    <lr-slider range lang="ar-EG" min="0" max="2000" min-value="1234" max-value="1500"></lr-slider>
  `)) as LyraSlider;
  const readout = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
  const formatter = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 20 });
  expect(readout.textContent).to.contain(formatter.format(1234));
  expect(readout.textContent).to.contain(formatter.format(1500));
});

it('passes the handle identity to valueFormatter in range mode', async () => {
  const el = (await fixture(html`
    <lr-slider
      range
      min="0"
      max="100"
      min-value="20"
      max-value="80"
      .valueFormatter=${(value: number, handle: string) => `${handle}:${value}`}
    ></lr-slider>
  `)) as LyraSlider;
  expect(
    (el.shadowRoot!.querySelector('[part~="thumb-min"]') as HTMLElement).getAttribute('aria-valuetext'),
  ).to.equal('min:20');
  expect(
    (el.shadowRoot!.querySelector('[part~="thumb-max"]') as HTMLElement).getAttribute('aria-valuetext'),
  ).to.equal('max:80');
});

// ---------------------------------------------------------------------------
// range form participation
// ---------------------------------------------------------------------------

it('drops out of FormData in range mode and rejoins it when range is turned back off', async () => {
  const form = (await fixture(html`
    <form><lr-slider name="temperature" value="70"></lr-slider></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-slider') as LyraSlider;
  expect(new FormData(form).get('temperature')).to.equal('70');

  // A two-value control cannot faithfully submit one string, so range mode
  // removes the control from submission entirely (mirroring <lr-time-range>)
  // rather than submitting the unused single-handle value.
  el.range = true;
  expect(new FormData(form).get('temperature')).to.equal(null);

  el.range = false;
  expect(new FormData(form).get('temperature')).to.equal('70');
});

it('restores declared min-value/max-value defaults on form.reset()', async () => {
  const form = (await fixture(html`
    <form><lr-slider name="price" range min="0" max="100" min-value="20" max-value="80"></lr-slider></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-slider') as LyraSlider;
  el.minValue = 45;
  el.maxValue = 55;
  await elementUpdated(el);

  form.reset();
  await elementUpdated(el);
  expect(el.minValue).to.equal(20);
  expect(el.maxValue).to.equal(80);
});

it('re-defaults the range handles to the full domain on form.reset() when nothing was declared', async () => {
  const form = (await fixture(html`
    <form><lr-slider name="price" range min="0" max="100"></lr-slider></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-slider') as LyraSlider;
  el.minValue = 40;
  el.maxValue = 60;
  await elementUpdated(el);

  form.reset();
  await elementUpdated(el);
  expect(el.minValue).to.equal(0);
  expect(el.maxValue).to.equal(100);
});

it('still cascades <fieldset disabled> to both range handles', async () => {
  const form = (await fixture(html`
    <form><fieldset disabled><lr-slider range name="price"></lr-slider></fieldset></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-slider') as LyraSlider;
  await elementUpdated(el);
  for (const handle of handles(el)) {
    expect(handle.getAttribute('tabindex')).to.equal('-1');
    expect(handle.getAttribute('aria-disabled')).to.equal('true');
  }
});

// ---------------------------------------------------------------------------
// orientation
// ---------------------------------------------------------------------------

it('announces aria-orientation on every handle in both orientations', async () => {
  const horizontal = (await fixture(html`<lr-slider></lr-slider>`)) as LyraSlider;
  expect(
    (horizontal.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement).getAttribute(
      'aria-orientation',
    ),
  ).to.equal('horizontal');

  const vertical = (await fixture(html`
    <lr-slider range orientation="vertical"></lr-slider>
  `)) as LyraSlider;
  for (const handle of handles(vertical)) {
    expect(handle.getAttribute('aria-orientation')).to.equal('vertical');
  }
});

it('positions a vertical slider along the block axis with the domain floor at the bottom', async () => {
  const el = (await fixture(html`
    <lr-slider orientation="vertical" min="0" max="100" value="25"></lr-slider>
  `)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  const indicator = el.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  expect(thumb.style.insetBlockEnd).to.equal('25%');
  expect(thumb.style.insetInlineStart).to.equal('');
  expect(indicator.style.blockSize).to.equal('25%');
  expect(indicator.style.insetBlockEnd).to.equal('0%');
});

it('maps a vertical drag to the block axis, upward being an increasing value', async () => {
  const el = (await fixture(html`
    <lr-slider orientation="vertical" min="0" max="100" step="1" value="20"></lr-slider>
  `)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  stubPointerCapture(el);
  mockTrackHeight(el, 200);

  let inputDetail: { value: number } | undefined;
  el.addEventListener('lr-input', (e) => (inputDetail = (e as CustomEvent).detail));
  thumb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 21, clientY: 160 }));
  // y=50 of a 200px-tall track -> 25% down from the top -> 75% of the domain.
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 21, clientY: 50 }));
  expect(inputDetail!.value).to.equal(75);
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 21 }));
});

it('does not mirror the vertical drag axis under dir="rtl"', async () => {
  const el = (await fixture(html`
    <lr-slider dir="rtl" orientation="vertical" min="0" max="100" step="1" value="20"></lr-slider>
  `)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  stubPointerCapture(el);
  mockTrackHeight(el, 200);
  thumb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 22, clientY: 160 }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 22, clientY: 50 }));
  expect(el.valueAsNumber).to.equal(75);
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 22 }));
});

it('keeps ArrowUp/ArrowDown as the primary vertical keys', async () => {
  const el = (await fixture(html`
    <lr-slider orientation="vertical" min="0" max="100" step="5" value="20"></lr-slider>
  `)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  expect(el.valueAsNumber).to.equal(25);
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  expect(el.valueAsNumber).to.equal(20);
});

it('lays a vertical slider out along the block axis', async () => {
  const el = (await fixture(html`
    <lr-slider orientation="vertical" style="--lr-slider-track-length: 120px;"></lr-slider>
  `)) as LyraSlider;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getBoundingClientRect().height).to.equal(120);
  expect(base.getBoundingClientRect().width).to.be.lessThan(120);
});

// ---------------------------------------------------------------------------
// readonly
// ---------------------------------------------------------------------------

it('renders aria-readonly in both states', async () => {
  const el = (await fixture(html`<lr-slider></lr-slider>`)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(thumb.getAttribute('aria-readonly')).to.equal('false');

  el.readonly = true;
  await elementUpdated(el);
  expect(thumb.getAttribute('aria-readonly')).to.equal('true');
});

it('keeps a readonly slider focusable but refuses every value change', async () => {
  const el = (await fixture(html`
    <lr-slider readonly min="0" max="100" step="5" value="20"></lr-slider>
  `)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  stubPointerCapture(el);
  mockTrackWidth(el, 200);
  let events = 0;
  el.addEventListener('lr-input', () => events++);
  el.addEventListener('lr-change', () => events++);

  // Unlike `disabled`, a readonly slider is still reachable and announced.
  expect(thumb.getAttribute('tabindex')).to.equal('0');
  expect(thumb.getAttribute('aria-disabled')).to.equal('false');

  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  thumb.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
  track.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 31, clientX: 150 }));
  thumb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 32, clientX: 40 }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 32, clientX: 100 }));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 32 }));

  expect(el.valueAsNumber).to.equal(20);
  expect(events).to.equal(0);
});

it('refuses range handle changes while readonly', async () => {
  const el = (await fixture(html`
    <lr-slider readonly range min="0" max="100" min-value="20" max-value="80"></lr-slider>
  `)) as LyraSlider;
  const minThumb = el.shadowRoot!.querySelector('[part~="thumb-min"]') as HTMLElement;
  minThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(el.minValue).to.equal(20);
});

// ---------------------------------------------------------------------------
// with-markers
// ---------------------------------------------------------------------------

it('renders one marker per step position when with-markers is set', async () => {
  const el = (await fixture(html`
    <lr-slider with-markers min="0" max="100" step="25"></lr-slider>
  `)) as LyraSlider;
  const markers = el.shadowRoot!.querySelectorAll('[part="marker"]');
  expect(markers.length).to.equal(5);
  expect((markers[0] as HTMLElement).style.insetInlineStart).to.equal('0%');
  expect((markers[4] as HTMLElement).style.insetInlineStart).to.equal('100%');
  expect(
    (el.shadowRoot!.querySelector('[part="markers"]') as HTMLElement).getAttribute('aria-hidden'),
  ).to.equal('true');
});

it('positions markers along the block axis in a vertical slider', async () => {
  const el = (await fixture(html`
    <lr-slider with-markers orientation="vertical" min="0" max="100" step="50"></lr-slider>
  `)) as LyraSlider;
  const markers = el.shadowRoot!.querySelectorAll('[part="marker"]');
  expect(markers.length).to.equal(3);
  expect((markers[1] as HTMLElement).style.insetBlockEnd).to.equal('50%');
});

it('omits markers entirely for an unstepped or impossibly dense step grid', async () => {
  const unstepped = (await fixture(html`
    <lr-slider with-markers min="0" max="100" step="0"></lr-slider>
  `)) as LyraSlider;
  expect(unstepped.shadowRoot!.querySelectorAll('[part="marker"]').length).to.equal(0);
  expect(unstepped.shadowRoot!.querySelectorAll('[part="markers"]').length).to.equal(0);

  // A 1e-7 step over [0, 1] is ten million ticks -- rendering them would hang
  // the page, so the grid is dropped rather than drawn.
  const dense = (await fixture(html`
    <lr-slider with-markers min="0" max="1" step="1e-7"></lr-slider>
  `)) as LyraSlider;
  expect(dense.shadowRoot!.querySelectorAll('[part="marker"]').length).to.equal(0);
});

// ---------------------------------------------------------------------------
// with-tooltip
// ---------------------------------------------------------------------------

it('shows a locale-formatted tooltip while a handle is focused, and hides it on blur', async () => {
  const el = (await fixture(html`
    <lr-slider with-tooltip lang="ar-EG" min="0" max="2000" value="1234"></lr-slider>
  `)) as LyraSlider;
  const tooltip = el.shadowRoot!.querySelector('[part~="tooltip"]') as HTMLElement;
  expect(tooltip.textContent!.trim()).to.equal(
    new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 20 }).format(1234),
  );
  expect(tooltip.getAttribute('aria-hidden')).to.equal('true');
  expect(tooltip.getAttribute('part')).to.equal('tooltip');

  el.focus();
  await elementUpdated(el);
  expect(
    (el.shadowRoot!.querySelector('[part~="tooltip"]') as HTMLElement).getAttribute('part'),
  ).to.equal('tooltip tooltip-visible');

  el.blur();
  await elementUpdated(el);
  expect(
    (el.shadowRoot!.querySelector('[part~="tooltip"]') as HTMLElement).getAttribute('part'),
  ).to.equal('tooltip');
});

it('shows the dragged handle`s tooltip for the duration of the drag', async () => {
  const el = (await fixture(html`
    <lr-slider with-tooltip range min="0" max="100" step="1" min-value="20" max-value="80"></lr-slider>
  `)) as LyraSlider;
  const maxThumb = el.shadowRoot!.querySelector('[part~="thumb-max"]') as HTMLElement;
  stubPointerCapture(el);
  mockTrackWidth(el, 200);

  maxThumb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 41, clientX: 160 }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 41, clientX: 120 }));
  await elementUpdated(el);
  expect(el.shadowRoot!.querySelectorAll('[part~="tooltip-visible"]').length).to.equal(1);
  const visible = el.shadowRoot!.querySelector('[part~="tooltip-visible"]') as HTMLElement;
  expect(visible.textContent!.trim()).to.equal('60');

  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 41 }));
  await elementUpdated(el);
  expect(el.shadowRoot!.querySelectorAll('[part~="tooltip-visible"]').length).to.equal(0);
});

it('uses valueFormatter for the tooltip text when one is supplied', async () => {
  const el = (await fixture(html`
    <lr-slider
      with-tooltip
      min="0"
      max="2"
      value="1"
      .valueFormatter=${(value: number) => ['Cold', 'Warm', 'Hot'][value]}
    ></lr-slider>
  `)) as LyraSlider;
  const tooltip = el.shadowRoot!.querySelector('[part~="tooltip"]') as HTMLElement;
  expect(tooltip.textContent!.trim()).to.equal('Warm');
});

it('transitions the tooltip with motion tokens and stops under prefers-reduced-motion', async () => {
  const el = (await fixture(html`<lr-slider with-tooltip value="20"></lr-slider>`)) as LyraSlider;
  const tooltip = el.shadowRoot!.querySelector('[part~="tooltip"]') as HTMLElement;
  // Rendered result, not stylesheet text: the transition really resolves.
  expect(getComputedStyle(tooltip).transitionDuration).to.not.equal('0s');

  // The reduced-motion branch cannot be emulated from inside the page, so the
  // media-query arm itself is asserted structurally (as elsewhere in this
  // package).
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(
    /@media \(prefers-reduced-motion: reduce\) \{[^]*\[part~='tooltip'\]\s*\{[^}]*transition: none/,
  );
});

// ---------------------------------------------------------------------------
// hint
// ---------------------------------------------------------------------------

it('renders hint text and describes every handle with it', async () => {
  const el = (await fixture(html`
    <lr-slider range hint="Pick a budget window"></lr-slider>
  `)) as LyraSlider;
  const hintEl = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  expect(hintEl.textContent).to.contain('Pick a budget window');
  expect(hintEl.hasAttribute('hidden')).to.be.false;
  for (const handle of handles(el)) {
    expect(handle.getAttribute('aria-describedby')).to.equal(hintEl.id);
  }
  expect(hintEl.id.length).to.be.greaterThan(0);
});

it('renders slotted hint content and describes the thumb with it', async () => {
  const el = (await fixture(html`
    <lr-slider><span slot="hint">Slotted help</span></lr-slider>
  `)) as LyraSlider;
  await elementUpdated(el);
  const hintEl = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  expect(hintEl.hasAttribute('hidden')).to.be.false;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(thumb.getAttribute('aria-describedby')).to.equal(hintEl.id);
});

it('hides the hint region and adds no aria-describedby when no hint is provided', async () => {
  const el = (await fixture(html`<lr-slider></lr-slider>`)) as LyraSlider;
  const hintEl = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  expect(hintEl.hasAttribute('hidden')).to.be.true;
  expect(getComputedStyle(hintEl).display).to.equal('none');
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(thumb.hasAttribute('aria-describedby')).to.be.false;
});

// ---------------------------------------------------------------------------
// unset-regression + adversarial fixtures
// ---------------------------------------------------------------------------

it('leaves the single-handle contract unchanged when none of the new properties are set', async () => {
  const el = (await fixture(html`<lr-slider value="42"></lr-slider>`)) as LyraSlider;
  expect(el.range).to.be.false;
  expect(el.readonly).to.be.false;
  expect(el.withMarkers).to.be.false;
  expect(el.withTooltip).to.be.false;
  expect(el.orientation).to.equal('horizontal');
  expect(el.hint).to.equal('');

  expect(handles(el).length).to.equal(1);
  expect(el.shadowRoot!.querySelectorAll('[part="thumb"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelectorAll('[part="markers"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('[part~="tooltip"]').length).to.equal(0);
  expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).hasAttribute('role')).to.be
    .false;
  expect((el.shadowRoot!.querySelector('[part="value"]') as HTMLElement).textContent).to.equal('42');
});

it('keeps a range slider finite when min > max, step is 0, and the handles start outside the domain', async () => {
  const el = (await fixture(html`
    <lr-slider range min="100" max="0" step="0" min-value="-500" max-value="500"></lr-slider>
  `)) as LyraSlider;
  expect(el.minValue).to.equal(0);
  expect(el.maxValue).to.equal(100);
  for (const handle of handles(el)) {
    expect(handle.style.insetInlineStart).to.match(/^-?\d+(\.\d+)?%$/);
    expect(Number.isFinite(Number(handle.getAttribute('aria-valuenow')))).to.be.true;
  }
  const indicator = el.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  expect(indicator.style.inlineSize).to.equal('100%');
});

it('re-clamps both range handles into a narrowed domain', async () => {
  const el = (await fixture(html`
    <lr-slider range min="0" max="100" min-value="20" max-value="80"></lr-slider>
  `)) as LyraSlider;
  el.max = 50;
  await elementUpdated(el);
  expect(el.minValue).to.equal(20);
  expect(el.maxValue).to.equal(50);
});

it('is accessible as a labeled two-handle range with markers, a tooltip and a hint', async () => {
  const el = (await fixture(html`
    <lr-slider
      range
      with-markers
      with-tooltip
      label="Budget"
      hint="Choose a price window"
      min="0"
      max="100"
      step="10"
      min-value="20"
      max-value="80"
    ></lr-slider>
  `)) as LyraSlider;
  expect(handles(el).length).to.equal(2);
  expect(el.shadowRoot!.querySelectorAll('[part="marker"]').length).to.equal(11);
  await expect(el).to.be.accessible();
});

it('is accessible as a vertical, readonly slider', async () => {
  const el = (await fixture(html`
    <lr-slider orientation="vertical" readonly label="Volume" value="30"></lr-slider>
  `)) as LyraSlider;
  expect(
    (el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement).getAttribute('aria-readonly'),
  ).to.equal('true');
  await expect(el).to.be.accessible();
});

describe('size', () => {
  async function slider(markup: unknown): Promise<LyraSlider> {
    const el = (await fixture(markup as never)) as LyraSlider;
    await el.updateComplete;
    return el;
  }
  const rectOf = (el: LyraSlider, part: string): DOMRect =>
    (el.shadowRoot!.querySelector(`[part~="${part}"]`) as HTMLElement).getBoundingClientRect();

  it('defaults to the "m" tier and reflects it', async () => {
    const el = await slider(html`<lr-slider label="Temp"></lr-slider>`);
    expect(el.size).to.equal('m');
    expect(el.getAttribute('size')).to.equal('m');
  });

  it('grows the rendered thumb and track from size="s" to size="l"', async () => {
    const small = await slider(html`<lr-slider size="s" label="Temp"></lr-slider>`);
    const large = await slider(html`<lr-slider size="l" label="Temp"></lr-slider>`);
    expect(rectOf(large, 'thumb').width).to.be.greaterThan(rectOf(small, 'thumb').width);
    expect(rectOf(large, 'thumb').height).to.be.greaterThan(rectOf(small, 'thumb').height);
    expect(rectOf(large, 'track').height).to.be.greaterThan(rectOf(small, 'track').height);
    expect(rectOf(large, 'base').height).to.be.greaterThan(rectOf(small, 'base').height);
  });

  it('renders "small"/"large" at the same geometry as "s"/"l"', async () => {
    const s = await slider(html`<lr-slider size="s" label="Temp"></lr-slider>`);
    const small = await slider(html`<lr-slider size="small" label="Temp"></lr-slider>`);
    const l = await slider(html`<lr-slider size="l" label="Temp"></lr-slider>`);
    const large = await slider(html`<lr-slider size="large" label="Temp"></lr-slider>`);
    expect(rectOf(small, 'thumb').width).to.be.closeTo(rectOf(s, 'thumb').width, 0.5);
    expect(rectOf(large, 'thumb').width).to.be.closeTo(rectOf(l, 'thumb').width, 0.5);
  });

  it('keeps the handle drag area at or above 28px at every tier', async () => {
    for (const size of ['2xs', 'xs', 's', 'm', 'l', 'xl'] as const) {
      const el = await slider(html`<lr-slider size=${size} label="Temp"></lr-slider>`);
      const thumb = el.shadowRoot!.querySelector('[part~="thumb"]') as HTMLElement;
      const area = Number.parseFloat(getComputedStyle(thumb, '::before').inlineSize);
      expect(area, `${size} drag area`).to.be.at.least(28);
    }
  });

  it('is accessible at a non-default tier', async () => {
    const el = await slider(html`<lr-slider size="l" label="Temp"></lr-slider>`);
    await expect(el).to.be.accessible();
  });
});
