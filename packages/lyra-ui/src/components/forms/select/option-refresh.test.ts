import { expect, fixture, html } from '@open-wc/testing';
import './select.js';
import '../combobox/combobox.js';
import '../combobox/option.js';
import type { LyraSelect } from './select.js';
import type { LyraCombobox } from '../combobox/combobox.js';
import type { LyraOption } from '../combobox/option.js';

for (const kind of ['select', 'combobox'] as const) {
  it(`refreshes a batch of ${kind} option metadata without repeatedly scanning the catalog`, async () => {
    const control = await fixture<LyraSelect | LyraCombobox>(kind === 'select'
      ? html`<lr-select label="Choice"></lr-select>`
      : html`<lr-combobox label="Choice"></lr-combobox>`);
    const options = Array.from({ length: 64 }, (_, index) => {
      const option = document.createElement('lr-option') as LyraOption;
      option.value = String(index);
      option.textContent = `Option ${index}`;
      return option;
    });
    control.append(...options);
    await Promise.all(options.map((option) => option.updateComplete));
    await control.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    let reads = 0;
    for (const option of options) {
      for (const key of ['value', 'defaultSelected'] as const) {
        const value = option[key];
        Object.defineProperty(option, key, { configurable: true, get: () => {
          reads++;
          return value;
        } });
      }
    }
    for (const [index, option] of options.entries()) option.sub = `Changed ${index}`;
    await Promise.all(options.map((option) => option.updateComplete));
    await control.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    expect(control.shadowRoot!.textContent).to.include('Changed 63');
    // Bound catalog work rather than wall-clock time: each option may participate in several
    // selection/render passes, but one metadata batch must not cause a full pass per option.
    expect(reads).to.be.lessThan(options.length * 30);
  });
}
