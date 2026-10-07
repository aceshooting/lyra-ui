import { expect, fixture, html } from '@open-wc/testing';
import type { LyraTimeRange } from './time-range.js';
import './time-range.js';

for (const entry of ['track', 'handle-start']) {
  for (const button of [1, 2]) {
    it(`time-range ignores mouse button ${button} on ${entry} without capturing or emitting`, async () => {
      const el = await fixture<LyraTimeRange>(html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`);
      const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      const rect = base.getBoundingClientRect();
      const target = el.shadowRoot!.querySelector<HTMLElement>(`[part="${entry}"]`)!;
      let captures = 0;
      for (const handle of el.shadowRoot!.querySelectorAll<HTMLElement>('[role="slider"]')) {
        handle.setPointerCapture = () => captures += 1;
      }
      const events: string[] = [];
      for (const name of ['input', 'change', 'lr-input', 'lr-change']) el.addEventListener(name, () => events.push(name));
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 51, pointerType: 'mouse', button, clientX: rect.left + rect.width * 0.35 }));
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 51, pointerType: 'mouse', buttons: button === 1 ? 4 : 2, clientX: rect.left + rect.width * 0.4 }));
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 51, pointerType: 'mouse', button }));
      expect([el.start, el.end]).to.deep.equal([20, 80]);
      expect(captures).to.equal(0);
      expect(events).to.deep.equal([]);
    });
  }

  for (const pointerType of ['mouse', 'touch', 'pen']) {
    it(`time-range retains primary ${pointerType} interaction from ${entry} including nonprimary pointer identity`, async () => {
      const el = await fixture<LyraTimeRange>(html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`);
      const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      const rect = base.getBoundingClientRect();
      const target = el.shadowRoot!.querySelector<HTMLElement>(`[part="${entry}"]`)!;
      for (const handle of el.shadowRoot!.querySelectorAll<HTMLElement>('[role="slider"]')) handle.setPointerCapture = () => {};
      let inputs = 0;
      let changes = 0;
      el.addEventListener('lr-input', () => inputs += 1);
      el.addEventListener('lr-change', () => changes += 1);
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 52, pointerType, button: 0, isPrimary: false, clientX: rect.left + rect.width * 0.3 }));
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 52, pointerType, buttons: 1, clientX: rect.left + rect.width * 0.4 }));
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 52, pointerType, button: 0 }));
      expect(el.start).to.be.greaterThan(20);
      expect(el.end).to.equal(80);
      expect(inputs).to.be.greaterThan(0);
      expect(changes).to.equal(1);
    });
  }
}

it('time-range keeps honest validity where the environment has no attachInternals', async () => {
  const { LyraTimeRange } = await import('./time-range.class.js');
  Object.defineProperty(LyraTimeRange.prototype, 'attachInternals', { configurable: true, value: undefined });
  try {
    const el = await fixture<LyraTimeRange>(html`<lr-time-range min="0" max="100" start="10" end="20"></lr-time-range>`);
    const invalid = () =>
      [...el.shadowRoot!.querySelectorAll('[role="slider"]')].map((handle) => handle.getAttribute('aria-invalid'));
    expect(invalid(), 'a legal range is not announced invalid').to.deep.equal(['false', 'false']);
    expect(el.checkValidity()).to.equal(true);
    el.setCustomValidity('Pick a narrower range');
    await el.updateComplete;
    expect(el.checkValidity(), 'a custom error is kept').to.equal(false);
    expect(el.validationMessage).to.equal('Pick a narrower range');
    expect(invalid()).to.deep.equal(['true', 'true']);
  } finally {
    delete (LyraTimeRange.prototype as unknown as Record<string, unknown>)['attachInternals'];
  }
});

it('time-range relays one host focus/blur pair for a visit, not one per handle', async () => {
  const { sendKeys } = await import('@web/test-runner-commands');
  const { focusByKeyboard } = await import('../../../../test/wtr-focus.js');
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>
    <button id="after">After</button>
  </div>`);
  const el = wrapper.querySelector('lr-time-range') as LyraTimeRange;
  await el.updateComplete;
  const events: string[] = [];
  el.addEventListener('focus', () => events.push('focus'));
  el.addEventListener('blur', () => events.push('blur'));
  const [start] = el.shadowRoot!.querySelectorAll<HTMLElement>('[role="slider"]');
  await focusByKeyboard(start!);
  await sendKeys({ press: 'Tab' });
  expect(el.shadowRoot!.activeElement?.getAttribute('part'), 'Tab moved to the end handle').to.contain('handle-end');
  await sendKeys({ press: 'Tab' });
  expect(events).to.deep.equal(['focus', 'blur']);
});

it('time-range releases pointer capture when disabling aborts a drag', async () => {
  const el = await fixture<LyraTimeRange>(html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`);
  await el.updateComplete;
  const handle = el.shadowRoot!.querySelector<HTMLElement>('[part="handle-start"]')!;
  const released: number[] = [];
  let captured = false;
  handle.setPointerCapture = () => {
    captured = true;
  };
  handle.hasPointerCapture = () => captured;
  handle.releasePointerCapture = (pointerId: number) => {
    released.push(pointerId);
    captured = false;
  };
  const rect = handle.getBoundingClientRect();
  handle.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, composed: true, pointerId: 7, pointerType: 'mouse', button: 0,
    clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
  }));
  expect(captured, 'the drag captured the pointer').to.equal(true);
  el.disabled = true;
  expect(released, 'the aborted drag gives the pointer back').to.deep.equal([7]);
});

it('time-range keeps a fractional min as the step grid anchor for keyboard and pointer input', async () => {
  const el = await fixture<LyraTimeRange>(html`<lr-time-range min="0.5" max="10" start="0.5" end="10" step="1"></lr-time-range>`);
  const handle = el.shadowRoot!.querySelector<HTMLElement>('[part="handle-start"]')!;
  const stops: number[] = [];
  for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft']) {
    handle.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    stops.push(el.start);
  }
  expect(stops).to.deep.equal([1.5, 2.5, 3.5, 2.5, 1.5, 0.5]);
  const rect = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!.getBoundingClientRect();
  handle.setPointerCapture = () => {};
  el.shadowRoot!.querySelector<HTMLElement>('[part="track"]')!.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, pointerId: 61, pointerType: 'mouse', button: 0, clientX: rect.left + rect.width * (0.9 / 9.5),
  }));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 61, pointerType: 'mouse', button: 0 }));
  expect(el.start).to.equal(1.5);
});
