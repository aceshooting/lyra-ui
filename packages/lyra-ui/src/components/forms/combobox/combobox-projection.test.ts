import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import './combobox.js';
import './option.js';
import type { LyraCombobox } from './combobox.js';
import type { LyraOption } from './option.js';

const settle = async (control: LyraCombobox): Promise<void> => {
  await aTimeout(0);
  await control.updateComplete;
};
const rows = (control: LyraCombobox): HTMLElement[] =>
  Array.from(control.shadowRoot!.querySelectorAll<HTMLElement>('[part="option"]'));

it('materializes only capped local suggestions and resolves freshly included option data', async () => {
  const control = await fixture<LyraCombobox>(html`<lr-combobox label="Choice" max-render="2"></lr-combobox>`);
  const reads = Array.from({ length: 32 }, () => 0);
  const options = reads.map((_, index) => {
    const option = document.createElement('lr-option') as LyraOption;
    option.value = String(index);
    option.label = `Option ${index}`;
    const adornment = document.createElement('span');
    adornment.slot = 'start';
    adornment.textContent = `Adornment ${index}`;
    option.append(adornment);
    option.data = { index };
    return option;
  });
  try {
    control.append(...options);
    await Promise.all(options.map((option) => option.updateComplete));
    await settle(control);
    // Observe after the initial Lit update so its accessor-shadowing check remains intact.
    for (const [index, option] of options.entries()) {
      const data = option.data;
      Object.defineProperty(option, 'data', {
        configurable: true,
        get: () => {
          reads[index] = reads[index]! + 1;
          return data;
        },
      });
    }
    control.open = true;
    await settle(control);
    expect(rows(control).map((row) => row.dataset['value'])).to.deep.equal(['0', '1']);
    expect(reads[0]).to.be.greaterThan(0);
    expect(reads[1]).to.be.greaterThan(0);
    expect(reads.slice(2), 'out-of-cap rows must not be projected').to.deep.equal(Array(30).fill(0));

    options[31]!.querySelector('span')!.textContent = 'Changed adornment';
    control.inputValue = 'Option 31';
    await settle(control);
    expect(rows(control).map((row) => row.dataset['value'])).to.deep.equal(['31']);
    expect(reads[31]).to.be.greaterThan(0);
    expect(rows(control)[0]!.textContent).to.include('Changed adornment');
    rows(control)[0]!.click();
    await settle(control);
    expect(control.value).to.equal('31');
    expect(control.selectedRows.map((row) => row.data)).to.deep.equal([{ index: 31 }]);
  } finally {
    for (const option of options) Reflect.deleteProperty(option, 'data');
  }
});

it('retains source order, duplicate occurrences and groups when selected suggestions exceed the cap', async () => {
  const control = await fixture<LyraCombobox>(html`
    <lr-combobox label="Choice" multiple max-render="2">
      <lr-option value="a" group="First">Alpha</lr-option>
      <lr-option value="a" group="First">Another alpha</lr-option>
      <lr-option value="b" group="Middle">Beta</lr-option>
      <lr-option value="c" group="Middle" disabled>Gamma</lr-option>
      <lr-option value="d" group="Last">Delta</lr-option>
    </lr-combobox>
  `);
  await settle(control);
  control.value = ['d', 'c'];
  control.open = true;
  await settle(control);
  expect(rows(control).map((row) => row.dataset['value'])).to.deep.equal(['a', 'a', 'c', 'd']);
  expect(rows(control).map((row) => row.getAttribute('aria-selected'))).to.deep.equal(['false', 'false', 'true', 'true']);
  expect(rows(control)[2]!.getAttribute('aria-disabled')).to.equal('true');
  expect(Array.from(control.shadowRoot!.querySelectorAll('[part="group-label"]'), (group) => group.textContent))
    .to.deep.equal(['First', 'Middle', 'Last']);
  expect(control.shadowRoot!.querySelector('[part="option-overflow"]')!.textContent).to.include('+1 more');
  control.maxRender = 0;
  await settle(control);
  expect(rows(control).map((row) => row.dataset['value'])).to.deep.equal(['c', 'd']);
  expect(control.shadowRoot!.querySelector('[part="option-overflow"]')!.textContent).to.include('+3 more');
});
