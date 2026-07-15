import { fixture, expect, html } from '@open-wc/testing';
import './badge.js';
import './tag.js';

it('renders a themed badge and tag alias', async () => {
  const el = await fixture(html`<div><lyra-badge variant="success">Ready</lyra-badge><lyra-tag>Tag</lyra-tag></div>`);
  expect(el.querySelector('lyra-badge')?.textContent).to.contain('Ready');
  expect(el.querySelector('lyra-tag')).to.exist;
  await expect(el.querySelector('lyra-badge')!).to.be.accessible();
});
