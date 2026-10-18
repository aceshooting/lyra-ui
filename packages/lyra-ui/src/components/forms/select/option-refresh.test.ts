import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import './select.js';
import '../combobox/combobox.js';
import '../combobox/option.js';
import type { LyraSelect } from './select.js';
import type { LyraCombobox } from '../combobox/combobox.js';
import type { LyraOption } from '../combobox/option.js';

for (const kind of ['select', 'combobox'] as const) {
  it(`${kind} reserves catalog membership scans for selected writes, including after reconnect`, async () => {
    const wrapper = await fixture<HTMLDivElement>(kind === 'select'
      ? html`<div><lr-select label="Choice"></lr-select></div>`
      : html`<div><lr-combobox label="Choice"></lr-combobox></div>`);
    const control = wrapper.firstElementChild as LyraSelect | LyraCombobox;
    const options = Array.from({ length: 32 }, (_, index) => {
      const option = document.createElement('lr-option') as LyraOption;
      option.value = String(index);
      option.textContent = `Option ${index}`;
      return option;
    });
    control.append(...options);
    const settle = async (): Promise<void> => {
      await Promise.all(options.map((option) => option.updateComplete));
      await aTimeout(0);
      await control.updateComplete;
    };
    await settle();
    let escaped = 0;
    wrapper.addEventListener('lr-option-change', () => escaped++);

    for (const reconnect of [false, true]) {
      if (reconnect) {
        control.remove();
        wrapper.append(control);
        await settle();
      }
      // Observe only this control's current catalog, leaving global array operations untouched.
      const catalog = (control as unknown as { options: LyraOption[] }).options;
      const includes = catalog.includes;
      let membershipCalls = 0;
      Object.defineProperty(catalog, 'includes', {
        configurable: true,
        value: (option: LyraOption, fromIndex?: number): boolean => {
          membershipCalls++;
          return includes.call(catalog, option, fromIndex);
        },
      });
      try {
        for (const [index, option] of options.entries()) option.label = `Updated ${reconnect} ${index}`;
        await settle();
        expect(membershipCalls, 'metadata must not check membership once per option').to.be.lessThan(4);
      } finally {
        Reflect.deleteProperty(catalog, 'includes');
      }
      const last = options[options.length - 1]!;
      last.selected = true;
      await Promise.resolve();
      expect(control.value, 'selected writes commit after their microtask batch').to.equal(last.value);
      expect(escaped, 'child refresh signals stay inside the picker').to.equal(0);
      control.open = true;
      await settle();
      const labels = Array.from(control.shadowRoot!.querySelectorAll('[part="option-label"]'));
      expect(labels.map((label) => label.textContent?.trim())).to.deep.equal(
        options.map((option) => option.label),
      );
      control.open = false;
      await settle();
    }
  });

  it(`refreshes a batch of ${kind} option metadata without repeatedly scanning the catalog`, async () => {
    const control = await fixture<LyraSelect | LyraCombobox>(kind === 'select'
      ? html`<lr-select label="Choice" open></lr-select>`
      : html`<lr-combobox label="Choice" open></lr-combobox>`);
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
