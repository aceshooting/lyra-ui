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
  const el = (await fixture(html`<lyra-slider></lyra-slider>`)) as LyraSlider;
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

it('honors a declared value attribute instead of the midpoint default', async () => {
  const el = (await fixture(html`<lyra-slider value="70"></lyra-slider>`)) as LyraSlider;
  expect(el.value).to.equal('70');
  expect(el.valueAsNumber).to.equal(70);
});

it('keeps value (string) and valueAsNumber (number) in sync in both directions', async () => {
  const el = (await fixture(html`<lyra-slider min="0" max="1" step="0.1"></lyra-slider>`)) as LyraSlider;
  el.valueAsNumber = 0.7;
  await elementUpdated(el);
  expect(el.value).to.equal('0.7');

  el.value = '0.3';
  await elementUpdated(el);
  expect(el.valueAsNumber).to.equal(0.3);
});

it('renders the fill and thumb position from the current percent-of-range', async () => {
  const el = (await fixture(
    html`<lyra-slider min="0" max="100" value="25"></lyra-slider>`,
  )) as LyraSlider;
  const fill = el.shadowRoot!.querySelector('[part="fill"]') as HTMLElement;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(fill.style.inlineSize).to.equal('25%');
  expect(thumb.style.insetInlineStart).to.equal('25%');
});

it('renders the visible value readout by default, and omits it when show-value is false', async () => {
  const shown = (await fixture(html`<lyra-slider value="42"></lyra-slider>`)) as LyraSlider;
  const readout = shown.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
  expect(readout).to.exist;
  expect(readout.textContent).to.equal('42');
  expect(readout.getAttribute('aria-hidden')).to.equal('true');

  const hidden = (await fixture(
    html`<lyra-slider value="42" .showValue=${false}></lyra-slider>`,
  )) as LyraSlider;
  expect(hidden.shadowRoot!.querySelector('[part="value"]')).to.equal(null);
});

it('sets aria-label on the thumb from the label prop, falling back to a forwarded host aria-label', async () => {
  const labeled = (await fixture(
    html`<lyra-slider label="Temperature"></lyra-slider>`,
  )) as LyraSlider;
  const thumb1 = labeled.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(thumb1.getAttribute('aria-label')).to.equal('Temperature');

  const forwarded = (await fixture(
    html`<lyra-slider aria-label="Forwarded label"></lyra-slider>`,
  )) as LyraSlider;
  const thumb2 = forwarded.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(thumb2.getAttribute('aria-label')).to.equal('Forwarded label');
});

