import { fixture, expect, html } from '@open-wc/testing';
import './color-picker.js';
import type { LyraColorPicker } from './color-picker.js';

it('renders a labeled native color input and forwards the form value', async () => {
  const el = (await fixture(html`<lyra-color-picker label="Accent" value="#ff0000"></lyra-color-picker>`)) as LyraColorPicker;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  expect(input.type).to.equal('color');
  expect(input.value).to.equal('#ff0000');
  expect(input.id).to.equal('color');
  await expect(el).to.be.accessible();
});
