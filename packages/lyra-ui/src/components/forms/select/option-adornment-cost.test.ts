import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import './select.js';
import '../combobox/combobox.js';
import '../combobox/option.js';
import type { LyraSelect } from './select.js';
import type { LyraCombobox } from '../combobox/combobox.js';
import type { LyraOption } from '../combobox/option.js';

for (const kind of ['select', 'combobox'] as const) {
  it(`${kind} serializes adornments only when a projected clone needs invalidation`, async () => {
    const control = await fixture<LyraSelect | LyraCombobox>(kind === 'select'
      ? html`<lr-select label="Choice"><lr-option value="a">Alpha<span slot="start">Initial adornment</span></lr-option></lr-select>`
      : html`<lr-combobox label="Choice"><lr-option value="a">Alpha<span slot="start">Initial adornment</span></lr-option></lr-combobox>`);
    const option = control.querySelector<LyraOption>('lr-option')!;
    const adornment = option.querySelector('span')!;
    const settle = async (): Promise<void> => {
      await option.updateComplete;
      await aTimeout(0);
      await control.updateComplete;
    };
    await settle();
    const getMarkup = Object.getOwnPropertyDescriptor(Element.prototype, 'outerHTML')?.get;
    if (!getMarkup) throw new Error('Expected native markup getter');
    let serializations = 0;
    Object.defineProperty(adornment, 'outerHTML', {
      configurable: true,
      get: (): string => {
        serializations++;
        return getMarkup.call(adornment) as string;
      },
    });
    try {
      option.label = 'Changed label';
      await settle();
      expect(serializations, 'no clone exists while the picker has never opened').to.equal(0);
      adornment.textContent = 'Before first projection';
      await settle();
      expect(serializations).to.equal(0);
      control.open = true;
      await settle();
      const row = control.shadowRoot!.querySelector('[part="option"]')!;
      expect(row.textContent).to.include('Changed label');
      expect(row.textContent).to.include('Before first projection');
      expect(serializations).to.be.greaterThan(0);
      serializations = 0;
      adornment.textContent = 'After projection';
      await settle();
      expect(serializations, 'an existing clone must be compared and refreshed').to.be.greaterThan(0);
      expect(control.shadowRoot!.querySelector('[part="option"]')!.textContent).to.include('After projection');
    } finally {
      Reflect.deleteProperty(adornment, 'outerHTML');
    }
  });
}