it('moves by one step on ArrowRight/ArrowUp and emits lyra-input on keydown, lyra-change on keyup', async () => {
  const el = (await fixture(
    html`<lyra-slider min="0" max="100" value="20" step="5"></lyra-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;

  let inputDetail: { value: number } | undefined;
  el.addEventListener('lyra-input', (e) => (inputDetail = (e as CustomEvent).detail));
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(inputDetail!.value).to.equal(25);
  expect(el.valueAsNumber).to.equal(25);

  let changeDetail: { value: number } | undefined;
  el.addEventListener('lyra-change', (e) => (changeDetail = (e as CustomEvent).detail));
  thumb.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
  expect(changeDetail!.value).to.equal(25);
});

it('moves by one step on ArrowLeft/ArrowDown', async () => {
  const el = (await fixture(
    html`<lyra-slider min="0" max="100" value="20" step="5"></lyra-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  expect(el.valueAsNumber).to.equal(15);
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  expect(el.valueAsNumber).to.equal(10);
});

it('jumps to min/max with Home/End', async () => {
  const el = (await fixture(
    html`<lyra-slider min="0" max="100" value="20"></lyra-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  expect(el.valueAsNumber).to.equal(100);
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  expect(el.valueAsNumber).to.equal(0);
});

it('moves by a larger increment with PageUp/PageDown than a single ArrowUp/ArrowDown step', async () => {
  const el = (await fixture(
    html`<lyra-slider min="0" max="100" value="20" step="2"></lyra-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
  expect(el.valueAsNumber).to.equal(40);
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
  expect(el.valueAsNumber).to.equal(20);
});

it('does not emit lyra-change on keyup of a non-slider key', async () => {
  const el = (await fixture(html`<lyra-slider value="20"></lyra-slider>`)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  let changeFired = false;
  el.addEventListener('lyra-change', () => (changeFired = true));
  thumb.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', bubbles: true }));
  expect(changeFired).to.be.false;
});

it('mirrors ArrowRight/ArrowLeft under dir="rtl", matching lyra-time-range/lyra-split', async () => {
  const el = (await fixture(
    html`<lyra-slider dir="rtl" min="0" max="100" value="20"></lyra-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(el.valueAsNumber).to.equal(19);
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  expect(el.valueAsNumber).to.equal(20);
});

it('does not swap ArrowUp/ArrowDown under dir="rtl" (direction only affects the horizontal inline axis)', async () => {
  const el = (await fixture(
    html`<lyra-slider dir="rtl" min="0" max="100" value="20"></lyra-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  expect(el.valueAsNumber).to.equal(21);
});

it('drags the thumb with pointer events and emits lyra-input then lyra-change on release', async () => {
  const el = (await fixture(
    html`<lyra-slider min="0" max="100" value="20" step="1"></lyra-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  mockTrackWidth(el, 200);

  let inputDetail: { value: number } | undefined;
  el.addEventListener('lyra-input', (e) => (inputDetail = (e as CustomEvent).detail));
  thumb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40 }));
  // Midpoint of a 200px-wide track -> ratio 0.5 -> value 50 on a [0,100] domain.
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 100 }));
  expect(inputDetail!.value).to.equal(50);
  expect(el.valueAsNumber).to.equal(50);

  let changeDetail: { value: number } | undefined;
  el.addEventListener('lyra-change', (e) => (changeDetail = (e as CustomEvent).detail));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
  expect(changeDetail!.value).to.equal(50);
});

it('mirrors the drag ratio under dir="rtl", since the track is positioned with inset-inline-start', async () => {
  const el = (await fixture(
    html`<lyra-slider dir="rtl" min="0" max="100" value="20" step="1"></lyra-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  mockTrackWidth(el, 200);

  let inputDetail: { value: number } | undefined;
  el.addEventListener('lyra-input', (e) => (inputDetail = (e as CustomEvent).detail));
  thumb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40 }));
  // Pointer at physical x=160 on a 200px track under RTL: raw=0.8, mirrored to
  // ratio 0.2 -> value 20 on a [0,100] domain.
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 160 }));
  expect(inputDetail!.value).to.equal(20);
});

it('tears down the drag on pointercancel/lostpointercapture even though no pointerup ever arrives', async () => {
  const el = (await fixture(html`<lyra-slider value="20" step="1"></lyra-slider>`)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  mockTrackWidth(el, 200);

  thumb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40 }));
  window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));

  let inputFired = false;
  el.addEventListener('lyra-input', () => (inputFired = true));
  const before = el.valueAsNumber;
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 180 }));
  expect(inputFired).to.be.false;
  expect(el.valueAsNumber).to.equal(before);
});

it('removes the window pointermove/pointerup listeners on disconnect so a detached drag cannot leak', async () => {
  const el = (await fixture(html`<lyra-slider value="20" step="1"></lyra-slider>`)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.setPointerCapture = () => {};

  thumb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40 }));
  const before = el.valueAsNumber;
  el.remove();

  let inputFired = false;
  el.addEventListener('lyra-input', () => (inputFired = true));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 180 }));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
  expect(inputFired).to.be.false;
  expect(el.valueAsNumber).to.equal(before);
});

