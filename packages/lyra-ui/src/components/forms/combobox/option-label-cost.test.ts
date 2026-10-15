import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import './option.js';
import './combobox.js';
import '../select/select.js';
import type { LyraOption } from './option.class.js';
import type { LyraCombobox } from './combobox.class.js';
import type { LyraSelect } from '../select/select.class.js';

for (const kind of ['select', 'combobox'] as const) {
  it(`refreshes a closed ${kind} after label-only writes without rendering each option`, async () => {
    const control = kind === 'select'
      ? await fixture<LyraSelect>(html`<lr-select label="Choice"></lr-select>`)
      : await fixture<LyraCombobox>(html`<lr-combobox label="Choice"></lr-combobox>`);
    const options = Array.from({ length: 48 }, (_, index) => {
      const option = document.createElement('lr-option') as LyraOption;
      option.value = `value-${index}`;
      option.label = `Option ${index}`;
      option.textContent = `Fallback ${index}`;
      return option;
    });
    control.append(...options);
    await Promise.all(options.map((option) => option.updateComplete));
    await aTimeout(0);
    await control.updateComplete;
    control.value = 'value-47';
    await control.updateComplete;

    let renders = 0;
    let notifications = 0;
    let inertChecks = 0;
    for (const option of options) {
      const originalRender = option.render.bind(option);
      option.render = () => { renders++; return originalRender(); };
      const originalClosest = option.closest;
      Object.defineProperty(option, 'closest', { configurable: true, value: (selector: string) => {
        if (selector === '[inert]') inertChecks++;
        return originalClosest.call(option, selector);
      } });
      option.addEventListener('lr-option-change', () => { notifications++; });
    }

    try {
      for (const [index, option] of options.entries()) option.label = `Updated ${index}`;
      await Promise.all(options.map((option) => option.updateComplete));
      await Promise.resolve();
      await control.updateComplete;
      expect(notifications).to.equal(options.length);
      expect(renders, 'an explicit label does not alter the option’s own markup').to.equal(0);
      expect(inertChecks, 'a closed picker does not need an option navigation scan').to.equal(0);
      expect(control.open).to.equal(false);
      expect(control.shadowRoot!.querySelectorAll('[role="option"]').length).to.equal(0);
      const displayed = kind === 'select'
        ? control.shadowRoot!.querySelector('[part="display-input"]')?.textContent?.trim()
        : (control.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement | null)?.value;
      expect(displayed).to.equal('Updated 47');
    } finally {
      for (const option of options) Reflect.deleteProperty(option, 'closest');
    }
  });
}

it('preserves a direct listener update during a label-only notification', async () => {
  const control = await fixture<LyraSelect>(html`<lr-select label="Choice"></lr-select>`);
  const option = document.createElement('lr-option') as LyraOption;
  option.value = 'one';
  option.label = 'First';
  option.textContent = 'Fallback';
  control.append(option);
  await option.updateComplete;
  await aTimeout(0);
  await control.updateComplete;
  control.value = 'one';
  await control.updateComplete;
  let notifications = 0;
  option.addEventListener('lr-option-change', () => {
    notifications++;
    if (notifications === 1) option.disabled = true;
  });

  option.label = 'Second';
  await option.updateComplete;
  expect(notifications, 'the label event is visible by updateComplete').to.be.greaterThan(0);
  await option.updateComplete;
  await control.updateComplete;

  expect(notifications).to.equal(2);
  expect(option.disabled).to.equal(true);
  expect(option.hasAttribute('disabled')).to.equal(true);
  expect(control.shadowRoot!.querySelector('[part="display-input"]')?.textContent?.trim()).to.equal('Second');
});

it('renders a combined label and state change and notifies once', async () => {
  const option = await fixture<LyraOption>(html`<lr-option value="one" label="First">Fallback</lr-option>`);
  const originalRender = option.render.bind(option);
  let renders = 0;
  let notifications = 0;
  option.render = () => { renders++; return originalRender(); };
  option.addEventListener('lr-option-change', () => { notifications++; });

  option.label = 'Second';
  option.disabled = true;
  await option.updateComplete;

  expect(renders).to.equal(1);
  expect(notifications).to.equal(1);
  expect(option.hasAttribute('disabled')).to.equal(true);
});

it('rebinds fallback observation after a synchronous label read drains mutations', async () => {
  const option = await fixture<LyraOption>(html`<lr-option label="Manual"><span id="wrapper"></span></lr-option>`);
  const nested = document.createElement('span');
  nested.attachShadow({ mode: 'open' }).innerHTML = '<span>Nested</span>';
  option.querySelector('#wrapper')!.append(nested);
  option.label = 'Changed manual';
  expect(option.defaultLabel).to.equal('Nested');
  await option.updateComplete;
  nested.shadowRoot!.querySelector('span')!.textContent = 'Updated nested';
  await waitUntil(() => option.defaultLabel === 'Updated nested');
});
