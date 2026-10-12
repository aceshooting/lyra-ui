import { expect, fixture, html } from '@open-wc/testing';
import './color-picker.js';
import type { LyraColorPicker } from './color-picker.js';

it('omits a revoked palette and renders a later valid swatch list', async () => {
  const picker = await fixture<LyraColorPicker>(html`<lr-color-picker></lr-color-picker>`);
  const revoked = Proxy.revocable([], {});
  revoked.revoke();
  picker.swatches = revoked.proxy as unknown as typeof picker.swatches;
  await picker.updateComplete;

  expect(picker.shadowRoot!.querySelectorAll('[part~="swatch"]')).to.have.lengthOf(0);
  picker.swatches = [{ color: '#123456', label: 'Safe color' }];
  await picker.updateComplete;
  expect([...picker.shadowRoot!.querySelectorAll<HTMLElement>('[part~="swatch"]')].map((swatch) => swatch.getAttribute('aria-label'))).to.deep.equal(['Safe color']);
  await expect(picker).to.be.accessible();
});