it('stops an in-progress drag without mutating value once disabled mid-drag', async () => {
  const el = (await fixture(
    html`<lyra-slider min="0" max="100" value="20" step="1"></lyra-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.setPointerCapture = () => {};
  mockTrackWidth(el, 200);

  thumb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 40 }));
  el.disabled = true;

  let inputFired = false;
  let changeFired = false;
  el.addEventListener('lyra-input', () => (inputFired = true));
  el.addEventListener('lyra-change', () => (changeFired = true));
  const before = el.valueAsNumber;
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 100 }));
  expect(inputFired).to.be.false;
  expect(el.valueAsNumber).to.equal(before);

  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
  expect(changeFired).to.be.false;
});

it('ignores click and keydown activation while disabled, and is not focusable', async () => {
  const el = (await fixture(html`<lyra-slider value="20" disabled></lyra-slider>`)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(thumb.getAttribute('tabindex')).to.equal('-1');
  expect(thumb.getAttribute('aria-disabled')).to.equal('true');

  let fired = false;
  el.addEventListener('lyra-input', () => (fired = true));
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(fired).to.be.false;
  expect(el.valueAsNumber).to.equal(20);
});

it('re-clamps value into a narrower domain when min/max change after mount', async () => {
  const el = (await fixture(
    html`<lyra-slider min="0" max="100" value="80"></lyra-slider>`,
  )) as LyraSlider;
  el.max = 50;
  await elementUpdated(el);
  expect(el.valueAsNumber).to.equal(50);
  expect(el.value).to.equal('50');
});

it('rounds a non-integer step to its own decimal precision instead of accumulating float drift', async () => {
  const el = (await fixture(
    html`<lyra-slider min="0" max="1" value="0.2" step="0.1"></lyra-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(el.valueAsNumber).to.equal(0.3);
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(el.valueAsNumber).to.equal(0.4);
});

it('does not poison value with NaN when step is 0', async () => {
  const el = (await fixture(
    html`<lyra-slider min="0" max="100" value="20" step="0"></lyra-slider>`,
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(Number.isNaN(el.valueAsNumber)).to.be.false;
  expect(el.valueAsNumber).to.equal(20);
});

it('participates in a form: submits the string value under name', async () => {
  const form = (await fixture(html`
    <form><lyra-slider name="temperature" value="70"></lyra-slider></form>
  `)) as HTMLFormElement;
  expect(new FormData(form).get('temperature')).to.equal('70');
});

it('restores the declared default value on form.reset()', async () => {
  const form = (await fixture(html`
    <form><lyra-slider name="temperature" value="70"></lyra-slider></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-slider') as LyraSlider;
  el.valueAsNumber = 10;
  await elementUpdated(el);
  expect(el.valueAsNumber).to.equal(10);

  form.reset();
  await elementUpdated(el);
  expect(el.value).to.equal('70');
});

it('re-defaults to the domain midpoint on form.reset() when no default was declared', async () => {
  const form = (await fixture(html`
    <form><lyra-slider name="temperature" min="0" max="100"></lyra-slider></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-slider') as LyraSlider;
  expect(el.valueAsNumber).to.equal(50);
  el.valueAsNumber = 90;
  await elementUpdated(el);

  form.reset();
  await elementUpdated(el);
  expect(el.valueAsNumber).to.equal(50);
});

it('restores and submits the implicit midpoint synchronously during form.reset()', async () => {
  const form = (await fixture(html`
    <form><lyra-slider name="temperature" min="0" max="100"></lyra-slider></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-slider') as LyraSlider;
  el.valueAsNumber = 90;
  expect(new FormData(form).get('temperature')).to.equal('90');

  form.reset();
  expect(el.value).to.equal('50');
  expect(el.valueAsNumber).to.equal(50);
  expect(new FormData(form).get('temperature')).to.equal('50');
});

it('sanitizes and submits a declared default synchronously during form.reset()', async () => {
  const form = (await fixture(html`
    <form><lyra-slider name="temperature" min="0" max="100" step="10" value="83"></lyra-slider></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-slider') as LyraSlider;
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
        <lyra-slider name="temperature"></lyra-slider>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-slider') as LyraSlider;
  // `el.disabled` (the consumer-facing IDL property/attribute) is never
  // mutated by fieldset cascading -- only the combined `effectiveDisabled`
  // reflects it (mirrors lyra-combobox/lyra-select's identical
  // `_fieldsetDisabled`/`effectiveDisabled` pattern).
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to.be.true;
  expect(el.disabled).to.be.false;
});

it('widens the thumb hit/drag area past the visible 16px dot via a transparent ::before', async () => {
  const el = (await fixture(html`<lyra-slider value="20"></lyra-slider>`)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(getComputedStyle(thumb).width).to.equal('16px');
  const before = getComputedStyle(thumb, '::before');
  expect(before.content).to.not.equal('none');
  expect(before.width).to.equal('28px');
  expect(before.height).to.equal('28px');
});

it('references the shared focus-ring tokens on the thumb focus-visible outline', () => {
  expect(styles.cssText).to.include(
    'outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color)',
  );
  expect(styles.cssText).to.include('outline-offset: var(--lyra-focus-ring-offset)');
});

it('is accessible in the default (unset value, no label) state', async () => {
  const el = (await fixture(html`<lyra-slider aria-label="Volume"></lyra-slider>`)) as LyraSlider;
  await expect(el).to.be.accessible();
});

it('is accessible in a populated, labeled state with a fractional step', async () => {
  const el = (await fixture(
    html`<lyra-slider label="Temperature" min="0" max="1" step="0.1" value="0.7"></lyra-slider>`,
  )) as LyraSlider;
  await expect(el).to.be.accessible();
});
