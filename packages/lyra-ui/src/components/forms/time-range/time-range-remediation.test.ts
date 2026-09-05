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
