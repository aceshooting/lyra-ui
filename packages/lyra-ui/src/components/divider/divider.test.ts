import { fixture, expect, html } from '@open-wc/testing';
import './divider.js';

it('renders a semantic horizontal divider and supports vertical orientation', async () => {
  const el = await fixture(html`<lr-divider orientation="vertical"></lr-divider>`);
  const divider = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(divider.getAttribute('role')).to.equal('separator');
  expect(divider.getAttribute('aria-orientation')).to.equal('vertical');
  await expect(el).to.be.accessible();
});
