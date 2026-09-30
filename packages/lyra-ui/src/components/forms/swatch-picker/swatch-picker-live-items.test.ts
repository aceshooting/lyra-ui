import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './swatch-picker.js';
import type { LyraSwatchPicker, SwatchPickerItem } from './swatch-picker.class.js';

const green = { value: 'green', color: 'rgb(0, 128, 0)', label: 'Green' };

it('contains throwing item indices and fields while retaining a usable later swatch', async () => {
  const badField = { value: 'bad', get color(): string { throw new Error('unavailable color'); }, label: 'Bad' };
  const items: SwatchPickerItem[] = [green, badField, green];
  Object.defineProperty(items, '0', { get() { throw new Error('unavailable row'); } });
  const el = await fixture<LyraSwatchPicker>(html`<lr-swatch-picker aria-label="Palette"></lr-swatch-picker>`);
  expect(() => { el.items = items; }).not.to.throw();
  await el.updateComplete;
  expect(el.items.map(item => item.value)).to.deep.equal(['green']);
  const swatch = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="swatch"]')!;
  expect(swatch.getAttribute('aria-label')).to.equal('Green');
  await focusByKeyboard(swatch);
  swatch.click();
  expect(el.value).to.equal('green');
  await expect(el).to.be.accessible();
});

it('releases a removed focused palette and restores one tab stop when items return', async () => {
  const el = await fixture<LyraSwatchPicker>(html`<lr-swatch-picker .items=${[green]} aria-label="Palette"></lr-swatch-picker>`);
  const swatch = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="swatch"]')!;
  await focusByKeyboard(swatch);
  let changes = 0;
  el.addEventListener('lr-change', () => { changes += 1; });
  el.items = [];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="swatch"]').length).to.equal(0);
  expect(el.shadowRoot!.activeElement === null).to.equal(true);
  el.items = [green];
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="swatch"][tabindex="0"]').length === 1);
  expect(changes).to.equal(0);
});
