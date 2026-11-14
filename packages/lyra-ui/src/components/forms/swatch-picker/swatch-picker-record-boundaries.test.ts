import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import type { LyraSwatchPicker } from './swatch-picker.js';
import './swatch-picker.js';

it('skips primitive swatch records and keeps the surviving option selectable by its value', async () => {
  const element = await fixture<LyraSwatchPicker>(html`<lr-swatch-picker aria-label="Accent"></lr-swatch-picker>`);
  Reflect.set(element, 'items', [null, undefined, false, 1, 'red', { value: 'blue', color: '#0000ff', label: 'Blue' }]);
  await element.updateComplete;
  expect(element.items.map(item => item.value)).to.deep.equal(['blue']);
  expect(Object.isFrozen(element.items)).to.equal(true);
  const buttons = element.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="swatch"]');
  expect(buttons.length).to.equal(1);
  expect(buttons[0]!.getAttribute('aria-label')).to.equal('Blue');
  const changed = oneEvent(element, 'lr-change');
  buttons[0]!.click();
  await changed;
  await element.updateComplete;
  expect(element.value).to.equal('blue');
  expect(buttons[0]!.getAttribute('aria-checked')).to.equal('true');
});
