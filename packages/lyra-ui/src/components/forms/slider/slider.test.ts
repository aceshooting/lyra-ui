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

it('renders the fill and thumb position from the current percent-of-range', async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="25"></lr-slider>`,
  )) as LyraSlider;
  const fill = el.shadowRoot!.querySelector('[part="fill"]') as HTMLElement;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(fill.style.inlineSize).to.equal('25%');
  expect(thumb.style.insetInlineStart).to.equal('25%');
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

it('sets aria-label on the thumb from the label prop, falling back to a forwarded host aria-label', async () => {
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

it('tears down the drag on pointercancel/lostpointercapture even though no pointerup ever arrives', async () => {
  const el = (await fixture(html`<lr-slider value="20" step="1"></lr-slider>`)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  mockTrackWidth(el, 200);

  thumb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40 }));
  window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));

  let inputFired = false;
  el.addEventListener('lr-input', () => (inputFired = true));
  const before = el.valueAsNumber;
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 180 }));
  expect(inputFired).to.be.false;
  expect(el.valueAsNumber).to.equal(before);
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

it('gives the thumb a :hover rule alongside its :focus-visible ring, gated on :host(:not(:disabled))', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(
    /:host\(:not\(:disabled\)\)\s*\[part='thumb'\]:hover\s*\{[^}]*box-shadow:/,
  );
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
