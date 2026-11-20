import { fixture, expect, html } from '@open-wc/testing';
import '../lr-divider.js';
import '../lr-known-date.js';

it('omits a whitespace-only host aria-label from the divider separator', async () => {
  const el = await fixture(html`<lr-divider aria-label="   "></lr-divider>`);
  expect(el.shadowRoot!.querySelector('hr')!.hasAttribute('aria-label')).to.be.false;
});

it('does not replace the known-date fieldset name with a blank one', async () => {
  const el = await fixture(html`<lr-known-date aria-label="   "></lr-known-date>`);
  expect(el.shadowRoot!.querySelector('fieldset')!.hasAttribute('aria-label')).to.be.false;
});
