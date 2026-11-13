import { expect, fixture, html } from '@open-wc/testing';
import type { LyraNumberInput } from './number-input.class.js';
import './number-input.js';

for (const cause of ['disabled', 'readonly'] as const) {
  for (const direction of ['up', 'down'] as const) {
    it(`keeps the numeric value and events unchanged when ${cause} during a step ${direction} click`, async () => {
      const host = await fixture<LyraNumberInput>(html`<lr-number-input value="5" min="0" max="10"></lr-number-input>`);
      const button = host.shadowRoot!.querySelector<HTMLButtonElement>(`[part~="stepper-${direction}"]`)!;
      const events: string[] = [];
      for (const name of ['input', 'lr-input', 'change', 'lr-change']) {
        host.addEventListener(name, () => { events.push(name); });
      }
      host.addEventListener('click', () => { host[cause] = true; }, { capture: true, once: true });
      expect(button.disabled).to.equal(false);
      button.click();
      expect(host.value).to.equal('5');
      expect(events).to.deep.equal([]);
      await host.updateComplete;
      expect(button.disabled).to.equal(true);
      host[cause] = false;
      await host.updateComplete;
      button.click();
      expect(host.value).to.equal(direction === 'up' ? '6' : '4');
      expect(host.shadowRoot!.querySelector<HTMLInputElement>('input')!.value).to.equal(host.value);
      expect(events).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
    });
  }
}

it('keeps both stepper names localized while disabled and after re-enabling', async () => {
  const host = await fixture<LyraNumberInput>(html`<lr-number-input label="Quantity"></lr-number-input>`);
  const names = () => ['up', 'down'].map(direction =>
    host.shadowRoot!.querySelector(`[part~="stepper-${direction}"]`)!.getAttribute('aria-label'));
  expect(names()).to.deep.equal(['Increase', 'Decrease']);
  host.strings = { numberInputIncrease: 'Augmenter', numberInputDecrease: 'Diminuer' };
  host.disabled = true;
  await host.updateComplete;
  expect(names()).to.deep.equal(['Augmenter', 'Diminuer']);
  host.disabled = false;
  await host.updateComplete;
  expect(names()).to.deep.equal(['Augmenter', 'Diminuer']);
});
