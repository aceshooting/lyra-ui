import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './model-select.js';
import type { LyraModelSelect } from './model-select.js';

for (const closedMode of [false, true]) {
  for (const attribute of ['label', 'hint', 'error-text'] as const) {
    it(`removes ${attribute} safely in ${closedMode ? 'catalog' : 'free-text'} mode`, async () => {
      const el = await fixture<LyraModelSelect>(html`<lr-model-select .catalog=${closedMode ? ['Choice'] : undefined}></lr-model-select>`);
      expect(el.shadowRoot!.querySelector('[role="combobox"]')!.localName).to.equal(closedMode ? 'button' : 'input');
      const property = attribute === 'error-text' ? 'errorText' : attribute;
      el.setAttribute(attribute, 'Original copy');
      await el.updateComplete;
      expect(el[property]).to.equal('Original copy');
      el.removeAttribute(attribute);
      await el.updateComplete;
      expect(el[property]).to.equal(null);
      expect(el.shadowRoot!.textContent!.includes('Original copy')).to.equal(false);
      el.setAttribute(attribute, '');
      await el.updateComplete;
      expect(el[property]).to.equal('');
      el.setAttribute(attribute, 'Restored copy');
      await el.updateComplete;
      expect(el[property]).to.equal('Restored copy');
      expect(el.shadowRoot!.textContent!.includes('Restored copy')).to.equal(true);
    });
  }
}

const press = (control: Element, key: string): void => {
  control.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
};
const activeValue = (el: LyraModelSelect): string | undefined =>
  el.shadowRoot!.querySelector<HTMLElement>('[part="option"][data-active]')?.dataset['value'];
const activeRowVisible = (el: LyraModelSelect): boolean => {
  const listbox = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!.getBoundingClientRect();
  const row = el.shadowRoot!.querySelector<HTMLElement>('[part="option"][data-active]')?.getBoundingClientRect();
  return !!row && row.top >= listbox.top - 1 && row.bottom <= listbox.bottom + 1;
};

it('keeps the keyboard-active row visible and reopens on the committed row', async () => {
  const catalog = Array.from({ length: 20 }, (_, i) => ({ id: `m${i}`, label: `Model ${i}` }));
  const el = await fixture<LyraModelSelect>(html`<lr-model-select .catalog=${catalog}></lr-model-select>`);
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]')!;
  press(trigger, 'ArrowDown');
  await el.updateComplete;
  press(trigger, 'End');
  await el.updateComplete;
  await waitUntil(() => activeRowVisible(el), 'End leaves the active row outside the listbox');
  press(trigger, 'Enter');
  await el.updateComplete;
  expect(el.value).to.equal('m19');
  press(trigger, 'ArrowDown');
  await el.updateComplete;
  expect(activeValue(el)).to.equal('m19');
  await waitUntil(() => activeRowVisible(el), 'reopening does not reveal the committed row');
});

it('keeps the active row by id across a catalog refresh while open', async () => {
  const el = await fixture<LyraModelSelect>(html`<lr-model-select .catalog=${['a', 'b', 'c']}></lr-model-select>`);
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]')!;
  for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown']) {
    press(trigger, key);
    await el.updateComplete;
  }
  expect(activeValue(el)).to.equal('b');
  el.catalog = ['z', 'a', 'b', 'c'];
  await el.updateComplete;
  expect(activeValue(el)).to.equal('b');
});

it('renders only string catalog icons', async () => {
  const branded = { _$litType$: 1, strings: ['x'], values: [] };
  const el = await fixture<LyraModelSelect>(html`<lr-model-select
    .catalog=${[{ id: 'a', label: 'A', icon: branded }, { id: 'b', label: 'B', icon: '*' }]}
  ></lr-model-select>`);
  expect(el.shadowRoot!.querySelectorAll('[part="option-icon"]').length).to.equal(1);
});

it('follows the shared form-control radius', async () => {
  const el = await fixture<LyraModelSelect>(html`<lr-model-select
    style="--lr-theme-form-control-radius: 7px" .catalog=${['a']}
  ></lr-model-select>`);
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]')!;
  expect(getComputedStyle(trigger).borderTopLeftRadius).to.equal('7px');
});
